/* ============================================================
   구글 캘린더 연동
   ------------------------------------------------------------
   세 가지 방법을 둔다. 위에서부터 설정이 필요 없다.

   1) 한 건씩 보내기 — 구글 캘린더 '일정 만들기' 화면을 미리 채워서 연다.
      로그인만 되어 있으면 되고 설정이 전혀 필요 없다.
   2) 파일로 한 번에 — .ics 파일을 만들어 구글 캘린더에서 가져오기.
      일정이 여러 개일 때 편하다. 다른 캘린더 앱에서도 열린다.
   3) API 로 바로 넣기 — 구글에서 받은 클라이언트 ID 가 있어야 한다.
      한 번 연결해 두면 버튼 한 번으로 캘린더에 들어간다.

   연동은 하지 않아도 앱은 그대로 다 쓸 수 있다.
   ============================================================ */

var GCal = (function () {

  var TZ = "Asia/Seoul";
  var SCOPE = "https://www.googleapis.com/auth/calendar.events";

  /* ---------- 날짜 형식 ---------- */

  function ymd(dateStr) { return String(dateStr || "").replace(/-/g, ""); }

  /* 종일 일정의 끝날짜는 '그 다음 날' 로 적어야 한다 (끝은 포함하지 않는다) */
  function nextDay(dateStr) {
    var d = new Date(dateStr + "T00:00:00");
    d.setDate(d.getDate() + 1);
    return d.getFullYear() +
           String(d.getMonth() + 1).padStart(2, "0") +
           String(d.getDate()).padStart(2, "0");
  }

  function hhmmss(time) {
    var p = String(time || "09:00").split(":");
    return String(p[0] || "09").padStart(2, "0") + String(p[1] || "00").padStart(2, "0") + "00";
  }

  /* 시각이 붙은 일정은 1시간짜리로 잡는다 */
  function plusHour(time) {
    var p = String(time || "09:00").split(":");
    var h = (Number(p[0]) + 1) % 24;
    return String(h).padStart(2, "0") + String(p[1] || "00").padStart(2, "0") + "00";
  }

  function title(s) {
    return "[" + App.KIND_LABEL[s.kind] + "] " + s.title;
  }

  function details(s) {
    var parts = [];
    if (s.subject) parts.push("과목: " + s.subject);
    if (s.memo) parts.push(s.memo);
    parts.push("— 시험기간 화이팅!");
    return parts.join("\n");
  }

  /* ---------- 1) 한 건씩 — 구글 캘린더 새 일정 화면 ---------- */

  function googleLink(s) {
    var start = App.startOf(s), end = App.endOf(s);
    if (!start) return null;

    var dates;
    if (s.time) {
      dates = ymd(start) + "T" + hhmmss(s.time) + "/" + ymd(end) + "T" + plusHour(s.time);
    } else {
      dates = ymd(start) + "/" + nextDay(end);
    }

    return "https://calendar.google.com/calendar/render" +
      "?action=TEMPLATE" +
      "&text=" + encodeURIComponent(title(s)) +
      "&dates=" + dates +
      "&details=" + encodeURIComponent(details(s)) +
      "&ctz=" + encodeURIComponent(TZ);
  }

  /* ---------- 2) 파일로 한 번에 — .ics ---------- */

  function esc(t) {
    return String(t || "")
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  /* ics 는 한 줄이 75바이트를 넘으면 안 된다.
     한글은 한 글자가 3바이트라 글자 수가 아니라 바이트로 끊어야 한다. */
  function fold(line) {
    var out = [], cur = "", bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      var n = encodeURIComponent(ch).replace(/%../g, "x").length;
      if (bytes + n > 72) { out.push(cur); cur = " "; bytes = 1; }
      cur += ch; bytes += n;
    }
    out.push(cur);
    return out.join("\r\n");
  }

  function stamp() {
    return new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  }

  function toIcs(items) {
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//시험기간 화이팅!//KO",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:시험기간 일정"
    ];

    items.forEach(function (s) {
      var start = App.startOf(s), end = App.endOf(s);
      if (!start) return;

      lines.push("BEGIN:VEVENT");
      lines.push("UID:" + s.id + "@examhub");
      lines.push("DTSTAMP:" + stamp());

      if (s.time) {
        lines.push("DTSTART;TZID=" + TZ + ":" + ymd(start) + "T" + hhmmss(s.time));
        lines.push("DTEND;TZID=" + TZ + ":" + ymd(end) + "T" + plusHour(s.time));
      } else {
        lines.push("DTSTART;VALUE=DATE:" + ymd(start));
        lines.push("DTEND;VALUE=DATE:" + nextDay(end));
      }

      lines.push(fold("SUMMARY:" + esc(title(s))));
      lines.push(fold("DESCRIPTION:" + esc(details(s))));
      if (s.kind === "exam") lines.push("CATEGORIES:시험");
      lines.push("END:VEVENT");
    });

    lines.push("END:VCALENDAR");
    return lines.join("\r\n");
  }

  function downloadIcs(items) {
    var text = toIcs(items);
    var blob = new Blob(["﻿" + text], { type: "text/calendar;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "시험기간_일정_" + App.todayStr() + ".ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  }

  /* ---------- 3) API 로 바로 넣기 ---------- */

  var token = null;
  var gisLoaded = false;

  function loadGis() {
    return new Promise(function (resolve, reject) {
      if (gisLoaded && window.google && google.accounts) return resolve();
      if (document.getElementById("gis-script")) {
        /* 이미 넣어 뒀는데 아직 안 떴으면 잠깐 기다린다 */
        var tries = 0;
        var timer = setInterval(function () {
          if (window.google && google.accounts) { clearInterval(timer); gisLoaded = true; resolve(); }
          else if (++tries > 40) { clearInterval(timer); reject(new Error("구글 스크립트를 불러오지 못했습니다")); }
        }, 100);
        return;
      }
      var s = document.createElement("script");
      s.id = "gis-script";
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = function () { gisLoaded = true; resolve(); };
      s.onerror = function () { reject(new Error("구글 스크립트를 불러오지 못했습니다. 인터넷 연결을 확인하세요.")); };
      document.head.appendChild(s);
    });
  }

  /* 구글 로그인 창을 띄워 권한을 받는다 */
  function connect(clientId) {
    return loadGis().then(function () {
      return new Promise(function (resolve, reject) {
        var client = google.accounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: SCOPE,
          callback: function (res) {
            if (res && res.access_token) { token = res.access_token; resolve(token); }
            else reject(new Error("권한을 받지 못했습니다"));
          },
          error_callback: function (err) {
            reject(new Error((err && err.message) || "연결이 취소되었습니다"));
          }
        });
        client.requestAccessToken();
      });
    });
  }

  function isConnected() { return !!token; }

  /* 연결을 끊는다. 구글 쪽에 준 권한도 같이 거둔다. */
  function disconnect() {
    var t = token;
    token = null;
    if (t && window.google && google.accounts && google.accounts.oauth2) {
      try { google.accounts.oauth2.revoke(t); } catch (e) { /* 이미 만료됐으면 그만 */ }
    }
  }

  function eventBody(s) {
    var start = App.startOf(s), end = App.endOf(s);
    var body = { summary: title(s), description: details(s) };

    if (s.time) {
      body.start = { dateTime: start + "T" + s.time + ":00", timeZone: TZ };
      var h = (Number(s.time.split(":")[0]) + 1) % 24;
      body.end = { dateTime: end + "T" + String(h).padStart(2, "0") + ":" + s.time.split(":")[1] + ":00", timeZone: TZ };
    } else {
      var e = new Date(end + "T00:00:00");
      e.setDate(e.getDate() + 1);
      body.start = { date: start };
      body.end = { date: e.getFullYear() + "-" +
                         String(e.getMonth() + 1).padStart(2, "0") + "-" +
                         String(e.getDate()).padStart(2, "0") };
    }
    return body;
  }

  /* 일정들을 캘린더에 넣는다. {ok, fail, errors} 를 돌려준다 */
  function push(items) {
    if (!token) return Promise.reject(new Error("먼저 연결해 주세요"));

    var ok = 0, fail = 0, errors = [];
    var chain = Promise.resolve();

    items.forEach(function (s) {
      chain = chain.then(function () {
        return fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
          method: "POST",
          headers: { "Authorization": "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify(eventBody(s))
        }).then(function (r) {
          if (r.ok) { ok++; return; }
          fail++;
          return r.json().then(function (j) {
            errors.push(s.title + ": " + ((j.error && j.error.message) || r.status));
          }).catch(function () { errors.push(s.title + ": " + r.status); });
        }).catch(function (e) {
          fail++; errors.push(s.title + ": " + e.message);
        });
      });
    });

    return chain.then(function () { return { ok: ok, fail: fail, errors: errors }; });
  }

  return {
    googleLink: googleLink,
    toIcs: toIcs,
    downloadIcs: downloadIcs,
    connect: connect,
    isConnected: isConnected,
    disconnect: disconnect,
    push: push
  };
})();
