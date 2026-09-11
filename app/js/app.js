/* ============================================================
   App — 라우터, 공통 유틸, 통계 계산
   ============================================================ */

var App = (function () {

  var views = {};          // 화면 등록소
  var current = null;      // 현재 라우트 이름
  var params = {};         // 현재 라우트 파라미터

  /* ---------- 라벨 ---------- */

  var TYPE_LABEL = {
    mcq:   "4지선다",
    ox:    "OX",
    flash: "플래시카드",
    short: "단답",
    essay: "서술형"
  };
  var TYPE_ORDER = ["mcq", "ox", "flash", "short", "essay"];

  var DIFF_LABEL = { 1: "하", 2: "중", 3: "상" };

  var KIND_LABEL = {
    exam:       "시험",
    assignment: "과제",
    activity:   "대외활동",
    etc:        "기타"
  };
  var KIND_ORDER = ["exam", "assignment", "activity", "etc"];

  /* ---------- 문자열 · DOM ---------- */

  function esc(s) {
    return String(s === undefined || s === null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /* 이벤트 위임.
     화면은 같은 컨테이너에 몇 번이고 다시 그려지기 때문에, 그때마다
     addEventListener 를 부르면 핸들러가 쌓여 한 번의 클릭이 여러 번
     처리된다. 그래서 (이벤트 종류 + 선택자) 하나당 핸들러 하나만
     남기고 새로 등록될 때 교체한다. */
  function delegate(root, type, selector, handler) {
    if (!root.__deleg) root.__deleg = {};
    if (!root.__deleg[type]) {
      root.__deleg[type] = {};
      root.addEventListener(type, function (ev) {
        var map = root.__deleg[type];
        for (var sel in map) {
          if (!map.hasOwnProperty(sel)) continue;
          var t = ev.target.closest(sel);
          if (t && root.contains(t)) map[sel](ev, t);
        }
      });
    }
    root.__deleg[type][selector] = handler;
  }

  function on(root, selector, handler)        { delegate(root, "click", selector, handler); }
  function onChange(root, selector, handler)  { delegate(root, "change", selector, handler); }
  function onBlur(root, selector, handler)    { delegate(root, "focusout", selector, handler); }

  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.hidden = true; }, 2200);
  }

  /* ---------- 날짜 ---------- */

  function todayStr() {
    var d = new Date();
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  /* 오늘 기준 남은 일수. 오늘이면 0, 지났으면 음수 */
  function daysUntil(dateStr) {
    if (!dateStr) return null;
    var a = new Date(todayStr() + "T00:00:00");
    var b = new Date(dateStr + "T00:00:00");
    if (isNaN(b.getTime())) return null;
    return Math.round((b - a) / 86400000);
  }

  function ddayText(dateStr) {
    var n = daysUntil(dateStr);
    if (n === null) return "";
    if (n === 0) return "D-DAY";
    return n > 0 ? "D-" + n : "D+" + (-n);
  }

  function ddayClass(dateStr) {
    var n = daysUntil(dateStr);
    if (n === null) return "";
    if (n < 0) return "muted";
    if (n <= 3) return "dday-soon";
    if (n <= 7) return "dday-near";
    return "";
  }

  function fmtDate(dateStr) {
    if (!dateStr) return "";
    var p = dateStr.split("-");
    if (p.length !== 3) return dateStr;
    var wd = ["일", "월", "화", "수", "목", "금", "토"][new Date(dateStr + "T00:00:00").getDay()];
    return Number(p[1]) + "월 " + Number(p[2]) + "일 (" + wd + ")";
  }

  /* ---------- 기간 일정 ----------
     일정은 date(시작일) 하나만 있을 수도 있고, endDate(마감일)까지 있을 수도 있다.
     과제나 대외활동처럼 며칠에 걸친 일을 위해서다. */

  function startOf(s) { return s.date || null; }
  function endOf(s)   { return s.endDate || s.date || null; }
  function isRange(s) { return !!(s.endDate && s.endDate !== s.date); }

  /* 그 날짜가 일정 기간 안에 들어가는지 */
  function covers(s, dateStr) {
    var a = startOf(s), b = endOf(s);
    if (!a) return false;
    return dateStr >= a && dateStr <= b;
  }

  /* 시작했고 아직 마감이 지나지 않은 상태 */
  function isOngoing(s) { return covers(s, todayStr()); }

  /* 목록·홈에서 쓰는 상태 배지. 마감일을 기준으로 본다. */
  function scheduleBadge(s) {
    if (s.done) return { text: "완료", cls: "badge-ok" };

    var a = startOf(s), b = endOf(s);
    if (!a) return { text: "날짜 없음", cls: "" };

    var toEnd = daysUntil(b);
    if (toEnd < 0) return { text: (-toEnd) + "일 지남", cls: "badge-bad" };

    var toStart = daysUntil(a);
    if (toStart > 0) {                       // 아직 시작 전
      return {
        text: isRange(s) ? "시작 D-" + toStart : ddayText(a),
        cls: toStart <= 3 ? "badge-warn" : "badge-acc"
      };
    }

    /* 진행 중 (기간 일정) 또는 당일 */
    if (isRange(s)) {
      return {
        text: toEnd === 0 ? "오늘 마감" : "마감 D-" + toEnd,
        cls: toEnd <= 2 ? "badge-bad" : "badge-warn"
      };
    }
    return { text: "오늘", cls: "badge-warn" };
  }

  /* "9월 8일 (화) ~ 9월 14일 (월)" 처럼 */
  function fmtRange(s) {
    var a = startOf(s), b = endOf(s);
    if (!a) return "";
    if (!isRange(s)) return fmtDate(a) + (s.time ? " " + s.time : "");
    return fmtDate(a) + " ~ " + fmtDate(b) + (s.time ? " " + s.time + " 마감" : "");
  }

  function dayKey(ts) {
    var d = new Date(ts);
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  /* ---------- 배열 ---------- */

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pct(n, d) { return d > 0 ? Math.round((n / d) * 100) : 0; }

  /* ---------- 통계 ---------- */

  /* 단원별 집계: [{subject, unit, total, wrong, rate}] */
  function unitStats() {
    var map = {};
    Store.getAttempts().forEach(function (a) {
      if (a.type === "flash") return;          // 플래시카드는 정답률 집계에서 제외
      var k = a.subject + "::" + a.unit;
      if (!map[k]) map[k] = { subject: a.subject, unit: a.unit, total: 0, wrong: 0 };
      map[k].total++;
      if (!a.correct) map[k].wrong++;
    });
    return Object.keys(map).map(function (k) {
      var e = map[k];
      e.rate = pct(e.total - e.wrong, e.total);   // 정답률
      e.wrongRate = 100 - e.rate;
      return e;
    });
  }

  /* 임의 필드 기준 집계 */
  function groupStats(field) {
    var map = {};
    Store.getAttempts().forEach(function (a) {
      if (a.type === "flash") return;
      var k = a[field];
      if (!map[k]) map[k] = { key: k, total: 0, wrong: 0 };
      map[k].total++;
      if (!a.correct) map[k].wrong++;
    });
    return Object.keys(map).map(function (k) {
      var e = map[k];
      e.rate = pct(e.total - e.wrong, e.total);
      return e;
    });
  }

  /* 약점 단원 랭킹.
     minTotal 번 이상 푼 단원 중 오답률이 높은 순.
     같은 오답률이면 많이 푼 쪽(표본이 큰 쪽)을 위로 올린다. */
  function weakUnits(minTotal) {
    minTotal = minTotal || 3;
    return unitStats()
      .filter(function (e) { return e.total >= minTotal && e.wrongRate > 0; })
      .sort(function (a, b) {
        if (b.wrongRate !== a.wrongRate) return b.wrongRate - a.wrongRate;
        return b.total - a.total;
      });
  }

  function overall() {
    var at = Store.getAttempts().filter(function (a) { return a.type !== "flash"; });
    var right = at.filter(function (a) { return a.correct; }).length;
    return { total: at.length, right: right, rate: pct(right, at.length) };
  }

  /* 최근 n일 일별 풀이량 */
  function dailySeries(n) {
    n = n || 14;
    var counts = {};
    Store.getAttempts().forEach(function (a) {
      var k = dayKey(a.ts);
      counts[k] = (counts[k] || 0) + 1;
    });
    var out = [];
    var base = new Date(todayStr() + "T00:00:00");
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(base.getTime() - i * 86400000);
      var k = dayKey(d.getTime());
      out.push({ date: k, day: d.getDate(), count: counts[k] || 0 });
    }
    return out;
  }

  /* ---------- 라우터 ---------- */

  function register(name, def) { views[name] = def; }

  function parseHash() {
    var h = location.hash.replace(/^#\/?/, "");
    var qi = h.indexOf("?");
    var name = (qi >= 0 ? h.slice(0, qi) : h) || "home";
    var p = {};
    if (qi >= 0) {
      h.slice(qi + 1).split("&").forEach(function (kv) {
        if (!kv) return;
        var i = kv.indexOf("=");
        var k = i >= 0 ? kv.slice(0, i) : kv;
        var v = i >= 0 ? kv.slice(i + 1) : "";
        p[decodeURIComponent(k)] = decodeURIComponent(v);
      });
    }
    return { name: name, params: p };
  }

  function go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  }

  function render() {
    var r = parseHash();
    current = views[r.name] ? r.name : "home";
    params = r.params;

    $$("#nav a").forEach(function (a) {
      a.classList.toggle("active", a.getAttribute("data-route") === current);
    });

    /* 화면을 바꿀 때는 컨테이너를 통째로 새 노드로 갈아 끼운다.
       이전 화면이 걸어 둔 이벤트 핸들러가 남아 있지 않게 하기 위해서다. */
    var old = document.getElementById("view");
    var mount = old.cloneNode(false);
    old.parentNode.replaceChild(mount, old);
    window.scrollTo(0, 0);

    try {
      views[current].render(mount, params);
    } catch (e) {
      console.error(e);
      mount.innerHTML =
        '<div class="card"><h1 class="mt-0">화면을 그리다 오류가 났습니다</h1>' +
        '<pre class="mono">' + esc(e && e.stack ? e.stack : e) + '</pre></div>';
    }

    refreshChrome();
  }

  /* 사이드바 배지 · 부제 갱신 */
  function refreshChrome() {
    var n = Store.openWrongCount();
    document.getElementById("badgeWrong").textContent = n > 0 ? n : "";

    var next = Store.getSchedule().filter(function (s) {
      return s.kind === "exam" && !s.done && daysUntil(s.date) !== null && daysUntil(s.date) >= 0;
    })[0];

    document.getElementById("brandSub").textContent =
      next ? (next.title + " " + ddayText(next.date)) : "시험 일정 미등록";
  }

  /* ---------- 테마 ---------- */

  function applyTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    Store.setSetting("theme", t);
  }

  function toggleTheme() {
    var now = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
    applyTheme(now);
  }

  /* ---------- 시작 ---------- */

  function start() {
    applyTheme(Store.getSettings().theme || "light");
    document.getElementById("themeBtn").addEventListener("click", toggleTheme);
    window.addEventListener("hashchange", render);
    if (!location.hash) location.hash = "#/home";
    render();
  }

  return {
    register: register, start: start, go: go, render: render,
    refreshChrome: refreshChrome,

    esc: esc, $: $, $$: $$, on: on, onChange: onChange, onBlur: onBlur, toast: toast,

    TYPE_LABEL: TYPE_LABEL, TYPE_ORDER: TYPE_ORDER,
    DIFF_LABEL: DIFF_LABEL,
    KIND_LABEL: KIND_LABEL, KIND_ORDER: KIND_ORDER,

    todayStr: todayStr, daysUntil: daysUntil, ddayText: ddayText,
    ddayClass: ddayClass, fmtDate: fmtDate, dayKey: dayKey,

    startOf: startOf, endOf: endOf, isRange: isRange, covers: covers,
    isOngoing: isOngoing, scheduleBadge: scheduleBadge, fmtRange: fmtRange,

    shuffle: shuffle, pct: pct,

    unitStats: unitStats, groupStats: groupStats, weakUnits: weakUnits,
    overall: overall, dailySeries: dailySeries
  };
})();
