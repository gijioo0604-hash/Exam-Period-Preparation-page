/* ============================================================
   일정 · D-day
   시험뿐 아니라 과제 · 대외활동 · 기타 일정을 함께 관리합니다.
   ============================================================ */

App.register("schedule", {
  render: function (mount) {

    var editingId = null;
    var filter = "all";       // all | exam | assignment | activity | etc
    var showDone = false;

    /* 달력이 보고 있는 달 */
    var today = new Date();
    var calY = today.getFullYear();
    var calM = today.getMonth();

    /* 폼의 날짜칸 기본값 — 달력에서 날짜를 누르면 바뀐다 */
    var formDate = App.todayStr();

    function draw() {
      var all = Store.getSchedule();
      var list = all.filter(function (s) {
        if (filter !== "all" && s.kind !== filter) return false;
        if (!showDone && s.done) return false;
        return true;
      });

      /* 진행 중인 기간 일정이 '지난 일정'으로 밀려나지 않도록 마감일을 기준으로 나눈다 */
      var upcoming = list.filter(function (s) {
        var n = App.daysUntil(App.endOf(s));
        return n === null || n >= 0;
      });
      var past = list.filter(function (s) {
        var n = App.daysUntil(App.endOf(s));
        return n !== null && n < 0;
      }).reverse();

      var doneCount = all.filter(function (s) { return s.done; }).length;
      var editing = editingId ? all.filter(function (s) { return s.id === editingId; })[0] : null;

      /* 달력에는 필터를 적용하되 완료 항목도 흐리게 함께 보여 준다 */
      var calItems = all.filter(function (s) {
        return filter === "all" || s.kind === filter;
      });

      mount.innerHTML =
        '<div class="page-head">' +
          "<h1>일정 · D-day</h1>" +
          "<p>시험 · 과제 · 대외활동을 한 곳에 모아 둡니다. 시험으로 등록한 항목만 홈의 D-day 카드에 올라갑니다.</p>" +
        "</div>" +

        '<div class="card">' +
          Calendar.month(calY, calM, calItems, { max: 3 }) +
          Calendar.legend() +
          '<p class="small muted mt-1">빈 칸을 누르면 그 날짜로 아래 폼이 채워지고, ' +
          "일정을 누르면 바로 수정할 수 있습니다.</p>" +
        "</div>" +

        formCard(editing) +

        '<div class="section-head">' +
          "<h2>등록된 일정</h2>" +
          '<span class="hint">' + upcoming.length + "건 예정" +
            (doneCount ? " · 완료 " + doneCount + "건" : "") + "</span>" +
        "</div>" +

        '<div class="card">' +
          '<div class="chips" style="margin-bottom:12px">' +
            chip("all", "전체") +
            App.KIND_ORDER.map(function (k) { return chip(k, App.KIND_LABEL[k]); }).join("") +
            '<button class="chip' + (showDone ? " on" : "") + '" id="toggleDone" type="button">완료 항목 보기</button>' +
          "</div>" +
          (upcoming.length
            ? '<div class="list">' + upcoming.map(row).join("") + "</div>"
            : '<div class="empty">예정된 일정이 없습니다.</div>') +
        "</div>" +

        (past.length
          ? '<div class="section-head"><h2>지난 일정</h2></div>' +
            '<div class="card"><div class="list">' + past.map(row).join("") + "</div></div>"
          : "");

      wire();
    }

    /* ---------- 입력 폼 ---------- */

    function formCard(e) {
      var v = e || {
        kind: "assignment", date: formDate, endDate: "",
        title: "", time: "", subject: "", memo: ""
      };
      var subjects = Store.subjectNames();
      var hasEnd = !!(v.endDate && v.endDate !== v.date);

      return '<div class="card">' +
        '<div class="section-head" style="margin-top:0"><h2>' +
          (e ? "일정 수정" : "일정 추가") + "</h2>" +
          (e ? '<button class="hint btn btn-ghost btn-sm" id="cancelEdit" type="button">취소</button>' : "") +
        "</div>" +
        '<div class="form-grid">' +
          '<label class="field span-2">제목' +
            '<input type="text" id="fTitle" value="' + App.esc(v.title) +
            '" placeholder="예) 항해학 중간고사 / 실습계획서 제출 / 학회 발표"></label>' +

          '<label class="field">종류' +
            '<select id="fKind">' +
              App.KIND_ORDER.map(function (k) {
                return '<option value="' + k + '"' + (v.kind === k ? " selected" : "") + ">" +
                       App.KIND_LABEL[k] + "</option>";
              }).join("") +
            "</select></label>" +

          '<label class="field">관련 과목 <span class="opt">(선택)</span>' +
            '<select id="fSubject">' +
              '<option value="">— 없음 —</option>' +
              subjects.map(function (s) {
                return '<option value="' + App.esc(s) + '"' + (v.subject === s ? " selected" : "") + ">" +
                       App.esc(s) + "</option>";
              }).join("") +
              (v.subject && subjects.indexOf(v.subject) < 0
                ? '<option value="' + App.esc(v.subject) + '" selected>' + App.esc(v.subject) + "</option>"
                : "") +
            "</select></label>" +

          '<label class="field">' + (hasEnd ? "시작일" : "날짜") +
            '<input type="date" id="fDate" value="' + App.esc(v.date) + '"></label>' +

          '<label class="field">마감일 <span class="opt">(여러 날 걸리면)</span>' +
            '<input type="date" id="fEnd" value="' + App.esc(v.endDate || "") +
            '" min="' + App.esc(v.date) + '"></label>' +

          '<label class="field span-2">시각 <span class="opt">(선택 · 마감 시각)</span>' +
            '<input type="time" id="fTime" value="' + App.esc(v.time || "") + '"></label>' +

          '<label class="field span-2">메모 <span class="opt">(선택)</span>' +
            '<textarea id="fMemo" rows="2" placeholder="시험 범위, 제출 형식, 장소 등">' +
            App.esc(v.memo || "") + "</textarea></label>" +
        "</div>" +
        '<div class="btn-row mt-2">' +
          '<button class="btn btn-primary" id="saveBtn" type="button">' +
            (e ? "수정 저장" : "추가") + "</button>" +
        "</div>" +
      "</div>";
    }

    /* ---------- 행 ---------- */

    function row(s) {
      var b = App.scheduleBadge(s);
      var dd = '<span class="badge ' + b.cls + '">' + App.esc(b.text) + "</span>";
      var days = App.isRange(s)
        ? (App.daysUntil(App.endOf(s)) - App.daysUntil(App.startOf(s)) + 1)
        : 1;

      return '<div class="row' + (s.done ? " done" : "") + '">' +
        '<div class="row-main">' +
          '<div class="row-title">' +
            '<span class="badge">' + App.KIND_LABEL[s.kind] + "</span> " +
            App.esc(s.title) +
            (!s.done && App.isOngoing(s) && App.isRange(s)
              ? ' <span class="badge badge-warn">진행 중</span>' : "") + "</div>" +
          '<div class="row-sub">' +
            App.esc(App.fmtRange(s)) +
            (App.isRange(s) ? " (" + days + "일)" : "") +
            (s.subject ? " · " + App.esc(s.subject) : "") +
            (s.memo ? " · " + App.esc(s.memo) : "") +
          "</div>" +
        "</div>" +
        '<div class="row-side">' + dd +
          '<button class="btn btn-sm" data-done="' + s.id + '" type="button">' +
            (s.done ? "되돌리기" : "완료") + "</button>" +
          '<button class="btn btn-sm" data-edit="' + s.id + '" type="button">수정</button>' +
          '<button class="btn btn-sm btn-danger" data-del="' + s.id + '" type="button">삭제</button>' +
        "</div>" +
      "</div>";
    }

    function chip(k, label) {
      return '<button class="chip' + (filter === k ? " on" : "") +
             '" data-filter="' + k + '" type="button">' + App.esc(label) + "</button>";
    }

    /* ---------- 이벤트 ---------- */

    function wire() {

      /* ---- 달력 ---- */

      App.on(mount, "[data-cal-nav]", function (ev, el) {
        var dir = Number(el.getAttribute("data-cal-nav"));
        if (dir === 0) {
          var n = new Date();
          calY = n.getFullYear(); calM = n.getMonth();
        } else {
          calM += dir;
          if (calM < 0)  { calM = 11; calY--; }
          if (calM > 11) { calM = 0;  calY++; }
        }
        draw();
      });

      /* 일정 칩을 누르면 수정 모드로 */
      App.on(mount, "[data-cal-item]", function (ev, el) {
        ev.stopPropagation();
        editingId = el.getAttribute("data-cal-item");
        draw();
        var form = App.$("#fTitle", mount);
        if (form) form.scrollIntoView({ block: "center" });
      });

      /* 빈 칸을 누르면 그 날짜로 폼을 채운다 */
      App.on(mount, "[data-cal-date]", function (ev, el) {
        if (ev.target.closest("[data-cal-item]")) return;
        formDate = el.getAttribute("data-cal-date");
        var input = App.$("#fDate", mount);
        if (editingId) { editingId = null; draw(); }
        else if (input) { input.value = formDate; input.focus(); }
      });

      /* 시작일을 바꾸면 마감일이 그보다 앞설 수 없게 */
      App.$("#fDate", mount).addEventListener("change", function () {
        var end = App.$("#fEnd", mount);
        end.min = this.value;
        if (end.value && end.value < this.value) end.value = this.value;
      });

      App.$("#saveBtn", mount).addEventListener("click", function () {
        var title = App.$("#fTitle", mount).value.trim();
        var date  = App.$("#fDate", mount).value;
        var end   = App.$("#fEnd", mount).value;
        if (!title) { App.toast("제목을 입력하세요"); return; }
        if (!date)  { App.toast("날짜를 선택하세요"); return; }
        if (end && end < date) { App.toast("마감일이 시작일보다 앞설 수 없습니다"); return; }

        var item = {
          id: editingId || null,
          title: title,
          kind: App.$("#fKind", mount).value,
          subject: App.$("#fSubject", mount).value,
          date: date,
          endDate: (end && end !== date) ? end : "",
          time: App.$("#fTime", mount).value,
          memo: App.$("#fMemo", mount).value.trim(),
          done: false
        };
        if (editingId) {
          var prev = Store.getSchedule().filter(function (s) { return s.id === editingId; })[0];
          if (prev) item.done = prev.done;
        }
        Store.saveScheduleItem(item);
        App.toast(editingId ? "수정했습니다" : "추가했습니다");
        editingId = null;
        App.refreshChrome();
        draw();
      });

      var cancel = App.$("#cancelEdit", mount);
      if (cancel) cancel.addEventListener("click", function () { editingId = null; draw(); });

      App.$("#toggleDone", mount).addEventListener("click", function () { showDone = !showDone; draw(); });

      App.on(mount, "[data-filter]", function (ev, el) { filter = el.getAttribute("data-filter"); draw(); });

      App.on(mount, "[data-done]", function (ev, el) {
        Store.toggleScheduleDone(el.getAttribute("data-done"));
        App.refreshChrome();
        draw();
      });

      App.on(mount, "[data-edit]", function (ev, el) {
        editingId = el.getAttribute("data-edit");
        draw();
        window.scrollTo(0, 0);
      });

      App.on(mount, "[data-del]", function (ev, el) {
        var id = el.getAttribute("data-del");
        var s = Store.getSchedule().filter(function (x) { return x.id === id; })[0];
        if (!confirm("삭제할까요?\n\n" + (s ? s.title : ""))) return;
        Store.deleteScheduleItem(id);
        if (editingId === id) editingId = null;
        App.refreshChrome();
        draw();
      });
    }

    draw();
  }
});
