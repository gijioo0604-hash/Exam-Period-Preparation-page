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

    var gcalOpen = false;      // 구글 캘린더 패널 펼침 여부

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

        gcalAsk() +

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
          : "") +

        /* 내보내기 도구는 일정 아래에 둔다.
           위에 두면 화면을 켤 때마다 정작 일정보다 설정 안내가 먼저 보인다. */
        gcalPanel(all);

      wire();
    }

    /* ---------- 구글 캘린더 ----------
       연동은 안 해도 된다. 한 번만 물어보고, 답을 기억한다. */

    function gcalSettings() {
      var s = Store.getSettings().gcal;
      if (!s || typeof s !== "object") s = { asked: false, on: false, clientId: "" };
      return s;
    }

    function saveGcal(patch) {
      var s = gcalSettings();
      for (var k in patch) if (patch.hasOwnProperty(k)) s[k] = patch[k];
      Store.setSetting("gcal", s);
    }

    /* 처음 한 번만 뜨는 물음 */
    function gcalAsk() {
      if (gcalSettings().asked) return "";
      return '<div class="card gcal-ask">' +
        '<div class="plan-head">' +
          "<strong>구글 캘린더에도 넣을까요?</strong>" +
        "</div>" +
        '<p class="small muted mt-1">여기 적은 시험 · 과제 일정을 구글 캘린더로 보낼 수 있습니다. ' +
        "폰 기본 캘린더와 알림을 그대로 쓸 수 있어서 편합니다.<br>" +
        "<strong>안 해도 됩니다.</strong> 이 앱만으로도 일정 관리는 다 됩니다.</p>" +
        '<div class="btn-row mt-2">' +
          '<button class="btn btn-primary" id="gcalYes" type="button">연결할게요</button>' +
          '<button class="btn" id="gcalNo" type="button">연결 안 함</button>' +
        "</div>" +
        '<p class="small muted mt-1">나중에 마음이 바뀌면 이 화면 맨 아래에서 다시 켤 수 있습니다.</p>' +
      "</div>";
    }

    /* 쓰겠다고 했을 때만 보이는 패널 */
    function gcalPanel(all) {
      var g = gcalSettings();
      if (!g.asked || !g.on) {
        /* 껐어도 다시 켤 수 있는 작은 줄만 남긴다 */
        if (g.asked && !g.on) {
          return '<div class="btn-row mt-3">' +
            '<button class="btn btn-ghost btn-sm" id="gcalReopen" type="button">구글 캘린더로 내보내기</button>' +
          "</div>";
        }
        return "";
      }

      var pending = all.filter(function (s) { return !s.done; });

      /* 접어 두는 게 기본 — 한 번 설정하면 다시 볼 일이 드물다 */
      if (!gcalOpen) {
        return '<div class="section-head"><h2>구글 캘린더</h2></div>' +
          '<div class="card"><div class="plan-head">' +
            '<span class="small muted">일정 ' + pending.length + "건을 구글 캘린더로 보낼 수 있습니다</span>" +
            '<button class="btn btn-sm" id="gcalOpenBtn" type="button">열기</button>' +
          "</div></div>";
      }

      return '<div class="section-head"><h2>구글 캘린더</h2>' +
        '<button class="btn btn-ghost btn-sm" id="gcalOpenBtn" type="button">접기</button></div>' +
        '<div class="card">' +
        '<div class="plan-head">' +
          '<span class="small muted">아래로 갈수록 설정이 필요합니다. 위의 두 가지는 바로 됩니다.</span>' +
          '<button class="btn btn-sm btn-ghost" id="gcalOff" type="button">연동 끄기</button>' +
        "</div>" +

        '<div class="gcal-way mt-2">' +
          "<strong>일정 하나씩 보내기</strong>" +
          '<p class="small muted">아래 일정 목록의 <b>캘린더</b> 버튼을 누르면 ' +
          "구글 캘린더 새 일정 화면이 내용이 채워진 채로 열립니다. 저장만 누르면 됩니다.</p>" +
        "</div>" +

        '<div class="gcal-way">' +
          "<strong>파일로 한 번에</strong>" +
          '<p class="small muted">' + pending.length + "건을 파일 하나로 받아 구글 캘린더에서 가져옵니다. " +
          "구글 캘린더 → 설정 → 가져오기/내보내기 → 파일 선택.</p>" +
          '<div class="btn-row">' +
            '<button class="btn btn-sm" id="gcalIcs" type="button"' + (pending.length ? "" : " disabled") +
              ">.ics 파일 받기</button>" +
          "</div>" +
        "</div>" +

        '<div class="gcal-way">' +
          "<strong>바로 넣기 <span class=\"badge\">설정 필요</span></strong>" +
          '<p class="small muted">구글에서 받은 클라이언트 ID 를 넣으면 버튼 한 번으로 캘린더에 들어갑니다. ' +
          '<a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener">구글 클라우드 콘솔</a>' +
          "에서 OAuth 클라이언트 ID(웹 애플리케이션)를 만들고, 허용 출처에 " +
          '<span class="mono">' + App.esc(location.origin) + "</span> 을 넣으세요.</p>" +
          '<label class="field">클라이언트 ID' +
            '<input type="text" id="gcalClient" value="' + App.esc(g.clientId || "") +
            '" placeholder="000000-xxxx.apps.googleusercontent.com"></label>' +
          '<div class="btn-row mt-1">' +
            '<button class="btn btn-sm" id="gcalConnect" type="button">' +
              (GCal.isConnected() ? "다시 연결" : "연결하기") + "</button>" +
            '<button class="btn btn-sm btn-primary" id="gcalPush" type="button"' +
              (pending.length && GCal.isConnected() ? "" : " disabled") + ">" +
              pending.length + "건 보내기</button>" +
            (GCal.isConnected() || g.clientId
              ? '<button class="btn btn-sm btn-danger" id="gcalDisconnect" type="button">연결 안 함</button>'
              : "") +
          "</div>" +
          '<p class="small muted mt-1" id="gcalState">' +
            (GCal.isConnected() ? "연결됨" : "연결 전 — [연결하기] 를 눌러야 보낼 수 있습니다") + "</p>" +
        "</div>" +
      "</div>";
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

          '<label class="field">마감일' +
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
          (function () {
            if (!gcalSettings().on) return "";
            var link = GCal.googleLink(s);
            if (!link) return "";                 // 날짜가 없으면 보낼 수 없다
            return '<a class="btn btn-sm" href="' + App.esc(link) +
                   '" target="_blank" rel="noopener" title="구글 캘린더에 추가">캘린더</a>';
          })() +
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

      /* ---- 구글 캘린더 ---- */

      var yes = App.$("#gcalYes", mount);
      if (yes) yes.addEventListener("click", function () {
        saveGcal({ asked: true, on: true });
        App.toast("연동을 켰습니다");
        draw();
      });

      var no = App.$("#gcalNo", mount);
      if (no) no.addEventListener("click", function () {
        saveGcal({ asked: true, on: false });
        App.toast("연동 없이 씁니다. 필요하면 여기서 다시 켤 수 있습니다.");
        draw();
      });

      var reopen = App.$("#gcalReopen", mount);
      if (reopen) reopen.addEventListener("click", function () {
        saveGcal({ asked: true, on: true });
        draw();
      });

      var openBtn = App.$("#gcalOpenBtn", mount);
      if (openBtn) openBtn.addEventListener("click", function () {
        gcalOpen = !gcalOpen;
        draw();
        if (gcalOpen) {
          var h = App.$("#gcalIcs", mount);
          if (h) h.scrollIntoView({ block: "center" });
        }
      });

      var off = App.$("#gcalOff", mount);
      if (off) off.addEventListener("click", function () {
        saveGcal({ on: false });
        gcalOpen = false;
        App.toast("연동을 껐습니다");
        draw();
      });

      var ics = App.$("#gcalIcs", mount);
      if (ics) ics.addEventListener("click", function () {
        var pending = Store.getSchedule().filter(function (s) { return !s.done; });
        if (!pending.length) { App.toast("보낼 일정이 없습니다"); return; }
        GCal.downloadIcs(pending);
        App.toast(pending.length + "건을 파일로 받았습니다");
      });

      var connect = App.$("#gcalConnect", mount);
      if (connect) connect.addEventListener("click", function () {
        var id = App.$("#gcalClient", mount).value.trim();
        if (!id) { App.toast("클라이언트 ID 를 넣어 주세요"); return; }
        saveGcal({ clientId: id });
        App.$("#gcalState", mount).textContent = "연결하는 중…";
        GCal.connect(id).then(function () {
          App.$("#gcalState", mount).textContent = "연결됨";
          App.toast("구글 계정에 연결했습니다");
        }).catch(function (e) {
          App.$("#gcalState", mount).textContent = "연결 실패 — " + e.message;
          App.toast("연결하지 못했습니다");
        });
      });

      var disc = App.$("#gcalDisconnect", mount);
      if (disc) disc.addEventListener("click", function () {
        if (!confirm("구글 연결을 끊고 클라이언트 ID 도 지울까요?\n\n" +
                     "이미 캘린더에 보낸 일정은 그대로 남습니다.")) return;
        GCal.disconnect();
        saveGcal({ clientId: "" });
        App.toast("연결을 끊었습니다");
        draw();
      });

      var push = App.$("#gcalPush", mount);
      if (push) push.addEventListener("click", function () {
        if (!GCal.isConnected()) { App.toast("먼저 [연결하기] 를 눌러 주세요"); return; }
        var pending = Store.getSchedule().filter(function (s) { return !s.done; });
        if (!pending.length) { App.toast("보낼 일정이 없습니다"); return; }
        if (!confirm(pending.length + "건을 구글 캘린더에 넣습니다.\n\n" +
                     "이미 넣은 적이 있으면 같은 일정이 또 생깁니다. 계속할까요?")) return;
        push.disabled = true;
        App.$("#gcalState", mount).textContent = "보내는 중…";
        GCal.push(pending).then(function (r) {
          push.disabled = false;
          App.$("#gcalState", mount).textContent =
            r.ok + "건 완료" + (r.fail ? " · " + r.fail + "건 실패: " + r.errors[0] : "");
          App.toast(r.fail ? r.ok + "건만 들어갔습니다" : r.ok + "건을 넣었습니다");
        });
      });

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
