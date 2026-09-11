/* ============================================================
   Store — 브라우저 localStorage 저장소
   ------------------------------------------------------------
   기록은 전부 이 브라우저 안에만 저장됩니다.
   다른 기기로 옮기려면 [백업 · 초기화] 화면에서 내보내기 하세요.
   ============================================================ */

var Store = (function () {

  var PREFIX = "examhub.v1.";

  /* 기본값 */
  var DEFAULTS = {
    attempts: [],   // 푼 기록   {qid, subject, unit, type, diff, correct, ts}
    wrong:    {},   // 오답노트  {qid: {count, lastTs, memo, cleared}}
    schedule: [],   // 일정      {id, title, kind, date, time, subject, memo, done}
    progress: {},   // 진도      {"과목::단원": true}
    custom:   [],   // 직접 추가한 문제
    subjects: [],   // 직접 추가한 과목  [{name, units:[]}]
    units:    {},   // 기존 과목에 덧붙인 단원  {과목명: [단원명, ...]}
    plans:    [],   // 공부 계획 {id, subject, title, done, ts}
    sessions: [],   // 문제 풀기 기록 {id, ts, title, desc, qids, total, right}
    materials: {},  // 단원 자료 {"과목::단원": [{id, label, path}]}
    hidden:   { subjects: [], units: {} },   // 목록에서 치운 과목 · 단원
    settings: { theme: "light" }
  };

  var KEYS = ["attempts", "wrong", "schedule", "progress", "custom",
              "subjects", "units", "plans", "sessions", "materials",
              "hidden", "settings"];

  function read(key) {
    try {
      var raw = localStorage.getItem(PREFIX + key);
      if (raw === null) return clone(DEFAULTS[key]);
      return JSON.parse(raw);
    } catch (e) {
      console.warn("저장소 읽기 실패:", key, e);
      return clone(DEFAULTS[key]);
    }
  }

  /* 저장이 실패하면 조용히 넘어가면 안 된다.
     이 앱은 쌓인 기록이 전부인데, 사용자는 저장된 줄 알고 계속 쓰게 된다.
     저장 공간이 꽉 찼거나 시크릿 모드일 때 실제로 일어난다. */
  function write(key, value) {
    try {
      localStorage.setItem(PREFIX + key, JSON.stringify(value));
      /* 로그인해 두었으면 잠시 뒤 클라우드로 올린다.
         settings 는 접속 정보·동기화 시각이 들어 있어 되돌이가 생기므로 뺀다. */
      if (key !== "settings" && typeof Sync !== "undefined" && Sync.onLocalChange) {
        Sync.onLocalChange();
      }
      return true;
    } catch (e) {
      console.warn("저장소 쓰기 실패:", key, e);

      var full = e && (e.name === "QuotaExceededError" ||
                       e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
                       e.code === 22 || e.code === 1014);

      if (typeof App !== "undefined" && App.toast) {
        App.toast(full
          ? "저장 공간이 꽉 찼습니다 — 방금 것이 저장되지 않았습니다. [백업 · 초기화]에서 정리하세요."
          : "저장에 실패했습니다 — 방금 것이 남지 않습니다. 시크릿 모드인지 확인해 보세요.");
      }
      return false;
    }
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  /* ---------- 과목 · 단원 (data/curriculum.js + 화면에서 추가한 것) ----------
     화면에서 과목이나 단원을 추가하면 여기서 합쳐져서 사이트 전체에 반영된다.
     base 는 파일에 적힌 것, extra 는 사용자가 추가한 것 (지울 수 있음). */

  function getHidden() {
    var h = read("hidden");
    if (!h || typeof h !== "object") h = { subjects: [], units: {} };
    if (!Array.isArray(h.subjects)) h.subjects = [];
    if (!h.units || typeof h.units !== "object") h.units = {};
    return h;
  }

  /* includeHidden 을 주면 치워 둔 것까지 전부 돌려준다 (오타 검사용) */
  function curriculum(includeHidden) {
    var base = (typeof CURRICULUM !== "undefined") ? clone(CURRICULUM) : [];
    var extraUnits = read("units");
    var extraSubjects = read("subjects");
    var hid = getHidden();

    base.forEach(function (c) {
      c.custom = false;
      c.baseUnits = c.units.slice();
      (extraUnits[c.name] || []).forEach(function (u) {
        if (c.units.indexOf(u) < 0) c.units.push(u);
      });
    });

    var names = {};
    base.forEach(function (c) { names[c.name] = true; });

    extraSubjects.forEach(function (s) {
      if (names[s.name]) return;                 // 이름이 겹치면 무시
      var units = (s.units || []).slice();
      (extraUnits[s.name] || []).forEach(function (u) {
        if (units.indexOf(u) < 0) units.push(u);
      });
      base.push({ id: s.id || s.name, name: s.name, units: units, custom: true, baseUnits: [] });
      names[s.name] = true;
    });

    if (includeHidden) return base;

    /* 치워 둔 과목 · 단원은 목록에서 뺀다 */
    return base
      .filter(function (c) { return hid.subjects.indexOf(c.name) < 0; })
      .map(function (c) {
        var hu = hid.units[c.name] || [];
        c.units = c.units.filter(function (u) { return hu.indexOf(u) < 0; });
        return c;
      });
  }

  /* ---------- 과목 · 단원 치우기 ----------
     data/curriculum.js 에 적힌 기본 항목은 파일을 고치지 않는 한 지울 수 없다.
     그래서 '숨김' 목록에 넣어 화면에서만 빼고, 언제든 되돌릴 수 있게 한다.
     화면에서 직접 추가한 것은 진짜로 지운다. */

  function hideSubject(name) {
    var h = getHidden();
    if (h.subjects.indexOf(name) < 0) h.subjects.push(name);
    write("hidden", h);
  }

  function unhideSubject(name) {
    var h = getHidden();
    h.subjects = h.subjects.filter(function (x) { return x !== name; });
    write("hidden", h);
  }

  function hideUnit(subject, unit) {
    var h = getHidden();
    if (!h.units[subject]) h.units[subject] = [];
    if (h.units[subject].indexOf(unit) < 0) h.units[subject].push(unit);
    write("hidden", h);
  }

  function unhideUnit(subject, unit) {
    var h = getHidden();
    if (!h.units[subject]) return;
    h.units[subject] = h.units[subject].filter(function (x) { return x !== unit; });
    if (!h.units[subject].length) delete h.units[subject];
    write("hidden", h);
  }

  /* 숨긴 항목 목록 — 되돌리기 화면에 쓴다 */
  function hiddenList() {
    var h = getHidden();
    var out = { subjects: h.subjects.slice(), units: [] };
    Object.keys(h.units).forEach(function (s) {
      (h.units[s] || []).forEach(function (u) { out.units.push({ subject: s, unit: u }); });
    });
    return out;
  }

  function hiddenCount() {
    var l = hiddenList();
    return l.subjects.length + l.units.length;
  }

  /* 과목을 목록에서 없앤다 — 직접 추가한 것이면 삭제, 기본 과목이면 숨김 */
  function removeSubjectAny(name) {
    var extra = read("subjects");
    var isCustom = extra.some(function (s) { return s.name === name; });
    if (isCustom) {
      write("subjects", extra.filter(function (s) { return s.name !== name; }));
      var u = read("units"); delete u[name]; write("units", u);
    } else {
      hideSubject(name);
    }
    return isCustom ? "deleted" : "hidden";
  }

  /* 단원도 마찬가지 */
  function removeUnitAny(subject, unit) {
    if (isCustomUnit(subject, unit)) {
      removeUnit(subject, unit);
      return "deleted";
    }
    hideUnit(subject, unit);
    return "hidden";
  }

  /* 그 과목에 딸린 내 기록을 함께 지운다 (선택 사항) */
  function purgeSubjectData(name) {
    var removed = { attempts: 0, wrong: 0, plans: 0, custom: 0, progress: 0, materials: 0 };

    var at = read("attempts");
    var keptAt = at.filter(function (a) { return a.subject !== name; });
    removed.attempts = at.length - keptAt.length;
    write("attempts", keptAt);

    var w = read("wrong");
    Object.keys(w).forEach(function (id) {
      var q = questionById(id);
      if (q && q.subject === name) { delete w[id]; removed.wrong++; }
    });
    write("wrong", w);

    var pl = read("plans");
    var keptPl = pl.filter(function (p) { return p.subject !== name; });
    removed.plans = pl.length - keptPl.length;
    write("plans", keptPl);

    var cu = read("custom");
    var keptCu = cu.filter(function (q) { return q.subject !== name; });
    removed.custom = cu.length - keptCu.length;
    write("custom", keptCu);

    var pr = read("progress");
    Object.keys(pr).forEach(function (k) {
      if (k.indexOf(name + "::") === 0) { delete pr[k]; removed.progress++; }
    });
    write("progress", pr);

    var ma = read("materials");
    Object.keys(ma).forEach(function (k) {
      if (k.indexOf(name + "::") === 0) { removed.materials += ma[k].length; delete ma[k]; }
    });
    write("materials", ma);

    return removed;
  }

  /* 지우기 전에 무엇이 딸려 있는지 세어 준다 */
  function subjectDataCount(name) {
    var w = read("wrong");
    var wrongN = 0;
    Object.keys(w).forEach(function (id) {
      var q = questionById(id);
      if (q && q.subject === name) wrongN++;
    });
    var mats = 0;
    var ma = read("materials");
    Object.keys(ma).forEach(function (k) {
      if (k.indexOf(name + "::") === 0) mats += ma[k].length;
    });
    return {
      attempts: read("attempts").filter(function (a) { return a.subject === name; }).length,
      wrong: wrongN,
      plans: read("plans").filter(function (p) { return p.subject === name; }).length,
      custom: read("custom").filter(function (q) { return q.subject === name; }).length,
      progress: Object.keys(read("progress")).filter(function (k) {
        return k.indexOf(name + "::") === 0;
      }).length,
      materials: mats,
      questions: allQuestions().filter(function (q) { return q.subject === name; }).length
    };
  }

  function subjectNames() {
    return curriculum().map(function (c) { return c.name; });
  }

  function findSubject(name) {
    return curriculum().filter(function (c) { return c.name === name; })[0] || null;
  }

  function addSubject(name, units) {
    name = String(name || "").trim();
    if (!name) return "과목 이름을 입력하세요.";
    if (hasKeySeparator(name)) return "과목 이름에 :: 는 쓸 수 없습니다.";
    if (findSubject(name)) return "이미 있는 과목입니다.";
    var list = read("subjects");
    list.push({
      id: "s" + Date.now(),
      name: name,
      units: (units || []).map(function (u) { return String(u).trim(); }).filter(Boolean)
    });
    write("subjects", list);
    return null;
  }

  function removeSubject(name) {
    write("subjects", read("subjects").filter(function (s) { return s.name !== name; }));
    var u = read("units"); delete u[name]; write("units", u);
  }

  function addUnit(subjectName, unitName) {
    unitName = String(unitName || "").trim();
    if (!unitName) return "단원 이름을 입력하세요.";
    if (hasKeySeparator(unitName)) return "단원 이름에 :: 는 쓸 수 없습니다.";
    var c = findSubject(subjectName);
    if (!c) return "과목을 찾을 수 없습니다.";
    if (c.units.indexOf(unitName) >= 0) return "이미 있는 단원입니다.";
    var u = read("units");
    if (!u[subjectName]) u[subjectName] = [];
    u[subjectName].push(unitName);
    write("units", u);
    return null;
  }

  function removeUnit(subjectName, unitName) {
    var u = read("units");
    if (!u[subjectName]) return;
    u[subjectName] = u[subjectName].filter(function (x) { return x !== unitName; });
    write("units", u);
  }

  /* 화면에서 지울 수 있는 단원인지 (파일에 박혀 있는 기본 단원은 못 지움) */
  function isCustomUnit(subjectName, unitName) {
    return (read("units")[subjectName] || []).indexOf(unitName) >= 0;
  }

  /* 문제의 과목/단원이 목록에 없는 경우를 찾아낸다 (오타 잡기용).
     일부러 치워 둔 과목·단원은 오타가 아니므로 제외한다. */
  function orphanQuestions() {
    var valid = {};
    curriculum(true).forEach(function (c) {
      c.units.forEach(function (u) { valid[c.name + "::" + u] = true; });
    });
    return allQuestions().filter(function (q) {
      return !valid[q.subject + "::" + q.unit];
    });
  }

  /* ---------- 문제 은행 (기본 + 직접 추가) ---------- */

  function allQuestions() {
    var base = (typeof QUESTION_BANK !== "undefined") ? QUESTION_BANK : [];
    return base.concat(read("custom"));
  }

  function questionById(qid) {
    var all = allQuestions();
    for (var i = 0; i < all.length; i++) if (all[i].id === qid) return all[i];
    return null;
  }

  /* ---------- 푼 기록 ---------- */

  function addAttempt(q, correct) {
    var attempts = read("attempts");
    attempts.push({
      qid: q.id,
      subject: q.subject,
      unit: q.unit,
      type: q.type,
      diff: q.difficulty,
      correct: !!correct,
      ts: Date.now()
    });
    /* 기록이 무한정 쌓이지 않도록 최근 5000개만 유지 */
    if (attempts.length > 5000) attempts = attempts.slice(-5000);
    write("attempts", attempts);

    if (correct) markRight(q.id); else markWrong(q.id);
  }

  function getAttempts() { return read("attempts"); }

  /* ---------- 오답노트 ---------- */

  function markWrong(qid) {
    var w = read("wrong");
    var e = w[qid] || { count: 0, memo: "", cleared: false };
    e.count += 1;
    e.lastTs = Date.now();
    e.cleared = false;          // 다시 틀리면 '극복' 표시 해제
    w[qid] = e;
    write("wrong", w);
  }

  function markRight(qid) {
    var w = read("wrong");
    if (w[qid]) {
      w[qid].lastRightTs = Date.now();
      w[qid].rightStreak = (w[qid].rightStreak || 0) + 1;
      /* 오답 이후 연속 2회 맞히면 자동으로 극복 처리 */
      if (w[qid].rightStreak >= 2) w[qid].cleared = true;
      write("wrong", w);
    }
  }

  function getWrong() { return read("wrong"); }

  function setWrongMemo(qid, memo) {
    var w = read("wrong");
    if (!w[qid]) w[qid] = { count: 0, cleared: false };
    w[qid].memo = memo;
    write("wrong", w);
  }

  function setWrongCleared(qid, cleared) {
    var w = read("wrong");
    if (!w[qid]) return;
    w[qid].cleared = !!cleared;
    if (!cleared) w[qid].rightStreak = 0;
    write("wrong", w);
  }

  function removeWrong(qid) {
    var w = read("wrong");
    delete w[qid];
    write("wrong", w);
  }

  /* 아직 극복하지 못한 오답 개수 */
  function openWrongCount() {
    var w = read("wrong"), n = 0;
    for (var k in w) if (w.hasOwnProperty(k) && !w[k].cleared) n++;
    return n;
  }

  /* ---------- 일정 ---------- */

  function getSchedule() {
    return read("schedule").sort(function (a, b) {
      var d = (a.date || "9999-99-99").localeCompare(b.date || "9999-99-99");
      if (d !== 0) return d;
      return (a.time || "99:99").localeCompare(b.time || "99:99");
    });
  }

  function saveScheduleItem(item) {
    var list = read("schedule");
    if (item.id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === item.id) { list[i] = item; write("schedule", list); return item; }
      }
    }
    item.id = "s" + Date.now() + Math.floor(Math.random() * 1000);
    list.push(item);
    write("schedule", list);
    return item;
  }

  function deleteScheduleItem(id) {
    write("schedule", read("schedule").filter(function (x) { return x.id !== id; }));
  }

  function toggleScheduleDone(id) {
    var list = read("schedule");
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list[i].done = !list[i].done; break; }
    }
    write("schedule", list);
  }

  /* ---------- 진도 ---------- */

  function progressKey(subject, unit) { return subject + "::" + unit; }

  function getProgress() { return read("progress"); }

  function toggleProgress(subject, unit) {
    var p = read("progress");
    var k = progressKey(subject, unit);
    if (p[k]) delete p[k]; else p[k] = Date.now();
    write("progress", p);
  }

  function isDone(subject, unit) {
    return !!read("progress")[progressKey(subject, unit)];
  }

  /* ---------- 직접 추가한 문제 ---------- */

  function getCustom() { return read("custom"); }

  function saveCustom(q) {
    var list = read("custom");
    if (q.id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id === q.id) { list[i] = q; write("custom", list); return q; }
      }
    }
    q.id = "my-" + Date.now() + "-" + Math.floor(Math.random() * 1000);
    list.push(q);
    write("custom", list);
    return q;
  }

  function deleteCustom(id) {
    write("custom", read("custom").filter(function (x) { return x.id !== id; }));
  }

  function importCustom(arr, mode) {
    var list = (mode === "replace") ? [] : read("custom");
    var existing = {};
    list.forEach(function (q) { existing[q.id] = true; });
    var added = 0;
    arr.forEach(function (q) {
      if (!q || !q.id || existing[q.id]) return;
      list.push(q); existing[q.id] = true; added++;
    });
    write("custom", list);
    return added;
  }

  /* ---------- 공부 계획 (과목별 할 일) ---------- */

  function getPlans(subject) {
    var list = read("plans");
    if (subject) list = list.filter(function (p) { return p.subject === subject; });
    return list.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (a.ts || 0) - (b.ts || 0);
    });
  }

  function addPlan(subject, title) {
    title = String(title || "").trim();
    if (!title) return null;
    var list = read("plans");
    var item = {
      id: "p" + Date.now() + Math.floor(Math.random() * 1000),
      subject: subject, title: title, done: false, ts: Date.now()
    };
    list.push(item);
    write("plans", list);
    return item;
  }

  function togglePlan(id) {
    var list = read("plans");
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) { list[i].done = !list[i].done; break; }
    }
    write("plans", list);
  }

  function deletePlan(id) {
    write("plans", read("plans").filter(function (p) { return p.id !== id; }));
  }

  /* ---------- 단원 자료 (PDF · 필기 · 링크) ----------
     파일 자체는 저장하지 않는다. localStorage 는 5MB 남짓이라 PDF 가 들어가지 않는다.
     대신 '어디에 있는 파일인지' 경로만 기억하고, 누르면 그 파일을 연다. */

  /* 사람이 적어 넣은 경로를 브라우저가 열 수 있는 형태로 바꾼다.
     열어도 되는 스킴만 통과시킨다. javascript: 같은 걸 그대로 링크로 걸면
     누른 순간 코드가 돌아간다 — 남이 보낸 백업 파일을 가져오는 경우가 있어서
     내가 친 값만 믿을 수는 없다. 막히면 "" 를 돌려준다. */
  function normalizePath(p) {
    p = String(p || "").trim().replace(/^["']|["']$/g, "");   // 따옴표 붙여 넣기 대비
    if (!p) return "";

    /* C:\... 는 스킴처럼 보이므로 먼저 걸러낸다 */
    if (/^[a-zA-Z]:[\\/]/.test(p)) return "file:///" + p.replace(/\\/g, "/");
    if (/^\\\\/.test(p)) return "file:" + p.replace(/\\/g, "/");   // 네트워크 경로

    var scheme = p.match(/^([a-zA-Z][a-zA-Z0-9+.\-]*):/);
    if (scheme) {
      var s = scheme[1].toLowerCase();
      if (s === "http" || s === "https" || s === "file") return p;
      return "";                                   // javascript:, data: 등은 거부
    }

    return p.replace(/\\/g, "/");                  // 스킴 없는 상대 경로
  }

  /* 화면에 링크를 걸기 직전에 한 번 더 거른다.
     예전에 저장됐거나 남의 백업에서 들어온 값도 여기서 막힌다. */
  function safeHref(p) {
    return normalizePath(p);
  }

  /* 과목 · 단원 이름은 "과목::단원" 키로 이어 붙여 쓴다.
     이름 안에 :: 가 들어가면 키를 되돌릴 때 엉뚱하게 쪼개진다. */
  function hasKeySeparator(name) {
    return String(name).indexOf("::") >= 0;
  }

  function materialKey(subject, unit) { return subject + "::" + unit; }

  function getMaterials(subject, unit) {
    return read("materials")[materialKey(subject, unit)] || [];
  }

  function addMaterial(subject, unit, label, path) {
    var raw = String(path || "").trim();
    if (!raw) return "파일 경로나 주소를 입력하세요.";
    var href = normalizePath(raw);
    if (!href) return "열 수 없는 주소입니다. 파일 경로나 http 주소를 넣어 주세요.";
    var all = read("materials");
    var k = materialKey(subject, unit);
    if (!all[k]) all[k] = [];
    all[k].push({
      id: "m" + Date.now() + Math.floor(Math.random() * 1000),
      label: String(label || "").trim() || guessName(href),
      path: href
    });
    write("materials", all);
    return null;
  }

  function deleteMaterial(subject, unit, id) {
    var all = read("materials");
    var k = materialKey(subject, unit);
    if (!all[k]) return;
    all[k] = all[k].filter(function (m) { return m.id !== id; });
    if (!all[k].length) delete all[k];
    write("materials", all);
  }

  /* 경로에서 파일 이름만 뽑아 기본 제목으로 쓴다 */
  function guessName(href) {
    try { href = decodeURIComponent(href); } catch (e) { /* 그대로 둔다 */ }
    var last = href.split(/[\\/]/).pop() || href;
    return last.split("?")[0] || "자료";
  }

  /* 단원별 자료 개수 (진도표에 배지로 띄우려고) */
  function materialCount(subject, unit) {
    return getMaterials(subject, unit).length;
  }

  /* ---------- 문제 풀기 기록 ----------
     같은 구성으로 다시 풀 수 있도록 문항 id 목록까지 남긴다. */

  function getSessions() {
    return read("sessions").sort(function (a, b) { return b.ts - a.ts; });
  }

  function addSession(rec) {
    var list = read("sessions");
    rec.id = "q" + Date.now() + Math.floor(Math.random() * 1000);
    rec.ts = Date.now();
    list.push(rec);
    if (list.length > 200) list = list.slice(-200);
    write("sessions", list);
    return rec;
  }

  function deleteSession(id) {
    write("sessions", read("sessions").filter(function (s) { return s.id !== id; }));
  }

  /* ---------- 설정 ---------- */

  function getSettings() { return read("settings"); }
  function setSetting(k, v) {
    var s = read("settings"); s[k] = v; write("settings", s);
  }

  /* ---------- 백업 ---------- */

  function exportAll() {
    var out = {
      _app: "시험기간 화이팅!",
      _version: 2,
      _exportedAt: new Date().toISOString()
    };
    KEYS.forEach(function (k) { out[k] = read(k); });
    return out;
  }

  function importAll(obj) {
    KEYS.forEach(function (k) {
      if (obj[k] !== undefined) write(k, obj[k]);
    });
  }

  function resetAll() {
    KEYS.forEach(function (k) { localStorage.removeItem(PREFIX + k); });
  }

  function resetKey(k) { localStorage.removeItem(PREFIX + k); }

  return {
    curriculum: curriculum,
    subjectNames: subjectNames,
    findSubject: findSubject,
    addSubject: addSubject,
    removeSubject: removeSubject,
    addUnit: addUnit,
    removeUnit: removeUnit,
    isCustomUnit: isCustomUnit,
    orphanQuestions: orphanQuestions,

    removeSubjectAny: removeSubjectAny,
    removeUnitAny: removeUnitAny,
    unhideSubject: unhideSubject,
    unhideUnit: unhideUnit,
    hiddenList: hiddenList,
    hiddenCount: hiddenCount,
    purgeSubjectData: purgeSubjectData,
    subjectDataCount: subjectDataCount,

    getMaterials: getMaterials,
    addMaterial: addMaterial,
    deleteMaterial: deleteMaterial,
    materialCount: materialCount,
    normalizePath: normalizePath,
    safeHref: safeHref,

    getPlans: getPlans,
    addPlan: addPlan,
    togglePlan: togglePlan,
    deletePlan: deletePlan,

    getSessions: getSessions,
    addSession: addSession,
    deleteSession: deleteSession,

    allQuestions: allQuestions,
    questionById: questionById,

    addAttempt: addAttempt,
    getAttempts: getAttempts,

    getWrong: getWrong,
    setWrongMemo: setWrongMemo,
    setWrongCleared: setWrongCleared,
    removeWrong: removeWrong,
    openWrongCount: openWrongCount,

    getSchedule: getSchedule,
    saveScheduleItem: saveScheduleItem,
    deleteScheduleItem: deleteScheduleItem,
    toggleScheduleDone: toggleScheduleDone,

    getProgress: getProgress,
    toggleProgress: toggleProgress,
    isDone: isDone,

    getCustom: getCustom,
    saveCustom: saveCustom,
    deleteCustom: deleteCustom,
    importCustom: importCustom,

    getSettings: getSettings,
    setSetting: setSetting,

    exportAll: exportAll,
    importAll: importAll,
    resetAll: resetAll,
    resetKey: resetKey
  };
})();
