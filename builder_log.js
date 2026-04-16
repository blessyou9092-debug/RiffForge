/**
 * RiffForge - builder_log.js
 * 연습 빌더, KPT 회고, 달력 렌더링, JSON I/O
 */

const Storage = {
  // ── localStorage (기존 호환 유지) ────────────────────────────────
  get(key, fallback = null) {
    try { const v = localStorage.getItem(key); return v !== null ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { }
  },

  // ── 연습일지: localStorage 즉시 + Firestore 비동기 병행 ───────────
  getLog(dateStr) {
    return this.get(CONFIG.KEYS.PRACTICE_LOG + dateStr, null);
  },
  setLog(dateStr, data) {
    // 1) localStorage에 즉시 저장 (UI 반응 빠르게)
    this.set(CONFIG.KEYS.PRACTICE_LOG + dateStr, data);
    // 2) Firestore에 비동기 저장 (백그라운드)
    if (typeof FireDB !== 'undefined' && FireDB.isReady() && FireDB.getUsername()) {
      FireDB.saveLog(dateStr, data).catch(e => console.warn('log sync 실패:', e));
    }
  },
  deleteLog(dateStr) {
    localStorage.removeItem(CONFIG.KEYS.PRACTICE_LOG + dateStr);
    if (typeof FireDB !== 'undefined' && FireDB.isReady() && FireDB.getUsername()) {
      FireDB.deleteLog(dateStr).catch(e => console.warn('log delete 실패:', e));
    }
  },

  // ── Firestore에서 전체 일지 동기화 (앱 시작 시 1회 호출) ─────────
  async syncLogsFromCloud() {
    if (typeof FireDB === 'undefined' || !FireDB.getUsername()) return;
    try {
      const logs = await FireDB.loadAllLogs();
      logs.forEach(log => {
        if (log.date) this.set(CONFIG.KEYS.PRACTICE_LOG + log.date, log);
      });
      console.log(`[Storage] 연습일지 ${logs.length}개 클라우드 동기화 완료`);
    } catch (e) { console.warn('[Storage] syncLogsFromCloud 실패:', e); }
  },
};
// ═══════════════════════════════════════════════════════════════════════════
// PracticeBuilder: 연습 빌더 모듈
// ═══════════════════════════════════════════════════════════════════════════
const PracticeBuilder = (() => {
  let sessions = [];   // 현재 편집 중인 세션 목록
  let editingDate = getTodayStr();
  let _routinePresets = [];

  // ── 날짜 유틸 ────────────────────────────────────────────────────
  function getTodayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

  // ── 세션 ID 생성 ────────────────────────────────────────────────
  let _idSeq = 0;
  function newId() { return `s${Date.now()}_${_idSeq++}`; }

  // ── 세션 팩토리 ──────────────────────────────────────────────────
  function createSession(type, templateItem) {
    const tpl = CONFIG.SESSION_TEMPLATES[type];
    const item = templateItem || tpl.items[0];
    return {
      id: newId(), type,
      name: item.name, detail: item.detail, minutes: item.defaultMin,
      reps: [], repsCount: 5, repsVisible: false,
      memo: '', key: '', tags: [], completed: false,
    };
  }


  // ── 자동 추천 3세트 ──────────────────────────────────────────────
  function recommendSessions() {
    const warmup = CONFIG.SESSION_TEMPLATES.warmup;
    const theory = CONFIG.SESSION_TEMPLATES.theory;
    const practical = CONFIG.SESSION_TEMPLATES.practical;

    // 이전 기록을 분석해 덜 연습한 항목 추천 (간단 랜덤)
    const wItem = warmup.items[Math.floor(Math.random() * warmup.items.length)];
    const tItem = theory.items[Math.floor(Math.random() * theory.items.length)];
    const pItem = practical.items[Math.floor(Math.random() * practical.items.length)];

    sessions = [
      createSession('warmup', wItem),
      createSession('theory', tItem),
      createSession('practical', pItem),
    ];
    renderSessions();
  }

  // ── 세션 추가 ────────────────────────────────────────────────────
  function addSession(type) {
    const tpl = CONFIG.SESSION_TEMPLATES[type];
    const item = tpl.items[Math.floor(Math.random() * tpl.items.length)];
    sessions.push(createSession(type, item));
    renderSessions();
  }

  // ── 세션 삭제 ────────────────────────────────────────────────────
  function removeSession(id) {
    sessions = sessions.filter(s => s.id !== id);
    renderSessions();
  }

  // ── 세션 완료 토글 ───────────────────────────────────────────────
  function toggleSessionComplete(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    s.completed = !s.completed;
    // 카드 전체를 재렌더 없이 DOM만 업데이트
    const card = document.getElementById(`session-${id}`);
    if (!card) return;
    _applyCompletedStyle(card, s.completed, s.type);
    _updateCompleteBtn(card, s.completed);
    _updateAllCompleteStatus();
  }
// ★ 추가: 포모도로에서 호출 — 이미 완료면 무시, 아니면 완료 처리 + 로컬 저장
function markSessionComplete(id) {
  const s = sessions.find(x => x.id === id);
  if (!s || s.completed) return;
  s.completed = true;
  const card = document.getElementById(`session-${id}`);
  if (card) { _applyCompletedStyle(card, true, s.type); _updateCompleteBtn(card, true); }
  // 로컬 스토리지에 조용히 저장 (toast 없이)
  const log = Storage.getLog(editingDate) || {};
  log.sessions = [...sessions];
  log.allCompleted = sessions.length > 0 && sessions.every(s => s.completed);
  Storage.setLog(editingDate, log);
}
  // ── 완료 시각 스타일 ─────────────────────────────────────────────
  function _applyCompletedStyle(card, completed, type) {
    const overlayId = `complete-overlay-${card.id.replace('session-', '')}`;
    let overlay = card.querySelector('.complete-overlay');
    if (completed) {
      card.style.opacity = '0.72';
      card.style.filter = 'grayscale(0.25)';
      if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'complete-overlay absolute inset-0 rounded-2xl pointer-events-none';
        overlay.style.background = 'rgba(34,197,94,0.06)';
        overlay.style.border = '2px solid rgba(34,197,94,0.35)';
        card.style.position = 'relative';
        card.appendChild(overlay);
      }
    } else {
      card.style.opacity = '';
      card.style.filter = '';
      card.style.position = '';
      overlay?.remove();
    }
  }

  function _updateCompleteBtn(card, completed) {
    const btn = card.querySelector('.complete-btn');
    if (!btn) return;
    if (completed) {
      btn.textContent = '✅ 완료됨';
      btn.className = 'complete-btn text-xs px-3 py-1 rounded-xl font-black bg-green-500 text-white transition-all';
    } else {
      btn.textContent = '완료';
      btn.className = 'complete-btn text-xs px-3 py-1 rounded-xl font-bold border border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all';
    }
  }

  function _updateAllCompleteStatus() {
    if (sessions.length === 0) return;
    const allDone = sessions.every(s => s.completed);
    const saveBtn = document.querySelector('#page-builder .save-practice-btn');
    if (saveBtn) {
      if (allDone) {
        saveBtn.classList.add('ring-4', 'ring-green-300');
        saveBtn.textContent = '🎉 모든 세션 완료! 저장하기';
      } else {
        saveBtn.classList.remove('ring-4', 'ring-green-300');
        saveBtn.textContent = '💧 오늘 연습 저장하기';
      }
    }
  }

  // ── 분 조절 ──────────────────────────────────────────────────────
  function adjustMinutes(id, delta) {
    const s = sessions.find(s => s.id === id);
    if (s) { s.minutes = Math.max(5, s.minutes + delta); }
    renderSessionCard(id);
  }

  // ── 렙 체크 토글 ─────────────────────────────────────────────────
  function toggleRep(id, idx) {
    const s = sessions.find(s => s.id === id);
    if (s) s.reps[idx] = !s.reps[idx];
    renderSessionCard(id);
  }
  function toggleRepsVisible(id) {
    const s = sessions.find(s => s.id === id);
    if (!s) return;
    s.repsVisible = !s.repsVisible;
    renderSessions();
  }

  function adjustRepsCount(id, delta) {
    const s = sessions.find(s => s.id === id);
    if (!s) return;
    s.repsCount = Math.max(1, Math.min(10, (s.repsCount || 5) + delta));
    s.reps = Array(s.repsCount).fill(false).map((_, i) => s.reps[i] || false);
    renderSessions();
  }

  function setCustomName(id, value) {
    const s = sessions.find(s => s.id === id);
    if (s && value.trim()) { s.name = value.trim(); }
  }

  // ── 총 연습 시간 계산 ────────────────────────────────────────────
  function getTotalMinutes() {
    return sessions.reduce((sum, s) => sum + s.minutes, 0);
  }

  // ── 태그 파싱 ────────────────────────────────────────────────────
  function parseTags(text) {
    const tags = [];
    const re = /#[\wㄱ-힣]+/g;
    let m;
    while ((m = re.exec(text)) !== null) tags.push(m[0]);
    return tags;
  }

  // ── 연습 저장 ────────────────────────────────────────────────────
  function clearAllSessions() {
    if (sessions.length === 0) return;
    sessions = [];
    renderSessions();
    showToast('🗑️ 모든 세션이 삭제되었어요.', 'info');
  }
// ── 과거 루틴 불러오기 ───────────────────────────────────────────────
function loadRoutineFrom(type) {
  const d = new Date();
  if (type === 'yesterday') d.setDate(d.getDate() - 1);
  else if (type === 'lastweek') d.setDate(d.getDate() - 7);
  const targetDate = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  const log = Storage.getLog(targetDate);
  if (!log || !log.sessions?.length) {
    showToast(`${type === 'yesterday' ? '어제' : '지난주 같은 요일'} 기록이 없어요`, 'warning');
    return;
  }
  const label = type === 'yesterday' ? '어제' : '지난주 같은 요일';
  const doLoad = () => {
    sessions = log.sessions.map(s => ({
      ...s,
      id: newId(),
      repsVisible: false,
      reps: Array(s.repsCount || 5).fill(false),
      completed: false,
    }));
    renderSessions();
    showToast(`📅 ${label} 루틴을 불러왔어요 (${sessions.length}개 세션)`, 'success');
  };
  if (sessions.length > 0) {
    if (!confirm(`현재 세션 ${sessions.length}개가 있어요.\n${label} 루틴으로 교체할까요?`)) return;
  }
  doLoad();
}

// ── 루틴 프리셋 내부 유틸 ───────────────────────────────────────────
function _loadRoutinePresets() {
  try { _routinePresets = JSON.parse(localStorage.getItem('rf_routine_presets') || '[]'); }
  catch { _routinePresets = []; }
}
function _saveRoutinePresets() {
  localStorage.setItem('rf_routine_presets', JSON.stringify(_routinePresets));
}
function _renderRoutinePresetsList() {
  if (_routinePresets.length === 0) {
    return `<p class="text-center text-sm text-gray-400 py-4">저장된 프리셋이 없어요.<br>현재 루틴을 프리셋으로 저장해보세요!</p>`;
  }
  return _routinePresets.map(p => `
    <div class="flex items-center gap-2 p-2.5 rounded-xl border border-gray-100 bg-gray-50 hover:border-amber-200 hover:bg-amber-50 transition-colors">
      <div class="flex-1 min-w-0 cursor-pointer" onclick="PracticeBuilder.applyRoutinePreset(${p.id})">
        <p id="routine-preset-name-${p.id}" class="text-sm font-bold text-gray-700 truncate">${p.name}</p>
        <p class="text-[10px] text-gray-400">${p.sessions.length}개 세션 · ${p.totalMin}분</p>
      </div>
      <button onclick="PracticeBuilder.startEditRoutinePresetName(${p.id})"
        class="w-6 h-6 shrink-0 bg-blue-100 hover:bg-blue-200 text-blue-500 rounded-full flex items-center justify-center text-[10px] transition-colors">✏</button>
      <button onclick="PracticeBuilder.deleteRoutinePreset(${p.id})"
        class="w-6 h-6 shrink-0 bg-red-100 hover:bg-red-200 text-red-400 rounded-full flex items-center justify-center text-[10px] transition-colors">✕</button>
    </div>`
  ).join('');
}
function _refreshRoutinePresetsList() {
  const el = document.getElementById('routine-presets-list');
  if (el) el.innerHTML = _renderRoutinePresetsList();
}

// ── 루틴 프리셋 저장 ──────────────────────────────────────────────────
function openSaveRoutinePresetModal() {
  if (sessions.length === 0) { showToast('저장할 세션이 없어요', 'warning'); return; }
  const existing = document.getElementById('save-routine-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'save-routine-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  modal.style.background = 'rgba(0,0,0,0.45)';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
      <p class="font-black text-gray-800 text-base mb-4">💾 루틴 프리셋 저장</p>
      <div class="space-y-3">
        <div>
          <label class="text-xs font-bold text-gray-500 block mb-1">프리셋 이름</label>
          <input id="routine-preset-name-input" type="text" placeholder="예: 출근 전 20분 루틴" maxlength="20"
            class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400" />
        </div>
        <p class="text-[10px] text-gray-400">세션 ${sessions.length}개 · 총 ${getTotalMinutes()}분 구성이 저장됩니다</p>
      </div>
      <div class="flex gap-2 mt-4">
        <button onclick="PracticeBuilder.confirmSaveRoutinePreset()"
          class="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm rounded-xl transition-colors">저장</button>
        <button onclick="document.getElementById('save-routine-modal').remove()"
          class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm rounded-xl">취소</button>
      </div>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('routine-preset-name-input')?.focus();
}

function confirmSaveRoutinePreset() {
  const name = (document.getElementById('routine-preset-name-input')?.value || '').trim();
  if (!name) { showToast('프리셋 이름을 입력해주세요', 'warning'); return; }
  _loadRoutinePresets();
  if (_routinePresets.length >= 8) { showToast('프리셋은 최대 8개까지 저장할 수 있어요', 'warning'); return; }
  _routinePresets.push({
    id: Date.now(), name,
    sessions: sessions.map(s => ({
      type: s.type, name: s.name, detail: s.detail,
      minutes: s.minutes, repsCount: s.repsCount || 5,
    })),
    totalMin: getTotalMinutes(),
    savedAt: new Date().toISOString(),
  });
  _saveRoutinePresets();
  document.getElementById('save-routine-modal')?.remove();
  showToast(`✅ "${name}" 프리셋이 저장되었습니다!`, 'success');
}

// ── 루틴 프리셋 목록/적용/수정/삭제 ────────────────────────────────
function openRoutinePresetsModal() {
  _loadRoutinePresets();
  const existing = document.getElementById('routine-presets-modal');
  if (existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'routine-presets-modal';
  modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
  modal.style.background = 'rgba(0,0,0,0.45)';
  modal.innerHTML = `
    <div class="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-5">
      <p class="font-black text-gray-800 text-base mb-4">📋 루틴 프리셋</p>
      <div id="routine-presets-list" class="space-y-2 max-h-72 overflow-y-auto mb-4">
        ${_renderRoutinePresetsList()}
      </div>
      <button onclick="document.getElementById('routine-presets-modal').remove()"
        class="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold text-sm rounded-xl">닫기</button>
    </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

function applyRoutinePreset(id) {
  _loadRoutinePresets();
  const p = _routinePresets.find(x => x.id === id);
  if (!p) return;
  const doApply = () => {
    sessions = p.sessions.map(s =>
      createSession(s.type, { name: s.name, detail: s.detail, defaultMin: s.minutes })
    );
    renderSessions();
    document.getElementById('routine-presets-modal')?.remove();
    showToast(`📋 "${p.name}" 프리셋을 적용했어요!`, 'success');
  };
  if (sessions.length > 0) {
    if (!confirm(`현재 세션 ${sessions.length}개가 있어요.\n"${p.name}" 프리셋으로 교체할까요?`)) return;
  }
  doApply();
}

function startEditRoutinePresetName(id) {
  const nameEl = document.getElementById(`routine-preset-name-${id}`);
  if (!nameEl) return;
  _loadRoutinePresets();
  const p = _routinePresets.find(x => x.id === id);
  if (!p) return;
  nameEl.outerHTML = `<input id="edit-routine-name-${id}" type="text"
    value="${p.name.replace(/"/g,'&quot;')}" maxlength="20"
    onblur="PracticeBuilder.finishEditRoutinePresetName(${id}, this.value)"
    onkeydown="if(event.key==='Enter')this.blur(); if(event.key==='Escape'){this.dataset.cancel='1';this.blur();}"
    class="text-sm font-bold text-gray-700 border-b border-amber-400 bg-transparent focus:outline-none w-full" />`;
  document.getElementById(`edit-routine-name-${id}`)?.focus();
  document.getElementById(`edit-routine-name-${id}`)?.select();
}

function finishEditRoutinePresetName(id, newName) {
  const input = document.getElementById(`edit-routine-name-${id}`);
  if (input?.dataset.cancel === '1') { _refreshRoutinePresetsList(); return; }
  _loadRoutinePresets();
  const p = _routinePresets.find(x => x.id === id);
  if (p && newName?.trim()) { p.name = newName.trim(); _saveRoutinePresets(); }
  _refreshRoutinePresetsList();
}

function deleteRoutinePreset(id) {
  _loadRoutinePresets();
  const p = _routinePresets.find(x => x.id === id);
  if (!p || !confirm(`"${p.name}" 프리셋을 삭제할까요?`)) return;
  _routinePresets = _routinePresets.filter(x => x.id !== id);
  _saveRoutinePresets();
  _refreshRoutinePresetsList();
  showToast('프리셋이 삭제되었습니다', 'info');
}

  function savePractice() {
    const totalMin = getTotalMinutes();
    const goal = document.getElementById('builder-goal')?.value || '';
    const achievement = document.getElementById('builder-achievement')?.value || '';
    const note = document.getElementById('builder-note')?.value || '';
    const allTags = [...parseTags(goal), ...parseTags(achievement), ...parseTags(note)];
    sessions.forEach(s => {
      const tagsFromMemo = parseTags(s.memo);
      s.tags = tagsFromMemo;
      allTags.push(...tagsFromMemo);
    });

    const allCompleted = sessions.length > 0 && sessions.every(s => s.completed);
    const log = {
      date: editingDate,
      sessions: [...sessions],
      goal, achievement, note,
      tags: [...new Set(allTags)],
      totalMin,
      allCompleted,
      savedAt: new Date().toISOString(),
      icon: Storage.getLog(editingDate)?.icon || (allCompleted ? '✅' : '🎸'),
    };

    const existingLog = Storage.getLog(editingDate);
    const prevMin = existingLog?.totalMin || 0;
    const xpAwardedDates = Storage.get('rf_xp_dates', []);
    const isFirstSave = !xpAwardedDates.includes(editingDate);

    Storage.setLog(editingDate, log);

    // 누적 연습 시간: 차이만큼만 반영 (재저장 시 중복 방지)
    const minDiff = totalMin - prevMin;
    if (minDiff !== 0) AppState.addTotalMin(minDiff);

    // XP + 물주기: 하루 첫 저장에만 부여
    if (isFirstSave) {
      const isLong = totalMin >= 30;
      AppState.addXP(isLong ? CONFIG.XP.PRACTICE_LONG : CONFIG.XP.PRACTICE_SHORT);
      if (isLong) {
        AppState.addWater();
        const msg = allCompleted
          ? '🎉 모든 세션 완료! 💧 물주기 +1! XP +40 획득!'
          : '💧 물주기 +1! XP +40 획득! 훌륭해요!';
        showToast(msg, 'success');
      } else {
        const msg = allCompleted
          ? '🎉 모든 세션 완료! XP +10 획득!'
          : 'XP +10 획득! (30분 이상 연습하면 물주기도 받아요)';
        showToast(msg, allCompleted ? 'success' : 'info');
      }
      // 오늘 날짜 XP 지급 완료로 기록
      xpAwardedDates.push(editingDate);
      Storage.set('rf_xp_dates', xpAwardedDates);
    } else {
      showToast('✅ 연습 일지가 수정되었습니다.', 'info');
    }

    // 스트릭 업데이트
    AppState.updateStreak(editingDate);
    AppState.saveAll();
    AppState.updateRanking()
  .then(() => { CrewRanking?._invalidateCache?.(); CrewRanking?.render(); })
  .catch(e => console.warn('[Ranking] 업데이트 실패:', e));
    if (typeof ChallengeTracker !== 'undefined') ChallengeTracker.recalc();
    AppState.renderDashboard();
    AppState.renderWeeklyChallenges?.();
    CalendarView.render();
    return log;

  }
  function renderIconPicker(dateStr) {
    const el = document.getElementById('builder-icon-picker');
    if (!el) return;
    const log = Storage.getLog(dateStr);
    const cur = log?.icon || '';
    el.innerHTML = CONFIG.CALENDAR_ICONS.map(ic =>
      `<button onclick="PracticeBuilder.setIcon('${ic}')"
        class="text-xl p-0.5 hover:scale-125 transition-transform rounded ${cur === ic ? 'ring-2 ring-amber-400' : ''}">
        ${ic}</button>`
    ).join('');
  }

  function setIcon(icon) {
    const log = Storage.getLog(editingDate) || { date: editingDate };
    log.icon = icon;
    Storage.setLog(editingDate, log);
    renderIconPicker(editingDate);
    CalendarView.render();
  }

  // ── 불러오기 ─────────────────────────────────────────────────────
  function loadDate(dateStr) {
    editingDate = dateStr;
    const log = Storage.getLog(dateStr);
    if (log) {
      sessions = log.sessions.map(s => ({
        ...s,
        repsCount: s.repsCount || 5,
        repsVisible: false,
        reps: s.reps?.length ? s.reps : [],
        completed: s.completed || false,
      }));
      if (document.getElementById('builder-goal'))
        document.getElementById('builder-goal').value = log.goal || '';
      if (document.getElementById('builder-achievement'))
        document.getElementById('builder-achievement').value = log.achievement || '';
      if (document.getElementById('builder-note'))
        document.getElementById('builder-note').value = log.note || '';
    } else {
      sessions = [];
      if (document.getElementById('builder-goal')) document.getElementById('builder-goal').value = '';
      if (document.getElementById('builder-achievement')) document.getElementById('builder-achievement').value = '';
      if (document.getElementById('builder-note')) document.getElementById('builder-note').value = '';
    }
    renderSessions();
    renderDateLabel();
    renderIconPicker(dateStr);
  }
  // ── JSON 내보내기 ─────────────────────────────────────────────────
  function exportJSON() {
    const allLogs = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key.startsWith(CONFIG.KEYS.PRACTICE_LOG)) {
        allLogs.push(Storage.get(key));
      }
    }
    const blob = new Blob([JSON.stringify(allLogs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `riffforge_logs_${getTodayStr()}.json`;
    a.click(); URL.revokeObjectURL(url);
  }

  // ── JSON 가져오기 ─────────────────────────────────────────────────
  function importJSON(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const logs = JSON.parse(e.target.result);
        logs.forEach(log => { if (log.date) Storage.setLog(log.date, log); });
        showToast(`${logs.length}개의 기록을 가져왔어요!`, 'success');
        CalendarView.render();
        loadDate(editingDate);
      } catch {
        showToast('JSON 파일을 읽을 수 없어요.', 'error');
      }
    };
    reader.readAsText(file);
  }

  // ══════════════════════════════════════════════════════════════════
  // 렌더링
  // ══════════════════════════════════════════════════════════════════

  const TYPE_COLORS = {
    warmup: { bg: 'bg-amber-50', border: 'border-amber-300', badge: 'bg-amber-100 text-amber-700', btn: 'bg-amber-500 hover:bg-amber-600' },
    theory: { bg: 'bg-blue-50', border: 'border-blue-300', badge: 'bg-blue-100 text-blue-700', btn: 'bg-blue-500 hover:bg-blue-600' },
    practical: { bg: 'bg-green-50', border: 'border-green-300', badge: 'bg-green-100 text-green-700', btn: 'bg-green-500 hover:bg-green-600' },
  };

  function renderSessionCard(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    const el = document.getElementById(`session-${id}`);
    if (!el) return;
    // 분 표시
    const minEl = el.querySelector('.session-minutes');
    if (minEl) minEl.textContent = s.minutes + '분';
    // 렙 원
    s.reps.forEach((filled, i) => {
      const dot = el.querySelector(`[data-rep="${i}"]`);
      if (dot) {
        dot.className = `w-6 h-6 rounded-full border-2 cursor-pointer transition-all ${filled ? 'bg-orange-400 border-orange-400' : 'bg-white border-gray-300 hover:border-orange-300'
          }`;
      }
    });
    // 총 분 업데이트
    updateTotalMinutes();
  }

  function buildSessionCardHTML(s) {
    const c = TYPE_COLORS[s.type] || TYPE_COLORS.warmup;
    const tpl = CONFIG.SESSION_TEMPLATES[s.type];
    const isCustom = !tpl.items.find(i => i.name === s.name);

    const itemOptions = tpl.items.map(item =>
      `<option value="${item.name}" ${item.name === s.name ? 'selected' : ''}>${item.name}</option>`
    ).join('') + `<option value="__custom__" ${isCustom ? 'selected' : ''}>✏️ 직접 입력</option>`;

    const repsCount = s.repsCount || 5;
    const repsHTML = Array(repsCount).fill(null).map((_, i) =>
      `<button data-rep="${i}" onclick="PracticeBuilder.toggleRep('${s.id}',${i})"
        class="w-6 h-6 rounded-full border-2 cursor-pointer transition-all ${s.reps[i] ? 'bg-orange-400 border-orange-400' : 'bg-white border-gray-300 hover:border-orange-300'}">
      </button>`
    ).join('');

    const completeBtnClass = s.completed
      ? 'complete-btn text-xs px-3 py-1 rounded-xl font-black bg-green-500 text-white transition-all'
      : 'complete-btn text-xs px-3 py-1 rounded-xl font-bold border border-gray-300 text-gray-500 hover:border-green-400 hover:text-green-600 hover:bg-green-50 transition-all';
    const completeBtnText = s.completed ? '✅ 완료됨' : '완료';
    const cardStyle = s.completed ? 'style="opacity:0.72;filter:grayscale(0.25);position:relative;"' : '';
    const completedOverlay = s.completed
      ? `<div class="complete-overlay absolute inset-0 rounded-2xl pointer-events-none" style="background:rgba(34,197,94,0.06);border:2px solid rgba(34,197,94,0.35);"></div>`
      : '';

    return `
    <div id="session-${s.id}" class="session-card ${c.bg} border ${c.border} rounded-2xl p-4 mb-3" ${cardStyle}>
      ${completedOverlay}
      <div class="flex items-start justify-between mb-3">
        <div class="flex flex-col gap-1 flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="${c.badge} text-xs font-bold px-2 py-0.5 rounded-full shrink-0">${tpl.icon} ${tpl.label}</span>
            <select onchange="PracticeBuilder.changeSessionItem('${s.id}', this.value)"
              class="text-sm font-semibold text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:outline-none flex-1 min-w-0 cursor-pointer">
              ${itemOptions}
            </select>
          </div>
          <input id="custom-name-${s.id}" type="text" value="${isCustom ? s.name : ''}"
            placeholder="직접 입력..." onchange="PracticeBuilder.setCustomName('${s.id}', this.value)"
            class="text-sm border border-dashed border-amber-300 rounded-lg px-2 py-0.5 focus:outline-none focus:border-amber-400 ${isCustom ? '' : 'hidden'}" />
        </div>
        <div class="flex items-center gap-1.5 ml-2 shrink-0">
          <button onclick="PracticeBuilder.toggleSessionComplete('${s.id}')"
            class="${completeBtnClass}">${completeBtnText}</button>
          <button onclick="PracticeBuilder.removeSession('${s.id}')"
            class="text-gray-400 hover:text-red-400 transition-colors">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
      </div>
           <div class="flex items-start gap-2 mb-3">
        <p class="session-detail text-xs text-gray-500 flex-1">${s.detail}</p>
        ${s.type === 'warmup' && s.name === '크로매틱' ? `
          <button onclick="PracticeBuilder.rollChromatic('${s.id}')"
            class="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 shrink-0">🎲 패턴</button>` : ''}
        ${s.type === 'warmup' && s.name === '거미줄(Spider)' ? `
          <button onclick="PracticeBuilder.rollSpider('${s.id}')"
            class="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 shrink-0">🎲 난이도</button>` : ''}
        ${s.type === 'theory' ? `
          <button onclick="PracticeBuilder.rollKeys('${s.id}')"
            class="text-[10px] px-2 py-0.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 shrink-0">🎲 3Key</button>` : ''}
      </div>
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center gap-2">
          <button onclick="PracticeBuilder.adjustMinutes('${s.id}',-5)"
            class="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center justify-center">−</button>
          <span class="session-minutes text-sm font-bold text-gray-700 w-12 text-center">${s.minutes}분</span>
          <button onclick="PracticeBuilder.adjustMinutes('${s.id}',5)"
            class="w-7 h-7 rounded-full bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 text-sm font-bold flex items-center justify-center">+</button>
        </div>
        <!-- 횟수 체크 토글 -->
        <button onclick="PracticeBuilder.toggleRepsVisible('${s.id}')"
          class="text-xs text-gray-400 hover:text-amber-500 flex items-center gap-1 transition-colors">
          ${s.repsVisible ? '▼' : '▶'} 횟수 체크
        </button>
      </div>
      ${s.repsVisible ? `
      <div class="flex items-center gap-2 mb-2">
        <button onclick="PracticeBuilder.adjustRepsCount('${s.id}',-1)"
          class="w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center">−</button>
        <span class="text-xs text-gray-500">${repsCount}회</span>
        <button onclick="PracticeBuilder.adjustRepsCount('${s.id}',1)"
          class="w-5 h-5 rounded-full bg-white border border-gray-200 text-gray-500 text-xs font-bold flex items-center justify-center">+</button>
        <div class="flex items-center gap-1 ml-1">${repsHTML}</div>
      </div>` : ''}
      <textarea onchange="PracticeBuilder.updateMemo('${s.id}', this.value)"
        placeholder="세션 메모 (#태그)" rows="2"
        class="w-full text-xs text-gray-600 bg-white/70 border border-gray-200 rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:border-amber-300 placeholder-gray-300"
      >${s.memo}</textarea>
    </div>`;
  }


  function renderSessions() {
    const container = document.getElementById('sessions-container');
    if (!container) return;
    if (sessions.length === 0) {
      container.innerHTML = `
        <div class="text-center py-8 text-gray-400">
          <div class="text-4xl mb-2">🎸</div>
          <p class="text-sm">위의 버튼으로 세션을 추가하거나<br>자동 추천을 받아보세요!</p>
        </div>`;
    } else {
      container.innerHTML = sessions.map(buildSessionCardHTML).join('');
    }
    updateTotalMinutes();
    _updateAllCompleteStatus();
  }

  function updateTotalMinutes() {
    const total = getTotalMinutes();
    const el = document.getElementById('builder-total-min');
    if (el) {
      el.textContent = `총 ${total}분`;
      el.className = `text-sm font-bold ${total >= 30 ? 'text-green-600' : 'text-gray-500'}`;
    }
    const waterHint = document.getElementById('builder-water-hint');
    if (waterHint) {
      waterHint.textContent = total >= 30
        ? '💧 30분 이상! 물주기 +1 받을 수 있어요'
        : `💡 ${30 - total}분 더 추가하면 물주기를 받아요`;
      waterHint.className = `text-xs mt-1 ${total >= 30 ? 'text-blue-500 font-semibold' : 'text-gray-400'}`;
    }
  }

  function renderDateLabel() {
    const el = document.getElementById('builder-date-label');
    if (el) {
      const d = new Date(editingDate + 'T00:00:00');
      const days = ['일', '월', '화', '수', '목', '금', '토'];
      el.textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${days[d.getDay()]})`;
    }
  }

  function changeSessionItem(id, itemName) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    if (itemName === '__custom__') {
      const input = document.getElementById(`custom-name-${id}`);
      if (input) { input.classList.remove('hidden'); input.focus(); }
      return;
    }
    const tpl = CONFIG.SESSION_TEMPLATES[s.type];
    const item = tpl.items.find(i => i.name === itemName);
    if (item) { s.name = item.name; s.detail = item.detail; s.minutes = item.defaultMin; }
    const input = document.getElementById(`custom-name-${id}`);
    if (input) input.classList.add('hidden');
    renderSessions();
  }

  function updateMemo(id, value) {
    const s = sessions.find(x => x.id === id);
    if (s) s.memo = value;
  }

  // 크로매틱: 1-2-3-4 손가락의 모든 경우의 수 (4! = 24개)
  const _CHROMATIC_PATTERNS = (() => {
    const perms = [], arr = [1, 2, 3, 4];
    function perm(a, cur = []) {
      if (!a.length) { perms.push([...cur]); return; }
      a.forEach((v, i) => perm([...a.slice(0, i), ...a.slice(i + 1)], [...cur, v]));
    }
    perm(arr);
    return perms.map(p => p.join('-'));
  })();

  // 스파이더: 현별 손가락 배치 패턴 (4줄 × 다양한 핑거링)
  const _SPIDER_PATTERNS = [
    { label: '기본', pattern: '6번줄:1→5번줄:2→4번줄:3→3번줄:4 (순방향 이동)', tip: '각 줄 1프렛씩 이동' },
    { label: '역방향', pattern: '3번줄:4→4번줄:3→5번줄:2→6번줄:1 (역방향 이동)', tip: '고음줄에서 저음줄로' },
    { label: '교차 A', pattern: '6번줄:1,3→5번줄:2,4→4번줄:1,3→3번줄:2,4', tip: '홀짝 손가락 교차' },
    { label: '교차 B', pattern: '6번줄:1,4→5번줄:2,3→4번줄:1,4→3번줄:2,3', tip: '스트레치 교차' },
    { label: '점프 A', pattern: '6번줄:1→4번줄:2→5번줄:3→3번줄:4 (줄 건너뛰기)', tip: '비인접 줄 이동' },
    { label: '점프 B', pattern: '6번줄:1→3번줄:2→5번줄:3→4번줄:4 (와이드 점프)', tip: '3줄 이상 점프' },
    { label: '사이드 A', pattern: '프렛5:1-2→프렛6:3-4→프렛7:1-2→프렛8:3-4', tip: '프렛 이동형 스파이더' },
    { label: '사이드 B', pattern: '프렛5:4-3→프렛6:2-1→프렛7:4-3→프렛8:2-1', tip: '역순 프렛 이동' },
    { label: '다이아고날', pattern: '6번줄F5:1→5번줄F6:2→4번줄F7:3→3번줄F8:4 (대각)', tip: '대각선 이동' },
    { label: '와이드 스트레치', pattern: '6번줄:1→6번줄:4→5번줄:1→5번줄:4 (1-4 스트레치)', tip: '검지-소지 스트레치' },
  ];

  function rollChromatic(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    const p = _CHROMATIC_PATTERNS[Math.floor(Math.random() * _CHROMATIC_PATTERNS.length)];
    s.detail = `크로매틱: ${p}`;
    // 세션 메모에 자동 추천
    const textarea = document.querySelector(`#session-${id} textarea`);
    if (textarea && !textarea.value) {
      s.memo = `크로매틱 패턴: ${p} | 각 줄 1~12프렛 반복`;
      textarea.value = s.memo;
    }
    renderSessions();
    showToast(`🎲 크로매틱 패턴 [${p}] 선택됨!`, 'info');
  }

  function rollSpider(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    const sp = _SPIDER_PATTERNS[Math.floor(Math.random() * _SPIDER_PATTERNS.length)];
    s.detail = `스파이더 [${sp.label}]: ${sp.pattern}`;
    // 세션 메모에 자동 추천
    const textarea = document.querySelector(`#session-${id} textarea`);
    if (textarea && !textarea.value) {
      s.memo = `스파이더 [${sp.label}]: ${sp.tip}`;
      textarea.value = s.memo;
    }
    renderSessions();
    showToast(`🎲 스파이더 [${sp.label}] 선택됨!`, 'info');
  }

  function rollKeys(id) {
    const s = sessions.find(x => x.id === id);
    if (!s) return;
    const SCALE_NOTES = {
      C: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], G: ['G', 'A', 'B', 'C', 'D', 'E', 'F#'],
      D: ['D', 'E', 'F#', 'G', 'A', 'B', 'C#'], A: ['A', 'B', 'C#', 'D', 'E', 'F#', 'G#'],
      E: ['E', 'F#', 'G#', 'A', 'B', 'C#', 'D#'], B: ['B', 'C#', 'D#', 'E', 'F#', 'G#', 'A#'],
      'F#': ['F#', 'G#', 'A#', 'B', 'C#', 'D#', 'E#'], Db: ['Db', 'Eb', 'F', 'Gb', 'Ab', 'Bb', 'C'],
      Ab: ['Ab', 'Bb', 'C', 'Db', 'Eb', 'F', 'G'], Eb: ['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D'],
      Bb: ['Bb', 'C', 'D', 'Eb', 'F', 'G', 'A'], F: ['F', 'G', 'A', 'Bb', 'C', 'D', 'E'],
    };
    const keys = Object.keys(SCALE_NOTES);
    const newKey = keys[Math.floor(Math.random() * keys.length)];
    const sc = SCALE_NOTES[newKey];
    const memoLine = `🎲 3Key [${newKey}]: R=${sc[0]} 3rd=${sc[2]} 5th=${sc[4]}`;
    // 세션 이름/내용 유지, 메모에만 추가 (기존 메모 뒤에 줄바꿈 후 추가)
    const textarea = document.querySelector(`#session-${id} textarea`);
    const prev = (textarea?.value || s.memo || '').trim();
    s.memo = prev ? `${prev}\n${memoLine}` : memoLine;
    if (textarea) textarea.value = s.memo;
    showToast(`🎲 3Key [${newKey}]: R=${sc[0]} / 3rd=${sc[2]} / 5th=${sc[4]}`, 'info');
  }

  function addSongSession(songTitle, bpm) {
    const s = createSession('practical');
    s.name = songTitle;
    s.memo = bpm ? `BPM: ${bpm}` : '';
    sessions.push(s);
    renderSessions();
    setTimeout(() => document.getElementById(`session-${s.id}`)?.scrollIntoView({ behavior: 'smooth' }), 100);
  }

  // ── 기간별 PDF 내보내기 ──────────────────────────────────────────
  function togglePDFPanel() {
    const panel = document.getElementById('pdf-export-panel');
    if (!panel) return;
    const isHidden = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !isHidden);
    if (isHidden) {
      // 기본 날짜 범위: 이번 달 1일 ~ 오늘
      const today = getTodayStr();
      const firstDay = today.slice(0, 8) + '01';
      const s = document.getElementById('pdf-start-date');
      const e = document.getElementById('pdf-end-date');
      if (s && !s.value) s.value = firstDay;
      if (e && !e.value) e.value = today;
    }
  }

  function exportDateRangePDF() {
    const startDate = document.getElementById('pdf-start-date')?.value;
    const endDate = document.getElementById('pdf-end-date')?.value;
    if (!startDate || !endDate || startDate > endDate) {
      showToast('날짜 범위를 올바르게 선택해주세요.', 'error'); return;
    }

    // 해당 기간 로그 수집 (로컬 날짜 기준 — toISOString은 UTC라 하루 밀릴 수 있음)
    const toLocalStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const logs = [];
    const cur = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    while (toLocalStr(cur) <= endDate) {
      const ds = toLocalStr(cur);
      const log = Storage.getLog(ds);
      if (log) logs.push(log);
      cur.setDate(cur.getDate() + 1);
    }

    if (logs.length === 0) {
      showToast('선택한 기간에 기록된 일지가 없어요.', 'info'); return;
    }

    // A4 비율 프린트용 HTML 생성
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const entryHTML = logs.map(log => {
      const d = new Date(log.date + 'T00:00:00');
      const dateLabel = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${dayNames[d.getDay()]})`;
      const TYPE_LABEL = { warmup: '🔥 워밍업', theory: '🎵 코드/이론', practical: '🎸 실전연습' };
      const TYPE_COLOR = { warmup: '#f59e0b', theory: '#3b82f6', practical: '#22c55e' };
      const sessionsHTML = (log.sessions || []).map(s => {
        const borderColor = TYPE_COLOR[s.type] || '#f59e0b';
        const typeLabel = TYPE_LABEL[s.type] || s.type || '';
        return `<div style="margin:4px 0;padding:6px 10px;background:#fef9f0;border-left:3px solid ${borderColor};border-radius:4px;">
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <span style="font-size:10px;font-weight:700;color:${borderColor};background:${borderColor}22;padding:1px 6px;border-radius:10px;">${typeLabel}</span>
            <span style="font-weight:700;font-size:13px;">${s.name}</span>
            <span style="color:#92400e;font-size:12px;">${s.minutes}분</span>
          </div>
          ${s.detail ? `<p style="color:#9ca3af;font-size:10px;margin:2px 0 0;">${s.detail}</p>` : ''}
          ${s.memo ? `<p style="color:#4b5563;font-size:11px;margin:3px 0 0;padding-left:4px;border-left:2px solid #e5e7eb;">${s.memo}</p>` : ''}
        </div>`;
      }).join('');
      return `
        <div style="page-break-inside:avoid;margin-bottom:24px;padding:16px;border:1px solid #fcd34d;border-radius:12px;background:#fff;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;border-bottom:2px solid #fef3c7;padding-bottom:8px;">
            <span style="font-size:22px;">${log.icon || '🎸'}</span>
            <div>
              <strong style="font-size:15px;color:#1f2937;">${dateLabel}</strong>
              <span style="margin-left:12px;font-size:12px;color:#d97706;font-weight:700;">총 ${log.totalMin || 0}분</span>
            </div>
          </div>
          ${sessionsHTML}
          ${log.goal ? `<p style="margin-top:8px;font-size:12px;"><strong style="color:#3b82f6;">🎯 목표:</strong> ${log.goal}</p>` : ''}
          ${log.achievement ? `<p style="margin-top:4px;font-size:12px;"><strong style="color:#10b981;">✅ 달성:</strong> ${log.achievement}</p>` : ''}
          ${log.note ? `<p style="margin-top:4px;font-size:12px;color:#6b7280;font-style:italic;">📝 ${log.note}</p>` : ''}
          ${log.tags?.length ? `<p style="margin-top:4px;font-size:11px;color:#f59e0b;">${log.tags.join(' ')}</p>` : ''}
        </div>`;
    }).join('');

    const totalMin = logs.reduce((s, l) => s + (l.totalMin || 0), 0);
    const printHTML = `<!DOCTYPE html><html lang="ko"><head>
      <meta charset="UTF-8"/>
      <title>RiffForge 연습 일지 ${startDate} ~ ${endDate}</title>
      <style>
        body { font-family: 'Segoe UI', system-ui, sans-serif; margin: 0; padding: 20px 32px; color: #1f2937; }
        @page { size: A4; margin: 20mm 18mm; }
        @media print { body { padding: 0; } }
      </style>
    </head><body>
      <div style="text-align:center;margin-bottom:28px;padding-bottom:16px;border-bottom:3px solid #f59e0b;">
        <h1 style="font-size:22px;font-weight:900;color:#92400e;margin:0 0 4px;">🎸 RiffForge 연습 일지</h1>
        <p style="color:#6b7280;font-size:13px;margin:0;">${startDate} ~ ${endDate} | 총 ${logs.length}일 | ${totalMin}분</p>
      </div>
      ${entryHTML}
    </body></html>`;

    // 새 창에서 프린트
    const win = window.open('', '_blank', 'width=800,height=900');
    win.document.write(printHTML);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 600);
  }

  return {
    init() { editingDate = getTodayStr(); loadDate(editingDate); },
    getSessions: () => sessions,
    recommendSessions, addSession, removeSession, adjustMinutes,
    toggleRep, toggleRepsVisible, adjustRepsCount, setCustomName,
    toggleSessionComplete,
    markSessionComplete,
    savePractice, loadDate, exportJSON, importJSON,
    changeSessionItem, updateMemo, getTotalMinutes,
    setIcon, togglePDFPanel, exportDateRangePDF,
    getEditingDate: () => editingDate,
    setEditingDate(d) { editingDate = d; },
    rollChromatic, rollSpider, rollKeys, addSongSession,
    clearAllSessions,
    loadRoutineFrom,
    openSaveRoutinePresetModal, confirmSaveRoutinePreset,
    openRoutinePresetsModal, applyRoutinePreset,
    startEditRoutinePresetName, finishEditRoutinePresetName, deleteRoutinePreset,
  };


})();


// ═══════════════════════════════════════════════════════════════════════════
// CalendarView: 월간 달력 렌더링
// ═══════════════════════════════════════════════════════════════════════════
const CalendarView = (() => {
  let viewYear = new Date().getFullYear();
  let viewMonth = new Date().getMonth();  // 0-indexed
  let selectedDate = null;

  const _toLocalStr = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function render() {
    const cal = document.getElementById('calendar-grid');
    if (!cal) return;
    const todayStr = _toLocalStr(new Date());
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    // 헤더 업데이트
    const hdr = document.getElementById('calendar-header');
    if (hdr) hdr.textContent = `${viewYear}년 ${viewMonth + 1}월`;

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayHeaders = dayNames.map((d, i) =>
      `<div class="text-center py-2 text-xs font-black ${i === 0 ? 'text-red-400' : i === 6 ? 'text-blue-400' : 'text-gray-400'}">${d}</div>`
    ).join('');

    let cells = '';
    for (let i = 0; i < firstDay; i++) {
      cells += `<div class="h-16 border border-gray-50 bg-gray-50/40 rounded-xl"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const log = Storage.getLog(ds);
      const holiday = CONFIG.getHoliday ? CONFIG.getHoliday(ds) : null;
      const isToday = ds === todayStr;
      const isSelected = selectedDate === ds;
      const dow = (firstDay + d - 1) % 7;
      const isSun = dow === 0, isSat = dow === 6;

      let dateCls = 'text-gray-700';
      if (isSun || holiday) dateCls = 'text-red-500';
      else if (isSat) dateCls = 'text-blue-500';
      if (isToday) dateCls += ' font-black';

      let bgCls = 'bg-white hover:bg-amber-50';
      if (isToday) bgCls = 'bg-amber-50';
      if (isSelected) bgCls = 'bg-amber-100';

      const barColor = log
        ? (log.allCompleted ? 'bg-green-400' : log.totalMin >= 30 ? 'bg-amber-400' : 'bg-amber-200')
        : '';
      const barWidth = log ? Math.min(100, Math.round((log.totalMin / 60) * 100)) : 0;

      cells += `<div onclick="CalendarView.selectDate('${ds}')"
        class="relative h-16 rounded-xl cursor-pointer border transition-all ${bgCls} ${isSelected ? 'border-amber-400 ring-2 ring-amber-300' : 'border-gray-100'} flex flex-col p-1.5 overflow-hidden">
        <span class="text-sm ${dateCls} leading-none">${d}</span>
        ${holiday ? `<span class="text-[8px] text-red-400 leading-tight truncate">${holiday}</span>` : ''}
        ${log ? `
          <div class="mt-auto">
            <div class="flex items-center gap-0.5 mb-0.5">
              <span class="text-[9px] text-gray-400 leading-none">${log.totalMin}분</span>
              ${log.allCompleted ? '<span class="text-[9px] text-green-500">✓</span>' : ''}
            </div>
            <div class="w-full bg-gray-100 rounded-full h-1">
              <div class="${barColor} h-1 rounded-full" style="width:${barWidth}%"></div>
            </div>
          </div>` : ''}
        ${isToday ? `<div class="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-amber-500"></div>` : ''}
      </div>`;
    }
    cal.innerHTML = dayHeaders + cells;
    if (selectedDate) selectDate(selectedDate);
  }

  function selectDate(dateStr) {
    selectedDate = dateStr;
    const panel = document.getElementById('calendar-day-detail');
    if (!panel) return;
    panel.classList.remove('hidden');
    const log = Storage.getLog(dateStr);
    const holiday = CONFIG.getHoliday ? CONFIG.getHoliday(dateStr) : null;
    const todayStr = _toLocalStr(new Date());
    const isPast = dateStr <= todayStr;

    const TYPE_ICON = { warmup: '🔥', theory: '🎵', practical: '🎸' };
    const TYPE_COLOR = { warmup: 'text-amber-600 bg-amber-50', theory: 'text-blue-600 bg-blue-50', practical: 'text-green-600 bg-green-50' };

    const sessionsHTML = log?.sessions?.length
      ? log.sessions.map(s => `
          <div class="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
            <span class="text-xs px-1.5 py-0.5 rounded font-bold shrink-0 ${TYPE_COLOR[s.type] || 'text-gray-600 bg-gray-50'}">
              ${TYPE_ICON[s.type] || '🎵'}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-bold text-gray-800 leading-tight">${s.name}
                <span class="font-normal text-gray-400 ml-1">${s.minutes}분${s.completed ? ' ✅' : ''}</span>
              </p>
              ${s.detail ? `<p class="text-[10px] text-gray-400 leading-tight mt-0.5">${s.detail}</p>` : ''}
              ${s.memo ? `<p class="text-[10px] text-indigo-500 leading-snug mt-0.5 whitespace-pre-wrap">${s.memo}</p>` : ''}
            </div>
          </div>`).join('')
      : `<p class="text-xs text-gray-300 py-1">세션 기록 없음</p>`;

    panel.innerHTML = `
      <div class="flex items-center justify-between mb-2">
        <h3 class="font-black text-gray-800 text-sm">${dateStr}</h3>
        ${holiday ? `<span class="text-xs text-red-500 font-bold">${holiday}</span>` : ''}
      </div>
      ${log ? `
        <!-- 요약 헤더 -->
        <div class="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
          <span class="text-xl">${log.icon || '🎸'}</span>
          <div class="flex-1">
            <p class="text-sm font-black text-gray-800">${log.totalMin || 0}분 연습${log.allCompleted ? ' 🏆' : ''}</p>
            ${log.goal ? `<p class="text-[10px] text-gray-400">🎯 ${log.goal}</p>` : ''}
            ${log.achievement ? `<p class="text-[10px] text-amber-600">⭐ ${log.achievement}</p>` : ''}
          </div>
        </div>
        <!-- 세션 목록 -->
        <div class="mb-2">${sessionsHTML}</div>
        <!-- 메모 -->
        ${log.note ? `
          <div class="bg-indigo-50 rounded-xl px-3 py-2 mb-3">
            <p class="text-[10px] font-bold text-indigo-400 mb-0.5">📝 메모</p>
            <p class="text-xs text-indigo-700 leading-snug whitespace-pre-wrap">${log.note}</p>
          </div>` : ''}
      ` : `<p class="text-xs text-gray-400 mb-3">기록 없음</p>`}
      ${isPast ? `
        <div class="flex gap-2">
          <button onclick="CalendarView.goToBuilder()"
            class="flex-1 py-2 bg-amber-500 text-white text-xs font-bold rounded-xl hover:bg-amber-600 transition-colors">
            ${log ? '✏️ 수정' : '➕ 기록 추가'}
          </button>
          ${log ? `<button onclick="CalendarView.deleteLog('${dateStr}')"
            class="py-2 px-3 bg-red-100 text-red-500 text-xs font-bold rounded-xl hover:bg-red-200 transition-colors">
            🗑️ 삭제
          </button>` : ''}
        </div>` : ''}`;
  }

  function goToBuilder() {
    if (!selectedDate) return;
    AppSidebar.setActive('builder');
    setTimeout(() => PracticeBuilder.loadDate(selectedDate), 300);
    const panel = document.getElementById('calendar-day-detail');
    if (panel) panel.classList.add('hidden');
  }
function deleteLog(dateStr) {
    const log = Storage.getLog(dateStr);
    if (!log) return;
    if (!confirm(`${dateStr} 연습 기록을 삭제하시겠습니까?\n\n⚠️ XP·물주기는 유지되며 기록만 삭제됩니다.`)) return;

    // 연습 시간 역산 (랭킹 seasonMin 중복 합산 방지)
    const prevMin = log.totalMin || 0;
    if (prevMin > 0 && typeof AppState !== 'undefined') AppState.addTotalMin(-prevMin);

    // localStorage + Firestore 삭제
    Storage.deleteLog(dateStr);

    // 시즌 첫 기록 캐시 초기화 (랭킹 재계산 오류 방지)
    if (typeof getSeasonInfo === 'function') {
      const { seasonKey } = getSeasonInfo();
      localStorage.removeItem(`rf_s_first_${seasonKey}`);
    }

    // 패널 닫기 + 달력 재렌더
    selectedDate = null;
    const panel = document.getElementById('calendar-day-detail');
    if (panel) panel.classList.add('hidden');
    render();

    showToast('연습 기록이 삭제되었습니다.', 'info');
  }

  function prevMonth() {
    viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; }
    selectedDate = null; render();
  }
  function nextMonth() {
    viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; }
    selectedDate = null; render();
  }
  function setIcon() { }

  return { render, selectDate, setIcon, goToBuilder, prevMonth, nextMonth, deleteLog };
})();

// ═══════════════════════════════════════════════════════════════════════════
// RepertoireTracker: 레퍼토리 트래커 (파트 상세 관리 + 날짜 추적)
// ═══════════════════════════════════════════════════════════════════════════
const RepertoireTracker = (() => {
  const KEY = 'rf_repertoire';
  const STATE_STYLES = {
    learning: { badge: 'bg-blue-100 text-blue-700', bar: 'bg-blue-400' },
    polishing: { badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400' },
    ready:     { badge: 'bg-green-100 text-green-700', bar: 'bg-green-400' },
    mastered:  { badge: 'bg-purple-100 text-purple-700', bar: 'bg-purple-400' },
  };
  const STATE_LABELS = { learning: 'Learning', polishing: 'Polishing', ready: 'Ready', mastered: 'Mastered' };
  const FIXED_PARTS = [
    { id: 'intro',    label: '인트로' },
    { id: 'mainriff', label: '메인 리프' },
    { id: 'chorus',   label: '후렴' },
    { id: 'bridge',   label: '브리지' },
    { id: 'solo',     label: '솔로' },
    { id: 'outro',    label: '아웃트로' },
  ];
  const LEVEL_STYLES = [
    { label: '미시작', off: 'bg-gray-100 text-gray-400', on: 'bg-gray-400 text-white' },
    { label: '연습중', off: 'bg-blue-50 text-blue-400',  on: 'bg-blue-500 text-white' },
    { label: '거의됨', off: 'bg-amber-50 text-amber-500',on: 'bg-amber-400 text-white' },
    { label: '완성',   off: 'bg-green-50 text-green-500',on: 'bg-green-500 text-white' },
  ];

  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } }
  function save(songs) {
    localStorage.setItem(KEY, JSON.stringify(songs));
    if (typeof FireDB !== 'undefined' && FireDB.isReady() && FireDB.getUsername()) {
      FireDB.saveRepertoire(songs).catch(e => console.warn('[Repertoire] 클라우드 저장 실패:', e));
    }
  }
async function syncFromCloud() {
  if (typeof FireDB === 'undefined' || !FireDB.getUsername()) return;
  const cloudSongs = await FireDB.loadRepertoire();
  const localSongs = load();

  // 클라우드가 비어있으면 로컬 데이터를 업로드하고 종료
  if (!cloudSongs || !cloudSongs.length) {
    if (localSongs.length > 0) {
      FireDB.saveRepertoire(localSongs)
        .catch(e => console.warn('[Repertoire] 초기 업로드 실패:', e));
    }
    render();
    return;
  }

  const localMap = new Map(localSongs.map(s => [String(s.id), s]));
  const cloudMap = new Map(cloudSongs.map(s => [String(s.id), s]));
  const allIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

  const merged = [];
  allIds.forEach(function(id) {
    const lo = localMap.get(id);
    const cl = cloudMap.get(id);
    if (!lo) { merged.push(cl); return; }
    if (!cl) { merged.push(lo); return; }

    const loTime = lo.updatedAt ? new Date(lo.updatedAt).getTime() : 0;
    const clTime = cl.updatedAt ? new Date(cl.updatedAt).getTime() : 0;
    const newer = loTime >= clTime ? lo : cl;
    const older = loTime >= clTime ? cl : lo;
    merged.push(Object.assign({}, older, newer));
  });

  localStorage.setItem(KEY, JSON.stringify(merged));
  // ★ 병합 결과를 클라우드에도 다시 저장 (양방향 동기화)
  FireDB.saveRepertoire(merged)
    .catch(e => console.warn('[Repertoire] 병합 저장 실패:', e));
  render();
}


  function stateFromProgress(pct) {
    if (pct >= 90) return 'mastered';
    if (pct >= 60) return 'ready';
    if (pct >= 30) return 'polishing';
    return 'learning';
  }
  function calcPartsProgress(parts) {
    if (!parts || parts.length === 0) return 0;
    const total = parts.reduce((sum, p) => sum + (p.level || 0), 0);
    return Math.round((total / (parts.length * 3)) * 100);
  }
  function dday(deadline) {
    if (!deadline) return null;
    const diff = Math.ceil((new Date(deadline) - new Date()) / 86400000);
    if (diff < 0) return `D+${Math.abs(diff)}`;
    if (diff === 0) return 'D-Day!';
    return `D-${diff}`;
  }
  function _fmtDate(iso) {
    if (!iso) return '-';
    return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  // ── 기본 CRUD ─────────────────────────────────────────────────────────────
  function addSong() {
    const title = document.getElementById('rep-title')?.value.trim();
    const artist = document.getElementById('rep-artist')?.value.trim();
    const bpm = parseInt(document.getElementById('rep-bpm')?.value) || 120;
    const deadline = document.getElementById('rep-deadline')?.value || null;
    if (!title) { alert('곡 제목을 입력해 주세요.'); return; }
    const songs = load();
    songs.push({
      id: Date.now(), title, artist, bpm, deadline,
      progress: 0, state: 'learning',
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastPracticedAt: null,
      parts: [],
      partsManual: false,
    });
    save(songs);
    document.getElementById('rep-title').value = '';
    document.getElementById('rep-artist').value = '';
    if (typeof ChallengeTracker !== 'undefined') ChallengeTracker.addRepSong();
    render();
  }

  function setProgress(id, pct, fromManual = false) {
    const songs = load();
    const s = songs.find(s => s.id === id);
    if (!s) return;
    const oldState = s.state;
    s.progress = pct;
    if (fromManual) s.partsManual = true;
    s.state = stateFromProgress(pct);
    if (s.state === 'mastered' && !s.masteredAt) s.masteredAt = new Date().toISOString();
    s.updatedAt = new Date().toISOString();
    save(songs);
    if (typeof ChallengeTracker !== 'undefined') ChallengeTracker.addRepLevelUp(oldState, s.state);
    render();
  }

  function setField(id, field, value) {
    const songs = load();
    const s = songs.find(s => s.id === id);
    if (!s) return;
    s[field] = value;
    s.updatedAt = new Date().toISOString();
    save(songs);
  }

  function practiceSong(id) {
    const songs = load();
    const s = songs.find(s => s.id === id);
    if (!s) return;
    s.lastPracticedAt = new Date().toISOString();
    save(songs);
    AppSidebar.setActive('builder');
    setTimeout(() => PracticeBuilder.addSongSession(s.title, s.bpm), 400);
  }

  function removeSong(id) { save(load().filter(s => s.id !== id)); render(); }
    function linkPreset(songId) {
    const presetId = document.getElementById(`rep-preset-link-${songId}`)?.value;
    if (!presetId) { showToast('프리셋을 선택해주세요', 'warning'); return; }
    const songs = load();
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    song.linkedPresetId = parseInt(presetId);
    save(songs);
    openDetailModal(songId);
  }

  function unlinkPreset(songId) {
    const songs = load();
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    song.linkedPresetId = null;
    save(songs);
    openDetailModal(songId);
  }

  function openLinkedPreset(songId) {
    const song = load().find(s => s.id === songId);
    if (!song?.linkedPresetId) return;
    document.getElementById('rep-detail-modal')?.remove();
    AppSidebar.setActive('studio');
    setTimeout(() => StudioUI?.loadUserPreset(song.linkedPresetId), 400);
  }


  // ── 파트 관리 ─────────────────────────────────────────────────────────────
  function addPart(songId, partId, partLabel) {
    const songs = load();
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    if (!song.parts) song.parts = [];
    if (song.parts.some(p => p.id === partId)) return;
    song.parts.push({ id: partId, label: partLabel, level: 0, targetBpm: song.bpm || 120, currentBpm: 0 });
    if (!song.partsManual) { song.progress = calcPartsProgress(song.parts); song.state = stateFromProgress(song.progress); }
    save(songs);
    openDetailModal(songId);
    render();
  }

  function addPartCustom(songId) {
    const label = (prompt('파트 이름을 입력하세요 (예: 간주, 솔로2...)') || '').trim();
    if (!label) return;
    const songs = load();
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    if (!song.parts) song.parts = [];
    song.parts.push({ id: 'custom_' + Date.now(), label, level: 0, targetBpm: song.bpm || 120, currentBpm: 0 });
    if (!song.partsManual) { song.progress = calcPartsProgress(song.parts); song.state = stateFromProgress(song.progress); }
    save(songs);
    openDetailModal(songId);
    render();
  }

  function removePart(songId, partIdx) {
    const songs = load();
    const song = songs.find(s => s.id === songId);
    if (!song || !song.parts) return;
    song.parts.splice(partIdx, 1);
    if (!song.partsManual) { song.progress = calcPartsProgress(song.parts); song.state = stateFromProgress(song.progress); }
    save(songs);
    openDetailModal(songId);
    render();
  }

  function updatePart(songId, partIdx, field, value) {
    const songs = load();
    const song = songs.find(s => s.id === songId);
    if (!song || !song.parts?.[partIdx]) return;
    song.parts[partIdx][field] = value;
    if (field === 'level' && !song.partsManual) {
      song.progress = calcPartsProgress(song.parts);
      song.state = stateFromProgress(song.progress);
      save(songs);
      openDetailModal(songId); // 레벨 변경 시만 모달 갱신
    } else {
      save(songs); // BPM 입력 시는 모달 유지 (포커스 유지)
    }
    render();
  }

  function togglePartsManual(songId) {
    const songs = load();
    const song = songs.find(s => s.id === songId);
    if (!song) return;
    song.partsManual = !song.partsManual;
    if (!song.partsManual) {
      song.progress = calcPartsProgress(song.parts || []);
      song.state = stateFromProgress(song.progress);
    }
    save(songs);
    openDetailModal(songId);
    render();
  }

  // ── 상세 관리 팝업 ────────────────────────────────────────────────────────
  function openDetailModal(songId) {
    const existing = document.getElementById('rep-detail-modal');
    if (existing) existing.remove();
    const song = load().find(s => s.id === songId);
    if (!song) return;

    const parts = song.parts || [];
    const autoProgress = parts.length > 0 && !song.partsManual;
    const displayPct = autoProgress ? calcPartsProgress(parts) : (song.progress || 0);
    const addedAtVal = song.addedAt ? new Date(song.addedAt).toISOString().slice(0, 10) : '';

    const partsHTML = parts.map((p, i) => `
      <div class="bg-gray-50 rounded-xl p-3 space-y-2 border border-gray-100">
        <div class="flex items-center justify-between">
          <span class="text-sm font-bold text-gray-700">${p.label}</span>
          <button onclick="RepertoireTracker.removePart(${song.id}, ${i})"
            class="text-gray-300 hover:text-red-400 text-sm transition-colors">✕</button>
        </div>
        <div class="flex gap-1">
          ${LEVEL_STYLES.map((lv, li) => `
            <button onclick="RepertoireTracker.updatePart(${song.id}, ${i}, 'level', ${li})"
              class="flex-1 text-[10px] font-bold py-1.5 rounded-lg transition-all ${p.level === li ? lv.on : lv.off}">
              ${lv.label}
            </button>`).join('')}
        </div>
        <div class="flex gap-2">
          <label class="flex items-center gap-1 text-xs text-gray-500 flex-1">목표 BPM
            <input type="number" min="40" max="300" value="${p.targetBpm || ''}" placeholder="120"
              onchange="RepertoireTracker.updatePart(${song.id}, ${i}, 'targetBpm', parseInt(this.value)||0)"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-300" />
          </label>
          <label class="flex items-center gap-1 text-xs text-gray-500 flex-1">현재 BPM
            <input type="number" min="40" max="300" value="${p.currentBpm || ''}" placeholder="80"
              onchange="RepertoireTracker.updatePart(${song.id}, ${i}, 'currentBpm', parseInt(this.value)||0)"
              class="flex-1 min-w-0 border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-300" />
          </label>
        </div>
      </div>`).join('');

    const availableFixed = FIXED_PARTS.filter(fp => !parts.some(p => p.id === fp.id));

    const modal = document.createElement('div');
    modal.id = 'rep-detail-modal';
    modal.className = 'fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4';
    modal.style.background = 'rgba(0,0,0,0.45)';
    modal.innerHTML = `
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <!-- 헤더 -->
        <div class="px-5 py-4 border-b border-gray-100 flex items-start justify-between shrink-0">
          <div>
            <p class="font-black text-gray-800 text-base leading-tight">${song.title}</p>
            ${song.artist ? `<p class="text-xs text-gray-400 mt-0.5">${song.artist}</p>` : ''}
          </div>
          <button onclick="document.getElementById('rep-detail-modal').remove()"
            class="shrink-0 w-8 h-8 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold ml-3 transition-colors">✕</button>
        </div>

        <!-- 스크롤 영역 -->
        <div class="overflow-y-auto p-5 space-y-5">

          <!-- 날짜 정보 -->
          <div class="bg-gray-50 rounded-xl p-4 space-y-2.5">
            <p class="text-xs font-black text-gray-500">📅 날짜 정보</p>
            <div class="flex items-center gap-3 text-xs">
              <span class="text-gray-400 w-16 shrink-0">최초 등록일</span>
              <input type="date" value="${addedAtVal}"
                onchange="RepertoireTracker.setField(${song.id}, 'addedAt', this.value ? new Date(this.value + 'T00:00:00').toISOString() : null)"
                class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-300 text-xs" />
            </div>
            <div class="flex items-center gap-3 text-xs">
              <span class="text-gray-400 w-16 shrink-0">최근 연습일</span>
              <span class="font-medium text-gray-700">${_fmtDate(song.lastPracticedAt)}</span>
            </div>
          </div>
        <!-- 백킹 프리셋 연결 -->
        <div class="bg-gray-50 rounded-xl p-3 space-y-2">
          <p class="text-xs font-black text-gray-500">🎵 백킹 프리셋 연결</p>
          ${(() => {
            let presets = [];
            try { presets = JSON.parse(localStorage.getItem('rf_user_presets') || '[]'); } catch {}
            if (!presets.length) return `<p class="text-xs text-gray-300">저장된 프리셋이 없어요. 스튜디오에서 프리셋을 먼저 저장해주세요.</p>`;
            const linked = presets.find(p => p.id == song.linkedPresetId);
            if (linked) {
              return `<div class="flex items-center justify-between">
                <span class="text-xs font-bold text-amber-700">⭐ ${linked.name}</span>
                <div class="flex gap-1.5">
                  <button onclick="RepertoireTracker.openLinkedPreset(${song.id})"
                    class="text-xs px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors">스튜디오로</button>
                  <button onclick="RepertoireTracker.unlinkPreset(${song.id})"
                    class="text-xs px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-500 font-bold rounded-lg transition-colors">해제</button>
                </div>
              </div>`;
            }
            const opts = `<option value="">프리셋 선택...</option>` +
              presets.map(p => `<option value="${p.id}">⭐ ${p.name}</option>`).join('');
            return `<div class="flex gap-2">
              <select id="rep-preset-link-${song.id}"
                class="flex-1 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-300">
                ${opts}
              </select>
              <button onclick="RepertoireTracker.linkPreset(${song.id})"
                class="shrink-0 text-xs px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 font-bold rounded-lg transition-colors">연결</button>
            </div>`;
          })()}
        </div>

          <!-- 전체 완성도 -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <p class="text-xs font-black text-gray-500">🎯 전체 완성도</p>
              <div class="flex items-center gap-2">
                ${parts.length > 0 ? `
                <button onclick="RepertoireTracker.togglePartsManual(${song.id})"
                  class="text-[10px] px-2 py-0.5 rounded-lg border font-bold transition-colors
                    ${autoProgress ? 'border-amber-300 text-amber-600 bg-amber-50' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}">
                  ${autoProgress ? '자동 계산 중' : '직접 조정 중'}
                </button>` : ''}
                <span class="text-sm font-black text-gray-800">${displayPct}%</span>
              </div>
            </div>
            <input type="range" min="0" max="100" value="${displayPct}"
              ${autoProgress ? 'disabled' : ''}
              onchange="RepertoireTracker.setProgress(${song.id}, parseInt(this.value), true)"
              class="w-full h-2 accent-amber-500 ${autoProgress ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}" />
            <div class="w-full bg-gray-100 rounded-full h-2">
              <div class="${STATE_STYLES[song.state]?.bar || 'bg-amber-400'} h-2 rounded-full transition-all" style="width:${displayPct}%"></div>
            </div>
            ${parts.length > 0 && autoProgress ? `<p class="text-[10px] text-amber-500">파트 완성도를 기반으로 자동 계산됩니다. "직접 조정 중"으로 바꾸면 수동 조정 가능합니다.</p>` : ''}
          </div>

          <!-- 파트 목록 -->
          <div class="space-y-3">
            <p class="text-xs font-black text-gray-500">🎸 파트 관리</p>
            ${parts.length > 0
              ? `<div class="space-y-2">${partsHTML}</div>`
              : `<p class="text-xs text-gray-300 text-center py-3">파트를 추가하면 각 파트별로 완성도를 관리할 수 있어요</p>`}

            <!-- 파트 추가 버튼들 -->
            <div>
              <p class="text-[10px] text-gray-400 mb-1.5">파트 추가</p>
              <div class="flex flex-wrap gap-1.5">
                ${availableFixed.map(fp => `
                  <button onclick="RepertoireTracker.addPart(${song.id}, '${fp.id}', '${fp.label}')"
                    class="text-xs px-3 py-1.5 bg-gray-50 hover:bg-amber-50 hover:text-amber-600 text-gray-600
                      font-medium rounded-xl border border-gray-200 transition-colors">
                    ${fp.label}</button>`).join('')}
                <button onclick="RepertoireTracker.addPartCustom(${song.id})"
                  class="text-xs px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-600 font-bold rounded-xl border border-amber-200 transition-colors">
                  + 직접 추가</button>
              </div>
            </div>
          </div>

          <!-- D-Day & 마감일 -->
          <div class="bg-gray-50 rounded-xl p-3">
            <p class="text-xs font-black text-gray-500 mb-2">⏰ 마감일</p>
            <input type="date" value="${song.deadline || ''}"
              onchange="RepertoireTracker.setField(${song.id},'deadline',this.value||null); RepertoireTracker.render()"
              class="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-amber-300" />
          </div>

        </div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ── 카드 렌더링 ───────────────────────────────────────────────────────────
  function songCard(song) {
    const sty = STATE_STYLES[song.state] || STATE_STYLES.learning;
    const pct = song.progress || 0;
    const dd = dday(song.deadline);
    const hasParts = (song.parts || []).length > 0;
    const donePartsCount = hasParts ? (song.parts || []).filter(p => p.level === 3).length : 0;

    return `
      <div class="bg-white rounded-xl border border-gray-200 shadow-sm p-3 space-y-2">
        <div class="flex items-start justify-between gap-2">
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-800 truncate">${song.title}</p>
            ${song.artist ? `<p class="text-xs text-gray-400">${song.artist}</p>` : ''}
          </div>
          <div class="flex items-center gap-1 shrink-0">
            ${dd ? `<span class="text-xs font-bold px-1.5 py-0.5 bg-red-50 text-red-500 rounded-lg">${dd}</span>` : ''}
            <span class="text-xs px-2 py-0.5 rounded-full font-bold ${sty.badge}">${STATE_LABELS[song.state]}</span>
            <button onclick="RepertoireTracker.removeSong(${song.id})" class="text-gray-300 hover:text-red-400 text-xs ml-1 transition-colors">✕</button>
          </div>
        </div>

        <!-- 날짜 정보 -->
        <div class="flex gap-3 text-[10px] text-gray-400">
          <span>📅 ${song.addedAt ? new Date(song.addedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '-'} 등록</span>
          <span>🎸 최근 ${song.lastPracticedAt ? new Date(song.lastPracticedAt).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }) : '없음'}</span>
          ${hasParts ? `<span>파트 ${donePartsCount}/${(song.parts||[]).length} 완성</span>` : ''}
        </div>

        <!-- 완성도 바 -->
        <div class="space-y-1">
          <div class="flex justify-between text-xs text-gray-400">
            <span>완성도${hasParts && !song.partsManual ? ' <span class="text-amber-500 text-[10px]">자동</span>' : ''}</span>
            <span class="font-bold text-gray-700">${pct}%</span>
          </div>
          <input type="range" min="0" max="100" value="${pct}"
            ${hasParts && !song.partsManual ? 'disabled' : `onchange="RepertoireTracker.setProgress(${song.id}, parseInt(this.value))"`}
            class="w-full h-2 accent-amber-500 ${hasParts && !song.partsManual ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}" />
          <div class="w-full bg-gray-100 rounded-full h-1.5">
            <div class="${sty.bar} h-1.5 rounded-full transition-all" style="width:${pct}%"></div>
          </div>
        </div>

        ${!hasParts ? `
        <div class="flex gap-2 flex-wrap text-xs">
          <label class="flex items-center gap-1 text-gray-500">BPM:
            <input type="number" min="40" max="300" value="${song.bpm || ''}" placeholder="120"
              onchange="RepertoireTracker.setField(${song.id},'bpm',parseInt(this.value)||0)"
              class="w-16 border border-gray-200 rounded px-1 py-0.5 text-xs focus:outline-none focus:border-amber-300" />
          </label>
        </div>` : ''}

        <!-- 버튼 -->
        <div class="flex gap-2">
          <button onclick="RepertoireTracker.practiceSong(${song.id})"
            class="flex-1 text-xs py-1.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg transition-colors">
            🎸 연습하기
          </button>
          <button onclick="RepertoireTracker.openDetailModal(${song.id})"
            class="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 font-bold rounded-lg transition-colors">
            상세 관리
          </button>
        </div>
      </div>`;
  }

  function render() {
    const board = document.getElementById('rep-board');
    if (!board) return;
    const songs = load();
    const inProgress = songs.filter(s => s.state !== 'mastered');
    const mastered = songs.filter(s => s.state === 'mastered');

    board.innerHTML = `
      <div class="mb-6">
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-black text-gray-700">🎯 진행 중인 곡</h3>
          <span class="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">${inProgress.length}곡</span>
        </div>
        ${inProgress.length
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">${inProgress.map(songCard).join('')}</div>`
          : `<p class="text-sm text-gray-300 py-6 text-center">등록된 곡이 없습니다</p>`}
      </div>
      <div>
        <div class="flex items-center gap-2 mb-3">
          <h3 class="text-sm font-black text-gray-700">🏆 완료 곡 (Mastered)</h3>
          <span class="text-xs bg-purple-100 text-purple-700 font-bold px-2 py-0.5 rounded-full">${mastered.length}곡</span>
        </div>
        ${mastered.length
          ? `<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">${mastered.map(songCard).join('')}</div>`
          : `<p class="text-sm text-gray-300 py-4 text-center">완성된 곡을 여기서 확인하세요</p>`}
      </div>`;
  }

  return {
    addSong, setProgress, setField, removeSong, practiceSong, render, syncFromCloud,
    openDetailModal, addPart, addPartCustom, removePart, updatePart, togglePartsManual,
    linkPreset, unlinkPreset, openLinkedPreset,

  };
})();

// ═══════════════════════════════════════════════════════════════════════════
// ChallengeTracker: 주간 챌린지 진행률 추적
// ═══════════════════════════════════════════════════════════════════════════
const ChallengeTracker = (() => {
  function _weekKey() {
    const d = new Date(), day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const y = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return y + '-M' + mm + dd;
  }

  function _getWeekDates() {
    const d = new Date(), day = d.getDay();
    const monday = new Date(d);
    monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(monday);
      dt.setDate(monday.getDate() + i);
      dates.push(dt.getFullYear() + '-' + String(dt.getMonth()+1).padStart(2,'0') + '-' + String(dt.getDate()).padStart(2,'0'));
    }
    return dates;
  }

  function _getProg() {
    const wk = _weekKey();
    if (Storage.get('rf_chal_week_app') !== wk) {
      Storage.set('rf_chal_week_app', wk);
      Storage.set('rf_chal_prog', {});
      return {};
    }
    return Storage.get('rf_chal_prog', {});
  }

function _setProg(prog) {
  Storage.set('rf_chal_week_app', _weekKey());
  Storage.set('rf_chal_prog', prog);
  // Firestore 비동기 저장 (chalProg 변경 즉시 반영)
  if (typeof FireDB !== 'undefined' && FireDB.isReady() && FireDB.getUsername()) {
    FireDB.saveProfile({
      chalProg: prog,
      chalWeek: _weekKey(),
      updatedAt: new Date().toISOString(),
    }).catch(e => console.warn('[ChallengeTracker] saveProfile 실패:', e));
  }
}

  // ── 이번 주 활성 챌린지 3개 계산 (seededShuffle 내부 구현) ───
  function _getActiveThree() {
    const seed = parseInt(_weekKey().replace(/\D/g, ''));
    const arr = [...CONFIG.WEEKLY_CHALLENGES];
    let s = seed;
    for (let i = arr.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const j = Math.abs(s) % (i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr.slice(0, 3);
  }

  // ── 보상 지급 여부 추적 ───────────────────────────────────────
  function _rewardedKey() { return 'rf_chal_rewarded_' + _weekKey(); }
  function _getRewarded() {
    try { return new Set(JSON.parse(localStorage.getItem(_rewardedKey())) || []); }
    catch { return new Set(); }
  }
  function _markRewarded(id) {
    const s = _getRewarded(); s.add(id);
    localStorage.setItem(_rewardedKey(), JSON.stringify([...s]));
  }

  // ── 패치 전 달성분: 보상 없이 처리 (최초 1회) ───────────────
  function _initRewardsIfNeeded(prog) {
    const initKey = 'rf_chal_reward_init_' + _weekKey();
    if (localStorage.getItem(initKey)) return;
    localStorage.setItem(initKey, '1');
    const rewarded = _getRewarded();
    _getActiveThree().forEach(c => {
      if ((prog[c.id] || 0) >= c.goal) rewarded.add(c.id);
    });
    localStorage.setItem(_rewardedKey(), JSON.stringify([...rewarded]));
  }

  // ── 달성 감지 → 보상 + 축하 ─────────────────────────────────
function _checkAndReward(prog) {
    _initRewardsIfNeeded(prog);
    const rewarded = _getRewarded();
    _getActiveThree().forEach(c => {
      if ((prog[c.id] || 0) >= c.goal && !rewarded.has(c.id)) {
        _markRewarded(c.id);
        if (typeof AppState !== 'undefined' && c.xpReward) AppState.addXP(c.xpReward);
        _showChallengeComplete(c);
      }
    });
  }

  // ── 콘페티 ──────────────────────────────────────────────────
  function _launchConfetti() {
    if (!document.getElementById('confetti-css')) {
      const st = document.createElement('style');
      st.id = 'confetti-css';
      st.textContent = '@keyframes cfFall{0%{transform:translateY(-10px) rotate(0deg);opacity:1}100%{transform:translateY(110vh) rotate(720deg);opacity:0}}';
      document.head.appendChild(st);
    }
    const colors = ['#FF6B00','#FFD700','#FF4500','#34d399','#60a5fa','#f472b6','#a78bfa','#fb923c'];
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:10000;overflow:hidden;';
    for (let i = 0; i < 100; i++) {
      const p = document.createElement('div');
      const size = Math.random() * 9 + 4;
      const dur = (Math.random() * 1.5 + 1.2).toFixed(2);
      const delay = (Math.random() * 0.9).toFixed(2);
      p.style.cssText = 'position:absolute;width:' + size + 'px;height:' + size + 'px;background:' + colors[i % colors.length] + ';left:' + (Math.random()*100).toFixed(1) + '%;top:' + (Math.random()*-15).toFixed(1) + '%;border-radius:' + (Math.random()>0.5?'50%':'3px') + ';animation:cfFall ' + dur + 's ' + delay + 's ease-in forwards;';
      wrap.appendChild(p);
    }
    document.body.appendChild(wrap);
    setTimeout(function() { wrap.remove(); }, 3500);
  }

  // ── 달성 팝업 ────────────────────────────────────────────────
  function _showChallengeComplete(c) {
    _launchConfetti();
    if (!document.getElementById('chal-pop-css')) {
      const st = document.createElement('style');
      st.id = 'chal-pop-css';
      st.textContent = '@keyframes chalPop{0%{opacity:0;transform:translate(-50%,-50%) scale(0.4)}70%{transform:translate(-50%,-50%) scale(1.08)}100%{opacity:1;transform:translate(-50%,-50%) scale(1)}}';
      document.head.appendChild(st);
    }
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:50%;left:50%;z-index:10001;text-align:center;pointer-events:none;animation:chalPop 0.45s cubic-bezier(0.175,0.885,0.32,1.275) forwards;';
    el.innerHTML = '<div style="background:#fff;border-radius:28px;box-shadow:0 24px 64px rgba(0,0,0,0.18);padding:32px 40px;border:2.5px solid #fbbf24;">'
      + '<div style="font-size:44px;margin-bottom:10px;">' + c.icon + '</div>'
      + '<div style="font-size:19px;font-weight:900;color:#1f2937;margin-bottom:4px;">챌린지 달성! 🎉</div>'
      + '<div style="font-size:13px;color:#6b7280;margin-bottom:14px;">' + c.title + '</div>'
      + '<div style="font-size:26px;font-weight:900;color:#f59e0b;letter-spacing:-0.5px;">+' + c.xpReward + ' XP</div>'
      + '</div>';
    document.body.appendChild(el);
    setTimeout(function() { el.remove(); }, 3200);
  }

  // ── 진행 업데이트 ────────────────────────────────────────────
  function _inc(id, amount) {
    const prog = _getProg();
    prog[id] = (prog[id] || 0) + amount;
    _setProg(prog);
    _checkAndReward(prog);
    if (typeof AppState !== 'undefined') AppState.renderDashboard();
  }

  function _set(id, value) {
    const prog = _getProg();
    prog[id] = value;
    _setProg(prog);
  }

  function recalc() {
    const weekDates = _getWeekDates();
    let practiceDays = 0, totalMin = 0, waterDays = 0;
    let theoryDays = 0, warmupCount = 0, perfectDays = 0;

    weekDates.forEach(function(dateStr) {
      const log = Storage.getLog(dateStr);
      if (!log) return;
      practiceDays++;
      totalMin += log.totalMin || 0;
      if ((log.totalMin || 0) >= 30) waterDays++;
      if ((log.sessions || []).some(function(s) { return s.type === 'theory'; })) theoryDays++;
      warmupCount += (log.sessions || []).filter(function(s) { return s.type === 'warmup'; }).length;
      if (log.allCompleted) perfectDays++;
    });

    const prog = _getProg();
    prog['practice_5days'] = practiceDays;
    prog['total_120min'] = totalMin;
    prog['water_3times'] = waterDays;
    prog['theory_2days'] = theoryDays;
    prog['warmup_3'] = warmupCount;
    prog['perfect_set'] = perfectDays;
    _setProg(prog);
    _initRewardsIfNeeded(prog);  // 기존 달성분 보상 없이 처리
    _checkAndReward(prog);       // 신규 달성분 보상
    if (typeof AppState !== 'undefined') AppState.renderDashboard();
  }

  function addPomo() { _inc('pomo_5sessions', 1); }
  function addSpeedBuilder() { _inc('speed_builder_2', 1); }

  function addRepSong() {
    const prog = _getProg();
    prog['rep_add_1'] = (prog['rep_add_1'] || 0) + 1;
    _setProg(prog);
    _checkAndReward(prog);
    if (typeof AppState !== 'undefined') AppState.renderDashboard();
  }

  function addRepLevelUp(oldState, newState) {
    const order = ['learning', 'polishing', 'ready', 'mastered'];
    if (order.indexOf(newState) > order.indexOf(oldState)) {
      _inc('rep_level_up', 1);
    }
  }

  return { recalc, addPomo, addSpeedBuilder, addRepSong, addRepLevelUp };
})();



// ═══════════════════════════════════════════════════════════════════════════
// CrewRanking: 실제 Firestore 기반 시즌 랭킹 (4개 카테고리)
// ═══════════════════════════════════════════════════════════════════════════
const CrewRanking = (() => {
  const CATEGORIES = [
    { id: 'seasonXp',    label: '시즌 XP',    icon: '⚡', unit: 'XP', key: r => r.seasonXp || 0,    color: 'amber',  localKey: 'rf_season_xp' },
    { id: 'seasonWater', label: '시즌 물주기', icon: '💧', unit: '회', key: r => r.seasonWater || 0, color: 'blue',   localKey: 'rf_season_water' },
    { id: 'streak',      label: '연속 출석',   icon: '🔥', unit: '일', key: r => r.streak || 0,      color: 'orange', localKey: CONFIG.KEYS.STREAK },
    { id: 'seasonMin',   label: '연습 시간',   icon: '⏱', unit: '분', key: r => r.seasonMin || 0,   color: 'green',  localKey: 'rf_season_min' },
  ];
  const GRAD = {
    amber: 'from-amber-400 to-orange-500',
    blue:  'from-blue-400 to-cyan-500',
    orange:'from-orange-400 to-red-500',
    green: 'from-green-400 to-emerald-500',
  };
  const MEDALS = ['🥇', '🥈', '🥉'];

  let _cache = null, _cacheTime = 0;
  function _invalidateCache() { _cache = null; _cacheTime = 0; }


  async function _fetchAll() {
    if (_cache && Date.now() - _cacheTime < 60000) return _cache;
    if (typeof FireDB === 'undefined' || !FireDB.isReady()) return [];
    const { seasonKey } = getSeasonInfo();
    const all = await FireDB.loadSeasonRankings(seasonKey);
    _cache = all.filter(r => r.firstLogDate || r.seasonXp > 0 || r.seasonMin > 0);
    _cacheTime = Date.now();
    return _cache;
  }

  async function openModal(catId) {
    const cat = CATEGORIES.find(c => c.id === catId);
    if (!cat) return;
    const existing = document.getElementById('ranking-modal');
    if (existing) existing.remove();
    const { daysLeft } = getSeasonInfo();
    const dLabel = daysLeft <= 0 ? 'D-DAY' : `D-${daysLeft}`;

    const modal = document.createElement('div');
    modal.id = 'ranking-modal';
    modal.className = 'fixed inset-0 z-50 flex items-center justify-center p-4';
    modal.style.background = 'rgba(0,0,0,0.45)';
    modal.innerHTML = `
      <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div class="flex items-center gap-3 px-5 py-4 bg-amber-50 border-b border-amber-200">
          <span class="text-2xl">${cat.icon}</span>
          <div>
            <p class="font-black text-gray-800 text-base">${cat.label} 랭킹</p>
            <p class="text-xs text-gray-400">상위 3위 + 내 순위 · ${dLabel}</p>
          </div>
          <button onclick="document.getElementById('ranking-modal').remove()"
            class="ml-auto w-8 h-8 rounded-xl bg-white/70 hover:bg-white flex items-center justify-center text-gray-500 font-bold text-lg">✕</button>
        </div>
        <div id="ranking-modal-body" class="p-4">
          <p class="text-center text-gray-400 py-8 text-sm">불러오는 중...</p>
        </div>
      </div>`;
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);

    try {
      const all = await _fetchAll();
      const ranked = [...all].sort((a, b) => cat.key(b) - cat.key(a));
      const myName = Storage.get(CONFIG.KEYS.USERNAME, '');
      const myIdx = myName ? ranked.findIndex(r => r.username === myName) : -1;
      const body = document.getElementById('ranking-modal-body');
      if (!body) return;

      if (ranked.length === 0) {
        body.innerHTML = `<p class="text-center text-gray-400 py-8 text-sm">아직 참가자가 없어요 🎸<br><span class="text-xs">연습 일지를 저장하면 자동 등록됩니다</span></p>`;
        return;
      }

      const showSet = new Set([0, 1, 2]);
      if (myIdx >= 3) showSet.add(myIdx);

      let rows = '';
      ranked.forEach((r, i) => {
        if (!showSet.has(i)) return;
        const isMe = r.username === myName;
        if (i === myIdx && myIdx > 3) {
          rows += `<div class="flex items-center gap-2 my-1.5">
            <div class="flex-1 border-t border-dashed border-gray-200"></div>
            <span class="text-xs text-gray-300">···</span>
            <div class="flex-1 border-t border-dashed border-gray-200"></div>
          </div>`;
        }
        rows += `<div class="flex items-center gap-3 p-2.5 rounded-xl ${isMe ? 'bg-amber-50 border border-amber-200' : 'bg-gray-50'}">
          <span class="text-lg w-7 text-center shrink-0">${i < 3 ? MEDALS[i] : (i + 1) + '위'}</span>
          <span class="text-xl shrink-0">${r.avatar || '🎸'}</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-bold text-gray-800 truncate">${r.username}${isMe ? ' <span class="text-amber-500 text-xs">(나)</span>' : ''}</p>
          </div>
          <span class="text-sm font-black text-amber-600 shrink-0">${cat.key(r).toLocaleString()} ${cat.unit}</span>
        </div>`;
      });

      body.innerHTML = `<div class="space-y-1.5">${rows}</div>`;
      if (myName && myIdx < 0) {
        body.innerHTML += `<p class="text-xs text-center text-gray-400 mt-3">이번 시즌 아직 연습 기록이 없어요</p>`;
      }
    } catch {
      const body = document.getElementById('ranking-modal-body');
      if (body) body.innerHTML = `<p class="text-center text-red-400 py-8 text-sm">불러오기 실패. 네트워크를 확인해주세요.</p>`;
    }
  }

  async function render() {
    const board = document.getElementById('ranking-board');
    if (!board) return;
    const { daysLeft } = getSeasonInfo();
    const dLabel = daysLeft <= 0 ? 'D-DAY' : `D-${daysLeft}`;
    const myName = Storage.get(CONFIG.KEYS.USERNAME, '');

    // 스켈레톤
    board.innerHTML = CATEGORIES.map(() =>
      `<div class="rounded-3xl bg-gray-100 animate-pulse" style="min-height:190px"></div>`
    ).join('');

    let all = [];
    try { all = await _fetchAll(); } catch { }

    board.innerHTML = CATEGORIES.map(cat => {
      const ranked = [...all].sort((a, b) => cat.key(b) - cat.key(a));
      const top = ranked[0] || null;
      const myIdx = myName ? ranked.findIndex(r => r.username === myName) : -1;
      const myRank = myIdx >= 0 ? myIdx + 1 : null;
      const myVal = Storage.get(cat.localKey, 0);
      const g = GRAD[cat.color];

      return `<div onclick="CrewRanking.openModal('${cat.id}')"
        class="relative overflow-hidden rounded-3xl cursor-pointer bg-gradient-to-br ${g}
          shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 flex flex-col"
        style="min-height:190px">
        <div class="absolute -top-5 -right-5 w-20 h-20 rounded-full bg-white/10 pointer-events-none"></div>
        <div class="absolute -bottom-3 -left-3 w-12 h-12 rounded-full bg-white/10 pointer-events-none"></div>

        <div class="flex items-center justify-between px-3 pt-3 pb-1">
          <div class="flex items-center gap-1.5">
            <span class="text-xl drop-shadow">${cat.icon}</span>
            <p class="text-[11px] font-black text-white/90">${cat.label}</p>
          </div>
          <span class="text-[10px] font-black bg-white/20 text-white rounded-full px-1.5 py-0.5">${dLabel}</span>
        </div>

        ${top ? `
        <div class="flex-1 flex flex-col items-center justify-center px-3 py-1 gap-0.5">
          <div class="text-2xl drop-shadow">${top.avatar || '🎸'}</div>
          <div class="flex items-center gap-0.5">
            <span class="text-sm">🥇</span>
            <p class="text-xs font-black text-white drop-shadow truncate max-w-[80px]">${top.username}</p>
          </div>
          <p class="text-lg font-black text-white drop-shadow">${cat.key(top).toLocaleString()}<span class="text-xs ml-0.5 opacity-80">${cat.unit}</span></p>
        </div>
        ` : `
        <div class="flex-1 flex items-center justify-center">
          <p class="text-white/60 text-xs font-medium">아직 참가자 없음</p>
        </div>
        `}

        <div class="mx-2 mb-3 px-2.5 py-1.5 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-between">
          <span class="text-[10px] text-white/80 font-bold">내 순위</span>
          <span class="text-[11px] font-black text-white">${myRank ? (myRank === 1 ? '👑 1위!' : myRank + '위') : '미참가'} · ${myVal.toLocaleString()} ${cat.unit}</span>
        </div>
      </div>`;
    }).join('');
  }
return { render, openModal, _invalidateCache };
})();

// ═══════════════════════════════════════════════════════════════════════════
// ProgressStory: 성장 스토리 리포트
// ═══════════════════════════════════════════════════════════════════════════
const ProgressStory = (() => {

  function getMyStats() {
    const xp = Storage.get(CONFIG.KEYS.XP, 0);
    const water = Storage.get(CONFIG.KEYS.WATER, 0);
    const streak = Storage.get(CONFIG.KEYS.STREAK, 0);
    let masteredCount = 0, totalSongs = 0;
    try {
      const rep = JSON.parse(localStorage.getItem('rf_repertoire')) || [];
      totalSongs = rep.length;
      masteredCount = rep.filter(s => s.state === 'mastered').length;
    } catch { }

    // 첫 연습일 추출 (rf_log_YYYY-MM-DD 키 중 가장 오래된 날짜)
    let firstDate = null;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith('rf_log_')) {
        const d = key.replace('rf_log_', '');
        if (!firstDate || d < firstDate) firstDate = d;
      }
    }

    // 해금 기타 수
    let unlockedGuitars = 0;
    CONFIG.VIRTUAL_GUITARS.forEach(g => {
      const c = g.unlockCond;
      if (c.type === 'default') unlockedGuitars++;
      if (c.type === 'water' && water >= c.count) unlockedGuitars++;
      if (c.type === 'streak' && streak >= c.days) unlockedGuitars++;
      if (c.type === 'mastered' && masteredCount >= c.count) unlockedGuitars++;
    });

    return { xp, water, streak, masteredCount, totalSongs, firstDate, unlockedGuitars };
  }
  const REMINDERS = [
    d => `첫 여정을 시작한 지 ${d}일째입니다 🎸`,
    d => `${d}일째 계속되는 당신의 여정, 자랑스러워요!`,
    () => `오늘도 기타를 든 당신, 그것만으로도 충분합니다 🌱`,
    () => `천 리 길도 한 음부터. 오늘의 한 소절이 내일의 음악이 됩니다 🎵`,
    d => `이미 <strong>${d}일째</strong> 성장 중입니다. 멈추지 마세요!`,
    () => `연습이 쌓이면 언젠가 무대가 됩니다. 포기하지 마세요 ✨`,
  ];
  function buildNarrative(s) {
    const now = new Date();
    const year = now.getFullYear();
    const mon = now.getMonth() + 1;
    const firstStr = s.firstDate
      ? new Date(s.firstDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
      : '알 수 없는 날';

    const paras = [];

    paras.push(`${year}년 ${mon}월, 당신의 기타 여정은 계속되고 있습니다.`);

    if (s.firstDate) paras.push(`${firstStr}에 처음 RiffForge를 열었던 그날부터, 당신은 꾸준히 기타와 함께했습니다.`);

    if (s.water > 0) paras.push(`지금까지 총 <strong>${s.water}번</strong> 기타 나무에 물을 주며 연습의 불꽃을 이어왔습니다.`);

    if (s.streak > 0) paras.push(`현재 <strong>${s.streak}일 연속</strong> 연습 중입니다. 이 꾸준함이 당신을 특별하게 만듭니다.`);

    if (s.totalSongs > 0)
      paras.push(`레퍼토리에 <strong>${s.totalSongs}곡</strong>을 등록했고, 그 중 <strong>${s.masteredCount}곡</strong>을 완전히 마스터했습니다.`);

    if (s.xp > 0) paras.push(`지금까지 쌓은 경험치는 <strong>${s.xp.toLocaleString()} XP</strong>입니다.`);

    if (s.unlockedGuitars > 1)
      paras.push(`노력 덕분에 총 <strong>${s.unlockedGuitars}개</strong>의 기타를 컬렉션에 추가했습니다.`);

    paras.push(`앞으로도 크루와 함께, 한 음씩 더 나아가봐요. 🎸`);

    return paras.map(p => `<p>${p}</p>`).join('');
  }

  function render() {
    const s = getMyStats();
    // 감성 리마인더
    const reminder = document.getElementById('story-reminder');
    if (reminder) {
      const days = s.firstDate ? Math.floor((Date.now() - new Date(s.firstDate)) / 86400000) + 1 : 1;
      const fn = REMINDERS[Math.floor(Math.random() * REMINDERS.length)];
      reminder.textContent = fn(days);
    }
    const card = document.getElementById('progress-story-card');
    if (card) card.innerHTML = buildNarrative(s);

    const grid = document.getElementById('progress-stats-grid');
    if (grid) {
      const stats = [
        { icon: '⚡', label: '누적 XP', value: s.xp.toLocaleString() + ' XP' },
        { icon: '💧', label: '물주기 횟수', value: s.water + '회' },
        { icon: '📅', label: '연속 연습', value: s.streak + '일' },
        { icon: '🏆', label: '마스터 곡', value: s.masteredCount + '곡' },
      ];
      grid.innerHTML = stats.map(st => `
        <div class="bg-white rounded-2xl border border-amber-100 shadow-sm p-4 text-center">
          <div class="text-2xl mb-1">${st.icon}</div>
          <div class="text-xs text-gray-400 mb-1">${st.label}</div>
          <div class="text-lg font-black text-gray-800">${st.value}</div>
        </div>`).join('');
    }
  }



  return { render };
})();
