/* ============================================================
   오답노트
   틀린 문제를 모아 두고, 메모를 달고, 다시 풉니다.
   같은 문제를 연속 2회 맞히면 자동으로 '극복'으로 넘어갑니다.
   ============================================================ */

App.register("review", {
  render: function (mount) {

    var scope = "open";        // open | cleared | all
    var subject = "";          // "" = 전체
    var openIds = {};          // 펼쳐 놓은 문항

    function entries() {
      var w = Store.getWrong();
      var out = [];
      Object.keys(w).forEach(function (id) {
        var q = Store.questionById(id);
        if (!q) return;                                   // 삭제된 문제는 건너뜀
        if (scope === "open"    && w[id].cleared) return;
        if (scope === "cleared" && !w[id].cleared) return;
        if (subject && q.subject !== subject) return;
        out.push({ q: q, w: w[id] });
      });
      out.sort(function (a, b) {
        if (a.w.cleared !== b.w.cleared) return a.w.cleared ? 1 : -1;
        if (b.w.count !== a.w.count) return b.w.count - a.w.count;
        return (b.w.lastTs || 0) - (a.w.lastTs || 0);
      });
      return out;
    }

    function answerText(q) {
      if (q.type === "mcq")   return q.choices[q.answer];
      if (q.type === "ox")    return q.answer ? "O (맞다)" : "X (틀리다)";
      if (q.type === "short") return q.answer;
      if (q.type === "flash") return q.answer;
      if (q.type === "essay") return q.answer;
      return "";
    }

    function draw() {
      var list = entries();
      var w = Store.getWrong();
      var openCount = Object.keys(w).filter(function (id) {
        return !w[id].cleared && Store.questionById(id);
      }).length;
      var clearedCount = Object.keys(w).filter(function (id) {
        return w[id].cleared && Store.questionById(id);
      }).length;

      var html =
        '<div class="page-head">' +
          "<h1>오답노트</h1>" +
          "<p>틀린 문제는 자동으로 여기 담깁니다. 연속 2회 맞히면 극복 처리됩니다.</p>" +
        "</div>" +

        '<div class="grid grid-3">' +
          tile("미해결", openCount + "개", "아직 넘지 못한 문제") +
          tile("극복", clearedCount + "개", "연속 2회 정답") +
          tile("합계", (openCount + clearedCount) + "개", "누적 오답 문항") +
        "</div>" +

        '<div class="card mt-2">' +
          '<div class="chips">' +
            chip("open", "미해결 " + openCount) +
            chip("cleared", "극복 " + clearedCount) +
            chip("all", "전체") +
            '<span style="width:12px"></span>' +
            subjChip("", "모든 과목") +
            Store.curriculum().map(function (c) { return subjChip(c.name, c.name); }).join("") +
          "</div>" +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" id="retryAll" type="button"' +
              (list.length ? "" : " disabled") + ">이 목록 " + list.length + "문제 다시 풀기</button>" +
            '<a class="btn" href="#/weakness">약점 보완 퀴즈</a>' +
          "</div>" +
        "</div>";

      if (!list.length) {
        html += '<div class="card"><div class="empty">' +
          (scope === "open"
            ? "미해결 오답이 없습니다. 잘하고 있습니다."
            : "해당하는 문항이 없습니다.") +
          "</div></div>";
      } else {
        html += '<div class="section-head"><h2>문항</h2>' +
                '<span class="hint">많이 틀린 순</span></div>';

        html += list.map(function (e) {
          var q = e.q, meta = e.w;
          var opened = !!openIds[q.id];

          return '<div class="card">' +
            '<div class="quiz-meta" style="margin-bottom:8px">' +
              '<span class="badge badge-acc">' + App.esc(q.subject) + "</span>" +
              '<span class="badge">' + App.esc(q.unit) + "</span>" +
              '<span class="badge">' + App.TYPE_LABEL[q.type] + "</span>" +
              '<span class="badge">난이도 ' + App.DIFF_LABEL[q.difficulty] + "</span>" +
              '<span class="badge badge-bad">' + (meta.count || 1) + "회 틀림</span>" +
              (meta.cleared ? '<span class="badge badge-ok">극복</span>' : "") +
            "</div>" +

            '<div class="row-title" style="font-size:15px;line-height:1.6">' +
              App.esc(q.prompt) + "</div>" +

            (opened
              ? '<div class="explain mt-1"><strong>정답:</strong> ' + App.esc(answerText(q)) +
                (q.explain ? "\n\n" + App.esc(q.explain) : "") + "</div>"
              : "") +

            '<div class="btn-row mt-2">' +
              '<button class="btn btn-sm" data-toggle="' + q.id + '" type="button">' +
                (opened ? "정답 숨기기" : "정답 · 해설 보기") + "</button>" +
              '<button class="btn btn-sm" data-solve="' + q.id + '" type="button">이 문제만 다시 풀기</button>' +
              '<button class="btn btn-sm" data-clear="' + q.id + '" type="button">' +
                (meta.cleared ? "미해결로 되돌리기" : "극복 처리") + "</button>" +
              '<button class="btn btn-sm btn-danger" data-del="' + q.id + '" type="button">노트에서 빼기</button>' +
            "</div>" +

            '<label class="field mt-2">내 메모' +
              '<textarea rows="2" data-memo="' + q.id + '" placeholder="왜 틀렸는지, 어떻게 외울지 적어 두세요">' +
              App.esc(meta.memo || "") + "</textarea></label>" +
          "</div>";
        }).join("");
      }

      mount.innerHTML = html;
      wire(list);
    }

    function chip(v, label) {
      return '<button class="chip' + (scope === v ? " on" : "") +
             '" data-scope="' + v + '" type="button">' + App.esc(label) + "</button>";
    }
    function subjChip(v, label) {
      return '<button class="chip' + (subject === v ? " on" : "") +
             '" data-subj="' + App.esc(v) + '" type="button">' + App.esc(label) + "</button>";
    }
    function tile(label, value, sub) {
      return '<div class="card stat"><span class="stat-label">' + App.esc(label) +
             '</span><span class="stat-value">' + App.esc(value) +
             '</span><span class="stat-sub">' + App.esc(sub) + "</span></div>";
    }

    function wire(list) {
      App.on(mount, "[data-scope]", function (ev, el) { scope = el.getAttribute("data-scope"); draw(); });
      App.on(mount, "[data-subj]",  function (ev, el) { subject = el.getAttribute("data-subj"); draw(); });

      App.on(mount, "[data-toggle]", function (ev, el) {
        var id = el.getAttribute("data-toggle");
        openIds[id] = !openIds[id];
        draw();
      });

      App.on(mount, "[data-clear]", function (ev, el) {
        var id = el.getAttribute("data-clear");
        var cur = Store.getWrong()[id];
        Store.setWrongCleared(id, !(cur && cur.cleared));
        App.refreshChrome();
        draw();
      });

      App.on(mount, "[data-del]", function (ev, el) {
        Store.removeWrong(el.getAttribute("data-del"));
        App.refreshChrome();
        draw();
      });

      App.on(mount, "[data-solve]", function (ev, el) {
        var q = Store.questionById(el.getAttribute("data-solve"));
        if (!q) return;
        QuizEngine.run(mount, {
          title: "오답 다시 풀기",
          desc: q.subject + " · " + q.unit,
          questions: [q],
          backHash: "#/review"
        });
      });

      /* 메모는 포커스가 빠질 때 저장 */
      App.onBlur(mount, "[data-memo]", function (ev, ta) {
        var id = ta.getAttribute("data-memo");
        var prev = (Store.getWrong()[id] || {}).memo || "";
        if (ta.value === prev) return;              // 바뀐 게 없으면 조용히 넘어감
        Store.setWrongMemo(id, ta.value);
        App.toast("메모를 저장했습니다");
      });

      var retry = App.$("#retryAll", mount);
      if (retry) retry.addEventListener("click", function () {
        if (!list.length) return;
        QuizEngine.run(mount, {
          title: "오답노트 다시 풀기",
          desc: list.length + "문제",
          questions: App.shuffle(list.map(function (e) { return e.q; })),
          backHash: "#/review"
        });
      });
    }

    draw();
  }
});
