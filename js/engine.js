/* ตัวคำนวณตารางเวร — ทำงานในเบราว์เซอร์ จากข้อมูลที่ดึงมาจาก Google Sheets
   วันที่ 1 ธ.ค. 2569 = วันที่ 1 ของระบบ (EPOCH) */
(function () {
  var EPOCH = Date.UTC(2026, 11, 1);
  var CORE_B = ['wichan', 'nopong'];       // คู่ B
  var CORE_A = ['thanaphum', 'kittiphat']; // คู่ A
  var CORE = CORE_B.concat(CORE_A);
  var TH_MONTH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  var TH_SHORT = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

  function absOf(y, m, d) { return Math.round((Date.UTC(y, m, d) - EPOCH) / 864e5) + 1; }
  function absOfIso(iso) { var p = String(iso).split('-'); return absOf(+p[0], +p[1] - 1, +p[2]); }
  function daysIn(y, m) { return new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); }
  function wdOf(y, m, d) { return new Date(Date.UTC(y, m, d)).getUTCDay(); }

  // เรียงชื่อ: ยศ ชื่อ นามสกุล
  function parseName(name) {
    var m = String(name || '').match(/^((?:[^\s.]+\.)+(?:\([^)]*\))?)\s*(.*)$/);
    var rank = m ? m[1] : '', rest = m ? m[2] : String(name || '');
    var sp = rest.indexOf(' ');
    return { rank: rank, first: sp < 0 ? rest : rest.slice(0, sp), last: sp < 0 ? '' : rest.slice(sp + 1) };
  }

  function effQ(p) { return p.queue || (/^จ\.ส\./.test(p.name) ? 'g' : 'w'); }
  function build(people, leaves, config, cap) {
    var byKey = {};
    people.forEach(function (p) { byKey[p.key] = p; });
    var horizon = parseInt(config.horizon, 10) || 14;

    // เดือนทั้งหมดที่ต้องคำนวณ เริ่ม ธ.ค. 2569
    var months = [];
    var abs0 = 1;
    for (var i = 0; i < horizon; i++) {
      var y = 2026 + Math.floor((11 + i) / 12), m = (11 + i) % 12;
      var n = daysIn(y, m);
      months.push({ key: y + '-' + (m < 9 ? '0' : '') + (m + 1), y: y, m: m, N: n, base: abs0 - 1, mi: i });
      abs0 += n;
    }
    var lastAbs = abs0 - 1;
    var starts = months.map(function (mo) { return mo.base + 1; });

    function secOf(id) { return byKey[id] ? byKey[id].section : null; }
    function inRot(id) { return secOf(id) === 'rot'; }
    function coreBlocked(id) { return CORE.indexOf(id) >= 0 && secOf(id) !== 'ch'; }
    var L = (leaves || []).map(function (l) {
      return { id: l.id, key: l.key, type: l.type, a1: absOfIso(l.from), a2: absOfIso(l.to), from: l.from, to: l.to };
    });
    function leaveAtAbs(id, a) {
      for (var i = 0; i < L.length; i++) if (L[i].key === id && a >= L[i].a1 && a <= L[i].a2) return L[i];
      return null;
    }
    function blockedAbs(id, a) { return coreBlocked(id) || !!leaveAtAbs(id, a); }

    function qList(kind) {
      return people.filter(function (p) { return !p.core && p.section === 'rot' && effQ(p) === kind; })
        .sort(function (a, b) { return (+a.ord) - (+b.ord); }).map(function (p) { return p.key; });
    }
    var Q = { w: { list: qList('w'), ptr: 0, owed: [] }, g: { list: qList('g'), ptr: 0, owed: [] } };
    function pick(k, a) {
      var q = Q[k], i;
      for (i = 0; i < q.owed.length; i++) {
        if (!blockedAbs(q.owed[i], a)) return q.owed.splice(i, 1)[0];
      }
      for (var n = 0; n < q.list.length; n++) {
        var p = q.list[q.ptr];
        q.ptr = (q.ptr + 1) % q.list.length;
        if (q.owed.indexOf(p) >= 0) continue;
        if (!blockedAbs(p, a)) return p;
        q.owed.push(p);
      }
      return null;
    }

    // ช่วงเวร 2 วัน ของ 4 คน (A/B) พร้อมกฎ "เบิ้ลต่อ" ที่รอยต่อเดือน
    var info = {};
    function monthIdxOf(a) { for (var i = months.length - 1; i >= 0; i--) if (a > months[i].base) return i; return 0; }
    info[1] = { p: 'B', pos: 1, mi: -1 };
    info[2] = { p: 'B', pos: 0, mi: 0 };
    info[3] = { p: 'B', pos: 1, mi: 0 };
    (function () {
      var x = 4, prev = 'B', force = false;
      while (x <= lastAbs) {
        var isStart = starts.indexOf(x) >= 0;
        var pp = (force || isStart) ? prev : (prev === 'A' ? 'B' : 'A');
        force = false;
        info[x] = { p: pp, pos: 0, mi: monthIdxOf(x) };
        if (x + 1 <= lastAbs) {
          var nxtStart = starts.indexOf(x + 1) >= 0;
          info[x + 1] = { p: pp, pos: 1, mi: nxtStart ? monthIdxOf(x) : monthIdxOf(x + 1) };
          if (nxtStart) force = true;
        }
        prev = pp; x += 2;
      }
    })();

    var out = {};
    months.forEach(function (mo) { out[mo.key] = { svD: {}, bk: {}, assigned: [] }; });
    var idx = parseInt(config.idx0, 10);
    if (isNaN(idx)) idx = 31;
    var curSv = {}, svCnt = { A: 0, B: 1 };

    // ---- ล็อกตารางย้อนหลัง: วันที่ผ่านมาแล้วใช้ที่บันทึกไว้ ไม่คำนวณใหม่ ----
    var LK = (config && config.lock && config.lock.upTo) ? config.lock : null;
    var lockAbs = LK ? absOfIso(LK.upTo) : 0;
    var captured = null;
    function snap(upTo) {
      var days = {};
      for (var x = 1; x <= upTo; x++) {
        var mx = months[monthIdxOf(x)], dx = x - mx.base, Ox = out[mx.key];
        if (Ox.svD[dx]) days[x] = Ox.svD[dx].id + '|' + (Ox.svD[dx].type === 'sp' ? 'p' : 'v');
        else if (Ox.bk[dx]) days[x] = 'b:' + Ox.bk[dx].join(',');
      }
      function qs(q) { return { ptr: q.ptr, key: q.list.length ? q.list[q.ptr % q.list.length] : '', owed: q.owed.slice() }; }
      return { days: days, st: { idx: idx, w: qs(Q.w), g: qs(Q.g), svCnt: { A: svCnt.A, B: svCnt.B }, curSv: { A: curSv.A || '', B: curSv.B || '' } } };
    }
    function restore(st) {
      idx = st.idx; svCnt = { A: st.svCnt.A, B: st.svCnt.B };
      curSv = {}; if (st.curSv.A) curSv.A = st.curSv.A; if (st.curSv.B) curSv.B = st.curSv.B;
      ['w', 'g'].forEach(function (k) {
        var q = Q[k], sq = st[k], ix = q.list.indexOf(sq.key);
        q.ptr = ix >= 0 ? ix : (q.list.length ? Math.min(sq.ptr, q.list.length - 1) : 0);
        q.owed = sq.owed.filter(function (id) { return !!byKey[id]; });
      });
    }
    for (var a = 1; a <= lastAbs; a++) {
      if (cap && a === cap + 1) captured = snap(cap);
      var mo = months[monthIdxOf(a)];
      var d = a - mo.base;
      var O = out[mo.key];
      if (a <= lockAbs) {
        var ent = LK.days[a];
        if (ent) {
          if (ent.indexOf('b:') === 0) O.bk[d] = ent.slice(2).split(',');
          else {
            var pr = ent.split('|');
            O.svD[d] = { id: pr[0], type: pr[1] === 'p' ? 'sp' : 'sv' };
            if (CORE.indexOf(pr[0]) < 0 && byKey[pr[0]] && O.assigned.indexOf(pr[0]) < 0) O.assigned.push(pr[0]);
          }
        }
        if (a === lockAbs && LK.st) restore(LK.st);
        continue;
      }
      var cands = null;
      if (a === 1) cands = ['wichan', 'nopong'];
      else {
        var f = info[a];
        var isB = f.p === 'B';
        var bSv = ((f.mi % 2) + 2) % 2 === 1;
        var pairSv = isB ? bSv : !bSv;
        if (pairSv) {
          var LS = isB ? CORE_B : CORE_A;
          if (f.pos === 0 || !curSv[f.p]) curSv[f.p] = LS[svCnt[f.p]++ % 2];
          cands = [curSv[f.p], LS[0] === curSv[f.p] ? LS[1] : LS[0]];
        } else O.bk[d] = isB ? CORE_B.slice() : CORE_A.slice();
      }
      if (cands) {
        var c = null;
        for (var ci = 0; ci < cands.length; ci++) if (!blockedAbs(cands[ci], a)) { c = cands[ci]; break; }
        if (c) { O.svD[d] = { id: c, type: 'sv' }; continue; }
      }
      var green = idx % 3 === 2;
      idx++;
      var p = pick(green ? 'g' : 'w', a) || pick(green ? 'w' : 'g', a);
      if (p) {
        O.svD[d] = { id: p, type: (byKey[p] && effQ(byKey[p]) === 'g') ? 'sp' : 'sv' };
        if (O.assigned.indexOf(p) < 0) O.assigned.push(p);
      }
    }

    if (cap && !captured && cap >= lastAbs) captured = snap(Math.min(cap, lastAbs));
    var res = {};
    months.forEach(function (mo) {
      var O = out[mo.key];
      var rows = CORE.filter(function (id) { return !!byKey[id]; }).concat(O.assigned);
      L.forEach(function (l) {
        var lo = l.a1, hi = l.a2;
        if (hi > mo.base && lo <= mo.base + mo.N && rows.indexOf(l.key) < 0 && byKey[l.key]) rows.push(l.key);
      });
      res[mo.key] = {
        key: mo.key, y: mo.y, m: mo.m, N: mo.N, base: mo.base,
        short: TH_SHORT[mo.m], title: TH_MONTH[mo.m] + ' ' + (mo.y + 543),
        wd: function (d) { return wdOf(mo.y, mo.m, d); },
        svD: O.svD, bk: O.bk, rows: rows, draft: true,
        bkOf: function (d) { return O.bk[d] || []; },
        leaveAt: function (id, d) { return leaveAtAbs(id, mo.base + d); },
        roleOf: function (id, d) {
          if (mo.base + d <= lockAbs) {
            if (O.svD[d] && O.svD[d].id === id) return O.svD[d].type;
            var bl = O.bk[d];
            if (bl && bl.indexOf(id) >= 0) return 'bk';
          }
          var lv = leaveAtAbs(id, mo.base + d);
          if (lv) return lv.type === 'ลา' ? 'lv' : 'bz';
          if (O.svD[d] && O.svD[d].id === id) return O.svD[d].type;
          var b = O.bk[d];
          if (b && b.indexOf(id) >= 0 && !coreBlocked(id)) return 'bk';
          return null;
        }
      };
    });
    return { months: months.map(function (m) { return res[m.key]; }), byKey: byKey, captured: captured };
  }

  // เดือน พ.ย. 2569 จากตารางที่จัดไว้แล้ว (คงที่ ไม่คำนวณใหม่)
  function novModel(byKey) {
    var SV = { 1: 'adison', 2: 'nopong', 3: 'nopong', 4: 'anurak', 5: 'korawut', 6: 'wichan', 7: 'wichan', 8: 'ekkaphop', 9: 'suparit', 10: 'nopong', 11: 'nopong', 12: 'phanu', 13: 'warakorn', 14: 'wichan', 15: 'wichan', 16: 'rit', 17: 'nikom', 18: 'nopong', 19: 'nopong', 20: 'narawut', 21: 'chanaphon', 22: 'wichan', 23: 'wichan', 24: 'thatphon', 25: 'banrot', 26: 'nopong', 27: 'nopong', 28: 'nattaphat', 29: 'rattakiat', 30: 'wichan' };
    var BK = { 1: 1, 4: 1, 5: 1, 8: 1, 9: 1, 12: 1, 13: 1, 16: 1, 17: 1, 20: 1, 21: 1, 24: 1, 25: 1, 28: 1, 29: 1 };
    var svD = {};
    Object.keys(SV).forEach(function (k) {
      var p = byKey[SV[k]];
      svD[k] = { id: SV[k], type: p && effQ(p) === 'g' ? 'sp' : 'sv' };
    });
    var rows = ['wichan', 'nopong', 'thanaphum', 'kittiphat', 'adison', 'anurak', 'korawut', 'ekkaphop', 'suparit', 'phanu', 'warakorn', 'rit', 'nikom', 'narawut', 'chanaphon', 'thatphon', 'banrot', 'nattaphat', 'rattakiat'].filter(function (id) { return !!byKey[id]; });
    var bkIds = ['thanaphum', 'kittiphat'];
    var bk = {};
    Object.keys(BK).forEach(function (k) { bk[k] = bkIds; });
    return {
      key: '2026-11', y: 2026, m: 10, N: 30, base: -30, short: TH_SHORT[10], title: 'พฤศจิกายน 2569',
      wd: function (d) { return wdOf(2026, 10, d); }, svD: svD, bk: bk, rows: rows, draft: false,
      bkOf: function () { return bkIds; }, leaveAt: function () { return null; },
      roleOf: function (id, d) {
        if (svD[d] && svD[d].id === id) return svD[d].type;
        if (bkIds.indexOf(id) >= 0 && BK[d]) return 'bk';
        return null;
      }
    };
  }

  function capture(people, leaves, config, untilIso) {
    var cap = absOfIso(untilIso);
    if (cap < 1) return null;
    if (config && config.lock && config.lock.upTo && absOfIso(config.lock.upTo) >= cap) return config.lock;
    var r = build(people, leaves, config, cap);
    if (!r.captured) return null;
    return { upTo: untilIso, days: r.captured.days, st: r.captured.st };
  }

  window.Engine = { build: build, capture: capture, novModel: novModel, parseName: parseName, absOfIso: absOfIso, CORE: CORE, TH_MONTH: TH_MONTH, TH_SHORT: TH_SHORT, daysIn: daysIn };
})();
