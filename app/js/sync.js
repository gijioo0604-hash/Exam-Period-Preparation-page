/* ============================================================
   로그인 · 기기 간 동기화 (Firebase)
   ------------------------------------------------------------
   로그인하지 않아도 앱은 지금까지처럼 전부 동작한다.
   로그인은 '기록을 여러 기기에서 같이 보는 것' 하나만 더해 준다.

   동작 방식
   - 기록은 언제나 이 브라우저(localStorage)가 먼저다. 인터넷이 끊겨도 쓴다.
   - 바뀐 것이 있으면 잠시 뒤 클라우드로 올린다.
   - 앱을 열면 클라우드 것을 받아 와 지금 것과 '합친다'.

   합치는 규칙 — 지우는 것보다 남기는 쪽을 택한다
   - 푼 기록 · 세션 · 일정 · 계획 · 문제 · 자료: 양쪽을 합집합으로 모은다.
   - 같은 항목이 양쪽에 있으면 나중에 저장된 쪽을 쓴다.
   - 그래서 한쪽에서 지운 것이 다른 기기에서 되살아날 수 있다.
     그럴 때를 위해 [이 기기 것으로 덮어쓰기] 를 따로 뒀다.
   ============================================================ */

var Sync = (function () {

  var SDK = "https://www.gstatic.com/firebasejs/10.12.2/";

  var app = null, auth = null, db = null;
  var user = null;
  var ready = false;           // SDK 와 설정이 준비됐는지
  var pushTimer = null;
  var listeners = [];
  var lastError = "";
  var busy = false;

  /* ---------- 설정 (사용자가 Firebase 콘솔에서 받아 붙여넣는 값) ---------- */

  function config() {
    var c = Store.getSettings().firebase;
    return (c && c.apiKey && c.projectId) ? c : null;
  }

  function saveConfig(obj) { Store.setSetting("firebase", obj); }

  function clearConfig() { Store.setSetting("firebase", null); }

  /* 붙여넣은 값에서 설정만 뽑아낸다.
     콘솔이 주는 "const firebaseConfig = { ... };" 를 통째로 붙여도 되게 한다. */
  function parseConfig(text) {
    text = String(text || "").trim();
    if (!text) return { error: "설정을 붙여넣어 주세요." };

    var body = text;
    var brace = text.indexOf("{");
    var close = text.lastIndexOf("}");
    if (brace >= 0 && close > brace) body = text.slice(brace, close + 1);

    var obj = null;
    try {
      obj = JSON.parse(body);
    } catch (e) {
      /* 키에 따옴표가 없는 자바스크립트 객체 형태 — 따옴표를 채워 다시 시도 */
      try {
        var fixed = body
          .replace(/([{,]\s*)([A-Za-z_$][\w$]*)\s*:/g, '$1"$2":')
          .replace(/'/g, '"')
          .replace(/,(\s*[}\]])/g, "$1");
        obj = JSON.parse(fixed);
      } catch (e2) {
        return { error: "설정을 읽지 못했습니다. 콘솔에서 복사한 내용을 그대로 붙여넣어 주세요." };
      }
    }

    if (!obj || !obj.apiKey) return { error: "apiKey 가 없습니다. firebaseConfig 전체를 붙여넣어 주세요." };
    if (!obj.projectId) return { error: "projectId 가 없습니다." };

    return {
      config: {
        apiKey: obj.apiKey,
        authDomain: obj.authDomain || (obj.projectId + ".firebaseapp.com"),
        projectId: obj.projectId,
        storageBucket: obj.storageBucket || "",
        messagingSenderId: obj.messagingSenderId || "",
        appId: obj.appId || ""
      }
    };
  }

  /* ---------- SDK 불러오기 ---------- */

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error("Firebase 를 불러오지 못했습니다. 인터넷 연결을 확인하세요.")); };
      document.head.appendChild(s);
    });
  }

  function init() {
    var c = config();
    if (!c) return Promise.reject(new Error("먼저 Firebase 설정을 넣어 주세요."));
    if (ready) return Promise.resolve();

    return loadScript(SDK + "firebase-app-compat.js")
      .then(function () { return loadScript(SDK + "firebase-auth-compat.js"); })
      .then(function () { return loadScript(SDK + "firebase-firestore-compat.js"); })
      .then(function () {
        if (!firebase.apps.length) app = firebase.initializeApp(c);
        else app = firebase.app();
        auth = firebase.auth();
        db = firebase.firestore();
        ready = true;

        auth.onAuthStateChanged(function (u) {
          user = u || null;
          if (user) pull().catch(function (e) { lastError = e.message; emit(); });
          emit();
        });
      });
  }

  /* ---------- 로그인 ---------- */

  function signIn() {
    return init().then(function () {
      var provider = new firebase.auth.GoogleAuthProvider();
      return auth.signInWithPopup(provider);
    }).then(function (res) {
      user = res.user;
      lastError = "";
      emit();
      return firstSync();
    }).catch(function (e) {
      lastError = friendly(e);
      emit();
      throw new Error(lastError);
    });
  }

  function signOut() {
    if (!auth) return Promise.resolve();
    return auth.signOut().then(function () {
      user = null;
      emit();
    });
  }

  function currentUser() { return user; }
  function isReady() { return ready; }
  function error() { return lastError; }
  function isBusy() { return busy; }

  function friendly(e) {
    var code = (e && e.code) || "";
    if (code.indexOf("popup-closed") >= 0) return "로그인 창을 닫았습니다.";
    if (code.indexOf("popup-blocked") >= 0) return "팝업이 막혔습니다. 브라우저에서 팝업을 허용해 주세요.";
    if (code.indexOf("unauthorized-domain") >= 0)
      return "이 주소가 Firebase 에 등록되어 있지 않습니다. Authentication → Settings → 승인된 도메인에 " +
             location.hostname + " 을 추가하세요.";
    if (code.indexOf("operation-not-allowed") >= 0)
      return "구글 로그인이 켜져 있지 않습니다. Authentication → Sign-in method 에서 Google 을 켜 주세요.";
    if (code.indexOf("permission-denied") >= 0)
      return "Firestore 규칙이 막고 있습니다. 아래 규칙을 그대로 넣어 주세요.";
    return (e && e.message) || "알 수 없는 오류";
  }

  /* ---------- 상태 알림 ---------- */

  function onChange(fn) { listeners.push(fn); }
  function emit() { listeners.forEach(function (f) { try { f(); } catch (e) { /* 무시 */ } }); }

  /* ---------- 마지막 동기화 시각 ---------- */

  function meta() {
    var m = Store.getSettings().syncMeta;
    return (m && typeof m === "object") ? m : { at: 0 };
  }
  function setMeta(m) { Store.setSetting("syncMeta", m); }
  function lastSyncedAt() { return meta().at || 0; }

  /* ---------- 올리기 · 내려받기 ---------- */

  function docRef() {
    if (!db || !user) return null;
    return db.collection("users").doc(user.uid);
  }

  function push() {
    var ref = docRef();
    if (!ref) return Promise.resolve(false);
    busy = true; emit();

    var snap = Store.exportAll();
    delete snap.settings.firebase;     // 설정 자체는 기기마다 다르므로 올리지 않는다
    delete snap.settings.syncMeta;

    var now = Date.now();
    return ref.set({ data: snap, updatedAt: now }).then(function () {
      setMeta({ at: now });
      lastError = "";
      busy = false; emit();
      return true;
    }).catch(function (e) {
      lastError = friendly(e);
      busy = false; emit();
      throw new Error(lastError);
    });
  }

  function pull() {
    var ref = docRef();
    if (!ref) return Promise.resolve(false);
    busy = true; emit();

    return ref.get().then(function (doc) {
      if (!doc.exists) { busy = false; emit(); return push(); }

      var cloud = doc.data();
      var merged = merge(Store.exportAll(), cloud.data || {}, cloud.updatedAt || 0);
      applySnapshot(merged);

      setMeta({ at: Date.now() });
      lastError = "";
      busy = false; emit();
      return true;
    }).catch(function (e) {
      lastError = friendly(e);
      busy = false; emit();
      throw new Error(lastError);
    });
  }

  /* 처음 로그인했을 때 — 받아서 합치고 다시 올린다 */
  function firstSync() {
    return pull().then(function () { return push(); });
  }

  /* 한쪽으로 밀어붙이기 — 합치기로 안 되는 상황의 탈출구 */
  function forcePush() {
    var ref = docRef();
    if (!ref) return Promise.reject(new Error("로그인이 필요합니다"));
    busy = true; emit();
    var snap = Store.exportAll();
    delete snap.settings.firebase;
    delete snap.settings.syncMeta;
    var now = Date.now();
    return ref.set({ data: snap, updatedAt: now }).then(function () {
      setMeta({ at: now }); busy = false; emit(); return true;
    }).catch(function (e) { lastError = friendly(e); busy = false; emit(); throw e; });
  }

  function forcePull() {
    var ref = docRef();
    if (!ref) return Promise.reject(new Error("로그인이 필요합니다"));
    busy = true; emit();
    return ref.get().then(function (doc) {
      if (!doc.exists) { busy = false; emit(); throw new Error("클라우드에 저장된 기록이 없습니다"); }
      applySnapshot(doc.data().data || {});
      setMeta({ at: Date.now() });
      busy = false; emit();
      return true;
    }).catch(function (e) { lastError = friendly(e); busy = false; emit(); throw e; });
  }

  /* 설정(Firebase 접속 정보)은 덮어쓰지 않는다 */
  function applySnapshot(snap) {
    var keepFb = Store.getSettings().firebase;
    var keepMeta = Store.getSettings().syncMeta;
    Store.importAll(snap);
    if (keepFb) Store.setSetting("firebase", keepFb);
    if (keepMeta) Store.setSetting("syncMeta", keepMeta);
  }

  /* ---------- 합치기 ---------- */

  function byId(arr) {
    var m = {};
    (arr || []).forEach(function (x) { if (x && x.id) m[x.id] = x; });
    return m;
  }

  function mergeById(localArr, cloudArr, cloudNewer) {
    var a = byId(localArr), b = byId(cloudArr);
    var out = [], seen = {};
    Object.keys(a).forEach(function (id) {
      out.push(b[id] && cloudNewer ? b[id] : a[id]);
      seen[id] = true;
    });
    Object.keys(b).forEach(function (id) { if (!seen[id]) out.push(b[id]); });
    return out;
  }

  function merge(local, cloud, cloudUpdatedAt) {
    var cloudNewer = (cloudUpdatedAt || 0) > lastSyncedAt();
    var out = {};

    /* 푼 기록 — 같은 문제를 같은 시각에 푼 건 하나로 본다 */
    var seenAt = {}, attempts = [];
    (local.attempts || []).concat(cloud.attempts || []).forEach(function (a) {
      if (!a) return;
      var k = a.qid + "|" + a.ts;
      if (seenAt[k]) return;
      seenAt[k] = true;
      attempts.push(a);
    });
    attempts.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
    out.attempts = attempts.slice(-5000);

    /* id 가 있는 것들 */
    out.schedule = mergeById(local.schedule, cloud.schedule, cloudNewer);
    out.custom   = mergeById(local.custom,   cloud.custom,   cloudNewer);
    out.plans    = mergeById(local.plans,    cloud.plans,    cloudNewer);
    out.subjects = mergeById(local.subjects, cloud.subjects, cloudNewer);
    out.sessions = mergeById(local.sessions, cloud.sessions, cloudNewer).slice(-200);

    /* 오답 — 많이 틀린 쪽과 최근 기록을 살린다 */
    out.wrong = {};
    var lw = local.wrong || {}, cw = cloud.wrong || {};
    Object.keys(lw).concat(Object.keys(cw)).forEach(function (id) {
      if (out.wrong[id]) return;
      var a = lw[id], b = cw[id];
      if (!a) { out.wrong[id] = b; return; }
      if (!b) { out.wrong[id] = a; return; }
      var newer = (b.lastTs || 0) > (a.lastTs || 0) ? b : a;
      out.wrong[id] = {
        count: Math.max(a.count || 0, b.count || 0),
        lastTs: Math.max(a.lastTs || 0, b.lastTs || 0),
        lastRightTs: Math.max(a.lastRightTs || 0, b.lastRightTs || 0),
        rightStreak: newer.rightStreak || 0,
        cleared: newer.cleared || false,
        memo: (a.memo && b.memo) ? newer.memo : (a.memo || b.memo || "")
      };
    });

    /* 진도 — 어느 기기에서든 체크했으면 체크로 본다 */
    out.progress = {};
    var lp = local.progress || {}, cp = cloud.progress || {};
    Object.keys(lp).concat(Object.keys(cp)).forEach(function (k) {
      out.progress[k] = Math.max(lp[k] || 0, cp[k] || 0);
    });

    /* 덧붙인 단원 */
    out.units = {};
    var lu = local.units || {}, cu = cloud.units || {};
    Object.keys(lu).concat(Object.keys(cu)).forEach(function (s) {
      if (out.units[s]) return;
      var set = {}, list = [];
      (lu[s] || []).concat(cu[s] || []).forEach(function (u) {
        if (!set[u]) { set[u] = true; list.push(u); }
      });
      out.units[s] = list;
    });

    /* 단원 자료 */
    out.materials = {};
    var lm = local.materials || {}, cm = cloud.materials || {};
    Object.keys(lm).concat(Object.keys(cm)).forEach(function (k) {
      if (out.materials[k]) return;
      out.materials[k] = mergeById(lm[k], cm[k], cloudNewer);
    });

    /* 숨긴 항목 */
    var lh = local.hidden || { subjects: [], units: {} };
    var ch = cloud.hidden || { subjects: [], units: {} };
    var hs = {}, subs = [];
    (lh.subjects || []).concat(ch.subjects || []).forEach(function (n) {
      if (!hs[n]) { hs[n] = true; subs.push(n); }
    });
    var hu = {};
    Object.keys(lh.units || {}).concat(Object.keys(ch.units || {})).forEach(function (s) {
      if (hu[s]) return;
      var set = {}, list = [];
      ((lh.units || {})[s] || []).concat((ch.units || {})[s] || []).forEach(function (u) {
        if (!set[u]) { set[u] = true; list.push(u); }
      });
      hu[s] = list;
    });
    out.hidden = { subjects: subs, units: hu };

    /* 설정 — 나중 것을 쓰되 접속 정보는 건드리지 않는다 */
    out.settings = cloudNewer
      ? Object.assign({}, local.settings, cloud.settings)
      : Object.assign({}, cloud.settings, local.settings);

    return out;
  }

  /* ---------- 자동 올리기 ----------
     저장할 때마다 바로 올리면 요청이 너무 잦다. 잠깐 모았다가 한 번에 올린다. */

  function onLocalChange() {
    if (!user || !ready) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(function () {
      push().catch(function () { /* 실패해도 다음 기회에 다시 올린다 */ });
    }, 2500);
  }

  /* 앱을 켤 때 — 설정이 있고 이미 로그인돼 있으면 조용히 이어 간다 */
  function boot() {
    if (!config()) return;
    init().catch(function (e) { lastError = e.message; emit(); });
  }

  return {
    parseConfig: parseConfig, saveConfig: saveConfig, clearConfig: clearConfig, config: config,
    init: init, boot: boot,
    signIn: signIn, signOut: signOut, currentUser: currentUser,
    isReady: isReady, isBusy: isBusy, error: error,
    push: push, pull: pull, forcePush: forcePush, forcePull: forcePull,
    lastSyncedAt: lastSyncedAt,
    onChange: onChange, onLocalChange: onLocalChange,

    /* 합치기 규칙은 기록이 사라질 수 있는 곳이라 따로 확인할 수 있게 열어 둔다 */
    merge: merge
  };
})();
