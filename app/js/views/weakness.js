/* ============================================================
   약점 보완 퀴즈
   ------------------------------------------------------------
   푼 기록에서 오답률이 높은 단원을 찾아, 그 단원 문제와
   아직 극복하지 못한 오답 문제를 섞어 출제합니다.
   ============================================================ */

App.register("weakness", {
  render: function (mount) {

    var MIN_TOTAL = 3;          // 이 횟수 이상 푼 단원만 약점 판정 대상
    var picked = null;          // 사용자가 고른 단원 키 Set (null 이면 자동 선택 그대로)
    var count = 10;
    var wrongShare = 50;        // 틀렸던 문제 자체를 다시 낼 비율 (%)

    function draw() {
      var weak = App.weakUnits(MIN_TOTAL);
      var wrongMap = Store.getWrong();

      var openWrongIds = Object.keys(wrongMap).filter(function (id) {
        return !wrongMap[id].cleared && Store.questionById(id);
      });

      /* 처음 들어왔을 때는 상위 5개 단원을 기본 선택 */
      if (picked === null) {
        picked = new Set(weak.slice(0, 5).map(function (w) { return w.subject + "::" + w.unit; }));
      }

      /* 분석할 데이터가 아예 없는 경우 */
      if (!weak.length && !openWrongIds.length) {
        mount.innerHTML =
          '<div class="page-head"><h1>약점 보완 퀴즈</h1>' +
          "<p>틀린 기록이 쌓이면 여기서 약한 단원만 골라 집중적으로 다시 풉니다.</p></div>" +
          '<div class="card"><div class="empty">' +
            "아직 분석할 기록이 없습니다.<br><br>" +
            "먼저 <strong>문제 풀기</strong>에서 한 바퀴 돌려 보세요.<br>" +
            "단원마다 " + MIN_TOTAL + "문제 이상 풀면 약점이 자동으로 잡힙니다." +
          "</div>" +
          '<div class="btn-row" style="justify-content:center">' +
            '<a class="btn btn-primary" href="#/quiz">문제 풀기로 가기</a></div></div>';
        return;
      }

      var selected = weak.filter(function (w) { return picked.has(w.subject + "::" + w.unit); });
      var preview = build(selected, openWrongIds, count, wrongShare);

      var html =
        '<div class="page-head">' +
          "<h1>약점 보완 퀴즈</h1>" +
          "<p>오답률이 높은 단원과 아직 못 넘긴 오답 문제를 섞어서 냅니다.</p>" +
        "</div>";

      /* ---- 약점 랭킹 ---- */
      html += '<div class="section-head" style="margin-top:0"><h2>약점 단원 순위</h2>' +
              '<span class="hint">' + MIN_TOTAL + "회 이상 푼 단원 기준 · 눌러서 포함/제외</span></div>";

      if (weak.length) {
        html += '<div class="card"><div class="list">' +
          weak.map(function (w, i) {
            var key = w.subject + "::" + w.unit;
            var on = picked.has(key);
            return '<div class="row" style="cursor:pointer" data-pick="' + App.esc(key) + '">' +
              '<div class="row-side" style="align-self:center">' +
                '<input type="checkbox"' + (on ? " checked" : "") +
                ' tabindex="-1" style="pointer-events:none">' +
              "</div>" +
              '<div class="row-main">' +
                '<div class="row-title">' + (i + 1) + ". " + App.esc(w.unit) + "</div>" +
                '<div class="row-sub">' + App.esc(w.subject) + " · " + w.total + "회 풀이 중 " +
                  w.wrong + "회 오답</div>" +
                '<div class="bar bad mt-1" style="max-width:260px"><i style="width:' +
                  w.wrongRate + '%"></i></div>' +
              "</div>" +
              '<div class="row-side"><span class="badge badge-bad">오답 ' + w.wrongRate + "%</span></div>" +
            "</div>";
          }).join("") + "</div>" +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-sm" id="pickAll" type="button">전체 선택</button>' +
            '<button class="btn btn-sm btn-ghost" id="pickNone" type="button">전체 해제</button>' +
            '<button class="btn btn-sm btn-ghost" id="pickTop3" type="button">상위 3개만</button>' +
          "</div></div>";
      } else {
        html += '<div class="card"><div class="empty">' + MIN_TOTAL +
                "회 이상 푼 단원이 아직 없습니다. 오답 문제만으로 출제합니다.</div></div>";
      }

      /* ---- 출제 구성 ---- */
      html += '<div class="section-head"><h2>출제 구성</h2></div>' +
        '<div class="card">' +
          '<div class="grid grid-3">' +
            tile("틀렸던 문제", preview.poolWrong + "개", "아직 극복 못 한 문항") +
            tile("약점 단원의 다른 문제", preview.poolWeak + "개", selected.length + "개 단원에서") +
            tile("출제 가능", preview.pool + "개", "중복 없이 낼 수 있는 최대") +
          "</div>" +
          '<div class="form-grid mt-2">' +
            '<label class="field">문항 수' +
              '<input type="number" id="cnt" min="1" max="60" value="' + count + '"></label>' +
            '<label class="field">틀렸던 문제 비중' +
              '<select id="share">' +
                [[30, "30% — 새 문제 위주로 넓게"],
                 [50, "50% — 반반 (기본)"],
                 [70, "70% — 틀린 것 위주로"],
                 [100, "100% — 틀린 문제만"]].map(function (o) {
                  return '<option value="' + o[0] + '"' + (wrongShare === o[0] ? " selected" : "") +
                         ">" + App.esc(o[1]) + "</option>";
                }).join("") +
              "</select></label>" +
          "</div>" +
          '<div class="callout mt-2">이번 세션은 <strong>' + preview.list.length + "문제</strong>" +
            " — 틀렸던 문제 다시 " + preview.fromWrong + "개, 약점 단원의 다른 문제 " +
            preview.fromWeak + "개" +
            "<br><span class=\"small\">같은 문제만 반복하면 답을 외워 버립니다. " +
            "그래서 약점 단원의 안 풀어 본 문제를 함께 냅니다.</span></div>" +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" id="startBtn" type="button"' +
              (preview.list.length ? "" : " disabled") + ">약점 보완 시작</button>" +
            '<button class="btn btn-ghost btn-sm" id="reshuffle" type="button">다른 문제로 다시 뽑기</button>' +
            '<a class="btn btn-ghost" href="#/review">오답노트 보기</a>' +
          "</div>" +
        "</div>";

      /* ---- 미리보기 ---- */
      if (preview.list.length) {
        html += '<div class="section-head"><h2>출제 목록 미리보기</h2></div>' +
          '<div class="card"><div class="list">' +
            preview.list.map(function (q) {
              var w = wrongMap[q.id];
              return '<div class="row"><div class="row-main">' +
                '<div class="row-title">' + App.esc(QuizEngine.trim(q.prompt, 64)) + "</div>" +
                '<div class="row-sub">' + App.esc(q.subject) + " · " + App.esc(q.unit) +
                  " · " + App.TYPE_LABEL[q.type] + " · 난이도 " + App.DIFF_LABEL[q.difficulty] + "</div>" +
              "</div><div class=\"row-side\">" +
                (w && !w.cleared ? '<span class="badge badge-bad">' + w.count + "회 틀림</span>" : "") +
              "</div></div>";
            }).join("") +
          "</div></div>";
      }

      mount.innerHTML = html;
      wire(preview);
    }

    /* ---------- 출제 목록 만들기 ----------
       두 갈래를 정해진 비율로 섞는다.
         (1) 틀렸던 그 문제 자체를 다시 내기
         (2) 약점 단원의 '다른' 문제를 내기 — 같은 개념을 다른 각도에서
       (2)가 있어야 문제를 통째로 외워 버리는 걸 막을 수 있다. */
    function build(selectedUnits, openWrongIds, n, wrongShare) {
      var wrongMap = Store.getWrong();
      var unitRate = {};
      App.unitStats().forEach(function (e) { unitRate[e.subject + "::" + e.unit] = e.wrongRate; });

      var selKeys = new Set(selectedUnits.map(function (w) { return w.subject + "::" + w.unit; }));
      var openWrongSet = new Set(openWrongIds);

      var wrongPool = [], weakPool = [];

      Store.allQuestions().forEach(function (q) {
        var key = q.subject + "::" + q.unit;
        var isWrong = openWrongSet.has(q.id);
        var inWeak  = selKeys.has(key);
        if (!isWrong && !inWeak) return;           // 약점과 무관한 문제는 제외

        if (isWrong) {
          wrongPool.push({ q: q, s: (wrongMap[q.id].count || 1) * 25 + Math.random() * 20, tag: "wrong" });
        } else {
          weakPool.push({ q: q, s: (unitRate[key] || 0) + Math.random() * 20, tag: "weak" });
        }
      });

      var byScore = function (a, b) { return b.s - a.s; };
      wrongPool.sort(byScore);
      weakPool.sort(byScore);

      n = Math.max(1, n);
      var wantWrong = Math.round(n * (wrongShare / 100));
      var take = wrongPool.slice(0, wantWrong);
      take = take.concat(weakPool.slice(0, n - take.length));

      /* 한쪽이 모자라면 다른 쪽에서 더 채운다 */
      if (take.length < n) take = take.concat(wrongPool.slice(wantWrong, wantWrong + (n - take.length)));
      if (take.length < n) take = take.concat(weakPool.slice(take.length, n));

      return {
        list: App.shuffle(take.map(function (x) { return x.q; })),
        pool: wrongPool.length + weakPool.length,
        poolWrong: wrongPool.length,
        poolWeak: weakPool.length,
        fromWrong: take.filter(function (x) { return x.tag === "wrong"; }).length,
        fromWeak:  take.filter(function (x) { return x.tag === "weak"; }).length,
        fromEtc: 0
      };
    }

    function tile(label, value, sub) {
      return '<div class="card stat"><span class="stat-label">' + App.esc(label) +
             '</span><span class="stat-value">' + App.esc(value) +
             '</span><span class="stat-sub">' + App.esc(sub) + "</span></div>";
    }

    function wire(preview) {
      var cnt = App.$("#cnt", mount);
      if (cnt) {
        cnt.addEventListener("change", function () {
          count = Math.max(1, Math.min(60, Number(cnt.value) || 10));
          draw();
        });
      }

      var share = App.$("#share", mount);
      if (share) {
        share.addEventListener("change", function () {
          wrongShare = Number(share.value);
          draw();
        });
      }

      var re = App.$("#reshuffle", mount);
      if (re) re.addEventListener("click", draw);

      /* 체크박스는 보여 주기만 하고(pointer-events:none), 실제 토글은 행 클릭으로 처리한다 */
      App.on(mount, "[data-pick]", function (ev, el) {
        var k = el.getAttribute("data-pick");
        if (picked.has(k)) picked.delete(k); else picked.add(k);
        draw();
      });

      var all = App.$("#pickAll", mount);
      if (all) all.addEventListener("click", function () {
        picked = new Set(App.weakUnits(MIN_TOTAL).map(function (w) { return w.subject + "::" + w.unit; }));
        draw();
      });

      var none = App.$("#pickNone", mount);
      if (none) none.addEventListener("click", function () { picked = new Set(); draw(); });

      var top3 = App.$("#pickTop3", mount);
      if (top3) top3.addEventListener("click", function () {
        picked = new Set(App.weakUnits(MIN_TOTAL).slice(0, 3).map(function (w) { return w.subject + "::" + w.unit; }));
        draw();
      });

      /* 미리보기에서 이미 뽑아 둔 목록을 그대로 낸다 (미리보기와 실제가 달라지지 않게) */
      var start = App.$("#startBtn", mount);
      if (start) start.addEventListener("click", function () {
        QuizEngine.run(mount, {
          title: "약점 보완 퀴즈",
          desc: "틀렸던 문제 " + preview.fromWrong + "개 · 약점 단원의 다른 문제 " + preview.fromWeak + "개",
          questions: preview.list,
          backHash: "#/weakness"
        });
      });
    }

    draw();
  }
});
