/**
 * RiffForge - fretboard.js
 * 24프렛 SVG 지판 렌더링
 * - 1번줄(e) 맨 위 / 6번줄(E) 맨 아래 (실제 기타 방향)
 * - 루트음 강조 (amber), 코드루트 강조 (red), 스케일음 (orange)
 * - labelMode: 'note' | 'interval' | 'none'
 */

const Fretboard = (() => {
  const STRINGS     = 6;
  const STRING_GAP  = 26;
  const MARGIN_LEFT = 46;
  const MARGIN_TOP  = 24;
  const MARGIN_BOT  = 10;
  const DOT_R       = 9;
  const SVG_NS      = 'http://www.w3.org/2000/svg';

  const INLAY_FRETS  = [3, 5, 7, 9, 12, 15, 17, 19, 21, 24];
  const DOUBLE_INLAY = new Set([12, 24]);

  function fretPos(n, startFret, endFret, totalWidth) {
    const pos  = (f) => f === 0 ? 0 : 1 - Math.pow(2, -f / 12);
    const lo   = pos(startFret);
    const hi   = pos(endFret);
    return ((pos(n) - lo) / (hi - lo)) * totalWidth;
  }

  function noteAt(stringIdx, fret) {
    return CONFIG.NOTES[(CONFIG.STANDARD_TUNING[stringIdx] + fret) % 12];
  }

  function getScaleNotes(rootNote, scaleName) {
    const intervals = CONFIG.SCALES[scaleName];
    if (!intervals) return new Set();
    const ri = CONFIG.NOTES.indexOf(rootNote);
    return new Set(intervals.map(i => CONFIG.NOTES[(ri + i) % 12]));
  }

  function getThirdNote(rootNote, scaleName) {
    const intervals = CONFIG.SCALES[scaleName];
    if (!intervals) return null;
    const ri = CONFIG.NOTES.indexOf(rootNote);
    const thirdInterval = intervals.find(i => i === 3 || i === 4);
    if (thirdInterval == null) return null;
    return CONFIG.NOTES[(ri + thirdInterval) % 12];
  }

  function el(tag, attrs) {
    const e = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
    return e;
  }

  // ── 메인 렌더 ────────────────────────────────────────────────────
  function render(containerId, options = {}) {
    const {
      rootNote     = 'A',
      scaleName    = 'Minor Pentatonic',
      startFret    = 0,
      endFret      = 12,
      chordRoot    = null,      // 백킹 재생 중 코드 루트 강조
      labelMode    = 'note',    // 'note' | 'interval' | 'none'
      activeStrings = null,     // Set<number> — 활성 현 인덱스 (0=6번줄, 5=1번줄); null이면 전체
    } = options;

    const container = document.getElementById(containerId);
    if (!container) return;

    const containerW = container.clientWidth || container.offsetWidth || 700;
    const fretAreaW  = containerW - MARGIN_LEFT - 12;
    const svgH       = MARGIN_TOP + (STRINGS - 1) * STRING_GAP + MARGIN_BOT;
    const svgW       = containerW;

    const scaleNotes = getScaleNotes(rootNote, scaleName);
    const thirdNote  = getThirdNote(rootNote, scaleName);

    const svg = el('svg', {
      viewBox: `0 0 ${svgW} ${svgH}`,
      width: '100%',
      style: 'display:block; background:#fef9f0; border-radius:8px;',
    });

    // ── 인레이 ────────────────────────────────────────────────────
    for (const f of INLAY_FRETS) {
      if (f < startFret || f > endFret) continue;
      const x1 = MARGIN_LEFT + fretPos(f - 1, startFret, endFret, fretAreaW);
      const x2 = MARGIN_LEFT + fretPos(f,     startFret, endFret, fretAreaW);
      const cx = (x1 + x2) / 2;
      const midY = MARGIN_TOP + ((STRINGS - 1) / 2) * STRING_GAP;
      if (DOUBLE_INLAY.has(f)) {
        [-STRING_GAP, STRING_GAP].forEach(dy => {
          svg.appendChild(el('circle', { cx, cy: midY + dy, r: 5, fill: '#e5d9c8' }));
        });
      } else {
        svg.appendChild(el('circle', { cx, cy: midY, r: 5, fill: '#e5d9c8' }));
      }
    }

    // ── 프렛 줄 ──────────────────────────────────────────────────
    for (let f = startFret; f <= endFret; f++) {
      const x     = MARGIN_LEFT + fretPos(f, startFret, endFret, fretAreaW);
      const isNut = f === 0 && startFret === 0;
      svg.appendChild(el('line', {
        x1: x, y1: MARGIN_TOP, x2: x, y2: MARGIN_TOP + (STRINGS - 1) * STRING_GAP,
        stroke: isNut ? '#5a3a1a' : '#c8b89a',
        'stroke-width': isNut ? 4 : 1.5,
      }));
    }

    // ── 프렛 번호 ─────────────────────────────────────────────────
    [0, 3, 5, 7, 9, 12, 15, 17, 19, 21, 24].forEach(f => {
      if (f < startFret || f > endFret) return;
      const xL = MARGIN_LEFT + fretPos(f === 0 ? 0 : f - 1, startFret, endFret, fretAreaW);
      const xR = MARGIN_LEFT + fretPos(f,                   startFret, endFret, fretAreaW);
      const cx = f === 0 ? xL : (xL + xR) / 2;
      if (cx < MARGIN_LEFT) return;
      const txt = el('text', {
        x: cx, y: 14,
        'text-anchor': 'middle',
        'font-size': '10', fill: '#9a7a5a',
      });
      txt.textContent = f;
      svg.appendChild(txt);
    });

    // ── 스트링 (s=0: 6번줄 E 맨 아래, s=5: 1번줄 e 맨 위) ────────
    for (let s = 0; s < STRINGS; s++) {
      const active = !activeStrings || activeStrings.has(s);
      const y     = MARGIN_TOP + (STRINGS - 1 - s) * STRING_GAP;   // 뒤집힌 Y
      const thick = 1.0 + (STRINGS - 1 - s) * 0.38;                // s=0이 가장 굵음
      svg.appendChild(el('line', {
        x1: MARGIN_LEFT, y1: y,
        x2: MARGIN_LEFT + fretAreaW, y2: y,
        stroke: active ? '#7a6a5a' : '#d1c4b0',
        'stroke-width': thick,
        opacity: active ? '1' : '0.35',
      }));
      const lbl = el('text', {
        x: MARGIN_LEFT - 8, y: y + 4,
        'text-anchor': 'middle',
        'font-size': '10', 'font-weight': 'bold',
        fill: active ? '#9a7a5a' : '#c8b89a',
        opacity: active ? '1' : '0.4',
      });
      lbl.textContent = CONFIG.STRING_NAMES[s];
      svg.appendChild(lbl);
    }

    // ── 노트 표시 ────────────────────────────────────────────────
    const chordNoteMap = options.chordNoteMap || null;
    const noteColorFn  = options.noteColorFn  || null; // (fret,sIdx,note,role)=>{fill,stroke,textFill,dotR,label,opacity}

    for (let s = 0; s < STRINGS; s++) {
      if (activeStrings && !activeStrings.has(s)) continue;
      for (let f = startFret; f <= endFret; f++) {
        const note = noteAt(s, f);
        let fill, stroke, textFill, dotR = DOT_R, opacity = 1, customLabel = null;

        if (noteColorFn) {
          // ── 커스텀 컬러 함수 모드 ─────────────────────────────
          let role = null;
          if (chordNoteMap) {
            role = chordNoteMap.get(note);
            if (!role) continue;
          } else {
            if (!scaleNotes.has(note)) continue;
          }
          const res = noteColorFn(f, s, note, role);
          if (!res) continue;
          fill        = res.fill;
          stroke      = res.stroke      ?? res.fill;
          textFill    = res.textFill    ?? '#fff';
          dotR        = res.dotR        ?? DOT_R;
          opacity     = res.opacity     ?? 1;
          customLabel = res.label       ?? null;
        } else if (chordNoteMap) {
          // ── 코드톤 모드 ───────────────────────────────────────
          const role = chordNoteMap.get(note);
          if (!role) continue;
          switch (role) {
            case 'root':    fill='#f59e0b'; stroke='#d97706'; textFill='#fff'; dotR=10; break;
            case 'third':   fill='#a3e635'; stroke='#65a30d'; textFill='#1a2e05'; break;
            case 'fifth':   fill='#38bdf8'; stroke='#0284c7'; textFill='#fff'; break;
            case 'seventh': fill='#c084fc'; stroke='#7c3aed'; textFill='#fff'; break;
            default:        fill='#fb923c'; stroke='#ea580c'; textFill='#fff';
          }
        } else {
          // ── 스케일 모드 ───────────────────────────────────────
          if (!scaleNotes.has(note)) continue;
          const isRoot      = note === rootNote;
          const isChordRoot = chordRoot && note === chordRoot && !isRoot;
          const isThird     = !chordRoot && note === thirdNote && !isRoot;
if (isRoot)           { fill='#f97316'; stroke='#c2410c'; textFill='#fff'; dotR=10; }
else if (isChordRoot) { fill='#ef4444'; stroke='#dc2626'; textFill='#fff'; dotR=11; }
else                  { fill='#60a5fa'; stroke='#2563eb'; textFill='#fff'; }
        }

        // X 좌표
        let cx;
        if (f === 0) {
          cx = MARGIN_LEFT - 14;
        } else {
          const xL = MARGIN_LEFT + fretPos(f - 1, startFret, endFret, fretAreaW);
          const xR = MARGIN_LEFT + fretPos(f,     startFret, endFret, fretAreaW);
          cx = (xL + xR) / 2;
        }
        const cy = MARGIN_TOP + (STRINGS - 1 - s) * STRING_GAP;

        const circ = el('circle', {
          cx, cy, r: dotR, fill, stroke,
          'stroke-width': dotR > DOT_R ? 2.5 : 1.5,
        });
        if (opacity !== 1) circ.setAttribute('opacity', opacity);
        svg.appendChild(circ);

        // 라벨
        if (labelMode !== 'none') {
          let label = customLabel !== null ? customLabel : note;
          if (customLabel === null && labelMode === 'interval') {
            const ints = CONFIG.SCALES[scaleName];
            if (ints) {
              const ri = CONFIG.NOTES.indexOf(rootNote);
              const ni = CONFIG.NOTES.indexOf(note);
              const semi = (ni - ri + 12) % 12;
const SEMI_LBL = { 0:'R', 1:'♭2', 2:'2', 3:'♭3', 4:'3', 5:'4', 6:'♭5', 7:'5', 8:'♭6', 9:'6', 10:'♭7', 11:'7' };
label = ints.includes(semi) ? (SEMI_LBL[semi] || note) : note;
            }
          }
          const txt = el('text', {
            x: cx, y: cy + 4,
            'text-anchor': 'middle',
            'font-size': label.length > 1 ? '6.5' : '8',
            'font-weight': 'bold',
            fill: textFill,
          });
          if (opacity !== 1) txt.setAttribute('opacity', opacity);
          txt.textContent = label;
          svg.appendChild(txt);
        }
      }
    }

    container.innerHTML = '';
    container.appendChild(svg);
  }

  // ── 코드톤 맵 빌더 ──────────────────────────────────────────────
  // chord: { root, type }  →  Map<noteName, role>
  function buildChordNoteMap(chord) {
    const ct = CONFIG.CHORD_TYPES.find(c => c.id === chord.type);
    const intervals = ct?.intervals || [0, 4, 7];
    const roles = ['root', 'third', 'fifth', 'seventh'];
    const ri = CONFIG.NOTES.indexOf(chord.root);
    const map = new Map();
    intervals.forEach((iv, idx) => {
      map.set(CONFIG.NOTES[(ri + iv) % 12], roles[idx] || 'root');
    });
    return map;
  }

  // ── 스튜디오 지판 옵션 & 업데이트 ───────────────────────────────
  let _opts = { rootNote: 'A', startFret: 0, endFret: 12, chordNoteMap: null, chordRoot: null, labelMode: 'note' };

  // 코드톤 모드: 코드 구성음만 표시 (스케일 무관)
  function updateWithChordTones(chord) {
    if (!chord) return;
    _opts.chordNoteMap = buildChordNoteMap(chord);
    _opts.chordRoot = chord.root;
    render('fretboard-svg', _opts);
  }

  // legacy alias (기존 호출 호환)
  function update(patch) {
    Object.assign(_opts, patch);
    render('fretboard-svg', _opts);
  }

  function updateWithChord(chord) {
    updateWithChordTones(chord);
  }

  // 스케일 모드 복원 (수동 호출용)
  function resetToScale() {
    _opts.chordNoteMap = null;
    _opts.chordRoot = null;
    render('fretboard-svg', _opts);
  }

  // ── 참고 자료 지판 (독립 인스턴스) ──────────────────────────────
  let _refOpts = { rootNote: 'A', scaleName: 'Minor Pentatonic', startFret: 0, endFret: 17, chordNoteMap: null, chordRoot: null, labelMode: 'note' };

  function updateRef(patch) {
    Object.assign(_refOpts, patch);
    render('ref-fretboard-svg', _refOpts);
  }

  // ── 미니 코드 다이어그램 ──────────────────────────────────────────
  const CHORD_SHAPES = {
    'C':  { frets: [0,3,2,0,1,0] },
    'D':  { frets: [-1,-1,0,2,3,2] },
    'E':  { frets: [0,2,2,1,0,0] },
    'G':  { frets: [3,2,0,0,0,3] },
    'Am': { frets: [0,0,2,2,1,0] },
    'Em': { frets: [0,2,2,0,0,0] },
    'F':  { frets: [1,1,2,3,3,1], barre: { fret:1, from:0, to:5 } },
    'Bm': { frets: [2,2,4,4,3,2], barre: { fret:2, from:0, to:5 } },
  };

  function renderChordDiagram(containerId, chordName) {
    const chord     = CHORD_SHAPES[chordName];
    const container = document.getElementById(containerId);
    if (!container) return;
    if (!chord) { container.innerHTML = `<p class="text-gray-400 text-sm">${chordName}</p>`; return; }

    const W = 90, H = 110;
    const L = 18, T = 24, SG = 12, FG = 16, DF = 5;

    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H });

    const title = el('text', { x: W/2, y: 14, 'text-anchor':'middle', 'font-size':'12', 'font-weight':'bold', fill:'#374151' });
    title.textContent = chord.name || chordName;
    svg.appendChild(title);

    svg.appendChild(el('rect', { x: L, y: T, width: (STRINGS-1)*SG, height: 3, fill: '#374151' }));

    for (let f = 0; f <= DF; f++) {
      const y = T + f * FG;
      svg.appendChild(el('line', { x1: L, y1: y, x2: L+(STRINGS-1)*SG, y2: y, stroke:'#9ca3af','stroke-width':1 }));
    }
    for (let s = 0; s < STRINGS; s++) {
      const x = L + s * SG;
      svg.appendChild(el('line', { x1: x, y1: T, x2: x, y2: T+DF*FG, stroke:'#9ca3af','stroke-width':1 }));
    }

    if (chord.barre) {
      const { fret, from, to } = chord.barre;
      const by = T + (fret - 0.5) * FG;
      svg.appendChild(el('rect', { x: L+from*SG-4, y: by-5, width: (to-from)*SG+8, height:10, rx:5, fill:'#374151' }));
    }

    chord.frets.forEach((fret, s) => {
      const x = L + s * SG;
      if (fret === -1) {
        const t = el('text', { x, y: T-6, 'text-anchor':'middle','font-size':'9', fill:'#ef4444' });
        t.textContent = '×'; svg.appendChild(t);
      } else if (fret === 0) {
        svg.appendChild(el('circle', { cx: x, cy: T-7, r: 4, fill:'none', stroke:'#374151','stroke-width':1.5 }));
      } else {
        const cy = T + (fret - 0.5) * FG;
        svg.appendChild(el('circle', { cx: x, cy, r: 5, fill:'#f59e0b' }));
      }
    });

    container.innerHTML = '';
    container.appendChild(svg);
  }

  return { render, update, updateWithChord, updateWithChordTones, buildChordNoteMap, resetToScale, updateRef, renderChordDiagram, getScaleNotes, getThirdNote };
})();
