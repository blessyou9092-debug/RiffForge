/**
 * RiffForge - config.js
 * 전역 설정값, 상수, 정적 데이터
 */

const CONFIG = {
  JSONBIN: {
    BIN_ID: '69d363ad36566621a8828ced',
    API_KEY: '$2a$10$h43RM.SBRauoI8IaSGjh.e6gI6ZBGM1az9zAYSmbebpukTB60AsfK',
    URL: 'https://api.jsonbin.io/v3/b/',
  },
  // ─── LocalStorage 키 ───────────────────────────────────────────────
  KEYS: {
    XP: 'rf_xp',
    WATER: 'rf_water',
    STREAK: 'rf_streak',
    LAST_PRACTICE_DATE: 'rf_last_practice_date',
    PRACTICE_LOG: 'rf_practice_log_',
    HARVEST: 'rf_harvest',
    SETTINGS: 'rf_settings',
    WEEKLY_XP: 'rf_weekly_xp',
    WEEKLY_MIN: 'rf_weekly_min',
    TOTAL_MIN: 'rf_total_min',
    USERNAME: 'rf_username',
    THEME: 'rf_theme',
    AVATAR: 'rf_avatar',
    USER_ID: 'rf_user_id',
    BOARD_POSTS: 'rf_board_posts',
  },

  XP: {
    PRACTICE_LONG: 40,
    PRACTICE_SHORT: 10,
    POMO_COMPLETE: 15,
  },

  // ─── 기타 나무 단계 ──────────────────────────────────────────────
  TREE_STAGES: [
    { min: 0, max: 2, emoji: '🌱', name: '씨앗', desc: '이제 막 시작했어요!' },
    { min: 3, max: 7, emoji: '🌿', name: '새싹', desc: '조금씩 자라고 있어요!' },
    { min: 8, max: 15, emoji: '🌾', name: '어린 나무', desc: '잎이 나기 시작했어요!' },
    { min: 16, max: 29, emoji: '🌳', name: '튼튼한 나무', desc: '매일 연습의 결과예요!' },
    { min: 30, max: 49, emoji: '🎋', name: '성목', desc: '훌륭한 나무가 됐어요!' },
    { min: 50, max: 99, emoji: '🌲', name: '베테랑 나무', desc: '숙련자의 경지입니다!' },
    { min: 100, max: Infinity, emoji: '🎄', name: '기타 마스터 나무', desc: '전설의 기타리스트!' },
  ],

  HARVEST_ITEMS: [
    { id: 'h1', water: 5, emoji: '🍎', name: '첫 사과', desc: '5번 물주기 달성!' },
    { id: 'h2', water: 10, emoji: '🍊', name: '오렌지', desc: '10번 물주기 달성!' },
    { id: 'h3', water: 20, emoji: '🍋', name: '레몬', desc: '20번 물주기 달성!' },
    { id: 'h4', water: 30, emoji: '🍇', name: '포도', desc: '30번 물주기 달성!' },
    { id: 'h5', water: 50, emoji: '🍓', name: '딸기', desc: '50번 물주기 달성!' },
    { id: 'h6', water: 75, emoji: '🥭', name: '망고', desc: '75번 물주기 달성!' },
    { id: 'h7', water: 100, emoji: '🏆', name: '황금 트로피', desc: '100번 물주기 달성!' },
  ],

  // ─── 포모도로 ─────────────────────────────────────────────────────
  POMO: {
    FOCUS_MIN: 25, BREAK_MIN: 5, LONG_BREAK_MIN: 15, SESSIONS_UNTIL_LONG: 4,
  },

  // ─── 메트로놈 기본값 ──────────────────────────────────────────────
  METRONOME: {
    MIN_BPM: 40, MAX_BPM: 240, DEFAULT_BPM: 80,
    TIME_SIGS: [
      { label: '4/4', beats: 4, division: 4 },
      { label: '3/4', beats: 3, division: 4 },
      { label: '6/8', beats: 6, division: 8 },
      { label: '2/4', beats: 2, division: 4 },
      { label: '5/4', beats: 5, division: 4 },
      { label: '7/8', beats: 7, division: 8 },
    ],
  },

  // ─── 메트로놈 세분화 (subdivision) ──────────────────────────────
  SUBDIVISIONS: [
    { id: 'quarter', label: '♩ 4분', perBeat: 1 },
    { id: 'eighth', label: '♪ 8분', perBeat: 2 },
    { id: 'sixteenth', label: '♬ 16분', perBeat: 4 },
    { id: 'triplet', label: '3연음', perBeat: 3 },
  ],

  // ─── 메트로놈 사운드 종류 ────────────────────────────────────────
  METRONOME_SOUNDS: [
    { id: 'click', label: '클릭', desc: '선명한 클릭' },
    { id: 'wood', label: '우드블록', desc: '따뜻한 목질음' },
    { id: 'beep', label: '삐', desc: '전자 비프음' },
    { id: 'cowbell', label: '카우벨', desc: '카우벨 사운드' },
  ],

  // ─── 코드 타입 ────────────────────────────────────────────────────
  CHORD_TYPES: [
    { id: 'major', label: 'M', suffix: '', intervals: [0, 4, 7] },
    { id: 'minor', label: 'm', suffix: 'm', intervals: [0, 3, 7] },
    { id: 'dim', label: 'dim', suffix: 'dim', intervals: [0, 3, 6] },
    { id: 'aug', label: 'aug', suffix: 'aug', intervals: [0, 4, 8] },
    { id: 'maj7', label: 'M7', suffix: 'maj7', intervals: [0, 4, 7, 11] },
    { id: '7', label: '7', suffix: '7', intervals: [0, 4, 7, 10] },
    { id: 'm7', label: 'm7', suffix: 'm7', intervals: [0, 3, 7, 10] },
    { id: 'm7b5', label: 'm7♭5', suffix: 'm7♭5', intervals: [0, 3, 6, 10] },
    { id: 'add9', label: 'add9', suffix: 'add9', intervals: [0, 4, 7, 14] },
    { id: 'M9', label: 'M9', suffix: 'maj9', intervals: [0, 4, 7, 11, 14] },
    { id: 'm9', label: 'm9', suffix: 'm9', intervals: [0, 3, 7, 10, 14] },
    { id: 'dom9', label: '9', suffix: '9', intervals: [0, 4, 7, 10, 14] },
        { id: 'dom9', label: '9', suffix: '9', intervals: [0, 4, 7, 10, 14] },
    { id: 'sus4', label: 'sus4', suffix: 'sus4', intervals: [0, 5, 7] }
  ],

  // ─── 화성 악기 ────────────────────────────────────────────────────
  HARMONY_INSTRUMENTS: [
    { id: 'piano', label: '🎹 로타리 피아노' },
    { id: 'guitar', label: '🎸 통기타' },
    { id: 'synth', label: '🎛 신스 패드' },
  ],

  // ─── 연습 세션 템플릿 ─────────────────────────────────────────────
  SESSION_TEMPLATES: {
    warmup: {
      label: '워밍업', icon: '🔥', colorClass: 'amber',
      items: [
        { name: '크로매틱', detail: '1-2-3-4 순서 변형 패턴 반복', defaultMin: 5 },
        { name: '거미줄(Spider)', detail: '4핑거 크로스 스트링 패턴', defaultMin: 5 },
        { name: '트릴 연습', detail: '검지-중지 / 검지-약지 / 검지-소지 트릴', defaultMin: 5 },
        { name: '얼터네이트 피킹', detail: '느린 템포 다운-업 피킹 정확도 훈련', defaultMin: 5 },
        { name: '손가락 스트레칭', detail: '손목 회전, 손가락 최대 벌리기 5세트', defaultMin: 3 },
        { name: '슬라이드 웜업', detail: '전 스트링 1→12프렛 슬라이드 반복', defaultMin: 3 },
      ],
      chromatic_patterns: [
        '1-2-3-4', '1-2-4-3', '1-3-2-4', '1-3-4-2', '1-4-2-3', '1-4-3-2',
        '2-1-3-4', '2-1-4-3', '2-3-1-4', '2-3-4-1', '2-4-1-3', '2-4-3-1',
        '3-1-2-4', '3-1-4-2', '3-2-1-4', '3-2-4-1', '3-4-1-2', '3-4-2-1',
        '4-1-2-3', '4-1-3-2', '4-2-1-3', '4-2-3-1', '4-3-1-2', '4-3-2-1',
      ],
      spider_patterns: {
        easy: ['6-5 / 5-6 반복', '1프렛 → 12프렛 순차 이동', '같은 포지션 4현 왕복'],
        medium: ['6-4 / 5-3 대각선 이동', '2현씩 건너뛰며 오름차순', '엇박 시작 크로스 패턴'],
        hard: ['전 스트링 대각선 지그재그', '역방향 + 스킵 스트링 조합', '12박 연속 무정지 스파이더'],
      },
    },
    theory: {
      label: '코드/이론', icon: '🎵', colorClass: 'blue',
      items: [
        { name: '타겟 노트', detail: '코드톤(루트·3도·5도)을 솔로 시작/끝점으로 의식하며 연주', defaultMin: 10 },
        { name: '트라이어드 블록 이동', detail: 'C 트라이어드를 전 스트링 포지션에서 이동하며 연주', defaultMin: 10 },
        { name: '스케일 블록 이동', detail: '펜타토닉 5포지션을 연결하는 블록 이동 연습', defaultMin: 10 },
        { name: '오픈 코드 전환', detail: 'G-C-D-Em 클린 전환, 클릭 없이 끊김 없게', defaultMin: 10 },
        { name: '바레 코드', detail: 'F, B♭, Bm 등 바레 코드 안정화 — 파워코드와 병행', defaultMin: 10 },
        { name: '코드 진행 연습', detail: 'I-IV-V / ii-V-I 랜덤 3Key 순환', defaultMin: 10 },
        { name: '아르페지오', detail: '코드 분산화음 패턴 — 핑거스타일 & 피크 각각', defaultMin: 10 },
        { name: '모드 스케일', detail: '도리안(마이너 feel) / 믹솔리디안(블루스 feel) / 리디안', defaultMin: 15 },
      ],
    },
    practical: {
      label: '실전 연습', icon: '🎸', colorClass: 'green',
      items: [
        { name: '지정 곡 카피', detail: '오늘 카피할 곡의 어려운 구간을 느린 속도로 정확하게 반복', defaultMin: 15 },
        { name: '릭 카피', detail: '좋아하는 아티스트의 릭 1개를 귀로 카피 후 다양한 포지션 이동', defaultMin: 15 },
        { name: '쨉쨉이(리듬 훈련)', detail: '메트로놈 위에서 16분음표 리듬 패턴 스트러밍 — 몸에 리듬 각인', defaultMin: 10 },
        { name: '즉흥 솔로', detail: '백킹 트랙 위에서 스케일 의식 없이 귀로 반응하며 자유롭게', defaultMin: 10 },
        { name: '리듬 스트러밍', detail: '다양한 리듬 패턴(8분/16분/당김음) 스트러밍 훈련', defaultMin: 10 },
        { name: '슬라이드/벤딩', detail: '1음씩 정확하게 벤딩, 비브라토 컨트롤 훈련', defaultMin: 10 },
        { name: '핑거스타일', detail: 'P-I-M-A 패턴, 멜로디+베이스 동시 연주', defaultMin: 10 },
        { name: '청음 훈련', detail: '한 줄짜리 리프를 듣고 기타로 재현, 답 확인 후 반복', defaultMin: 10 },
      ],
    },
  },


// ─── 백킹 트랙 장르 ──────────────────────────────────────────────
  // progression: { r: 로마숫자, t: CHORD_TYPES.id }
  BACKING_TRACKS: [
    {
      id: 'penta_solo',
      name: 'Pentatonic Solo Jam',
      emoji: '🎸',
      colorClass: 'amber',
      desc: 'Am 펜타 전용 — 솔로 연습 최적',
      defaultKey: 'A',
      defaultBpm: 95,
      progression: [
        { r: 'I', t: 'minor' }, { r: 'IV', t: 'major' }, { r: 'bVI', t: 'major' }, { r: 'V', t: 'major' }
      ],
      progressionLabel: 'Am – D – F – E',
      recommendScales: ['Minor Pentatonic', 'Blues Scale', 'Natural Minor'],
      tip: 'A minor pentatonic 하나로 전체 곡 커버 가능. 벤딩·비브라토 중심으로 박자 맞추기 연습에 최적.',
    },
    {
      id: 'citypop',
      name: 'City Pop',
      emoji: '🌃',
      colorClass: 'teal',
      desc: '세련된 80년대 도심의 밤 — 화려한 텐션 코드',
      defaultKey: 'C',
      defaultBpm: 105,
      progression: [
        { r: 'IV', t: 'M9' }, { r: 'III', t: '7' }, { r: 'VI', t: 'm9' }, { r: 'I', t: 'dom9' }
      ],
      progressionLabel: 'Fmaj9 – E7 – Am9 – C9',
      recommendScales: ['Major Scale', 'Minor Pentatonic', 'Dorian'],
      tip: '화려한 텐션(9, 11, 13)을 포함한 쨉쨉이(커팅)와 코러스 이펙터가 필수적입니다. 특유의 세련된 그루브를 타며 연주해보세요.',
    },
    {
      id: 'blues',
      name: 'Blues Rock Shuffle',
      emoji: '🎷',
      colorClass: 'indigo',
      desc: '블루스 셔플 — 솔로잉 기본기',
      defaultKey: 'D',
      defaultBpm: 120,
      progression: [
        { r: 'I', t: 'dom9' }, { r: 'bVII', t: 'dom9' }, { r: 'IV', t: 'dom9' }, { r: 'I', t: 'dom9' }
      ],
      progressionLabel: 'D9 – C9 – G9 – D9',
      recommendScales: ['Blues Scale', 'Minor Pentatonic', 'Major Pentatonic'],
      tip: 'A minor 펜타토닉 기반 블루스 구간 연습용으로 최적. 7th 대신 9th 코드를 써서 더 끈적하게 연주해보세요.',
    },
    {
      id: 'funk',
      name: 'Funk / Soul',
      emoji: '🕺',
      colorClass: 'orange',
      desc: '클린 그루브 — 컷팅 & 16비트 훈련',
      defaultKey: 'A',
      defaultBpm: 100,
      progression: [
        { r: 'II', t: 'm9' }, { r: 'V', t: 'dom9' }, { r: 'I', t: 'M9' }, { r: 'VI', t: 'm7' }
      ],
      progressionLabel: 'Bm9 – E9 – Amaj9 – F♯m7',
      recommendScales: ['Minor Pentatonic', 'Dorian', 'Major Pentatonic'],
      tip: '오른손 컷팅(뮤트 스트로크)과 16비트 그루브를 강조하세요. 클린톤에서 제일 재미있습니다.',
    },
    {
      id: 'hardrock',
      name: 'Hard Rock / Metal',
      emoji: '🤘',
      colorClass: 'red',
      desc: '파워코드 & 팜뮤트 — 드라이브 사운드',
      defaultKey: 'E',
      defaultBpm: 160,
      progression: [
        { r: 'I', t: 'minor' }, { r: 'bVI', t: 'major' }, { r: 'bVII', t: 'major' }, { r: 'I', t: 'minor' }
      ],
      progressionLabel: 'Em – C – D – Em',
      recommendScales: ['Natural Minor', 'Minor Pentatonic', 'Blues Scale'],
      tip: '개방현(E)을 살린 파워코드·팜뮤트 리프 연습에 적합. 알터네이트 피킹 강화.',
    },
    {
      id: 'lofi',
      name: 'Lo-fi Hip-hop',
      emoji: '☁️',
      colorClass: 'slate',
      desc: '느긋한 Lo-fi 힙합 — 감성 연습',
      defaultKey: 'G',
      defaultBpm: 85,
      progression: [
        { r: 'II', t: 'm9' }, { r: 'V', t: 'dom9' }, { r: 'I', t: 'M9' }, { r: 'VI', t: 'm9' }
      ],
      progressionLabel: 'Am9 – D9 – Gmaj9 – Em9',
      recommendScales: ['Major Pentatonic', 'Major Scale', 'Lydian'],
      tip: '잔잔하게 늘어진 타이밍, 비브라토와 슬라이드로 \'힘 뺀 멜로디\'를 만들기 좋습니다. 9th 코드의 몽환적인 느낌을 살려보세요.',
    },
    {
      id: 'poppunk',
      name: 'Pop-Punk / Emo',
      emoji: '🎯',
      colorClass: 'green',
      desc: '빠르고 신나는 팝펑크 — 파워코드 훈련',
      defaultKey: 'G',
      defaultBpm: 170,
      progression: [
        { r: 'I', t: 'major' }, { r: 'V', t: 'major' }, { r: 'VI', t: 'minor' }, { r: 'IV', t: 'add9' }
      ],
      progressionLabel: 'G – D – Em – Cadd9',
      recommendScales: ['Major Pentatonic', 'Major Scale'],
      tip: '다운피킹 위주 스트럼을 빠르고 단단하게. 마지막 코드에 add9을 섞어 특유의 아련함을 더했습니다.',
    },
    {
      id: 'smoothjazz',
      name: 'Smooth Jazz Fusion',
      emoji: '🎺',
      colorClass: 'purple',
      desc: '부드러운 재즈 퓨전 — 코드톤/텐션 훈련',
      defaultKey: 'A',
      defaultBpm: 115,
      progression: [
        { r: 'II', t: 'm9' }, { r: 'V', t: 'dom9' }, { r: 'I', t: 'M9' }, { r: 'VI', t: 'm9' }
      ],
      progressionLabel: 'Bm9 – E9 – Amaj9 – F#m9',
      recommendScales: ['Major Scale', 'Dorian', 'Mixolydian'],
      tip: '2–5–1 연결을 의식하면 즉흥연주가 훨씬 자연스럽습니다. 9th 코드가 빚어내는 풍성한 화성을 느껴보세요.',
    },
    {
      id: 'dorian_fusion',
      name: 'Mode Study – Dorian',
      emoji: '🌀',
      colorClass: 'cyan',
      desc: 'D 도리안 — 잔잔한 퓨전 그루브',
      defaultKey: 'D',
      defaultBpm: 110,
      progression: [
        { r: 'I', t: 'm9' }, { r: 'II', t: 'm9' }, { r: 'I', t: 'm9' }, { r: 'IV', t: 'dom9' }
      ],
      progressionLabel: 'Dm9 – Em9 – Dm9 – G9',
      recommendScales: ['Dorian', 'Minor Pentatonic', 'Major Scale'],
      tip: '도리안 특유의 #6음을 적극 사용(예: B). 재즈·퓨전 느낌의 부드러운 라인 만들기 좋음.',
    },
    {
      id: 'chill_pop',
      name: 'Chill Ambient Pop',
      emoji: '🌙',
      colorClass: 'sky',
      desc: '촉촉한 감성 — 리버브·딜레이 최적',
      defaultKey: 'C',
      defaultBpm: 72,
      progression: [
        { r: 'I', t: 'M9' }, { r: 'VI', t: 'm9' }, { r: 'IV', t: 'M9' }, { r: 'V', t: 'major' }
      ],
      progressionLabel: 'Cmaj9 – Am9 – Fmaj9 – G',
      recommendScales: ['Major Scale', 'Major Pentatonic', 'Lydian'],
      tip: '리버브+딜레이 넉넉하게. 멜로디는 공간감을 살려서 길고 느리게.',
    },
    {
      id: 'neosoul',
      name: 'Dreamy Neo-Soul / R&B',
      emoji: '✨',
      colorClass: 'violet',
      desc: '몽환적 Neo-Soul — 코드톤 멜로디',
      defaultKey: 'C',
      defaultBpm: 80,
      progression: [
        { r: 'IV', t: 'm9' }, { r: 'bVI', t: 'M9' }, { r: 'bIII', t: 'M9' }, { r: 'I', t: 'm9' }
      ],
      progressionLabel: 'Fm9 – A♭maj9 – E♭maj9 – Cm9',
      recommendScales: ['Minor Pentatonic', 'Natural Minor', 'Dorian'],
      tip: '네오소울의 꽃은 역시 9th 텐션입니다. 코드톤 중심으로 부드럽고 녹아내리는 멜로디가 어울림.',
    },
    {
      id: 'kindie_disco',
      name: 'K-Indie Disco',
      emoji: '🎧',
      colorClass: 'emerald',
      desc: '찰랑이는 옥타브 바운스와 디스코 비트',
      defaultKey: 'G',
      defaultBpm: 125,
      progression: [
        { r: 'II', t: 'm9' }, { r: 'V', t: 'dom9' }, { r: 'I', t: 'M9' }, { r: 'IV', t: 'M9' }
      ],
      progressionLabel: 'Am9 – D9 – Gmaj9 – Cmaj9',
      recommendScales: ['Major Pentatonic', 'Dorian', 'Major Scale'],
      tip: '8비트 정박의 킥 드럼 위에 16비트 고스트 노트를 섞은 스트로크(쨉쨉이)를 얹어보세요.',
    },
    {
      id: 'funk_pop',
      name: 'Trendy Funk Pop',
      emoji: '🕶️',
      colorClass: 'amber',
      desc: '브루노 마스 스타일의 세련된 펑크 그루브',
      defaultKey: 'C',
      defaultBpm: 115,
      progression: [
        { r: 'II', t: 'm9' }, { r: 'V', t: 'dom9' }, { r: 'I', t: 'M9' }, { r: 'VI', t: '7' }
      ],
      progressionLabel: 'Dm9 – G9 – Cmaj9 – A7',
      recommendScales: ['Minor Pentatonic', 'Dorian', 'Blues Scale'],
      tip: '1마디(Dm9)와 3마디(Cmaj9)의 첫 박에 강세를 주고, 나머지는 가벼운 커팅 리듬으로 공간을 비워두는 것이 까리함의 핵심입니다.',
    },
    {
      id: 'jpop_rock',
      name: 'J-Pop Rock',
      emoji: '🌸',
      colorClass: 'pink',
      desc: '밝고 에너제틱한 J-Rock 사운드',
      defaultKey: 'C',
      defaultBpm: 150,
      progression: [
        { r: 'I', t: 'major' }, { r: 'V', t: 'major' }, { r: 'VI', t: 'minor' }, { r: 'IV', t: 'add9' }
      ],
      progressionLabel: 'C – G – Am – Fadd9',
      recommendScales: ['Major Scale', 'Major Pentatonic'],
      tip: '펜타토닉으로도 멜로디가 잘 나오며, 스트로크는 8비트·16비트 골고루 연습하기 좋습니다.',
    }
  ],

  // ─── 음악 이론 ────────────────────────────────────────────────────
  NOTES: ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'],

  SCALES: {
    'Major': [0, 2, 4, 5, 7, 9, 11],
    'Natural Minor': [0, 2, 3, 5, 7, 8, 10],
    'Minor Pentatonic': [0, 3, 5, 7, 10],
    'Major Pentatonic': [0, 2, 4, 7, 9],
    'Blues Scale': [0, 3, 5, 6, 7, 10],
    'Dorian': [0, 2, 3, 5, 7, 9, 10],
    'Mixolydian': [0, 2, 4, 5, 7, 9, 10],
    'Lydian': [0, 2, 4, 6, 7, 9, 11],
    'Phrygian': [0, 1, 3, 5, 7, 8, 10],
  },

  // 표준 튜닝 MIDI (E2=40, A2=45, D3=50, G3=55, B3=59, E4=64)
  STANDARD_TUNING: [40, 45, 50, 55, 59, 64],
  STRING_NAMES: ['E', 'A', 'D', 'G', 'B', 'e'],

  // 로마숫자 → 반음 간격 (플랫 변형 포함)
  ROMAN_INTERVALS: {
    I: 0, bII: 1, II: 2, bIII: 3, III: 4, IV: 5, bV: 6,
    V: 7, bVI: 8, VI: 9, bVII: 10, VII: 11,
  },
  // 공휴일 (MM-DD: 고정, YYYY-MM-DD: 음력 기반)
  HOLIDAYS: {
    '01-01': '신정', '03-01': '삼일절', '05-01': '근로자의날', '05-05': '어린이날',
    '06-06': '현충일', '08-15': '광복절', '10-03': '개천절',
    '10-09': '한글날', '12-25': '성탄절',
    // 설날
    '2025-01-28': '설날연휴', '2025-01-29': '설날', '2025-01-30': '설날연휴',
    '2026-02-16': '설날연휴', '2026-02-17': '설날', '2026-02-18': '설날연휴',
    '2027-02-06': '설날연휴', '2027-02-07': '설날', '2027-02-08': '설날연휴',
    '2028-01-26': '설날연휴', '2028-01-27': '설날', '2028-01-28': '설날연휴',
    '2029-02-12': '설날연휴', '2029-02-13': '설날', '2029-02-14': '설날연휴',
    '2030-02-02': '설날연휴', '2030-02-03': '설날', '2030-02-04': '설날연휴',
    // 추석
    '2025-10-05': '추석연휴', '2025-10-06': '추석', '2025-10-07': '추석연휴',
    '2026-09-24': '추석연휴', '2026-09-25': '추석', '2026-09-26': '추석연휴',
    '2027-09-14': '추석연휴', '2027-09-15': '추석', '2027-09-16': '추석연휴',
    '2028-10-02': '추석연휴', '2028-10-03': '추석', '2028-10-04': '추석연휴',
    '2029-09-21': '추석연휴', '2029-09-22': '추석', '2029-09-23': '추석연휴',
    '2030-09-11': '추석연휴', '2030-09-12': '추석', '2030-09-13': '추석연휴',
    // 부처님오신날
    '2025-05-05': '부처님오신날', '2026-05-24': '부처님오신날',
    '2027-05-13': '부처님오신날', '2028-05-02': '부처님오신날',
    '2029-05-20': '부처님오신날', '2030-05-09': '부처님오신날',
  },

  // 달력 아이콘
  CALENDAR_ICONS: [
    // 악기/연습
    '🎸', '🎵', '🎶', '🎼', '🎹', '🥁', '🎺', '🎻',
    // 표정/기분
    '😊', '😤', '🔥', '💪', '😎', '🤘', '😅', '😫',
    // 동식물/성취
    '🍀', '🌱', '🌟', '🐱', '🐰', '🏆', '💎', '✨', '🎯',
  ],

  // ── 레퍼토리 상태 4단계 ──────────────────────────────────────────
  REPERTOIRE_STATES: [
    { id: 'learning', label: 'Learning', color: 'blue' },
    { id: 'polishing', label: 'Polishing', color: 'amber' },
    { id: 'ready', label: 'Performance Ready', color: 'green' },
    { id: 'mastered', label: 'Mastered', color: 'purple' },
  ],

  // ── 가상 기타 컬렉션 (12종) ──────────────────────────────────────
  VIRTUAL_GUITARS: [
    { id: 'starter', name: '스타터 어쿠스틱', emoji: '🎸', unlockDesc: '기본 지급', unlockCond: { type: 'default' }, buff: null },
    { id: 'strat', name: 'Stratocaster', emoji: '⚡', unlockDesc: '물주기 30회', unlockCond: { type: 'water', count: 30 }, buff: { label: 'XP +10%', xpMult: 1.10 } },
    { id: 'lp', name: 'Les Paul', emoji: '🔥', unlockDesc: '물주기 80회', unlockCond: { type: 'water', count: 80 }, buff: { label: 'XP +20%', xpMult: 1.20 } },
    { id: 'tele', name: 'Telecaster', emoji: '🌟', unlockDesc: '물주기 50회', unlockCond: { type: 'water', count: 50 }, buff: { label: '연속 보너스 +5%', streakMult: 1.05 } },
    { id: 'sg', name: 'SG Standard', emoji: '😈', unlockDesc: '주간 챌린지 3회 완료', unlockCond: { type: 'challenge', count: 3 }, buff: { label: 'XP +15%', xpMult: 1.15 } },
    { id: 'es335', name: 'ES-335', emoji: '🎷', unlockDesc: '마스터 곡 5곡', unlockCond: { type: 'mastered', count: 5 }, buff: { label: '레퍼토리 XP +25%', repXpMult: 1.25 } },
    { id: 'rg', name: 'Ibanez RG', emoji: '🗡️', unlockDesc: '물주기 120회', unlockCond: { type: 'water', count: 120 }, buff: { label: 'XP +25%', xpMult: 1.25 } },
    { id: 'prs', name: 'PRS Custom 24', emoji: '🦅', unlockDesc: '30일 연속 연습', unlockCond: { type: 'streak', days: 30 }, buff: { label: 'XP +30%', xpMult: 1.30 } },
    { id: 'jazzmaster', name: 'Jazzmaster', emoji: '🌊', unlockDesc: '포모도로 100회', unlockCond: { type: 'pomo', count: 100 }, buff: { label: '포모 XP +20%', pomoXpMult: 1.20 } },
    { id: 'v', name: 'Flying V', emoji: '✌️', unlockDesc: '주간 챌린지 10회 완료', unlockCond: { type: 'challenge', count: 10 }, buff: { label: 'XP +20%', xpMult: 1.20 } },
    { id: 'bass', name: '프레시전 베이스', emoji: '🎵', unlockDesc: '마스터 곡 15곡', unlockCond: { type: 'mastered', count: 15 }, buff: { label: '전체 XP +35%', xpMult: 1.35 } },
    { id: 'acoustic12', name: '12현 어쿠스틱', emoji: '🌌', unlockDesc: '물주기 200회', unlockCond: { type: 'water', count: 200 }, buff: { label: 'XP +40%', xpMult: 1.40 } },
  ],

  // ── 주간 챌린지 템플릿 ──────────────────────────────────────────
  WEEKLY_CHALLENGES: [
    { id: 'practice_5days', title: '꾸준함의 힘', desc: '이번 주 연습 일지를 5일 이상 기록하기', icon: '📅', goal: 5, unit: '일', page: 'builder', xpReward: 150 },
    { id: 'total_120min', title: '120분의 여정', desc: '하루에 몰아서든 나눠서든, 주간 총 연습 120분 채우기', icon: '⏱', goal: 120, unit: '분', page: 'builder', xpReward: 100 },
    { id: 'water_3times', title: '나무 지킴이', desc: '30분 이상 집중 연습으로 나무에 물 3번 주기', icon: '💧', goal: 3, unit: '회', page: 'builder', xpReward: 80 },
    { id: 'theory_2days', title: '코드/이론의 지배자', desc: '코드·이론 세션을 포함해 2일 이상 연습하기', icon: '🎼', goal: 2, unit: '일', page: 'builder', xpReward: 80 },
    { id: 'warmup_3', title: '준비운동은 필수', desc: '워밍업 세션을 주 3회 이상 완료하기', icon: '🔥', goal: 3, unit: '회', page: 'builder', xpReward: 60 },
    { id: 'perfect_set', title: '완벽한 3세트', desc: '워밍업 + 이론 + 실전, 세 종류 모두 완료한 날 만들기', icon: '✨', goal: 1, unit: '일', page: 'builder', xpReward: 120 },
    { id: 'speed_builder_2', title: '보이지 않는 손', desc: '스피드 빌더를 이번 주 2회 이상 사용하기', icon: '⚡', goal: 2, unit: '회', page: 'studio', xpReward: 70 },
    { id: 'pomo_5sessions', title: '완전 몰입', desc: '포모도로 집중 세션을 5회 완료하기', icon: '🍅', goal: 5, unit: '세션', page: 'pomo', xpReward: 100 },
    { id: 'rep_add_1', title: '레퍼토리 확장', desc: '레퍼토리 트래커에 새 연습 곡 1곡 이상 추가하기', icon: '🎵', goal: 1, unit: '곡', page: 'repertoire', xpReward: 50 },
    { id: 'rep_level_up', title: '한 단계 레벨 업!', desc: '레퍼토리 곡의 단계를 1회 이상 올리기 (Learning→Polishing 등)', icon: '🚀', goal: 1, unit: '회', page: 'repertoire', xpReward: 60 },
  ],



  // ── 크루 시즌 랭킹 설정 ───────────────────────────────────────────
  SEASON_ANCHOR: '2026-03-30', // 격주 시즌 기준일 (반드시 월요일)
  SEASON_BADGES: [
    { id: 'season_rank1', rank: 1, label: '시즌 챔피언', emoji: '🏆', svgPath: 'assets/badges/season_rank1.svg' },
    { id: 'season_rank2', rank: 2, label: '시즌 준우승', emoji: '🥈', svgPath: 'assets/badges/season_rank2.svg' },
    { id: 'season_rank3', rank: 3, label: '시즌 3위',   emoji: '🥉', svgPath: 'assets/badges/season_rank3.svg' },
    { id: 'season_part',  rank: 99, label: '시즌 참가', emoji: '🎸', svgPath: 'assets/badges/season_part.svg' },
  ],
};

// ─── 유틸 함수 ────────────────────────────────────────────────────────
CONFIG.formatChordName = (root, type) => {
  const ct = CONFIG.CHORD_TYPES.find(c => c.id === type);
  return root + (ct ? ct.suffix : '');
};

CONFIG.resolveChord = (roman, chordTypeId, rootKey) => {
  const rootIdx = CONFIG.NOTES.indexOf(rootKey);
  const interval = CONFIG.ROMAN_INTERVALS[roman] ?? 0;
  return { root: CONFIG.NOTES[(rootIdx + interval) % 12], type: chordTypeId };
};

CONFIG.midiToHz = (midi) => 440 * Math.pow(2, (midi - 69) / 12);
CONFIG.noteToMidi = (note, octave = 4) => 12 + CONFIG.NOTES.indexOf(note) + octave * 12;
CONFIG.getHoliday = (dateStr) =>
  CONFIG.HOLIDAYS[dateStr] || CONFIG.HOLIDAYS[dateStr.slice(5)] || null;
