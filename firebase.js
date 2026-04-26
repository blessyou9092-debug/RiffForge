/**
 * RiffForge - firebase.js
 * Firebase 초기화 + Firestore 헬퍼
 * 로드 순서: config.js → firebase.js → audio.js → fretboard.js → builder_log.js → app.js
 */

// ── Firebase SDK (CDN 모듈 방식) ────────────────────────────────────────────
// index.html의 <script> 태그보다 먼저 import가 실행되도록 이 파일 자체를 module로 로드합니다.
// 단, 기존 앱이 모듈 방식이 아니므로 window에 노출하는 방식으로 처리합니다.

const _FB_CONFIG = {
  apiKey: "AIzaSyC-5KU-7C5CoaIzBQOtw3LroEmFcsgOhLE",
  authDomain: "riffforge-abb62.firebaseapp.com",
  projectId: "riffforge-abb62",
  storageBucket: "riffforge-abb62.firebasestorage.app",
  messagingSenderId: "908764743590",
  appId: "1:908764743590:web:a88d6849ec5c06aa79f167"
};

// ── DB 인스턴스 (초기화 후 할당) ────────────────────────────────────────────
let _db = null;
let _fbReady = false;
const _fbReadyCallbacks = [];

function onFirebaseReady(cb) {
  if (_fbReady) { cb(); return; }
  _fbReadyCallbacks.push(cb);
}

// ── Firebase 초기화 (CDN compat 방식) ────────────────────────────────────────
// index.html에 compat SDK 스크립트를 추가해야 합니다 (아래 안내 참고)
function _initFirebase() {
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(_FB_CONFIG);
    }
    _db = firebase.firestore();
    // 오프라인 지속성 활성화 (앱 껐다 켜도 캐시 유지)
    _db.enablePersistence({ synchronizeTabs: true }).catch(err => {
      if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
        console.warn('[Firebase] persistence 오류:', err);
      }
    });
    _fbReady = true;
    _fbReadyCallbacks.forEach(cb => cb());
    console.log('[Firebase] 초기화 완료 ✅');
  } catch (e) {
    console.error('[Firebase] 초기화 실패:', e);
  }
}

// DOM 로드 후 초기화
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _initFirebase);
} else {
  _initFirebase();
}

// ═══════════════════════════════════════════════════════════════════════════
// FireDB: Firestore 헬퍼 (앱 전체에서 사용)
// 경로 규칙:
//   개인 데이터: users/{username}/...
//   게시판:      board/{postId}
// ═══════════════════════════════════════════════════════════════════════════
const FireDB = (() => {

  // ── 현재 사용자 이름 (로그인 없이 이름으로 식별) ──────────────────────────
  function _username() {
    try {
      const name = JSON.parse(localStorage.getItem(CONFIG.KEYS.USERNAME) || '""');
      return (name || '').trim() || null;
    } catch { return null; }
  }

  function _userDoc(subPath) {
    const name = _username();
    if (!name) return null;
    return _db.doc(`users/${name}/${subPath}`);
  }

  function _userCol(colPath) {
    const name = _username();
    if (!name) return null;
    return _db.collection(`users/${name}/${colPath}`);
  }

  // ── 프로필 (XP, 물주기, 스트릭 등) ──────────────────────────────────────
  async function saveProfile(data) {
    const ref = _userDoc('data/profile');
    if (!ref) return;
    try {
      await ref.set(data, { merge: true });
    } catch (e) { console.warn('[FireDB] saveProfile 실패:', e); }
  }

  async function loadProfile() {
    const ref = _userDoc('data/profile');
    if (!ref) return null;
    try {
      const snap = await ref.get();
      return snap.exists ? snap.data() : null;
    } catch (e) { console.warn('[FireDB] loadProfile 실패:', e); return null; }
  }

  // ── 연습일지 (날짜별) ─────────────────────────────────────────────────────
  async function saveLog(dateStr, logData) {
    const ref = _userDoc(`logs/${dateStr}`);
    if (!ref) return;
    try {
      await ref.set(logData);
    } catch (e) { console.warn('[FireDB] saveLog 실패:', e); }
  }

  async function loadLog(dateStr) {
    const ref = _userDoc(`logs/${dateStr}`);
    if (!ref) return null;
    try {
      const snap = await ref.get();
      return snap.exists ? snap.data() : null;
    } catch (e) { console.warn('[FireDB] loadLog 실패:', e); return null; }
  }

  async function loadAllLogs() {
    const col = _userCol('logs');
    if (!col) return [];
    try {
      const snap = await col.get();
      return snap.docs.map(d => d.data());
    } catch (e) { console.warn('[FireDB] loadAllLogs 실패:', e); return []; }
  }
  async function deleteLog(dateStr) {
    const ref = _userDoc(`logs/${dateStr}`);
    if (!ref) return;
    try {
      await ref.delete();
    } catch (e) { console.warn('[FireDB] deleteLog 실패:', e); }
  }

  // ── 레퍼토리 ──────────────────────────────────────────────────────────────
  async function saveRepertoire(songs) {
    const ref = _userDoc('data/repertoire');
    if (!ref) return;
    try {
      await ref.set({ songs });
    } catch (e) { console.warn('[FireDB] saveRepertoire 실패:', e); }
  }

  async function loadRepertoire() {
    const ref = _userDoc('data/repertoire');
    if (!ref) return null;
    try {
      const snap = await ref.get();
      return snap.exists ? snap.data().songs : null;
    } catch (e) { console.warn('[FireDB] loadRepertoire 실패:', e); return null; }
  }
  // ── 유저 백킹 프리셋 ──────────────────────────────────────────────────────
  async function savePresets(presets) {
    const ref = _userDoc('data/presets');
    if (!ref) return;
    try { await ref.set({ presets }); }
    catch (e) { console.warn('[FireDB] savePresets 실패:', e); }
  }

  async function loadPresets() {
    const ref = _userDoc('data/presets');
    if (!ref) return null;
    try {
      const snap = await ref.get();
      return snap.exists ? snap.data().presets : null;
    } catch (e) { console.warn('[FireDB] loadPresets 실패:', e); return null; }
  }
  // ── 루틴 프리셋 ──────────────────────────────────────────────────────────────
  async function saveRoutinePresets(presets) {
    const ref = _userDoc('data/routine_presets');
    if (!ref) return;
    try { await ref.set({ presets }); }
    catch (e) { console.warn('[FireDB] saveRoutinePresets 실패:', e); }
  }

  async function loadRoutinePresets() {
    const ref = _userDoc('data/routine_presets');
    if (!ref) return null;
    try {
      const snap = await ref.get();
      return snap.exists ? snap.data().presets : null;
    } catch (e) { console.warn('[FireDB] loadRoutinePresets 실패:', e); return null; }
  }

  // ── 크루 게시판 ───────────────────────────────────────────────────────────
  const _boardCol = () => _db.collection('board');

  async function fetchPosts() {
    try {
      const snap = await _boardCol()
        .orderBy('createdAt', 'desc')
        .limit(100)
        .get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (e) { console.warn('[FireDB] fetchPosts 실패:', e); return []; }
  }
  async function fetchPostsPage(lastDoc, limitNum) {
    try {
      let q = _boardCol().orderBy('createdAt', 'desc').limit(limitNum || 4);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      return {
        posts: snap.docs.map(d => ({ id: d.id, ...d.data() })),
        lastDoc: snap.docs.length ? snap.docs[snap.docs.length - 1] : null,
        hasMore: snap.docs.length === (limitNum || 4),
      };
    } catch (e) {
      console.warn('[FireDB] fetchPostsPage 실패:', e);
      return { posts: [], lastDoc: null, hasMore: false };
    }
  }

  async function savePost(post) {
    try {
      const { id, ...data } = post;
      await _boardCol().doc(id).set(data);
    } catch (e) { console.warn('[FireDB] savePost 실패:', e); }
  }

  async function updatePost(postId, data) {
    try {
      await _boardCol().doc(postId).set(data, { merge: true });
    } catch (e) { console.warn('[FireDB] updatePost 실패:', e); }
  }

  async function deletePost(postId) {
    try {
      await _boardCol().doc(postId).delete();
    } catch (e) { console.warn('[FireDB] deletePost 실패:', e); }
  }
  // ── 크루 시즌 랭킹 ──────────────────────────────────────────────────────────
  async function saveRanking(seasonKey, data) {
    const name = _username();
    if (!name) return;
    try {
      await _db.doc(`rankings/${seasonKey}/users/${name}`).set(data, { merge: true });
    } catch (e) { console.warn('[FireDB] saveRanking 실패:', e); }
  }

  async function loadSeasonRankings(seasonKey) {
    try {
      const snap = await _db.collection(`rankings/${seasonKey}/users`).get();
      return snap.docs.map(d => ({ username: d.id, ...d.data() }));
    } catch (e) { console.warn('[FireDB] loadSeasonRankings 실패:', e); return []; }
  }

  // 게시판 실시간 구독 (30초 폴링 대체)
  function subscribeBoard(callback) {
    return _boardCol()
      .orderBy('createdAt', 'desc')
      .limit(10)
      .onSnapshot(snap => {
        const posts = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const lastDoc = snap.docs.length ? snap.docs[snap.docs.length - 1] : null;
        callback(posts, lastDoc);
      }, err => console.warn('[FireDB] subscribeBoard 오류:', err));
  }


  return {
    onReady: onFirebaseReady,
    saveProfile, loadProfile,
    saveLog, loadLog, loadAllLogs, deleteLog,
    saveRepertoire, loadRepertoire,
    fetchPosts, fetchPostsPage, savePost, updatePost, deletePost,
    subscribeBoard,
    saveRanking, loadSeasonRankings,
    savePresets, loadPresets,
        saveRoutinePresets, loadRoutinePresets,
    isReady: () => _fbReady,
    getUsername: _username,
  };
})();
