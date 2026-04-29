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

function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function _renderAvatarHtml(val, cls) {
  return (val && (val.startsWith('assets/') || val.startsWith('http')))
    ? `<img src="${val}" class="${cls || 'w-6 h-6'} object-contain rounded" alt="avatar">`
    : `<span>${val || '🎸'}</span>`;
}

function getSeasonInfo() {
  const [ay, am, ad] = CONFIG.SEASON_ANCHOR.split('-').map(Number);
  const anchor = new Date(ay, am - 1, ad);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysSince = Math.floor((today - anchor) / 86400000);
  const idx = Math.max(0, Math.floor(daysSince / 14));
  const start = new Date(anchor);
  start.setDate(anchor.getDate() + idx * 14);
  const end = new Date(start);
  end.setDate(start.getDate() + 13); // 해당 시즌 마지막 날 (일요일)
  const y = start.getFullYear();
  const mm = String(start.getMonth() + 1).padStart(2, '0');
  const dd = String(start.getDate()).padStart(2, '0');
  const seasonKey = `${y}-S${mm}${dd}`;
  const daysLeft = Math.floor((end - today) / 86400000);
  return { seasonKey, start, end, daysLeft };
}

// ═══════════════════════════════════════════════════════════════════════════
// AppState: 전역 상태 관리
// ═══════════════════════════════════════════════════════════════════════════
const AppState = (() => {
  let xp = 0, water = 0, streak = 0, lastPracticeDate = '';
  let weeklyXp = [0, 0, 0, 0, 0, 0, 0];
  let weeklyMin = [0, 0, 0, 0, 0, 0, 0];
  let totalMin = 0;
  let seasonXp = 0, seasonWater = 0, seasonMin = 0; 
function _getWeekKey() {
  const d = new Date();
  const day = d.getDay(); // 0=일, 1=월 ... 6=토
  const diff = (day === 0) ? -6 : 1 - day; // 이번 주 월요일까지의 차이
  const mon = new Date(d);
  mon.setDate(d.getDate() + diff);
  return `${mon.getFullYear()}-${String(mon.getMonth()+1).padStart(2,'0')}-${String(mon.getDate()).padStart(2,'0')}`;
}
  async function loadAll() {
    xp = Storage.get(CONFIG.KEYS.XP, 0);
    water = Storage.get(CONFIG.KEYS.WATER, 0);
    streak = Storage.get(CONFIG.KEYS.STREAK, 0);
    lastPracticeDate = Storage.get(CONFIG.KEYS.LAST_PRACTICE_DATE, '');
    weeklyXp = Storage.get(CONFIG.KEYS.WEEKLY_XP, [0, 0, 0, 0, 0, 0, 0]);
weeklyMin = Storage.get(CONFIG.KEYS.WEEKLY_MIN, [0, 0, 0, 0, 0, 0, 0]);
totalMin = Storage.get(CONFIG.KEYS.TOTAL_MIN, 0);
// 주간 초기화 (월요일 기준)
const currentWeekKey = _getWeekKey();
const storedWeekKey = Storage.get('rf_week_key', '');
if (storedWeekKey !== currentWeekKey) {
  weeklyXp = [0, 0, 0, 0, 0, 0, 0];
  weeklyMin = [0, 0, 0, 0, 0, 0, 0];
  Storage.set(CONFIG.KEYS.WEEKLY_XP, weeklyXp);
  Storage.set(CONFIG.KEYS.WEEKLY_MIN, weeklyMin);
  Storage.set('rf_week_key', currentWeekKey);
}
    applyTheme(Storage.get(CONFIG.KEYS.THEME, 'amber'));
    streak = recalcStreak();

    // 시즌 처리
    const { seasonKey } = getSeasonInfo();
    const storedSeasonKey = Storage.get('rf_season_key', '');
    const prevSeasonKey = (storedSeasonKey && storedSeasonKey !== seasonKey) ? storedSeasonKey : null;
    if (storedSeasonKey !== seasonKey) {
      seasonXp = 0; seasonWater = 0; seasonMin = 0;
      Storage.set('rf_season_xp', 0);
      Storage.set('rf_season_water', 0);
      Storage.set('rf_season_min', 0);
      Storage.set('rf_season_key', seasonKey);
    } else {
      seasonXp = Storage.get('rf_season_xp', 0);
      seasonWater = Storage.get('rf_season_water', 0);
      seasonMin = Storage.get('rf_season_min', 0);
    }


    if (typeof FireDB !== 'undefined') {
      FireDB.onReady(async () => {
        // 이전 시즌 보상 처리
        if (prevSeasonKey) await _handleSeasonReset(prevSeasonKey);

                const profile = await FireDB.loadProfile();
        if (profile) {
          if ((profile.xp || 0) > xp) { xp = profile.xp; Storage.set(CONFIG.KEYS.XP, xp); }
          if ((profile.water || 0) > water) { water = profile.water; Storage.set(CONFIG.KEYS.WATER, water); }
          if (profile.totalMin > totalMin) { totalMin = profile.totalMin; Storage.set(CONFIG.KEYS.TOTAL_MIN, totalMin); }
if (profile.weeklyMin && profile.weekKey === _getWeekKey()) { weeklyMin = profile.weeklyMin; Storage.set(CONFIG.KEYS.WEEKLY_MIN, weeklyMin); }
          if (profile.lastPracticeDate) { lastPracticeDate = profile.lastPracticeDate; Storage.set(CONFIG.KEYS.LAST_PRACTICE_DATE, lastPracticeDate); }
          // 아바타 동기화 (다른 기기에서 변경 시 반영)
          if (profile.avatar && profile.avatar !== Storage.get(CONFIG.KEYS.AVATAR, '🎸')) {
            Storage.set(CONFIG.KEYS.AVATAR, profile.avatar);
          }
          // seasonXp: 같은 시즌이고 클라우드 값이 더 크면 덮어씀
          if (profile.seasonKey === seasonKey) {
            if ((profile.seasonXp || 0) > seasonXp) { seasonXp = profile.seasonXp; Storage.set('rf_season_xp', seasonXp); }
            if ((profile.seasonWater || 0) > seasonWater) { seasonWater = profile.seasonWater; Storage.set('rf_season_water', seasonWater); }
            if ((profile.seasonMin || 0) > seasonMin) { seasonMin = profile.seasonMin; Storage.set('rf_season_min', seasonMin); }
          }
          if (profile.chalProg && profile.chalWeek) {
            const localWeek = Storage.get('rf_chal_week_app', '');
            if (!localWeek || profile.chalWeek === localWeek) {
              Storage.set('rf_chal_week_app', profile.chalWeek);
              Storage.set('rf_chal_prog', profile.chalProg);
              localStorage.setItem('rf_chal_week', profile.chalWeek);
              localStorage.setItem('rf_chal_prog', JSON.stringify(profile.chalProg));
            }
          }
// 수확 컬렉션 복원 (클라우드 ∪ 로컬)
if (profile.harvested && Array.isArray(profile.harvested)) {
  const localHarvested = Storage.get(CONFIG.KEYS.HARVEST, []);
  const merged = [...new Set([...localHarvested, ...profile.harvested])];
  if (merged.length > localHarvested.length) {
    Storage.set(CONFIG.KEYS.HARVEST, merged);
  }
}
// 시즌 참여 아바타 복원 (클라우드 ∪ 로컬, seasonKey 기준 중복 제거)
if (profile.seasonAvatars && Array.isArray(profile.seasonAvatars)) {
  const localAvatars = Storage.get('rf_season_avatars', []);
  const map = new Map();
  [...localAvatars, ...profile.seasonAvatars].forEach(a => {
    if (a && a.seasonKey && !map.has(a.seasonKey)) map.set(a.seasonKey, a);
  });
  const merged = [...map.values()];
  if (merged.length > localAvatars.length) {
    Storage.set('rf_season_avatars', merged);
  }
}
renderStats();
          renderDashboard();
          console.log('[AppState] 프로필 클라우드 동기화 완료');
        }
        await Storage.syncLogsFromCloud();
        streak = recalcStreak();
        Storage.set(CONFIG.KEYS.STREAK, streak);
        // 시즌 통계 역산 (클라우드 로그 동기화 후 최초 1회)
        if (seasonXp === 0 && seasonMin === 0) {
          const { calcXp, calcWater, calcMin } = recalcSeasonStats();
          if (calcMin > 0) {
            seasonXp = calcXp; seasonWater = calcWater; seasonMin = calcMin;
            Storage.set('rf_season_xp', seasonXp);
            Storage.set('rf_season_water', seasonWater);
            Storage.set('rf_season_min', seasonMin);
          }
        }
        // 랭킹 doc 자동 등록/갱신 (앱 로드마다)
        await updateRanking();
        CalendarView?.render();
        await RepertoireTracker?.syncFromCloud();
        CrewRanking?.render();
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
  const chalProg = Storage.get('rf_chal_prog', {});
  const chalWeek = Storage.get('rf_chal_week_app', '');
  const harvested = Storage.get(CONFIG.KEYS.HARVEST, []);
  FireDB.saveProfile({
    xp, water, streak, lastPracticeDate,
    weeklyXp, weeklyMin, weekKey: _getWeekKey(), totalMin,
    seasonXp, seasonWater, seasonMin, seasonKey: getSeasonInfo().seasonKey,
    chalProg, chalWeek,
    harvested,
    username: FireDB.getUsername(),
    updatedAt: new Date().toISOString(),
  }).catch(e => console.warn('[AppState] saveProfile 실패:', e));
}
  }

  function addXP(amount) {
    xp += amount;
    seasonXp += amount;
    Storage.set('rf_season_xp', seasonXp);
    weeklyXp[(new Date().getDay() + 6) % 7] = (weeklyXp[(new Date().getDay() + 6) % 7] || 0) + amount;
    saveAll(); renderStats();
  }
function addWater() {
  water++;
  seasonWater++;
  Storage.set('rf_season_water', seasonWater);
  checkHarvest(); // ← saveAll 전에 먼저 체크 (새 수확 항목이 profile에 포함되도록)
  saveAll(); renderStats();
}
    function _logDateStr(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }

  function recalcStreak() {
    const todayStr = getTodayStr();
    const todayLog = Storage.getLog(todayStr);
    const practicedToday = (todayLog?.totalMin || 0) > 0;
    let checkDate = new Date();
    let count = 0;

    if (practicedToday) {
      count = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    } else {
      // 오늘 미연습 → 어제부터 확인
      checkDate.setDate(checkDate.getDate() - 1);
      const yLog = Storage.getLog(_logDateStr(checkDate));
      if (!yLog || (yLog.totalMin || 0) === 0) return 0; // 어제도 없으면 스트릭 0
      count = 1;
      checkDate.setDate(checkDate.getDate() - 1);
    }

    // 이전 날짜들을 연속으로 확인
    for (let i = 0; i < 365; i++) {
      const log = Storage.getLog(_logDateStr(checkDate));
      if (log && (log.totalMin || 0) > 0) {
        count++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }

  function updateStreak(dateStr) {
    if (!lastPracticeDate || dateStr >= lastPracticeDate) {
      lastPracticeDate = dateStr;
    }
    streak = recalcStreak();
    saveAll();
  }
async function _handleSeasonReset(prevSeasonKey) {
  if (typeof FireDB === 'undefined' || !FireDB.isReady()) return;
  const myName = Storage.get(CONFIG.KEYS.USERNAME, '');
  if (!myName) return;
  try {
    const all = await FireDB.loadSeasonRankings(prevSeasonKey);

    // 배지 보상 처리 (멱등성 보장, B4)
    const rewardedKey = 'rf_season_rewarded_' + prevSeasonKey;
    if (!localStorage.getItem(rewardedKey)) {
      const ranked = all.filter(r => r.firstLogDate).sort((a, b) => (b.seasonXp || 0) - (a.seasonXp || 0));
      const myIdx = ranked.findIndex(r => r.username === myName);
      if (myIdx >= 0) {
        const myRank = myIdx + 1;
        const badge = CONFIG.SEASON_BADGES.find(b => b.rank === myRank) || CONFIG.SEASON_BADGES.find(b => b.rank === 99);
        if (badge) {
          const earned = Storage.get('rf_season_badges', []);
          earned.push({ badgeId: badge.id, season: prevSeasonKey, rank: myRank, earnedAt: new Date().toISOString() });
          Storage.set('rf_season_badges', earned);
        }
      }
      localStorage.setItem(rewardedKey, '1');
    }

    // 시즌 결산 모달 표시
    setTimeout(() => _showSeasonWrapModal({ prevSeasonKey, all, myName }), 1200);
  } catch (e) { console.warn('[Season] 보상 처리 실패:', e); }
}
  function _showSeasonWrapModal({ prevSeasonKey, all, myName }) {
  // 이미 표시했으면 스킵
  const shownKey = 'rf_season_modal_' + prevSeasonKey;
  if (localStorage.getItem(shownKey)) return;
  localStorage.setItem(shownKey, '1');

  const missions = CONFIG.TEAM_MISSIONS || [];
  const totalMin   = all.reduce((acc, r) => acc + (r.seasonMin   || 0), 0);
  const totalWater = all.reduce((acc, r) => acc + (r.seasonWater || 0), 0);
  const participants = all.filter(r => r.firstLogDate).length;
  const myParticipated = all.some(r => r.username === myName && r.firstLogDate);

  // 팀 미션 달성 여부
  const missionRows = missions.map(m => {
    const sum = all.reduce((acc, r) => acc + (r[m.sumKey] || 0), 0);
    const achieved = sum >= m.goal;
    return `<div class="flex items-center justify-between">
      <span class="text-xs text-gray-600">${m.icon} ${m.label} ${m.goal.toLocaleString()}${m.unit}</span>
      <span class="text-xs font-black ${achieved ? 'text-green-600' : 'text-gray-300'}">${achieved ? '✅ 달성' : '미달성'}</span>
    </div>`;
  }).join('');

  // 시즌 참여 아바타
  const avatarDef = (CONFIG.SEASON_AVATARS || []).find(a => a.seasonKey === prevSeasonKey);
  const avatarSection = myParticipated && avatarDef
    ? `<div class="bg-amber-50 rounded-2xl p-3 flex items-center gap-3">
        <span class="text-3xl">${avatarDef.emoji || '🎸'}</span>
        <div>
          <p class="text-xs font-black text-amber-700">${avatarDef.name} 획득!</p>
          <p class="text-[10px] text-gray-400 mt-0.5">프로필에서 사용할 수 있어요</p>
        </div>
      </div>`
    : myParticipated
      ? `<p class="text-xs text-gray-400 text-center py-1">이번 시즌 아바타는 아직 준비 중이에요 🌱</p>`
      : `<p class="text-xs text-gray-400 text-center py-1">이번 시즌 연습 기록이 없어요</p>`;

  // 다음 시즌 시작일
  const { start } = getSeasonInfo();
  const nextStart = start.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });

  const modal = document.createElement('div');
  modal.id = 'season-wrap-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm';
  modal.innerHTML = `
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
      <!-- 헤더 -->
      <div class="bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-5 text-center">
        <p class="text-3xl mb-1">🎸</p>
        <p class="font-black text-white text-lg leading-tight">시즌 종료!</p>
        <p class="text-white/70 text-[11px] mt-0.5">${prevSeasonKey}</p>
      </div>

      <div class="p-5 space-y-4">
        <!-- 팀 총 기록 -->
        ${all.length > 0 ? `
        <div>
          <p class="text-[11px] font-black text-gray-400 mb-2">🎯 우리 크루 이번 시즌</p>
          <div class="grid grid-cols-3 gap-2 text-center">
            <div class="bg-amber-50 rounded-2xl p-2.5">
              <p class="text-base font-black text-amber-600">${totalMin.toLocaleString()}</p>
              <p class="text-[10px] text-gray-400">분 연습</p>
            </div>
            <div class="bg-blue-50 rounded-2xl p-2.5">
              <p class="text-base font-black text-blue-500">${totalWater}</p>
              <p class="text-[10px] text-gray-400">회 물주기</p>
            </div>
            <div class="bg-gray-50 rounded-2xl p-2.5">
              <p class="text-base font-black text-gray-600">${participants}</p>
              <p class="text-[10px] text-gray-400">명 참여</p>
            </div>
          </div>
        </div>` : ''}

        <!-- 팀 미션 결과 -->
        ${missions.length > 0 ? `
        <div>
          <p class="text-[11px] font-black text-gray-400 mb-2">📋 팀 미션 결과</p>
          <div class="space-y-1.5">${missionRows}</div>
        </div>` : ''}

        <!-- 내 시즌 아바타 -->
        <div>
          <p class="text-[11px] font-black text-gray-400 mb-2">🎁 내 시즌 아바타</p>
          ${avatarSection}
        </div>

        <p class="text-center text-[10px] text-gray-300">다음 시즌 시작: ${nextStart}</p>

        <button onclick="document.getElementById('season-wrap-modal').remove()"
          class="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-black rounded-2xl hover:from-amber-600 hover:to-orange-600 transition-all shadow-sm">
          다음 시즌도 파이팅! 🎸
        </button>
      </div>
    </div>`;
  document.body.appendChild(modal);
}
    function recalcSeasonStats() {
    const { start } = getSeasonInfo();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const xpDates = Storage.get('rf_xp_dates', []);
    let calcXp = 0, calcWater = 0, calcMin = 0;
    const d = new Date(start);
    while (d <= today) {
      const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const log = Storage.getLog(ds);
      if (log && (log.totalMin || 0) > 0) {
        calcMin += log.totalMin;
        if (xpDates.includes(ds)) {
          calcXp += log.totalMin >= 30 ? (CONFIG.XP.PRACTICE_LONG || 40) : (CONFIG.XP.PRACTICE_SHORT || 10);
          if (log.totalMin >= 30) calcWater++;
        }
      }
      d.setDate(d.getDate() + 1);
    }
    return { calcXp, calcWater, calcMin };
  }
function _awardSeasonAvatar(seasonKey, attendDays) {
  if (attendDays < 1) return;
  const owned = Storage.get('rf_season_avatars', []);
  if (owned.some(a => a.seasonKey === seasonKey)) return; // 이미 지급됨

  const def = (CONFIG.SEASON_AVATARS || []).find(a => a.seasonKey === seasonKey);
  if (!def) return; // 정의되지 않은 시즌은 패스

  owned.push({
    seasonKey,
    name: def.name,
    emoji: def.emoji || null,
    img: def.img || null,
    awardedAt: new Date().toISOString(),
  });
  Storage.set('rf_season_avatars', owned);

  // Firestore 동기화
  if (typeof FireDB !== 'undefined' && FireDB.isReady() && FireDB.getUsername()) {
    FireDB.saveProfile({
      seasonAvatars: owned,
      updatedAt: new Date().toISOString(),
    }).catch(e => console.warn('[Season] avatar 지급 실패:', e));
  }

  setTimeout(() => showToast(`🎁 시즌 아바타 획득! ${def.emoji || ''} ${def.name}`, 'success'), 1200);
}
async function updateRanking() {
  if (typeof FireDB === 'undefined' || !FireDB.isReady() || !FireDB.getUsername()) return;
  const { seasonKey, start } = getSeasonInfo();
  const myName = Storage.get(CONFIG.KEYS.USERNAME, '') || FireDB.getUsername();
  const myAvatar = Storage.get(CONFIG.KEYS.AVATAR, '🎸');
  const todayStr = getTodayStr();

// 이번 시즌 첫 연습일 + 시즌 출석일수 (시즌 시작일부터 순회하며 실측)
let firstLogDate = null;
let seasonAttendDays = 0;
const d = new Date(start);
while (true) {
  const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  if (ds > todayStr) break;
  const log = Storage.getLog(ds);
  if (log && (log.totalMin || 0) > 0) {
    if (!firstLogDate) firstLogDate = ds; // 루프가 시작일부터 순서대로 → 첫 발견 = 최초 일자
    seasonAttendDays++;
  }
  d.setDate(d.getDate() + 1);
}
if (firstLogDate) Storage.set('rf_s_first_' + seasonKey, firstLogDate); // 항상 최신값 저장

  if (!firstLogDate) return; // 이번 시즌 연습 없음 → 랭킹 미등록
  // 시즌 참여 아바타 지급 (1일 이상 참여)
_awardSeasonAvatar(seasonKey, seasonAttendDays);
  await FireDB.saveRanking(seasonKey, {
    username: myName, avatar: myAvatar,
    seasonXp, seasonWater, seasonMin,
    seasonAttendDays,
    firstLogDate,
    updatedAt: new Date().toISOString(),
  }).catch(e => console.warn('[AppState] updateRanking 실패:', e));
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
    const trimmed = name.trim();
    if (!trimmed) return;

    if (cur && trimmed !== cur) {
      const ok = confirm(
        '사용자 이름을 "' + cur + '"에서 "' + trimmed + '"(으)로 변경하면\n이 기기의 로컬 데이터가 초기화됩니다.\n\n서버에 저장된 데이터는 유지됩니다.\n계속하시겠습니까?'
      );
      if (!ok) return;
      Object.keys(localStorage)
        .filter(function(k) { return k.startsWith('rf_') && k !== CONFIG.KEYS.USERNAME; })
        .forEach(function(k) { localStorage.removeItem(k); });
    }

    Storage.set(CONFIG.KEYS.USERNAME, trimmed);

    if (cur && trimmed !== cur) {
      location.reload();
    } else {
      renderGreeting();
    }
  }

  function logout() {
    const name = Storage.get(CONFIG.KEYS.USERNAME, '') || '사용자';
    if (!confirm(name + '님 계정에서 로그아웃하시겠습니까?\n\n서버 데이터는 유지되며, 다음 로그인 시 복원됩니다.')) return;
    Object.keys(localStorage)
      .filter(function(k) { return k.startsWith('rf_'); })
      .forEach(function(k) { localStorage.removeItem(k); });
    location.reload();
  }

  // 인사말 렌더링
  function renderGreeting() {
    const name = Storage.get(CONFIG.KEYS.USERNAME, '');
    const el = document.getElementById('dash-greeting');
    const hdr = document.getElementById('hdr-greeting');

    if (!name) {
      if (el) {
        const span = document.createElement('span');
        span.onclick = function() { AppState.editUsername(); };
        span.style.cssText = 'cursor:pointer;text-decoration:underline dotted;text-underline-offset:4px;opacity:0.75;';
        span.title = '클릭해서 이름 입력';
        span.textContent = '기타리스트님, 이름을 입력해서 연습 일지를 시작해보세요 👆';
        el.innerHTML = '';
        el.appendChild(span);
      }
      if (hdr) hdr.textContent = '기타리스트님';
      return;
    }

    const h = new Date().getHours();
    const greeting = h < 11 ? '좋은 아침입니다' : h < 18 ? '좋은 오후입니다' : '좋은 저녁입니다';
    if (el) el.textContent = name + '님, ' + greeting + '! 🎸';
    if (hdr) hdr.textContent = name + '님';
  }


  function renderStats() {
    const tm = formatMin(totalMin);
    const practicedToday = (Storage.getLog(getTodayStr())?.totalMin || 0) > 0;
    [['stat-water', water], ['stat-water-hdr', water], ['stat-totalmin-hdr', tm]]
      .forEach(([id, val]) => { const e = document.getElementById(id); if (e) e.textContent = val; });
    ['stat-streak', 'stat-streak-hdr'].forEach(id => {
      const e = document.getElementById(id);
      if (!e) return;
      e.textContent = streak + '일';
      e.style.color = practicedToday ? '' : '#9ca3af';
    });
  }

  function renderDashboard() {
    renderStats();
    renderGreeting();
    const todayLog = Storage.getLog(getTodayStr());
    const todayMin = todayLog?.totalMin || 0;
    const stage = getTreeStage();
    [['dash-today-min', todayMin + '분'], ['dash-water-total', water + '회'],
    ['dash-totalmin', formatMin(totalMin)],
    ['dash-tree-emoji', stage.emoji], ['dash-tree-name', stage.name]
    ].forEach(([id, val]) => { const e = document.getElementById(id); if (e) e.textContent = val; });
    const practicedToday = (Storage.getLog(getTodayStr())?.totalMin || 0) > 0;
    const se = document.getElementById('dash-streak');
    if (se) { se.textContent = streak + '일'; se.style.color = practicedToday ? '' : '#9ca3af'; }
    renderWeekChart();
    renderMonthHeatmap();
    renderWeeklyChallenges();
  }

  function getWeekKey() {
    const d = new Date();
    const day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const y = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${y}-M${mm}${dd}`;
  }

  function seededShuffle(arr, seed) {
    const a = [...arr];
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(s) % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }


   function renderWeeklyChallenges() {
    const el = document.getElementById('weekly-challenges');
    if (!el) return;
    const wk = getWeekKey();
    // 주간 변경 감지: ChallengeTracker와 동일한 rf_chal_week_app 키 기준으로 진행도 리셋
    if (Storage.get('rf_chal_week_app', '') !== wk) {
      Storage.set('rf_chal_week_app', wk);
      localStorage.setItem('rf_chal_prog', '{}');
      localStorage.removeItem('rf_chal_reward_init_' + wk);
    }
    localStorage.setItem('rf_chal_week', wk);
    let prog = {};
    try { prog = JSON.parse(localStorage.getItem('rf_chal_prog')) || {}; } catch { }
    const seed = parseInt(wk.replace(/\D/g, ''));
    const shuffled = seededShuffle(CONFIG.WEEKLY_CHALLENGES, seed);
    const three = shuffled.slice(0, 3);
    const doneCount = three.filter(c => (prog[c.id] || 0) >= c.goal).length;
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
      return `<div
          onclick="AppState.showChallengePopup('${c.id}')"
          class="group flex items-center gap-2 rounded-xl px-2 py-1 cursor-pointer hover:bg-amber-50 transition-colors">
          <span class="text-base w-5 shrink-0">${c.icon}</span>
          <span class="text-xs font-semibold text-gray-700 w-28 shrink-0 truncate group-hover:text-amber-700">${c.title}</span>
          <div class="flex-1 bg-gray-100 rounded-full h-1.5">
            <div class="${done ? 'bg-green-400' : 'bg-amber-400'} h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
          </div>
          <span class="text-[11px] font-black ${done ? 'text-green-600' : 'text-amber-500'} w-10 text-right shrink-0">${done ? '✅' : pct + '%'}</span>
          <span class="text-[10px] text-gray-300 group-hover:text-amber-400 shrink-0">ⓘ</span>
        </div>`;
    }).join('')}
      </div>
    </div>`;
  }

  function showChallengePopup(chalId) {
    const existing = document.getElementById('chal-popup');
    if (existing) { existing.remove(); return; }
    const wk = getWeekKey();
    const seed = parseInt(wk.replace(/\D/g, ''));
    const three = seededShuffle(CONFIG.WEEKLY_CHALLENGES, seed).slice(0, 3);
    const c = three.find(ch => ch.id === chalId);
    if (!c) return;
    let prog = {};
    try { prog = JSON.parse(localStorage.getItem('rf_chal_prog')) || {}; } catch {}
    const cur = prog[c.id] || 0;
    const pct = Math.min(100, Math.round((cur / c.goal) * 100));
    const done = pct >= 100;
    const PAGE_LABEL = { builder: '연습일지', pomo: '포모도로', repertoire: '레퍼토리 트래커', studio: '메트로놈&백킹' };
    const destLabel = PAGE_LABEL[c.page] || c.page;
    const popup = document.createElement('div');
    popup.id = 'chal-popup';
    popup.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4';
    popup.innerHTML = `
      <div class="absolute inset-0 bg-black/40" onclick="document.getElementById('chal-popup').remove()"></div>
      <div class="relative bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full z-10">
        <div class="flex items-center gap-3 mb-3">
          <span class="text-3xl">${c.icon}</span>
          <div>
            <p class="font-black text-gray-800 text-base leading-tight">${c.title}</p>
            <p class="text-xs font-bold ${done ? 'text-green-500' : 'text-amber-500'} mt-0.5">${done ? '✅ 완료!' : `진행 ${cur}/${c.goal} ${c.unit}`}</p>
          </div>
        </div>
        <p class="text-sm text-gray-600 mb-3">${c.desc}</p>
        <div class="w-full bg-gray-100 rounded-full h-2 mb-4">
          <div class="${done ? 'bg-green-400' : 'bg-amber-400'} h-2 rounded-full transition-all" style="width:${pct}%"></div>
        </div>
        <div class="flex gap-2">
          <button onclick="document.getElementById('chal-popup').remove(); AppSidebar.setActive('${c.page}')"
            class="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-colors">
            → ${destLabel}으로 이동
          </button>
          <button onclick="document.getElementById('chal-popup').remove()"
            class="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm">닫기</button>
        </div>
      </div>`;
    document.body.appendChild(popup);
  }


  function renderWeekChart() {
    const c = document.getElementById('week-chart');
    if (!c) return;
    const max = Math.max(...weeklyMin, 1);
    const days = ['월', '화', '수', '목', '금', '토', '일'];
const tod = (new Date().getDay() + 6) % 7;
    c.innerHTML = days.map((d, i) => {
      const val = weeklyMin[i] || 0;
      const pct = Math.round((val / max) * 100);
      return `<div class="flex flex-col items-center gap-1 flex-1">
        <div class="w-full flex items-end justify-center" style="height:80px">
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
          ${g.img
            ? `<img src="${g.img}" class="w-8 h-8 object-contain" alt="${g.name}">`
            : `<span class="text-2xl">${g.emoji}</span>`}
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
        guitarEl.innerHTML = unlockedGuitars.map(g => {
          const avatarVal = g.img || g.emoji;
          const isSelected = curAvatar === avatarVal;
          return `<button onclick="AppState._selectAvatar('${avatarVal}')"
            class="avatar-opt w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all
              ${isSelected ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-200'}"
            data-avatar="${avatarVal}" title="${g.name}">
            ${g.img
              ? `<img src="${g.img}" class="w-6 h-6 object-contain rounded" alt="${g.name}">`
              : `<span class="text-2xl">${g.emoji}</span>`}
          </button>`;
        }).join('');
      }
    }

    // 시즌 참여 아바타 렌더링
    const seasonEl = document.getElementById('profile-season-icons');
    if (seasonEl) {
      const owned = Storage.get('rf_season_avatars', []);
      if (owned.length === 0) {
        seasonEl.innerHTML = '<p class="text-xs text-gray-400">시즌에 하루라도 연습하면 시즌 아바타를 받아요 🌱</p>';
      } else {
        seasonEl.innerHTML = owned.map(a => {
          const avatarVal = a.img || a.emoji;
          const isSelected = curAvatar === avatarVal;
          return `<button onclick="AppState._selectAvatar('${avatarVal}')"
            class="avatar-opt w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all
              ${isSelected ? 'border-amber-400 bg-amber-50' : 'border-gray-200 hover:border-amber-200'}"
            data-avatar="${avatarVal}" title="${a.name}">
            ${a.img
              ? `<img src="${a.img}" class="w-6 h-6 object-contain rounded" alt="${a.name}">`
              : `<span class="text-2xl">${a.emoji}</span>`}
          </button>`;
        }).join('');
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
    const oldAvatar = Storage.get(CONFIG.KEYS.AVATAR, '🎸');
    const oldName = Storage.get(CONFIG.KEYS.USERNAME, '');
    const finalName = name || oldName;
    const changed = avatar !== oldAvatar || (name && name !== oldName);

    if (name) Storage.set(CONFIG.KEYS.USERNAME, name);
    Storage.set(CONFIG.KEYS.AVATAR, avatar);

    closeProfileModal();
    renderGreeting();
    CrewBoard.refreshMyInfo(); // 피드 헤더 동기화
    showToast('프로필이 저장되었습니다 ✅', 'success');

    // ── 다른 유저에게도 즉시 반영되도록 Firestore 동기화 ───────────
    if (changed && typeof FireDB !== 'undefined' && FireDB.isReady() && FireDB.getUsername()) {
      // 1) profile 문서에 avatar/username 저장 (다른 기기/모듈 참조용)
      FireDB.saveProfile({
        avatar,
        username: finalName,
        updatedAt: new Date().toISOString(),
      }).catch(e => console.warn('[saveProfile] avatar 동기화 실패:', e));

      // 2) 시즌 랭킹의 avatar 즉시 갱신 (다른 유저의 랭킹 카드/모달에 반영)
      updateRanking().catch(() => {});

      // 3) 크루 게시판: 내가 작성한 게시글/댓글의 authorAvatar 일괄 갱신
      CrewBoard.updateMyAuthorInfo?.(avatar, finalName);
    }
  }
  function navigate(page) { AppSidebar.setActive(page); }

  return {
    loadAll, saveAll, addXP, addWater, updateStreak, getTreeStage,
    renderStats, renderDashboard, renderWeeklyChallenges, renderTreeGarden,
    showChallengePopup,
    getXp: () => xp, getWater: () => water, getStreak: () => streak,
    navigate,
    setTheme, editUsername, logout, formatMin,
    addTotalMin: (m) => {
      totalMin += m;
      seasonMin = Math.max(0, seasonMin + m);
      Storage.set('rf_season_min', seasonMin);
      weeklyMin[(new Date().getDay() + 6) % 7] = (weeklyMin[(new Date().getDay() + 6) % 7] || 0) + m;
      saveAll(); renderStats();
    },

    // Phase 7 추가
    getUserId, openProfileModal, closeProfileModal, saveProfile, _selectAvatar,
    getTodayMin: () => Storage.getLog(getTodayStr())?.totalMin || 0,
    updateRanking,
  };
})();
// ═══════════════════════════════════════════════════════════════════════════
// WeeklyReport: 주간 연습 리포트 팝업
// ═══════════════════════════════════════════════════════════════════════════
const WeeklyReport = (() => {
  function _getWeekDates() {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - dayOfWeek + i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return {
        dateStr: `${y}-${m}-${dd}`,
        dayLabel: DAY_LABELS[i],
        isToday: i === dayOfWeek,
        isFuture: i > dayOfWeek,
      };
    });
  }

  function _buildReport() {
    const dates = _getWeekDates();
    let totalMin = 0, practicedDays = 0;
    const byType = { warmup: 0, theory: 0, practical: 0 };
    dates.forEach(({ dateStr, isFuture }) => {
      if (isFuture) return;
      const log = Storage.getLog(dateStr);
      if (!log) return;
      if ((log.totalMin || 0) > 0) practicedDays++;
      totalMin += log.totalMin || 0;
      (log.sessions || []).forEach(s => {
        if (s.type in byType) byType[s.type] += s.minutes || 0;
      });
    });
    return { dates, totalMin, practicedDays, byType };
  }

  function _render({ dates, totalMin, practicedDays, byType }) {
    const TYPE_INFO = {
      warmup:    { label: '🔥 워밍업', color: 'bg-amber-400', textColor: 'text-amber-600' },
      theory:    { label: '🎵 이론',   color: 'bg-blue-400',  textColor: 'text-blue-600'  },
      practical: { label: '🎸 실전',   color: 'bg-green-400', textColor: 'text-green-600' },
    };
    const TYPE_NAMES = { warmup: '워밍업', theory: '이론', practical: '실전' };
    const sessionTotal = byType.warmup + byType.theory + byType.practical;

    // ── 인사이트 메시지 ─────────────────────────────────────────────────────
    let insightMsg;
    if (totalMin === 0) {
      insightMsg = '아직 이번 주 연습 기록이 없어요. 오늘부터 시작해봐요! 🎸';
    } else {
      const maxType = Object.entries(byType).reduce((a, b) => b[1] > a[1] ? b : a);
      const focusedName = TYPE_NAMES[maxType[0]];
      const theoryRatio = sessionTotal > 0 ? (byType.theory / sessionTotal) * 100 : 0;
      insightMsg = `이번 주는 <strong class="text-amber-700">${focusedName}</strong> 연습에 가장 집중했어요.`;
      if (theoryRatio < 15) insightMsg += ' 이론 연습을 더 추가해보세요!';
    }

    // ── 요일별 도트 ─────────────────────────────────────────────────────────
    const dayDots = dates.map(({ dateStr, dayLabel, isToday, isFuture }) => {
      const log = Storage.getLog(dateStr);
      const min = log?.totalMin || 0;
      const col = isFuture ? 'bg-gray-100'
        : min >= 30 ? 'bg-amber-400' : min > 0 ? 'bg-amber-200' : 'bg-gray-200';
      return `<div class="flex flex-col items-center gap-1">
        <div class="w-8 h-8 rounded-lg ${col}${isToday ? ' ring-2 ring-orange-400' : ''}"></div>
        <span class="text-[10px] ${isToday ? 'font-black text-amber-600' : 'text-gray-400'}">${dayLabel}</span>
        <span class="text-[9px] text-gray-400">${isFuture ? '—' : (min > 0 ? min + '분' : '·')}</span>
      </div>`;
    }).join('');

    // ── 세션 비중 바 차트 ───────────────────────────────────────────────────
    const barChart = Object.entries(byType).map(([type, min]) => {
      const info = TYPE_INFO[type];
      const pct = sessionTotal > 0 ? Math.round((min / sessionTotal) * 100) : 0;
      const isLow = type === 'theory' && sessionTotal > 0 && pct < 15;
      return `<div class="flex items-center gap-2 mb-2">
        <span class="text-xs w-14 shrink-0 ${info.textColor} font-semibold">${info.label}</span>
        <div class="flex-1 bg-gray-100 rounded-full h-2.5 overflow-hidden">
          <div class="${info.color} h-2.5 rounded-full" style="width:${pct > 0 ? Math.max(pct, 3) : 0}%"></div>
        </div>
        <span class="text-xs text-gray-400 w-20 text-right shrink-0">${min}분 (${pct}%)${isLow ? ' ⚠️' : ''}</span>
      </div>`;
    }).join('');

    return `
      <div class="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4 text-sm text-amber-900 leading-relaxed">
        ${insightMsg}
      </div>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <div class="bg-gray-50 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-amber-600">${totalMin}<span class="text-sm font-medium text-gray-500">분</span></p>
          <p class="text-xs text-gray-400 mt-0.5">이번 주 총 연습</p>
        </div>
        <div class="bg-gray-50 rounded-xl p-3 text-center">
          <p class="text-2xl font-black text-orange-500">${practicedDays}<span class="text-sm font-medium text-gray-500">/7일</span></p>
          <p class="text-xs text-gray-400 mt-0.5">연습한 날</p>
        </div>
      </div>
      <div class="flex justify-between mb-4 px-1">${dayDots}</div>
      <div>
        <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">세션 비중</p>
        ${sessionTotal > 0 ? barChart : '<p class="text-xs text-gray-400">세션 기록이 없어요.</p>'}
      </div>`;
  }

  function open() {
    const modal = document.getElementById('weekly-report-modal');
    if (!modal) return;
    const content = document.getElementById('weekly-report-content');
    if (content) content.innerHTML = _render(_buildReport());
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  }

  function close() {
    const modal = document.getElementById('weekly-report-modal');
    if (!modal) return;
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  return { open, close };
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
    { id: 'reference', label: '참고 자료', icon: 'fa-book-open' },
    { id: 'repertoire', label: '연습곡 관리', icon: 'fa-guitar' },
    { id: 'ranking', label: '크루 랭킹', icon: 'fa-ranking-star' },
    { id: 'board', label: '크루 게시판', icon: 'fa-comments' },
    { id: 'export', label: '성장 스토리', icon: 'fa-regular fa-heart' },
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
    if (id === 'repertoire') {
    RepertoireTracker.render();            // 로컬 데이터 즉시 표시
    RepertoireTracker.syncFromCloud();     // 백그라운드 클라우드 동기화
    }
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
  let startTime = null, remainingAtStart = 0;
  let bellType = 'beep';

  // ── 세션 큐 ──────────────────────────────────────────────────────
  let taskQueue = [];      // [{id, name, type, minutes, done}]
  let currentTaskIdx = -1; // 현재 진행 중인 태스크 인덱스 (-1: 자유 모드)
  let _pendingNextTask = -1;
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
    const taskId = taskQueue[currentTaskIdx].id;
    taskQueue[currentTaskIdx].done = true;

    // ★ 연습일지 세션 완료 동기화
    if (typeof PracticeBuilder !== 'undefined') {
      PracticeBuilder.markSessionComplete(taskId);
    }

    const next = taskQueue.findIndex((t, i) => i > currentTaskIdx && !t.done);
    if (next !== -1) {
      _pendingNextTask = next;   // ★ 자동시작 대신 저장만
      showToast(`☕ 휴식 후 세션 ${next + 1} [${taskQueue[next].name}] 시작 준비하세요!`, 'info');
    } else {
      currentTaskIdx = -1;
      _pendingNextTask = -1;
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
        startTime = Date.now(); remainingAtStart = remaining; isRunning = true;
        interval = setInterval(() => {
          remaining = Math.max(0, remainingAtStart - Math.floor((Date.now() - startTime) / 1000));
          updateDisplay();
          if (remaining <= 0) onComplete();
        }, 500);
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
      if (typeof ChallengeTracker !== 'undefined') ChallengeTracker.addPomo();
      isFocus = false;
      const lng = sessionCount % CONFIG.POMO.SESSIONS_UNTIL_LONG === 0;
      remaining = (lng ? CONFIG.POMO.LONG_BREAK_MIN : breakMin) * 60;
} else {
  isFocus = true;
  remaining = focusMin * 60;
  if (_pendingNextTask >= 0) {
    _showNextSessionPrompt(_pendingNextTask);
  } else {
    showToast('☕ 휴식 완료! 다시 집중해봐요', 'info');
  }
}
    _bell(); updateDisplay();
  }
function _showNextSessionPrompt(nextIdx) {
  const task = taskQueue[nextIdx];
  if (!task) return;
  const existing = document.getElementById('pomo-next-prompt');
  if (existing) existing.remove();
  const icon = TYPE_ICON[task.type] || '🎵';
  const el = document.createElement('div');
  el.id = 'pomo-next-prompt';
  el.className = 'fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-white rounded-2xl shadow-xl border border-amber-200 px-5 py-4 flex flex-col items-center gap-2 w-72';
  el.innerHTML = `
    <p class="text-xs text-gray-400 font-medium">☕ 휴식 완료! 다음 세션 준비됐나요?</p>
    <p class="text-base font-black text-gray-800">${icon} ${task.name}</p>
    <p class="text-xs text-gray-400">집중 ${task.minutes}분</p>
    <button onclick="Pomodoro.startNextSession()"
      class="mt-1 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl font-bold text-sm hover:from-amber-600 hover:to-orange-600 transition-all shadow">
      ▶ 세션 ${nextIdx + 1} 시작하기
    </button>`;
  document.body.appendChild(el);
}

function startNextSession() {
  const el = document.getElementById('pomo-next-prompt');
  if (el) el.remove();
  if (_pendingNextTask >= 0) {
    const idx = _pendingNextTask;
    _pendingNextTask = -1;
    startTask(idx);
  }
}

  function _bell() { playPomodoroBell(bellType); }

  function startStop() {
    if (isRunning) {
      remaining = Math.max(0, remainingAtStart - Math.floor((Date.now() - startTime) / 1000));
      clearInterval(interval); isRunning = false;
    } else {
      startTime = Date.now(); remainingAtStart = remaining; isRunning = true;
      interval = setInterval(() => {
        remaining = Math.max(0, remainingAtStart - Math.floor((Date.now() - startTime) / 1000));
        updateDisplay();
        if (remaining <= 0) onComplete();
      }, 500);
    }
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
    loadFromBuilder, startTask, renderTaskQueue, startNextSession,
  };
})();


// ═══════════════════════════════════════════════════════════════════════════
// StudioUI: 메트로놈 + 백킹 트랙 통합 UI
// ═══════════════════════════════════════════════════════════════════════════
const StudioUI = (() => {
  // ── 메트로놈 상태 ─────────────────────────────────────────────────
  let _bpm = CONFIG.METRONOME.DEFAULT_BPM;
  let _tapTimes = [];

  // ── 스피드 빌더 상태 ────────────────────────────────────────────
  let _sbActive = false;
  let _sbBarCount = 0;
  let _sbCurrentBpm = 60;
  let _countInActive = false;
  let _countInBarsLeft = 0;


  // ── 백킹 상태 ──────────────────────────────────────────────────────
  let selectedGenre = null;
  let selectedKey = 'A';
  let editableProgression = [];   // [{root, type}]
  let _lastStudioChord = null;    // 마지막으로 표시된 코드 (정지 후에도 유지)
  // ── 유저 백킹 프리셋 ────────────────────────────────────────────────
  let _userPresets = [];
  try { _userPresets = JSON.parse(localStorage.getItem('rf_user_presets') || '[]'); } catch { _userPresets = []; }


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
function setSubdiv(id) {
  Metronome.setSubdiv(id);
  document.querySelectorAll('.subdiv-btn').forEach(btn => {
    const on = btn.dataset.subdiv === id;
    btn.classList.toggle('bg-orange-500', on);
    btn.classList.toggle('text-white', on);
    btn.classList.toggle('border-orange-500', on);
    btn.classList.toggle('bg-white', !on);
    btn.classList.toggle('text-gray-600', !on);
    btn.classList.toggle('border-gray-200', !on);
  });
}
function setSwing(val) {
  const amount = parseFloat(val) || 0;
  Metronome.setSwing(amount);
  BackingEngine.setSwing(amount);
  const pct = document.getElementById('metro-swing-pct');
  if (pct) pct.textContent = amount === 0 ? '스트레이트' : Math.round(amount * 100) + '%';
}

  function setPendingBpm(val) {
    Metronome.setPendingBpm(val);
    BackingEngine.setPendingBpm(val);
    syncBpmDisplay(val);
  }

  function updateCountInDisplay(barsLeft) {
    const el = document.getElementById('count-in-display');
    if (!el) return;
    if (barsLeft > 0) {
      el.textContent = `준비 ${barsLeft}마디`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }
  }

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
  // ── 메트로놈 고급 설정 접기/펼치기 ──────────────────────────────
  function toggleMetroAdv() {
    const body = document.getElementById('metro-adv-body');
    const btn = document.getElementById('metro-adv-toggle-btn');
    if (!body) return;
    const isHidden = body.classList.toggle('hidden');
    if (btn) btn.textContent = isHidden ? '⚙ 고급 설정 ▼' : '⚙ 고급 설정 ▲';
  }

  // ── 볼륨 믹서 접기/펼치기 ────────────────────────────────────────
  function toggleMixer() {
    const body = document.getElementById('mixer-body');
    const btn = document.getElementById('mixer-toggle-btn');
    if (!body) return;
    const hidden = body.style.display === 'none';
    body.style.display = hidden ? '' : 'none';
    if (btn) btn.textContent = hidden ? '접기 ▲' : '펼치기 ▼';
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
    const dd = document.getElementById('genre-select-dropdown');
    if (dd) dd.value = id;

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
  const _IV_NAME = { 0: 'R', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7', 14: '9' };
  
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
  const _SEMI_LABEL = { 0: 'R', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7', 14: '9' };
  const _ROLE_COLOR = ['bg-amber-400', 'bg-lime-400', 'bg-sky-400', 'bg-purple-400', 'bg-pink-400'];

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
  async function syncPlay() {
    await AudioEngine.ensureRunning();
    const metroOn = document.getElementById('toggle-metro')?.checked ?? true;
    const backingOn = document.getElementById('toggle-backing')?.checked ?? true;
    const countInEnabled = document.getElementById('toggle-count-in')?.checked ?? false;
    const countInBars = parseInt(document.getElementById('count-in-bars')?.value) || 1;

    const isAnyPlaying = Metronome.getIsPlaying() || BackingEngine.getIsPlaying();
    if (isAnyPlaying) { stopAll(); return; }

    if (metroOn) { Metronome.start(); updateMetroBtn(true); }
    if (backingOn) {
      if (countInEnabled && metroOn && countInBars > 0) {
        _countInActive = true;
        _countInBarsLeft = countInBars;
        showToast(`🥁 카운트인 ${countInBars}마디...`, 'info');
      } else {
        const prog = editableProgression.length > 0 ? editableProgression : [{ root: selectedKey, type: 'major' }];
        BackingEngine.start(prog, selectedGenre?.id || 'blues', _bpm);
        updateBackingBtn(true);
        BackingEngine.onChordChange(idx => highlightChord(idx));
        showToast('🎵 재생 시작!', 'success');
      }
    } else {
      showToast('🎵 재생 시작!', 'success');
    }

    const btn = document.getElementById('studio-play-btn');
    if (btn) { btn.textContent = '⏹ 정지'; btn.style.background = 'linear-gradient(135deg,#ef4444,#dc2626)'; }
  }


  function stopAll() {
    _countInActive = false;
    _countInBarsLeft = 0;
    updateCountInDisplay(0);
    Metronome.stop(); updateMetroBtn(false);
    BackingEngine.stop();
    const btn = document.getElementById('studio-play-btn');
    if (btn) { btn.textContent = '▶ 재생'; btn.style.background = 'linear-gradient(135deg,#FF6B00,#FF8C42)'; }
    document.querySelectorAll('.chord-card').forEach(el => { el.style.borderColor = ''; el.style.boxShadow = ''; });
  }


  // ──   // ── 스피드 빌더 ─────────────────────────────────────────────────
  function onSpeedBuilderToggle(checked) {
    const panel = document.getElementById('speed-builder-panel');
    if (!panel) return;
    panel.classList.toggle('hidden', !checked);
    if (!checked) resetSpeedBuilder();
  }

  function showSpeedBuilderInfo() {
    const existing = document.getElementById('sb-info-popup');
    if (existing) { existing.remove(); return; }
    const popup = document.createElement('div');
    popup.id = 'sb-info-popup';
    popup.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    popup.innerHTML = `
      <div class="absolute inset-0 bg-black/40" onclick="document.getElementById('sb-info-popup').remove()"></div>
      <div class="relative bg-white rounded-2xl shadow-xl p-5 max-w-sm w-full z-10">
        <h3 class="font-black text-gray-800 text-base mb-3">⚡ 스피드 빌더란?</h3>
        <ul class="text-sm text-gray-600 space-y-2">
          <li>🎯 <b>목적:</b> 느린 BPM에서 시작해 목표 속도까지 단계적으로 훈련합니다.</li>
          <li>📐 <b>작동 방식:</b> 설정한 마디 수마다 BPM이 자동으로 올라갑니다.</li>
          <li>⚙️ <b>설정 항목:</b><br>
            · 시작/목표 BPM — 훈련 범위<br>
            · 스텝 — 한 번에 올라가는 BPM<br>
            · 마디 수 — 몇 마디마다 BPM을 올릴지
          </li>
          <li>▶ <b>사용법:</b> START로 메트로놈을 켠 뒤 ▶ 시작을 클릭하세요.</li>
          <li>🏆 완료 시 <b>'보이지 않는 손'</b> 챌린지 +1 진행됩니다.</li>
        </ul>
        <button onclick="document.getElementById('sb-info-popup').remove()"
          class="mt-4 w-full py-2 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-bold text-sm transition-colors">확인</button>
      </div>`;
    document.body.appendChild(popup);
  }

  function startSpeedBuilder() {
    const startBpm = parseInt(document.getElementById('sb-start-bpm')?.value) || 60;
    const targetBpm = parseInt(document.getElementById('sb-target-bpm')?.value) || 120;
    if (startBpm >= targetBpm) { showToast('시작 BPM이 목표 BPM보다 작아야 합니다!', 'warning'); return; }
    if (_sbActive) { resetSpeedBuilder(); return; }
    _sbCurrentBpm = startBpm;
    _sbBarCount = 0;
    _sbActive = true;
    setBpm(startBpm);
    updateSpeedBuilderUI();
    const btn = document.getElementById('sb-start-btn');
    if (btn) { btn.textContent = '⏸ 일시정지'; btn.style.background = '#10b981'; }
    showToast(`⚡ 스피드 빌더 시작! ${startBpm} → ${targetBpm} BPM`, 'success');
  }

  function resetSpeedBuilder() {
    _sbActive = false;
    _sbBarCount = 0;
    const startBpm = parseInt(document.getElementById('sb-start-bpm')?.value) || 60;
    _sbCurrentBpm = startBpm;
    updateSpeedBuilderUI();
    const btn = document.getElementById('sb-start-btn');
    if (btn) { btn.textContent = '▶ 시작'; btn.style.background = ''; }
  }

  function _sbOnBar() {
    if (!_sbActive) return;
    const barsPerStep = parseInt(document.getElementById('sb-bars')?.value) || 4;
    const step = parseInt(document.getElementById('sb-step')?.value) || 2;
    const targetBpm = parseInt(document.getElementById('sb-target-bpm')?.value) || 120;
    _sbBarCount++;
    if (_sbBarCount >= barsPerStep) {
      _sbBarCount = 0;
      _sbCurrentBpm = Math.min(_sbCurrentBpm + step, targetBpm);
  setPendingBpm(_sbCurrentBpm);
      if (_sbCurrentBpm >= targetBpm) {
        _sbActive = false;
        showToast('🎉 스피드 빌더 완료! 목표 BPM 달성!', 'success');
        if (typeof ChallengeTracker !== 'undefined') ChallengeTracker.addSpeedBuilder();
        const btn = document.getElementById('sb-start-btn');
        if (btn) { btn.textContent = '✅ 완료'; btn.style.background = '#6366f1'; }
      }
    }
    updateSpeedBuilderUI();
  }

  function updateSpeedBuilderUI() {
    const startBpm = parseInt(document.getElementById('sb-start-bpm')?.value) || 60;
    const targetBpm = parseInt(document.getElementById('sb-target-bpm')?.value) || 120;
    const barsPerStep = parseInt(document.getElementById('sb-bars')?.value) || 4;
    const el = document.getElementById('sb-current-bpm');
    const bar = document.getElementById('sb-progress-bar');
    const barCountEl = document.getElementById('sb-bar-count');
    if (el) el.textContent = _sbCurrentBpm;
    const pct = Math.min(100, Math.round((_sbCurrentBpm - startBpm) / Math.max(1, targetBpm - startBpm) * 100));
    if (bar) bar.style.width = pct + '%';
    const ls = document.getElementById('sb-label-start'); if (ls) ls.textContent = startBpm;
    const lt = document.getElementById('sb-label-target'); if (lt) lt.textContent = targetBpm;
    if (barCountEl) barCountEl.textContent = _sbActive ? `${_sbBarCount}/${barsPerStep} 마디` : '대기 중';
  }
  // ── 유저 프리셋 저장/불러오기 ───────────────────────────────────────
  function _saveUserPresets() {
    localStorage.setItem('rf_user_presets', JSON.stringify(_userPresets));
    if (typeof FireDB !== 'undefined' && FireDB.isReady() && FireDB.getUsername()) {
      FireDB.savePresets(_userPresets).catch(e => console.warn('[Presets] 클라우드 저장 실패:', e));
    }
  }

  async function loadUserPresets() {
    try { _userPresets = JSON.parse(localStorage.getItem('rf_user_presets') || '[]'); } catch { _userPresets = []; }
    if (typeof FireDB !== 'undefined') {
      FireDB.onReady(async () => {
        const cloud = await FireDB.loadPresets();
        if (cloud?.length) {
          const localIds = new Set(_userPresets.map(p => p.id));
          const merged = [..._userPresets, ...cloud.filter(p => !localIds.has(p.id))];
          if (merged.length > _userPresets.length) {
            _userPresets = merged.slice(0, 6);
            localStorage.setItem('rf_user_presets', JSON.stringify(_userPresets));
          }
        }
        renderGenreCards();
      });
    }
  }

  function loadUserPreset(id) {
    const p = _userPresets.find(pr => pr.id == id);
    if (!p) return;
    editableProgression = p.progression.map(c => ({ ...c }));
    selectedKey = p.defaultKey;
    setBpm(p.defaultBpm);
    const keyEl = document.getElementById('backing-key');
    if (keyEl) keyEl.value = selectedKey;
    selectedGenre = CONFIG.BACKING_TRACKS.find(g => g.id === p.genreId) || null;
    document.querySelectorAll('.genre-card, .user-preset-card').forEach(el => {
      el.style.borderColor = ''; el.style.boxShadow = '';
    });
    const card = document.querySelector(`[data-preset-id="${id}"]`);
    if (card) { card.style.borderColor = '#FF6B00'; card.style.boxShadow = '0 0 0 2px #FF6B0066'; }
    renderProgressionEditor();
    renderScaleRecommend();
    updateFretboard();
    showToast(`⭐ "${p.name}" 프리셋 불러왔습니다`, 'info');
  }

  function openSavePresetModal() {
    if (_userPresets.length >= 6) { showToast('프리셋은 최대 6개까지 저장할 수 있어요', 'warning'); return; }
    if (editableProgression.length === 0) { showToast('먼저 코드를 추가해주세요', 'warning'); return; }
    const existing = document.getElementById('save-preset-modal');
    if (existing) existing.remove();

    let repSongs = [];
    try { repSongs = JSON.parse(localStorage.getItem('rf_repertoire') || '[]'); } catch { }

    const styleOpts = CONFIG.BACKING_TRACKS.map(g =>
      `<option value="${g.id}" ${g.id === (selectedGenre?.id || 'blues') ? 'selected' : ''}>${g.emoji} ${g.name}</option>`
    ).join('');
    const repOpts = `<option value="">연결 안 함</option>` +
      repSongs.map(s => `<option value="${s.id}">${s.title}${s.artist ? ' — ' + s.artist : ''}</option>`).join('');

    const modal = document.createElement('div');
    modal.id = 'save-preset-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.style.background = 'rgba(0,0,0,0.45)';
    modal.innerHTML = `
      <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
        <p class="font-black text-gray-800 text-base mb-4">💾 현재 코드 진행 저장</p>
        <div class="space-y-3">
          <div>
            <label class="text-xs font-bold text-gray-500 block mb-1">프리셋 이름</label>
            <input id="preset-name-input" type="text" placeholder="나만의 블루스..." maxlength="20"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
          </div>
          <div>
            <label class="text-xs font-bold text-gray-500 block mb-1">반주 스타일</label>
            <select id="preset-style-select"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
              ${styleOpts}
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-gray-500 block mb-1">레퍼토리 곡 연결 <span class="font-normal text-gray-400">(선택)</span></label>
            <select id="preset-rep-select"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
              ${repOpts}
            </select>
          </div>
          <p class="text-[10px] text-gray-400">코드 ${editableProgression.length}개 · BPM ${_bpm} · 키 ${selectedKey || 'C'}</p>
        </div>
        <div class="flex gap-2 mt-4">
          <button onclick="StudioUI.confirmSavePreset()"
            class="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors">저장</button>
          <button onclick="document.getElementById('save-preset-modal').remove()"
            class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm rounded-xl">취소</button>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    document.getElementById('preset-name-input')?.focus();
  }

  function confirmSavePreset() {
    const name = (document.getElementById('preset-name-input')?.value || '').trim();
    const genreId = document.getElementById('preset-style-select')?.value || 'blues';
    const linkedRepId = document.getElementById('preset-rep-select')?.value || null;
    if (!name) { showToast('프리셋 이름을 입력해주세요', 'warning'); return; }
    _userPresets.push({
      id: Date.now(), name, genreId,
      progression: editableProgression.map(c => ({ ...c })),
      defaultBpm: _bpm,
      defaultKey: selectedKey || 'C',
      linkedRepId: linkedRepId ? parseInt(linkedRepId) : null,
      createdAt: new Date().toISOString(),
    });
    _saveUserPresets();
    document.getElementById('save-preset-modal')?.remove();
    renderGenreCards();
    showToast(`✅ "${name}" 프리셋이 저장되었습니다!`, 'success');
  }

  function deleteUserPreset(id) {
    const p = _userPresets.find(pr => pr.id == id);
    if (!p || !confirm(`"${p.name}" 프리셋을 삭제할까요?`)) return;
    _userPresets = _userPresets.filter(pr => pr.id != id);
    _saveUserPresets();
    renderGenreCards();
    showToast('프리셋이 삭제되었습니다', 'info');
  }

  function startEditPresetName(id) {
    const nameEl = document.querySelector(`[data-preset-id="${id}"] .preset-name`);
    if (!nameEl) return;
    const cur = nameEl.textContent;
    nameEl.outerHTML = `<input
      id="preset-edit-${id}" type="text" value="${cur}" maxlength="20"
      onclick="event.stopPropagation()"
      onblur="StudioUI.finishEditPresetName(${id}, this.value)"
      onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.dataset.cancel='1';this.blur();}"
      class="preset-name flex-1 text-[11px] font-bold text-amber-700 bg-transparent border-b border-amber-400 focus:outline-none min-w-0 w-20" />`;
    document.getElementById(`preset-edit-${id}`)?.focus();
    document.getElementById(`preset-edit-${id}`)?.select();
  }

  function finishEditPresetName(id, newName) {
    if (!newName?.trim()) { renderGenreCards(); return; }
    const p = _userPresets.find(pr => pr.id == id);
    if (!p) return;
    p.name = newName.trim();
    _saveUserPresets();
    renderGenreCards();
  }
function openEditPresetModal(id) {
  const p = _userPresets.find(pr => pr.id == id);
  if (!p) return;
  const existing = document.getElementById('edit-preset-modal');
  if (existing) existing.remove();

  const styleOpts = CONFIG.BACKING_TRACKS.map(g =>
    `<option value="${g.id}" ${g.id === p.genreId ? 'selected' : ''}>${g.emoji} ${g.name}</option>`
  ).join('');
  const keyOpts = CONFIG.NOTES.map(n =>
    `<option value="${n}" ${n === p.defaultKey ? 'selected' : ''}>${n}</option>`
  ).join('');

  const modal = document.createElement('div');
  modal.id = 'edit-preset-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  modal.style.background = 'rgba(0,0,0,0.45)';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
      <p class="font-black text-gray-800 text-base mb-4">✏️ 프리셋 수정</p>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-bold text-gray-500 block mb-1">프리셋 이름</label>
          <input id="edit-preset-name" type="text" value="${p.name.replace(/"/g, '&quot;')}" maxlength="20"
            class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
        </div>
        <div>
          <label class="text-xs font-bold text-gray-500 block mb-1">반주 스타일</label>
          <select id="edit-preset-style"
            class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
            ${styleOpts}
          </select>
        </div>
        <div class="flex gap-2">
          <div class="flex-1">
            <label class="text-xs font-bold text-gray-500 block mb-1">기본 BPM</label>
            <input id="edit-preset-bpm" type="number" value="${p.defaultBpm}" min="40" max="240"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
          </div>
          <div class="flex-1">
            <label class="text-xs font-bold text-gray-500 block mb-1">기본 키</label>
            <select id="edit-preset-key"
              class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400">
              ${keyOpts}
            </select>
          </div>
        </div>
        <label class="flex items-center gap-2 cursor-pointer select-none">
          <input id="edit-preset-update-prog" type="checkbox"
            class="w-4 h-4 accent-amber-500 cursor-pointer" />
          <span class="text-xs text-gray-600">현재 코드 진행으로 교체
            <span class="text-gray-400">(현재 ${editableProgression.length}개 코드)</span></span>
        </label>
        <p class="text-[10px] text-gray-400">저장된 코드 진행: ${p.progression.length}개</p>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="StudioUI.confirmEditPreset(${id})"
          class="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors">저장</button>
        <button onclick="document.getElementById('edit-preset-modal').remove()"
          class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm rounded-xl">취소</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('edit-preset-name')?.focus();
  document.getElementById('edit-preset-name')?.select();
}

function confirmEditPreset(id) {
  const p = _userPresets.find(pr => pr.id == id);
  if (!p) return;
  const name = (document.getElementById('edit-preset-name')?.value || '').trim();
  const genreId = document.getElementById('edit-preset-style')?.value || p.genreId;
  const bpm = parseInt(document.getElementById('edit-preset-bpm')?.value) || p.defaultBpm;
  const key = document.getElementById('edit-preset-key')?.value || p.defaultKey;
  const updateProg = document.getElementById('edit-preset-update-prog')?.checked;
  if (!name) { showToast('프리셋 이름을 입력해주세요', 'warning'); return; }
  p.name = name;
  p.genreId = genreId;
  p.defaultBpm = Math.max(40, Math.min(240, bpm));
  p.defaultKey = key;
  if (updateProg && editableProgression.length > 0) {
    p.progression = editableProgression.map(c => ({ ...c }));
  }
  _saveUserPresets();
  document.getElementById('edit-preset-modal')?.remove();
  renderGenreCards();
  showToast(`✅ "${name}" 프리셋이 수정되었습니다!`, 'success');
}

function renderGenreCards() {
  const c = document.getElementById('backing-genres');
  if (!c) return;

  // 데스크탑 드롭다운
  const selectedId = selectedGenre?.id || CONFIG.BACKING_TRACKS[0]?.id || '';
  const selectOpts = CONFIG.BACKING_TRACKS
    .map(g => `<option value="${g.id}" ${g.id === selectedId ? 'selected' : ''}>${g.emoji} ${g.name}</option>`)
    .join('');
  const desktopSelect = `<select id="genre-select-dropdown"
    onchange="StudioUI.selectGenre(this.value)"
    class="hidden md:block w-full text-sm border border-gray-200 rounded-xl px-3 py-2
           text-gray-700 font-bold bg-white focus:outline-none focus:border-orange-400
           focus:ring-1 focus:ring-orange-300 transition-colors cursor-pointer mb-2">
    ${selectOpts}
  </select>`;

  // 모바일 버튼 그리드 (1줄 고정)
  const defaultCards = CONFIG.BACKING_TRACKS.map(g => {
    const tip = (g.tip || '').replace(/'/g, '&#39;');
    return `<button data-genre="${g.id}" onclick="StudioUI.selectGenre('${g.id}')"
      onmouseenter="document.getElementById('backing-tip').textContent='${tip}'"
      onmouseleave="document.getElementById('backing-tip').textContent=''"
      class="genre-card md:hidden flex items-center gap-1.5 px-2 py-1.5 rounded-lg
        bg-white border border-gray-100 shadow-sm hover:border-orange-300 hover:shadow-md
        transition-all hover:scale-105 active:scale-95">
      <span class="text-base shrink-0">${g.emoji}</span>
      <span class="font-bold text-[11px] text-gray-700 truncate">${g.name}</span>
    </button>`;
  }).join('');

  const userCards = _userPresets.map(p => {
    const styleName = CONFIG.BACKING_TRACKS.find(g => g.id === p.genreId)?.name || '';
    return `<div class="relative group flex items-center gap-1.5 px-2 py-1.5 rounded-lg
        bg-amber-50 border border-amber-200 shadow-sm hover:border-amber-400 hover:shadow-md
        transition-all cursor-pointer"
        onclick="StudioUI.loadUserPreset(${p.id})" data-preset-id="${p.id}">
      <span class="text-base shrink-0">⭐</span>
      <div class="flex-1 min-w-0 overflow-hidden">
        <span class="preset-name font-bold text-[11px] text-amber-700 leading-tight block truncate">${p.name}</span>
        <span class="text-[9px] text-amber-500 leading-none">${styleName} · BPM ${p.defaultBpm} · ${p.defaultKey}</span>
      </div>
      <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onclick="event.stopPropagation();StudioUI.openEditPresetModal(${p.id})"
          class="w-5 h-5 bg-blue-400 hover:bg-blue-500 rounded-full text-white flex items-center justify-center text-[9px] transition-colors">✏</button>
        <button onclick="event.stopPropagation();StudioUI.deleteUserPreset(${p.id})"
          class="w-5 h-5 bg-red-400 hover:bg-red-500 rounded-full text-white flex items-center justify-center text-[9px] transition-colors">✕</button>
      </div>
    </div>`;
  }).join('');

  const addBtn = _userPresets.length < 6 ? `
    <button onclick="StudioUI.openSavePresetModal()"
      class="flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-gray-50
        border border-dashed border-gray-300 hover:border-orange-300
        hover:bg-orange-50 text-gray-400 hover:text-orange-500
        transition-all hover:scale-105 active:scale-95">
      <span class="text-base shrink-0">＋</span>
      <span class="font-bold text-[11px] leading-tight">프리셋 저장</span>
    </button>` : '';

  const userSection = `
    ${_userPresets.length > 0 ? '<p class="text-[10px] font-bold text-amber-500 mt-2 mb-1.5">⭐ 내 프리셋</p>' : ''}
    <div class="flex flex-col gap-1.5">${userCards}${addBtn}</div>
  `;

  c.innerHTML = `${desktopSelect}<div class="grid grid-cols-2 gap-1.5">${defaultCards}</div>${userSection}`;
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

  }

  // ── 페이지 진입 시 초기화 ────────────────────────────────────────
  function onEnter() {
    initSelects();
    loadUserPresets();
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
      if (beat === 0) {
        if (_countInActive) {
          updateCountInDisplay(_countInBarsLeft);   // 먼저 표시
          _countInBarsLeft--;
          if (_countInBarsLeft <= 0) {
            _countInActive = false;
            updateCountInDisplay(0);
            const backingOn = document.getElementById('toggle-backing')?.checked ?? true;
            if (backingOn) {
              const startTime = Metronome.getNextNoteTime();
              const prog = editableProgression.length > 0 ? editableProgression : [{ root: selectedKey, type: 'major' }];
              BackingEngine.start(prog, selectedGenre?.id || 'blues', _bpm, startTime);
              BackingEngine.onChordChange(idx => highlightChord(idx));
            }
            showToast('🎵 재생 시작!', 'success');
          }
        } else {
          _sbOnBar();
        }
      }
    });
  }

  return {
    // 메트로놈
    setBpm, adjustBpm, toggleMetronome, tapTempo, setMetroVolume,
    setTimeSig, setSubdiv, setSoundType, setSwing, cycleBeat,
    onMetroToggle, onBackingToggle, setHarmonyBtn, toggleMixer, toggleMetroAdv,
    // 백킹
    selectGenre, setKey, setScale, toggleBacking, syncPlay, stopAll,
    editChordRoot, editChordType, addChord, removeChord, previewChord,
    //백킹 유저 프리셋
    loadUserPresets, loadUserPreset, openSavePresetModal, confirmSavePreset,
    deleteUserPreset, startEditPresetName, finishEditPresetName,
        openEditPresetModal, confirmEditPreset,
    getUserPresets: () => _userPresets,
    // 공통
    onEnter,
    // 스피드 빌더
    onSpeedBuilderToggle, showSpeedBuilderInfo,
    startSpeedBuilder, resetSpeedBuilder, updateSpeedBuilderUI,
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
  let _triadType = 'major';   // 'major'|'minor'|'dim'|'aug'|'7'|'maj7'|'m7'|'m7b5'
  let _triadVoicing = 'all';  // 'all'|'root'|'1st'|'2nd'|'3rd'
  let _triadStrGroup = '123'; // '123'|'234'|'345'|'456'
  let _triadLabelMode = 'interval'; // 'interval' | 'note'
  let _pentaPos = 0;         // 0=All, 1~5
  let _pentaKey = 'major';   // 'major'|'minor'
    let _pentaView  = 'full';    // 'full' | 'boxes'
  let _pentaLabel = 'note';    // 'note' | 'interval'
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
  function _is7thChord(t) { return t === '7' || t === 'maj7' || t === 'm7' || t === 'm7b5'; }

  // 7th 모드 ↔ triad 모드 UI 동기화
  function _sync7thUI(is7th) {
    const btn456 = document.querySelector('[data-strgrp="456"]');
    if (btn456) btn456.style.display = is7th ? 'none' : '';
    const btn3rd = document.querySelector('[data-voicing="3rd"]');
    if (btn3rd) btn3rd.style.display = is7th ? '' : 'none';
    // 스트링 그룹 버튼 라벨 변경
    const labels = is7th
      ? { '123': '1-2-3-4', '234': '2-3-4-5', '345': '3-4-5-6' }
      : { '123': '1-2-3',   '234': '2-3-4',   '345': '3-4-5'   };
    Object.entries(labels).forEach(([g, lbl]) => {
      const btn = document.querySelector(`[data-strgrp="${g}"]`);
      if (btn) btn.textContent = lbl;
    });
    // 7th 모드로 전환 시 '456' 그룹에 있었다면 '345'로 리셋
    if (is7th && _triadStrGroup === '456') {
      _triadStrGroup = '345';
      document.querySelectorAll('.strgrp-btn').forEach(b => {
        const on = b.dataset.strgrp === '345';
        b.classList.toggle('bg-indigo-500', on); b.classList.toggle('text-white', on);
        b.classList.toggle('bg-white', !on); b.classList.toggle('text-gray-600', !on);
      });
    }
    // 3rd Inv 선택 상태에서 triad 모드로 전환 시 'all' 리셋
    if (!is7th && _triadVoicing === '3rd') {
      _triadVoicing = 'all';
      document.querySelectorAll('.voicing-btn').forEach(b => {
        const on = b.dataset.voicing === 'all';
        b.classList.toggle('bg-gray-700', on); b.classList.toggle('text-white', on);
        b.classList.toggle('bg-white', !on); b.classList.toggle('text-gray-600', !on);
      });
    }
  }

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
        '7': {
      sets: [
        { strings: [3,2,1,0], vc: [
          { name: 'Root',    dots: [{s:3,f:10,r:'R'},{s:2,f:9,r:'3'},{s:1,f:8,r:'5'},{s:0,f:6,r:'b7'}] },
          { name: '1st Inv', dots: [{s:3,f:2,r:'3'},{s:2,f:3,r:'b7'},{s:1,f:1,r:'R'},{s:0,f:3,r:'5'}] },
          { name: '2nd Inv', dots: [{s:3,f:5,r:'5'},{s:2,f:5,r:'R'},{s:1,f:5,r:'3'},{s:0,f:6,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:3,f:8,r:'b7'},{s:2,f:9,r:'3'},{s:1,f:8,r:'5'},{s:0,f:8,r:'R'}] },
        ]},
        { strings: [4,3,2,1], vc: [
          { name: 'Root',    dots: [{s:4,f:3,r:'R'},{s:3,f:5,r:'5'},{s:2,f:3,r:'b7'},{s:1,f:5,r:'3'}] },
          { name: '1st Inv', dots: [{s:4,f:7,r:'3'},{s:3,f:8,r:'b7'},{s:2,f:5,r:'R'},{s:1,f:8,r:'5'}] },
          { name: '2nd Inv', dots: [{s:4,f:10,r:'5'},{s:3,f:10,r:'R'},{s:2,f:9,r:'3'},{s:1,f:11,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:4,f:13,r:'b7'},{s:3,f:14,r:'3'},{s:2,f:12,r:'5'},{s:1,f:13,r:'R'}] },
        ]},
        { strings: [5,4,3,2], vc: [
          { name: 'Root',    dots: [{s:5,f:8,r:'R'},{s:4,f:10,r:'5'},{s:3,f:8,r:'b7'},{s:2,f:9,r:'3'}] },
          { name: '1st Inv', dots: [{s:5,f:12,r:'3'},{s:4,f:13,r:'b7'},{s:3,f:10,r:'R'},{s:2,f:12,r:'5'}] },
          { name: '2nd Inv', dots: [{s:5,f:3,r:'5'},{s:4,f:3,r:'R'},{s:3,f:2,r:'3'},{s:2,f:3,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:5,f:6,r:'b7'},{s:4,f:7,r:'3'},{s:3,f:5,r:'5'},{s:2,f:5,r:'R'}] },
        ]},
      ]
    },
    'maj7': {
      sets: [
        { strings: [3,2,1,0], vc: [
          { name: 'Root',    dots: [{s:3,f:10,r:'R'},{s:2,f:9,r:'3'},{s:1,f:8,r:'5'},{s:0,f:7,r:'7'}] },
          { name: '1st Inv', dots: [{s:3,f:2,r:'3'},{s:2,f:4,r:'7'},{s:1,f:1,r:'R'},{s:0,f:3,r:'5'}] },
          { name: '2nd Inv', dots: [{s:3,f:5,r:'5'},{s:2,f:5,r:'R'},{s:1,f:5,r:'3'},{s:0,f:7,r:'7'}] },
          { name: '3rd Inv', dots: [{s:3,f:9,r:'7'},{s:2,f:9,r:'3'},{s:1,f:8,r:'5'},{s:0,f:8,r:'R'}] },
        ]},
        { strings: [4,3,2,1], vc: [
          { name: 'Root',    dots: [{s:4,f:3,r:'R'},{s:3,f:5,r:'5'},{s:2,f:4,r:'7'},{s:1,f:5,r:'3'}] },
          { name: '1st Inv', dots: [{s:4,f:7,r:'3'},{s:3,f:9,r:'7'},{s:2,f:5,r:'R'},{s:1,f:8,r:'5'}] },
          { name: '2nd Inv', dots: [{s:4,f:10,r:'5'},{s:3,f:10,r:'R'},{s:2,f:9,r:'3'},{s:1,f:12,r:'7'}] },
          { name: '3rd Inv', dots: [{s:4,f:14,r:'7'},{s:3,f:14,r:'3'},{s:2,f:12,r:'5'},{s:1,f:13,r:'R'}] },
        ]},
        { strings: [5,4,3,2], vc: [
          { name: 'Root',    dots: [{s:5,f:8,r:'R'},{s:4,f:10,r:'5'},{s:3,f:9,r:'7'},{s:2,f:9,r:'3'}] },
          { name: '1st Inv', dots: [{s:5,f:0,r:'3'},{s:4,f:2,r:'7'},{s:3,f:5,r:'5'},{s:2,f:5,r:'R'}] },
          { name: '2nd Inv', dots: [{s:5,f:3,r:'5'},{s:4,f:3,r:'R'},{s:3,f:2,r:'3'},{s:2,f:4,r:'7'}] },
          { name: '3rd Inv', dots: [{s:5,f:7,r:'7'},{s:4,f:7,r:'3'},{s:3,f:5,r:'5'},{s:2,f:5,r:'R'}] },
        ]},
      ]
    },
    'm7': {
      sets: [
        { strings: [3,2,1,0], vc: [
          { name: 'Root',    dots: [{s:3,f:10,r:'R'},{s:2,f:8,r:'b3'},{s:1,f:8,r:'5'},{s:0,f:6,r:'b7'}] },
          { name: '1st Inv', dots: [{s:3,f:1,r:'b3'},{s:2,f:3,r:'b7'},{s:1,f:1,r:'R'},{s:0,f:3,r:'5'}] },
          { name: '2nd Inv', dots: [{s:3,f:5,r:'5'},{s:2,f:5,r:'R'},{s:1,f:4,r:'b3'},{s:0,f:6,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:3,f:8,r:'b7'},{s:2,f:8,r:'b3'},{s:1,f:8,r:'5'},{s:0,f:8,r:'R'}] },
        ]},
        { strings: [4,3,2,1], vc: [
          { name: 'Root',    dots: [{s:4,f:3,r:'R'},{s:3,f:5,r:'5'},{s:2,f:3,r:'b7'},{s:1,f:4,r:'b3'}] },
          { name: '1st Inv', dots: [{s:4,f:6,r:'b3'},{s:3,f:8,r:'b7'},{s:2,f:5,r:'R'},{s:1,f:8,r:'5'}] },
          { name: '2nd Inv', dots: [{s:4,f:10,r:'5'},{s:3,f:10,r:'R'},{s:2,f:8,r:'b3'},{s:1,f:11,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:4,f:13,r:'b7'},{s:3,f:13,r:'b3'},{s:2,f:12,r:'5'},{s:1,f:13,r:'R'}] },
        ]},
        { strings: [5,4,3,2], vc: [
          { name: 'Root',    dots: [{s:5,f:8,r:'R'},{s:4,f:10,r:'5'},{s:3,f:8,r:'b7'},{s:2,f:8,r:'b3'}] },
          { name: '1st Inv', dots: [{s:5,f:11,r:'b3'},{s:4,f:13,r:'b7'},{s:3,f:10,r:'R'},{s:2,f:12,r:'5'}] },
          { name: '2nd Inv', dots: [{s:5,f:3,r:'5'},{s:4,f:3,r:'R'},{s:3,f:1,r:'b3'},{s:2,f:3,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:5,f:6,r:'b7'},{s:4,f:6,r:'b3'},{s:3,f:5,r:'5'},{s:2,f:5,r:'R'}] },
        ]},
      ]
    },
    'm7b5': {
      sets: [
        { strings: [3,2,1,0], vc: [
          { name: 'Root',    dots: [{s:3,f:10,r:'R'},{s:2,f:8,r:'b3'},{s:1,f:7,r:'b5'},{s:0,f:6,r:'b7'}] },
          { name: '1st Inv', dots: [{s:3,f:1,r:'b3'},{s:2,f:3,r:'b7'},{s:1,f:1,r:'R'},{s:0,f:2,r:'b5'}] },
          { name: '2nd Inv', dots: [{s:3,f:4,r:'b5'},{s:2,f:5,r:'R'},{s:1,f:4,r:'b3'},{s:0,f:6,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:3,f:8,r:'b7'},{s:2,f:8,r:'b3'},{s:1,f:7,r:'b5'},{s:0,f:8,r:'R'}] },
        ]},
        { strings: [4,3,2,1], vc: [
          { name: 'Root',    dots: [{s:4,f:3,r:'R'},{s:3,f:4,r:'b5'},{s:2,f:3,r:'b7'},{s:1,f:4,r:'b3'}] },
          { name: '1st Inv', dots: [{s:4,f:6,r:'b3'},{s:3,f:8,r:'b7'},{s:2,f:5,r:'R'},{s:1,f:7,r:'b5'}] },
          { name: '2nd Inv', dots: [{s:4,f:9,r:'b5'},{s:3,f:10,r:'R'},{s:2,f:8,r:'b3'},{s:1,f:11,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:4,f:13,r:'b7'},{s:3,f:13,r:'b3'},{s:2,f:11,r:'b5'},{s:1,f:13,r:'R'}] },
        ]},
        { strings: [5,4,3,2], vc: [
          { name: 'Root',    dots: [{s:5,f:8,r:'R'},{s:4,f:9,r:'b5'},{s:3,f:8,r:'b7'},{s:2,f:8,r:'b3'}] },
          { name: '1st Inv', dots: [{s:5,f:11,r:'b3'},{s:4,f:13,r:'b7'},{s:3,f:10,r:'R'},{s:2,f:11,r:'b5'}] },
          { name: '2nd Inv', dots: [{s:5,f:2,r:'b5'},{s:4,f:3,r:'R'},{s:3,f:1,r:'b3'},{s:2,f:3,r:'b7'}] },
          { name: '3rd Inv', dots: [{s:5,f:6,r:'b7'},{s:4,f:6,r:'b3'},{s:3,f:4,r:'b5'},{s:2,f:5,r:'R'}] },
        ]},
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
    'R':  { fill: '#f5a623', stroke: '#e09310', textFill: '#fff' },
    '3':  { fill: '#0284c7', stroke: '#0369a1', textFill: '#fff' },
    'b3': { fill: '#0284c7', stroke: '#0369a1', textFill: '#fff' },
    '5':  { fill: '#38bdf8', stroke: '#0ea5e9', textFill: '#fff' },
    'b5': { fill: '#38bdf8', stroke: '#0ea5e9', textFill: '#fff' },
    '#5': { fill: '#38bdf8', stroke: '#0ea5e9', textFill: '#fff' },
    '7':  { fill: '#bae6fd', stroke: '#7dd3fc', textFill: '#0369a1' },
    'b7': { fill: '#bae6fd', stroke: '#7dd3fc', textFill: '#0369a1' },
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
    const is7th = _is7thChord(_triadType);
    const _7thLabels = { '123': '1-2-3-4', '234': '2-3-4-5', '345': '3-4-5-6' };
    const strLabel = is7th ? _7thLabels[_triadStrGroup] || _triadStrGroup : _triadStrGroup.split('').join('-');
    // RiffForge: activeStrings Set (sIdx 기준, 0=6번줄)
    // v9 strings = [2,1,0] → rfSIdx = [3,4,5]
    const activeStrings = new Set(strSet.strings.map(v9s => 5 - v9s));

    // 전위명 매핑
    const INV_NAME_MAP = { 'Root': 'root', '1st Inv': '1st', '2nd Inv': '2nd' };
    const invLabels = {
      root:  `Root Position · ${strLabel}번줄`,
      '1st': `1st Inversion · ${strLabel}번줄`,
      '2nd': `2nd Inversion · ${strLabel}번줄`,
      '3rd': `3rd Inversion · ${strLabel}번줄`,
    };


       const voicings = [
      { key: 'root', shiftedVc: shifted.find(v => v.name === 'Root') },
      { key: '1st',  shiftedVc: shifted.find(v => v.name === '1st Inv') },
      { key: '2nd',  shiftedVc: shifted.find(v => v.name === '2nd Inv') },
      { key: '3rd',  shiftedVc: shifted.find(v => v.name === '3rd Inv') },
    ];

    // ── All 모드: 단일 지판에 모든 inversion 합쳐서 표시 ──────────
    if (_triadVoicing === 'all') {
      ['1st', '2nd', '3rd'].forEach(k => {
        const w = document.getElementById(`triad-fb-${k}-wrap`);
        if (w) w.style.display = 'none';
      });
      const rootWrap = document.getElementById('triad-fb-root-wrap');
      if (rootWrap) rootWrap.style.display = '';
      const lbl = document.getElementById('triad-fb-root-label');
      if (lbl) lbl.textContent = `All Inversions · ${strLabel}번줄`;

      const INV_COLORS = {
        root: { fill: '#f59e0b', stroke: '#d97706', textFill: '#fff' },
        '1st': { fill: '#0ea5e9', stroke: '#0284c7', textFill: '#fff' },
        '2nd': { fill: '#10b981', stroke: '#059669', textFill: '#fff' },
        '3rd': { fill: '#8b5cf6', stroke: '#7c3aed', textFill: '#fff' },
      };

      const allDotMap = new Map();
      const chordNoteMap = new Map();
      voicings.forEach(({ key, shiftedVc }) => {
        if (!shiftedVc) return;
        shiftedVc.dots.forEach(d => {
          allDotMap.set(`${5 - d.s}-${d.f}`, { invKey: key, r: d.r });
          chordNoteMap.set(CONFIG.NOTES[(V9_OPEN[d.s] + d.f) % 12], d.r);
        });
      });

      Fretboard.render('triad-fb-root', {
        rootNote: _triadRoot,
        startFret: 0, endFret: 17,
        chordNoteMap, activeStrings,
        noteColorFn: (fret, sIdx, note) => {
          const info = allDotMap.get(`${sIdx}-${fret}`);
          if (!info) return { fill: '#d1d5db', stroke: '#9ca3af', textFill: '#9ca3af', dotR: 8, label: note, opacity: 0.08 };
          const c = INV_COLORS[info.invKey] || INV_COLORS.root;
          return { fill: c.fill, stroke: c.stroke, textFill: c.textFill, dotR: info.r === 'R' ? 11 : 9, label: _triadLabelMode === 'note' ? note : info.r, opacity: 1 };
        },
        labelMode: 'note',
      });

      document.getElementById('triad-role-legend')?.style && (document.getElementById('triad-role-legend').style.display = 'none');
      document.getElementById('triad-inv-legend')?.style && (document.getElementById('triad-inv-legend').style.display = '');
      return;
    }

    document.getElementById('triad-role-legend')?.style && (document.getElementById('triad-role-legend').style.display = '');
    document.getElementById('triad-inv-legend')?.style && (document.getElementById('triad-inv-legend').style.display = 'none');

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
// 변경 후 (major와 동일한 창 오프셋 — 박스 경계는 스케일 타입 무관)
const PENTA_POS_OFFSETS = {
  major: [0, 2, 4, 7, 9],
  minor: [0, 2, 4, 7, 9],
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
  const r6E = (rootSemi - 4 + 12) % 12;

  const SHAPES = {
    minor: [
      [[0,3],[0,3],[0,2],[0,2],[0,2],[0,3]],
      [[3,5],[3,5],[2,4],[2,5],[2,5],[3,5]],
      [[5,7],[5,8],[4,7],[5,7],[5,7],[5,7]],
      [[7,10],[8,10],[7,9],[7,9],[7,10],[7,10]],
      [[10,12],[10,12],[9,12],[9,12],[10,12],[10,12]],
    ],
    major: [
      [[0,2],[0,2],[-1,1],[-1,2],[-1,2],[0,2]],
      [[2,4],[2,5],[1,4],[2,4],[2,4],[2,4]],
      [[4,7],[5,7],[4,6],[4,6],[4,7],[4,7]],
      [[7,9],[7,9],[6,9],[6,9],[7,9],[7,9]],
      [[9,12],[9,12],[9,11],[9,11],[9,11],[9,12]],
    ],
  };

  const shapes = SHAPES[mode] || SHAPES.minor;

  return shapes.map((stringOffsets, pi) => {
    const rawNotes = [];
    for (let si = 0; si < 6; si++) {
      const [offLo, offHi] = stringOffsets[si];
      [offLo, offHi].forEach(off => rawNotes.push({ si, fret: r6E + off, interval: off }));
    }

    // 포지션 전체를 옥타브 이동
    const rawMax = Math.max(...rawNotes.map(n => n.fret));
    const rawMin = Math.min(...rawNotes.map(n => n.fret));
    const shift = rawMax > 17 ? -12 : rawMin < 0 ? 12 : 0;
    const mainNotes = rawNotes.map(({ si, fret, interval }) => ({ si, fret: fret + shift, interval }));

    // 옥타브 확장: ≥12 프렛은 -12 버전도, ≤4 프렛은 +12 버전도 추가
    const seen = new Set();
    const allNotes = [];
    function addNote(si, fret, interval) {
      if (fret < 0 || fret > 17) return;
      const k = `${si}-${fret}`;
      if (seen.has(k)) return;
      seen.add(k);
      allNotes.push({ si, fret, interval });
    }
    mainNotes.forEach(({ si, fret, interval }) => {
      addNote(si, fret, interval);
      if (fret >= 12) addNote(si, fret - 12, interval);
      if (fret <= 4)  addNote(si, fret + 12, interval);
    });

    const mainFrets = mainNotes.map(n => n.fret);
    return {
      pos: pi + 1,
      start: Math.min(...mainFrets),  // 범례 표시용 (원래 범위 유지)
      end: Math.max(...mainFrets),
      notes: allNotes,
    };
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
    const _rawKey = document.getElementById('penta-key-root')?.value || 'A';
    const rootNote = {'C#':'Db','D#':'Eb','F#':'Gb','G#':'Ab','A#':'Bb'}[_rawKey] || _rawKey;
    const positions = _getPentaPositions(rootNote, mode);

    const dotPosSet = new Map();
    positions.forEach(posData => {
      posData.notes.forEach(({ si, fret }) => {
        const k = `${5 - si}-${fret}`;
        if (!dotPosSet.has(k)) dotPosSet.set(k, new Set());
        dotPosSet.get(k).add(posData.pos);
      });
    });

    const scaleName = mode === 'major' ? 'Major Pentatonic' : 'Minor Pentatonic';

    // 인접 포지션 쌍 (5→1 wrap 포함)
    const ADJ = new Set(['1-2', '2-3', '3-4', '4-5', '5-1']);

    function _pairKey(set) {
      const [a, b] = [...set].sort((x, y) => x - y);
      return (a === 1 && b === 5) ? '5-1' : `${a}-${b}`;
    }

    // 실제 등장하는 인접 쌍만 수집해서 gradientDefs 생성
    const usedGrads = new Set();
    dotPosSet.forEach(set => {
      if (set.size === 2) {
        const pk = _pairKey(set);
        if (ADJ.has(pk)) usedGrads.add(pk);
      }
    });

    const gradientDefs = [...usedGrads].map(pk => {
      const [p1, p2] = pk === '5-1' ? [5, 1] : pk.split('-').map(Number);
      const c1 = _PENTA_POS_COLORS[p1];
      const c2 = _PENTA_POS_COLORS[p2];
      return {
        id: `pg-${pk}`,
        x1: '0%', y1: '0%', x2: '100%', y2: '0%',
        stops: [
          { offset: '0%',   color: c1.fill },
          { offset: '50%',  color: c1.fill },
          { offset: '50%',  color: c2.fill },
          { offset: '100%', color: c2.fill },
        ],
      };
    });

    const noteColorFn = (fret, sIdx, note, _role) => {
      const k = `${sIdx}-${fret}`;
      const set = dotPosSet.get(k);
      if (!set || set.size === 0) {
        return { fill: '#d1d5db', stroke: '#9ca3af', textFill: '#9ca3af', dotR: 8, label: note, opacity: 0.15 };
      }
      const isActive = _pentaPos === 0 || set.has(_pentaPos);
      const isRoot = note === rootNote;

      // All 뷰 + 인접 2포지션 공유 → 그라데이션
      if (_pentaPos === 0 && set.size === 2) {
        const pk = _pairKey(set);
        if (ADJ.has(pk)) {
          const p1 = pk === '5-1' ? 5 : Number(pk[0]);
          const c1 = _PENTA_POS_COLORS[p1];
          return {
            fill: `url(#pg-${pk})`,
            stroke: c1.stroke,
            textFill: '#fff',
            dotR: isRoot ? 11 : 9,
            label: note,
            opacity: 1,
          };
        }
      }

      const displayPos = (_pentaPos !== 0 && set.has(_pentaPos)) ? _pentaPos : Math.min(...set);
      const c = _PENTA_POS_COLORS[displayPos];
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
      noteColorFn, gradientDefs,
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
    const roles = ['root', 'third', 'fifth', 'seventh', 'ninth'];
    const ri = CONFIG.NOTES.indexOf(root);
    const map = new Map();
    intervals.forEach((iv, i) => map.set(CONFIG.NOTES[(ri + iv) % 12], roles[i]));
    return map;
  }

const _CT_COLORS = {
  root:    { fill: '#f97316', stroke: '#c2410c', textFill: '#fff' },
  third:   { fill: '#bae6fd', stroke: '#0284c7', textFill: '#0c4a6e' },
  fifth:   { fill: '#38bdf8', stroke: '#0369a1', textFill: '#fff' },
  seventh: { fill: '#3b82f6', stroke: '#1d4ed8', textFill: '#fff' },
  ninth:   { fill: '#818cf8', stroke: '#4338ca', textFill: '#fff' },
};
  const _CT_LBL = { root: 'R', third: '3', fifth: '5', seventh: '7', ninth: '9' };
  const _SEMI_LBL = { 0: 'R', 1: '♭2', 2: '2', 3: '♭3', 4: '3', 5: '4', 6: '♭5', 7: '5', 8: '♭6', 9: '6', 10: '♭7', 11: '7', 14: '9' };

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
const roleColors = ['bg-orange-500', 'bg-sky-200', 'bg-sky-400', 'bg-blue-500', 'bg-indigo-400'];
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
  const semi = (CONFIG.NOTES.indexOf(note) - CONFIG.NOTES.indexOf(rootNote) + 12) % 12;
  const isLight = semi === 2 || semi === 8 || semi === 9; // 2도, b6도, 6도
  const activeFill   = isRoot ? '#f97316' : isLight ? '#bae6fd' : '#60a5fa';
  const activeStroke = isRoot ? '#c2410c' : isLight ? '#0284c7' : '#2563eb';
  const activeText   = isRoot ? '#fff'    : isLight ? '#0c4a6e' : '#fff';
  return {
    fill: inZone ? activeFill : '#d1d5db',
    stroke: inZone ? activeStroke : '#9ca3af',
    textFill: inZone ? activeText : '#9ca3af',
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
const VCOLS = { all: 'bg-gray-700', root: 'bg-amber-500', '1st': 'bg-indigo-500', '2nd': 'bg-emerald-500', '3rd': 'bg-rose-500' };
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
  function setTriadLabelMode(mode) {
    _triadLabelMode = mode;
    document.querySelectorAll('.label-mode-btn').forEach(btn => {
      const on = btn.dataset.lmode === mode;
      btn.className = `label-mode-btn text-xs px-3 py-1.5 rounded-lg font-bold border transition-all ${
        on ? 'bg-amber-500 text-white border-transparent'
           : 'bg-white text-gray-600 border-gray-200 hover:bg-amber-50'
      }`;
    });
    renderTriadDiagram();
  }

  function setTriadType(type) {
    _triadType = type;
    document.querySelectorAll('.triad-type-btn').forEach(btn => {
      const on = btn.dataset.ttype === type;
      btn.classList.toggle('bg-amber-500', on); btn.classList.toggle('text-white', on);
      btn.classList.toggle('bg-white', !on); btn.classList.toggle('text-gray-600', !on);
      btn.classList.toggle('border', !on);
    });
    _sync7thUI(_is7thChord(type));
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
  function setPentaView(view) {
    _pentaView = view;
    document.querySelectorAll('.penta-view-btn').forEach(btn => {
      const on = btn.dataset.pview === view;
      btn.classList.toggle('bg-amber-500', on);
      btn.classList.toggle('text-white', on);
      btn.classList.toggle('border-transparent', on);
      btn.classList.toggle('bg-white', !on);
      btn.classList.toggle('text-gray-600', !on);
      btn.classList.toggle('border-gray-200', !on);
    });
    renderPentaPositions();
  }

  function setPentaLabel(label) {
    _pentaLabel = label;
    document.querySelectorAll('.penta-label-btn').forEach(btn => {
      const on = btn.dataset.plabel === label;
      btn.classList.toggle('bg-amber-500', on);
      btn.classList.toggle('text-white', on);
      btn.classList.toggle('border-transparent', on);
      btn.classList.toggle('bg-white', !on);
      btn.classList.toggle('text-gray-600', !on);
      btn.classList.toggle('border-gray-200', !on);
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
    setTriadRoot, setTriadType, setTriadVoicing, setTriadStringGroup, setTriadLabelMode,
    setPentaPos, setPentaKey, setPentaView, setPentaLabel,
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
  let _topPosts = [];       // 실시간 구독 최신 10개
  let _olderPosts = [];     // 더보기로 로드된 이전 글
  let _lastDoc = null;      // 페이지네이션 커서
  let _hasMore = true;
  let _loadingMore = false;
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
    const sessionCount = log.sessions?.length || 0;
    const allDone = log.allCompleted;
    const line1 = `⏱️ ${log.totalMin}분 연습${sessionCount > 0 ? ` | 🎯 ${sessionCount}개 세션${allDone ? ' 전체 완료 ✅' : ''}` : ''}`;
    const line2 = log.achievement ? `💬 ${log.achievement}` : log.goal ? `🎯 목표: ${log.goal}` : null;
    return line2 ? `${line1}\n${line2}` : line1;
  }


  // ── 글 쓰기 ──────────────────────────────────────────────────────────────
  async function addPost() {
    const ta = document.getElementById('board-post-input');
    const content = ta?.value.trim();
    if (!content) { showToast('내용을 입력해 주세요.', 'warning'); return; }

     const todayMin = AppState.getTodayMin();
    const attachOn = document.getElementById('board-attach-toggle')?.checked ?? true;
    const summary = attachOn ? _buildPracticeSummary() : null;
    const post = {
      id: _newId(),
      authorId: AppState.getUserId(),
      authorName: Storage.get(CONFIG.KEYS.USERNAME, '') || '익명',
      authorAvatar: Storage.get(CONFIG.KEYS.AVATAR, '🎸'),
      content: summary
        ? `${content}\n\n📋 ${summary}`
        : content,
      createdAt: new Date().toISOString(),
      likes: [],
      comments: [],
      badge: todayMin >= 30 ? `오늘 ${todayMin}분 연습 완료 🔥` : null,
    };

    if (ta) { ta.value = ''; _updateCharCount(''); }
    document.getElementById('board-practice-preview')?.remove();
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
    const prev = document.getElementById('board-practice-preview');
    if (prev) { prev.remove(); return; }
    const el = document.createElement('div');
    el.id = 'board-practice-preview';
    el.className = 'mt-2 px-3 py-2 bg-orange-50 border border-orange-100 rounded-xl text-xs text-orange-700 whitespace-pre-line';
    el.textContent = summary;
    document.getElementById('board-post-input')?.insertAdjacentElement('afterend', el);
  }

  // ── 피드 헤더 동기화 ─────────────────────────────────────────────────────
  function refreshMyInfo() {
    const avatar = Storage.get(CONFIG.KEYS.AVATAR, '🎸');
    const name = Storage.get(CONFIG.KEYS.USERNAME, '') || '나';
    const el1 = document.getElementById('board-my-avatar');
    const el2 = document.getElementById('board-my-name');
    if (el1) el1.innerHTML = _renderAvatarHtml(avatar, 'w-7 h-7');
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
    const combined = [..._topPosts, ..._olderPosts.filter(p => !_topPosts.some(t => t.id === p.id))];
    const raw = postsOverride || (combined.length ? combined : _getLocal());
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
              <span class="text-base leading-none mt-0.5 shrink-0">${_renderAvatarHtml(c.authorAvatar, 'w-5 h-5')}</span>
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
            <span class="text-2xl leading-none">${_renderAvatarHtml(p.authorAvatar, 'w-7 h-7')}</span>
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
    // 더보기 버튼 (postsOverride 없을 때만 표시)
    if (!postsOverride) {
      const moreWrap = document.createElement('div');
      moreWrap.style.cssText = 'text-align:center;margin-top:12px;padding-bottom:8px;';
      if (_hasMore) {
        const btn = document.createElement('button');
        btn.id = 'board-load-more-btn';
        btn.onclick = function() { CrewBoard.loadMore(); };
        btn.className = 'px-5 py-2 rounded-xl bg-gray-100 text-gray-500 text-sm font-bold hover:bg-amber-50 hover:text-amber-600 transition-colors';
        btn.textContent = '이전 글 더보기';
        moreWrap.appendChild(btn);
      } else if (_olderPosts.length > 0) {
        moreWrap.style.fontSize = '11px';
        moreWrap.style.color = '#d1d5db';
        moreWrap.textContent = '모든 글을 불러왔습니다';
      }
      feed.appendChild(moreWrap);
    }
  }
  // ── 최초 로드 ────────────────────────────────────────────────────────────
  async function init() {
    render(_getLocal());
    FireDB.onReady(() => {
      _unsubscribeBoard = FireDB.subscribeBoard((posts, lastDoc) => {
        _topPosts = posts;
        if (_olderPosts.length === 0) _lastDoc = lastDoc; // 첫 로드 시만 커서 업데이트
        _setLocal([..._topPosts, ..._olderPosts]);
        render();
      });
    });
  }
  async function loadMore() {
    if (_loadingMore || !_hasMore || !_lastDoc) return;
    _loadingMore = true;
    const btn = document.getElementById('board-load-more-btn');
    if (btn) { btn.textContent = '불러오는 중...'; btn.disabled = true; }

    const result = await FireDB.fetchPostsPage(_lastDoc, 4);

    // 중복 제거
    const existingIds = new Set([..._topPosts, ..._olderPosts].map(p => p.id));
    _olderPosts = [..._olderPosts, ...result.posts.filter(p => !existingIds.has(p.id))];
    _lastDoc = result.lastDoc;
    _hasMore = result.hasMore;
    _loadingMore = false;

    _setLocal([..._topPosts, ..._olderPosts]);
    render();
  }


   // ── 내 프로필(아바타/닉네임) 변경 시 게시판 일괄 갱신 ─────────────────────
  async function updateMyAuthorInfo(newAvatar, newName) {
    if (typeof FireDB === 'undefined' || !FireDB.isReady() || !FireDB.getUsername()) return;
    const myId = AppState.getUserId();
    const myName = newName || Storage.get(CONFIG.KEYS.USERNAME, '');
    const matches = (a) =>
      a && (a.authorId === myId || (myName && a.authorName === myName));

    let posts = [];
    try { posts = await FireDB.fetchPosts(); } catch { return; }

    const writes = [];
    posts.forEach(p => {
      let touched = false;
      if (matches(p)) {
        if (p.authorAvatar !== newAvatar) { p.authorAvatar = newAvatar; touched = true; }
        if (p.authorName !== myName) { p.authorName = myName; touched = true; }
      }
      if (Array.isArray(p.comments)) {
        p.comments.forEach(c => {
          if (matches(c)) {
            if (c.authorAvatar !== newAvatar) { c.authorAvatar = newAvatar; touched = true; }
            if (c.authorName !== myName) { c.authorName = myName; touched = true; }
          }
        });
      }
      if (touched) {
        writes.push(FireDB.updatePost(p.id, {
          authorAvatar: p.authorAvatar,
          authorName: p.authorName,
          comments: p.comments || [],
        }));
      }
    });

    if (writes.length) {
      await Promise.all(writes).catch(() => {});
      _setLocal(posts);
      render(posts);
    }
  }

  // ── 30초마다 자동 폴링 ───────────────────────────────────────────────────
  function startPolling() {
    // Firestore 실시간 구독으로 대체 — 폴링 불필요
  }

  return {
    init, render, refreshMyInfo, startPolling, loadMore,
    addPost, toggleLike, addComment, quickReact,
    setSortMode, deletePost, startEdit, saveEdit, cancelEdit,
    deleteComment, startEditComment, saveEditComment, cancelEditComment,
    previewPractice,
    updateMyAuthorInfo,
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
function showGuidePopup() {
  const existing = document.getElementById('guide-popup');
  if (existing) { existing.remove(); return; }
  const popup = document.createElement('div');
  popup.id = 'guide-popup';
  popup.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';

  const inner = document.createElement('div');
  inner.className = 'absolute inset-0 bg-black/40';
  inner.onclick = function() { popup.remove(); };
  popup.appendChild(inner);

  const box = document.createElement('div');
  box.className = 'relative bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full z-10 max-h-[85vh] overflow-y-auto';
  box.innerHTML =
    '<div class="flex items-center justify-between mb-4">' +
      '<h3 class="font-black text-gray-800 text-base">🎸 시작 가이드</h3>' +
      '<button onclick="document.getElementById(\'guide-popup\').remove()" class="text-gray-300 hover:text-gray-500 text-xl font-bold">✕</button>' +
    '</div>' +
    '<div class="space-y-4 text-sm text-gray-600">' +
      '<div><p class="font-black text-gray-800 mb-0.5">① 이름 등록</p>' +
      '<p>대시보드 상단 인사말 클릭 → 이름 입력. 내 기록이 서버에 저장됩니다.</p></div>' +
      '<div><p class="font-black text-gray-800 mb-0.5">② 연습일지 쓰기 ← 핵심!</p>' +
      '<p><b>연습일지</b> → 세션 추가(워밍업/이론/실전) → 분 입력 → 저장. 저장마다 XP와 물주기가 쌓입니다.</p></div>' +
      '<div><p class="font-black text-gray-800 mb-0.5">③ 연습곡 관리</p>' +
      '<p><b>연습곡 관리</b> → 곡 추가 → 슬라이더로 완성도 조절. Learning → Mastered 단계로 성장을 추적합니다.</p></div>' +
      '<div><p class="font-black text-gray-800 mb-0.5">④ 나무 키우기</p>' +
      '<p>30분 이상 연습하면 나무에 물이 줍니다. 연속 출석은 하루 빠지면 0 리셋!</p></div>' +
      '<div><p class="font-black text-gray-800 mb-0.5">⑤ 스튜디오</p>' +
      '<p><b>메트로놈 & 백킹</b>에서 박자 + 코드 반주를 함께 틀 수 있습니다.</p></div>' +
      '<div><p class="font-black text-gray-800 mb-0.5">⑥ 주간 챌린지</p>' +
      '<p>대시보드에 매주 챌린지 3개. 달성하면 즉시 XP 보상!</p></div>' +
      '<div class="bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">' +
        '💡 <b>달력</b>에서 지난 연습 확인·수정·삭제<br>' +
        '💡 <b>성장 스토리</b>에서 나의 전체 여정 확인' +
      '</div>' +
    '</div>';

  popup.appendChild(box);
  document.body.appendChild(popup);
}
