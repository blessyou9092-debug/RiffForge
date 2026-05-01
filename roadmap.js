// roadmap.js — RiffForge 마스터리 로드맵 UI
const RoadmapUI = (() => {
  const STORAGE_KEY = 'rf_roadmap_progress';
  let _activeRoadmap = 'chord';
  let _expandedStages = new Set();

  function _loadProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function _saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
  function _isComplete(rmId, stId) {
    const p = _loadProgress();
    return !!(p[rmId] && p[rmId][stId]);
  }
  function _setComplete(rmId, stId, val) {
    const p = _loadProgress();
    if (!p[rmId]) p[rmId] = {};
    p[rmId][stId] = val;
    _saveProgress(p);
  }

  function onEnter() {
    if (typeof ROADMAP_DATA === 'undefined') {
      console.error('[Roadmap] ROADMAP_DATA not loaded');
      return;
    }
    render();
  }

  function selectRoadmap(id) {
    _activeRoadmap = id;
    _expandedStages.clear();
    render();
  }

  function toggleStage(stageId) {
    if (_expandedStages.has(stageId)) _expandedStages.delete(stageId);
    else _expandedStages.add(stageId);
    render();
  }

  function toggleComplete(rmId, stId, ev) {
    ev?.stopPropagation();
    _setComplete(rmId, stId, !_isComplete(rmId, stId));
    render();
  }

  function gotoTool(tool) {
    if (!tool) return;
    const [page, sub] = tool.split(':');
    if (typeof AppSidebar !== 'undefined') AppSidebar.setActive(page);
    if (sub && page === 'reference' && typeof ReferenceUI !== 'undefined') {
      setTimeout(() => ReferenceUI.switchTab(sub), 50);
    }
  }

  function render() {
    const root = document.getElementById('roadmap-content');
    if (!root) return;
    const data = ROADMAP_DATA[_activeRoadmap];
    if (!data) return;
    _renderTabs();
    _renderProgress(data);
    if (data.stages) {
      root.innerHTML = _renderStages(data);
    } else {
      root.innerHTML = _renderSections(data);
    }
  }

  function _renderTabs() {
    const tabs = document.getElementById('roadmap-tabs');
    if (!tabs) return;
    const ids = ['chord', 'solo', 'backing'];
    tabs.innerHTML = ids.map(id => {
      const r = ROADMAP_DATA[id];
      const on = _activeRoadmap === id;
      return `<button onclick="RoadmapUI.selectRoadmap('${id}')"
        class="px-3 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${on ? 'bg-amber-500 text-white' : 'bg-white text-gray-600 border border-amber-100 hover:bg-amber-50'}">
        ${r.icon} ${r.title}</button>`;
    }).join('');
  }

  function _renderProgress(data) {
    const el = document.getElementById('roadmap-progress');
    if (!el) return;
    const total = data.stages?.length || 0;
    if (total === 0) {
      el.innerHTML = `<p class="text-xs text-gray-500">${data.subtitle}</p>`;
      return;
    }
    const p = _loadProgress()[data.id] || {};
    const done = data.stages.filter(s => p[s.id]).length;
    const pct = total ? Math.round(done / total * 100) : 0;
    el.innerHTML = `
      <div class="flex items-center justify-between mb-1">
        <span class="text-xs font-bold text-gray-600">${data.subtitle}</span>
        <span class="text-xs font-black text-amber-600">${done}/${total} 완료 (${pct}%)</span>
      </div>
      <div class="w-full h-2 bg-amber-100 rounded-full overflow-hidden">
        <div class="h-full bg-amber-500 transition-all" style="width:${pct}%"></div>
      </div>`;
  }

  // ── 코드워크 (stages) ────────────────────────────────
  function _renderStages(data) {
    return `<div class="flex flex-col gap-3">${
      data.stages.map(s => _renderStageCard(data.id, s)).join('')
    }</div>`;
  }

  function _renderStageCard(rmId, stage) {
    const expanded = _expandedStages.has(stage.id);
    const done = _isComplete(rmId, stage.id);
    return `
      <div class="bg-white rounded-2xl border ${done ? 'border-emerald-200' : 'border-amber-100'} shadow-sm overflow-hidden">
        <button onclick="RoadmapUI.toggleStage(${stage.id})"
          class="w-full flex items-center gap-3 p-4 text-left hover:bg-amber-50 transition-all">
          <button onclick="RoadmapUI.toggleComplete('${rmId}', ${stage.id}, event)"
            class="w-7 h-7 rounded-full border-2 ${done ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-gray-400'} flex items-center justify-center font-black text-sm shrink-0 hover:border-emerald-400 transition-all" title="완료 표시">
            ${done ? '✓' : stage.id}
          </button>
          <div class="flex-1 min-w-0">
            <h3 class="font-black text-gray-800 text-sm">${stage.title}</h3>
            <p class="text-xs text-gray-500 mt-0.5">${stage.summary}</p>
          </div>
          <span class="text-gray-400 text-xs shrink-0">${expanded ? '▲' : '▼'}</span>
        </button>
        ${expanded ? _renderStageDetail(stage) : ''}
      </div>`;
  }

  function _renderStageDetail(stage) {
    let body = '';
    if (stage.steps) {
      body += `<div class="flex flex-col gap-2 mb-3">${
        stage.steps.map(st => `
          <div class="p-3 rounded-xl bg-amber-50 border border-amber-100">
            <div class="font-bold text-sm text-gray-700 mb-1">▸ ${st.name}</div>
            <p class="text-xs text-gray-600 mb-1">${st.detail}</p>
            <p class="text-[11px] text-amber-700 italic">💡 ${st.logic}</p>
          </div>`).join('')
      }</div>`;
    }
    if (stage.table) body += _renderTable(stage.table);
    if (stage.tip) {
      body += `<div class="mt-2 p-3 rounded-xl bg-indigo-50 border border-indigo-100">
        <p class="text-xs text-indigo-800"><span class="font-black">💡 핵심 팁: </span>${stage.tip}</p>
      </div>`;
    }
    if (stage.tool) {
      body += `<button onclick="RoadmapUI.gotoTool('${stage.tool}')"
        class="mt-3 w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-sm transition-all">
        📍 ${stage.toolLabel || '도구로 이동'} →
      </button>`;
    }
    return `<div class="px-4 pb-4 border-t border-amber-100 pt-4">${body}</div>`;
  }

  function _renderTable(table) {
    return `<div class="overflow-x-auto -mx-1 mb-2">
      <table class="text-xs w-full border-collapse">
        <thead><tr class="bg-amber-100">${
          table.headers.map(h => `<th class="px-2 py-1.5 text-left font-black text-gray-700 border border-amber-200">${h}</th>`).join('')
        }</tr></thead>
        <tbody>${
          table.rows.map(r => `<tr class="bg-white">${
            r.map(c => `<td class="px-2 py-1.5 text-gray-600 border border-amber-100 align-top">${c}</td>`).join('')
          }</tr>`).join('')
        }</tbody>
      </table>
    </div>`;
  }

  // ── 솔로/반주 (sections) ────────────────────────────────
  function _renderSections(data) {
    let html = '';
    if (data.mindset) html += _renderMindset(data.mindset);
    if (data.phases) html += _renderPhases(data.phases);
    if (data.mistakes) html += _renderMistakes(data.mistakes);
    if (data.routine) html += _renderRoutine(data.routine);
    if (data.checklist) html += _renderChecklist(data.checklist);
    if (data.ideas) html += _renderIdeas(data.ideas);
    if (data.tips) html += _renderTips(data.tips);
    return `<div class="flex flex-col gap-4">${html}</div>`;
  }

  function _renderMindset(items) {
    return `<div class="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
      <h3 class="font-black text-gray-800 text-sm mb-3">🧠 마인드셋</h3>
      <ul class="flex flex-col gap-2">${
        items.map(t => `<li class="flex gap-2 text-sm text-gray-700"><span class="text-amber-500 shrink-0">●</span><span>${t}</span></li>`).join('')
      }</ul>
    </div>`;
  }

  function _renderPhases(phases) {
    return `<div class="grid md:grid-cols-2 gap-3">${
      phases.map(ph => `
        <div class="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
          <h4 class="font-black text-gray-800 text-sm mb-1">${ph.title}</h4>
          <p class="text-xs text-amber-600 italic mb-3">${ph.summary}</p>
          <div class="mb-3">
            <p class="text-[11px] font-black text-emerald-700 uppercase mb-1">✓ 좋은 접근법</p>
            <ul class="flex flex-col gap-1">${ph.good.map(g => `<li class="text-xs text-gray-700">• ${g}</li>`).join('')}</ul>
          </div>
          <div>
            <p class="text-[11px] font-black text-rose-600 uppercase mb-1">✗ 주의할 것</p>
            <ul class="flex flex-col gap-1">${ph.avoid.map(a => `<li class="text-xs text-gray-700">• ${a}</li>`).join('')}</ul>
          </div>
        </div>`).join('')
    }</div>`;
  }

  function _renderMistakes(items) {
    return `<div class="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
      <h3 class="font-black text-gray-800 text-sm mb-3">⚠️ 흔한 실수와 즉시 수정 팁</h3>
      <div class="overflow-x-auto -mx-1">
        <table class="text-xs w-full border-collapse">
          <thead><tr class="bg-rose-50">
            <th class="px-2 py-1.5 text-left font-black text-rose-700 border border-rose-100 w-2/5">실수</th>
            <th class="px-2 py-1.5 text-left font-black text-rose-700 border border-rose-100">바로 고치는 팁</th>
          </tr></thead>
          <tbody>${
            items.map(it => `<tr class="bg-white"><td class="px-2 py-1.5 text-gray-700 border border-rose-100 font-bold align-top">${it.mistake}</td><td class="px-2 py-1.5 text-gray-600 border border-rose-100 align-top">${it.fix}</td></tr>`).join('')
          }</tbody>
        </table>
      </div>
    </div>`;
  }

  function _renderRoutine(items) {
    return `<div class="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
      <h3 class="font-black text-gray-800 text-sm mb-3">📝 제작 루틴</h3>
      <ol class="flex flex-col gap-2">${
        items.map((t, i) => `<li class="flex gap-3 text-sm text-gray-700">
          <span class="w-6 h-6 rounded-full bg-amber-500 text-white font-black text-xs flex items-center justify-center shrink-0">${i + 1}</span>
          <span class="flex-1">${t}</span>
        </li>`).join('')
      }</ol>
    </div>`;
  }

  function _renderChecklist(items) {
    return `<div class="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
      <h3 class="font-black text-gray-800 text-sm mb-3">☑️ 연습 전 체크리스트</h3>
      <ul class="flex flex-col gap-2">${
        items.map(t => `<li class="flex gap-2 text-sm text-gray-700">
          <span class="w-5 h-5 rounded border border-amber-300 shrink-0 flex items-center justify-center text-[10px] text-amber-500">☐</span>
          <span>${t}</span>
        </li>`).join('')
      }</ul>
    </div>`;
  }

  function _renderIdeas(items) {
    return `<div>
      <h3 class="font-black text-gray-800 text-sm mb-3 px-1">💡 아이디어 & 모티브</h3>
      <div class="grid md:grid-cols-2 gap-3">${
        items.map(it => `
          <div class="bg-white rounded-2xl border border-amber-100 shadow-sm p-4">
            <h4 class="font-black text-gray-800 text-sm mb-2">${it.title}</h4>
            <p class="text-xs text-gray-600 mb-2">${it.desc}</p>
            ${it.detail ? `<p class="text-[11px] text-amber-700 italic mb-2">📌 ${it.detail}</p>` : ''}
            ${it.tool ? `<button onclick="RoadmapUI.gotoTool('${it.tool}')" class="text-xs px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 hover:bg-amber-200 font-bold transition-all">📍 ${it.toolLabel || '도구로 이동'} →</button>` : ''}
          </div>`).join('')
      }</div>
    </div>`;
  }

  function _renderTips(items) {
    return `<div class="bg-white rounded-2xl border border-indigo-100 shadow-sm p-5">
      <h3 class="font-black text-gray-800 text-sm mb-3">🎯 실전 노하우</h3>
      <div class="flex flex-col gap-3">${
        items.map((t, i) => `
          <div class="flex gap-3">
            <span class="w-6 h-6 rounded-full bg-indigo-500 text-white font-black text-xs flex items-center justify-center shrink-0">${i + 1}</span>
            <div class="flex-1">
              <p class="font-bold text-sm text-gray-800 mb-0.5">${t.title}</p>
              <p class="text-xs text-gray-600">${t.desc}</p>
            </div>
          </div>`).join('')
      }</div>
    </div>`;
  }

  return { onEnter, selectRoadmap, toggleStage, toggleComplete, gotoTool };
})();
window.RoadmapUI = RoadmapUI;
