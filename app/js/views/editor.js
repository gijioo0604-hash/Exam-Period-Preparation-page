/* ============================================================
   문제 추가 · 편집
   ------------------------------------------------------------
   여기서 만든 문제는 브라우저에 저장됩니다 (내 문제).
   맨 아래 [코드로 내보내기]로 data/questions.js 에 옮겨 붙이면
   영구 보관되고 다른 기기에서도 쓸 수 있습니다.
   ============================================================ */

App.register("editor", {
  render: function (mount) {

    var editing = null;        // 편집 중인 문제 객체
    var type = "mcq";
    var listSubject = "";

    function blank() {
      var first = Store.curriculum()[0] || { name: "", units: [""] };
      return {
        id: null, subject: first.name, unit: first.units[0] || "",
        type: "mcq", difficulty: 2, prompt: "",
        choices: ["", "", "", ""], answer: 0,
        altAnswers: [], keywords: [], explain: ""
      };
    }

    function draw() {
      var v = editing || blank();
      type = v.type;

      var custom = Store.getCustom().filter(function (q) {
        return !listSubject || q.subject === listSubject;
      });

      mount.innerHTML =
        '<div class="page-head">' +
          "<h1>문제 추가 · 편집</h1>" +
          "<p>여기서 만든 문제는 이 브라우저에 저장됩니다. 영구 보관하려면 아래 [코드로 내보내기]를 쓰세요.</p>" +
        "</div>" +

        formCard(v) +

        '<div class="section-head"><h2>내가 추가한 문제</h2>' +
          '<span class="hint">' + Store.getCustom().length + "개</span></div>" +

        '<div class="card">' +
          '<div class="chips" style="margin-bottom:12px">' +
            subjChip("", "전체") +
            Store.curriculum().map(function (c) { return subjChip(c.name, c.name); }).join("") +
          "</div>" +
          (custom.length
            ? '<div class="list">' + custom.map(function (q) {
                return '<div class="row"><div class="row-main">' +
                  '<div class="row-title">' + App.esc(QuizEngine.trim(q.prompt, 70)) + "</div>" +
                  '<div class="row-sub">' + App.esc(q.subject) + " · " + App.esc(q.unit) +
                    " · " + App.TYPE_LABEL[q.type] + " · 난이도 " + App.DIFF_LABEL[q.difficulty] +
                    ' · <span class="mono">' + App.esc(q.id) + "</span></div>" +
                "</div><div class=\"row-side\">" +
                  '<button class="btn btn-sm" data-edit="' + App.esc(q.id) + '" type="button">수정</button>' +
                  '<button class="btn btn-sm btn-danger" data-del="' + App.esc(q.id) + '" type="button">삭제</button>' +
                "</div></div>";
              }).join("") + "</div>"
            : '<div class="empty">아직 추가한 문제가 없습니다.</div>') +
        "</div>" +

        '<div class="section-head"><h2>코드로 내보내기</h2>' +
          '<span class="hint">data/questions.js 에 붙여넣기</span></div>' +
        '<div class="card">' +
          '<p class="small muted mt-0">아래 내용을 복사해 <span class="mono">data/questions.js</span> 의 ' +
          '<span class="mono">];</span> 바로 앞에 붙여 넣으세요. 그러면 브라우저 저장소를 비워도 문제가 남습니다.</p>' +
          '<textarea id="exportBox" rows="10" class="mono" readonly>' +
            App.esc(toCode(Store.getCustom())) + "</textarea>" +
          '<div class="btn-row mt-2">' +
            '<button class="btn" id="copyBtn" type="button">복사</button>' +
          "</div>" +
        "</div>" +

        '<div class="callout mt-3">' +
          "<strong>PDF나 필기를 문제로 바꾸려면?</strong><br>" +
          "여기서 한 문제씩 치지 말고 <a href=\"#/import\">자료로 문제 만들기</a> 화면을 쓰세요. " +
          "AI에게 보낼 요청문을 복사해 주고, 돌아온 결과를 붙여넣으면 수십 개가 한 번에 들어갑니다." +
        "</div>" +

        '<div class="callout mt-2">' +
          "목록에 없는 과목이나 단원이 필요하면 " +
          "<a href=\"#/plan\">공부 계획 · 진도</a> 화면 아래쪽에서 추가할 수 있습니다." +
        "</div>";

      wire();
    }

    /* ---------- 폼 ---------- */

    function formCard(v) {
      var CUR = Store.curriculum();
      var subj = CUR.filter(function (c) { return c.name === v.subject; })[0] || CUR[0];

      return '<div class="card">' +
        '<div class="section-head" style="margin-top:0"><h2>' +
          (editing ? "문제 수정" : "새 문제") + "</h2>" +
          (editing ? '<button class="btn btn-ghost btn-sm" id="cancelEdit" type="button">취소</button>' : "") +
        "</div>" +

        '<div class="form-grid">' +
          '<label class="field">과목<select id="fSubject">' +
            CUR.map(function (c) {
              return '<option value="' + App.esc(c.name) + '"' +
                     (v.subject === c.name ? " selected" : "") + ">" + App.esc(c.name) + "</option>";
            }).join("") +
          "</select></label>" +

          '<label class="field">단원<select id="fUnit">' +
            subj.units.map(function (u) {
              return '<option value="' + App.esc(u) + '"' +
                     (v.unit === u ? " selected" : "") + ">" + App.esc(u) + "</option>";
            }).join("") +
          "</select></label>" +

          '<label class="field">유형<select id="fType">' +
            App.TYPE_ORDER.map(function (t) {
              return '<option value="' + t + '"' + (v.type === t ? " selected" : "") + ">" +
                     App.TYPE_LABEL[t] + "</option>";
            }).join("") +
          "</select></label>" +

          '<label class="field">난이도<select id="fDiff">' +
            [1, 2, 3].map(function (d) {
              return '<option value="' + d + '"' + (Number(v.difficulty) === d ? " selected" : "") + ">" +
                     App.DIFF_LABEL[d] + "</option>";
            }).join("") +
          "</select></label>" +

          '<label class="field span-2">' + promptLabel(v.type) +
            '<textarea id="fPrompt" rows="3">' + App.esc(v.prompt) + "</textarea></label>" +
        "</div>" +

        '<div id="typeFields">' + typeFields(v) + "</div>" +

        '<label class="field mt-2">해설 <span class="opt">(선택)</span>' +
          '<textarea id="fExplain" rows="3" placeholder="왜 그 답인지, 헷갈리는 선택지는 무엇인지">' +
          App.esc(v.explain || "") + "</textarea></label>" +

        '<div class="btn-row mt-2">' +
          '<button class="btn btn-primary" id="saveBtn" type="button">' +
            (editing ? "수정 저장" : "문제 추가") + "</button>" +
          '<button class="btn btn-ghost" id="resetBtn" type="button">입력 비우기</button>' +
        "</div>" +
      "</div>";
    }

    function promptLabel(t) {
      if (t === "flash") return "카드 앞면 (용어 · 질문)";
      if (t === "ox")    return "지문 (맞으면 O, 틀리면 X)";
      return "문제";
    }

    function typeFields(v) {
      if (v.type === "mcq") {
        var ch = (v.choices && v.choices.length === 4) ? v.choices : ["", "", "", ""];
        return '<div class="section-head"><h2>보기 · 정답</h2>' +
          '<span class="hint">정답인 보기의 라디오를 선택</span></div>' +
          ch.map(function (c, i) {
            return '<div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">' +
              '<input type="radio" name="mcqAns" value="' + i + '"' +
                (Number(v.answer) === i ? " checked" : "") + ">" +
              '<input type="text" data-choice="' + i + '" value="' + App.esc(c) +
                '" placeholder="보기 ' + (i + 1) + '">' +
            "</div>";
          }).join("");
      }

      if (v.type === "ox") {
        return '<div class="section-head"><h2>정답</h2></div>' +
          '<div class="chips">' +
            '<label class="chip' + (v.answer === true ? " on" : "") + '">' +
              '<input type="radio" name="oxAns" value="true"' + (v.answer === true ? " checked" : "") +
              ' style="width:auto;margin-right:6px"> O (지문이 맞다)</label>' +
            '<label class="chip' + (v.answer === false ? " on" : "") + '">' +
              '<input type="radio" name="oxAns" value="false"' + (v.answer === false ? " checked" : "") +
              ' style="width:auto;margin-right:6px"> X (지문이 틀리다)</label>' +
          "</div>";
      }

      if (v.type === "flash") {
        return '<label class="field mt-2">카드 뒷면 (정의 · 설명)' +
          '<textarea id="fAnswer" rows="4" placeholder="줄바꿈도 그대로 보입니다">' +
          App.esc(v.answer || "") + "</textarea></label>";
      }

      if (v.type === "short") {
        return '<div class="form-grid mt-2">' +
          '<label class="field">정답' +
            '<input type="text" id="fAnswer" value="' + App.esc(v.answer || "") + '"></label>' +
          '<label class="field">허용 표기 <span class="opt">(쉼표로 구분, 선택)</span>' +
            '<input type="text" id="fAlt" value="' + App.esc((v.altAnswers || []).join(", ")) +
            '" placeholder="예) 편류, drift"></label>' +
          "</div>" +
          '<p class="small muted">채점할 때 공백과 문장부호는 무시하고 비교합니다.</p>';
      }

      if (v.type === "essay") {
        return '<label class="field mt-2">모범답안' +
            '<textarea id="fAnswer" rows="5">' + App.esc(v.answer || "") + "</textarea></label>" +
          '<label class="field mt-2">채점 키워드 <span class="opt">(한 줄에 하나)</span>' +
            '<textarea id="fKeywords" rows="5" placeholder="평가\n계획\n실행\n감시">' +
            App.esc((v.keywords || []).join("\n")) + "</textarea></label>" +
          '<p class="small muted">서술형은 자동 채점이 안 됩니다. 이 키워드가 채점표로 나오고, 본인이 맞음/틀림을 선택합니다.</p>';
      }

      return "";
    }

    function subjChip(v, label) {
      return '<button class="chip' + (listSubject === v ? " on" : "") +
             '" data-lsubj="' + App.esc(v) + '" type="button">' + App.esc(label) + "</button>";
    }

    /* ---------- 코드 내보내기 ---------- */

    function toCode(list) {
      if (!list.length) return "// 추가한 문제가 없습니다.";
      return list.map(function (q) {
        var o = {
          id: q.id, subject: q.subject, unit: q.unit,
          type: q.type, difficulty: q.difficulty, prompt: q.prompt
        };
        if (q.type === "mcq") { o.choices = q.choices; o.answer = q.answer; }
        else o.answer = q.answer;
        if (q.altAnswers && q.altAnswers.length) o.altAnswers = q.altAnswers;
        if (q.keywords && q.keywords.length) o.keywords = q.keywords;
        o.explain = q.explain || "";
        return "  " + JSON.stringify(o, null, 2).split("\n").join("\n  ") + ",";
      }).join("\n\n");
    }

    /* ---------- 이벤트 ---------- */

    function collect() {
      var t = App.$("#fType", mount).value;
      var q = {
        id: editing ? editing.id : null,
        subject: App.$("#fSubject", mount).value,
        unit: App.$("#fUnit", mount).value,
        type: t,
        difficulty: Number(App.$("#fDiff", mount).value),
        prompt: App.$("#fPrompt", mount).value.trim(),
        explain: App.$("#fExplain", mount).value.trim()
      };

      if (t === "mcq") {
        q.choices = [0, 1, 2, 3].map(function (i) {
          return App.$('[data-choice="' + i + '"]', mount).value.trim();
        });
        var r = App.$('input[name="mcqAns"]:checked', mount);
        q.answer = r ? Number(r.value) : 0;
      } else if (t === "ox") {
        var o = App.$('input[name="oxAns"]:checked', mount);
        q.answer = o ? o.value === "true" : null;
      } else {
        q.answer = App.$("#fAnswer", mount).value.trim();
      }

      if (t === "short") {
        var alt = App.$("#fAlt", mount).value.trim();
        q.altAnswers = alt ? alt.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : [];
      }
      if (t === "essay") {
        var kw = App.$("#fKeywords", mount).value.trim();
        q.keywords = kw ? kw.split("\n").map(function (s) { return s.trim(); }).filter(Boolean) : [];
      }
      return q;
    }

    function validate(q) {
      if (!q.prompt) return "문제 내용을 입력하세요.";
      if (q.type === "mcq") {
        if (q.choices.filter(Boolean).length < 4) return "보기 4개를 모두 채우세요.";
      } else if (q.type === "ox") {
        if (q.answer === null) return "O 또는 X 중 정답을 고르세요.";
      } else if (!q.answer) {
        return q.type === "flash" ? "카드 뒷면을 입력하세요." : "정답을 입력하세요.";
      }
      return null;
    }

    function wire() {
      /* 과목을 바꾸면 단원 목록 교체 */
      var subjSel = App.$("#fSubject", mount);
      subjSel.addEventListener("change", function () {
        var c = Store.findSubject(subjSel.value);
        if (!c) return;
        App.$("#fUnit", mount).innerHTML = c.units.map(function (u) {
          return '<option value="' + App.esc(u) + '">' + App.esc(u) + "</option>";
        }).join("");
      });

      /* 유형을 바꾸면 그 유형 전용 입력칸으로 교체 (지금까지 쓴 문제 내용은 유지) */
      var typeSel = App.$("#fType", mount);
      typeSel.addEventListener("change", function () {
        var t = typeSel.value;
        var draft = {
          subject: subjSel.value,
          unit: App.$("#fUnit", mount).value,
          type: t,
          difficulty: Number(App.$("#fDiff", mount).value),
          prompt: App.$("#fPrompt", mount).value,
          explain: App.$("#fExplain", mount).value,
          choices: ["", "", "", ""],
          answer: t === "ox" ? null : "",
          altAnswers: [], keywords: []
        };
        if (editing) draft.id = editing.id;
        App.$("#typeFields", mount).innerHTML = typeFields(draft);

        /* 문제 입력칸 라벨도 유형에 맞게 바꾼다 */
        var lbl = App.$("#fPrompt", mount).parentElement;
        if (lbl.firstChild && lbl.firstChild.nodeType === 3) {
          lbl.firstChild.nodeValue = promptLabel(t);
        }
      });

      App.$("#saveBtn", mount).addEventListener("click", function () {
        var q = collect();
        var err = validate(q);
        if (err) { App.toast(err); return; }
        Store.saveCustom(q);
        App.toast(editing ? "수정했습니다" : "문제를 추가했습니다");
        editing = null;
        draw();
        window.scrollTo(0, 0);
      });

      App.$("#resetBtn", mount).addEventListener("click", function () {
        editing = null; draw(); window.scrollTo(0, 0);
      });

      var cancel = App.$("#cancelEdit", mount);
      if (cancel) cancel.addEventListener("click", function () { editing = null; draw(); });

      App.on(mount, "[data-edit]", function (ev, el) {
        var id = el.getAttribute("data-edit");
        editing = Store.getCustom().filter(function (q) { return q.id === id; })[0] || null;
        draw();
        window.scrollTo(0, 0);
      });

      App.on(mount, "[data-del]", function (ev, el) {
        if (!confirm("이 문제를 삭제할까요?")) return;
        Store.deleteCustom(el.getAttribute("data-del"));
        if (editing && editing.id === el.getAttribute("data-del")) editing = null;
        App.toast("삭제했습니다");
        draw();
      });

      App.on(mount, "[data-lsubj]", function (ev, el) {
        listSubject = el.getAttribute("data-lsubj");
        draw();
      });

      App.$("#copyBtn", mount).addEventListener("click", function () {
        var box = App.$("#exportBox", mount);
        box.removeAttribute("readonly");
        box.select();
        try {
          document.execCommand("copy");
          App.toast("복사했습니다");
        } catch (e) {
          App.toast("복사에 실패했습니다. 직접 선택해 복사하세요.");
        }
        box.setAttribute("readonly", "readonly");
        window.getSelection().removeAllRanges();
      });
    }

    draw();
  }
});
