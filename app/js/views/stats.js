/* ============================================================
   학습 통계 대시보드
   ============================================================ */

App.register("stats", {
  render: function (mount) {

    var ov       = App.overall();
    var attempts = Store.getAttempts();
    var series   = App.dailySeries(14);
    var units    = App.unitStats();

    if (!attempts.length) {
      mount.innerHTML =
        '<div class="page-head"><h1>학습 통계</h1><p>문제를 풀면 여기에 기록이 쌓입니다.</p></div>' +
        '<div class="card"><div class="empty">아직 기록이 없습니다.</div>' +
        '<div class="btn-row" style="justify-content:center">' +
        '<a class="btn btn-primary" href="#/quiz">문제 풀기로 가기</a></div></div>';
      return;
    }

    /* 오늘 · 이번 주 */
    var todayCount = series[series.length - 1].count;
    var weekCount  = series.slice(-7).reduce(function (a, b) { return a + b.count; }, 0);
    var maxDaily   = Math.max.apply(null, series.map(function (d) { return d.count; })) || 1;

    /* 플래시카드는 별도 집계 */
    var flashCount = attempts.filter(function (a) { return a.type === "flash"; }).length;

    var html =
      '<div class="page-head"><h1>학습 통계</h1>' +
      "<p>정답률 계산에서 플래시카드는 제외합니다 (자가 체크 방식이라서).</p></div>" +

      '<div class="grid grid-4">' +
        tile("전체 정답률", ov.rate + "%", ov.right + " / " + ov.total) +
        tile("오늘 푼 문제", todayCount + "개", "플래시카드 포함") +
        tile("최근 7일", weekCount + "개", "하루 평균 " + Math.round(weekCount / 7) + "개") +
        tile("플래시카드", flashCount + "회", "넘겨 본 횟수") +
      "</div>" +

      /* ---- 일별 ---- */
      '<div class="section-head"><h2>최근 14일 풀이량</h2>' +
        '<span class="hint">최대 ' + maxDaily + "개</span></div>" +
      '<div class="card">' +
        '<div class="spark">' +
          series.map(function (d) {
            var h = Math.max(2, Math.round((d.count / maxDaily) * 100));
            return '<i class="' + (d.count ? "" : "zero") + '" style="height:' + h +
                   '%" title="' + d.date + " · " + d.count + '개"></i>';
          }).join("") +
        "</div>" +
        '<div class="spark-labels">' +
          series.map(function (d) { return "<span>" + d.day + "</span>"; }).join("") +
        "</div>" +
      "</div>" +

      /* ---- 과목별 ---- */
      section("과목별 정답률", barBlock(App.groupStats("subject"))) +

      /* ---- 유형별 ---- */
      section("유형별 정답률", barBlock(
        App.groupStats("type").map(function (e) {
          return { key: App.TYPE_LABEL[e.key] || e.key, total: e.total, wrong: e.wrong, rate: e.rate };
        })
      )) +

      /* ---- 난이도별 ---- */
      section("난이도별 정답률", barBlock(
        App.groupStats("diff")
          .sort(function (a, b) { return a.key - b.key; })
          .map(function (e) {
            return { key: "난이도 " + (App.DIFF_LABEL[e.key] || e.key), total: e.total, wrong: e.wrong, rate: e.rate };
          })
      ));

    /* ---- 단원별 표 ---- */
    var sorted = units.slice().sort(function (a, b) { return a.rate - b.rate; });

    html += '<div class="section-head"><h2>단원별 상세</h2>' +
            '<span class="hint">정답률 낮은 순</span></div>' +
      '<div class="card"><div class="table-wrap"><table>' +
        "<thead><tr><th>과목</th><th>단원</th><th class=\"num\">푼 횟수</th>" +
        "<th class=\"num\">오답</th><th class=\"num\">정답률</th><th></th></tr></thead><tbody>" +
        sorted.map(function (e) {
          var cls = e.rate >= 80 ? "badge-ok" : e.rate >= 60 ? "badge-warn" : "badge-bad";
          return "<tr>" +
            "<td>" + App.esc(e.subject) + "</td>" +
            "<td>" + App.esc(e.unit) + "</td>" +
            '<td class="num">' + e.total + "</td>" +
            '<td class="num">' + e.wrong + "</td>" +
            '<td class="num"><span class="badge ' + cls + '">' + e.rate + "%</span></td>" +
            '<td class="num"><button class="btn btn-sm" data-quiz="' +
              App.esc(e.subject + "::" + e.unit) + '" type="button">풀기</button></td>' +
          "</tr>";
        }).join("") +
      "</tbody></table></div></div>";

    html += '<div class="btn-row mt-3">' +
              '<a class="btn btn-primary" href="#/weakness">약점 보완 퀴즈</a>' +
              '<a class="btn" href="#/review">오답노트</a>' +
              '<a class="btn btn-ghost" href="#/data">기록 백업 · 초기화</a>' +
            "</div>";

    mount.innerHTML = html;

    App.on(mount, "[data-quiz]", function (ev, el) {
      var p = el.getAttribute("data-quiz").split("::");
      var list = App.shuffle(Store.allQuestions().filter(function (q) {
        return q.subject === p[0] && q.unit === p[1];
      }));
      QuizEngine.run(mount, {
        title: p[1],
        desc: p[0] + " · " + list.length + "문제",
        questions: list,
        backHash: "#/stats"
      });
    });

    /* ---------- 조각 ---------- */

    function section(title, body) {
      return '<div class="section-head"><h2>' + App.esc(title) + "</h2></div>" +
             '<div class="card">' + body + "</div>";
    }

    function barBlock(rows) {
      if (!rows.length) return '<div class="empty">기록이 없습니다.</div>';
      return '<div class="hbars">' + rows.map(function (e) {
        var cls = e.rate >= 80 ? "ok" : e.rate >= 60 ? "" : "bad";
        return '<div class="hbar">' +
          '<span class="hbar-label" title="' + App.esc(e.key) + '">' + App.esc(e.key) + "</span>" +
          '<span class="bar ' + cls + '"><i style="width:' + e.rate + '%"></i></span>' +
          '<span class="hbar-val">' + e.rate + "% · " + e.total + "</span>" +
        "</div>";
      }).join("") + "</div>";
    }

    function tile(label, value, sub) {
      return '<div class="card stat"><span class="stat-label">' + App.esc(label) +
             '</span><span class="stat-value">' + App.esc(value) +
             '</span><span class="stat-sub">' + App.esc(sub) + "</span></div>";
    }
  }
});
