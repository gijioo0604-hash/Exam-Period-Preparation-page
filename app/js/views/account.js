/* ============================================================
   계정 · 동기화
   로그인하지 않아도 앱은 전부 동작한다. 로그인은 기기 간에
   기록을 같이 보기 위한 것이다.
   ============================================================ */

App.register("account", {
  render: function (mount) {

    var showSetup = false;
    var showRules = false;

    Sync.onChange(function () {
      /* 다른 화면에 있을 때 다시 그리면 안 된다 */
      if (location.hash.indexOf("account") >= 0) draw();
    });

    function fmtTime(ts) {
      if (!ts) return "아직 없음";
      var d = new Date(ts);
      return App.fmtDate(App.dayKey(ts)) + " " +
             String(d.getHours()).padStart(2, "0") + ":" +
             String(d.getMinutes()).padStart(2, "0");
    }

    function draw() {
      var cfg = Sync.config();
      var user = Sync.currentUser();
      var err = Sync.error();

      var html =
        '<div class="page-head">' +
          "<h1>계정 · 동기화</h1>" +
          "<p>로그인하면 폰과 노트북에서 같은 기록을 봅니다. 안 해도 앱은 그대로 다 씁니다.</p>" +
        "</div>";

      /* ---- 상태 ---- */
      if (user) {
        html += '<div class="card">' +
          '<div class="subj-top">' +
            '<div class="subj-top-main">' +
              '<div class="subj-top-name">' + App.esc(user.displayName || user.email) +
                ' <span class="badge badge-ok">로그인됨</span></div>' +
              '<div class="stat-sub mt-1">' + App.esc(user.email) + "</div>" +
              '<div class="stat-sub">마지막 동기화 · ' + fmtTime(Sync.lastSyncedAt()) + "</div>" +
            "</div>" +
          "</div>" +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" id="syncNow" type="button"' +
              (Sync.isBusy() ? " disabled" : "") + ">" +
              (Sync.isBusy() ? "동기화 중…" : "지금 동기화") + "</button>" +
            '<button class="btn" id="signOut" type="button">로그아웃</button>' +
          "</div>" +
        "</div>";

        if (err) html += '<div class="callout callout-warn mt-2">' + App.esc(err) + "</div>";

        html += '<div class="section-head"><h2>한쪽으로 맞추기</h2>' +
          '<span class="hint">평소엔 쓸 일이 없습니다</span></div>' +
          '<div class="card">' +
            '<p class="small muted mt-0">동기화는 <strong>양쪽을 합치는</strong> 방식입니다. ' +
            "그래서 한 기기에서 지운 것이 다른 기기에서 되살아날 수 있습니다. " +
            "정리하고 싶을 때만 아래를 쓰세요.</p>" +
            '<div class="btn-row mt-1">' +
              '<button class="btn btn-sm btn-danger" id="forcePush" type="button">이 기기 것으로 덮어쓰기</button>' +
              '<button class="btn btn-sm btn-danger" id="forcePull" type="button">클라우드 것으로 덮어쓰기</button>' +
            "</div>" +
          "</div>";

      } else if (cfg) {
        html += '<div class="card">' +
          '<div class="plan-head"><strong>구글 계정으로 로그인</strong></div>' +
          '<p class="small muted mt-1">' + App.esc(cfg.projectId) + " 프로젝트에 연결되어 있습니다.</p>" +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" id="signIn" type="button">구글로 로그인</button>' +
            '<button class="btn btn-ghost btn-sm" id="editCfg" type="button">설정 바꾸기</button>' +
          "</div>" +
          (err ? '<div class="callout callout-warn mt-2">' + App.esc(err) + "</div>" : "") +
        "</div>";

      } else {
        html += '<div class="card">' +
          '<div class="empty" style="padding:22px">' +
            "아직 동기화를 켜지 않았습니다.<br>" +
            "이 브라우저에만 기록이 쌓이고 있습니다." +
          "</div>" +
          '<div class="btn-row" style="justify-content:center">' +
            '<button class="btn btn-primary" id="editCfg" type="button">동기화 켜기</button>' +
          "</div>" +
        "</div>";
      }

      /* ---- 설정 입력 ---- */
      if (showSetup || (!cfg && showSetup !== false)) {
        html += setupCard(cfg);
      }

      /* ---- 로그인 없이 쓰는 방법 ---- */
      html += '<div class="callout mt-3">' +
        "<strong>로그인이 부담되면</strong><br>" +
        "<a href=\"#/data\">백업 · 초기화</a> 화면에서 파일로 내보내 다른 기기에서 가져와도 됩니다. " +
        "느리지만 계정도 설정도 필요 없습니다." +
      "</div>";

      mount.innerHTML = html;
      wire();
    }

    /* ---------- 설정 안내 ---------- */

    function setupCard(cfg) {
      return '<div class="section-head"><h2>Firebase 설정</h2>' +
        '<span class="hint">한 번만 하면 됩니다</span></div>' +

        '<div class="card">' +
          '<div class="gcal-way mt-0">' +
            "<strong>1. 프로젝트 만들기</strong>" +
            '<p class="small muted"><a href="https://console.firebase.google.com/" target="_blank" rel="noopener">' +
            "Firebase 콘솔</a>에서 프로젝트를 하나 만듭니다. 이름은 아무거나 좋습니다. " +
            "애널리틱스는 꺼도 됩니다.</p>" +
          "</div>" +

          '<div class="gcal-way">' +
            "<strong>2. 웹 앱 추가하고 설정 복사</strong>" +
            '<p class="small muted">프로젝트 개요에서 <b>&lt;/&gt;</b>(웹) 아이콘을 눌러 앱을 추가하면 ' +
            "<span class=\"mono\">firebaseConfig</span> 가 나옵니다. 그걸 통째로 아래에 붙여넣으세요.</p>" +
            '<label class="field">firebaseConfig' +
              '<textarea id="cfgBox" rows="8" class="mono" placeholder=\'{ "apiKey": "...", "projectId": "..." }\'>' +
              (cfg ? App.esc(JSON.stringify(cfg, null, 2)) : "") + "</textarea></label>" +
            '<div class="btn-row mt-1">' +
              '<button class="btn btn-sm btn-primary" id="saveCfg" type="button">저장</button>' +
              (cfg ? '<button class="btn btn-sm btn-danger" id="clearCfg" type="button">설정 지우기</button>' : "") +
            "</div>" +
          "</div>" +

          '<div class="gcal-way">' +
            "<strong>3. 구글 로그인 켜기</strong>" +
            '<p class="small muted">Authentication → Sign-in method → <b>Google</b> 사용 설정.<br>' +
            "그리고 Settings → 승인된 도메인에 <span class=\"mono\">" + App.esc(location.hostname) +
            "</span> 를 추가하세요.</p>" +
          "</div>" +

          '<div class="gcal-way">' +
            "<strong>4. Firestore 만들고 규칙 넣기</strong>" +
            '<p class="small muted">Firestore Database → 데이터베이스 만들기 → <b>프로덕션 모드</b>. ' +
            "그다음 규칙 탭에 아래를 <b>그대로</b> 넣고 게시하세요. " +
            "이 규칙이 있어야 <b>내 기록을 나만</b> 보고 쓸 수 있습니다.</p>" +
            '<div class="btn-row">' +
              '<button class="btn btn-sm" id="showRules" type="button">' +
                (showRules ? "규칙 숨기기" : "규칙 보기") + "</button>" +
              '<button class="btn btn-sm" id="copyRules" type="button">규칙 복사</button>' +
            "</div>" +
            (showRules
              ? '<textarea rows="9" class="mono mt-1" readonly>' + App.esc(RULES) + "</textarea>"
              : "") +
          "</div>" +

          '<div class="callout callout-warn">' +
            "<strong>무료 등급으로 충분합니다.</strong> 하루 읽기 5만 · 쓰기 2만까지 무료인데, " +
            "이 앱은 하루에 많아야 수십 번 씁니다. 카드 등록도 필요 없습니다." +
          "</div>" +
        "</div>";
    }

    var RULES =
      "rules_version = '2';\n" +
      "service cloud.firestore {\n" +
      "  match /databases/{database}/documents {\n" +
      "    // 로그인한 사람이 자기 문서만 읽고 쓸 수 있다\n" +
      "    match /users/{uid} {\n" +
      "      allow read, write: if request.auth != null\n" +
      "                        && request.auth.uid == uid;\n" +
      "    }\n" +
      "  }\n" +
      "}";

    /* ---------- 이벤트 ---------- */

    function wire() {
      var edit = App.$("#editCfg", mount);
      if (edit) edit.addEventListener("click", function () { showSetup = true; draw(); });

      var save = App.$("#saveCfg", mount);
      if (save) save.addEventListener("click", function () {
        var r = Sync.parseConfig(App.$("#cfgBox", mount).value);
        if (r.error) { App.toast(r.error); return; }
        Sync.saveConfig(r.config);
        App.toast("설정을 저장했습니다. 이제 로그인하세요.");
        showSetup = false;
        Sync.init().then(draw).catch(function (e) { App.toast(e.message); draw(); });
      });

      var clear = App.$("#clearCfg", mount);
      if (clear) clear.addEventListener("click", function () {
        if (!confirm("Firebase 설정을 지울까요?\n\n이 기기의 기록은 그대로 남습니다.")) return;
        Sync.signOut();
        Sync.clearConfig();
        App.toast("설정을 지웠습니다");
        showSetup = false;
        draw();
      });

      var rules = App.$("#showRules", mount);
      if (rules) rules.addEventListener("click", function () { showRules = !showRules; draw(); });

      var copyR = App.$("#copyRules", mount);
      if (copyR) copyR.addEventListener("click", function () {
        var ta = document.createElement("textarea");
        ta.value = RULES;
        ta.style.position = "fixed"; ta.style.left = "-9999px";
        document.body.appendChild(ta); ta.select();
        try { document.execCommand("copy"); App.toast("규칙을 복사했습니다"); }
        catch (e) { App.toast("복사에 실패했습니다. [규칙 보기] 로 직접 복사하세요."); }
        document.body.removeChild(ta);
      });

      var si = App.$("#signIn", mount);
      if (si) si.addEventListener("click", function () {
        si.disabled = true;
        Sync.signIn().then(function () {
          App.toast("로그인했습니다. 기록을 맞추는 중…");
          draw();
        }).catch(function (e) {
          App.toast(e.message);
          draw();
        });
      });

      var so = App.$("#signOut", mount);
      if (so) so.addEventListener("click", function () {
        if (!confirm("로그아웃할까요?\n\n이 기기의 기록은 그대로 남습니다.")) return;
        Sync.signOut().then(function () { App.toast("로그아웃했습니다"); draw(); });
      });

      var now = App.$("#syncNow", mount);
      if (now) now.addEventListener("click", function () {
        Sync.pull().then(function () { return Sync.push(); })
          .then(function () { App.toast("동기화했습니다"); draw(); })
          .catch(function (e) { App.toast(e.message); draw(); });
      });

      var fp = App.$("#forcePush", mount);
      if (fp) fp.addEventListener("click", function () {
        if (!confirm("클라우드 기록을 지우고 이 기기 것으로 덮어씁니다.\n\n" +
                     "다른 기기에만 있던 기록은 사라집니다. 계속할까요?")) return;
        Sync.forcePush().then(function () { App.toast("이 기기 것으로 맞췄습니다"); draw(); })
          .catch(function (e) { App.toast(e.message); draw(); });
      });

      var fl = App.$("#forcePull", mount);
      if (fl) fl.addEventListener("click", function () {
        if (!confirm("이 기기 기록을 지우고 클라우드 것으로 덮어씁니다.\n\n" +
                     "이 기기에만 있던 기록은 사라집니다. 계속할까요?")) return;
        Sync.forcePull().then(function () { App.toast("클라우드 것으로 맞췄습니다"); App.render(); })
          .catch(function (e) { App.toast(e.message); draw(); });
      });
    }

    draw();
  }
});
