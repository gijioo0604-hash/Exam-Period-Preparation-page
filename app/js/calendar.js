/* ============================================================
   Calendar — 월간 달력 · 주간 띠 달력을 HTML 문자열로 그린다
   일정 데이터(Store.getSchedule())를 그대로 받는다.
   ============================================================ */

var Calendar = (function () {

  var WD = ["일", "월", "화", "수", "목", "금", "토"];

  function ymd(d) {
    return d.getFullYear() + "-" +
           String(d.getMonth() + 1).padStart(2, "0") + "-" +
           String(d.getDate()).padStart(2, "0");
  }

  function parse(s) { return new Date(s + "T00:00:00"); }

  /* 날짜별로 일정을 묶는다.
     마감일이 있는 일정은 시작일부터 마감일까지 모든 날에 들어간다.
     pos 로 그 날이 시작인지 중간인지 끝인지 표시해 띠처럼 보이게 한다. */
  function bucket(items) {
    var by = {};

    items.forEach(function (s) {
      var a = App.startOf(s), b = App.endOf(s);
      if (!a) return;

      if (!App.isRange(s)) {
        (by[a] = by[a] || []).push({ s: s, pos: "only" });
        return;
      }

      var cur = parse(a), end = parse(b);
      if (end < cur) { (by[a] = by[a] || []).push({ s: s, pos: "only" }); return; }

      /* 너무 긴 일정이 달력을 뒤덮지 않도록 상한을 둔다 */
      for (var n = 0; cur <= end && n < 400; n++) {
        var key = ymd(cur);
        (by[key] = by[key] || []).push({
          s: s,
          pos: key === a ? "start" : key === b ? "end" : "mid"
        });
        cur = new Date(cur.getFullYear(), cur.getMonth(), cur.getDate() + 1);
      }
    });

    Object.keys(by).forEach(function (k) {
      by[k].sort(function (x, y) {
        var a = x.s, b = y.s;
        if (a.kind === "exam" && b.kind !== "exam") return -1;   // 시험을 맨 위로
        if (b.kind === "exam" && a.kind !== "exam") return 1;
        /* 여러 날짜에 걸친 일정을 위로 올려야 띠가 끊겨 보이지 않는다 */
        var ar = App.isRange(a) ? 0 : 1, br = App.isRange(b) ? 0 : 1;
        if (ar !== br) return ar - br;
        return (a.time || "99:99").localeCompare(b.time || "99:99");
      });
    });
    return by;
  }

  function pill(e) {
    var s = e.s;
    return '<button class="cal-pill k-' + s.kind + " p-" + e.pos +
           (s.done ? " is-done" : "") +
           '" data-cal-item="' + App.esc(s.id) + '" type="button" title="' +
           App.esc(s.title + " · " + App.fmtRange(s)) + '">' +
           (e.pos === "mid" || e.pos === "end"
             ? '<span class="cal-cont">' + App.esc(s.title) + "</span>"
             : App.esc(s.title)) +
           "</button>";
  }

  /* ---------- 월간 ----------
     year, month(0-11), items, opts { max: 셀당 표시 개수 } */
  function month(year, m, items, opts) {
    opts = opts || {};
    var max = opts.max || 3;
    var by = bucket(items);
    var today = App.todayStr();

    var first = new Date(year, m, 1);
    var start = new Date(year, m, 1 - first.getDay());     // 그 주의 일요일부터
    var last = new Date(year, m + 1, 0);
    var cells = Math.ceil((first.getDay() + last.getDate()) / 7) * 7;

    var html =
      '<div class="cal">' +
        '<div class="cal-head">' +
          '<button class="btn btn-sm btn-ghost" data-cal-nav="-1" type="button">‹</button>' +
          '<strong class="cal-title">' + year + "년 " + (m + 1) + "월</strong>" +
          '<button class="btn btn-sm btn-ghost" data-cal-nav="1" type="button">›</button>' +
          '<button class="btn btn-sm btn-ghost" data-cal-nav="0" type="button">오늘</button>' +
        "</div>" +
        '<div class="cal-grid cal-wd">' +
          WD.map(function (w, i) {
            return '<div class="cal-wd-cell' + (i === 0 ? " sun" : i === 6 ? " sat" : "") + '">' + w + "</div>";
          }).join("") +
        "</div>" +
        '<div class="cal-grid cal-body">';

    for (var i = 0; i < cells; i++) {
      var d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var key = ymd(d);
      var outside = d.getMonth() !== m;
      var list = by[key] || [];
      var dow = d.getDay();

      html += '<div class="cal-cell' + (outside ? " outside" : "") +
                (key === today ? " today" : "") + '" data-cal-date="' + key + '">' +
        '<div class="cal-date' + (dow === 0 ? " sun" : dow === 6 ? " sat" : "") + '">' +
          d.getDate() + "</div>" +
        '<div class="cal-items">' +
          list.slice(0, max).map(pill).join("") +
          (list.length > max
            ? '<span class="cal-more">+' + (list.length - max) + "</span>"
            : "") +
        "</div>" +
      "</div>";
    }

    return html + "</div></div>";
  }

  /* ---------- 주간 띠 ----------
     fromDate(YYYY-MM-DD)부터 days 일. 홈에 얹는 작은 버전. */
  function week(fromDate, items, opts) {
    opts = opts || {};
    var days = opts.days || 7;
    var max = opts.max || 2;
    var by = bucket(items);
    var today = App.todayStr();
    var base = parse(fromDate);

    var html = '<div class="cal-week">';
    for (var i = 0; i < days; i++) {
      var d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i);
      var key = ymd(d);
      var list = by[key] || [];
      var dow = d.getDay();

      html += '<div class="cw-cell' + (key === today ? " today" : "") +
                '" data-cal-date="' + key + '">' +
        '<div class="cw-wd' + (dow === 0 ? " sun" : dow === 6 ? " sat" : "") + '">' +
          WD[dow] + "</div>" +
        '<div class="cw-date">' + d.getDate() + "</div>" +
        '<div class="cw-items">' +
          list.slice(0, max).map(function (e) {
            return '<span class="cw-pill k-' + e.s.kind + " p-" + e.pos +
                   (e.s.done ? " is-done" : "") +
                   '" title="' + App.esc(e.s.title + " · " + App.fmtRange(e.s)) + '">' +
                   App.esc(e.s.title) + "</span>";
          }).join("") +
          (list.length > max ? '<span class="cw-more">+' + (list.length - max) + "</span>" : "") +
        "</div>" +
      "</div>";
    }
    return html + "</div>";
  }

  /* 종류별 색 범례 */
  function legend() {
    return '<div class="cal-legend">' +
      App.KIND_ORDER.map(function (k) {
        return '<span class="cal-leg k-' + k + '">' + App.KIND_LABEL[k] + "</span>";
      }).join("") + "</div>";
  }

  return { month: month, week: week, legend: legend, ymd: ymd };
})();
