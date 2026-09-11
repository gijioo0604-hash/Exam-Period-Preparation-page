/* ============================================================
   QR 코드 만들기 (인터넷 없이, 이 파일 하나로)
   ------------------------------------------------------------
   전에는 cdnjs 에서 qrcode.min.js 를 받아 썼습니다.
   그러면 인터넷이 없을 때 QR 이 안 나오고, 무엇보다
   "이 사이트는 밖에서 아무것도 안 받아온다" 는 말이 거짓이 됩니다.
   그래서 QR 만드는 일을 직접 넣었습니다.

   범위: 바이트 모드 · 오류정정 M · 버전 1~9 (최대 180바이트)
        주소 하나 담기에는 넉넉합니다.

   쓰는 법
     QR.draw(도화지element, "담을 문자열")
   ============================================================ */

var QR = (function () {
  "use strict";

  /* ---------- 버전별 표 (오류정정 M) ----------
     ec    : 블록 하나당 오류정정 코드워드 수
     blocks: [블록 수, 블록 하나당 데이터 코드워드 수] 묶음
     align : 정렬 패턴 중심 좌표 */

  var VER = [
    null,
    { ec: 10, blocks: [[1, 16]],           align: [] },
    { ec: 16, blocks: [[1, 28]],           align: [6, 18] },
    { ec: 26, blocks: [[1, 44]],           align: [6, 22] },
    { ec: 18, blocks: [[2, 32]],           align: [6, 26] },
    { ec: 24, blocks: [[2, 43]],           align: [6, 30] },
    { ec: 16, blocks: [[4, 27]],           align: [6, 34] },
    { ec: 18, blocks: [[4, 31]],           align: [6, 22, 38] },
    { ec: 22, blocks: [[2, 38], [2, 39]],  align: [6, 24, 42] },
    { ec: 22, blocks: [[3, 36], [2, 37]],  align: [6, 26, 46] }
  ];

  function dataCodewords(v) {
    var n = 0;
    VER[v].blocks.forEach(function (b) { n += b[0] * b[1]; });
    return n;
  }

  /* ---------- 갈루아 체 GF(256) ----------
     오류정정 코드는 보통의 덧셈·곱셈이 아니라 이 체 위에서 계산합니다.
     미리 지수표·로그표를 만들어 두면 곱셈이 덧셈으로 바뀝니다. */

  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) {
      EXP[i] = x;
      LOG[x] = i;
      x <<= 1;
      if (x & 0x100) x ^= 0x11d;          // 원시 다항식
    }
    for (var j = 255; j < 512; j++) EXP[j] = EXP[j - 255];
  })();

  function mul(a, b) {
    if (a === 0 || b === 0) return 0;
    return EXP[LOG[a] + LOG[b]];
  }

  /* 오류정정 코드워드 ecLen 개를 만드는 생성 다항식 */
  function genPoly(ecLen) {
    var g = [1];
    for (var i = 0; i < ecLen; i++) {
      var ng = new Array(g.length + 1);
      for (var k = 0; k < ng.length; k++) ng[k] = 0;
      for (var j = 0; j < g.length; j++) {
        ng[j] ^= mul(g[j], EXP[i]);
        ng[j + 1] ^= g[j];
      }
      g = ng;
    }
    /* 위 계산은 상수항부터 쌓이므로, 나눗셈에서 쓰기 좋게
       최고차항이 앞에 오도록 뒤집는다. (g[0] 이 항상 1) */
    return g.reverse();
  }

  /* 데이터 코드워드에 대한 오류정정 코드워드 (나머지 연산) */
  function ecBytes(data, ecLen) {
    var g = genPoly(ecLen);
    var rem = new Array(ecLen);
    for (var i = 0; i < ecLen; i++) rem[i] = 0;

    for (var d = 0; d < data.length; d++) {
      var factor = data[d] ^ rem[0];
      rem.shift();
      rem.push(0);
      if (factor !== 0) {
        for (var j = 0; j < ecLen; j++) rem[j] ^= mul(g[j + 1], factor);
      }
    }
    return rem;
  }

  /* ---------- BCH — 형식 정보와 버전 정보의 검사 비트 ---------- */

  function bchRemainder(v, poly) {
    var d = v;
    var polyDeg = 0, t = poly;
    while (t > 1) { t >>= 1; polyDeg++; }
    while (bitLen(d) > polyDeg) d ^= poly << (bitLen(d) - polyDeg - 1);
    return d;
  }

  function bitLen(n) {
    var c = 0;
    while (n) { n >>= 1; c++; }
    return c;
  }

  /* 형식 정보 15비트: (오류정정 2비트 + 마스크 3비트) + BCH(15,5) + 고정 마스크 */
  function formatBits(mask) {
    var ecBitsM = 0;                      // 오류정정 M = 00
    var data = (ecBitsM << 3) | mask;     // 5비트
    var rem = bchRemainder(data << 10, 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  }

  /* 버전 정보 18비트 (버전 7 이상에서만 넣습니다) */
  function versionBits(v) {
    var rem = bchRemainder(v << 12, 0x1f25);
    return (v << 12) | rem;
  }

  /* ---------- 문자열을 비트로 ---------- */

  function utf8(str) {
    var out = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) {
        out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
      } else if (c >= 0xd800 && c <= 0xdbff && i + 1 < str.length) {
        var lo = str.charCodeAt(i + 1);
        var cp = 0x10000 + ((c - 0xd800) << 10) + (lo - 0xdc00);
        i++;
        out.push(0xf0 | (cp >> 18), 0x80 | ((cp >> 12) & 0x3f),
                 0x80 | ((cp >> 6) & 0x3f), 0x80 | (cp & 0x3f));
      } else {
        out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
      }
    }
    return out;
  }

  function pickVersion(len) {
    for (var v = 1; v <= 9; v++) {
      /* 4비트 모드 + 8비트 길이 + 데이터 */
      if (4 + 8 + len * 8 <= dataCodewords(v) * 8) return v;
    }
    return 0;                              // 너무 깁니다
  }

  function makeCodewords(bytes, v) {
    var total = dataCodewords(v);
    var bits = [];
    function push(val, n) {
      for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1);
    }

    push(4, 4);                            // 바이트 모드
    push(bytes.length, 8);                 // 버전 1~9 는 길이가 8비트
    bytes.forEach(function (b) { push(b, 8); });

    /* 종단부 0000 — 자리가 모자라면 있는 만큼만 */
    var room = total * 8 - bits.length;
    push(0, Math.min(4, room));
    while (bits.length % 8) bits.push(0);  // 바이트 경계 맞추기

    var cw = [];
    for (var i = 0; i < bits.length; i += 8) {
      var b = 0;
      for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    /* 남은 자리는 정해진 두 값을 번갈아 채웁니다 */
    var pad = [0xec, 0x11], k = 0;
    while (cw.length < total) cw.push(pad[k++ % 2]);
    return cw;
  }

  /* 블록으로 쪼개 오류정정을 붙이고, 정해진 순서로 섞습니다 */
  function interleave(cw, v) {
    var spec = VER[v];
    var blocks = [], ecs = [], at = 0;

    spec.blocks.forEach(function (grp) {
      for (var i = 0; i < grp[0]; i++) {
        var d = cw.slice(at, at + grp[1]);
        at += grp[1];
        blocks.push(d);
        ecs.push(ecBytes(d, spec.ec));
      }
    });

    var out = [], maxD = 0, bi;
    for (bi = 0; bi < blocks.length; bi++) maxD = Math.max(maxD, blocks[bi].length);
    for (var i2 = 0; i2 < maxD; i2++) {
      for (bi = 0; bi < blocks.length; bi++) {
        if (i2 < blocks[bi].length) out.push(blocks[bi][i2]);
      }
    }
    for (var e = 0; e < spec.ec; e++) {
      for (bi = 0; bi < ecs.length; bi++) out.push(ecs[bi][e]);
    }
    return out;
  }

  /* ---------- 격자 ---------- */

  function newGrid(n) {
    var g = [];
    for (var y = 0; y < n; y++) {
      g.push([]);
      for (var x = 0; x < n; x++) g[y].push(null);   // null = 아직 안 쓴 칸
    }
    return g;
  }

  function placeFinder(g, cx, cy) {
    for (var dy = -1; dy <= 7; dy++) {
      for (var dx = -1; dx <= 7; dx++) {
        var x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= g.length || y >= g.length) continue;
        var inRing = (dx >= 0 && dx <= 6 && dy >= 0 && dy <= 6);
        var dark = inRing &&
          (dx === 0 || dx === 6 || dy === 0 || dy === 6 ||
           (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4));
        g[y][x] = dark ? 1 : 0;
      }
    }
  }

  function placeAlign(g, v) {
    var pos = VER[v].align;
    if (!pos.length) return;
    var n = g.length;
    for (var a = 0; a < pos.length; a++) {
      for (var b = 0; b < pos.length; b++) {
        var cx = pos[a], cy = pos[b];
        /* 파인더 패턴과 겹치는 세 모서리는 건너뜁니다 */
        if ((cx <= 8 && cy <= 8) ||
            (cx <= 8 && cy >= n - 9) ||
            (cx >= n - 9 && cy <= 8)) continue;
        for (var dy = -2; dy <= 2; dy++) {
          for (var dx = -2; dx <= 2; dx++) {
            var m = Math.max(Math.abs(dx), Math.abs(dy));
            g[cy + dy][cx + dx] = (m === 1) ? 0 : 1;
          }
        }
      }
    }
  }

  function placeTiming(g) {
    var n = g.length;
    for (var i = 8; i < n - 8; i++) {
      var bit = (i % 2 === 0) ? 1 : 0;
      if (g[6][i] === null) g[6][i] = bit;
      if (g[i][6] === null) g[i][6] = bit;
    }
  }

  /* 형식·버전 정보가 들어갈 자리를 미리 막아 둡니다 (데이터가 못 들어가게) */
  function reserve(g, v) {
    var n = g.length, i;
    for (i = 0; i <= 8; i++) {
      if (g[8][i] === null) g[8][i] = 0;
      if (g[i][8] === null) g[i][8] = 0;
    }
    for (i = 0; i < 8; i++) {
      if (g[8][n - 1 - i] === null) g[8][n - 1 - i] = 0;
      if (g[n - 1 - i][8] === null) g[n - 1 - i][8] = 0;
    }
    g[n - 8][8] = 1;                      // 항상 검은 칸
    if (v >= 7) {
      for (i = 0; i < 6; i++) {
        for (var j = 0; j < 3; j++) {
          g[i][n - 11 + j] = 0;
          g[n - 11 + j][i] = 0;
        }
      }
    }
  }

  /* 오른쪽 아래부터 두 칸씩 지그재그로 올라가며 데이터를 놓습니다 */
  function placeData(g, cw) {
    var n = g.length, bit = 0, up = true;
    var total = cw.length * 8;

    function next() {
      if (bit >= total) return 0;
      var b = (cw[bit >> 3] >> (7 - (bit & 7))) & 1;
      bit++;
      return b;
    }

    for (var col = n - 1; col > 0; col -= 2) {
      if (col === 6) col--;               // 세로 타이밍 열은 건너뜁니다
      for (var r = 0; r < n; r++) {
        var y = up ? (n - 1 - r) : r;
        for (var c = 0; c < 2; c++) {
          var x = col - c;
          if (g[y][x] === null) g[y][x] = next();
        }
      }
      up = !up;
    }
  }

  var MASK = [
    function (x, y) { return (x + y) % 2 === 0; },
    function (x, y) { return y % 2 === 0; },
    function (x)    { return x % 3 === 0; },
    function (x, y) { return (x + y) % 3 === 0; },
    function (x, y) { return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0; },
    function (x, y) { return ((x * y) % 2) + ((x * y) % 3) === 0; },
    function (x, y) { return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; },
    function (x, y) { return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; }
  ];

  /* 어느 칸이 데이터 칸인지 (마스크는 데이터 칸에만 겁니다) */
  function dataMap(v) {
    var n = 17 + 4 * v;
    var g = newGrid(n);
    placeFinder(g, 0, 0);
    placeFinder(g, n - 7, 0);
    placeFinder(g, 0, n - 7);
    placeAlign(g, v);
    placeTiming(g);
    reserve(g, v);
    return g;                              // null 인 칸이 데이터 칸
  }

  function penalty(g) {
    var n = g.length, score = 0, x, y, i;

    /* 규칙 1 — 같은 색이 5칸 이상 이어지면 */
    function runs(get) {
      var s = 0;
      for (var a = 0; a < n; a++) {
        var run = 1;
        for (var b = 1; b < n; b++) {
          if (get(a, b) === get(a, b - 1)) run++;
          else { if (run >= 5) s += run - 2; run = 1; }
        }
        if (run >= 5) s += run - 2;
      }
      return s;
    }
    score += runs(function (a, b) { return g[a][b]; });
    score += runs(function (a, b) { return g[b][a]; });

    /* 규칙 2 — 같은 색 2×2 덩어리 */
    for (y = 0; y < n - 1; y++) {
      for (x = 0; x < n - 1; x++) {
        var v0 = g[y][x];
        if (v0 === g[y][x + 1] && v0 === g[y + 1][x] && v0 === g[y + 1][x + 1]) score += 3;
      }
    }

    /* 규칙 3 — 파인더 패턴과 헷갈리는 무늬 */
    var P1 = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];
    var P2 = [0, 0, 0, 0, 1, 0, 1, 1, 1, 0, 1];
    function match(line, p) {
      for (var k = 0; k < 11; k++) if (line[k] !== p[k]) return false;
      return true;
    }
    for (y = 0; y < n; y++) {
      for (x = 0; x + 11 <= n; x++) {
        var h = [], vt = [];
        for (i = 0; i < 11; i++) { h.push(g[y][x + i]); vt.push(g[x + i][y]); }
        if (match(h, P1) || match(h, P2)) score += 40;
        if (match(vt, P1) || match(vt, P2)) score += 40;
      }
    }

    /* 규칙 4 — 검은 칸 비율이 반에서 멀수록 */
    var dark = 0;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) if (g[y][x]) dark++;
    var pct = (dark * 100) / (n * n);
    score += Math.floor(Math.abs(pct - 50) / 5) * 10;

    return score;
  }

  function writeFormat(g, mask) {
    var n = g.length;
    var bitsv = formatBits(mask);
    function bitAt(i) { return (bitsv >> i) & 1; }

    /* 왼쪽 위 */
    for (var i = 0; i <= 5; i++) g[8][i] = bitAt(i);
    g[8][7] = bitAt(6);
    g[8][8] = bitAt(7);
    g[7][8] = bitAt(8);
    for (var j = 9; j <= 14; j++) g[14 - j][8] = bitAt(j);

    /* 오른쪽 위 · 왼쪽 아래 (같은 값을 한 번 더)
       0~6 번 비트는 아래쪽 세로줄, 7~14 번 비트는 오른쪽 가로줄 */
    for (var k = 0; k <= 6; k++) g[n - 1 - k][8] = bitAt(k);
    for (var m = 7; m <= 14; m++) g[8][n - 15 + m] = bitAt(m);
    g[n - 8][8] = 1;                      // 항상 검은 칸
  }

  function writeVersion(g, v) {
    if (v < 7) return;
    var n = g.length, bitsv = versionBits(v);
    for (var i = 0; i < 18; i++) {
      var b = (bitsv >> i) & 1;
      var a = Math.floor(i / 3), c = i % 3;
      g[a][n - 11 + c] = b;
      g[n - 11 + c][a] = b;
    }
  }

  /* ---------- 만들기 ---------- */

  function build(text) {
    var bytes = utf8(String(text));
    var v = pickVersion(bytes.length);
    if (!v) throw new Error("담을 내용이 너무 깁니다 (최대 180바이트)");

    var cw = interleave(makeCodewords(bytes, v), v);

    var free = dataMap(v);                 // null 인 칸 = 데이터 칸
    var base = newGrid(17 + 4 * v);
    var n = base.length, x, y;
    for (y = 0; y < n; y++) for (x = 0; x < n; x++) base[y][x] = free[y][x];
    placeData(base, cw);

    /* 여덟 가지 마스크를 다 걸어 보고 점수가 가장 낮은 것을 씁니다 */
    var best = null, bestScore = Infinity;
    for (var m = 0; m < 8; m++) {
      var g = [];
      for (y = 0; y < n; y++) {
        g.push([]);
        for (x = 0; x < n; x++) {
          var bit = base[y][x];
          if (free[y][x] === null && MASK[m](x, y)) bit ^= 1;
          g[y].push(bit);
        }
      }
      writeFormat(g, m);
      writeVersion(g, v);
      var s = penalty(g);
      if (s < bestScore) { bestScore = s; best = g; }
    }
    return best;
  }

  /* ---------- 그리기 ---------- */

  function draw(box, text, opt) {
    opt = opt || {};
    var g = build(text);
    var n = g.length;
    var quiet = opt.quiet === undefined ? 4 : opt.quiet;
    var size = opt.size || 260;
    var scale = Math.max(1, Math.floor(size / (n + quiet * 2)));
    var px = (n + quiet * 2) * scale;

    var cv = document.createElement("canvas");
    cv.width = px;
    cv.height = px;
    cv.style.width = "100%";
    cv.style.height = "100%";
    cv.setAttribute("role", "img");
    cv.setAttribute("aria-label", "이 사이트 주소 QR 코드");

    var ctx = cv.getContext("2d");
    ctx.fillStyle = opt.light || "#ffffff";
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = opt.dark || "#1a1d23";
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) {
        if (g[y][x]) {
          ctx.fillRect((x + quiet) * scale, (y + quiet) * scale, scale, scale);
        }
      }
    }

    box.innerHTML = "";
    box.appendChild(cv);
    return cv;
  }

  return { draw: draw, build: build };
})();
