/* ============================================================
   공부 계획 · 진도
   ------------------------------------------------------------
   과목마다 두 가지를 관리한다.
     1) 공부 계획  — "교재 3장 읽기", "필기 정리" 같은 할 일
     2) 단원 진도  — 단원 체크리스트와 진도율
   과목 · 단원 추가도 이 화면에서 한다.
   ============================================================ */

App.register("plan", {
  render: function (mount) {

    var openSubject = null;     // 단원 목록을 펼쳐 둔 과목
    var addingUnitTo = null;    // 단원 추가 입력창을 연 과목
    var addingMatTo = null;     // 자료 추가 폼을 연 단원 ("과목::단원")
    var showAddSubject = false;

    function draw() {
      var CUR   = Store.curriculum();
      var prog  = Store.getProgress();
      var plans = Store.getPlans();

      var stats = {};
      App.unitStats().forEach(function (e) { stats[e.subject + "::" + e.unit] = e; });

      var bank = {};
      Store.allQuestions().forEach(function (q) {
        var k = q.subject + "::" + q.unit;
        bank[k] = (bank[k] || 0) + 1;
      });

      var totalUnits = 0, doneUnits = 0;
      CUR.forEach(function (c) {
        c.units.forEach(function (u) {
          totalUnits++;
          if (prog[c.name + "::" + u]) doneUnits++;
        });
      });

      /* 과목별 시험 D-day */
      var examBySubject = {};
      Store.getSchedule().forEach(function (s) {
        if (s.kind !== "exam" || s.done || !s.subject) return;
        var n = App.daysUntil(s.date);
        if (n === null || n < 0) return;
        if (!examBySubject[s.subject] || n < examBySubject[s.subject].n) {
          examBySubject[s.subject] = { n: n, date: s.date };
        }
      });

      var html =
        '<div class="page-head">' +
          "<h1>공부 계획 · 진도</h1>" +
          "<p>과목마다 할 일을 적고, 다 본 단원은 체크하세요.</p>" +
        "</div>" +

        /* ---- 전체 요약 ---- */
        '<div class="card">' +
          '<div class="section-head" style="margin-top:0"><h2>전체 진도</h2>' +
            '<span class="hint">' + doneUnits + " / " + totalUnits + " 단원 · 계획 " +
            plans.filter(function (p) { return p.done; }).length + " / " + plans.length + "</span></div>" +
          '<div class="bar ' + (totalUnits && doneUnits === totalUnits ? "ok" : "") + '">' +
            '<i style="width:' + App.pct(doneUnits, totalUnits) + '%"></i></div>' +
          '<div class="stat-sub mt-1">' + App.pct(doneUnits, totalUnits) + "% 완료</div>" +
        "</div>";

      /* ---- 과목별 상세 ---- */
      CUR.forEach(function (c) {
        var dn = c.units.filter(function (u) { return prog[c.name + "::" + u]; }).length;
        var p  = App.pct(dn, c.units.length);
        var myPlans = plans.filter(function (x) { return x.subject === c.name; });
        var planDone = myPlans.filter(function (x) { return x.done; }).length;
        var isOpen = openSubject === c.name;
        var ex = examBySubject[c.name];

        html +=
          '<div class="section-head">' +
            "<h2>" + App.esc(c.name) + "</h2>" +
            '<span class="hint">계획 ' + planDone + " / " + myPlans.length + "</span>" +
          "</div>" +

          '<div class="card">' +

            /* 이 과목의 진도율 — 과목 카드 맨 위 */
            '<div class="subj-top">' +
              '<div class="subj-top-main">' +
                '<div class="subj-top-name">' + App.esc(c.name) +
                  (ex ? ' <span class="badge ' +
                        (ex.n <= 3 ? "badge-bad" : ex.n <= 7 ? "badge-warn" : "badge-acc") +
                        '">' + App.ddayText(ex.date) + "</span>" : "") + "</div>" +
                segBar(c, prog, p) +
                '<div class="stat-sub">' + dn + " / " + c.units.length + " 단원 완료" +
                  (dn < c.units.length
                    ? ' <span class="muted">· 남은 ' + (c.units.length - dn) + "개</span>"
                    : "") + "</div>" +
              "</div>" +
              '<div class="subj-top-pct' + (p === 100 ? " done" : "") + '">' + p + "%</div>" +
            "</div>" +

            '<hr class="sep">' +

            /* 공부 계획 */
            '<div class="plan-head">' +
              "<strong>공부 계획</strong>" +
              '<span class="small muted">교재 읽기, 필기 정리, 기출 풀기 등 무엇이든</span>' +
            "</div>" +

            (myPlans.length
              ? '<div class="list">' + myPlans.map(function (x) {
                  return '<div class="row' + (x.done ? " done" : "") + '">' +
                    '<div class="row-side" style="align-self:center">' +
                      '<input type="checkbox" data-plan="' + App.esc(x.id) + '"' +
                        (x.done ? " checked" : "") + ">" +
                    "</div>" +
                    '<div class="row-main"><div class="row-title">' + App.esc(x.title) + "</div></div>" +
                    '<div class="row-side">' +
                      '<button class="btn btn-sm btn-danger" data-plan-del="' + App.esc(x.id) +
                        '" type="button">삭제</button>' +
                    "</div>" +
                  "</div>";
                }).join("") + "</div>"
              : '<div class="empty" style="padding:16px">아직 계획이 없습니다.</div>') +

            '<div class="add-row mt-1">' +
              '<input type="text" data-plan-input="' + App.esc(c.name) +
                '" placeholder="할 일을 적고 Enter — 예) 교재 3장 정독, 필기 정리, 기출 2개년">' +
              '<button class="btn btn-primary" data-plan-add="' + App.esc(c.name) +
                '" type="button">추가</button>' +
            "</div>" +

            '<hr class="sep">' +

            /* 단원 진도 */
            '<div class="plan-head">' +
              "<strong>단원 진도</strong>" +
              '<button class="btn btn-sm btn-ghost" data-toggle-units="' + App.esc(c.name) +
                '" type="button">' + (isOpen ? "접기" : "펼치기 (" + c.units.length + "개 단원)") + "</button>" +
            "</div>" +
            (isOpen ? unitList(c, prog, stats, bank) : "") +

          "</div>";
      });

      /* ---- 과목 추가 ---- */
      html +=
        '<div class="section-head"><h2>과목 · 단원 관리</h2></div>' +
        '<div class="card">' +
          (showAddSubject
            ? '<div class="form-grid">' +
                '<label class="field">과목 이름' +
                  '<input type="text" id="newSubject" placeholder="예) 선박운용술"></label>' +
                '<label class="field">단원 <span class="opt">(쉼표로 구분, 나중에 추가해도 됩니다)</span>' +
                  '<input type="text" id="newUnits" placeholder="조선 이론, 이접안, 황천 조선"></label>' +
              "</div>" +
              '<div class="btn-row mt-2">' +
                '<button class="btn btn-primary" id="addSubjectBtn" type="button">과목 추가</button>' +
                '<button class="btn btn-ghost" id="cancelSubject" type="button">취소</button>' +
              "</div>"
            : '<div class="btn-row">' +
                '<button class="btn btn-primary" id="showAddSubject" type="button">＋ 과목 추가</button>' +
              "</div>") +

          '<div class="list mt-2">' +
            CUR.map(function (c) {
              return '<div class="row">' +
                '<div class="row-main">' +
                  '<div class="row-title">' + App.esc(c.name) +
                    (c.custom ? ' <span class="badge badge-acc">내가 추가</span>' : "") + "</div>" +
                  '<div class="row-sub">' + c.units.length + "개 단원 · " +
                    App.esc(c.units.join(", ")) + "</div>" +
                "</div>" +
                '<div class="row-side">' +
                  '<button class="btn btn-sm" data-add-unit="' + App.esc(c.name) +
                    '" type="button">＋ 단원</button>' +
                  (c.custom
                    ? '<button class="btn btn-sm btn-danger" data-del-subject="' + App.esc(c.name) +
                      '" type="button">과목 삭제</button>'
                    : "") +
                "</div>" +
              "</div>" +
              (addingUnitTo === c.name
                ? '<div class="add-row" style="padding:0 0 12px">' +
                    '<input type="text" class="unit-input" placeholder="단원 이름을 적고 Enter">' +
                    '<button class="btn btn-primary" data-save-unit="' + App.esc(c.name) +
                      '" type="button">추가</button>' +
                  "</div>"
                : "");
            }).join("") +
          "</div>" +
        "</div>";

      /* ---- 이름이 어긋난 문제 경고 ---- */
      var orphans = Store.orphanQuestions();
      if (orphans.length) {
        html += '<div class="callout callout-warn mt-3">' +
          "<strong>과목 · 단원 이름이 목록과 다른 문제가 " + orphans.length + "개 있습니다.</strong><br>" +
          "이 문제들은 출제는 되지만 단원별 정답률과 약점 분석에서는 빠집니다. " +
          "위에서 해당 이름의 단원을 추가하거나, 문제 쪽 이름을 고쳐 주세요.<br>" +
          orphans.slice(0, 5).map(function (q) {
            return '<span class="mono">' + App.esc(q.subject + " · " + q.unit) + "</span>";
          }).join(" / ") +
          (orphans.length > 5 ? " 외 " + (orphans.length - 5) + "개" : "") +
        "</div>";
      }

      mount.innerHTML = html;
      wire();
    }

    /* ---------- 칸 나눈 진도 막대 ----------
       단원 하나가 네모칸 하나다. 다 본 단원은 칠해진다.
       칸을 누르면 그 단원 체크가 바로 켜지고 꺼진다. */

    function segBar(c, prog, p) {
      if (!c.units.length) {
        return '<div class="seg-empty">단원이 없습니다. 아래에서 추가하세요.</div>';
      }

      /* 단원 수가 적으면 칸이 몇 개 안 돼서 휑해 보인다.
         단원 하나를 여러 칸으로 쪼개 전체가 24칸쯤 되게 맞춘다.
         단원끼리는 사이를 더 띄워서 어디까지가 한 단원인지 보이게 한다. */
      var per = Math.round(24 / c.units.length);
      per = Math.max(1, Math.min(6, per));

      return '<div class="seg' + (p === 100 ? " full" : "") + '">' +
        c.units.map(function (u) {
          var key  = c.name + "::" + u;
          var done = !!prog[key];
          var tip  = App.esc(u) + " — " + (done ? "완료" : "아직");
          var cells = "";
          for (var i = 0; i < per; i++) {
            cells += '<button class="seg-cell' + (done ? " on" : "") +
                     '" data-unit-seg="' + App.esc(key) + '" type="button" title="' + tip + '"></button>';
          }
          return '<span class="seg-group">' + cells + "</span>";
        }).join("") +
      "</div>";
    }

    /* ---------- 단원 목록 ---------- */

    function unitList(c, prog, stats, bank) {
      return '<div class="list mt-1">' + c.units.map(function (u) {
        var key  = c.name + "::" + u;
        var done = !!prog[key];
        var st   = stats[key];
        var have = bank[key] || 0;
        var mats = Store.getMaterials(c.name, u);

        var acc = st
          ? '<span class="badge ' + (st.rate >= 80 ? "badge-ok" : st.rate >= 60 ? "badge-warn" : "badge-bad") +
            '">정답률 ' + st.rate + "%</span>"
          : '<span class="badge">미측정</span>';

        return '<div class="row' + (done ? " done" : "") + '" style="flex-wrap:wrap">' +
          '<div class="row-side" style="align-self:center">' +
            '<input type="checkbox" data-unit="' + App.esc(key) + '"' + (done ? " checked" : "") + ">" +
          "</div>" +
          '<div class="row-main">' +
            '<div class="row-title">' + App.esc(u) + "</div>" +
            '<div class="row-sub">문제 ' + have + "개" +
              (st ? " · " + st.total + "회 풀이 · 오답 " + st.wrong + "회" : " · 아직 안 풂") +
              (mats.length ? " · 자료 " + mats.length + "개" : "") + "</div>" +
          "</div>" +
          '<div class="row-side">' + acc +
            (have ? '<button class="btn btn-sm btn-ghost" data-quiz="' + App.esc(key) +
                    '" type="button" title="이 단원 문제를 지금 풀어 봅니다">풀기</button>' : "") +
            '<button class="btn btn-sm btn-ghost" data-add-mat="' + App.esc(key) +
              '" type="button" title="이 단원의 PDF·필기 링크 추가">＋ 자료</button>' +
            (Store.isCustomUnit(c.name, u)
              ? '<button class="btn btn-sm btn-danger" data-del-unit="' + App.esc(key) +
                '" type="button">삭제</button>'
              : "") +
          "</div>" +

          /* 이 단원에 걸어 둔 자료 */
          (mats.length
            ? '<div class="mat-row">' + mats.map(function (m) {
                return '<span class="mat">' +
                  '<a href="' + App.esc(m.path) + '" target="_blank" rel="noopener" title="' +
                    App.esc(m.path) + '">' + App.esc(m.label) + "</a>" +
                  '<button data-del-mat="' + App.esc(key + "||" + m.id) +
                    '" type="button" title="링크 지우기">×</button>' +
                "</span>";
              }).join("") + "</div>"
            : "") +

          /* 자료 추가 폼 */
          (addingMatTo === key
            ? '<div class="mat-form">' +
                '<div class="form-grid">' +
                  '<label class="field">보이는 이름 <span class="opt">(비우면 파일명)</span>' +
                    '<input type="text" id="matLabel" placeholder="예) 항해학 1장 강의자료"></label>' +
                  '<label class="field">파일 경로 또는 주소' +
                    '<input type="text" id="matPath" placeholder="자료/항해학_1장.pdf"></label>' +
                "</div>" +
                '<div class="btn-row mt-1">' +
                  '<button class="btn btn-primary btn-sm" data-save-mat="' + App.esc(key) +
                    '" type="button">자료 추가</button>' +
                  '<button class="btn btn-ghost btn-sm" id="cancelMat" type="button">취소</button>' +
                "</div>" +
                '<p class="small muted mt-1">' +
                  "PDF 를 <span class=\"mono\">시험대비_사이트/자료/</span> 폴더에 넣고 " +
                  "<span class=\"mono\">자료/파일명.pdf</span> 로 적는 걸 권합니다. " +
                  "파일 탐색기에서 <strong>Shift+우클릭 → 경로로 복사</strong> 한 전체 경로나, " +
                  "구글 드라이브 같은 웹 주소도 됩니다." +
                "</p>" +
              "</div>"
            : "") +
        "</div>";
      }).join("") + "</div>" +

      /* 단원 목록 바로 아래에서도 단원을 추가할 수 있게 */
      (addingUnitTo === c.name
        ? '<div class="add-row mt-1">' +
            '<input type="text" class="unit-input" placeholder="단원 이름을 적고 Enter">' +
            '<button class="btn btn-primary" data-save-unit="' + App.esc(c.name) +
              '" type="button">추가</button>' +
          "</div>"
        : '<div class="btn-row mt-1">' +
            '<button class="btn btn-sm" data-add-unit="' + App.esc(c.name) +
              '" type="button">＋ 단원 추가</button>' +
          "</div>");
    }

    /* ---------- 이벤트 ---------- */

    function wire() {

      /* 공부 계획 */
      App.onChange(mount, "[data-plan]", function (ev, cb) {
        Store.togglePlan(cb.getAttribute("data-plan"));
        draw();
      });

      App.on(mount, "[data-plan-del]", function (ev, el) {
        Store.deletePlan(el.getAttribute("data-plan-del"));
        draw();
      });

      function addPlanFrom(subject) {
        var input = App.$('[data-plan-input="' + cssEsc(subject) + '"]', mount);
        if (!input) return;
        var t = input.value.trim();
        if (!t) { input.focus(); return; }
        Store.addPlan(subject, t);
        openSubject = openSubject;      // 펼침 상태 유지
        draw();
        var next = App.$('[data-plan-input="' + cssEsc(subject) + '"]', mount);
        if (next) next.focus();
      }

      App.on(mount, "[data-plan-add]", function (ev, el) {
        addPlanFrom(el.getAttribute("data-plan-add"));
      });

      App.$$("[data-plan-input]", mount).forEach(function (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          addPlanFrom(input.getAttribute("data-plan-input"));
        });
      });

      /* 단원 진도 */
      App.on(mount, "[data-toggle-units]", function (ev, el) {
        var name = el.getAttribute("data-toggle-units");
        openSubject = (openSubject === name) ? null : name;
        draw();
      });

      App.onChange(mount, "[data-unit]", function (ev, cb) {
        var parts = cb.getAttribute("data-unit").split("::");
        Store.toggleProgress(parts[0], parts[1]);
        draw();
      });

      /* 진도 막대의 칸을 눌러도 체크된다 */
      App.on(mount, "[data-unit-seg]", function (ev, el) {
        var parts = el.getAttribute("data-unit-seg").split("::");
        Store.toggleProgress(parts[0], parts[1]);
        draw();
      });

      App.on(mount, "[data-quiz]", function (ev, el) {
        var parts = el.getAttribute("data-quiz").split("::");
        var list = App.shuffle(Store.allQuestions().filter(function (q) {
          return q.subject === parts[0] && q.unit === parts[1];
        }));
        QuizEngine.run(mount, {
          title: parts[1],
          desc: parts[0] + " · 이 단원 전체 " + list.length + "문제",
          questions: list,
          backHash: "#/plan"
        });
      });

      /* 과목 추가 */
      var showBtn = App.$("#showAddSubject", mount);
      if (showBtn) showBtn.addEventListener("click", function () { showAddSubject = true; draw(); });

      var cancel = App.$("#cancelSubject", mount);
      if (cancel) cancel.addEventListener("click", function () { showAddSubject = false; draw(); });

      var addBtn = App.$("#addSubjectBtn", mount);
      if (addBtn) {
        var doAdd = function () {
          var name = App.$("#newSubject", mount).value;
          var units = App.$("#newUnits", mount).value
            .split(",").map(function (s) { return s.trim(); }).filter(Boolean);
          var err = Store.addSubject(name, units);
          if (err) { App.toast(err); return; }
          App.toast("과목을 추가했습니다");
          showAddSubject = false;
          draw();
        };
        addBtn.addEventListener("click", doAdd);
        App.$("#newSubject", mount).addEventListener("keydown", function (e) {
          if (e.key === "Enter" && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); doAdd(); }
        });
      }

      App.on(mount, "[data-del-subject]", function (ev, el) {
        var name = el.getAttribute("data-del-subject");
        if (!confirm("과목 \"" + name + "\" 을(를) 목록에서 지울까요?\n\n" +
                     "이 과목으로 만든 문제와 기록은 지워지지 않습니다.")) return;
        Store.removeSubject(name);
        if (openSubject === name) openSubject = null;
        draw();
      });

      /* ---- 단원 자료 (PDF · 필기 링크) ---- */

      App.on(mount, "[data-add-mat]", function (ev, el) {
        var key = el.getAttribute("data-add-mat");
        addingMatTo = (addingMatTo === key) ? null : key;
        draw();
        var input = App.$("#matPath", mount);
        if (input) input.focus();
      });

      var cancelMat = App.$("#cancelMat", mount);
      if (cancelMat) cancelMat.addEventListener("click", function () { addingMatTo = null; draw(); });

      App.on(mount, "[data-save-mat]", function (ev, el) {
        saveMaterial(el.getAttribute("data-save-mat"));
      });

      var matPath = App.$("#matPath", mount);
      if (matPath) {
        matPath.addEventListener("keydown", function (e) {
          if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          saveMaterial(addingMatTo);
        });
      }

      function saveMaterial(key) {
        if (!key) return;
        var parts = key.split("::");
        var label = App.$("#matLabel", mount).value;
        var path  = App.$("#matPath", mount).value;
        var err = Store.addMaterial(parts[0], parts[1], label, path);
        if (err) { App.toast(err); return; }
        App.toast("자료를 추가했습니다");
        addingMatTo = null;
        draw();
      }

      App.on(mount, "[data-del-mat]", function (ev, el) {
        var parts = el.getAttribute("data-del-mat").split("||");
        var unitKey = parts[0].split("::");
        Store.deleteMaterial(unitKey[0], unitKey[1], parts[1]);
        draw();
      });

      /* 단원 추가 · 삭제 */
      App.on(mount, "[data-add-unit]", function (ev, el) {
        var name = el.getAttribute("data-add-unit");
        addingUnitTo = (addingUnitTo === name) ? null : name;
        if (addingUnitTo) openSubject = name;      // 단원 목록도 같이 펼쳐 준다
        draw();
        var input = App.$(".unit-input", mount);
        if (input) input.focus();
      });

      /* 단원 입력칸은 두 곳(단원 목록 아래 · 과목 관리)에 나올 수 있다.
         눌린 버튼과 같은 줄에 있는 입력칸을 읽는다. */
      App.on(mount, "[data-save-unit]", function (ev, el) {
        var box = el.closest(".add-row");
        saveUnit(el.getAttribute("data-save-unit"), box && box.querySelector(".unit-input"));
      });

      App.$$(".unit-input", mount).forEach(function (input) {
        input.addEventListener("keydown", function (e) {
          if (e.key !== "Enter" || e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          saveUnit(addingUnitTo, input);
        });
      });

      function saveUnit(subject, input) {
        if (!input) return;
        var err = Store.addUnit(subject, input.value);
        if (err) { App.toast(err); return; }
        App.toast("단원을 추가했습니다");
        draw();
        var again = App.$(".unit-input", mount);
        if (again) again.focus();
      }

      App.on(mount, "[data-del-unit]", function (ev, el) {
        var parts = el.getAttribute("data-del-unit").split("::");
        if (!confirm("단원 \"" + parts[1] + "\" 을(를) 목록에서 지울까요?")) return;
        Store.removeUnit(parts[0], parts[1]);
        draw();
      });
    }

    /* 속성 선택자에 넣기 위한 최소 이스케이프 */
    function cssEsc(s) { return String(s).replace(/["\\]/g, "\\$&"); }

    draw();
  }
});
