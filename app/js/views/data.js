/* ============================================================
   백업 · 초기화
   기록은 이 브라우저에만 저장됩니다. 다른 기기로 옮기거나
   실수로 지우는 일에 대비해 여기서 내보내기 해 두세요.
   ============================================================ */

App.register("data", {
  render: function (mount) {

    function counts() {
      return {
        attempts: Store.getAttempts().length,
        wrong: Object.keys(Store.getWrong()).length,
        schedule: Store.getSchedule().length,
        progress: Object.keys(Store.getProgress()).length,
        custom: Store.getCustom().length
      };
    }

    function draw() {
      var c = counts();

      mount.innerHTML =
        '<div class="page-head">' +
          "<h1>백업 · 초기화</h1>" +
          "<p>모든 기록은 이 브라우저 안에만 있습니다. 브라우저 데이터를 지우면 함께 사라집니다.</p>" +
        "</div>" +

        '<div class="grid grid-4">' +
          tile("푼 기록", c.attempts + "건") +
          tile("오답 문항", c.wrong + "개") +
          tile("일정", c.schedule + "건") +
          tile("내 문제", c.custom + "개") +
        "</div>" +

        '<div class="section-head"><h2>내보내기</h2>' +
          '<span class="hint">JSON 한 덩어리</span></div>' +
        '<div class="card">' +
          '<div class="btn-row">' +
            '<button class="btn btn-primary" id="dlBtn" type="button">파일로 저장</button>' +
            '<button class="btn" id="showBtn" type="button">화면에 펼치기</button>' +
          "</div>" +
          '<div id="exportSlot" class="mt-2"></div>' +
        "</div>" +

        '<div class="section-head"><h2>가져오기</h2>' +
          '<span class="hint">기존 기록을 덮어씁니다</span></div>' +
        '<div class="card">' +
          '<label class="field">백업 파일 선택' +
            '<input type="file" id="fileInput" accept=".json,application/json"></label>' +
          '<label class="field mt-2">또는 JSON 붙여넣기' +
            '<textarea id="pasteBox" rows="5" class="mono" placeholder=\'{"attempts":[], ...}\'></textarea></label>' +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" id="importBtn" type="button">붙여넣은 내용 가져오기</button>' +
          "</div>" +
        "</div>" +

        '<div class="section-head"><h2>부분 초기화</h2></div>' +
        '<div class="card"><div class="list">' +
          resetRow("attempts", "푼 기록", "정답률 · 통계 · 약점 분석이 모두 초기화됩니다") +
          resetRow("wrong", "오답노트", "메모도 함께 지워집니다") +
          resetRow("schedule", "일정", "시험 · 과제 · 대외활동 전체") +
          resetRow("progress", "진도 체크", "단원 체크만 지웁니다") +
          resetRow("custom", "내가 추가한 문제", "data/questions.js 의 문제는 남습니다") +
        "</div></div>" +

        '<div class="section-head"><h2>전체 초기화</h2></div>' +
        '<div class="card">' +
          '<div class="callout callout-warn">되돌릴 수 없습니다. 먼저 내보내기를 해 두세요.</div>' +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-danger" id="resetAll" type="button">모든 기록 삭제</button>' +
          "</div>" +
        "</div>";

      wire();
    }

    function tile(label, value) {
      return '<div class="card stat"><span class="stat-label">' + App.esc(label) +
             '</span><span class="stat-value">' + App.esc(value) + "</span></div>";
    }

    function resetRow(key, label, desc) {
      return '<div class="row"><div class="row-main">' +
        '<div class="row-title">' + App.esc(label) + "</div>" +
        '<div class="row-sub">' + App.esc(desc) + "</div>" +
      "</div><div class=\"row-side\">" +
        '<button class="btn btn-sm btn-danger" data-reset="' + key + '" type="button">지우기</button>' +
      "</div></div>";
    }

    function wire() {
      App.$("#dlBtn", mount).addEventListener("click", function () {
        var json = JSON.stringify(Store.exportAll(), null, 2);
        var blob = new Blob([json], { type: "application/json" });
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "시험허브_백업_" + App.todayStr() + ".json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
        App.toast("백업 파일을 저장했습니다");
      });

      App.$("#showBtn", mount).addEventListener("click", function () {
        App.$("#exportSlot", mount).innerHTML =
          '<textarea rows="12" class="mono" readonly>' +
          App.esc(JSON.stringify(Store.exportAll(), null, 2)) + "</textarea>";
      });

      App.$("#fileInput", mount).addEventListener("change", function (ev) {
        var f = ev.target.files && ev.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function () { doImport(r.result); };
        r.readAsText(f, "utf-8");
      });

      App.$("#importBtn", mount).addEventListener("click", function () {
        doImport(App.$("#pasteBox", mount).value);
      });

      App.on(mount, "[data-reset]", function (ev, el) {
        var key = el.getAttribute("data-reset");
        if (!confirm("이 항목을 지울까요? 되돌릴 수 없습니다.")) return;
        Store.resetKey(key);
        App.toast("지웠습니다");
        App.refreshChrome();
        draw();
      });

      App.$("#resetAll", mount).addEventListener("click", function () {
        if (!confirm("모든 기록을 삭제합니다. 정말 진행할까요?")) return;
        if (!confirm("한 번 더 확인합니다. 백업은 받으셨나요?")) return;
        Store.resetAll();
        App.toast("전체 초기화했습니다");
        App.refreshChrome();
        draw();
      });
    }

    function doImport(text) {
      if (!text || !text.trim()) { App.toast("가져올 내용이 없습니다"); return; }
      var obj;
      try {
        obj = JSON.parse(text);
      } catch (e) {
        App.toast("JSON 형식이 아닙니다");
        return;
      }
      if (typeof obj !== "object" || obj === null) { App.toast("형식이 올바르지 않습니다"); return; }
      if (!confirm("현재 기록을 덮어씁니다. 계속할까요?")) return;
      Store.importAll(obj);
      App.toast("가져왔습니다");
      App.refreshChrome();
      draw();
    }

    draw();
  }
});
