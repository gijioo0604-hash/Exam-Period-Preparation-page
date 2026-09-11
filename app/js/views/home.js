/* ============================================================
   홈 — 오늘 한눈에 보기
   ============================================================ */

App.register("home", {
  render: function (mount) {

    var sch   = Store.getSchedule();
    var today = App.todayStr();
    var ov    = App.overall();
    var weak  = App.weakUnits(3).slice(0, 3);
    var openWrong = Store.openWrongCount();

    /* 다가오는 시험 (지난 것 제외, 최대 4개) */
    var exams = sch.filter(function (s) {
      return s.kind === "exam" && !s.done && App.daysUntil(s.date) !== null && App.daysUntil(s.date) >= 0;
    }).slice(0, 4);

    /* 이미 시작했거나 마감이 지난 일 (시험 제외, 미완료) */
    var due = sch.filter(function (s) {
      if (s.done || s.kind === "exam") return false;
      var n = App.daysUntil(App.startOf(s));
      return n !== null && n <= 0;
    });

    /* 아직 시작 전이고 7일 안에 시작하는 일 */
    var soon = sch.filter(function (s) {
      if (s.done || s.kind === "exam") return false;
      var n = App.daysUntil(App.startOf(s));
      return n !== null && n >= 1 && n <= 7;
    });

    /* 진도율 */
    var prog = Store.getProgress();
    var totalUnits = 0, doneUnits = 0;
    Store.curriculum().forEach(function (c) {
      c.units.forEach(function (u) {
        totalUnits++;
        if (prog[c.name + "::" + u]) doneUnits++;
      });
    });

    var html = '<div class="page-head"><h1>홈</h1><p>' + App.fmtDate(today) + " 기준</p></div>";

    /* ---- 이번 주 (오늘부터 7일) ---- */
    /* 기간 일정은 창에 걸치기만 해도 센다 */
    var winEnd = App.dayKey(new Date(today + "T00:00:00").getTime() + 6 * 86400000);
    var weekCount = sch.filter(function (s) {
      var a = App.startOf(s), b = App.endOf(s);
      return a && a <= winEnd && b >= today;
    }).length;

    html += '<div class="section-head" style="margin-top:0"><h2>앞으로 7일</h2>' +
            '<span class="hint">' + (weekCount ? weekCount + "건" : "일정 없음") + "</span></div>" +
            '<div class="card">' + Calendar.week(today, sch, { days: 7, max: 2 }) +
            Calendar.legend() + "</div>";

    /* ---- 다가오는 시험 ---- */
    html += '<div class="section-head"><h2>다가오는 시험</h2>' +
            '<a class="hint" href="#/schedule">일정 관리 →</a></div>';

    if (exams.length) {
      html += '<div class="grid grid-' + Math.min(exams.length, 4) + '">' +
        exams.map(function (e) {
          return '<div class="card">' +
            '<div class="stat-label">' + App.esc(e.subject || "시험") + "</div>" +
            '<div class="dday"><span class="dday-num ' + App.ddayClass(e.date) + '">' +
              App.ddayText(e.date) + "</span></div>" +
            '<div class="row-title mt-1">' + App.esc(e.title) + "</div>" +
            '<div class="row-sub">' + App.fmtDate(e.date) + (e.time ? " " + App.esc(e.time) : "") + "</div>" +
          "</div>";
        }).join("") + "</div>";
    } else {
      html += '<div class="card"><div class="empty">등록된 시험이 없습니다.<br>' +
              '<a href="#/schedule">일정 · D-day</a>에서 시험 날짜를 먼저 넣어 주세요.</div></div>';
    }

    /* ---- 오늘 처리할 일 ---- */
    html += '<div class="section-head"><h2>지금 해야 할 일</h2>' +
            '<span class="hint">시작했거나 마감이 지난 것</span></div>';

    if (due.length) {
      html += '<div class="card"><div class="list">' + due.map(rowFor).join("") + "</div></div>";
    } else {
      html += '<div class="card"><div class="empty">지금 붙잡고 있어야 할 일이 없습니다.</div></div>';
    }

    if (soon.length) {
      html += '<div class="section-head"><h2>곧 시작</h2></div>' +
              '<div class="card"><div class="list">' + soon.map(rowFor).join("") + "</div></div>";
    }

    /* ---- 학습 현황 ---- */
    html += '<div class="section-head"><h2>학습 현황</h2>' +
            '<a class="hint" href="#/stats">통계 자세히 →</a></div>' +
            '<div class="grid grid-4">' +
              tile("총 푼 문제", ov.total + "개", "플래시카드 제외") +
              tile("전체 정답률", ov.total ? ov.rate + "%" : "—", ov.total ? ov.right + " / " + ov.total : "아직 기록 없음") +
              tile("미해결 오답", openWrong + "개", openWrong ? "오답노트에서 확인" : "깨끗합니다") +
              tile("진도", App.pct(doneUnits, totalUnits) + "%", doneUnits + " / " + totalUnits + " 단원") +
            "</div>";

    /* ---- 약점 ---- */
    html += '<div class="section-head"><h2>지금 약한 곳</h2>' +
            '<span class="hint">3회 이상 푼 단원 기준</span></div>';

    if (weak.length) {
      html += '<div class="card"><div class="hbars">' +
        weak.map(function (w) {
          return '<div class="hbar">' +
            '<span class="hbar-label" title="' + App.esc(w.subject + " · " + w.unit) + '">' +
              App.esc(w.unit) + "</span>" +
            '<span class="bar bad"><i style="width:' + w.wrongRate + '%"></i></span>' +
            '<span class="hbar-val">오답 ' + w.wrongRate + "%</span>" +
          "</div>";
        }).join("") + "</div>" +
        '<div class="btn-row mt-2"><a class="btn btn-primary" href="#/weakness">약점 보완 퀴즈 시작</a></div>' +
        "</div>";
    } else {
      html += '<div class="card"><div class="empty">아직 약점을 판단할 만큼 기록이 없습니다.<br>' +
              "각 단원을 3문제 이상 풀면 여기에 표시됩니다.</div></div>";
    }

    /* ---- 바로 시작 ---- */
    html += '<div class="section-head"><h2>바로 시작</h2></div>' +
            '<div class="btn-row">' +
              '<a class="btn btn-primary" href="#/quiz">문제 풀기</a>' +
              '<a class="btn" href="#/weakness">약점 보완 퀴즈</a>' +
              '<a class="btn" href="#/review">오답노트' + (openWrong ? " (" + openWrong + ")" : "") + "</a>" +
              '<a class="btn" href="#/plan">진도 체크</a>' +
              '<a class="btn btn-ghost" href="#/editor">문제 추가</a>' +
            "</div>";

    mount.innerHTML = html;

    App.on(mount, "[data-toggle]", function (ev, el) {
      Store.toggleScheduleDone(el.getAttribute("data-toggle"));
      App.render();
    });

    /* 주간 띠의 날짜를 누르면 일정 화면으로 */
    App.on(mount, "[data-cal-date]", function () { location.hash = "#/schedule"; });

    function rowFor(s) {
      var b = App.scheduleBadge(s);
      return '<div class="row">' +
        '<div class="row-main">' +
          '<div class="row-title">' + App.esc(s.title) +
            (App.isRange(s) && App.isOngoing(s)
              ? ' <span class="badge badge-warn">진행 중</span>' : "") + "</div>" +
          '<div class="row-sub">' + App.KIND_LABEL[s.kind] +
            (s.subject ? " · " + App.esc(s.subject) : "") +
            " · " + App.esc(App.fmtRange(s)) + "</div>" +
        "</div>" +
        '<div class="row-side">' +
          '<span class="badge ' + b.cls + '">' + App.esc(b.text) + "</span>" +
          '<button class="btn btn-sm" data-toggle="' + s.id + '" type="button">완료</button>' +
        "</div>" +
      "</div>";
    }

    function tile(label, value, sub) {
      return '<div class="card stat"><span class="stat-label">' + App.esc(label) +
             '</span><span class="stat-value">' + App.esc(value) +
             '</span><span class="stat-sub">' + App.esc(sub) + "</span></div>";
    }
  }
});
