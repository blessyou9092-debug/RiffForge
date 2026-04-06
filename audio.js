/**
 * RiffForge - audio.js
 * 메트로놈(Web Audio API) + 백킹 트랙 생성 엔진
 */

// ═══════════════════════════════════════════════════════════════════════════
// AudioEngine: Web Audio Context 공유
// ═══════════════════════════════════════════════════════════════════════════
const AudioEngine = (() => {
  let ctx = null;
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  return { getCtx };
})();


// ═══════════════════════════════════════════════════════════════════════════
// Metronome: 볼륨·세분화·박자패턴·음색 지원 정밀 메트로놈
// ═══════════════════════════════════════════════════════════════════════════
const Metronome = (() => {
  // ── 상태 ─────────────────────────────────────────────────────────
  let bpm = CONFIG.METRONOME.DEFAULT_BPM;
  let timeSig = CONFIG.METRONOME.TIME_SIGS[0];   // 4/4
  let subdivId = 'quarter';
  let volume = 1.0;   // 0.0 ~ 2.5
  let soundTypeId = 'click';
  let beatPattern = [];    // 'accent' | 'normal' | 'silent' (박자 수만큼)

  let isPlaying = false;
  let currentBeat = 0;
  let currentSub = 0;
  let nextNoteTime = 0;
  let timerID = null;
  let onBeatCb = null;

  // ── 박자 패턴 초기화 ─────────────────────────────────────────────
  function initPattern() {
    beatPattern = Array.from({ length: timeSig.beats }, (_, i) =>
      i === 0 ? 'accent' : 'normal'
    );
  }

  // 클릭으로 순환: accent → normal → silent → accent
  function cycleBeat(idx) {
    const cycle = { accent: 'normal', normal: 'silent', silent: 'accent' };
    beatPattern[idx] = cycle[beatPattern[idx]] || 'normal';
    return beatPattern[idx];
  }

  // ── 세분화 perBeat ───────────────────────────────────────────────
  function getPerBeat() {
    return CONFIG.SUBDIVISIONS.find(s => s.id === subdivId)?.perBeat ?? 1;
  }

  // ══════════════════════════════════════════════════════════════════
  // 사운드 생성기
  // ══════════════════════════════════════════════════════════════════
  function _click(ctx, time, isAccent, gain) {
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = isAccent ? 1500 : 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain * 0.7, time);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(time); osc.stop(time + 0.03);
  }

  function _wood(ctx, time, isAccent, gain) {
    [[isAccent ? 800 : 600, 'triangle', 0.8, 0.07],
    [isAccent ? 400 : 300, 'sine', 0.4, 0.11]].forEach(([f, t, gm, d]) => {
      const osc = ctx.createOscillator();
      osc.type = t; osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(gain * gm, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + d);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(time); osc.stop(time + d + 0.01);
    });
  }

  function _beep(ctx, time, isAccent, gain) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = isAccent ? 1760 : 880;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(gain * 0.9, time + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(time); osc.stop(time + 0.09);
  }

  function _cowbell(ctx, time, isAccent, gain) {
    [562, 845].forEach(freq => {
      const osc = ctx.createOscillator();
      osc.type = 'square'; osc.frequency.value = freq;
      const hpf = ctx.createBiquadFilter();
      hpf.type = 'highpass'; hpf.frequency.value = 600;
      const g = ctx.createGain();
      const decay = isAccent ? 0.35 : 0.2;
      g.gain.setValueAtTime(gain * 0.35, time);
      g.gain.exponentialRampToValueAtTime(0.001, time + decay);
      osc.connect(hpf); hpf.connect(g); g.connect(ctx.destination);
      osc.start(time); osc.stop(time + decay + 0.05);
    });
  }

  function playTick(time, mode, isSub) {
    if (mode === 'silent') return;
    const c = AudioEngine.getCtx();
    const isAccent = mode === 'accent';
    const g = volume * (isSub ? 0.32 : 1.0);
    if (g < 0.001) return;
    switch (soundTypeId) {
      case 'click': _click(c, time, isAccent, g); break;
      case 'wood': _wood(c, time, isAccent, g); break;
      case 'beep': _beep(c, time, isAccent, g); break;
      case 'cowbell': _cowbell(c, time, isAccent, g); break;
      default: _click(c, time, isAccent, g);
    }
  }

  // ── 스케줄러 ─────────────────────────────────────────────────────
  function scheduler() {
    const c = AudioEngine.getCtx();
    const perBeat = getPerBeat();
    const secPerSub = (60.0 / bpm) / perBeat;

    while (nextNoteTime < c.currentTime + 0.12) {
      const isMain = currentSub === 0;
      if (isMain) {
        const mode = beatPattern[currentBeat % beatPattern.length] || 'normal';
        playTick(nextNoteTime, mode, false);
        if (onBeatCb) onBeatCb(currentBeat % beatPattern.length, beatPattern);
      } else {
        playTick(nextNoteTime, 'normal', true);
      }

      nextNoteTime += secPerSub;
      currentSub = (currentSub + 1) % perBeat;
      if (currentSub === 0) currentBeat = (currentBeat + 1) % timeSig.beats;
    }
    timerID = setTimeout(scheduler, 25);
  }

  function start() {
    if (isPlaying) return;
    const c = AudioEngine.getCtx();
    isPlaying = true;
    currentBeat = 0;
    currentSub = 0;
    nextNoteTime = c.currentTime + 0.05;
    scheduler();
  }
  function stop() {
    isPlaying = false;
    clearTimeout(timerID);
    timerID = null;
  }
  function toggle() { isPlaying ? stop() : start(); return isPlaying; }

  function setBpm(val) {
    bpm = Math.max(CONFIG.METRONOME.MIN_BPM, Math.min(CONFIG.METRONOME.MAX_BPM, parseInt(val) || 80));
    return bpm;
  }
  function adjustBpm(delta) { return setBpm(bpm + delta); }
  function setTimeSig(sig) { timeSig = sig; initPattern(); }
  function setSubdiv(id) { subdivId = id; }
  function setVolume(v) { volume = Math.max(0, Math.min(2.5, parseFloat(v))); }
  function setSoundType(id) { soundTypeId = id; }
  function onBeat(cb) { onBeatCb = cb; }

  initPattern();

  return {
    start, stop, toggle, setBpm, adjustBpm, setTimeSig, setSubdiv, setVolume, setSoundType,
    cycleBeat, initPattern, onBeat,
    getBpm: () => bpm,
    getVolume: () => volume,
    getIsPlaying: () => isPlaying,
    getBeatPattern: () => [...beatPattern],
    getTimeSig: () => timeSig,
  };
})();


// ═══════════════════════════════════════════════════════════════════════════
// BackingEngine: 드럼 + 베이스 + 화성 악기 생성 엔진
// ═══════════════════════════════════════════════════════════════════════════
const BackingEngine = (() => {
  let isPlaying = false;
  let bpm = 90;
  let progression = [];    // [{root, type}]
  let genreId = 'blues';
  let harmonyInst = 'piano';

  const volumes = { kick: 0.8, snare: 0.5, hihat: 0.3, bass: 0.55, harmony: 0.45 };

  let ctx = null;
  let masterGain = null;
  let schedID = null;
  let chordIdx = 0;
  let beatIdx = 0;
  let nextNoteTime = 0;
  let onChordChangeCb = null;
  let currentBarChord = null;
  let currentBarBassPattern = [];

  // ── 장르별 베이스 리듬 패턴 생성기 ──────────────────────────────
  // [[step(0-15), semitoneOffset, durationInSteps], ...]
  function getBassPatternForChord(chord) {
    const ct = CONFIG.CHORD_TYPES.find(c => c.id === chord.type);
    const iv = ct?.intervals || [0, 4, 7];
    const r = 0, th = iv[1] ?? 4, fi = iv[2] ?? 7, sv = iv[3] ?? 10;

    switch (genreId) {
      case 'jazz': case 'smoothjazz':
        // 워킹 베이스: Root → 3rd → 5th → b7 한 박자씩
        return [[0, r, 4], [4, th, 4], [8, fi, 4], [12, sv, 4]];
      case 'funk':
        // 싱코페이션 + 옥타브 도약
        return [[0, r, 2], [3, r + 12, 1], [6, fi, 2], [8, r, 2], [11, r + 12, 1], [13, fi, 3]];
      case 'jpop': case 'jpop_rock':
        // 8분음표 패턴: root & 5th 교차
        return [[0, r, 2], [2, r, 2], [4, fi, 2], [6, r, 2], [8, r, 2], [10, fi, 2], [12, r, 2], [14, r, 2]];
      case 'rock': case 'poppunk':
        // 8분음표 + 3박에 5도 액센트
        return [[0, r, 2], [2, r, 2], [4, r, 2], [6, r, 2], [8, fi, 2], [10, fi, 2], [12, r, 2], [14, r, 2]];
      case 'hardrock':
        // 드라이빙 8분음표 루트
        return [[0, r, 2], [2, r, 2], [4, r, 2], [6, r, 2], [8, r, 2], [10, r, 2], [12, r, 2], [14, r, 2]];
      case 'citypop':
        // 5도·7도를 활용한 그루비 라인
        return [[0, r, 4], [4, fi, 2], [7, sv, 1], [8, r + 12, 2], [10, sv, 2], [12, fi, 4]];
      case 'lofi':
        // 여유로운 sparse groove
        return [[0, r, 6], [8, fi, 4], [12, r, 4]];
      case 'blues': default:
        // 클래식 블루스: root / 5th 교대
        return [[0, r, 8], [8, fi, 8]];
    }
  }

  // ── 드럼 패턴 (16스텝 = 1마디 4/4) ──────────────────────────────
  const DRUM_PATTERNS = {
    blues: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    },
    rock: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
    funk: {
      kick: [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 1, 0],
      hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
    jazz: {
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    },
    jpop: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    },
    citypop: {
      kick: [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
    hardrock: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
    lofi: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hihat: [1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 1, 0, 0, 0, 1, 0]
    },
    poppunk: {
      kick: [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
      snare: [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0],
      hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
    smoothjazz: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1],
      hihat: [1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0]
    },
    jpop_rock: {
      kick: [1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      snare: [0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      hihat: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    },
  };

  // ── 드럼 사운드 ──────────────────────────────────────────────────
  function playKick(t) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
    const g = ctx.createGain();
    g.gain.setValueAtTime(volumes.kick, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.2);
  }

  function playSnare(t) {
    const bufLen = ctx.sampleRate * 0.1;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const bpf = ctx.createBiquadFilter();
    bpf.type = 'bandpass'; bpf.frequency.value = 1500; bpf.Q.value = 0.5;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volumes.snare, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(bpf); bpf.connect(g); g.connect(masterGain);
    src.start(t); src.stop(t + 0.15);

    const osc = ctx.createOscillator();
    osc.type = 'triangle'; osc.frequency.value = 185;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.12, t);
    g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
    osc.connect(g2); g2.connect(masterGain);
    osc.start(t); osc.stop(t + 0.1);
  }

  function playHihat(t) {
    const bufLen = ctx.sampleRate * 0.05;
    const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const hpf = ctx.createBiquadFilter();
    hpf.type = 'highpass'; hpf.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(volumes.hihat, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    src.connect(hpf); hpf.connect(g); g.connect(masterGain);
    src.start(t); src.stop(t + 0.08);
  }

  // ── 베이스 ───────────────────────────────────────────────────────
  function playBass(freq, t, dur) {
    // 장르별 강약 조절
    const dynamics = {
      funk: 0.85, hardrock: 0.9, poppunk: 0.88,
      blues: 0.7, jpop_rock: 0.72,
      citypop: 0.6, lofi: 0.45, smoothjazz: 0.5,
    };
    const vel = volumes.bass * (dynamics[genreId] || 0.65);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth'; osc.frequency.value = freq;
    const lpf = ctx.createBiquadFilter();
    lpf.type = 'lowpass';
    // 장르별 필터: 펑크/하드록은 밝게, lo-fi/재즈는 어둡게
    lpf.frequency.value = ['funk', 'hardrock', 'poppunk'].includes(genreId) ? 550 : 320;
    lpf.Q.value = 2;
    const g = ctx.createGain();
    // 장르별 릴리즈: 짧은 노트가 뚝 끊기지 않도록 sustainRatio를 높이고
    // 오실레이터는 releaseTail 만큼 더 울린 뒤 끊음
    const sustainRatio = genreId === 'lofi' ? 0.78 : genreId === 'citypop' ? 0.85 : 0.92;
    const releaseTail  = 0.06; // 60ms 여운
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vel, t + 0.012);
    g.gain.setValueAtTime(vel * 0.88, t + dur * sustainRatio);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur + releaseTail);
    osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + releaseTail + 0.01);
  }


  // ── 화성 악기 ────────────────────────────────────────────────────
  function getChordFreqs(chord, octave = 4) {
    const ct = CONFIG.CHORD_TYPES.find(c => c.id === chord.type);
    const intervals = ct?.intervals || [0, 4, 7];
    const rootMidi = CONFIG.noteToMidi(chord.root, octave);
    return intervals.map(i => CONFIG.midiToHz(rootMidi + i));
  }

  function playPiano(freqs, t, dur) {
    freqs.forEach((freq, fi) => {
      [1, 2, 3].forEach((h, hi) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq * h;
        osc.detune.value = fi * 2 + hi;
        const peak = volumes.harmony * [0.45, 0.18, 0.07][hi] * (fi === 0 ? 1.3 : 0.85);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + 0.01);
        g.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.35);
        g.gain.exponentialRampToValueAtTime(0.001, t + Math.min(dur * 0.88, 2.2));
        osc.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + dur);
      });
    });
  }

function playGuitar(freqs, t, dur) {
  // ── 클린톤 일렉기타 ─────────────────────────────────────────────
  // Karplus-Strong 계열 어프로치:
  // 1) 피킹 어택: 짧은 노이즈 버스트 (현 튕기는 순간)
  // 2) 바디 톤: triangle + sine 혼합 (따뜻하고 투명한 클린)
  // 3) 스트럼 타이밍: 현마다 아주 살짝 지연 (자연스러운 코드 스트럼)
  // 4) 코러스 효과: 미세 디튠으로 공간감

  freqs.forEach((freq, fi) => {
    const strum = fi * 0.011; // 스트럼 간격 11ms
    const st = t + strum;

    // ── 1) 피킹 어택 노이즈 (현 튕기는 찰나) ──────────────────────
    const noiseLen = Math.floor(ctx.sampleRate * 0.018);
    const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
    const noiseData = noiseBuf.getChannelData(0);
    for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1);
    const noiseSrc = ctx.createBufferSource();
    noiseSrc.buffer = noiseBuf;

    const noiseHpf = ctx.createBiquadFilter();
    noiseHpf.type = 'bandpass';
    noiseHpf.frequency.value = freq * 2.5;
    noiseHpf.Q.value = 0.8;

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(volumes.harmony * 0.18, st);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, st + 0.022);

    noiseSrc.connect(noiseHpf);
    noiseHpf.connect(noiseGain);
    noiseGain.connect(masterGain);
    noiseSrc.start(st);
    noiseSrc.stop(st + 0.025);

    // ── 2) 메인 톤: triangle (바디) + sine (배음) ─────────────────
    [[freq, 'triangle', 1.0],
     [freq * 2, 'sine', 0.28],
     [freq * 3, 'sine', 0.10]].forEach(([f, type, rel], hi) => {

      // 코러스: 두 개의 오실레이터를 미세하게 디튠
      [-4, +4].forEach(detuneCents => {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.value = f;
        osc.detune.value = detuneCents;

        // 밝은 피킹 → 자연스럽게 어두워지는 필터 (현의 배음 감쇠 모사)
        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass';
        lpf.frequency.setValueAtTime(freq * 18, st);           // 피킹 순간: 밝게
        lpf.frequency.exponentialRampToValueAtTime(freq * 4, st + 0.08);  // 빠르게 어두워짐
        lpf.frequency.exponentialRampToValueAtTime(freq * 2.2, st + dur * 0.6); // 서스테인
        lpf.Q.value = 0.5;

        // 약한 Presence 부스트 (2~4kHz: 일렉기타 특유의 쨍한 중역)
        const presence = ctx.createBiquadFilter();
        presence.type = 'peaking';
        presence.frequency.value = Math.min(freq * 6, 3200);
        presence.gain.value = 3.5;
        presence.Q.value = 1.2;

        const peak = volumes.harmony * rel * 0.38 * (fi === 0 ? 1.2 : 0.9) * 0.5;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(peak, st + 0.008);          // 빠른 어택
        g.gain.exponentialRampToValueAtTime(peak * 0.72, st + 0.12); // 초기 감쇠
        g.gain.exponentialRampToValueAtTime(peak * 0.55, st + dur * 0.5); // 서스테인 유지
        g.gain.exponentialRampToValueAtTime(0.001, st + Math.min(dur * 0.92, 2.8)); // 릴리즈

        osc.connect(lpf);
        lpf.connect(presence);
        presence.connect(g);
        g.connect(masterGain);
        osc.start(st);
        osc.stop(st + Math.min(dur * 0.95, 2.9));
      });
    });
  });
}

  function playSynth(freqs, t, dur) {
    freqs.forEach(freq => {
      [-6, 6].forEach(detune => {
        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        osc.detune.value = detune;
        const lpf = ctx.createBiquadFilter();
        lpf.type = 'lowpass'; lpf.frequency.value = 1300; lpf.Q.value = 0.6;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(volumes.harmony * 0.16, t + 0.14);
        g.gain.setValueAtTime(volumes.harmony * 0.16, t + dur - 0.18);
        g.gain.linearRampToValueAtTime(0, t + dur + 0.05);
        osc.connect(lpf); lpf.connect(g); g.connect(masterGain);
        osc.start(t); osc.stop(t + dur + 0.1);
      });
    });
  }

  function playHarmony(chord, t, dur) {
    if (volumes.harmony <= 0.001) return;   // ← 0일 때 exponentialRamp 에러 방지
    const freqs = getChordFreqs(chord, 4);
    switch (harmonyInst) {
      case 'piano': playPiano(freqs, t, dur); break;
      case 'guitar': playGuitar(freqs, t, dur); break;
      case 'synth': playSynth(freqs, t, dur); break;
    }
  }


  // ── 스케줄러 ─────────────────────────────────────────────────────
  const STEPS = 16;
  const BEATS = 4;

  function scheduler() {
    const secPerStep = (60 / bpm) / (STEPS / BEATS);
    const pattern = DRUM_PATTERNS[genreId] || DRUM_PATTERNS.blues;

    while (nextNoteTime < ctx.currentTime + 0.12) {
      const step = beatIdx % STEPS;

      if (pattern.kick[step]) playKick(nextNoteTime);
      if (pattern.snare[step]) playSnare(nextNoteTime);
      if (pattern.hihat[step]) playHihat(nextNoteTime);

      // 코드 전환: 각 마디 첫 스텝
      if (step === 0 && progression.length > 0) {
        currentBarChord = progression[chordIdx % progression.length];
        const barDur = secPerStep * STEPS;
        playHarmony(currentBarChord, nextNoteTime, barDur);
        if (onChordChangeCb) onChordChangeCb(chordIdx % progression.length);
        chordIdx++;
        currentBarBassPattern = getBassPatternForChord(currentBarChord);
      }

      // 장르별 베이스 리듬 패턴 적용
      if (currentBarChord) {
        const bn = currentBarBassPattern.find(([s]) => s === step);
        if (bn) {
          const [, semi, dur] = bn;
          const rootMidi = CONFIG.noteToMidi(currentBarChord.root, 2);
          playBass(CONFIG.midiToHz(rootMidi + semi), nextNoteTime, secPerStep * dur);
        }
      }

      nextNoteTime += secPerStep;
      beatIdx++;
    }
    schedID = setTimeout(scheduler, 25);
  }

  function start(prog, genre, bpmVal) {
    if (isPlaying) stop();
    ctx = AudioEngine.getCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(ctx.destination);

    progression = prog;
    genreId = genre;
    bpm = bpmVal;
    chordIdx = 0;
    beatIdx = 0;
    currentBarChord = null;
    currentBarBassPattern = [];
    nextNoteTime = ctx.currentTime + 0.05;
    isPlaying = true;
    scheduler();
  }

  function stop() {
    isPlaying = false;
    clearTimeout(schedID);
    schedID = null;
    if (masterGain) {
      try {
        masterGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      } catch (_) { }
    }
  }

  function setVolume(type, val) {
    if (Object.prototype.hasOwnProperty.call(volumes, type))
      volumes[type] = Math.max(0, Math.min(1, parseFloat(val)));
  }

  function setBpm(val) { bpm = parseInt(val); }
  function setHarmonyInstrument(id) { harmonyInst = id; }
  function onChordChange(cb) { onChordChangeCb = cb; }

  return {
    start, stop, setBpm, setVolume, setHarmonyInstrument, onChordChange,
    getIsPlaying: () => isPlaying,
  };
})();


// ═══════════════════════════════════════════════════════════════════════════
// playPomodoroBell: 포모도로 완료 알림음 (3가지)
// ═══════════════════════════════════════════════════════════════════════════
function playPomodoroBell(type = 'beep') {
  try {
    const c = AudioEngine.getCtx();
    switch (type) {
      case 'chime': {
        // 부드러운 종소리: C5→E5→G5→C6 아르페지오
        [523, 659, 784, 1047].forEach((freq, i) => {
          const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = freq;
          const g = c.createGain();
          const t = c.currentTime + i * 0.28;
          g.gain.setValueAtTime(0, t);
          g.gain.linearRampToValueAtTime(0.35, t + 0.04);
          g.gain.exponentialRampToValueAtTime(0.001, t + 1.3);
          osc.connect(g); g.connect(c.destination);
          osc.start(t); osc.stop(t + 1.4);
        });
        break;
      }
      case 'alarm': {
        // 경쾌한 알람: 짧은 스퀘어파 3번
        [0, 0.2, 0.4].forEach(offset => {
          const osc = c.createOscillator(); osc.type = 'square'; osc.frequency.value = 1100;
          const g = c.createGain();
          const t = c.currentTime + offset;
          g.gain.setValueAtTime(0.28, t);
          g.gain.setValueAtTime(0.28, t + 0.13);
          g.gain.linearRampToValueAtTime(0, t + 0.16);
          osc.connect(g); g.connect(c.destination);
          osc.start(t); osc.stop(t + 0.18);
        });
        break;
      }
      default: {
        // 기본 삐-소리
        const osc = c.createOscillator(); osc.type = 'sine'; osc.frequency.value = 880;
        const g = c.createGain();
        g.gain.setValueAtTime(0.4, c.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1);
        osc.connect(g); g.connect(c.destination);
        osc.start(); osc.stop(c.currentTime + 1);
      }
    }
  } catch (_) { }
}
