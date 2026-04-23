// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// ReferenceUI: 참고 자료 탭 관리  (Phase 9 — Triad / Four-Note 완전 분리)
// ─ 트라이어드     : 3화음(major/minor/dim/aug)의 전위(Root/1st/2nd) 학습
//                   · String Set(1-3, 2-4, 3-5, 4-6)별 폼 탐색
//                   · "음 쌓는 순서"로 사용자가 학습할 사항
// ─ 포 노트 보이싱 : 7th 코드(maj7/dom7/m7/m7b5/dim7)의 루트 선별 배치 학습
//                   · Root 위치(6/5/4/3번선)에 따라 R-3-5-7 인터벌 배치
//                   · "인터벌 관계 인지"로 사용자가 학습할 사항
// ─ 펜타토닉       : CAGED 루트 오프셋 기반 이동형 박스 알고리즘
// ─ 코드톤         : 역할별 고정 색상 전역 렌더링
// ═══════════════════════════════════════════════════════════════════════════
const ReferenceUI = (() => {

  // ── 상태 ────────────────────────────────────────────────────────────────
  let activeTab = 'circle';
  // 트라이어드: 3화음만 취급
  let _triadRoot = 'C';
  let _triadType = 'major';   // 'major' | 'minor' | 'dim' | 'aug'
  let _triadVoicing = 'all';  // 'all' | 'root' | '1st' | '2nd'
  let _triadStrGroup = '123'; // '123' | '234' | '345' | '456'
  let _triadLabelMode = 'interval'; // 'interval' | 'note'
  let _pentaPos = 0;         // 0=All, 1~5
  let _pentaKey = 'major';   // 'major'|'minor'
  let _chordToneRoot = 'A';
  let _chordToneType = 'major';
  let _chordToneLabelMode = 'interval'; // 'interval' | 'note'

  // 포 노트 보이싱: 7th 코드 전담
  let _fourNoteRoot    = 'C';
  let _fourNoteRootStr = 0;   // 0=6번선, 1=5번선, 2=4번선, 3=3번선
  let _fourNoteType    = 'maj7';  // 기본값을 7th 코드로 변경

  // ── 공통 상수 ────────────────────────────────────────────────────────────
  // 개방현 MIDI (strIdx 0=1번e, 1=2번B, 2=3번G, 3=4번D, 4=5번A, 5=6번E)
  // v9 OPEN_MIDI = [64,59,55,50,45,40]  (index 0=1e … 5=6E)
  // RiffForge Fretboard.js의 CONFIG.STANDARD_TUNING = [40,45,50,55,59,64]
  //   (index 0=6E, 1=5A, 2=4D, 3=3G, 4=2B, 5=1e)
  // → v9 strIdx(s) ↔ RiffForge sIdx 변환: rfSIdx = 5 - v9s
  const V9_OPEN = [64, 59, 55, 50, 45, 40]; // v9 기준 (0=1e)
  const RF_TUNING = CONFIG.STANDARD_TUNING;    // RiffForge 기준 (0=6E)

  const KEY_SEMITONES = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'Eb': 3, 'E': 4,
    'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'Ab': 8, 'A': 9, 'Bb': 10, 'B': 11,
  };

  // ── 포 노트 보이싱 전용 상수 ────────────────────────────────────────────
  // 7th 코드 인터벌: R, 3(또는 ♭3), 5(또는 ♭5/°7), 7(또는 ♭7)
  const FOUR_NOTE_TYPES = {
    'maj7':  [0, 4, 7, 11],   // R · 3 · 5 · 7
    'dom7':  [0, 4, 7, 10],   // R · 3 · 5 · ♭7
    'm7':    [0, 3, 7, 10],   // R · ♭3 · 5 · ♭7
    'm7b5':  [0, 3, 6, 10],   // R · ♭3 · ♭5 · ♭7   (하프 디미니시)
    'dim7':  [0, 3, 6,  9],   // R · ♭3 · ♭5 · °7   (풀 디미니시)
  };

  // 6번선 기준 각 줄의 절대 반음 오프셋 (MIDI: 40,45,50,55,59,64)
  const FN_STR_OFFSETS = [0, 5, 10, 15, 19, 24];

  const FN_INTERVAL_LABELS = {
    0:'R', 3:'♭3', 4:'3', 6:'♭5', 7:'5', 9:'°7', 10:'♭7', 11:'7', 12:'R'
  };

  const FN_ROLE_COLORS = {
    0:  { fill:'#f5a623', stroke:'#d4891a', textFill:'#fff' },        // R
    12: { fill:'#f5a623', stroke:'#d4891a', textFill:'#fff' },        // R(oct)
    4:  { fill:'#10b981', stroke:'#047857', textFill:'#fff' },        // 3  (녹색)
    3:  { fill:'#10b981', stroke:'#047857', textFill:'#fff' },        // ♭3 (녹색)
    7:  { fill:'#38bdf8', stroke:'#0369a1', textFill:'#fff' },        // 5  (파랑)
    6:  { fill:'#38bdf8', stroke:'#0369a1', textFill:'#fff' },        // ♭5 (파랑)
    11: { fill:'#8b5cf6', stroke:'#6d28d9', textFill:'#fff' },        // 7  (보라)
    10: { fill:'#8b5cf6', stroke:'#6d28d9', textFill:'#fff' },        // ♭7 (보라)
    9:  { fill:'#8b5cf6', stroke:'#6d28d9', textFill:'#fff' },        // °7 (보라)
  };

  const FN_STR_NAMES = ['6번선', '5번선', '4번선', '3번선'];

  // 루트 선별 보이싱 "공식" (학습자가 암기해야 할 핵심 규칙)
  const FN_VOICING_RULES = {
    0: {  // 6번선 루트
      title: '6번선 Root 보이싱',
      layout: '4번선 7th · 3번선 3rd · 2번선 5th',
      mute:   '5번선 생략',
    },
    1: {  // 5번선 루트
      title: '5번선 Root 보이싱',
      layout: '4번선 5th · 3번선 7th · 2번선 3rd',
      mute:   '6번선 생략',
    },
    2: {  // 4번선 루트
      title: '4번선 Root 보이싱',
      layout: '3번선 5th · 2번선 7th · 1번선 3rd',
      mute:   '5·6번선 생략',
    },
    3: {  // 3번선 루트
      title: '3번선 Root 보이싱',
      layout: '4번선 5th · 2번선 3rd · 1번선 7th',
      mute:   '5·6번선 생략',
    },
  };

  const FN_CHORD_FORMULA = {
    'maj7':  'R · 3 · 5 · 7',
    'dom7':  'R · 3 · 5 · ♭7',
    'm7':    'R · ♭3 · 5 · ♭7',
    'm7b5':  'R · ♭3 · ♭5 · ♭7',
    'dim7':  'R · ♭3 · ♭5 · °7',
  };

  const FN_CHORD_DISPLAY_NAME = {
    'maj7':  'maj7',
    'dom7':  '7',
    'm7':    'm7',
    'm7b5':  'm7♭5',
    'dim7':  'dim7',
  };

  // ══════════════════════════════════════════════════════════════════════
  // ① 트라이어드 — 순수 3화음(major/minor/dim/aug)의 전위 학습
  //    폼은 C 기준 절대 프렛, dotsForKey()로 Key에 맞게 시프트
  //    s: v9 기준 (0=1e, 5=6E)
  // ══════════════════════════════════════════════════════════════════════

  // v9 String Set 그룹 매핑: '123'→strings=[2,1,0], '234'→[3,2,1], ...
  // v9에서 strings는 [고음줄idx, ..., 저음줄idx] (0=1e, 5=6E)
  const _V9_STR_SETS = {
    '123': 0, // String Set 1
    '234': 1, // String Set 2
    '345': 2, // String Set 3
    '456': 3, // String Set 4
  };

  // 3화음 TRIAD_VOICINGS (C 기준 절대 프렛)
  // 7th 코드는 여기서 제거되었으며, 포 노트 보이싱 섹션에서 알고리즘으로 계산함
  const TRIAD_VOICINGS = {
    major: {
      sets: [
        {
          strings: [2, 1, 0], vc: [
            { name: 'Root', dots: [{ s: 2, f: 5, r: 'R' }, { s: 1, f: 5, r: '3' }, { s: 0, f: 3, r: '5' }] },
            { name: '1st Inv', dots: [{ s: 2, f: 9, r: '3' }, { s: 1, f: 8, r: '5' }, { s: 0, f: 8, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 2, f: 0, r: '5' }, { s: 1, f: 1, r: 'R' }, { s: 0, f: 0, r: '3' }] },
          ]
        },
        {
          strings: [3, 2, 1], vc: [
            { name: 'Root', dots: [{ s: 3, f: 10, r: 'R' }, { s: 2, f: 9, r: '3' }, { s: 1, f: 8, r: '5' }] },
            { name: '1st Inv', dots: [{ s: 3, f: 2, r: '3' }, { s: 2, f: 0, r: '5' }, { s: 1, f: 1, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 3, f: 5, r: '5' }, { s: 2, f: 5, r: 'R' }, { s: 1, f: 5, r: '3' }] },
          ]
        },
        {
          strings: [4, 3, 2], vc: [
            { name: 'Root', dots: [{ s: 4, f: 3, r: 'R' }, { s: 3, f: 2, r: '5' }, { s: 2, f: 0, r: '3' }] },
            { name: '1st Inv', dots: [{ s: 4, f: 7, r: '3' }, { s: 3, f: 5, r: '5' }, { s: 2, f: 5, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 4, f: 10, r: '5' }, { s: 3, f: 10, r: 'R' }, { s: 2, f: 9, r: '3' }] },
          ]
        },
        {
          strings: [5, 4, 3], vc: [
            { name: 'Root', dots: [{ s: 5, f: 8, r: 'R' }, { s: 4, f: 7, r: '5' }, { s: 3, f: 5, r: '3' }] },
            { name: '1st Inv', dots: [{ s: 5, f: 12, r: '3' }, { s: 4, f: 10, r: '5' }, { s: 3, f: 10, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 5, f: 3, r: '5' }, { s: 4, f: 3, r: 'R' }, { s: 3, f: 2, r: '3' }] },
          ]
        },
      ]
    },
    minor: {
      sets: [
        {
          strings: [2, 1, 0], vc: [
            { name: 'Root', dots: [{ s: 2, f: 5, r: 'R' }, { s: 1, f: 4, r: 'b3' }, { s: 0, f: 3, r: '5' }] },
            { name: '1st Inv', dots: [{ s: 2, f: 8, r: 'b3' }, { s: 1, f: 8, r: '5' }, { s: 0, f: 8, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 2, f: 12, r: '5' }, { s: 1, f: 13, r: 'R' }, { s: 0, f: 11, r: 'b3' }] },
          ]
        },
        {
          strings: [3, 2, 1], vc: [
            { name: 'Root', dots: [{ s: 3, f: 10, r: 'R' }, { s: 2, f: 8, r: 'b3' }, { s: 1, f: 8, r: '5' }] },
            { name: '1st Inv', dots: [{ s: 3, f: 1, r: 'b3' }, { s: 2, f: 0, r: '5' }, { s: 1, f: 1, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 3, f: 5, r: '5' }, { s: 2, f: 5, r: 'R' }, { s: 1, f: 4, r: 'b3' }] },
          ]
        },
        {
          strings: [4, 3, 2], vc: [
            { name: 'Root', dots: [{ s: 4, f: 3, r: 'R' }, { s: 3, f: 1, r: '5' }, { s: 2, f: 0, r: 'b3' }] },
            { name: '1st Inv', dots: [{ s: 4, f: 6, r: 'b3' }, { s: 3, f: 5, r: '5' }, { s: 2, f: 5, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 4, f: 10, r: '5' }, { s: 3, f: 10, r: 'R' }, { s: 2, f: 8, r: 'b3' }] },
          ]
        },
        {
          strings: [5, 4, 3], vc: [
            { name: 'Root', dots: [{ s: 5, f: 8, r: 'R' }, { s: 4, f: 6, r: '5' }, { s: 3, f: 5, r: 'b3' }] },
            { name: '1st Inv', dots: [{ s: 5, f: 11, r: 'b3' }, { s: 4, f: 10, r: '5' }, { s: 3, f: 10, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 5, f: 3, r: '5' }, { s: 4, f: 3, r: 'R' }, { s: 3, f: 1, r: 'b3' }] },
          ]
        },
      ]
    },
    dim: {
      sets: [
        {
          strings: [2, 1, 0], vc: [
            { name: 'Root', dots: [{ s: 2, f: 5, r: 'R' }, { s: 1, f: 4, r: 'b3' }, { s: 0, f: 2, r: 'b5' }] },
            { name: '1st Inv', dots: [{ s: 2, f: 8, r: 'b3' }, { s: 1, f: 7, r: 'b5' }, { s: 0, f: 8, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 2, f: 11, r: 'b5' }, { s: 1, f: 13, r: 'R' }, { s: 0, f: 11, r: 'b3' }] },
          ]
        },
        {
          strings: [3, 2, 1], vc: [
            { name: 'Root', dots: [{ s: 3, f: 10, r: 'R' }, { s: 2, f: 8, r: 'b3' }, { s: 1, f: 7, r: 'b5' }] },
            { name: '1st Inv', dots: [{ s: 3, f: 13, r: 'b3' }, { s: 2, f: 11, r: 'b5' }, { s: 1, f: 13, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 3, f: 4, r: 'b5' }, { s: 2, f: 5, r: 'R' }, { s: 1, f: 4, r: 'b3' }] },
          ]
        },
        {
          strings: [4, 3, 2], vc: [
            { name: 'Root', dots: [{ s: 4, f: 15, r: 'R' }, { s: 3, f: 13, r: 'b3' }, { s: 2, f: 11, r: 'b5' }] },
            { name: '1st Inv', dots: [{ s: 4, f: 6, r: 'b3' }, { s: 3, f: 4, r: 'b5' }, { s: 2, f: 5, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 4, f: 9, r: 'b5' }, { s: 3, f: 10, r: 'R' }, { s: 2, f: 8, r: 'b3' }] },
          ]
        },
        {
          strings: [5, 4, 3], vc: [
            { name: 'Root', dots: [{ s: 5, f: 8, r: 'R' }, { s: 4, f: 6, r: 'b3' }, { s: 3, f: 4, r: 'b5' }] },
            { name: '1st Inv', dots: [{ s: 5, f: 11, r: 'b3' }, { s: 4, f: 9, r: 'b5' }, { s: 3, f: 10, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 5, f: 2, r: 'b5' }, { s: 4, f: 3, r: 'R' }, { s: 3, f: 1, r: 'b3' }] },
          ]
        },
      ]
    },
    aug: {
      sets: [
        {
          strings: [2, 1, 0], vc: [
            { name: 'Root', dots: [{ s: 2, f: 5, r: 'R' }, { s: 1, f: 5, r: '3' }, { s: 0, f: 4, r: '#5' }] },
            { name: '1st Inv', dots: [{ s: 2, f: 9, r: '3' }, { s: 1, f: 9, r: '#5' }, { s: 0, f: 8, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 2, f: 1, r: '#5' }, { s: 1, f: 1, r: 'R' }, { s: 0, f: 0, r: '3' }] },
          ]
        },
        {
          strings: [3, 2, 1], vc: [
            { name: 'Root', dots: [{ s: 3, f: 10, r: 'R' }, { s: 2, f: 9, r: '3' }, { s: 1, f: 9, r: '#5' }] },
            { name: '1st Inv', dots: [{ s: 3, f: 2, r: '3' }, { s: 2, f: 1, r: '#5' }, { s: 1, f: 1, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 3, f: 6, r: '#5' }, { s: 2, f: 5, r: 'R' }, { s: 1, f: 5, r: '3' }] },
          ]
        },
        {
          strings: [4, 3, 2], vc: [
            { name: 'Root', dots: [{ s: 4, f: 3, r: 'R' }, { s: 3, f: 2, r: '3' }, { s: 2, f: 1, r: '#5' }] },
            { name: '1st Inv', dots: [{ s: 4, f: 7, r: '3' }, { s: 3, f: 6, r: '#5' }, { s: 2, f: 5, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 4, f: 11, r: '#5' }, { s: 3, f: 10, r: 'R' }, { s: 2, f: 9, r: '3' }] },
          ]
        },
        {
          strings: [5, 4, 3], vc: [
            { name: 'Root', dots: [{ s: 5, f: 8, r: 'R' }, { s: 4, f: 7, r: '3' }, { s: 3, f: 6, r: '#5' }] },
            { name: '1st Inv', dots: [{ s: 5, f: 12, r: '3' }, { s: 4, f: 11, r: '#5' }, { s: 3, f: 10, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 5, f: 4, r: '#5' }, { s: 4, f: 3, r: 'R' }, { s: 3, f: 2, r: '3' }] },
          ]
        },
      ]
    },
  };

  /**
   * v9 dotsForKey(): C 기준 폼을 semOff만큼 시프트
   * 17프렛 제한(0~17) 내에서 옥타브 조정
   */
  function _dotsForKey(vc_arr, semOff) {
    return vc_arr.map(v => {
      let dots = v.dots.map(d => ({ ...d, f: d.f + semOff }));
      // 최고 프렛이 17 초과 → 12 내리기
      while (Math.max(...dots.map(d => d.f)) > 17)
        dots = dots.map(d => ({ ...d, f: d.f - 12 }));
      // 최저 프렛 음수 → 12 올리기
      while (Math.min(...dots.map(d => d.f)) < 0)
        dots = dots.map(d => ({ ...d, f: d.f + 12 }));
      return { ...v, dots };
    });
  }

  // 역할 → RiffForge SVG 색상 (트라이어드용)
  const _ROLE_COLORS = {
    'R':  { fill: '#f5a623', stroke: '#e09310', textFill: '#fff' },
    '3':  { fill: '#10b981', stroke: '#047857', textFill: '#fff' },
    'b3': { fill: '#10b981', stroke: '#047857', textFill: '#fff' },
    '5':  { fill: '#38bdf8', stroke: '#0ea5e9', textFill: '#fff' },
    'b5': { fill: '#38bdf8', stroke: '#0ea5e9', textFill: '#fff' },
    '#5': { fill: '#38bdf8', stroke: '#0ea5e9', textFill: '#fff' },
  };

  /**
   * 트라이어드 렌더링 — 3화음 전용 (7th 분기 제거)
   * - v9 인덱스(s=0→1번줄) → RiffForge sIdx(0→6번줄) 변환: rfSIdx = 5 - v9s
   * - voicing: 'all'이면 3개 지판 모두 표시 (Root / 1st / 2nd)
   */
  function renderTriadDiagram() {
    const semOff = KEY_SEMITONES[_triadRoot] || 0;
    const tv = TRIAD_VOICINGS[_triadType];
    if (!tv) return;

    const ssIdx = _V9_STR_SETS[_triadStrGroup] ?? 0;
    const strSet = tv.sets[ssIdx];
    if (!strSet) return;

    const shifted = _dotsForKey(strSet.vc, semOff); // [{name, dots}] 이미 key 적용됨
    const strLabel = _triadStrGroup.split('').join('-');
    // RiffForge: activeStrings Set (sIdx 기준, 0=6번줄)
    // v9 strings = [2,1,0] → rfSIdx = [3,4,5]
    const activeStrings = new Set(strSet.strings.map(v9s => 5 - v9s));

    // 전위명 매핑 (3rd Inv 제거)
    const invLabels = {
      root:  `Root Position · ${strLabel}번줄`,
      '1st': `1st Inversion · ${strLabel}번줄`,
      '2nd': `2nd Inversion · ${strLabel}번줄`,
    };

    const voicings = [
      { key: 'root', shiftedVc: shifted.find(v => v.name === 'Root') },
      { key: '1st',  shiftedVc: shifted.find(v => v.name === '1st Inv') },
      { key: '2nd',  shiftedVc: shifted.find(v => v.name === '2nd Inv') },
    ];


    voicings.forEach(({ key, shiftedVc }) => {
      const containerId = `triad-fb-${key === 'root' ? 'root' : key}`;
      const wrapId = `triad-fb-${key === 'root' ? 'root' : key}-wrap`;
      const show = _triadVoicing === 'all' || _triadVoicing === key;
      const wrap = document.getElementById(wrapId);
      if (wrap) wrap.style.display = show ? '' : 'none';
      if (!show || !shiftedVc) return;

      // 라벨 업데이트
      const lbl = key === 'root'
        ? document.getElementById('triad-fb-root-label')
        : wrap?.querySelector('.inv-title');
      if (lbl) lbl.textContent = invLabels[key];

      // 활성 도트 좌표 Set (rf sIdx 기준) → "rfSIdx-fret"
      const activeSet = new Set(
        shiftedVc.dots.map(d => `${5 - d.s}-${d.f}`)
      );

      // chordNoteMap: 구성음 노트이름 → role 문자열
      // (모든 프렛에서 구성음이면 표시 가능)
      const chordNoteMap = new Map();
      shiftedVc.dots.forEach(d => {
        const note = CONFIG.NOTES[(V9_OPEN[d.s] + d.f) % 12]; // v9 인덱스로 음이름 계산
        chordNoteMap.set(note, d.r);
      });

      const noteColorFn = (fret, sIdx, note, role) => {
        const k = `${sIdx}-${fret}`;
        if (!activeSet.has(k)) {
          return { fill: '#d1d5db', stroke: '#9ca3af', textFill: '#9ca3af', dotR: 8, label: note, opacity: 0.12 };
        }
        // 해당 도트의 role 직접 확인
        const dot = shiftedVc.dots.find(d => (5 - d.s) === sIdx && d.f === fret);
        const r = dot?.r || role || 'R';
        const c = _ROLE_COLORS[r] || _ROLE_COLORS['R'];
        return {
          fill: c.fill, stroke: c.stroke, textFill: c.textFill,
          dotR: r === 'R' ? 11 : 9, label: _triadLabelMode === 'note' ? note : r, opacity: 1

        };
      };

      Fretboard.render(containerId, {
        rootNote: _triadRoot,
        startFret: 0, endFret: 17,
        chordNoteMap, activeStrings, noteColorFn,
        labelMode: 'note',
      });

      // 소제목 보장 (1st, 2nd wrap)
      if (key !== 'root') {
        const container = document.getElementById(containerId);
        if (container) {
          let titleEl = container.previousElementSibling;
          if (!titleEl || !titleEl.classList.contains('inv-title')) {
            titleEl = document.createElement('p');
            titleEl.className = 'inv-title text-xs font-bold mb-1 text-center text-gray-500';
            container.parentElement.insertBefore(titleEl, container);
          }
          titleEl.textContent = invLabels[key];
        }
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════
  // ② 포 노트 보이싱 — 7th 코드(maj7/dom7/m7/m7b5/dim7) 전담
  //    루트 선(6/5/4/3번선)에 따라 R-3-5-7 인터벌을 알고리즘으로 배치
  //    학습 포인트: "구성음이 Root로부터 어떤 인터벌 관계에 있는지 인지"
  // ══════════════════════════════════════════════════════════════════════

  function _calcFourNoteVoicing(rootNote, rootStrIdx, chordType) {
    const rootSemi  = KEY_SEMITONES[rootNote] || 0;
    const r         = rootStrIdx;
    const intervals = FOUR_NOTE_TYPES[chordType] || FOUR_NOTE_TYPES['maj7'];
    const rootFret0 = (rootSemi - CONFIG.STANDARD_TUNING[r] + 12) % 12;

    // r=3(3번선) 루트: 4번선을 아래에 추가
    // 4번선 = intervals[3], 나머지는 순서대로
    let strings, ivs;
    if (r <= 2) {
      strings = [r, r+1, r+2, r+3];
      ivs     = intervals;
    } else {
      strings = [2, 3, 4, 5];
      ivs     = [intervals[3], intervals[0], intervals[1], intervals[2]];
    }

    function computeDots(rootFret) {
      return strings.map((s, i) => {
        let fret = rootFret + ivs[i] + FN_STR_OFFSETS[r] - FN_STR_OFFSETS[s];
        while (fret < 0)  fret += 12;
        while (fret > 17) fret -= 12;
        return { s, fret, interval: ivs[i] };
      });
    }

    const d0   = computeDots(rootFret0);
    const span = ds => Math.max(...ds.map(d => d.fret)) - Math.min(...ds.map(d => d.fret));
    const s0   = span(d0);

    let dots;
    if (s0 <= 4 || rootFret0 + 12 > 17) {
      dots = d0;
    } else {
      const d12 = computeDots(rootFret0 + 12);
      dots = span(d12) < s0 ? d12 : d0;
    }

    const frets     = dots.map(d => d.fret);
    const minFret   = Math.min(...frets);
    const maxFret   = Math.max(...frets);
    const startFret = Math.max(0, minFret - 1);
    const endFret   = Math.max(maxFret + 1, startFret + 4);

    // 사용 중인 string set과 생략된 string set 분리
    const usedStrings = new Set(dots.map(d => d.s));
    const mutedStrings = [];
    for (let s = 0; s < 6; s++) {
      if (!usedStrings.has(s)) mutedStrings.push(s);
    }

    return { dots, startFret, endFret, mutedStrings };
  }

  /**
   * 인터벌 역할 범례 HTML 생성 (학습 보조)
   * R / 3 · ♭3 / 5 · ♭5 / 7 · ♭7 · °7 의 색상 가이드
   */
  function _renderFourNoteLegend() {
    const legendEl = document.getElementById('fournote-legend');
    if (!legendEl) return;

    // 현재 코드 타입에서 실제로 사용되는 인터벌만 표시
    const currentIntervals = FOUR_NOTE_TYPES[_fourNoteType] || FOUR_NOTE_TYPES['maj7'];
    const roleGroups = [
      { label: 'Root',   intervals: [0],      desc: '근음' },
      { label: '3rd',    intervals: [3, 4],   desc: '3음 (장/단 3도)' },
      { label: '5th',    intervals: [6, 7],   desc: '5음 (완전/감 5도)' },
      { label: '7th',    intervals: [9, 10, 11], desc: '7음 (장/단/감 7도)' },
    ];

    const html = roleGroups.map(group => {
      // 이 그룹의 인터벌 중 현재 코드에 포함된 것만 라벨로 표시
      const activeIvs = group.intervals.filter(iv => currentIntervals.includes(iv));
      if (activeIvs.length === 0) return '';
      const iv = activeIvs[0];
      const color = FN_ROLE_COLORS[iv];
      const activeLabels = activeIvs.map(i => FN_INTERVAL_LABELS[i]).join(' / ');
      return `
        <div class="flex items-center gap-2 text-xs">
          <span class="inline-block w-4 h-4 rounded-full border-2"
                style="background:${color.fill};border-color:${color.stroke};"></span>
          <span class="font-bold text-gray-700">${activeLabels}</span>
          <span class="text-gray-500">${group.desc}</span>
        </div>`;
    }).filter(Boolean).join('');

    legendEl.innerHTML = html;
  }

  /**
   * 루트 선별 보이싱 공식 안내 렌더 (학습 보조)
   * 사용자가 현재 선택한 루트 선에 해당하는 "공식"을 텍스트로 보여줌
   */
  function _renderFourNoteRuleHint() {
    const hintEl = document.getElementById('fournote-rule-hint');
    if (!hintEl) return;
    const rule = FN_VOICING_RULES[_fourNoteRootStr];
    if (!rule) { hintEl.innerHTML = ''; return; }
    hintEl.innerHTML = `
      <div class="bg-amber-50 border border-amber-200 rounded-md px-3 py-2 text-xs">
        <div class="font-bold text-amber-800 mb-0.5">${rule.title}</div>
        <div class="text-gray-700">
          <span class="font-semibold">배치:</span> ${rule.layout}
        </div>
        <div class="text-gray-500">
          <span class="font-semibold">생략:</span> ${rule.mute}
        </div>
      </div>`;
  }

  function renderFourNote() {
    const { dots, startFret, endFret, mutedStrings } = _calcFourNoteVoicing(
      _fourNoteRoot, _fourNoteRootStr, _fourNoteType
    );

    const activeSet = new Set(dots.map(d => `${d.s}-${d.fret}`));
    const dotMap    = new Map(dots.map(d => [`${d.s}-${d.fret}`, d]));
    const usedStrings = new Set(dots.map(d => d.s));

    const chordNoteMap = new Map();
    dots.forEach(d => {
      const note = CONFIG.NOTES[(CONFIG.STANDARD_TUNING[d.s] + d.fret) % 12];
      if (!chordNoteMap.has(note))
        chordNoteMap.set(note, FN_INTERVAL_LABELS[d.interval] || 'R');
    });

    const noteColorFn = (fret, sIdx, note, _role) => {
      const k = `${sIdx}-${fret}`;
      if (activeSet.has(k)) {
        const dot = dotMap.get(k);
        const I   = dot?.interval ?? 0;
        const c   = FN_ROLE_COLORS[I] || FN_ROLE_COLORS[0];
        return {
          fill: c.fill, stroke: c.stroke, textFill: c.textFill,
          dotR:  (I === 0 || I === 12) ? 11 : 9,
          label: FN_INTERVAL_LABELS[I] ?? note,
          opacity: 1,
        };
      }
      // 사용 중 선에서 구성음이 아닌 프렛: 매우 연하게
      if (usedStrings.has(sIdx)) {
        return { fill:'#e5e7eb', stroke:'#d1d5db', textFill:'#9ca3af', dotR:7, label:'', opacity:0.18 };
      }
      // 생략된 선: 거의 숨김
      return { fill:'#e5e7eb', stroke:'#d1d5db', textFill:'#9ca3af', dotR:6, label:'', opacity:0.08 };
    };

    // activeStrings 전달 (생략된 선은 표시 최소화)
    const activeStrings = new Set(usedStrings);

    Fretboard.render('fournote-fb', {
      rootNote: _fourNoteRoot,
      chordNoteMap, noteColorFn,
      startFret, endFret,
      activeStrings,
    });

    // 메인 라벨: 코드 이름 + 루트 선 + 공식 + 프렛 범위
    const labelEl = document.getElementById('fournote-fb-label');
    if (labelEl) {
      const displayName = FN_CHORD_DISPLAY_NAME[_fourNoteType] || _fourNoteType;
      labelEl.textContent =
        `${_fourNoteRoot}${displayName} · ` +
        `${FN_STR_NAMES[_fourNoteRootStr]} Root · ` +
        `${FN_CHORD_FORMULA[_fourNoteType]} (${startFret}–${endFret}fr)`;
    }

    // 생략된 선 정보 표시 (뮤트 표시)
    const muteEl = document.getElementById('fournote-mute-info');
    if (muteEl) {
      const rfMuted = mutedStrings
        .map(s => 6 - s)  // v9 s=0(6번선) → UI "6번선"으로, s=5(1번선) → "1번선"
        .sort((a, b) => b - a)
        .map(n => `${n}번선`);
      if (rfMuted.length > 0) {
        muteEl.innerHTML = `<span class="text-gray-500 text-xs">✕ 뮤트: ${rfMuted.join(', ')}</span>`;
      } else {
        muteEl.innerHTML = '';
      }
    }

    // 학습 보조: 범례 + 규칙 힌트
    _renderFourNoteLegend();
    _renderFourNoteRuleHint();
  }

  function setFourNoteRoot(note) {
    _fourNoteRoot = note;
    renderFourNote();
  }

  function setFourNoteRootStr(idx) {
    _fourNoteRootStr = +idx;
    document.querySelectorAll('.fn-str-btn').forEach(btn => {
      const on = +btn.dataset.fnstr === _fourNoteRootStr;
      btn.classList.toggle('bg-amber-500',      on);
      btn.classList.toggle('text-white',        on);
      btn.classList.toggle('border-transparent', on);
      btn.classList.toggle('bg-white',          !on);
      btn.classList.toggle('text-gray-600',     !on);
      btn.classList.toggle('border-gray-200',   !on);
    });
    renderFourNote();
  }

  function setFourNoteType(type) {
    // 유효한 7th 코드 타입인지 검증
    if (!FOUR_NOTE_TYPES[type]) {
      console.warn(`[FourNote] Unknown chord type: ${type}, fallback to maj7`);
      type = 'maj7';
    }
    _fourNoteType = type;
    document.querySelectorAll('.fn-type-btn').forEach(btn => {
      const on = btn.dataset.fntype === type;
      btn.classList.toggle('bg-amber-500',      on);
      btn.classList.toggle('text-white',        on);
      btn.classList.toggle('border-transparent', on);
      btn.classList.toggle('bg-white',          !on);
      btn.classList.toggle('text-gray-600',     !on);
      btn.classList.toggle('border-gray-200',   !on);
    });
    renderFourNote();
  }
