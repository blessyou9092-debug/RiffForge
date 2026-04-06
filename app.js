/**
 * RiffForge - app.js
 * 전역 상태, 사이드바, 탭 전환, 포모도로, 메트로놈UI, 백킹UI, 참고자료
 */

// ═══════════════════════════════════════════════════════════════════════════
// 토스트 알림 (전역)
// ═══════════════════════════════════════════════════════════════════════════
function showToast(msg, type = 'info') {
  const colors = { success: 'bg-green-500', error: 'bg-red-500', info: 'bg-amber-500', warning: 'bg-orange-500' };
  const toast = document.createElement('div');
  toast.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white
    text-sm font-semibold shadow-lg ${colors[type] || colors.info} transition-all duration-300 opacity-0 translate-y-4`;
  toast.textContent = msg;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.remove('opacity-0', 'translate-y-4'));
  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-4');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function getTodayStr() { return new Date().toISOString().split('T')[0]; }

// ═══════════════════════════════════════════════════════════════════════════
// AppState: 전역 상태 관리
// ═══════════════════════════════════════════════════════════════════════════
const AppState = (() => {
  let xp = 0, water = 0, streak = 0, lastPracticeDate = '';
  let weeklyXp = [0, 0, 0, 0, 0, 0, 0];
  let weeklyMin = [0, 0, 0, 0, 0, 0, 0];
  let totalMin = 0;

  async function loadAll() {
    // localStorage에서 즉시 로드 (UI 빠르게)
    xp = Storage.get(CONFIG.KEYS.XP, 0);
    water = Storage.get(CONFIG.KEYS.WATER, 0);
    streak = Storage.get(CONFIG.KEYS.STREAK, 0);
    lastPracticeDate = Storage.get(CONFIG.KEYS.LAST_PRACTICE_DATE, '');
    weeklyXp = Storage.get(CONFIG.KEYS.WEEKLY_XP, [0, 0, 0, 0, 0, 0, 0]);
    weeklyMin = Storage.get(CONFIG.KEYS.WEEKLY_MIN, [0, 0, 0, 0, 0, 0, 0]);
    totalMin = Storage.get(CONFIG.KEYS.TOTAL_MIN, 0);
    applyTheme(Storage.get(CONFIG.KEYS.THEME, 'amber'));

    // Firestore에서 최신 프로필 동기화 (Firebase 준비 후)
    if (typeof FireDB !== 'undefined') {
      FireDB.onReady(async () => {
        const profile = await FireDB.loadProfile();
        if (profile) {
          // 클라우드 값이 로컬보다 크면 덮어씀 (다른 기기에서 진행한 경우)
          if ((profile.xp || 0) > xp) { xp = profile.xp; Storage.set(CONFIG.KEYS.XP, xp); }
          if ((profile.water || 0) > water) { water = profile.water; Storage.set(CONFIG.KEYS.WATER, water); }
          if ((profile.streak || 0) >= streak) { streak = profile.streak; Storage.set(CONFIG.KEYS.STREAK, streak); }
          if (profile.totalMin > totalMin) { totalMin = profile.totalMin; Storage.set(CONFIG.KEYS.TOTAL_MIN, totalMin); }
          if (profile.weeklyMin) { weeklyMin = profile.weeklyMin; Storage.set(CONFIG.KEYS.WEEKLY_MIN, weeklyMin); }
          if (profile.lastPracticeDate) { lastPracticeDate = profile.lastPracticeDate; Storage.set(CONFIG.KEYS.LAST_PRACTICE_DATE, lastPracticeDate); }
          renderStats();
          renderDashboard();
          console.log('[AppState] 프로필 클라우드 동기화 완료');
        }
        // 연습일지도 동기화
        await Storage.syncLogsFromCloud();
        CalendarView?.render();
      });
    }
  }

  function saveAll() {
    // localStorage 즉시 저장
    Storage.set(CONFIG.KEYS.XP, xp);
    Storage.set(CONFIG.KEYS.WATER, water);
    Storage.set(CONFIG.KEYS.STREAK, streak);
    Storage.set(CONFIG.KEYS.LAST_PRACTICE_DATE, lastPracticeDate);
    Storage.set(CONFIG.KEYS.WEEKLY_XP, weeklyXp);
    Storage.set(CONFIG.KEYS.WEEKLY_MIN, weeklyMin);
    Storage.set(CONFIG.KEYS.TOTAL_MIN, totalMin);

    // Firestore 비동기 저장
    if (typeof FireDB !== 'undefined' && FireDB.isReady() && FireDB.getUsername()) {
      FireDB.saveProfile({
        xp, water, streak, lastPracticeDate,
        weeklyXp, weeklyMin, totalMin,
        username: FireDB.getUsername(),
        updatedAt: new Date().toISOString(),
      }).catch(e => console.warn('[AppState] saveProfile 실패:', e));
    }
  }

  function addXP(amount) {
    xp += amount;
    weeklyXp[new Date().getDay()] = (weeklyXp[new Date().getDay()] || 0) + amount;
    saveAll(); renderStats();
  }
  function addWater() {
    water++; saveAll(); renderStats(); checkHarvest();
  }
  function updateStreak(dateStr) {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    const yStr = yesterday.toISOString().split('T')[0];
    if (lastPracticeDate === yStr) streak++;
    else if (lastPracticeDate !== dateStr) streak = 1;
    lastPracticeDate = dateStr; saveAll();
  }
  function checkHarvest() {
    const harvested = Storage.get(CONFIG.KEYS.HARVEST, []);
    CONFIG.HARVEST_ITEMS.forEach(item => {
      if (water >= item.water && !harvested.includes(item.id)) {
        harvested.push(item.id);
        Storage.set(CONFIG.KEYS.HARVEST, harvested);
        setTimeout(() => showToast(`🎉 수확! ${item.emoji} ${item.name}`, 'success'), 500);
      }
    });
    renderTreeGarden();
  }
  function getTreeStage() {
    for (let i = CONFIG.TREE_STAGES.length - 1; i >= 0; i--)
      if (water >= CONFIG.TREE_STAGES[i].min) return CONFIG.TREE_STAGES[i];
    return CONFIG.TREE_STAGES[0];
  }
  // 누적 시간 포맷터
  function formatMin(m) {
    if (m < 1000) return m + '분';
    const h = Math.floor(m / 60), min = m % 60;
    if (h < 100) return `${h}시간 ${min}분`;
    const d = Math.floor(h / 24), rh = h % 24;
    return `${d}일 ${rh}시간 ${min}분`;
  }

  // ── 테마 시스템 ──────────────────────────────────────────────────
  const THEME_GRADIENT = {
    amber: { from: 'from-amber-500', to: 'to-orange-500' },
    lime: { from: 'from-lime-500', to: 'to-green-500' },
    sky: { from: 'from-sky-500', to: 'to-blue-500' },
  };

  // 포모도로 SVG 그라디언트 stop 색상
  const POMO_GRAD_COLORS = {
    amber: ['#f59e0b', '#ef4444'],
    lime: ['#84cc16', '#22c55e'],
    sky: ['#0ea5e9', '#3b82f6'],
  };

  function applyTheme(name) {
    const t = THEME_GRADIENT[name] || THEME_GRADIENT.amber;

    // 1) body data-theme → CSS 포괄 오버라이드 트리거
    document.body.dataset.theme = name;

    // 2) .theme-gradient 요소 클래스 업데이트
    document.querySelectorAll('.theme-gradient').forEach(el => {
      el.classList.remove('from-amber-500', 'to-orange-500', 'from-lime-500', 'to-green-500', 'from-sky-500', 'to-blue-500');
      el.classList.add(t.from, t.to);
    });

    // 3) 포모도로 SVG 그라디언트 stop 색상 변경
    const gc = POMO_GRAD_COLORS[name] || POMO_GRAD_COLORS.amber;
    const stops = document.querySelectorAll('#pomoGrad stop');
    if (stops[0]) stops[0].setAttribute('stop-color', gc[0]);
    if (stops[1]) stops[1].setAttribute('stop-color', gc[1]);

    // 4) 테마 버튼 활성 상태 표시
    ['amber', 'lime', 'sky'].forEach(n => {
      const btn = document.getElementById(`theme-btn-${n}`);
      if (!btn) return;
      if (n === name) {
        btn.classList.add('theme-btn-active');
        btn.style.transform = 'scale(1.25)';
      } else {
        btn.classList.remove('theme-btn-active');
        btn.style.transform = '';
      }
    });

    Storage.set(CONFIG.KEYS.THEME, name);
  }
  function setTheme(name) { applyTheme(name); }

  // 사용자 이름 편집
  function editUsername() {
    const cur = Storage.get(CONFIG.KEYS.USERNAME, '');
    const name = prompt('이름을 입력하세요', cur);
    if (name === null) return;
    Storage.set(CONFIG.KEYS.USERNAME, name.trim());
    renderGreeting();
  }

  // 인사말 렌더링
  function renderGreeting() {
    const name = Storage.get(CONFIG.KEYS.USERNAME, '') || '기타리스트';
    const h = new Date().getHours();
    const greeting = h < 11 ? '좋은 아침입니다' : h < 18 ? '좋은 오후입니다' : '좋은 저녁입니다';
    const msg = `${name}님, ${greeting}! 🎸`;
    const el = document.getElementById('dash-greeting');
    if (el) el.textContent = msg;
    const hdr = document.getElementById('hdr-greeting');
    if (hdr) hdr.textContent = name + '님';
  }

  function renderStats() {
    const tm = formatMin(totalMin);
    [['stat-water', water], ['stat-streak', streak + '일'],
    ['stat-water-hdr', water], ['stat-totalmin-hdr', tm], ['stat-streak-hdr', streak + '일']
    ].forEach(([id, val]) => { const e = document.getElementById(id); if (e) e.textContent = val; });
  }

  function renderDashboard() {
    renderStats();
    renderGreeting();
    const todayLog = Storage.getLog(getTodayStr());
    const todayMin = todayLog?.totalMin || 0;
    const stage = getTreeStage();
    [['dash-today-min', todayMin + '분'], ['dash-water-total', water + '회'],
    ['dash-totalmin', formatMin(totalMin)], ['dash-streak', streak + '일'],
    ['dash-tree-emoji', stage.emoji], ['dash-tree-name', stage.name]
    ].forEach(([id, val]) => { const e = document.getElementById(id); if (e) e.textContent = val; });
    renderWeekChart();
    renderMonthHeatmap();
    renderWeeklyChallenges();
  }
  function getWeekKey() {
    const d = new Date();
    const start = new Date(d.getFullYear(), 0, 1);
    const wn = Math.ceil(((d - start) / 86400000 + start.getDay() + 1) / 7);
    return `${d.getFullYear()}-W${String(wn).padStart(2, '0')}`;
  }

  function renderWeeklyChallenges() {
    const el = document.getElementById('weekly-challenges');
    if (!el) return;
    const wk = getWeekKey();
    if (localStorage.getItem('rf_chal_week') !== wk) {
      localStorage.setItem('rf_chal_week', wk);
      localStorage.removeItem('rf_chal_prog');
    }
    let prog = {};
    try { prog = JSON.parse(localStorage.getItem('rf_chal_prog')) || {}; } catch { }
    const n = CONFIG.WEEKLY_CHALLENGES.length;
    const wNum = parseInt(wk.split('-W')[1]);
    const three = [0, 1, 2].map(i => CONFIG.WEEKLY_CHALLENGES[(wNum + i) % n]);
    const doneCount = three.filter(c => (prog[c.id] || 0) >= c.goal).length;
    const PAGE_LABEL = { builder: '연습일지', pomo: '포모도로', repertoire: '레퍼토리 트래커', studio: '메트로놈&백킹' };
    el.innerHTML = `
    <div class="bg-white rounded-2xl border border-amber-100 shadow-sm px-4 py-3 mb-4">
      <div class="flex items-center gap-2 mb-2">
        <span class="text-sm font-bold text-gray-700">🎯 이번 주 챌린지</span>
        <span class="text-xs text-amber-600 font-black ml-auto">${doneCount}/3 완료</span>
      </div>
      <div class="flex flex-col gap-1">
        ${three.map(c => {
      const cur = prog[c.id] || 0;
      const pct = Math.min(100, Math.round((cur / c.goal) * 100));
      const done = pct >= 100;
      const dest = c.page || 'builder';
      const destLabel = PAGE_LABEL[dest] || dest;
      return `<div
          onclick="AppSidebar.setActive('${dest}')"
          title="${c.desc} (${cur}/${c.goal} ${c.unit}) → ${destLabel}으로 이동"
          class="group flex items-center gap-2 rounded-xl px-2 py-1 cursor-pointer hover:bg-amber-50 transition-colors">
          <span class="text-base w-5 shrink-0">${c.icon}</span>
          <span class="text-xs font-semibold text-gray-700 w-28 shrink-0 truncate group-hover:text-amber-700">${c.title}</span>
          <div class="flex-1 bg-gray-100 rounded-full h-1.5">
            <div class="${done ? 'bg-green-400' : 'bg-amber-400'} h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
          </div>
          <span class="text-[11px] font-black ${done ? 'text-green-600' : 'text-amber-500'} w-10 text-right shrink-0">${done ? '✅' : pct + '%'}</span>
          <span class="text-[10px] text-gray-300 group-hover:text-amber-400 shrink-0">→</span>
        </div>`;
    }).join('')}
      </div>
    </div>`;
  }

  function renderWeekChart() {
    const c = document.getElementById('week-chart');
    if (!c) return;
    const max = Math.max(...weeklyMin, 1);
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const tod = new Date().getDay();
    c.innerHTML = days.map((d, i) => {
      const val = weeklyMin[i] || 0;
      const pct = Math.round((val / max) * 100);
      return `<div class="flex flex-col items-center gap-1 flex-1">
        <div class="w-full flex items-end justify-center" style="height:60px">
          <div class="w-full max-w-[28px] rounded-t-lg ${i === tod ? 'bg-gradient-to-t from-amber-500 to-orange-400' : 'bg-amber-200'}"
            style="height:${Math.max(pct, 4)}%" title="${val}분"></div>
        </div>
        <span class="text-xs ${i === tod ? 'font-black text-amber-600' : 'text-gray-500'}">${d}</span>
        <span class="text-[10px] text-gray-400">${val}</span>
      </div>`;
    }).join('');
  }


  function renderMonthHeatmap() {
    const c = document.getElementById('month-heatmap');
    if (!c) return;
    const today = new Date();
    const days = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    let html = '';
    for (let d = 1; d <= days; d++) {
      const ds = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const min = Storage.getLog(ds)?.totalMin || 0;
      const col = min >= 45 ? 'bg-amber-500' : min >= 30 ? 'bg-amber-400' : min > 0 ? 'bg-amber-200' : 'bg-gray-100';
      html += `<div class="w-5 h-5 rounded-sm ${col} ${d === today.getDate() ? 'ring-2 ring-orange-400' : ''}" title="${d}일: ${min}분"></div>`;
    }
    c.innerHTML = html;
  }


  function renderTreeGarden() {
    const stage = getTreeStage();
    const harvested = Storage.get(CONFIG.KEYS.HARVEST, []);
    [['tree-emoji', stage.emoji], ['tree-name', stage.name], ['tree-desc', stage.desc],
    ['tree-water', water + '회'], ['tree-xp', xp.toLocaleString() + ' XP'],
    ['tree-streak', streak + '일'], ['tree-totalmin', formatMin(totalMin)]
    ].forEach(([id, val]) => { const e = document.getElementById(id); if (e) e.textContent = val; });

    const nextIdx = CONFIG.TREE_STAGES.findIndex(s => water < s.min);
    if (nextIdx > 0) {
      const next = CONFIG.TREE_STAGES[nextIdx];
      const curr = CONFIG.TREE_STAGES[nextIdx - 1];
      const pct = Math.min(100, Math.round(((water - curr.min) / (next.min - curr.min)) * 100));
      const prog = document.getElementById('tree-progress');
      const ptxt = document.getElementById('tree-progress-txt');
      if (prog) prog.style.width = pct + '%';
      if (ptxt) ptxt.textContent = `다음 단계까지 ${next.min - water}회 남음`;
    } else {
      const prog = document.getElementById('tree-progress');
      const ptxt = document.getElementById('tree-progress-txt');
      if (prog) prog.style.width = '100%';
      if (ptxt) ptxt.textContent = '최고 단계 달성! 🏆';
    }

    const hc = document.getElementById('harvest-collection');
    if (hc) {
      hc.innerHTML = CONFIG.HARVEST_ITEMS.map(item => {
        const unlocked = harvested.includes(item.id);
        return `<div class="flex flex-col items-center gap-1 ${unlocked ? '' : 'opacity-30 grayscale'}">
          <div class="text-3xl">${item.emoji}</div>
          <span class="text-xs text-center font-medium ${unlocked ? 'text-gray-700' : 'text-gray-400'}">${item.name}</span>
          <span class="text-[10px] text-gray-400">${item.water}회</span>
        </div>`;
      }).join('');
    }

    // 가상 기타 컬렉션
    const gc = document.getElementById('virtual-guitar-collection');
    if (gc) {
      let masteredCount = 0;
      try { masteredCount = (JSON.parse(localStorage.getItem('rf_repertoire')) || []).filter(s => s.state === 'mastered').length; } catch { }
      const streak = Storage.get(CONFIG.KEYS.STREAK, 0);

      gc.innerHTML = CONFIG.VIRTUAL_GUITARS.map(g => {
        let unlocked = false;
        const c = g.unlockCond;
        if (c.type === 'default') unlocked = true;
        if (c.type === 'water') unlocked = water >= c.count;
        if (c.type === 'streak') unlocked = streak >= c.days;
        if (c.type === 'mastered') unlocked = masteredCount >= c.count;
        if (c.type === 'challenge') unlocked = false; // 챌린지 미구현
        if (c.type === 'pomo') unlocked = false; // 포모 누적 미구현

        return `<div class="flex flex-col items-center gap-1 p-3 rounded-xl border ${unlocked ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50 opacity-40 grayscale'}" title="${unlocked ? (g.buff?.label || '기본') : '잠금: ' + g.unlockDesc}">
          <span class="text-2xl">${g.emoji}</span>
          <span class="text-[11px] font-bold text-center text-gray-700 leading-tight">${g.name}</span>
          ${unlocked && g.buff ? `<span class="text-[10px] text-amber-600 font-bold">${g.buff.label}</span>` : ''}
          ${!unlocked ? `<span class="text-[10px] text-gray-400 text-center">${g.unlockDesc}</span>` : ''}
        </div>`;
      }).join('');
    }
  }

  // ── 유저 ID (DB 연동 대비 UUID) ──────────────────────────────
  function getUserId() {
    const name = Storage.get(CONFIG.KEYS.USERNAME, '').trim();
    if (name) {
      // 이름을 ID로 사용 → 같은 이름이면 어느 기기든 동일 ID
      const uid = 'user-' + name;
      Storage.set(CONFIG.KEYS.USER_ID, uid);
      return uid;
    }
    // 이름 미설정 시 기존 UUID 방식 유지
    let uid = Storage.get(CONFIG.KEYS.USER_ID, null);
    if (!uid) {
      uid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'u-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 9);
      Storage.set(CONFIG.KEYS.USER_ID, uid);
    }
    return uid;
  }
  // ── 프로필 모달 ──────────────────────────────────────────────
  const BASIC_AVATARS = ['🎸', '🎹', '🥁', '🎤', '🎺', '🎻', '🪗', '🎷'];

  function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // 현재 저장값 세팅
    const curName = Storage.get(CONFIG.KEYS.USERNAME, '');
    const curAvatar = Storage.get(CONFIG.KEYS.AVATAR, '🎸');
    document.getElementById('profile-name-input').value = curName;

    // 기본 아이콘 렌더링
    const basicEl = document.getElementById('profile-basic-icons');
    if (basicEl) {
      basicEl.innerHTML = BASIC_AVATARS.map(ico => `
        <button onclick="AppState._selectAvatar('${ico}')"
          class="avatar-opt text-2xl w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all
            ${curAvatar === ico ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-200'}"
          data-avatar="${ico}">${ico}</button>`).join('');
    }

    // 해금 기타 렌더링
    const guitarEl = document.getElementById('profile-guitar-icons');
    if (guitarEl) {
      const water = AppState.getWater();
      const streak = AppState.getStreak();
      const unlockedGuitars = CONFIG.VIRTUAL_GUITARS.filter(g => {
        const c = g.unlockCond;
        if (c.type === 'default') return true;
        if (c.type === 'water') return water >= c.count;
        if (c.type === 'streak') return streak >= c.days;
        return false; // challenge/pomo/mastered는 별도 조건 필요 → 잠금 유지
      });
      if (unlockedGuitars.length === 0) {
        guitarEl.innerHTML = '<p class="text-xs text-gray-400">아직 해금된 기타가 없어요.</p>';
      } else {
        guitarEl.innerHTML = unlockedGuitars.map(g => `
          <button onclick="AppState._selectAvatar('${g.emoji}')"
            class="avatar-opt text-2xl w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all
              ${curAvatar === g.emoji ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-200'}"
            data-avatar="${g.emoji}" title="${g.name}">${g.emoji}</button>`).join('');
      }
    }
  }

  function _selectAvatar(ico) {
    document.querySelectorAll('.avatar-opt').forEach(btn => {
      const selected = btn.dataset.avatar === ico;
      btn.classList.toggle
        ('border-amber-400', selected);
      btn.classList.toggle
        ('bg-amber-50', selected);
      btn.classList.toggle
        ('border-gray-200', !selected);
    });
    // 임시 선택값 저장
    document.querySelectorAll('.avatar-opt').forEach(btn => btn.dataset.selected = btn.dataset.avatar === ico ? 'true' : '');
  }

  function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (!modal) return;
    modal.classList.add
      ('hidden');
    modal.classList.remove('flex');
  }

  function saveProfile() {
    const name = (document.getElementById('profile-name-input')?.value || '').trim();
    const selBtn = document.querySelector('.avatar-opt[data-selected="true"]');
    const avatar = selBtn ? selBtn.dataset.avatar : Storage.get(CONFIG.KEYS.AVATAR, '🎸');

    if (name) Storage.set(CONFIG.KEYS.USERNAME
      , name);
    Storage.set(CONFIG.KEYS.AVATAR, avatar);

    closeProfileModal();
    renderGreeting();
    CrewBoard.refreshMyInfo(); // 피드 헤더 동기화
    showToast('프로필이 저장되었습니다 ✅', 'success');
  }
  function navigate(page) { AppSidebar.setActive(page); }

  return {
    loadAll, saveAll, addXP, addWater, updateStreak, getTreeStage,
    renderStats, renderDashboard, renderWeeklyChallenges, renderTreeGarden,
    getXp: () => xp, getWater: () => water, getStreak: () => streak,
    navigate,
    setTheme, editUsername, formatMin,
    addTotalMin: (m) => { totalMin += m; weeklyMin[new Date().getDay()] = (weeklyMin[new Date().getDay()] || 0) + m; saveAll(); renderStats(); },
    // Phase 7 추가
    getUserId, openProfileModal, closeProfileModal, saveProfile, _selectAvatar,
    getTodayMin: () => Storage.getLog(getTodayStr())?.totalMin || 0,
  };
})();


// ═══════════════════════════════════════════════════════════════════════════
// AppSidebar: 사이드바 토글 + 탭 전환
// ═══════════════════════════════════════════════════════════════════════════
const AppSidebar = (() => {
  let collapsed = false;
  let activePage = 'home';

  // 메트로놈+백킹 통합, 참고자료 추가
  const PAGES = [
    { id: 'home', label: '대시보드', icon: 'fa-house' },
    { id: 'calendar', label: '달력', icon: 'fa-calendar-days' },
    { id: 'builder', label: '연습일지', icon: 'fa-pen-nib' },
    { id: 'pomo', label: '포모도로', icon: 'fa-clock' },
    { id: 'studio', label: '메트로놈 & 백킹', icon: 'fa-music' },
    { id: 'tree', label: '기타 나무', icon: 'fa-seedling' },
    { id: 'reference', label: '참고 자료🚧(미완)', icon: 'fa-book-open' },
    { id: 'repertoire', label: '레퍼토리 트래커', icon: 'fa-list-music' },
    { id: 'ranking', label: '크루 랭킹🚧(미완)', icon: 'fa-ranking-star' },
    { id: 'board', label: '크루 게시판', icon: 'fa-comments' },
    { id: 'export', label: '성장 스토리', icon: 'fa-book-heart' },
  ];

  function toggle() {
    collapsed = !collapsed;
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    const labels = document.querySelectorAll('.sidebar-label');
    const title = document.getElementById('app-title');
    const icon = document.getElementById('sidebar-toggle-icon');

    if (collapsed) {
      sidebar.classList.replace('w-64', 'w-20');
      main.classList.replace('ml-64', 'ml-20');
      labels.forEach(l => l.classList.add('hidden'));
      title?.classList.add('hidden');
      if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
      sidebar.classList.replace('w-20', 'w-64');
      main.classList.replace('ml-20', 'ml-64');
      labels.forEach(l => l.classList.remove('hidden'));
      title?.classList.remove('hidden');
      if (icon) icon.style.transform = '';
    }
  }

  function _isMobile() { return window.innerWidth < 768; }

  function _collapseForMobile() {
    if (!_isMobile() || collapsed) return;
    collapsed = true;
    const sidebar = document.getElementById('sidebar');
    const main = document.getElementById('main-content');
    const labels = document.querySelectorAll('.sidebar-label');
    const title = document.getElementById('app-title');
    const icon = document.getElementById('sidebar-toggle-icon');
    sidebar?.classList.replace('w-64', 'w-20');
    main?.classList.replace('ml-64', 'ml-20');
    labels.forEach(l => l.classList.add('hidden'));
    title?.classList.add('hidden');
    if (icon) icon.style.transform = 'rotate(180deg)';
  }

  function setActive(pageId) {
    activePage = pageId;
    // 참고자료 이탈 시 ref 탭 패널 강제 숨김
    if (pageId !== 'reference') {
      document.querySelectorAll('.ref-tab-panel').forEach(p => p.classList.add('hidden'));
    }
    document.querySelectorAll('.page-section').forEach(el => el.classList.add('hidden'));
    document.getElementById(`page-${pageId}`)?.classList.remove('hidden');
    document.querySelectorAll('.sidebar-nav-item').forEach(el => {
      const on = el.dataset.page === pageId;
      el.classList.toggle('bg-amber-100', on);
      el.classList.toggle('text-amber-700', on);
      el.classList.toggle('font-bold', on);
      el.classList.toggle('text-gray-600', !on);
    });
    // 모바일에서 메뉴 선택 시 자동 접힘
    _collapseForMobile();
    onPageEnter(pageId);
  }

  function onPageEnter(id) {
    if (id === 'home') AppState.renderDashboard();
    if (id === 'calendar') CalendarView.render();
    if (id === 'builder') PracticeBuilder.init();
    if (id === 'tree') AppState.renderTreeGarden();
    if (id === 'studio') StudioUI.onEnter();
    if (id === 'reference') ReferenceUI.onEnter();
    if (id === 'repertoire') RepertoireTracker.render();
    if (id === 'ranking') CrewRanking.render();
    if (id === 'board') CrewBoard.render();
    if (id === 'export') ProgressStory.render();
  }



  function init() {
    const nav = document.getElementById('sidebar-nav');
    if (!nav) return;
    nav.innerHTML = PAGES.map(p => `
      <button data-page="${p.id}" onclick="AppSidebar.setActive('${p.id}')"
        class="sidebar-nav-item w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all
          duration-200 text-gray-600 hover:bg-amber-50 hover:text-amber-600" title="${p.label}">
        <i class="fa-solid ${p.icon} w-5 text-center text-lg shrink-0"></i>
        <span class="sidebar-label text-sm font-medium whitespace-nowrap">${p.label}</span>
      </button>`
    ).join('');
    setActive('home');
  }

  return { toggle, setActive, init, getActivePage: () => activePage };
})();
window.AppSidebar = AppSidebar;


// ═══════════════════════════════════════════════════════════════════════════
// Pomodoro
// ═══════════════════════════════════════════════════════════════════════════
const Pomodoro = (() => {
  let focusMin = CONFIG.POMO.FOCUS_MIN, breakMin = CONFIG.POMO.BREAK_MIN;
  let remaining = focusMin * 60, isRunning = false, isFocus = true;
  let sessionCount = 0, interval = null;
  let bellType = 'beep';

  // ── 세션 큐 ──────────────────────────────────────────────────────
  let taskQueue = [];      // [{id, name, type, minutes, done}]
  let currentTaskIdx = -1; // 현재 진행 중인 태스크 인덱스 (-1: 자유 모드)

  const TYPE_ICON = { warmup: '🔥', theory: '🎵', practical: '🎸' };

  function loadFromBuilder() {
    const sessions = typeof PracticeBuilder !== 'undefined' ? PracticeBuilder.getSessions() : [];
    if (!sessions.length) {
      showToast('연습일지에 세션을 먼저 추가해주세요.', 'info');
      renderTaskQueue();
      return;
    }
    taskQueue = sessions.map(s => ({
      id: s.id, name: s.name, type: s.type,
      minutes: s.minutes, done: s.completed || false,
    }));
    currentTaskIdx = -1;
    renderTaskQueue();
    showToast(`📋 ${taskQueue.length}개 세션 연동 완료!`, 'success');
  }

  function startTask(idx) {
    if (idx < 0 || idx >= taskQueue.length) return;
    currentTaskIdx = idx;
    const task = taskQueue[idx];
    // 집중 시간을 세션 분으로 설정
    focusMin = task.minutes;
    breakMin = Math.max(5, Math.round(task.minutes / 6 / 5) * 5); // 집중시간의 ~1/6, 5분 단위
    breakMin = Math.min(30, breakMin);
    remaining = focusMin * 60;
    isFocus = true;
    // UI 인풋 동기화
    const fi = document.getElementById('pomo-focus-input');
    const bi = document.getElementById('pomo-break-input');
    if (fi) fi.value = focusMin;
    if (bi) bi.value = breakMin;
    // 자동 시작
    if (!isRunning) startStop();
    else { clearInterval(interval); isRunning = false; startStop(); }
    renderTaskQueue();
    showToast(`▶ [${task.name}] 시작! 집중 ${focusMin}분 / 휴식 ${breakMin}분`, 'info');
  }

  function renderTaskQueue() {
    const el = document.getElementById('pomo-task-queue');
    if (!el) return;
    if (!taskQueue.length) {
      el.innerHTML = `<p class="text-xs text-gray-400 text-center py-3">연습일지 세션을 연동하면 여기에 표시됩니다.</p>`;
      return;
    }
    el.innerHTML = taskQueue.map((t, i) => {
      const isCur = i === currentTaskIdx;
      const icon = TYPE_ICON[t.type] || '🎵';
      let rowCls = 'flex items-center gap-2 px-3 py-2 rounded-xl transition-all ';
      if (t.done) rowCls += 'bg-green-50 opacity-60';
      else if (isCur) rowCls += 'bg-amber-100 border border-amber-300';
      else rowCls += 'bg-gray-50 hover:bg-amber-50 cursor-pointer';
      return `<div class="${rowCls}" ${!t.done && !isCur ? `onclick="Pomodoro.startTask(${i})"` : ''}>
        <span class="text-base shrink-0">${icon}</span>
        <div class="flex-1 min-w-0">
          <p class="text-xs font-bold text-gray-800 truncate">${t.name}</p>
          <p class="text-[10px] text-gray-400">${t.minutes}분</p>
        </div>
        ${t.done
          ? '<span class="text-green-500 text-sm font-black shrink-0">✅</span>'
          : isCur
            ? '<span class="text-amber-500 text-xs font-black shrink-0 animate-pulse">진행중</span>'
            : `<button onclick="event.stopPropagation();Pomodoro.startTask(${i})"
                class="text-[10px] px-2 py-0.5 bg-amber-500 text-white rounded-lg font-bold shrink-0 hover:bg-amber-600">▶</button>`
        }
      </div>`;
    }).join('');
  }

  function _markCurrentDone() {
    if (currentTaskIdx >= 0 && currentTaskIdx < taskQueue.length) {
      taskQueue[currentTaskIdx].done = true;
      // 다음 미완료 세션 자동 예약
      const next = taskQueue.findIndex((t, i) => i > currentTaskIdx && !t.done);
      if (next !== -1) {
        showToast(`☕ 휴식 후 [${taskQueue[next].name}] 자동 시작됩니다`, 'info');
        setTimeout(() => { if (!isRunning) startTask(next); }, breakMin * 60 * 1000 + 500);
      } else {
        currentTaskIdx = -1;
        showToast('🎉 오늘 연습 세션 전체 완료!', 'success');
      }
      renderTaskQueue();
    }
  }

  // ── 상태 저장/복원 ──────────────────────────────────────────────
  const _POMO_KEY = 'riffforge_pomo_state';

  function _saveState() {
    try {
      localStorage.setItem(_POMO_KEY, JSON.stringify({
        focusMin, breakMin, bellType,
        remaining, isFocus, sessionCount,
        isRunning, savedAt: Date.now(),
        taskQueue, currentTaskIdx,
      }));
    } catch { }
  }

  function _loadState() {
    try {
      const raw = localStorage.getItem(_POMO_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw);
      focusMin = s.focusMin ?? CONFIG.POMO.FOCUS_MIN;
      breakMin = s.breakMin ?? CONFIG.POMO.BREAK_MIN;
      bellType = s.bellType ?? 'beep';
      isFocus = s.isFocus ?? true;
      sessionCount = s.sessionCount ?? 0;
      taskQueue = s.taskQueue ?? [];
      currentTaskIdx = s.currentTaskIdx ?? -1;

      // 경과 시간 반영
      let adj = s.remaining ?? (focusMin * 60);
      if (s.isRunning && s.savedAt) {
        const elapsed = Math.floor((Date.now() - s.savedAt) / 1000);
        adj = Math.max(0, adj - elapsed);
      }
      remaining = adj;

      // 인풋 UI 동기화
      const fi = document.getElementById('pomo-focus-input');
      const bi = document.getElementById('pomo-break-input');
      if (fi) fi.value = focusMin;
      if (bi) bi.value = breakMin;

      renderTaskQueue();

      // 실행 중이었고 시간이 남아 있으면 자동 재개
      if (s.isRunning && remaining > 0) {
        isRunning = true;
        interval = setInterval(() => { remaining--; updateDisplay(); if (remaining <= 0) onComplete(); }, 1000);
      }
      return true;
    } catch { return false; }
  }

  function applyPreset(f, b) {
    setFocusMin(f); setBreakMin(b);
    const fi = document.getElementById('pomo-focus-input');
    const bi = document.getElementById('pomo-break-input');
    if (fi) fi.value = f;
    if (bi) bi.value = b;
    showToast(`⏱ 프리셋 적용: 집중 ${f}분 / 휴식 ${b}분`, 'info');
  }

  function setBellType(type) {
    bellType = type;
    document.querySelectorAll('.pomo-bell-btn').forEach(btn => {
      const on = btn.dataset.bell === type;
      btn.classList.toggle('bg-amber-500', on);
      btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on);
      btn.classList.toggle('text-gray-600', !on);
    });
    _saveState();
  }

  function updateDisplay() {
    const m = Math.floor(remaining / 60), s = remaining % 60;
    const disp = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    const el = (id) => document.getElementById(id);
    if (el('pomo-display')) el('pomo-display').textContent = disp;
    if (el('pomo-mini')) el('pomo-mini').textContent = disp;

    const total = (isFocus ? focusMin : breakMin) * 60;
    const pct = 1 - remaining / total;
    const circ = el('pomo-circle');
    if (circ) circ.style.strokeDashoffset = 2 * Math.PI * 90 * (1 - pct);

    if (el('pomo-mode')) {
      el('pomo-mode').textContent = isFocus ? '🎯 집중' : '☕ 휴식';
      el('pomo-mode').className = `text-base font-bold ${isFocus ? 'text-amber-600' : 'text-blue-500'}`;
    }
    if (el('pomo-session-count')) el('pomo-session-count').textContent = `세션 ${sessionCount + 1}`;

    const btn = el('pomo-start-btn');
    if (btn) {
      btn.textContent = isRunning ? '⏸ 일시정지' : '▶ 시작';
      btn.className = `px-8 py-3 rounded-2xl text-white font-bold text-lg transition-all
        ${isRunning ? 'bg-orange-400 hover:bg-orange-500' : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600'}`;
    }
    if (el('pomo-mini')) el('pomo-mini').className = `text-xs font-bold ${isRunning ? 'text-amber-600 animate-pulse' : 'text-gray-400'}`;
    _saveState();
  }

  function onComplete() {
    clearInterval(interval); isRunning = false;
    if (isFocus) {
      sessionCount++;
      AppState.addXP(CONFIG.XP.POMO_COMPLETE); AppState.saveAll();
      showToast(`🍅 포모도로 완료! XP +${CONFIG.XP.POMO_COMPLETE}`, 'success');
      _markCurrentDone();
      isFocus = false;
      const lng = sessionCount % CONFIG.POMO.SESSIONS_UNTIL_LONG === 0;
      remaining = (lng ? CONFIG.POMO.LONG_BREAK_MIN : breakMin) * 60;
    } else {
      isFocus = true;
      remaining = focusMin * 60;
      showToast('☕ 휴식 완료! 다시 집중해봐요', 'info');
    }
    _bell(); updateDisplay();
  }

  function _bell() { playPomodoroBell(bellType); }

  function startStop() {
    if (isRunning) { clearInterval(interval); isRunning = false; }
    else { isRunning = true; interval = setInterval(() => { remaining--; updateDisplay(); if (remaining <= 0) onComplete(); }, 1000); }
    updateDisplay();
  }
  function reset() { clearInterval(interval); isRunning = false; isFocus = true; remaining = focusMin * 60; updateDisplay(); }
  function setFocusMin(v) { focusMin = Math.max(1, Math.min(60, parseInt(v))); if (!isRunning && isFocus) remaining = focusMin * 60; updateDisplay(); }
  function setBreakMin(v) { breakMin = Math.max(1, Math.min(30, parseInt(v))); if (!isRunning && !isFocus) remaining = breakMin * 60; updateDisplay(); }

  function init() {
    const circ = document.getElementById('pomo-circle');
    if (circ) { const c = 2 * Math.PI * 90; circ.style.strokeDasharray = c; circ.style.strokeDashoffset = c; }
    if (!_loadState()) remaining = focusMin * 60;
    setBellType(bellType); // 벨 버튼 UI 동기화
    updateDisplay();
  }

  return {
    startStop, reset, setFocusMin, setBreakMin, init, applyPreset, setBellType,
    getFocusMin: () => focusMin, getBreakMin: () => breakMin,
    loadFromBuilder, startTask, renderTaskQueue,
  };
})();


// ═══════════════════════════════════════════════════════════════════════════
// StudioUI: 메트로놈 + 백킹 트랙 통합 UI
// ═══════════════════════════════════════════════════════════════════════════
const StudioUI = (() => {
  // ── 메트로놈 상태 ─────────────────────────────────────────────────
  let _bpm = CONFIG.METRONOME.DEFAULT_BPM;
  let _tapTimes = [];

  // ── 백킹 상태 ──────────────────────────────────────────────────────
  let selectedGenre = null;
  let selectedKey = 'A';
  let editableProgression = [];   // [{root, type}]
  let _lastStudioChord = null;    // 마지막으로 표시된 코드 (정지 후에도 유지)

  // ── BPM 동기화 헬퍼 ──────────────────────────────────────────────
  function syncBpmDisplay(bpm) {
    _bpm = bpm;
    const slider = document.getElementById('metro-bpm-slider'); if (slider) slider.value = bpm;
    const input = document.getElementById('metro-bpm-input'); if (input) input.value = bpm;
  }

  function setBpm(val) {
    const bpm = Metronome.setBpm(val);
    BackingEngine.setBpm(bpm);
    syncBpmDisplay(bpm);
  }

  function adjustBpm(delta) {
    setBpm(Metronome.adjustBpm(delta));
  }

  // ── 박자 패턴 렌더 (원형 버튼) ────────────────────────────────
  function renderBeatPattern() {
    const pattern = Metronome.getBeatPattern();
    const c = document.getElementById('beat-pattern-editor');
    if (!c) return;
    c.innerHTML = pattern.map((mode, i) => {
      const fill = mode === 'accent' ? '#FF6B00' : mode === 'normal' ? '#e5e7eb' : '#f3f4f6';
      const border = mode === 'accent' ? '#FF6B00' : mode === 'normal' ? '#d1d5db' : '#e5e7eb';
      const textColor = mode === 'accent' ? 'white' : '#9ca3af';
      return `<button onclick="StudioUI.cycleBeat(${i})" id="beat-btn-${i}"
        class="w-8 h-8 rounded-full border-2 font-bold text-xs transition-all hover:scale-110 active:scale-95"
        style="background:${fill};border-color:${border};color:${textColor};"
        title="${i + 1}박: ${mode}">${i + 1}</button>`;
    }).join('');
  }

  function cycleBeat(idx) {
    Metronome.cycleBeat(idx);
    renderBeatPattern();
  }

  // ── 메트로놈 On/Off 토글 (체크박스) ────────────────────────────
  let _metroEnabled = true;
  let _backingEnabled = true;

  function onMetroToggle(checked) { _metroEnabled = checked; }
  function onBackingToggle(checked) { _backingEnabled = checked; }

  function toggleMetronome() {
    const playing = Metronome.toggle();
    updateMetroBtn(playing);
  }

  function updateMetroBtn(playing) {
    // 새 UI에서는 별도 metro-toggle-btn 없음 — play 버튼만 업데이트
  }

  // ── 탭 템포 ──────────────────────────────────────────────────────
  function tapTempo() {
    const now = Date.now();
    if (_tapTimes.length > 0 && now - _tapTimes[_tapTimes.length - 1] > 2000) _tapTimes = [];
    _tapTimes.push(now);
    if (_tapTimes.length > 1) {
      const intervals = [];
      for (let i = 1; i < _tapTimes.length; i++) intervals.push(_tapTimes[i] - _tapTimes[i - 1]);
      setBpm(Math.round(60000 / (intervals.reduce((a, b) => a + b) / intervals.length)));
    }
  }

  // ── 메트로놈 볼륨 (0~2.5) ────────────────────────────────────────
  function setMetroVolume(val) {
    Metronome.setVolume(val);
    const pct = document.getElementById('metro-volume-pct');
    if (pct) pct.textContent = Math.round(val * 100) + '%';
  }

  // ── 박자 선택 ────────────────────────────────────────────────────
  function setTimeSig(label) {
    const sig = CONFIG.METRONOME.TIME_SIGS.find(t => t.label === label);
    if (sig) { Metronome.setTimeSig(sig); renderBeatPattern(); }
  }

  // ── 세분화 선택 ──────────────────────────────────────────────────
  function setSubdiv(id) { Metronome.setSubdiv(id); }

  // ── 사운드 타입 ──────────────────────────────────────────────────
  function setSoundType(id) {
    Metronome.setSoundType(id);
    document.querySelectorAll('.studio-sound-btn').forEach(btn => {
      const on = btn.dataset.sound === id;
      btn.style.background = on ? '#FF6B00' : '';
      btn.style.color = on ? 'white' : '';
      btn.style.borderColor = on ? '#FF6B00' : '';
    });
  }

  // ── 화성 악기 버튼 active ────────────────────────────────────────
  function setHarmonyBtn(btn) {
    document.querySelectorAll('.studio-harm-btn').forEach(b => {
      b.style.background = ''; b.style.color = ''; b.style.borderColor = '';
    });
    btn.style.background = '#FF6B00';
    btn.style.color = 'white';
    btn.style.borderColor = '#FF6B00';
  }

  // ══════════════════════════════════════════════════════════════════
  // 백킹 트랙 UI
  // ══════════════════════════════════════════════════════════════════

  function selectGenre(id) {
    selectedGenre = CONFIG.BACKING_TRACKS.find(g => g.id === id);
    if (!selectedGenre) return;

    // 카드 강조
    document.querySelectorAll('.genre-card').forEach(el => {
      const on = el.dataset.genre === id;
      el.style.borderColor = on ? '#FF6B00' : '';
      el.style.boxShadow = on ? '0 0 0 2px #FF6B0066' : '';
    });

    // BPM, 키 반영
    setBpm(selectedGenre.defaultBpm);
    selectedKey = selectedGenre.defaultKey;
    const keyEl = document.getElementById('backing-key');
    if (keyEl) keyEl.value = selectedKey;

    // 프리셋 코드 진행 로드
    editableProgression = selectedGenre.progression.map(p =>
      CONFIG.resolveChord(p.r, p.t, selectedKey)
    );

    renderProgressionEditor();
    renderScaleRecommend();
    updateFretboard();
  }

  // 반음 → 음정 이름
  const _IV_NAME = { 0: 'R', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7' };

  // 루트+현재키 → 로마 숫자 (도수)
  const _ROMAN_LABEL = { 0: 'Ⅰ', 1: '♭Ⅱ', 2: 'Ⅱ', 3: '♭Ⅲ', 4: 'Ⅲ', 5: 'Ⅳ', 6: '♭Ⅴ', 7: 'Ⅴ', 8: '♭Ⅵ', 9: 'Ⅵ', 10: '♭Ⅶ', 11: 'Ⅶ' };
  function _getRoman(root) {
    const semi = (CONFIG.NOTES.indexOf(root) - CONFIG.NOTES.indexOf(selectedKey) + 12) % 12;
    return _ROMAN_LABEL[semi] || '?';
  }

  function _chordIntervalRows(chord) {
    const ct = CONFIG.CHORD_TYPES.find(c => c.id === chord.type);
    const ivList = ct?.intervals || [0, 4, 7];
    const ri = CONFIG.NOTES.indexOf(chord.root);
    const notes = ivList.map(iv => CONFIG.NOTES[(ri + iv) % 12]);
    const ivs = ivList.map(iv => _IV_NAME[iv] || '');
    return { notes, ivs };
  }

  function renderProgressionEditor() {
    const c = document.getElementById('chord-progression-editor');
    if (!c) return;

    // 4열 그리드: 항상 4개 슬롯 채움 (코드 수가 4 미만이면 + 버튼으로 채움)
    const cards = editableProgression.map((chord, i) => {
      const name = CONFIG.formatChordName(chord.root, chord.type);
      const { notes, ivs } = _chordIntervalRows(chord);
      const noteRow = notes.join(' · ');
      const ivRow = ivs.join(' · ');
      const roman = _getRoman(chord.root);
      const rootOpts = CONFIG.NOTES.map(n =>
        `<option value="${n}" ${n === chord.root ? 'selected' : ''}>${n}</option>`).join('');
      const typeOpts = CONFIG.CHORD_TYPES.map(ct =>
        `<option value="${ct.id}" ${ct.id === chord.type ? 'selected' : ''}>${ct.label}</option>`).join('');
      return `
        <div id="chord-card-${i}" class="chord-card relative bg-white rounded-xl border-2 border-gray-100 p-2 text-center cursor-pointer"
          onclick="StudioUI.previewChord(${i})">
          <div class="text-[9px] font-black text-indigo-400 leading-none mb-0.5">${roman}</div>
          <div class="chord-name font-black text-sm text-gray-900 leading-tight">${name}</div>
          <div class="text-[8px] text-gray-400 font-medium mt-0.5 leading-tight">${noteRow}</div>
          <div class="text-[8px] text-orange-500 font-bold mb-1 leading-tight">${ivRow}</div>
          <select onchange="StudioUI.editChordRoot(${i}, this.value)" onclick="event.stopPropagation()"
            class="w-full text-[10px] border border-gray-200 rounded px-1 py-0.5 mb-0.5 focus:outline-none text-gray-700 bg-white">
            ${rootOpts}
          </select>
          <select onchange="StudioUI.editChordType(${i}, this.value)" onclick="event.stopPropagation()"
            class="w-full text-[10px] border border-gray-200 rounded px-1 py-0.5 focus:outline-none text-gray-700 bg-white">
            ${typeOpts}
          </select>
          <button onclick="event.stopPropagation(); StudioUI.removeChord(${i})"
            class="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-400 hover:bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center leading-none transition-colors">×</button>
        </div>`;
    }).join('');

    // 4열 그리드: 코드 카드 + + 버튼 + 빈 슬롯으로 4의 배수 채움
    const filled = editableProgression.length;
    const withAdd = filled + 1; // + 버튼 포함
    const totalSlots = Math.ceil(withAdd / 4) * 4; // 4의 배수로 올림
    const emptyCount = totalSlots - withAdd;
    const addBtn = `
      <button onclick="StudioUI.addChord()"
        class="flex items-center justify-center bg-gray-50 hover:bg-orange-50 border-2 border-dashed border-gray-200 hover:border-orange-300 rounded-xl text-gray-400 hover:text-orange-500 text-xl font-black transition-all min-h-[80px]">
        +
      </button>`;
    const empties = Array(emptyCount).fill(`<div class="rounded-xl border-2 border-dashed border-gray-100 min-h-[80px] opacity-40"></div>`).join('');

    c.innerHTML = cards + addBtn + empties;
  }

  function highlightChord(idx) {
    document.querySelectorAll('.chord-card').forEach((el, i) => {
      el.style.borderColor = i === idx ? '#FF6B00' : '';
      el.style.boxShadow = i === idx ? '0 0 0 2px #FF6B0066' : '';
    });
    // 현재 코드톤을 지판에 표시 + 마지막 코드 기억
    const chord = editableProgression[idx];
    if (chord) {
      _lastStudioChord = chord;
      Fretboard.updateWithChordTones(chord);
      updateChordLegend(chord);
    }
  }

  function editChordRoot(i, root) {
    if (editableProgression[i]) editableProgression[i].root = root;
    _refreshChordName(i);
    // 재생 중이 아닐 때 편집 중인 코드의 코드톤 즉시 반영
    if (!BackingEngine.getIsPlaying()) {
      _lastStudioChord = editableProgression[i];
      Fretboard.updateWithChordTones(editableProgression[i]);
      updateChordLegend(editableProgression[i]);
    }
  }

  function editChordType(i, type) {
    if (editableProgression[i]) editableProgression[i].type = type;
    _refreshChordName(i);
    if (!BackingEngine.getIsPlaying()) {
      _lastStudioChord = editableProgression[i];
      Fretboard.updateWithChordTones(editableProgression[i]);
      updateChordLegend(editableProgression[i]);
    }
  }

  function _refreshChordName(i) {
    const card = document.getElementById(`chord-card-${i}`);
    if (!card) return;
    const chord = editableProgression[i];
    if (!chord) return;
    const divs = card.querySelectorAll('div');
    if (divs[0]) divs[0].textContent = CONFIG.formatChordName(chord.root, chord.type);
    const { notes, ivs } = _chordIntervalRows(chord);
    if (divs[1]) divs[1].textContent = notes.join(' · ');
    if (divs[2]) divs[2].textContent = ivs.join(' · ');
  }

  // ── 코드톤 범례 동적 업데이트 ────────────────────────────────────
  const _SEMI_LABEL = { 0: 'R', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7' };
  const _ROLE_COLOR = ['bg-amber-400', 'bg-lime-400', 'bg-sky-400', 'bg-purple-400'];

  function updateChordLegend(chord) {
    const el = document.getElementById('chord-tone-legend');
    if (!el || !chord) return;
    const ct = CONFIG.CHORD_TYPES.find(c => c.id === chord.type);
    const intervals = ct?.intervals || [0, 4, 7];
    const ri = CONFIG.NOTES.indexOf(chord.root);
    el.innerHTML = intervals.map((iv, i) => {
      const note = CONFIG.NOTES[(ri + iv) % 12];
      const ivLabel = _SEMI_LABEL[iv] || '';
      const color = _ROLE_COLOR[i] || 'bg-gray-400';
      return `<span class="flex items-center gap-1">
        <span class="inline-block w-3 h-3 rounded-full ${color} shrink-0"></span>
        <span class="text-[11px] font-black text-gray-700">${note}</span>
        <span class="text-[10px] text-gray-400">${ivLabel}</span>
      </span>`;
    }).join('');
  }

  // 코드 카드 클릭 시 해당 코드 코드톤 미리보기 (재생 중이 아닐 때)
  function previewChord(i) {
    if (BackingEngine.getIsPlaying()) return;
    const chord = editableProgression[i];
    if (!chord) return;
    _lastStudioChord = chord;
    Fretboard.updateWithChordTones(chord);
    updateChordLegend(chord);
    // 카드 강조
    document.querySelectorAll('.chord-card').forEach((el, idx) => {
      el.style.borderColor = idx === i ? '#FF6B00' : '';
      el.style.boxShadow = idx === i ? '0 0 0 2px #FF6B0066' : '';
    });
  }

  function addChord() {
    editableProgression.push({ root: selectedKey || 'C', type: 'major' });
    renderProgressionEditor();
    updateFretboard();
  }

  function removeChord(i) {
    editableProgression.splice(i, 1);
    renderProgressionEditor();
  }

  function renderScaleRecommend() {
    const el = document.getElementById('backing-scales');
    if (!el || !selectedGenre) return;
    el.innerHTML = selectedGenre.recommendScales.map(s =>
      `<button onclick="StudioUI.setScale('${s}')"
        class="text-xs px-3 py-1 rounded-full bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors">${s}</button>`
    ).join('');
  }

  function setScale(_scaleName) {
    // 스튜디오 지판은 코드톤 모드 고정 — 스케일 변경 무시
  }

  function setKey(key) {
    selectedKey = key;
    // 기존 진행을 새 키로 재계산 (장르 프리셋이 있을 때만)
    if (selectedGenre) {
      editableProgression = selectedGenre.progression.map(p =>
        CONFIG.resolveChord(p.r, p.t, selectedKey)
      );
      renderProgressionEditor();
    }
    updateFretboard();
  }

  function updateFretboard() {
    const chord = _lastStudioChord || editableProgression[0];
    if (chord) {
      _lastStudioChord = chord;
      Fretboard.updateWithChordTones(chord);
      updateChordLegend(chord);
    }
  }

  // ── 백킹 재생/정지 ───────────────────────────────────────────────
  function toggleBacking() {
    if (BackingEngine.getIsPlaying()) {
      BackingEngine.stop();
      updateBackingBtn(false);
    } else {
      if (!selectedGenre && editableProgression.length === 0) {
        showToast('장르를 선택하거나 코드를 추가해주세요!', 'warning');
        return;
      }
      const prog = editableProgression.length > 0
        ? editableProgression
        : [{ root: selectedKey, type: 'major' }];
      BackingEngine.start(prog, selectedGenre?.id || 'blues', _bpm);
      updateBackingBtn(true);

      BackingEngine.onChordChange(idx => highlightChord(idx));
    }
  }

  function updateBackingBtn(_playing) {
    // 별도 backing-play-btn 없음 — studio-play-btn 통합
  }

  // ── 메트로놈 & 백킹 동시 재생 ────────────────────────────────────
  function syncPlay() {
    const metroOn = document.getElementById('toggle-metro')?.checked ?? true;
    const backingOn = document.getElementById('toggle-backing')?.checked ?? true;

    const isAnyPlaying = Metronome.getIsPlaying() || BackingEngine.getIsPlaying();
    if (isAnyPlaying) {
      stopAll(); return;
    }

    if (metroOn) { Metronome.start(); updateMetroBtn(true); }
    if (backingOn) {
      const prog = editableProgression.length > 0 ? editableProgression : [{ root: selectedKey, type: 'major' }];
      BackingEngine.start(prog, selectedGenre?.id || 'blues', _bpm);
      updateBackingBtn(true);
      BackingEngine.onChordChange(idx => highlightChord(idx));
    }

    const btn = document.getElementById('studio-play-btn');
    if (btn) { btn.textContent = '⏹ 정지'; btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'; }
    showToast('🎵 재생 시작!', 'success');
  }


  function stopAll() {
    Metronome.stop(); updateMetroBtn(false);
    BackingEngine.stop();
    const btn = document.getElementById('studio-play-btn');
    if (btn) { btn.textContent = '▶ 재생'; btn.style.background = 'linear-gradient(135deg,#FF6B00,#FF8C42)'; }
    // 지판 코드 강조 해제
    document.querySelectorAll('.chord-card').forEach(el => { el.style.borderColor = ''; el.style.boxShadow = ''; });
  }


  // ── 장르 카드 렌더링 ─────────────────────────────────────────────
  function renderGenreCards() {
    const c = document.getElementById('backing-genres');
    if (!c) return;
    c.innerHTML = CONFIG.BACKING_TRACKS.map(g => {
      const tip = (g.tip || '').replace(/'/g, '&#39;');
      return `
      <button data-genre="${g.id}" onclick="StudioUI.selectGenre('${g.id}')"
        onmouseenter="document.getElementById('backing-tip').textContent='${tip}'"
        onmouseleave="document.getElementById('backing-tip').textContent=''"
        class="genre-card flex items-center gap-1.5 px-2 py-1.5 rounded-lg
          bg-white border border-gray-100 shadow-sm
          hover:border-orange-300 hover:shadow-md
          transition-all hover:scale-105 active:scale-95">
        <span class="text-base shrink-0">${g.emoji}</span>
        <span class="font-bold text-[11px] text-gray-700 leading-tight text-left">${g.name}</span>
      </button>`;
    }).join('');
  }

  // ── 지판 키/스케일 셀렉트 초기화 ────────────────────────────────
  function initSelects() {
    CONFIG.NOTES.forEach(n => {
      const el = document.getElementById('backing-key');
      if (el && !el.querySelector(`option[value="${n}"]`)) {
        const opt = document.createElement('option');
        opt.value = opt.textContent = n;
        if (n === 'A') opt.selected = true;
        el.appendChild(opt);
      }
    });
    const scaleEl = document.getElementById('fretboard-scale');
    if (scaleEl && scaleEl.children.length === 0) {
      Object.keys(CONFIG.SCALES).forEach(s => {
        const opt = document.createElement('option');
        opt.value = opt.textContent = s;
        if (s === 'Minor Pentatonic') opt.selected = true;
        scaleEl.appendChild(opt);
      });
    }
  }

  // ── 페이지 진입 시 초기화 ────────────────────────────────────────
  function onEnter() {
    initSelects();
    renderGenreCards();
    renderBeatPattern();
    // 초기 지판: 진행의 첫 코드 코드톤, 없으면 Am 기본값
    const initChord = editableProgression[0] || { root: 'A', type: 'minor' };
    _lastStudioChord = initChord;
    Fretboard.render('fretboard-svg', {
      startFret: 0, endFret: 12,
      chordNoteMap: Fretboard.buildChordNoteMap(initChord),
      chordRoot: initChord.root,
    });
    updateChordLegend(initChord);

    // Beat 콜백: 현재 박자 버튼 pulse
    Metronome.onBeat((beat, _pattern) => {
      document.querySelectorAll('#beat-pattern-editor button').forEach((btn, i) => {
        if (i === beat) {
          btn.style.transform = 'scale(1.25)';
          btn.style.transition = 'transform 0.05s';
          setTimeout(() => { btn.style.transform = ''; }, 120);
        }
      });
    });
  }

  return {
    // 메트로놈
    setBpm, adjustBpm, toggleMetronome, tapTempo, setMetroVolume,
    setTimeSig, setSubdiv, setSoundType, cycleBeat,
    onMetroToggle, onBackingToggle, setHarmonyBtn,
    // 백킹
    selectGenre, setKey, setScale, toggleBacking, syncPlay, stopAll,
    editChordRoot, editChordType, addChord, removeChord, previewChord,
    // 공통
    onEnter,
  };
})();


// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// ReferenceUI: 참고 자료 탭 관리  (Phase 8 완전 재작성)
// ─ 트라이어드: 실제 지판 스팬 기반 폼 탐색 + 최저음으로 전위 판별
// ─ 펜타토닉: CAGED 루트 오프셋 기반 이동형 박스 알고리즘
// ─ 코드톤: 역할별 고정 색상 전역 렌더링
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// ReferenceUI — Phase 8  (v9 알고리즘 이식 버전)
// ─ 트라이어드 : C 기준 절대 프렛 폼 + semOff 시프트 (dotsForKey 방식)
// ─ 펜타토닉   : 5A줄 루트 기준 PENTA_POS_OFFSETS 이동형 박스
// ─ 코드톤     : 역할별 색상 전역 렌더 (R=빨, 3=초, 5=파, 7=보)
// ═══════════════════════════════════════════════════════════════════════════
const ReferenceUI = (() => {

  // ── 상태 ────────────────────────────────────────────────────────────────
  let activeTab = 'circle';
  let _triadRoot = 'C';
  let _triadType = 'major';   // 'major'|'minor'|'dim'|'aug'
  let _triadVoicing = 'all';     // 'all'|'root'|'1st'|'2nd'
  let _triadStrGroup = '123';     // '123'|'234'|'345'|'456'
  let _pentaPos = 0;         // 0=All, 1~5
  let _pentaKey = 'major';   // 'major'|'minor'
  let _chordToneRoot = 'A';
  let _chordToneType = 'major';
  let _chordToneLabelMode = 'interval'; // 'interval' | 'note'

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

  // ══════════════════════════════════════════════════════════════════════
  // ① 트라이어드 — v9 TRIAD_VOICINGS 이식
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

  // v9 TRIAD_VOICINGS (C 기준 절대 프렛)
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
            { name: '1st Inv', dots: [{ s: 3, f: 1, r: 'b3' }, { s: 2, f: 11, r: 'b5' }, { s: 1, f: 1, r: 'R' }] },
            { name: '2nd Inv', dots: [{ s: 3, f: 4, r: 'b5' }, { s: 2, f: 5, r: 'R' }, { s: 1, f: 4, r: 'b3' }] },
          ]
        },
        {
          strings: [4, 3, 2], vc: [
            { name: 'Root', dots: [{ s: 4, f: 3, r: 'R' }, { s: 3, f: 1, r: 'b3' }, { s: 2, f: 11, r: 'b5' }] },
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

  // 역할 → RiffForge SVG 색상
  const _ROLE_COLORS = {
    'R': { fill: '#ef4444', stroke: '#dc2626', textFill: '#fff' },
    '3': { fill: '#22c55e', stroke: '#16a34a', textFill: '#fff' },
    'b3': { fill: '#22c55e', stroke: '#16a34a', textFill: '#fff' },
    '5': { fill: '#3b82f6', stroke: '#2563eb', textFill: '#fff' },
    'b5': { fill: '#3b82f6', stroke: '#2563eb', textFill: '#fff' },
    '#5': { fill: '#3b82f6', stroke: '#2563eb', textFill: '#fff' },
    '7': { fill: '#a855f7', stroke: '#7c3aed', textFill: '#fff' },
    'b7': { fill: '#a855f7', stroke: '#7c3aed', textFill: '#fff' },
  };

  /**
   * 트라이어드 렌더링
   * - v9 인덱스(s=0→1번줄) → RiffForge sIdx(0→6번줄) 변환: rfSIdx = 5 - v9s
   * - voicing: 'all'이면 3개 지판 모두 표시
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

    // 전위명 매핑
    const INV_NAME_MAP = { 'Root': 'root', '1st Inv': '1st', '2nd Inv': '2nd' };
    const invLabels = {
      root: `Root Position · ${strLabel}번줄`,
      '1st': `1st Inversion · ${strLabel}번줄`,
      '2nd': `2nd Inversion · ${strLabel}번줄`,
    };

    const voicings = [
      { key: 'root', shiftedVc: shifted.find(v => v.name === 'Root') },
      { key: '1st', shiftedVc: shifted.find(v => v.name === '1st Inv') },
      { key: '2nd', shiftedVc: shifted.find(v => v.name === '2nd Inv') },
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
          dotR: r === 'R' ? 11 : 9, label: r, opacity: 1
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
  // ② 펜타토닉 — v9 getPentaPositions 이식
  //    5A줄(si=4, v9기준) 루트 프렛 기준 오프셋으로 박스 계산
  //    단일 지판(0~17) 위에 전체 표시, 선택 박스만 선명
  // ══════════════════════════════════════════════════════════════════════

  const PENTA_INTERVALS = {
    major: [0, 2, 4, 7, 9],   // Major Pentatonic
    minor: [0, 3, 5, 7, 10],  // Minor Pentatonic
  };

  const PENTA_DEGREE_NAMES = {
    major: { 0: 'R', 2: '2', 4: '3', 7: '5', 9: '6' },
    minor: { 0: 'R', 3: 'b3', 5: '4', 7: '5', 10: 'b7' },
  };

  // v9 PENTA_POS_OFFSETS (5A줄 루트 기준 창 시작 오프셋)
  const PENTA_POS_OFFSETS = {
    major: [-1, 2, 4, 6, 9],
    minor: [0, 4, 7, 9, 12],
  };

  const CAGED_NAMES = {
    major: ['A Form — Pos 1', 'E Form — Pos 2', 'C Form — Pos 3', 'D Form — Pos 4', 'G Form — Pos 5'],
    minor: ['Am Form — Pos 1', 'Gm Form — Pos 2', 'Em Form — Pos 3', 'Dm Form — Pos 4', 'Cm Form — Pos 5'],
  };

  const _PENTA_POS_COLORS = [
    null,
    { fill: '#f59e0b', stroke: '#d97706', textFill: '#1c1917' },
    { fill: '#6366f1', stroke: '#4338ca', textFill: '#fff' },
    { fill: '#10b981', stroke: '#047857', textFill: '#fff' },
    { fill: '#f97316', stroke: '#c2410c', textFill: '#fff' },
    { fill: '#ec4899', stroke: '#be185d', textFill: '#fff' },
  ];

  /**
   * v9 getPentaPositions() 이식
   * 반환: [{pos, start, end, notes:[{si(v9), fret, interval}]}]
   */
  function _getPentaPositions(rootNote, mode) {
    const rootSemi = KEY_SEMITONES[rootNote] || 0;
    const intervals = PENTA_INTERVALS[mode];
    // 5A줄(v9 si=4)의 루트 프렛: A=9(MIDI mod12) 기준
    const r5A = (rootSemi - 9 + 12) % 12;
    const offsets = PENTA_POS_OFFSETS[mode];

    return offsets.map((off, pi) => {
      let posStart = r5A + off;
      while (posStart < 0) posStart += 12;
      while (posStart > 12) posStart -= 12;
      const posEnd = posStart + 5;

      const allNotes = [];
      for (let si = 0; si < 6; si++) {
        const found = [];
        for (let f = posStart; f <= Math.min(posEnd, 17); f++) {
          const rel = (V9_OPEN[si] + f - rootSemi + 12) % 12;
          if (intervals.includes(rel)) {
            found.push({ si, fret: f, interval: rel });
            if (found.length === 2) break;
          }
        }
        allNotes.push(...found);
      }

      const frets = allNotes.map(n => n.fret);
      const start = frets.length ? Math.min(...frets) : posStart;
      const end = frets.length ? Math.max(...frets) : posEnd;
      return { pos: pi + 1, start, end, notes: allNotes };
    });
  }

  /**
   * 펜타토닉 단일 지판 렌더 (0~17프렛)
   * - 각 음이 속하는 포지션을 "rfSIdx-fret" → Set<posNum> 으로 기록
   *   (한 음이 인접 박스와 겹쳐도 두 포지션 모두 소유)
   * - 특정 포지션 선택 시: 그 포지션의 Set에 포함된 음만 선명
   * - All(0): 첫 번째 소유 포지션 색상으로 표시
   */
  function renderPentaPositions() {
    const mode = _pentaKey;
    const rootNote = document.getElementById('penta-key-root')?.value || 'A';
    const positions = _getPentaPositions(rootNote, mode);

    // "rfSIdx-fret" → Set<posNum>  (겹침 허용)
    const dotPosSet = new Map();
    positions.forEach(posData => {
      posData.notes.forEach(({ si, fret }) => {
        const k = `${5 - si}-${fret}`;
        if (!dotPosSet.has(k)) dotPosSet.set(k, new Set());
        dotPosSet.get(k).add(posData.pos);
      });
    });

    const scaleName = mode === 'major' ? 'Major Pentatonic' : 'Minor Pentatonic';

    const noteColorFn = (fret, sIdx, note, _role) => {
      const k = `${sIdx}-${fret}`;
      const set = dotPosSet.get(k);
      if (!set || set.size === 0) {
        return { fill: '#d1d5db', stroke: '#9ca3af', textFill: '#9ca3af', dotR: 8, label: note, opacity: 0.15 };
      }

      // 선택 포지션 모드: 해당 포지션 소유 여부로 활성/비활성 판별
      const isActive = _pentaPos === 0 || set.has(_pentaPos);

      // 색상: 선택 포지션이면 그 포지션 색, All이면 가장 낮은 포지션 번호 색
      const displayPos = (_pentaPos !== 0 && set.has(_pentaPos))
        ? _pentaPos
        : Math.min(...set);
      const c = _PENTA_POS_COLORS[displayPos];
      const isRoot = note === rootNote;
      return {
        fill: c.fill, stroke: c.stroke, textFill: c.textFill,
        dotR: isRoot ? 11 : 9,
        label: note,
        opacity: isActive ? 1 : 0.15,
      };
    };

    Fretboard.render('penta-full', {
      rootNote, scaleName,
      startFret: 0, endFret: 17,
      noteColorFn,
    });

    _updatePentaLegend(positions);
  }

  function _updatePentaLegend(positions) {
    const el = document.getElementById('penta-legend-dynamic');
    if (!el) return;
    const colors = ['amber-400', 'indigo-500', 'emerald-500', 'orange-500', 'pink-500'];
    const names = CAGED_NAMES[_pentaKey] || [];
    el.innerHTML = positions.map((b, i) => {
      return `<span class="flex items-center gap-1">
        <span class="w-3 h-3 rounded-full bg-${colors[i]} inline-block"></span>
        <span class="text-xs">${names[i] || 'Pos ' + (i + 1)} (${b.start}~${b.end}fr)</span>
      </span>`;
    }).join('');
  }

  // ══════════════════════════════════════════════════════════════════════
  // ③ 코드톤 — 역할별 색상 전역 렌더링
  // ══════════════════════════════════════════════════════════════════════

  function _buildChordNoteMap(root, type) {
    const ct = CONFIG.CHORD_TYPES.find(c => c.id === type);
    const intervals = ct?.intervals || [0, 4, 7];
    const roles = ['root', 'third', 'fifth', 'seventh'];
    const ri = CONFIG.NOTES.indexOf(root);
    const map = new Map();
    intervals.forEach((iv, i) => map.set(CONFIG.NOTES[(ri + iv) % 12], roles[i]));
    return map;
  }

  const _CT_COLORS = {
    root: { fill: '#ef4444', stroke: '#dc2626', textFill: '#fff' },
    third: { fill: '#22c55e', stroke: '#16a34a', textFill: '#fff' },
    fifth: { fill: '#3b82f6', stroke: '#2563eb', textFill: '#fff' },
    seventh: { fill: '#a855f7', stroke: '#7c3aed', textFill: '#fff' },
  };
  const _CT_LBL = { root: 'R', third: '3', fifth: '5', seventh: '7' };
  const _SEMI_LBL = { 0: 'R', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7' };

  function renderChordToneRef() {
    const map = _buildChordNoteMap(_chordToneRoot, _chordToneType);
    const showNote = _chordToneLabelMode === 'note';

    const noteColorFn = (fret, sIdx, note, role) => {
      const c = _CT_COLORS[role];
      if (!c) return null;
      return {
        fill: c.fill, stroke: c.stroke, textFill: c.textFill,
        dotR: role === 'root' ? 11 : 9,
        label: showNote ? note : (_CT_LBL[role] || note), opacity: 1
      };
    };

    Fretboard.render('ref-chord-tone-svg', {
      startFret: 0, endFret: 17, chordNoteMap: map,
      chordRoot: _chordToneRoot, noteColorFn, labelMode: 'note',
    });

    const legend = document.getElementById('ref-chord-tone-legend');
    if (legend) {
      const ct = CONFIG.CHORD_TYPES.find(c => c.id === _chordToneType);
      const intervals = ct?.intervals || [0, 4, 7];
      const ri = CONFIG.NOTES.indexOf(_chordToneRoot);
      const roleColors = ['bg-red-500', 'bg-green-500', 'bg-blue-500', 'bg-purple-500'];
      legend.innerHTML = intervals.map((iv, i) => {
        const note = CONFIG.NOTES[(ri + iv) % 12];
        return `<span class="flex items-center gap-1">
          <span class="inline-block w-3 h-3 rounded-full ${roleColors[i] || 'bg-gray-400'} shrink-0"></span>
          <span class="text-[11px] font-black text-gray-700">${note}</span>
          <span class="text-[10px] text-gray-400">${_SEMI_LBL[iv] || ''}</span>
        </span>`;
      }).join('');
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // 스케일 탭 (기존 유지)
  // ══════════════════════════════════════════════════════════════════════

  const SCALE_INFO = {
    'Minor Pentatonic': { mood: '어둡고 강렬한 느낌', genres: 'Blues, Rock, Metal', notes: '♭3, ♭7이 특징적인 마이너 감성', tip: '기타 솔로의 기본 — 5음만으로 강력한 표현 가능' },
    'Major Pentatonic': { mood: '밝고 경쾌한 느낌', genres: 'Country, Pop, J-Pop', notes: '4도·7도 없이 깨끗하고 클린한 톤', tip: '컨트리 밴딩·슬라이드에 특히 어울림' },
    'Natural Minor': { mood: '서정적이고 우울한 감성', genres: 'Rock, Metal, Classical', notes: '♭3, ♭6, ♭7이 마이너 색채 결정', tip: 'Aeolian 모드' },
    'Major': { mood: '밝고 행복한 느낌', genres: 'Pop, Country, J-Pop, Classical', notes: '온음계 기반', tip: 'Ionian 모드' },
    'Dorian': { mood: '마이너이지만 밝고 그루비함', genres: 'Jazz, Funk, Soul', notes: '♭3·♭7 있지만 6도가 장음정', tip: 'Santana, Knopfler 스타일' },
    'Mixolydian': { mood: '밝지만 해결 안 된 긴장감', genres: 'Blues, Rock, Country', notes: '장음계에서 7도만 ♭', tip: '"Sweet Home Alabama" 스타일' },
    'Phrygian': { mood: '어둡고 신비로운 스페인 느낌', genres: 'Flamenco, Metal', notes: '2도가 ♭', tip: 'Metallica 헤비 솔로' },
    'Lydian': { mood: '몽환적이고 밝은 드림 감성', genres: 'Film Music, Dream Pop', notes: '4도가 #', tip: 'Joe Satriani 스타일' },
    'Blues': { mood: '소울풀하고 감성적인 블루스', genres: 'Blues, Rock, R&B', notes: '♭5 블루 노트', tip: '마이너 펜타토닉 + ♭5' },
  };

  let _scalePos = 0;

  function updateScaleInfo(scaleName) {
    const el = document.getElementById('ref-scale-info');
    if (!el) return;
    const info = SCALE_INFO[scaleName];
    if (!info) { el.classList.add('hidden'); return; }
    el.classList.remove('hidden');
    el.innerHTML = `<div class="flex flex-wrap gap-x-5 gap-y-1 mb-1">
      <span><strong class="text-amber-700">분위기:</strong> ${info.mood}</span>
      <span><strong class="text-amber-700">장르:</strong> ${info.genres}</span>
      <span><strong class="text-amber-700">특징:</strong> ${info.notes}</span>
    </div><p class="text-amber-600 font-medium">💡 ${info.tip}</p>`;
  }

  function onScaleChange(scaleName) {
    Fretboard.updateRef({ scaleName });
    updateScaleInfo(scaleName);
  }

  function setCagedPos(pos) {
    _scalePos = pos;
    document.querySelectorAll('.caged-pos-btn').forEach(btn => {
      const on = parseInt(btn.dataset.caged) === pos;
      btn.classList.toggle('bg-amber-500', on); btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-gray-600', !on);
      btn.classList.toggle('border', !on);
    });
    const scaleName = document.getElementById('ref-fretboard-scale')?.value || 'Minor Pentatonic';
    const rootNote = document.getElementById('ref-fretboard-key')?.value || 'A';
    if (!pos) { Fretboard.updateRef({ startFret: 0, endFret: 17, scaleName, rootNote, noteColorFn: null }); return; }

    // CAGED 박스: 펜타 포지션 계산을 재활용
    const pentaMode = scaleName.includes('Major') ? 'major' : 'minor';
    const positions = _getPentaPositions(rootNote, pentaMode);
    const box = positions.find(b => b.pos === pos);

    const noteColorFn = (fret, sIdx, note, _role) => {
      const inZone = box ? (fret >= box.start && fret <= box.end) : false;
      const isRoot = note === rootNote;
      return {
        fill: inZone ? (isRoot ? '#f59e0b' : '#fb923c') : '#d1d5db',
        stroke: inZone ? (isRoot ? '#d97706' : '#ea580c') : '#9ca3af',
        textFill: inZone ? '#fff' : '#9ca3af',
        dotR: inZone && isRoot ? 11 : 8,
        opacity: inZone ? 1 : 0.18, label: note,
      };
    };
    Fretboard.updateRef({ startFret: 0, endFret: 17, scaleName, rootNote, noteColorFn });
  }

  function setLabelMode(mode) {
    document.querySelectorAll('.label-mode-btn').forEach(btn => {
      const on = btn.dataset.label === mode;
      btn.classList.toggle('bg-amber-500', on); btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-gray-600', !on);
      btn.classList.toggle('border', !on);
    });
    Fretboard.updateRef({ labelMode: mode });
  }

  // ══════════════════════════════════════════════════════════════════════
  // 탭 전환 & 진입
  // ══════════════════════════════════════════════════════════════════════

  function onEnter() { switchTab(activeTab); }

  function switchTab(tabId) {
    activeTab = tabId;
    document.querySelectorAll('.ref-tab-btn').forEach(btn => {
      const on = btn.dataset.tab === tabId;
      btn.classList.toggle('bg-amber-500', on); btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-gray-600', !on);
    });
    document.querySelectorAll('.ref-tab-panel').forEach(p =>
      p.classList.toggle('hidden', p.dataset.panel !== tabId));
    if (tabId === 'scale') setTimeout(() => {
      Fretboard.updateRef({});
      const sel = document.getElementById('ref-fretboard-scale');
      if (sel) updateScaleInfo(sel.value);
    }, 80);
    if (tabId === 'penta') setTimeout(() => renderPentaPositions(), 50);
    if (tabId === 'triad') setTimeout(() => {
      _ensureTriadRootSelect();
      renderTriadDiagram();
    }, 50);
    if (tabId === 'chord') setTimeout(() => {
      _initChordToneRootSelect();
      renderChordToneRef();
    }, 50);
  }

  // ══════════════════════════════════════════════════════════════════════
  // UI 컨트롤
  // ══════════════════════════════════════════════════════════════════════

  function setTriadVoicing(v) {
    _triadVoicing = v;
    const VCOLS = { all: 'bg-gray-700', root: 'bg-red-500', '1st': 'bg-green-600', '2nd': 'bg-blue-500' };
    document.querySelectorAll('.voicing-btn').forEach(btn => {
      const on = btn.dataset.voicing === v;
      const col = VCOLS[btn.dataset.voicing] || 'bg-amber-500';
      btn.className = `voicing-btn text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${on ? `${col} text-white border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`;
    });
    renderTriadDiagram();
  }

  function setTriadStringGroup(g) {
    _triadStrGroup = g;
    document.querySelectorAll('.strgrp-btn').forEach(btn => {
      const on = btn.dataset.strgrp === g;
      btn.classList.toggle('bg-indigo-500', on); btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-gray-600', !on);
    });
    renderTriadDiagram();
  }

  function setTriadRoot(root) { _triadRoot = root; renderTriadDiagram(); }

  function setTriadType(type) {
    _triadType = type;
    document.querySelectorAll('.triad-type-btn').forEach(btn => {
      const on = btn.dataset.ttype === type;
      btn.classList.toggle('bg-amber-500', on); btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-gray-600', !on);
      btn.classList.toggle('border', !on);
    });
    renderTriadDiagram();
  }

  function setPentaPos(pos) {
    _pentaPos = pos;
    const BTN_BG = ['bg-gray-700', 'bg-amber-400', 'bg-indigo-500', 'bg-emerald-500', 'bg-orange-500', 'bg-pink-500'];
    document.querySelectorAll('.penta-pos-btn').forEach(btn => {
      const p = parseInt(btn.dataset.pos), on = p === pos;
      btn.className = `penta-pos-btn text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${on ? `${BTN_BG[p]} text-white border-transparent` : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`;
    });
    renderPentaPositions();
  }

  function setPentaKey(key) {
    _pentaKey = key;
    document.querySelectorAll('.penta-key-btn').forEach(btn => {
      const on = btn.dataset.key === key;
      btn.classList.toggle('bg-amber-500', on); btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-gray-600', !on);
    });
    renderPentaPositions();
  }

  function _initChordToneRootSelect() {
    const sel = document.getElementById('chord-tone-ref-root');
    if (!sel || sel.children.length > 0) return;
    CONFIG.NOTES.forEach(n => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = n;
      if (n === 'A') opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function _ensureTriadRootSelect() {
    const sel = document.getElementById('triad-root-select');
    if (!sel || sel.children.length > 0) return;
    ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'].forEach(n => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = n;
      if (n === _triadRoot) opt.selected = true;
      sel.appendChild(opt);
    });
  }

  function setChordToneRoot(root) { _chordToneRoot = root; renderChordToneRef(); }

  function setChordToneLabelMode(mode) {
    _chordToneLabelMode = mode;
    document.querySelectorAll('.ct-label-btn').forEach(btn => {
      const on = btn.dataset.ctlabel === mode;
      btn.classList.toggle('bg-amber-500', on);
      btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on);
      btn.classList.toggle('text-gray-500', !on);
    });
    renderChordToneRef();
  }

  function setChordToneType(type) {
    _chordToneType = type;
    document.querySelectorAll('.chord-type-ref-btn').forEach(btn => {
      const on = btn.dataset.ctype === type;
      btn.classList.toggle('bg-amber-500', on); btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-gray-600', !on);
    });
    renderChordToneRef();
  }

  // ── Public API ──────────────────────────────────────────────────────────
  return {
    onEnter, switchTab,
    renderPentaPositions, renderTriadDiagram, renderChordToneRef,
    setTriadRoot, setTriadType, setTriadVoicing, setTriadStringGroup,
    setPentaPos, setPentaKey,
    setCagedPos, setLabelMode, onScaleChange,
    setChordToneRoot, setChordToneType, setChordToneLabelMode,
  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// CrewBoard: 크루 게시판 (JSONBin 실시간 연동 + 댓글 수정/삭제)
// ═══════════════════════════════════════════════════════════════════════════
const CrewBoard = (() => {
  const LOCAL_KEY = CONFIG.KEYS.BOARD_POSTS;
  let sortMode = 'latest';


  let _unsubscribeBoard = null; // 실시간 구독 해제 함수

  async function _fetchPosts() {
    try {
      return await FireDB.fetchPosts();
    } catch (e) {
      console.warn('[CrewBoard] fetch 실패, 로컬 캐시 사용');
      return _getLocal();
    }
  }

  async function _savePosts(posts) {
    _setLocal(posts); // 낙관적 업데이트
    // 개별 문서 단위로 저장 (Firestore는 전체 배열 덮어쓰기가 아님)
  }

  // ── 로컬 캐시 헬퍼 ──────────────────────────────────────────────────────
  function _getLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || []; } catch { return []; }
  }
  function _setLocal(posts) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(posts)); } catch { }
  }

  function _newId() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  // ── 상대 시간 ────────────────────────────────────────────────────────────
  function _relTime(isoStr) {
    const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
    if (diff < 60) return '방금 전';
    if (diff < 3600) return Math.floor(diff / 60) + '분 전';
    if (diff < 86400) return Math.floor(diff / 3600) + '시간 전';
    return Math.floor(diff / 86400) + '일 전';
  }
  function _confirmDialog(title, message) {
    return new Promise(resolve => {
      const overlay = document.createElement('div');
      overlay.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm';
      overlay.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-80 mx-4 p-6 animate-fade-in">
        <div class="text-2xl mb-2 text-center">${title.split(' ')[0]}</div>
        <h3 class="text-base font-black text-gray-800 text-center mb-1">${title.split(' ').slice(1).join(' ')}</h3>
        <p class="text-sm text-gray-500 text-center mb-6">${message}</p>
        <div class="flex gap-3">
          <button id="_cfm-cancel"
            class="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-600 font-bold text-sm hover:bg-gray-200 transition-colors">
            취소
          </button>
          <button id="_cfm-ok"
            class="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 transition-colors">
            삭제
          </button>
        </div>
      </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#_cfm-cancel').onclick = () => { overlay.remove(); resolve(false); };
      overlay.querySelector('#_cfm-ok').onclick = () => { overlay.remove(); resolve(true); };
      overlay.onclick = e => { if (e.target === overlay) { overlay.remove(); resolve(false); } };
    });
  }
  // ── 정렬 ─────────────────────────────────────────────────────────────────
  function setSortMode(mode) {
    sortMode = mode;
    ['latest', 'popular'].forEach(m => {
      const btn = document.getElementById(`sort-${m}`);
      if (!btn) return;
      btn.classList.toggle('bg-amber-500', m === mode);
      btn.classList.toggle('text-white', m === mode);
      btn.classList.toggle('bg-gray-100', m !== mode);
      btn.classList.toggle('text-gray-500', m !== mode);
    });
    render();
  }

  function _sorted(posts) {
    const arr = [...posts];
    return sortMode === 'popular'
      ? arr.sort((a, b) => b.likes.length - a.likes.length)
      : arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // ── 연습 인증 텍스트 빌더 ────────────────────────────────────────────────
  function _buildPracticeSummary() {
    const log = Storage.getLog(getTodayStr());
    if (!log || !log.totalMin) return null;
    const lines = [`⏱️ 오늘 연습 시간: ${log.totalMin}분`];
    if (log.sessions?.length)
      lines.push(`🎯 연습 항목:\n${log.sessions.map(s =>
        `  • ${s.name || s.type || '세션'}${s.bpm ? ` BPM ${s.bpm}` : ''}${s.memo ? ` — ${s.memo}` : ''}`
      ).join('\n')}`);
    if (log.goal) lines.push(`📌 목표: ${log.goal}`);
    if (log.achievement) lines.push(`✅ 성취: ${log.achievement}`);
    if (log.note) lines.push(`📝 메모: ${log.note}`);
    return lines.join('\n');
  }

  // ── 글 쓰기 ──────────────────────────────────────────────────────────────
  async function addPost() {
    const ta = document.getElementById('board-post-input');
    const content = ta?.value.trim();
    if (!content) { showToast('내용을 입력해 주세요.', 'warning'); return; }

    const todayMin = AppState.getTodayMin();
    const summary = _buildPracticeSummary();
    const post = {
      id: _newId(),
      authorId: AppState.getUserId(),
      authorName: Storage.get(CONFIG.KEYS.USERNAME, '') || '익명',
      authorAvatar: Storage.get(CONFIG.KEYS.AVATAR, '🎸'),
      content: summary
        ? `${content}\n\n━━ 📋 오늘의 연습 인증 ━━\n${summary}`
        : content,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
      badge: todayMin >= 30 ? `오늘 ${todayMin}분 연습 완료 🔥` : null,
    };

    if (ta) { ta.value = ''; _updateCharCount(''); }
    await FireDB.savePost(post);
    showToast('게시글이 등록됐습니다 📝', 'success');
  }

  // ── 좋아요 ───────────────────────────────────────────────────────────────
  async function toggleLike(postId) {
    const myId = AppState.getUserId();
    const posts = _getLocal();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const idx = post.likes.indexOf(myId);
    if (idx === -1) post.likes.push(myId);
    else post.likes.splice(idx, 1);
    render(posts);
    await FireDB.updatePost(postId, { likes: post.likes });
  }

  // ── 댓글 추가 ─────────────────────────────────────────────────────────────
  async function addComment(postId, inputId) {
    const input = document.getElementById(inputId);
    const content = input?.value.trim();
    if (!content) return;
    const comment = {
      id: _newId(),
      authorId: AppState.getUserId(),
      authorName: Storage.get(CONFIG.KEYS.USERNAME, '') || '익명',
      authorAvatar: Storage.get(CONFIG.KEYS.AVATAR, '🎸'),
      content,
      createdAt: new Date().toISOString(),
    };
    if (input) input.value = '';
    const posts = _getLocal();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    post.comments.push(comment);
    render(posts);
    await FireDB.updatePost(postId, { comments: post.comments });
  }

  async function quickReact(postId, emoji) {
    const comment = {
      id: _newId(),
      authorId: AppState.getUserId(),
      authorName: Storage.get(CONFIG.KEYS.USERNAME, '') || '익명',
      authorAvatar: Storage.get(CONFIG.KEYS.AVATAR, '🎸'),
      content: emoji,
      createdAt: new Date().toISOString(),
    };
    const posts = _getLocal();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    post.comments.push(comment);
    render(posts);
    await FireDB.updatePost(postId, { comments: post.comments });
  }

  // ── 댓글 삭제 ────────────────────────────────────────────────────────────
  async function deleteComment(postId, commentId) {
    if (!await _confirmDialog('🗑️ 댓글 삭제', '이 댓글을 정말 삭제할까요?')) return;
    const posts = _getLocal();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    post.comments = post.comments.filter(c => c.id !== commentId);
    render(posts);
    await FireDB.updatePost(postId, { comments: post.comments });
    showToast('댓글이 삭제됐습니다.', 'info');
  }
  // ── 댓글 수정 (인라인 textarea) ──────────────────────────────────────────
  function startEditComment(postId, commentId) {
    const el = document.getElementById(`comment-${commentId}`);
    if (!el) return;
    const posts = _getLocal();
    const post = posts.find(p => p.id === postId);
    const comment = post?.comments.find(c => c.id === commentId);
    if (!comment) return;

    const bodyEl = el.querySelector('.comment-body');
    const actionsEl = el.querySelector('.comment-actions');
    if (!bodyEl) return;

    bodyEl.outerHTML = `
      <textarea id="edit-comment-ta-${commentId}" rows="2" maxlength="100"
        class="flex-1 text-xs border border-amber-300 rounded-lg px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-amber-200 w-full mt-1"
      >${comment.content}</textarea>
      <div class="flex gap-1 mt-1">
        <button onclick="CrewBoard.cancelEditComment('${postId}')"
          class="text-[10px] px-2 py-1 bg-gray-100 text-gray-500 font-bold rounded-lg hover:bg-gray-200 transition-colors">취소</button>
        <button onclick="CrewBoard.saveEditComment('${postId}', '${commentId}')"
          class="text-[10px] px-2 py-1 bg-amber-500 text-white font-bold rounded-lg hover:bg-amber-600 transition-colors">저장</button>
      </div>`;
    if (actionsEl) actionsEl.classList.add('hidden');
  }

  async function saveEditComment(postId, commentId) {
    const ta = document.getElementById(`edit-comment-ta-${commentId}`);
    const content = ta?.value.trim();
    if (!content) { showToast('내용을 입력해 주세요.', 'warning'); return; }
    const posts = _getLocal();
    const post = posts.find(p => p.id === postId);
    const comment = post?.comments.find(c => c.id === commentId);
    if (!comment) return;
    comment.content = content;
    comment.editedAt = new Date().toISOString();
    render(posts);
    await FireDB.updatePost(postId, { comments: post.comments });
    showToast('댓글이 수정됐습니다 ✅', 'success');
  }

  function cancelEditComment(postId) { render(); }

  // ── 게시글 수정 / 삭제 ───────────────────────────────────────────────────
  async function deletePost(postId) {
    if (!await _confirmDialog('🗑️ 게시글 삭제', '이 글을 정말 삭제할까요?')) return;
    const posts = _getLocal().filter(p => p.id !== postId);
    render(posts);
    await FireDB.deletePost(postId);
    showToast('글이 삭제됐습니다.', 'info');
  }

  function startEdit(postId) {
    const card = document.getElementById(`post-card-${postId}`);
    if (!card) return;
    const post = _getLocal().find(p => p.id === postId);
    if (!post) return;
    const bodyEl = card.querySelector('.post-body');
    if (!bodyEl) return;
    bodyEl.outerHTML = `
      <textarea id="edit-ta-${postId}" rows="4" maxlength="300"
        class="w-full text-sm border border-amber-300 rounded-xl px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-amber-200 mb-2"
      >${post.content}</textarea>
      <div class="flex justify-end gap-2 mb-2">
        <button onclick="CrewBoard.cancelEdit()"
          class="text-xs px-3 py-1.5 bg-gray-100 text-gray-500 font-bold rounded-xl hover:bg-gray-200 transition-colors">취소</button>
        <button onclick="CrewBoard.saveEdit('${postId}')"
          class="text-xs px-3 py-1.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors">저장</button>
      </div>`;
  }

  async function saveEdit(postId) {
    const ta = document.getElementById(`edit-ta-${postId}`);
    const content = ta?.value.trim();
    if (!content) { showToast('내용을 입력해 주세요.', 'warning'); return; }
    const posts = _getLocal();
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    post.content = content;
    post.editedAt = new Date().toISOString();
    render(posts);
    await FireDB.updatePost(postId, { content: post.content, editedAt: post.editedAt });
    showToast('글이 수정됐습니다 ✅', 'success');
  }


  function cancelEdit() { render(); }

  function previewPractice() {
    const summary = _buildPracticeSummary();
    if (!summary) { showToast('오늘 저장된 연습 기록이 없어요.', 'warning'); return; }
    showToast('글 등록 시 연습 인증이 자동 첨부됩니다 ✅', 'success');
  }

  // ── 피드 헤더 동기화 ─────────────────────────────────────────────────────
  function refreshMyInfo() {
    const avatar = Storage.get(CONFIG.KEYS.AVATAR, '🎸');
    const name = Storage.get(CONFIG.KEYS.USERNAME, '') || '나';
    const el1 = document.getElementById('board-my-avatar');
    const el2 = document.getElementById('board-my-name');
    if (el1) el1.textContent = avatar;
    if (el2) el2.textContent = name;
  }

  function _updateCharCount(val) {
    const el = document.getElementById('board-char-count');
    if (el) el.textContent = `${val.length} / 300`;
  }

  // ── 렌더링 ───────────────────────────────────────────────────────────────
  function render(postsOverride) {
    const feed = document.getElementById('board-feed');
    if (!feed) return;

    refreshMyInfo();

    const ta = document.getElementById('board-post-input');
    if (ta && !ta.dataset.bound) {
      ta.addEventListener('input', () => _updateCharCount(ta.value));
      ta.dataset.bound = '1';
    }
    const badge = document.getElementById('board-practice-badge');
    if (badge) {
      badge.classList.toggle('hidden', !Storage.getLog(getTodayStr())?.totalMin);
    }

    const myId = AppState.getUserId();
    const myName = Storage.get(CONFIG.KEYS.USERNAME, '').trim();
    const raw = postsOverride || _getLocal();
    const posts = _sorted(raw.filter(p => p.id && p.id !== 'init' && Array.isArray(p.likes)));

    if (posts.length === 0) {
      feed.innerHTML = `
        <div class="text-center py-12 text-gray-300">
          <div class="text-5xl mb-3">🎸</div>
          <p class="text-sm font-bold">아직 게시글이 없어요.</p>
          <p class="text-xs mt-1">첫 번째 글을 남겨 크루를 응원해 보세요!</p>
        </div>`;
      return;
    }

    feed.innerHTML = posts.map(p => {
      const liked = p.likes.includes(myId);
      const inputId = `ci-${p.id.slice(0, 8)}`;
      // 게시글 작성자 판단: authorId 일치 또는 닉네임 일치 (이름 기반 구분 지원)
      const isMe = p.authorId === myId || (myName && p.authorName === myName);

      const commentsHtml = p.comments.length ? `
        <div class="mt-3 space-y-1.5">
          ${p.comments.map(c => {
        // 댓글 작성자 판단: id 일치 또는 닉네임 일치
        const isMyComment = c.authorId === myId || (myName && c.authorName === myName);
        return `
            <div id="comment-${c.id}" class="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2">
              <span class="text-base leading-none mt-0.5 shrink-0">${c.authorAvatar}</span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-1">
                  <span class="text-xs font-bold text-gray-700">${c.authorName}</span>
                  <span class="text-xs text-gray-300">${_relTime(c.createdAt)}${c.editedAt ? ' · 수정됨' : ''}</span>
                </div>
                <p class="comment-body text-xs text-gray-600 break-all mt-0.5">${c.content}</p>
              </div>
              ${isMyComment ? `
                <div class="comment-actions flex gap-1 shrink-0 mt-0.5">
                  <button onclick="CrewBoard.startEditComment('${p.id}', '${c.id}')"
                    class="text-[10px] text-gray-300 hover:text-amber-500 px-1 py-0.5 rounded hover:bg-amber-50 transition-colors"
                    title="수정">✏️</button>
                  <button onclick="CrewBoard.deleteComment('${p.id}', '${c.id}')"
                    class="text-[10px] text-gray-300 hover:text-red-400 px-1 py-0.5 rounded hover:bg-red-50 transition-colors"
                    title="삭제">🗑️</button>
                </div>` : ''}
            </div>`;
      }).join('')}
        </div>` : '';

      return `
        <div id="post-card-${p.id}" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div class="flex items-center gap-3 mb-3">
            <span class="text-2xl leading-none">${p.authorAvatar}</span>
            <div class="flex-1 min-w-0">
              <p class="font-bold text-gray-800 text-sm">${p.authorName}</p>
              <p class="text-xs text-gray-400">${_relTime(p.createdAt)}${p.editedAt ? ' · 수정됨' : ''}</p>
            </div>
            ${p.badge ? `<span class="shrink-0 text-xs bg-orange-50 text-orange-500 font-bold px-2 py-0.5 rounded-full">🔥 ${p.badge}</span>` : ''}
            ${isMe ? `
            <div class="flex gap-1 shrink-0">
              <button onclick="CrewBoard.startEdit('${p.id}')"
                class="text-xs text-gray-400 hover:text-amber-500 px-1.5 py-0.5 rounded-lg hover:bg-amber-50 transition-colors">✏️</button>
              <button onclick="CrewBoard.deletePost('${p.id}')"
                class="text-xs text-gray-400 hover:text-red-400 px-1.5 py-0.5 rounded-lg hover:bg-red-50 transition-colors">🗑️</button>
            </div>` : ''}
          </div>
          <p class="post-body text-sm text-gray-700 leading-relaxed mb-3 whitespace-pre-wrap break-all">${p.content}</p>
          <div class="flex items-center gap-3 border-t border-gray-50 pt-3 mb-3">
            <button onclick="CrewBoard.toggleLike('${p.id}')"
              class="flex items-center gap-1 text-xs font-bold transition-colors ${liked ? 'text-red-400' : 'text-gray-400 hover:text-red-400'}">
              ${liked ? '❤️' : '🤍'} <span>${p.likes.length}</span>
            </button>
            <span class="text-xs text-gray-200">│</span>
            <span class="text-xs text-gray-400">💬 ${p.comments.length}</span>
          </div>
          ${commentsHtml}
          <div class="flex gap-1.5 mt-3">
            <input id="${inputId}" type="text" maxlength="100" placeholder="응원 한마디... (100자)"
              class="flex-1 text-xs border border-gray-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-300 transition-all min-w-0"
              onkeydown="if(event.key==='Enter') CrewBoard.addComment('${p.id}','${inputId}')" />
            <button onclick="CrewBoard.quickReact('${p.id}','👍')" class="text-base hover:scale-125 transition-transform">👍</button>
            <button onclick="CrewBoard.quickReact('${p.id}','🔥')" class="text-base hover:scale-125 transition-transform">🔥</button>
            <button onclick="CrewBoard.quickReact('${p.id}','🎵')" class="text-base hover:scale-125 transition-transform">🎵</button>
            <button onclick="CrewBoard.addComment('${p.id}','${inputId}')"
              class="shrink-0 text-xs px-3 py-1.5 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors">전송</button>
          </div>
        </div>`;
    }).join('');
  }

  // ── 최초 로드 ────────────────────────────────────────────────────────────
  async function init() {
    render(_getLocal()); // 로컬 캐시 즉시 렌더
    FireDB.onReady(() => {
      // 실시간 구독 시작 (30초 폴링 완전 대체)
      _unsubscribeBoard = FireDB.subscribeBoard(posts => {
        _setLocal(posts);
        render(posts);
      });
    });
  }

  // ── 30초마다 자동 폴링 ───────────────────────────────────────────────────
  function startPolling() {
    // Firestore 실시간 구독으로 대체 — 폴링 불필요
  }

  return {
    init, render, refreshMyInfo, startPolling,
    addPost, toggleLike, addComment, quickReact,
    setSortMode, deletePost, startEdit, saveEdit, cancelEdit,
    deleteComment, startEditComment, saveEditComment, cancelEditComment,
    previewPractice,
  };
})();
// ═══════════════════════════════════════════════════════════════════════════
// DOMContentLoaded: 앱 초기화
// ═══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  AppState.loadAll();
  AppSidebar.init();
  Pomodoro.init();
  AppState.renderDashboard();
  CalendarView.render();
  PracticeBuilder.init();
  AppState.renderTreeGarden();
  CrewBoard.init();
  CrewBoard.startPolling();

  // 나무 정원 로드맵
  const roadmap = document.getElementById('tree-roadmap');
  if (roadmap) {
    roadmap.innerHTML = CONFIG.TREE_STAGES.map(s => `
      <div class="flex items-center gap-3 py-1">
        <span class="text-xl">${s.emoji}</span>
        <div class="flex-1">
          <span class="text-sm font-semibold text-gray-700">${s.name}</span>
          <span class="text-xs text-gray-400 ml-2">${s.min === 0 ? '0회' : s.max === Infinity ? `${s.min}회+` : `${s.min}~${s.max}회`
      }</span>
        </div>
        <span class="text-xs text-gray-400">${s.desc}</span>
      </div>`
    ).join('');
  }

  // 1초마다 헤더 통계 동기화
  setInterval(() => AppState.renderStats(), 1000);
});