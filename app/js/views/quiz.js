/* ============================================================
   QuizEngine — 문제 풀이 세션 엔진 (모든 유형 처리)
   그리고 "문제 풀기" 화면
   ============================================================ */

var QuizEngine = (function () {

  var S = null;   // 현재 세션 상태

  /* 단답형 채점용 정규화: 공백·문장부호 제거, 소문자화 */
  function norm(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[.,·、。!?！？'"“”‘’()\[\]{}\-_/\\]/g, "");
  }

  function shortIsCorrect(q, input) {
    var cands = [q.answer].concat(q.altAnswers || []);
    var got = norm(input);
    if (!got) return false;
    for (var i = 0; i < cands.length; i++) {
      if (norm(cands[i]) === got) return true;
    }
    return false;
  }

  function diffBadge(d) {
    return '<span class="badge">난이도 ' + App.DIFF_LABEL[d] + "</span>";
  }

  /* ---------- 세션 시작 ---------- */

  function run(mount, opts) {
    S = {
      mount: mount,
      title: opts.title || "문제 풀기",
      desc: opts.desc || "",
      backHash: opts.backHash || "#/quiz",
      questions: opts.questions || [],
      i: 0,
      results: [],          // {q, correct}
      answered: false,
      record: opts.record !== false      // 기본으로 기록을 남긴다
    };
    if (!S.questions.length) {
      mount.innerHTML =
        '<div class="page-head"><h1>' + App.esc(S.title) + "</h1></div>" +
        '<div class="card"><div class="empty">조건에 맞는 문제가 없습니다.<br>' +
        '필터를 넓히거나 [문제 추가 · 편집]에서 문제를 더 넣어 주세요.</div>' +
        '<div class="btn-row" style="justify-content:center"><a class="btn" href="' +
        App.esc(S.backHash) + '">돌아가기</a></div></div>';
      return;
    }
    drawQuestion();
  }

  /* ---------- 문제 화면 ---------- */

  function drawQuestion() {
    var q = S.questions[S.i];
    S.answered = false;
    S.shownBack = false;

    var head =
      '<div class="page-head">' +
        "<h1>" + App.esc(S.title) + "</h1>" +
        (S.desc ? "<p>" + App.esc(S.desc) + "</p>" : "") +
      "</div>" +
      '<div class="quiz-top">' +
        '<div class="quiz-meta">' +
          '<span class="badge badge-acc">' + App.esc(q.subject) + "</span>" +
          '<span class="badge">' + App.esc(q.unit) + "</span>" +
          '<span class="badge">' + App.TYPE_LABEL[q.type] + "</span>" +
          diffBadge(q.difficulty) +
        "</div>" +
        '<div class="quiz-progress">' + (S.i + 1) + " / " + S.questions.length + "</div>" +
      "</div>" +
      '<div class="bar" style="margin-bottom:16px"><i style="width:' +
        App.pct(S.i, S.questions.length) + '%"></i></div>';

    var body = '<div class="card card-pad-lg">' +
               '<div class="q-prompt">' + App.esc(q.prompt) + "</div>" +
               bodyFor(q) +
               '<div id="feedback"></div>' +
               "</div>" +
               '<div class="btn-row mt-2">' +
                 '<a class="btn btn-ghost btn-sm" href="' + App.esc(S.backHash) + '">그만두기</a>' +
               "</div>";

    S.mount.innerHTML = head + body;
    wire(q);
  }

  function bodyFor(q) {
    if (q.type === "mcq") {
      /* 보기 순서를 섞되 원래 인덱스를 기억한다 */
      S.order = App.shuffle(q.choices.map(function (_, i) { return i; }));
      return '<div class="choices" id="choices">' +
        S.order.map(function (orig, pos) {
          return '<button class="choice" data-orig="' + orig + '" type="button">' +
                   '<span class="idx">' + (pos + 1) + "</span>" +
                   "<span>" + App.esc(q.choices[orig]) + "</span>" +
                 "</button>";
        }).join("") + "</div>";
    }

    if (q.type === "ox") {
      return '<div class="ox-row" id="choices">' +
        '<button class="choice" data-ox="true" type="button">O</button>' +
        '<button class="choice" data-ox="false" type="button">X</button>' +
        "</div>";
    }

    if (q.type === "flash") {
      return '<div class="flash" id="flashCard">뒷면을 확인하려면 아래 버튼을 누르세요</div>' +
             '<div class="btn-row mt-2"><button class="btn btn-primary btn-block" id="flipBtn" type="button">뒷면 보기</button></div>';
    }

    if (q.type === "short") {
      return '<label class="field">답</label>' +
             '<input type="text" id="shortInput" placeholder="답을 입력하고 Enter" autocomplete="off">' +
             '<div class="btn-row mt-2"><button class="btn btn-primary" id="submitShort" type="button">제출</button>' +
             '<button class="btn btn-ghost" id="giveUpShort" type="button">모르겠음</button></div>';
    }

    if (q.type === "essay") {
      return '<label class="field">답안 작성 (자가 채점용 · 저장되지 않습니다)</label>' +
             '<textarea id="essayInput" rows="7" placeholder="여기에 직접 써 보세요"></textarea>' +
             '<div class="btn-row mt-2"><button class="btn btn-primary" id="showModel" type="button">모범답안 · 채점표 보기</button></div>';
    }

    return "";
  }

  /* ---------- 이벤트 연결 ---------- */

  function wire(q) {
    var m = S.mount;

    if (q.type === "mcq") {
      App.on(m, "#choices .choice", function (ev, btn) {
        if (S.answered) return;
        gradeMcq(q, Number(btn.getAttribute("data-orig")));
      });
    }

    if (q.type === "ox") {
      App.on(m, "#choices .choice", function (ev, btn) {
        if (S.answered) return;
        gradeOx(q, btn.getAttribute("data-ox") === "true");
      });
    }

    if (q.type === "flash") {
      App.$("#flipBtn", m).addEventListener("click", function () { flipFlash(q); });
    }

    if (q.type === "short") {
      var input = App.$("#shortInput", m);
      input.focus();
      input.addEventListener("keydown", function (e) {
        /* isComposing: 한글 입력 중 조합을 끝내는 Enter 는 제출로 보지 않는다 */
        if (e.key !== "Enter" || e.isComposing || e.keyCode === 229 || S.answered) return;
        e.preventDefault();
        gradeShort(q, input.value);
      });
      App.$("#submitShort", m).addEventListener("click", function () {
        if (!S.answered) gradeShort(q, input.value);
      });
      App.$("#giveUpShort", m).addEventListener("click", function () {
        if (!S.answered) gradeShort(q, "");
      });
    }

    if (q.type === "essay") {
      App.$("#showModel", m).addEventListener("click", function () { showEssayModel(q); });
    }
  }

  /* ---------- 채점 ---------- */

  function gradeMcq(q, chosen) {
    S.answered = true;
    var correct = chosen === q.answer;
    App.$$("#choices .choice", S.mount).forEach(function (b) {
      var orig = Number(b.getAttribute("data-orig"));
      b.disabled = true;
      if (orig === q.answer) b.classList.add("correct");
      else if (orig === chosen) b.classList.add("wrong");
    });
    finish(q, correct);
  }

  function gradeOx(q, chosen) {
    S.answered = true;
    var correct = chosen === q.answer;
    App.$$("#choices .choice", S.mount).forEach(function (b) {
      var v = b.getAttribute("data-ox") === "true";
      b.disabled = true;
      if (v === q.answer) b.classList.add("correct");
      else if (v === chosen) b.classList.add("wrong");
    });
    finish(q, correct);
  }

  function gradeShort(q, value) {
    S.answered = true;
    var correct = shortIsCorrect(q, value);
    var input = App.$("#shortInput", S.mount);
    input.disabled = true;
    App.$("#submitShort", S.mount).disabled = true;
    App.$("#giveUpShort", S.mount).disabled = true;

    var extra = '<div class="explain"><strong>정답:</strong> ' + App.esc(q.answer) +
      (q.altAnswers && q.altAnswers.length
        ? '<br><span class="small muted">허용 표기: ' + q.altAnswers.map(App.esc).join(", ") + "</span>"
        : "") +
      (value ? '<br><span class="small muted">내 답: ' + App.esc(value) + "</span>" : "") +
      "</div>";
    finish(q, correct, extra);
  }

  function flipFlash(q) {
    if (S.shownBack) return;
    S.shownBack = true;
    var card = App.$("#flashCard", S.mount);
    card.textContent = q.answer;
    card.classList.add("flash-back");
    App.$("#flipBtn", S.mount).outerHTML =
      '<button class="btn btn-primary" id="fKnow" type="button">알았음</button>' +
      '<button class="btn btn-danger" id="fMiss" type="button">헷갈림 · 다시 볼 것</button>';
    App.$("#fKnow", S.mount).addEventListener("click", function () { gradeFlash(q, true); });
    App.$("#fMiss", S.mount).addEventListener("click", function () { gradeFlash(q, false); });
  }

  function gradeFlash(q, known) {
    if (S.answered) return;
    S.answered = true;
    App.$("#fKnow", S.mount).disabled = true;
    App.$("#fMiss", S.mount).disabled = true;
    finish(q, known);
  }

  function showEssayModel(q) {
    var kws = q.keywords || [];
    var html =
      '<hr class="sep">' +
      "<h2 style=\"font-size:14px;margin:0 0 8px\">모범답안</h2>" +
      '<div class="explain">' + App.esc(q.answer) + "</div>" +
      (kws.length
        ? '<h2 style="font-size:14px;margin:18px 0 4px">채점표 — 내 답안에 들어간 것에 체크</h2>' +
          '<p class="small muted mt-0">' + kws.length + "개 중 " + Math.ceil(kws.length * 0.6) +
          "개 이상이면 정답 처리해도 좋습니다.</p>" +
          '<div class="kw-list" id="kwList">' +
            kws.map(function (k, i) {
              return '<label class="kw-item"><input type="checkbox" data-kw="' + i + '"><span>' +
                     App.esc(k) + "</span></label>";
            }).join("") +
          "</div>" +
          '<div class="small muted mt-1" id="kwScore">체크 0 / ' + kws.length + "</div>"
        : "") +
      '<div class="btn-row mt-2">' +
        '<button class="btn btn-primary" id="eOk" type="button">맞았다고 기록</button>' +
        '<button class="btn btn-danger" id="eNo" type="button">틀렸다고 기록</button>' +
      "</div>";

    var slot = App.$("#feedback", S.mount);
    slot.innerHTML = html;
    App.$("#showModel", S.mount).disabled = true;
    App.$("#essayInput", S.mount).disabled = true;

    if (kws.length) {
      App.$("#kwList", S.mount).addEventListener("change", function () {
        var n = App.$$("#kwList input:checked", S.mount).length;
        App.$("#kwScore", S.mount).textContent = "체크 " + n + " / " + kws.length;
      });
    }
    App.$("#eOk", S.mount).addEventListener("click", function () { gradeEssay(q, true); });
    App.$("#eNo", S.mount).addEventListener("click", function () { gradeEssay(q, false); });
  }

  function gradeEssay(q, correct) {
    if (S.answered) return;
    S.answered = true;
    App.$("#eOk", S.mount).disabled = true;
    App.$("#eNo", S.mount).disabled = true;
    finish(q, correct, "", true);
  }

  /* ---------- 결과 표시 · 다음으로 ---------- */

  function finish(q, correct, extraHtml, append) {
    Store.addAttempt(q, correct);
    S.results.push({ q: q, correct: correct });

    var label = (q.type === "flash")
      ? (correct ? "알았음" : "다시 볼 것")
      : (correct ? "정답" : "오답");

    var html =
      '<div class="verdict ' + (correct ? "verdict-ok" : "verdict-bad") + '">' + label + "</div>" +
      (extraHtml || "") +
      App.explainHtml(q) +
      '<div class="btn-row mt-2">' +
        '<button class="btn btn-primary" id="nextBtn" type="button">' +
        (S.i + 1 < S.questions.length ? "다음 문제" : "결과 보기") + "</button>" +
      "</div>";

    var slot = App.$("#feedback", S.mount);
    if (append) slot.insertAdjacentHTML("beforeend", html);
    else slot.innerHTML = html;

    var btn = App.$("#nextBtn", S.mount);
    btn.addEventListener("click", next);
    btn.focus();
    App.refreshChrome();
  }

  function next() {
    S.i++;
    if (S.i < S.questions.length) drawQuestion();
    else drawResult();
  }

  /* ---------- 결과 화면 ---------- */

  function drawResult() {
    var graded = S.results.filter(function (r) { return r.q.type !== "flash"; });
    var right = graded.filter(function (r) { return r.correct; }).length;
    var rate = App.pct(right, graded.length);
    var missed = S.results.filter(function (r) { return !r.correct; });

    /* 나중에 같은 구성으로 다시 풀 수 있도록 문항 id 까지 남긴다 */
    if (S.record && S.results.length) {
      Store.addSession({
        title: S.title,
        desc: S.desc,
        qids: S.results.map(function (r) { return r.q.id; }),
        total: S.results.length,
        graded: graded.length,
        right: right
      });
      S.record = false;                  // 결과 화면을 다시 그려도 두 번 저장하지 않게
    }

    var html =
      '<div class="page-head"><h1>세션 완료</h1><p>' + App.esc(S.title) + "</p></div>" +
      '<div class="grid grid-3">' +
        tile("푼 문제", S.results.length + "문제", "") +
        tile("정답률", (graded.length ? rate + "%" : "—"),
             graded.length ? right + " / " + graded.length + " (플래시카드 제외)" : "채점 대상 없음") +
        tile("틀린 문제", missed.length + "개", missed.length ? "오답노트에 담겼습니다" : "완벽합니다") +
      "</div>";

    html += '<div class="section-head"><h2>문항별 결과</h2></div><div class="card"><div class="list">' +
      S.results.map(function (r) {
        return '<div class="row">' +
          '<div class="row-main">' +
            '<div class="row-title">' + App.esc(trim(r.q.prompt, 70)) + "</div>" +
            '<div class="row-sub">' + App.esc(r.q.subject) + " · " + App.esc(r.q.unit) +
              " · " + App.TYPE_LABEL[r.q.type] + " · 난이도 " + App.DIFF_LABEL[r.q.difficulty] + "</div>" +
          "</div>" +
          '<div class="row-side"><span class="badge ' + (r.correct ? "badge-ok" : "badge-bad") + '">' +
            (r.correct ? "O" : "X") + "</span></div>" +
        "</div>";
      }).join("") + "</div></div>";

    html += '<div class="btn-row mt-3">';
    if (missed.length) {
      html += '<button class="btn btn-primary" id="retryWrong" type="button">틀린 ' +
              missed.length + "문제만 다시 풀기</button>";
    }
    html += '<button class="btn" id="againBtn" type="button">같은 조건으로 새 세션</button>' +
            '<a class="btn btn-ghost" href="#/review">오답노트 보기</a>' +
            '<a class="btn btn-ghost" href="#/home">홈으로</a>' +
            "</div>";

    S.mount.innerHTML = html;

    if (missed.length) {
      App.$("#retryWrong", S.mount).addEventListener("click", function () {
        run(S.mount, {
          title: S.title + " — 오답 다시 풀기",
          desc: "방금 틀린 문제만 모았습니다",
          questions: App.shuffle(missed.map(function (r) { return r.q; })),
          backHash: S.backHash
        });
      });
    }
    /* App.go 는 지금 주소와 같아도 다시 그려 준다 */
    App.$("#againBtn", S.mount).addEventListener("click", function () {
      App.go(S.backHash);
    });
    App.refreshChrome();
  }

  function tile(label, value, sub) {
    return '<div class="card stat"><span class="stat-label">' + App.esc(label) +
           '</span><span class="stat-value">' + App.esc(value) +
           '</span><span class="stat-sub">' + App.esc(sub || "") + "</span></div>";
  }

  function trim(s, n) {
    s = String(s).replace(/\s+/g, " ");
    return s.length > n ? s.slice(0, n) + "…" : s;
  }

  return { run: run, shortIsCorrect: shortIsCorrect, trim: trim };
})();


/* ============================================================
   "문제 풀기" 화면 — 필터를 골라 세션을 시작
   ============================================================ */

App.register("quiz", {
  render: function (mount) {

    var openSession = null;     // 문항 목록을 펼쳐 둔 기록

    var sel = {
      subjects: new Set(),
      types: new Set(),
      diffs: new Set(),
      units: new Set(),
      count: 10,
      onlyUnseen: false
    };

    function pool() {
      return Store.allQuestions().filter(function (q) {
        if (sel.subjects.size && !sel.subjects.has(q.subject)) return false;
        if (sel.types.size    && !sel.types.has(q.type))       return false;
        if (sel.diffs.size    && !sel.diffs.has(q.difficulty)) return false;
        if (sel.units.size    && !sel.units.has(q.subject + "::" + q.unit)) return false;
        return true;
      });
    }

    function draw() {
      var CUR = Store.curriculum();
      var subjects = CUR.map(function (c) { return c.name; });
      var available = pool();

      /* 선택된 과목의 단원만 노출 (아무것도 안 고르면 전체) */
      var unitSource = CUR.filter(function (c) {
        return !sel.subjects.size || sel.subjects.has(c.name);
      });

      mount.innerHTML =
        '<div class="page-head">' +
          "<h1>문제 풀기</h1>" +
          "<p>조건을 고르고 시작하세요. 아무것도 안 고르면 전체에서 출제됩니다.</p>" +
        "</div>" +

        '<div class="card">' +
          '<div class="section-head" style="margin-top:0"><h2>과목</h2>' +
            '<span class="hint">복수 선택 가능</span></div>' +
          '<div class="chips" data-group="subject">' +
            subjects.map(function (s) {
              return '<button class="chip' + (sel.subjects.has(s) ? " on" : "") +
                     '" data-val="' + App.esc(s) + '" type="button">' + App.esc(s) + "</button>";
            }).join("") +
          "</div>" +

          '<div class="section-head"><h2>단원</h2>' +
            '<span class="hint">' + (sel.units.size ? sel.units.size + "개 선택됨" : "전체") + "</span></div>" +
          '<div class="chips" data-group="unit">' +
            unitSource.map(function (c) {
              return c.units.map(function (u) {
                var key = c.name + "::" + u;
                return '<button class="chip' + (sel.units.has(key) ? " on" : "") +
                       '" data-val="' + App.esc(key) + '" type="button">' + App.esc(u) + "</button>";
              }).join("");
            }).join("") +
          "</div>" +

          '<div class="section-head"><h2>유형</h2></div>' +
          '<div class="chips" data-group="type">' +
            App.TYPE_ORDER.map(function (t) {
              return '<button class="chip' + (sel.types.has(t) ? " on" : "") +
                     '" data-val="' + t + '" type="button">' + App.TYPE_LABEL[t] + "</button>";
            }).join("") +
          "</div>" +

          '<div class="section-head"><h2>난이도</h2></div>' +
          '<div class="chips" data-group="diff">' +
            [1, 2, 3].map(function (d) {
              return '<button class="chip' + (sel.diffs.has(d) ? " on" : "") +
                     '" data-val="' + d + '" type="button">' + App.DIFF_LABEL[d] + "</button>";
            }).join("") +
          "</div>" +

          '<hr class="sep">' +
          '<div class="form-grid">' +
            '<label class="field">문항 수' +
              '<input type="number" id="cnt" min="1" max="100" value="' + sel.count + '">' +
            "</label>" +
            '<label class="field">출제 대상' +
              '<select id="unseen">' +
                '<option value="0"' + (sel.onlyUnseen ? "" : " selected") + ">전체에서 무작위</option>" +
                '<option value="1"' + (sel.onlyUnseen ? " selected" : "") + ">아직 안 푼 문제 우선</option>" +
              "</select>" +
            "</label>" +
          "</div>" +

          '<div class="callout mt-2">조건에 맞는 문제 <strong>' + available.length +
            "개</strong>가 있습니다." +
            (available.length === 0 ? " 필터를 줄이거나 [문제 추가 · 편집]에서 문제를 넣어 주세요." : "") +
          "</div>" +

          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" id="startBtn" type="button"' +
              (available.length ? "" : " disabled") + ">시작하기</button>" +
            '<button class="btn btn-ghost" id="clearBtn" type="button">조건 초기화</button>' +
          "</div>" +
        "</div>" +

        historySection();

      /* ---- 지난 세션 다시 풀기 ---- */

      App.on(mount, "[data-replay]", function (ev, el) {
        var s = Store.getSessions().filter(function (x) {
          return x.id === el.getAttribute("data-replay");
        })[0];
        if (!s) return;

        var list = s.qids.map(function (id) { return Store.questionById(id); })
                         .filter(Boolean);
        if (!list.length) {
          App.toast("그때 풀었던 문제가 지금은 남아 있지 않습니다");
          return;
        }
        var lost = s.qids.length - list.length;
        QuizEngine.run(mount, {
          title: s.title + " (다시 풀기)",
          desc: App.fmtDate(App.dayKey(s.ts)) + "에 푼 구성" +
                (lost ? " · 삭제된 " + lost + "문제 제외" : ""),
          questions: list,
          backHash: "#/quiz"
        });
      });

      App.on(mount, "[data-replay-shuffle]", function (ev, el) {
        var s = Store.getSessions().filter(function (x) {
          return x.id === el.getAttribute("data-replay-shuffle");
        })[0];
        if (!s) return;
        var list = App.shuffle(s.qids.map(function (id) { return Store.questionById(id); })
                                     .filter(Boolean));
        if (!list.length) { App.toast("그때 풀었던 문제가 지금은 남아 있지 않습니다"); return; }
        QuizEngine.run(mount, {
          title: s.title + " (순서 섞어 다시)",
          desc: list.length + "문제",
          questions: list,
          backHash: "#/quiz"
        });
      });

      App.on(mount, "[data-sess-del]", function (ev, el) {
        Store.deleteSession(el.getAttribute("data-sess-del"));
        draw();
      });

      App.on(mount, "[data-sess-toggle]", function (ev, el) {
        var id = el.getAttribute("data-sess-toggle");
        openSession = (openSession === id) ? null : id;
        draw();
      });

      /* 칩 토글 */
      App.on(mount, ".chips .chip", function (ev, btn) {
        var group = btn.parentElement.getAttribute("data-group");
        var raw = btn.getAttribute("data-val");
        var val = (group === "diff") ? Number(raw) : raw;
        var set = { subject: sel.subjects, unit: sel.units, type: sel.types, diff: sel.diffs }[group];
        if (set.has(val)) set.delete(val); else set.add(val);
        /* 과목을 바꾸면 그 과목에 없는 단원 선택은 정리 */
        if (group === "subject" && sel.subjects.size) {
          Array.from(sel.units).forEach(function (k) {
            if (!sel.subjects.has(k.split("::")[0])) sel.units.delete(k);
          });
        }
        sel.count = Number(App.$("#cnt", mount).value) || 10;
        sel.onlyUnseen = App.$("#unseen", mount).value === "1";
        draw();
      });

      App.$("#clearBtn", mount).addEventListener("click", function () {
        sel.subjects.clear(); sel.units.clear(); sel.types.clear(); sel.diffs.clear();
        draw();
      });

      App.$("#startBtn", mount).addEventListener("click", function () {
        var n = Math.max(1, Number(App.$("#cnt", mount).value) || 10);
        var onlyUnseen = App.$("#unseen", mount).value === "1";
        var list = pool();

        if (onlyUnseen) {
          var seen = {};
          Store.getAttempts().forEach(function (a) { seen[a.qid] = true; });
          var fresh = list.filter(function (q) { return !seen[q.id]; });
          var rest  = list.filter(function (q) { return seen[q.id]; });
          list = App.shuffle(fresh).concat(App.shuffle(rest));
        } else {
          list = App.shuffle(list);
        }

        QuizEngine.run(mount, {
          title: "문제 풀기",
          desc: describe(),
          questions: list.slice(0, n),
          backHash: "#/quiz"
        });
      });

      /* ---------- 지난 세션 기록 ---------- */

      function historySection() {
        var sessions = Store.getSessions();

        var head = '<div class="section-head"><h2>지난 문제 풀기 기록</h2>' +
                   '<span class="hint">' +
                   (sessions.length ? sessions.length + "회" : "아직 없음") + "</span></div>";

        if (!sessions.length) {
          return head + '<div class="card"><div class="empty">' +
            "한 세션을 끝내면 여기에 남습니다.<br>" +
            "그때 나왔던 문제 구성 그대로 다시 풀 수 있습니다.</div></div>";
        }

        return head + '<div class="card"><div class="list">' +
          sessions.map(function (s) {
            var rate = s.graded ? App.pct(s.right, s.graded) : null;
            var cls = rate === null ? "" : rate >= 80 ? "badge-ok" : rate >= 60 ? "badge-warn" : "badge-bad";
            var isOpen = openSession === s.id;

            /* 지금도 남아 있는 문제만 다시 풀 수 있다 */
            var alive = s.qids.filter(function (id) { return Store.questionById(id); });

            return '<div class="row" style="flex-wrap:wrap">' +
              '<div class="row-main">' +
                '<div class="row-title">' + App.esc(s.title) +
                  (s.desc ? ' <span class="muted small">— ' + App.esc(s.desc) + "</span>" : "") + "</div>" +
                '<div class="row-sub">' + App.fmtDate(App.dayKey(s.ts)) + " " + hhmm(s.ts) +
                  " · " + s.total + "문제" +
                  (rate === null ? "" : " · " + s.right + " / " + s.graded + " 정답") +
                  (alive.length < s.qids.length
                    ? ' · <span class="muted">' + (s.qids.length - alive.length) + "문제는 삭제됨</span>"
                    : "") +
                "</div>" +
              "</div>" +
              '<div class="row-side">' +
                (rate === null
                  ? '<span class="badge">채점 없음</span>'
                  : '<span class="badge ' + cls + '">' + rate + "%</span>") +
                (alive.length
                  ? '<button class="btn btn-sm btn-primary" data-replay="' + s.id +
                      '" type="button">같은 구성으로</button>' +
                    '<button class="btn btn-sm" data-replay-shuffle="' + s.id +
                      '" type="button">순서 섞어</button>'
                  : "") +
                '<button class="btn btn-sm btn-ghost" data-sess-toggle="' + s.id +
                  '" type="button">' + (isOpen ? "접기" : "문항") + "</button>" +
                '<button class="btn btn-sm btn-danger" data-sess-del="' + s.id +
                  '" type="button">삭제</button>' +
              "</div>" +

              (isOpen
                ? '<div style="flex:1 1 100%" class="explain mt-1">' +
                    s.qids.map(function (id, i) {
                      var q = Store.questionById(id);
                      return (i + 1) + ". " + (q ? App.esc(QuizEngine.trim(q.prompt, 60)) : "(삭제된 문제)");
                    }).join("\n") +
                  "</div>"
                : "") +
            "</div>";
          }).join("") +
        "</div></div>";
      }

      function hhmm(ts) {
        var d = new Date(ts);
        return String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
      }

      function describe() {
        var parts = [];
        if (sel.subjects.size) parts.push(Array.from(sel.subjects).join(", "));
        if (sel.units.size)    parts.push(sel.units.size + "개 단원");
        if (sel.types.size)    parts.push(Array.from(sel.types).map(function (t) { return App.TYPE_LABEL[t]; }).join(", "));
        if (sel.diffs.size)    parts.push("난이도 " + Array.from(sel.diffs).map(function (d) { return App.DIFF_LABEL[d]; }).join(", "));
        return parts.length ? parts.join(" · ") : "전체 범위";
      }
    }

    draw();
  }
});
