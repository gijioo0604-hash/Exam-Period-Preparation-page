/* ============================================================
   자료로 문제 만들기 (한 번에 넣기)
   ------------------------------------------------------------
   이 사이트는 PDF 를 스스로 읽어 문제를 만들지 못합니다.
   그건 AI 호출이 필요해서 API 키와 요금이 듭니다.

   대신 왕복을 최대한 짧게 만들었습니다.
     1) [요청문 복사] 로 AI 에게 보낼 지시문을 통째로 복사
     2) Claude 같은 AI 에 PDF 와 함께 붙여넣기
     3) 돌아온 결과를 아래 칸에 붙여넣고 [미리보기] → [추가]

   이 앱은 인터넷에 아무것도 요청하지 않습니다. 자료도 결과도
   이 컴퓨터 밖으로 나가지 않습니다.

   들여올 때 지키는 것
     · 한 번에 최소 10문제 (MIN_Q)
     · 모든 문제에 정답과 해설이 있어야 통과
     · 출처가 없으면 지어내지 않고 "자료에 없음" 으로 표시
   ============================================================ */

App.register("import", {
  render: function (mount) {

    /* 한 번에 만들 최소 문제 수 */
    var MIN_Q = 10;

    var parsed = null;      // 미리보기 결과 { ok: [], bad: [] }
    var mode = "json";      // json | simple

    function draw() {
      var CUR = Store.curriculum();

      mount.innerHTML =
        '<div class="page-head">' +
          "<h1>자료로 문제 만들기</h1>" +
          "<p>교재 PDF나 필기를 문제로 바꿔서 한 번에 넣습니다. 한 문제씩 폼에 치지 않아도 됩니다.</p>" +
        "</div>" +

        /* ---- 1단계 ---- */
        '<div class="section-head" style="margin-top:0">' +
          "<h2>1단계 · AI에게 보낼 요청문 복사</h2></div>" +
        '<div class="card">' +
          '<p class="small muted mt-0">' +
            "아래 버튼을 누르면 <strong>지금 등록된 과목·단원 목록과 문제 형식이 들어간 요청문</strong>이 " +
            "복사됩니다. Claude 나 다른 AI 대화창에 <strong>PDF·필기 사진과 함께</strong> 붙여넣으세요." +
          "</p>" +
          '<div class="form-grid">' +
            '<label class="field">어느 과목으로 만들까요' +
              '<select id="pSubject">' +
                '<option value="">— 전체 과목 목록을 넘김 —</option>' +
                CUR.map(function (c) {
                  return '<option value="' + App.esc(c.name) + '">' + App.esc(c.name) + "</option>";
                }).join("") +
              "</select></label>" +
            '<label class="field">몇 문제쯤 <span class="small muted">(최소 ' + MIN_Q + '개)</span>' +
              '<input type="number" id="pCount" min="' + MIN_Q + '" max="100" value="20"></label>' +
          "</div>" +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" id="copyPrompt" type="button">요청문 복사</button>' +
            '<button class="btn btn-ghost" id="showPrompt" type="button">내용 보기</button>' +
          "</div>" +
          '<div id="promptSlot" class="mt-2"></div>' +
        "</div>" +

        /* ---- 2단계 ---- */
        '<div class="section-head"><h2>2단계 · 돌아온 결과 붙여넣기</h2>' +
          '<span class="hint">' + Store.getCustom().length + "개 보유</span></div>" +
        '<div class="card">' +
          '<div class="chips" style="margin-bottom:10px">' +
            '<button class="chip' + (mode === "json" ? " on" : "") +
              '" data-mode="json" type="button">JSON (AI 결과)</button>' +
            '<button class="chip' + (mode === "simple" ? " on" : "") +
              '" data-mode="simple" type="button">간단 서식 (직접 타이핑)</button>' +
          "</div>" +

          (mode === "simple" ? simpleHelp() : "") +

          '<label class="field">붙여넣기' +
            '<textarea id="pasteBox" rows="12" class="mono" placeholder="' +
            (mode === "json"
              ? "[ { &quot;subject&quot;: &quot;항해학&quot;, ... } ]"
              : "4지선다 | 항해학 | 항해 계기 | 중") +
            '"></textarea></label>' +

          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" id="previewBtn" type="button">미리보기</button>' +
            '<button class="btn btn-ghost" id="clearBtn" type="button">비우기</button>' +
          "</div>" +
        "</div>" +

        /* ---- 3단계 ---- */
        (parsed ? resultCard(parsed) : "");

      wire();
    }

    /* ---------- 간단 서식 안내 ---------- */

    function simpleHelp() {
      return '<div class="callout" style="margin-bottom:12px">' +
        "<strong>한 문제 = 한 덩어리, 덩어리 사이는 빈 줄로 구분합니다.</strong><br>" +
        '<span class="mono" style="display:block;white-space:pre;overflow-x:auto;margin-top:8px;line-height:1.7">' +
"4지선다 | 항해학 | 항해 계기 | 중\n" +
"진북을 지시하는 계기는?\n" +
"*자이로컴퍼스\n" +
"마그네틱컴퍼스\n" +
"선속계\n" +
"음향측심기\n" +
"&gt; 자이로컴퍼스는 진북을, 마그네틱컴퍼스는 자북을 지시한다.\n" +
"출처: 항해학_기초.pdf · 3. 항해 계기\n" +
"\n" +
"OX | 해사법규 | 항법 | 하\n" +
"추월하는 선박이 피항한다.\n" +
"정답: O\n" +
"해설: 추월선이 진로를 피해야 한다.\n" +
"출처: 해사법규_요약.pdf · 2. 항법\n" +
"\n" +
"플래시카드 | 항해학 | 방위와 침로 | 하\n" +
"편차\n" +
"정답: 진북과 자북의 차이\n" +
"해설: 장소와 연도에 따라 값이 달라진다.\n" +
"출처: 항해학_기초.pdf · 2. 방위와 침로\n" +
"\n" +
"단답 | 선박기관 | 주요 보조 계통 | 중\n" +
"청수를 다시 냉각하는 것은?\n" +
"정답: 해수\n" +
"허용: 바닷물, sea water\n" +
"해설: 청수 냉각기에서 해수와 열을 주고받는다.\n" +
"출처: 선박기관_기초.pdf · 3. 주요 보조 계통\n" +
"\n" +
"서술형 | 항해학 | 항로 계획 | 상\n" +
"항로 계획 네 단계를 서술하시오.\n" +
"정답: 평가, 계획, 실행, 감시 순으로 진행한다.\n" +
"키워드: 평가, 계획, 실행, 감시\n" +
"해설: 순서와 각 단계에서 하는 일을 함께 써야 한다.\n" +
"출처: 항해학_기초.pdf · 6. 항로 계획" +
        "</span>" +
        '<div class="small mt-1">' +
          "첫 줄은 <strong>유형 | 과목 | 단원 | 난이도</strong>. 난이도는 하·중·상.<br>" +
          "4지선다는 정답 보기 앞에 <strong>*</strong>. 해설은 <strong>&gt;</strong> 또는 " +
          "<strong>해설:</strong> 줄.<br>" +
          "나머지 유형은 <strong>정답:</strong> 줄에 답을 씁니다.<br>" +
          "<strong>해설은 모든 문제에 있어야 합니다.</strong> 없으면 건너뜁니다.<br>" +
          "<strong>출처:</strong> 줄에 어느 자료 어디에서 나왔는지 적습니다. " +
          "자료에서 못 찾았으면 지어내지 말고 <strong>출처: 자료에 없음</strong> 이라고 쓰세요." +
        "</div>" +
      "</div>";
    }

    /* ---------- 미리보기 결과 ---------- */

    function resultCard(r) {
      var html = '<div class="section-head"><h2>3단계 · 확인하고 추가</h2>' +
        '<span class="hint">읽어들인 ' + r.ok.length + "개" +
        (r.bad.length ? " · 문제 있는 " + r.bad.length + "개" : "") + "</span></div>";

      if (r.bad.length) {
        html += '<div class="card"><div class="callout callout-warn">' +
          "<strong>아래 " + r.bad.length + "개는 건너뜁니다.</strong><br>" +
          r.bad.map(function (b) {
            return "· " + App.esc(b.where) + " — " + App.esc(b.why);
          }).join("<br>") +
        "</div></div>";
      }

      if (!r.ok.length) {
        html += '<div class="card"><div class="empty">추가할 수 있는 문제가 없습니다.</div></div>';
        return html;
      }

      /* 한 번에 최소 10문제. 모자라면 막지는 않고, 자료를 더 넣고
         다시 받아 오라고 알려 준다. */
      if (r.ok.length < MIN_Q) {
        html += '<div class="card"><div class="callout callout-warn">' +
          "<strong>" + r.ok.length + "개뿐입니다. 한 번에 " + MIN_Q + "개 이상을 권합니다.</strong><br>" +
          "자료를 더 붙여서 다시 받아 오거나, 위 요청문의 문제 수를 올려 보세요.<br>" +
          "그대로 추가해도 됩니다 — 자료에 없는 내용을 억지로 채우는 것보다 낫습니다." +
        "</div></div>";
      }

      /* 자료에서 근거를 찾지 못한 문제는 미리 세어서 알려 준다 */
      var noSrc = r.ok.filter(function (q) { return lacksSource(q); }).length;
      if (noSrc) {
        html += '<div class="card"><div class="callout callout-warn">' +
          "<strong>출처가 없는 문제 " + noSrc + "개</strong><br>" +
          "자료에서 근거를 찾지 못한 문제입니다. 넣어도 되지만 화면에 " +
          "<strong>자료에 없음</strong> 이라고 표시되니, 교재로 직접 확인하세요." +
        "</div></div>";
      }

      html += '<div class="card"><div class="list">' +
        r.ok.map(function (q, i) {
          var warn = !Store.findSubject(q.subject) ||
                     Store.findSubject(q.subject).units.indexOf(q.unit) < 0;
          return '<div class="row">' +
            '<div class="row-main">' +
              '<div class="row-title">' + (i + 1) + ". " + App.esc(QuizEngine.trim(q.prompt, 68)) + "</div>" +
              '<div class="row-sub">' + App.esc(q.subject) + " · " + App.esc(q.unit) +
                " · " + App.TYPE_LABEL[q.type] + " · 난이도 " + App.DIFF_LABEL[q.difficulty] + "</div>" +
              '<div class="row-sub' + (lacksSource(q) ? " no-source" : "") + '">출처: ' +
                App.esc(lacksSource(q) ? App.NO_SOURCE : q.source) + "</div>" +
            "</div>" +
            '<div class="row-side">' +
              (lacksSource(q)
                ? '<span class="badge badge-warn" title="자료에서 근거를 찾지 못한 문제입니다.">출처 없음</span>'
                : "") +
              (warn
                ? '<span class="badge badge-warn" title="목록에 없는 과목·단원입니다. 추가는 되지만 단원별 통계에서 빠집니다.">목록에 없음</span>'
                : "") +
              (!warn && !lacksSource(q) ? '<span class="badge badge-ok">확인</span>' : "") +
            "</div>" +
          "</div>";
        }).join("") +
      "</div>" +

      '<div class="btn-row mt-2">' +
        '<button class="btn btn-primary" id="commitBtn" type="button">' +
          r.ok.length + "개 문제 추가하기</button>" +
        '<button class="btn btn-ghost" id="cancelPreview" type="button">취소</button>' +
      "</div></div>";

      /* 목록에 없는 과목·단원이 있으면 한 번에 만들 수 있게 */
      var missing = missingUnits(r.ok);
      if (missing.length) {
        html += '<div class="card"><div class="callout">' +
          "<strong>목록에 없는 과목 · 단원 " + missing.length + "개</strong><br>" +
          missing.map(function (m) { return App.esc(m.subject + " · " + m.unit); }).join(" / ") +
          "<br>그대로 둬도 문제는 들어가지만, 단원별 정답률과 약점 분석에서는 빠집니다." +
        "</div>" +
        '<div class="btn-row mt-2">' +
          '<button class="btn" id="createMissing" type="button">이 과목 · 단원 만들기</button>' +
        "</div></div>";
      }

      return html;
    }

    /* 자료에서 근거를 찾지 못한 문제인가.
       판정은 App 에 하나만 두었다. 여기에 따로 만들면 화면과 어긋난다. */
    function lacksSource(q) {
      return App.lacksSource(q && q.source);
    }

    function missingUnits(list) {
      var seen = {}, out = [];
      list.forEach(function (q) {
        var k = q.subject + "::" + q.unit;
        if (seen[k]) return;
        seen[k] = true;
        var c = Store.findSubject(q.subject);
        if (!c || c.units.indexOf(q.unit) < 0) out.push({ subject: q.subject, unit: q.unit });
      });
      return out;
    }

    /* ---------- 요청문 만들기 ---------- */

    function buildPrompt() {
      var subject = App.$("#pSubject", mount).value;
      var n = Math.max(MIN_Q, Number(App.$("#pCount", mount).value) || 20);
      var CUR = Store.curriculum();
      var list = subject ? CUR.filter(function (c) { return c.name === subject; }) : CUR;

      return [
        "첨부한 자료(PDF·필기)만 읽고 시험 대비 문제 " + n + "개를 만들어 줘.",
        "최소 " + MIN_Q + "개는 반드시 채워야 해.",
        "",
        "■ 가장 중요한 규칙 — 자료 밖의 내용을 쓰지 마",
        "1. 첨부한 자료에 적혀 있는 것만으로 문제를 만들어 줘.",
        "   네가 따로 알고 있는 지식, 인터넷에서 찾은 것, 일반 상식을 보태지 마.",
        "2. 자료에 근거가 없으면 지어내지 마. 그럴듯하게 채우는 것이 제일 나쁜 경우야.",
        "3. 자료에서 근거를 찾지 못했으면 그 자리에 정확히 이렇게 적어 줘: 자료에 없음",
        "   (source 나 explain 에 \"자료에 없음\" 이라고 쓰면 돼. 빈 칸으로 두지 마.)",
        "4. 자료가 짧아서 " + n + "개를 못 채우겠으면, 억지로 만들어 채우지 말고",
        "   만들 수 있는 만큼만 주고 맨 끝에 몇 개밖에 못 만든 이유를 한 줄로 적어 줘.",
        "",
        "■ 모든 문제에 반드시 있어야 하는 것",
        "- answer  (정답)",
        "- explain (해설) — 한 문제도 빠짐없이. 빈 문자열로 두면 안 돼.",
        "- source  (출처) — 이 문제가 자료의 어디에서 나왔는지.",
        "  서식은 \"파일이름 · 항목\" 으로. 쪽수를 알면 쪽수까지.",
        "  예: \"항해학_기초.pdf · 2. 방위와 침로\"  /  \"필기노트.pdf · 12쪽\"",
        "",
        "■ 과목과 단원은 아래 목록에서만 골라서 정확히 그대로 써 줘.",
        list.map(function (c) {
          return "- " + c.name + ": " + c.units.join(", ");
        }).join("\n"),
        "",
        "■ 유형은 mcq(4지선다) / ox / flash(플래시카드) / short(단답) / essay(서술형) 5가지.",
        "   골고루 섞되 mcq 를 가장 많이 해 줘.",
        "■ difficulty 는 1(하) 2(중) 3(상). 역시 골고루.",
        "■ id 는 서로 겹치지 않게 만들어 줘.",
        "■ mcq 해설에 \"1번은~\" 처럼 보기 번호를 쓰지 마. 보기 순서가 매번 섞여서 어긋나.",
        "   번호 대신 보기 내용을 그대로 인용해 줘.",
        "■ mcq 의 오답 보기도 자료 안에 나오는 말로 만들어 줘. 없는 용어를 지어내지 마.",
        "",
        "■ 결과는 다른 말 없이 JSON 배열 하나로만 줘. 형식은 이렇게:",
        "",
        "[",
        '  { "id": "nav-101", "subject": "항해학", "unit": "항해 계기",',
        '    "type": "mcq", "difficulty": 2,',
        '    "prompt": "진북을 지시하는 계기는?",',
        '    "choices": ["자이로컴퍼스", "마그네틱컴퍼스", "선속계", "음향측심기"],',
        '    "answer": 0,',
        '    "explain": "자이로컴퍼스는 진북을, 마그네틱컴퍼스는 자북을 지시한다.",',
        '    "source": "항해학_기초.pdf · 3. 항해 계기" },',
        "",
        '  { "id": "law-101", "subject": "해사법규", "unit": "항법",',
        '    "type": "ox", "difficulty": 1,',
        '    "prompt": "추월하는 선박이 피항한다.",',
        '    "answer": true,',
        '    "explain": "추월선은 추월당하는 선박의 진로를 피해야 한다.",',
        '    "source": "해사법규_요약.pdf · 2. 항법" },',
        "",
        '  { "id": "nav-102", "subject": "항해학", "unit": "방위와 침로",',
        '    "type": "flash", "difficulty": 1,',
        '    "prompt": "편차", "answer": "진북과 자북의 차이",',
        '    "explain": "장소와 연도에 따라 값이 달라진다.",',
        '    "source": "항해학_기초.pdf · 2. 방위와 침로" },',
        "",
        '  { "id": "eng-101", "subject": "선박기관", "unit": "주요 보조 계통",',
        '    "type": "short", "difficulty": 2,',
        '    "prompt": "청수를 다시 냉각하는 것은?",',
        '    "answer": "해수", "altAnswers": ["바닷물"],',
        '    "explain": "청수 냉각기에서 해수와 열을 주고받는다.",',
        '    "source": "선박기관_기초.pdf · 3. 주요 보조 계통" },',
        "",
        '  { "id": "nav-103", "subject": "항해학", "unit": "항로 계획",',
        '    "type": "essay", "difficulty": 3,',
        '    "prompt": "항로 계획 네 단계를 서술하시오.",',
        '    "answer": "평가, 계획, 실행, 감시 순으로 진행한다. ...",',
        '    "keywords": ["평가", "계획", "실행", "감시"],',
        '    "explain": "네 단계의 순서와 각 단계에서 하는 일을 함께 써야 한다.",',
        '    "source": "항해학_기초.pdf · 6. 항로 계획" }',
        "]"
      ].join("\n");
    }

    /* ---------- 간단 서식 파싱 ---------- */

    var TYPE_ALIAS = {
      "4지선다": "mcq", "객관식": "mcq", "mcq": "mcq",
      "ox": "ox", "OX": "ox", "o/x": "ox",
      "플래시카드": "flash", "플래시": "flash", "카드": "flash", "flash": "flash",
      "단답": "short", "주관식": "short", "단답형": "short", "short": "short",
      "서술형": "essay", "서술": "essay", "essay": "essay"
    };
    var DIFF_ALIAS = { "하": 1, "중": 2, "상": 3, "1": 1, "2": 2, "3": 3 };

    function parseSimple(text) {
      var ok = [], bad = [];
      var blocks = text.split(/\n\s*\n/);

      blocks.forEach(function (block, bi) {
        var lines = block.split("\n").map(function (l) { return l.trim(); })
                         .filter(function (l) { return l.length; });
        if (!lines.length) return;

        var where = (bi + 1) + "번째 덩어리";
        var head = lines[0].split("|").map(function (s) { return s.trim(); });
        if (head.length < 3) {
          bad.push({ where: where, why: "첫 줄이 '유형 | 과목 | 단원 | 난이도' 형태가 아닙니다" });
          return;
        }

        var type = TYPE_ALIAS[head[0]] || TYPE_ALIAS[head[0].toLowerCase()];
        if (!type) { bad.push({ where: where, why: "모르는 유형: " + head[0] }); return; }

        var q = {
          subject: head[1], unit: head[2],
          type: type,
          difficulty: DIFF_ALIAS[head[3]] || 2,
          prompt: "", explain: "", source: ""
        };

        var body = lines.slice(1);
        if (!body.length) { bad.push({ where: where, why: "문제 내용이 없습니다" }); return; }

        q.prompt = body[0];
        var rest = body.slice(1);

        if (type === "mcq") {
          var choices = [], answer = -1;
          rest.forEach(function (l) {
            if (l.indexOf(">") === 0) { q.explain = l.slice(1).trim(); return; }
            /* '해설:' '출처:' 줄은 보기가 아니다 */
            var lab = l.match(/^(해설|출처)\s*[:：]\s*(.*)$/);
            if (lab) {
              if (lab[1] === "해설") q.explain = lab[2].trim();
              else q.source = lab[2].trim();
              return;
            }
            var star = l.indexOf("*") === 0;
            var t = (star ? l.slice(1) : l).replace(/^\d+[.)]\s*/, "").trim();
            if (!t) return;
            if (star) answer = choices.length;
            choices.push(t);
          });
          if (choices.length !== 4) {
            bad.push({ where: where, why: "보기가 4개가 아닙니다 (" + choices.length + "개)" });
            return;
          }
          if (answer < 0) { bad.push({ where: where, why: "정답 보기 앞에 * 가 없습니다" }); return; }
          q.choices = choices;
          q.answer = answer;
        } else {
          rest.forEach(function (l) {
            if (l.indexOf(">") === 0) { q.explain = l.slice(1).trim(); return; }
            var m = l.match(/^(정답|답|허용|키워드|해설|출처)\s*[:：]\s*(.*)$/);
            if (!m) return;
            var v = m[2].trim();
            if (m[1] === "정답" || m[1] === "답") q.answer = v;
            else if (m[1] === "허용") q.altAnswers = splitList(v);
            else if (m[1] === "키워드") q.keywords = splitList(v);
            else if (m[1] === "출처") q.source = v;
            else q.explain = v;
          });

          if (type === "ox") {
            var a = String(q.answer || "").trim().toUpperCase();
            if (a === "O" || a === "TRUE" || a === "참" || a === "ㅇ") q.answer = true;
            else if (a === "X" || a === "FALSE" || a === "거짓" || a === "ㄴ") q.answer = false;
            else { bad.push({ where: where, why: "OX 정답은 O 또는 X 로 적어 주세요" }); return; }
          } else if (!q.answer) {
            bad.push({ where: where, why: "'정답:' 줄이 없습니다" });
            return;
          }
        }

        if (!q.explain) {
          bad.push({ where: where, why: "해설이 없습니다 ('>' 줄 또는 '해설:' 줄)" });
          return;
        }

        ok.push(q);
      });

      return { ok: ok, bad: bad };
    }

    function splitList(s) {
      return s.split(",").map(function (x) { return x.trim(); }).filter(Boolean);
    }

    /* ---------- JSON 파싱 ---------- */

    function parseJson(text) {
      var ok = [], bad = [];

      /* AI 가 ```json 같은 코드펜스를 붙여 주는 경우가 흔하다 */
      var t = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
      /* 앞뒤에 설명을 붙였으면 배열 부분만 잘라 낸다 */
      if (t[0] !== "[" && t[0] !== "{") {
        var a = t.indexOf("["), b = t.lastIndexOf("]");
        if (a >= 0 && b > a) t = t.slice(a, b + 1);
      }

      var arr;
      try {
        arr = JSON.parse(t);
      } catch (e) {
        return { ok: [], bad: [{ where: "전체", why: "JSON 을 읽지 못했습니다 — " + e.message }] };
      }
      if (!Array.isArray(arr)) arr = [arr];

      arr.forEach(function (q, i) {
        var where = (i + 1) + "번째";
        if (!q || typeof q !== "object") { bad.push({ where: where, why: "형식이 이상합니다" }); return; }

        var type = TYPE_ALIAS[q.type] || q.type;
        if (["mcq", "ox", "flash", "short", "essay"].indexOf(type) < 0) {
          bad.push({ where: where, why: "모르는 type: " + q.type }); return;
        }
        if (!q.prompt) { bad.push({ where: where, why: "prompt 가 없습니다" }); return; }
        if (!q.subject || !q.unit) { bad.push({ where: where, why: "subject 나 unit 이 없습니다" }); return; }

        var out = {
          subject: String(q.subject), unit: String(q.unit),
          type: type,
          difficulty: [1, 2, 3].indexOf(Number(q.difficulty)) >= 0 ? Number(q.difficulty) : 2,
          prompt: String(q.prompt),
          explain: String(q.explain || "").trim(),
          source: String(q.source || "").trim()
        };

        /* 해설은 모든 문제에 있어야 한다. 없는 채로 들이면
           나중에 왜 그게 답인지 알 수 없는 문제만 쌓인다. */
        if (!out.explain) {
          bad.push({ where: where, why: "explain (해설) 이 없습니다" });
          return;
        }

        if (type === "mcq") {
          if (!Array.isArray(q.choices) || q.choices.length !== 4) {
            bad.push({ where: where, why: "choices 가 4개가 아닙니다" }); return;
          }
          var ai = Number(q.answer);
          if (!(ai >= 0 && ai <= 3)) { bad.push({ where: where, why: "answer 가 0~3 이 아닙니다" }); return; }
          out.choices = q.choices.map(String);
          out.answer = ai;
        } else if (type === "ox") {
          if (typeof q.answer === "boolean") out.answer = q.answer;
          else {
            var s = String(q.answer).trim().toUpperCase();
            if (s === "O" || s === "TRUE") out.answer = true;
            else if (s === "X" || s === "FALSE") out.answer = false;
            else { bad.push({ where: where, why: "answer 가 true/false 가 아닙니다" }); return; }
          }
        } else {
          if (!q.answer) { bad.push({ where: where, why: "answer 가 없습니다" }); return; }
          out.answer = String(q.answer);
          if (Array.isArray(q.altAnswers)) out.altAnswers = q.altAnswers.map(String);
          if (Array.isArray(q.keywords)) out.keywords = q.keywords.map(String);
        }

        ok.push(out);
      });

      return { ok: ok, bad: bad };
    }

    /* ---------- 이벤트 ---------- */

    function wire() {
      App.on(mount, "[data-mode]", function (ev, el) {
        mode = el.getAttribute("data-mode");
        parsed = null;
        draw();
      });

      App.$("#copyPrompt", mount).addEventListener("click", function () {
        copyText(buildPrompt(), "요청문을 복사했습니다. AI 대화창에 자료와 함께 붙여넣으세요.");
      });

      App.$("#showPrompt", mount).addEventListener("click", function () {
        App.$("#promptSlot", mount).innerHTML =
          '<textarea rows="14" class="mono" readonly>' + App.esc(buildPrompt()) + "</textarea>";
      });

      App.$("#previewBtn", mount).addEventListener("click", function () {
        var text = App.$("#pasteBox", mount).value;
        if (!text.trim()) { App.toast("붙여넣은 내용이 없습니다"); return; }
        var saved = text;
        parsed = (mode === "json") ? parseJson(text) : parseSimple(text);
        draw();
        App.$("#pasteBox", mount).value = saved;      // 다시 그려도 입력은 남긴다
        var res = App.$("#commitBtn", mount);
        if (res) res.scrollIntoView({ block: "center" });
      });

      App.$("#clearBtn", mount).addEventListener("click", function () {
        parsed = null;
        draw();
      });

      var commit = App.$("#commitBtn", mount);
      if (commit) commit.addEventListener("click", function () {
        var n = 0;
        parsed.ok.forEach(function (q) { Store.saveCustom(q); n++; });
        App.toast(n + "개 문제를 추가했습니다");
        parsed = null;
        draw();
      });

      var cancelP = App.$("#cancelPreview", mount);
      if (cancelP) cancelP.addEventListener("click", function () { parsed = null; draw(); });

      var mk = App.$("#createMissing", mount);
      if (mk) mk.addEventListener("click", function () {
        var made = 0;
        missingUnits(parsed.ok).forEach(function (m) {
          if (!Store.findSubject(m.subject)) Store.addSubject(m.subject, []);
          if (!Store.addUnit(m.subject, m.unit)) made++;
        });
        App.toast(made + "개 단원을 만들었습니다");
        draw();
      });
    }

    function copyText(text, msg) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        App.toast(msg);
      } catch (e) {
        App.toast("복사에 실패했습니다. [내용 보기] 로 직접 복사하세요.");
      }
      document.body.removeChild(ta);
    }

    draw();
  }
});
