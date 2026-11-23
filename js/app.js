/* หน้าเว็บตารางเวร สิบเวร — ร้อย.ทม.ที่ 2 ทม.รอ.พัน 2 */
(function () {
  var E = window.Engine;
  var WDF = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];
  var WD = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];
  var LABEL = { sv: 'สว.', sp: 'สว./ผช.', bk: 'เวร', lv: 'ลา', bz: 'กิจ' };
  var SEC_LABEL = { rot: 'หมุนเวียน', ch: 'ชรก.', ltc: 'LTC', mis: 'มีภารกิจ', tr: 'ปรับย้าย' };
  var DEMO = !window.API_URL;

  var st = {
    data: null, model: null, tab: 'view', mkey: null, sel: 1, q: '', statM: 'all',
    token: null, adminErr: '', busy: false, saveMsg: '',
    form: { leaveKey: '', leaveType: 'ลา', from: '', to: '', nName: '', nDest: 'rotw', nErr: '', pick: { tr: '', ch: '', ltc: '', mis: '' }, trNote: '', oldPw: '', newPw: '', pwMsg: '' }
  };
  try { st.token = sessionStorage.getItem('dr_token') || null; } catch (e) {}

  /* ---------- ตัวช่วย ---------- */
  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function bkkToday() {
    var n = new Date(Date.now() + 7 * 3600 * 1000);
    return { y: n.getUTCFullYear(), m: n.getUTCMonth(), d: n.getUTCDate() };
  }
  function iso(y, m, d) { return y + '-' + (m + 1 < 10 ? '0' : '') + (m + 1) + '-' + (d < 10 ? '0' : '') + d; }
  function thDate(isoStr) {
    var p = String(isoStr).split('-');
    return (+p[2]) + ' ' + E.TH_SHORT[+p[1] - 1] + ' ' + (((+p[0]) + 543) % 100);
  }
  function toast(msg, ms) {
    var t = $('#toast'); t.textContent = msg; t.style.display = 'block';
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.style.display = 'none'; }, ms || 2600);
  }
  function person(key) { return st.byKey[key]; }
  function nm(key) { var p = person(key); return p ? p.name : key; }
  function parts(key) { var p = person(key); return E.parseName(p ? p.name : key); }
  function isGreen(p) { return p.queue === 'g' || (p.queue === '' && /^จ\.ส\./.test(p.name)); }
  function home(p) { return (p.queue || /^x/.test(p.key)) ? 'rot' : 'ch'; }
  function bySec(sec, flt) {
    return st.data.people.filter(function (p) { return p.section === sec && !p.core && (!flt || flt(p)); })
      .sort(function (a, b) { return (+a.ord) - (+b.ord); });
  }
  function secPeople(sec, flt) {
    return st.data.people.filter(function (p) { return p.section === sec && (!flt || flt(p)); })
      .sort(function (a, b) { return (+a.ord) - (+b.ord); });
  }

  /* ---------- API ---------- */
  var demoDb = null;
  function api(action, body, method) {
    if (DEMO) return demoApi(action, body);
    var opts = method === 'GET' ? {} : { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(Object.assign({ action: action }, body || {})) };
    return fetch(window.API_URL + (method === 'GET' ? '?t=' + Date.now() : ''), opts).then(function (r) { return r.json(); });
  }
  function demoApi(action, body) {
    return new Promise(function (resolve) {
      if (!demoDb) demoDb = JSON.parse(JSON.stringify({ people: window.SEED.people, leaves: [], config: window.SEED.config, rev: 1 }));
      if (action === 'state') return resolve({ ok: true, state: JSON.parse(JSON.stringify(demoDb)) });
      if (action === 'login') return resolve(body.password === 'demo' ? { ok: true, token: 'demo' } : { ok: false, error: 'wrong_password', left: 4 });
      if (action === 'logout') return resolve({ ok: true });
      if (action === 'save') { demoDb.people = body.people; demoDb.leaves = body.leaves; demoDb.config = body.config; demoDb.rev++; return resolve({ ok: true, rev: demoDb.rev }); }
      if (action === 'changePassword') return resolve({ ok: false, error: 'demo' });
      resolve({ ok: false, error: 'unknown_action' });
    });
  }

  var saveChain = Promise.resolve();
  function persist() {
    st.saveMsg = 'กำลังบันทึก…'; paintSaveMsg();
    saveChain = saveChain.then(function () {
      return api('save', { token: st.token, rev: st.data.rev, people: st.data.people, leaves: st.data.leaves, config: st.data.config }).then(function (r) {
        if (r.ok) { st.data.rev = r.rev; st.saveMsg = 'บันทึกแล้ว'; paintSaveMsg(); return; }
        if (r.error === 'unauthorized') { doLogout(true); toast('หมดเวลาเข้าสู่ระบบ กรุณาใส่รหัสใหม่'); return; }
        if (r.error === 'stale' && r.state) { setData(r.state); st.saveMsg = ''; render(); toast('มีการแก้ไขจากที่อื่น โหลดข้อมูลล่าสุดแล้ว ลองทำรายการอีกครั้ง', 4200); return; }
        st.saveMsg = 'บันทึกไม่สำเร็จ'; paintSaveMsg();
        toast('บันทึกไม่สำเร็จ: ' + (r.error === 'duplicate_name' ? 'มีชื่อซ้ำ ' + (r.name || '') : (r.message || r.error)), 4200);
      }).catch(function () { st.saveMsg = 'บันทึกไม่สำเร็จ'; paintSaveMsg(); toast('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง', 4200); });
    });
  }
  function paintSaveMsg() { var el = $('#savemsg'); if (el) el.textContent = st.saveMsg; }

  function setData(d) {
    st.data = d;
    st.byKey = {};
    d.people.forEach(function (p) { st.byKey[p.key] = p; });
    var r = E.build(d.people, d.leaves, d.config);
    st.months = [E.novModel(st.byKey)].concat(r.months);
    st.model = {};
    st.months.forEach(function (m) { st.model[m.key] = m; });
  }

  /* ---------- วันนี้ / เดือนที่เลือก ---------- */
  function todayAbsInfo() {
    var t = bkkToday();
    return { key: t.y + '-' + (t.m + 1 < 10 ? '0' : '') + (t.m + 1), d: t.d, y: t.y, m: t.m };
  }
  function curMonth() { return st.model[st.mkey] || st.months[0]; }
  function isTodayIn(M, d) { var t = todayAbsInfo(); return M.key === t.key && d === t.d; }
  function monthLabel(M) { return M.short + ' ' + ((M.y + 543) % 100); }

  /* ---------- วาดหน้า ---------- */
  function render() {
    var app = $('#app');
    var M = curMonth();
    var h = '';
    h += '<header style="padding:28px 20px 8px 20px"><div style="font-size:12px;letter-spacing:.08em;color:#8A857C">ร้อย.ทม.ที่ 2 ทม.รอ.พัน 2</div>' +
      '<h1 style="margin:4px 0 0 0;font-family:\'Noto Serif Thai\',serif;font-weight:600;font-size:32px;line-height:1.25">ตารางเวร</h1>' +
      '<div style="margin-top:2px;font-size:15px;color:#8C5A45;font-weight:500">' + esc(M.title) + (M.draft ? ' (ร่าง)' : '') + '</div></header>';
    h += '<div style="padding:8px 16px 0 16px"><div style="display:flex;gap:4px;padding:4px;background:#EFE9DF;border-radius:999px">' +
      tabBtn('view', 'ตาราง') + tabBtn('stats', 'สถิติ') + tabBtn('admin', 'แอดมิน') + '</div></div>';
    h += '<main style="padding:16px 16px 0 16px;display:flex;flex-direction:column;gap:16px">';
    if (DEMO) h += '<div class="chip mut" style="align-self:flex-start">โหมดทดลอง · ยังไม่ได้เชื่อมหลังบ้าน ข้อมูลไม่ถูกบันทึกถาวร</div>';
    if (st.tab === 'view') h += viewHtml(M);
    else if (st.tab === 'stats') h += statsHtml();
    else h += st.token ? adminHtml() : gateHtml();
    h += '</main>';
    var keep = $('#gridscroll'), sl = keep ? keep.scrollLeft : null, stp = keep ? keep.scrollTop : null;
    app.innerHTML = h;
    bind();
    var g = $('#gridscroll');
    if (g) {
      if (st._scrollTo != null) { g.scrollLeft = Math.max(0, (st._scrollTo - 3) * 44); st._scrollTo = null; }
      else if (sl != null) { g.scrollLeft = sl; g.scrollTop = stp; }
    }
  }
  function tabBtn(k, label) { return '<button type="button" class="seg' + (st.tab === k ? ' on' : '') + '" data-act="tab" data-v="' + k + '">' + label + '</button>'; }

  /* ----- หน้าตาราง ----- */
  function viewHtml(M) {
    var h = '<div class="mons">';
    st.months.forEach(function (m) { h += '<button type="button" class="mon' + (m.key === M.key ? ' on' : '') + '" data-act="month" data-v="' + m.key + '">' + monthLabel(m) + '</button>'; });
    h += '</div>';
    h += selectedCard(M);
    h += '<section style="display:flex;flex-direction:column;gap:10px"><label for="q" style="font-size:14px;font-weight:500;color:#5D5A54;padding-left:6px">ค้นหาชื่อของคุณ</label>' +
      '<input id="q" type="text" value="' + esc(st.q) + '" placeholder="พิมพ์ชื่อ เช่น ณัฐภัทร" autocomplete="off" style="height:54px;box-sizing:border-box;width:100%;padding:0 22px;border:0;border-radius:999px;font-size:16px;background:#fff;color:#2B2A28;box-shadow:0 4px 18px rgba(60,40,20,.07)">' +
      '<div id="results">' + resultsHtml(M) + '</div></section>';
    h += '<section style="display:flex;flex-direction:column;gap:10px"><div style="display:flex;align-items:baseline;justify-content:space-between;padding:0 6px">' +
      '<h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:19px;font-weight:600">ตารางรายคน</h2><span style="font-size:12px;color:#8A857C">เลื่อนดูทั้งเดือน · หัววันที่และชื่อค้างไว้</span></div>' +
      '<div id="gridscroll" style="overflow:auto;overscroll-behavior:contain;max-height:600px;background:#fff;border-radius:24px;box-shadow:0 8px 28px rgba(60,40,20,.07)">' + gridHtml(M) + '</div></section>';
    h += '<section style="display:flex;flex-wrap:wrap;gap:10px 20px;padding:4px 8px">' +
      '<span class="legpill"><span class="pill sv">สว.</span>สิบเวร</span><span class="legpill"><span class="pill sp">สว./ผช.</span>สิบเวร + ผู้ช่วย</span>' +
      '<span class="legpill"><span class="pill bk">เวร</span>เวร บก.ร้อย</span><span class="legpill"><span class="pill lv">ลา</span>ลา</span><span class="legpill"><span class="pill bz">กิจ</span>ลากิจ</span></section>';
    h += headcountCard();
    h += listCards();
    h += '<footer style="font-size:12px;color:#8A857C;line-height:1.6;padding:8px 8px 0 8px">' + (M.draft ? 'ตารางเดือนนี้เป็นร่าง คำนวณจากกฎหมุนเวียนตามลำดับรายชื่อ ชุดสลับ 4 คนสลับบทบาทสิบเวร/เวร บก.ร้อย ทุกเดือน คนลาถูกตัดออกและกลับเข้าคิวอัตโนมัติ · ตารางอาจเปลี่ยนเมื่อแอดมินปรับรายชื่อ' : 'ข้อมูล พ.ย. จากตารางที่จัดไว้แล้ว · แอดมินเป็นผู้อัปเดตตาราง') + '</footer>';
    return h;
  }
  function selectedCard(M) {
    var sel = Math.min(st.sel, M.N), v = M.svD[sel];
    var h = '<section class="card" style="gap:14px"><div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><div style="font-size:14px;color:#8A857C">' +
      WDF[M.wd(sel)] + 'ที่ ' + sel + ' ' + M.title + '</div>' + (isTodayIn(M, sel) ? '<span class="pill sp">วันนี้</span>' : '') + '</div>';
    h += '<div style="display:flex;flex-direction:column;gap:6px"><span class="pill ' + (v ? v.type : 'lv') + '" style="align-self:flex-start">' + (v ? (v.type === 'sp' ? 'สว./ผช.' : 'สว.') : 'ยังไม่มีผู้ขึ้นเวร') + '</span>' +
      '<div style="font-family:\'Noto Serif Thai\',serif;font-size:22px;font-weight:600;line-height:1.35">' + (v ? esc(nm(v.id)) : '—') + '</div></div>';
    var bk = M.bkOf(sel).filter(function (id) { return M.bk[sel] && !M.leaveAt(id, sel) && person(id) && (M.draft ? person(id).section === 'ch' : true); });
    if (M.bk[sel] && bk.length) h += '<div style="display:flex;flex-direction:column;gap:6px;border-top:1px solid #F1ECE4;padding-top:14px"><span class="pill bk" style="align-self:flex-start">เวร บก.ร้อย</span><div style="font-size:16px;line-height:1.5">' + bk.map(function (id) { return esc(nm(id)); }).join(' และ ') + '</div></div>';
    return h + '</section>';
  }
  function gridHtml(M) {
    var matched = matchedIds();
    var cols = 'grid-template-columns:150px repeat(' + M.N + ',44px)';
    var t = todayAbsInfo();
    var h = '<div style="width:max-content;min-width:100%"><div class="hd" style="' + cols + '"><div class="hdname">ชื่อ</div>';
    for (var d = 1; d <= M.N; d++) {
      var cls = 'dh' + (isTodayIn(M, d) ? ' today' : '') + (d === Math.min(st.sel, M.N) ? ' sel' : '');
      h += '<button type="button" class="' + cls + '" data-act="day" data-v="' + d + '" aria-label="เลือกวันที่ ' + d + '"><span>' + WD[M.wd(d)] + '</span><b>' + d + '</b></button>';
    }
    h += '</div>';
    M.rows.forEach(function (id, i) {
      var isCore = E.CORE.indexOf(id) >= 0;
      if (i === 0 && isCore) h += '<div class="lbl">ชุดสลับ 2 วัน เว้น 2 วัน</div>';
      if (!isCore && (i === 0 || E.CORE.indexOf(M.rows[i - 1]) >= 0)) h += '<div class="lbl">หมุนเวียนตามลำดับรายชื่อ</div>';
      var rc = 'row' + (matched.length ? (matched.indexOf(id) >= 0 ? ' hit' : ' dim') : '');
      var pn = parts(id);
      h += '<div class="' + rc + '" style="' + cols + '"><div class="nmcell"><span style="font-size:14px;font-weight:600;line-height:1.25">' + esc(pn.first) + '</span><span style="font-size:11px;color:#8A857C;line-height:1.25">' + esc(nm(id)) + '</span></div>';
      for (var dd = 1; dd <= M.N; dd++) {
        var role = M.roleOf(id, dd);
        h += '<div class="cell' + (isTodayIn(M, dd) ? ' tc' : '') + '">' + (role ? '<span class="pill ' + role + '">' + LABEL[role] + '</span>' : '') + '</div>';
      }
      h += '</div>';
    });
    return h + '</div>';
  }
  function matchedIds() {
    var q = (st.q || '').trim(), M = curMonth();
    if (!q) return [];
    var out = [];
    M.rows.forEach(function (id) { if (out.length < 3 && nm(id).indexOf(q) >= 0) out.push(id); });
    return out;
  }
  function nextDuty(id) {
    var t = todayAbsInfo();
    for (var i = 0; i < st.months.length; i++) {
      var M = st.months[i];
      if (M.key < t.key) continue;
      for (var d = (M.key === t.key ? t.d : 1); d <= M.N; d++) {
        var r = M.roleOf(id, d);
        if (r && r !== 'lv' && r !== 'bz') return { M: M, d: d };
      }
    }
    return null;
  }
  function resultsHtml(M) {
    var q = (st.q || '').trim();
    if (!q) return '';
    var ids = [];
    st.data.people.forEach(function (p) { if (ids.length < 3 && p.section !== 'tr' && p.name.indexOf(q) >= 0 && (p.core || p.queue || M.rows.indexOf(p.key) >= 0)) ids.push(p.key); });
    if (!ids.length) return '<div style="padding:4px 10px;font-size:14px;color:#8A857C">ไม่พบ "' + esc(q) + '" ในรายชื่อหมุนเวียน</div>';
    var t = todayAbsInfo();
    return ids.map(function (id) {
      var count = 0;
      for (var d = 1; d <= M.N; d++) { var r = M.roleOf(id, d); if (r && r !== 'lv' && r !== 'bz') count++; }
      var nx = nextDuty(id), line;
      if (!nx) line = 'ไม่พบเวรในตารางที่คำนวณไว้';
      else if (nx.M.key === t.key && nx.d === t.d) line = 'วันนี้ถึงเวรคุณ';
      else line = 'เวรถัดไปวัน' + WDF[nx.M.wd(nx.d)] + 'ที่ ' + nx.d + ' ' + nx.M.short + ' ' + ((nx.M.y + 543) % 100);
      return '<div style="background:#FFF4D6;border-radius:20px;padding:14px 18px;display:flex;flex-direction:column;gap:2px"><div style="font-size:16px;font-weight:600">' + esc(nm(id)) + '</div>' +
        '<div style="font-size:14px;line-height:1.5;color:#5D5A54">' + line + ' · เวร' + esc(M.short) + ' ' + count + ' วัน</div></div>';
    }).join('');
  }
  function counts() {
    var c = { rot: 0, ch: 0, ltc: 0, mis: 0, tr: 0 };
    st.data.people.forEach(function (p) { c[p.section]++; });
    return c;
  }
  function headcountCard() {
    var c = counts(), total = st.data.people.length - c.tr;
    return '<section class="card" style="gap:6px"><div style="font-size:13px;color:#8A857C">กำลังพลทั้งหมด</div><div style="display:flex;align-items:baseline;gap:8px"><span style="font-family:\'Noto Serif Thai\',serif;font-size:40px;font-weight:600;line-height:1.1">' + total + '</span><span style="font-size:15px;color:#5D5A54">นาย</span></div>' +
      '<div style="font-size:13px;color:#5D5A54;line-height:1.7">' + countLine(c) + '</div></section>';
  }
  function countLine(c) { return 'หมุนเวียน ' + c.rot + ' · ชรก. ' + c.ch + ' · LTC ' + c.ltc + ' · มีภารกิจ ' + c.mis + ' · ปรับย้ายแล้ว ' + c.tr; }
  function listCard(title, items, withSub) {
    var h = '<section class="card"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:19px;font-weight:600">' + title + '</h2><span style="font-size:13px;color:#8A857C">' + items.length + ' นาย</span></div>';
    if (!items.length) h += '<div style="font-size:14px;color:#8A857C">ยังไม่มีรายชื่อ</div>';
    h += '<div style="max-height:320px;overflow-y:auto">';
    items.forEach(function (p, i) {
      var sub = withSub ? (p.note ? 'ย้ายไป ' + p.note : 'ไม่ระบุหน่วยปลายทาง') : '';
      h += '<div class="lrow" style="padding:9px 2px"><span style="width:28px;font-size:12px;color:#8A857C;text-align:right;flex:none">' + (i + 1) + '</span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;line-height:1.4">' + esc(p.name) + '</span>' + (sub ? '<span style="font-size:12px;color:#8A857C">' + esc(sub) + '</span>' : '') + '</div></div>';
    });
    return h + '</div></section>';
  }
  function listCards() {
    return listCard('รายชื่อ ชรก.', secPeople('ch')) + listCard('รายชื่อ LTC', secPeople('ltc')) + listCard('มีภารกิจ', secPeople('mis')) + listCard('รายชื่อปรับย้าย', secPeople('tr'), true) +
      listCard('หมุนเข้าสิบเวร · สิบเวร (สว.)', bySec('rot', function (p) { return !isGreen(p); })) + listCard('หมุนเข้าสิบเวร · ผช.น.เวร (สว./ผช.)', bySec('rot', isGreen));
  }

  /* ----- สถิติ ----- */
  function statOf(M) {
    var out = {};
    M.rows.forEach(function (id) {
      var o = { sv: 0, sp: 0, bk: 0, lv: 0 };
      for (var d = 1; d <= M.N; d++) {
        var r = M.roleOf(id, d);
        if (r === 'sv') o.sv++; else if (r === 'sp') o.sp++; else if (r === 'bk') o.bk++; else if (r === 'lv' || r === 'bz') o.lv++;
      }
      out[id] = o;
    });
    return out;
  }
  function statsHtml() {
    var h = '<div class="mons">';
    st.months.forEach(function (m) { h += '<button type="button" class="mon' + (st.statM === m.key ? ' on' : '') + '" data-act="statm" data-v="' + m.key + '">' + m.short + (m.draft ? ' (ร่าง)' : '') + '</button>'; });
    h += '<button type="button" class="mon' + (st.statM === 'all' ? ' on' : '') + '" data-act="statm" data-v="all">รวมทั้งหมด</button></div>';
    var merged = {};
    st.months.forEach(function (M) {
      if (st.statM !== 'all' && st.statM !== M.key) return;
      var S = statOf(M);
      Object.keys(S).forEach(function (id) {
        var o = merged[id] || (merged[id] = { sv: 0, sp: 0, bk: 0, lv: 0 });
        ['sv', 'sp', 'bk', 'lv'].forEach(function (k) { o[k] += S[id][k]; });
      });
    });
    var plist = Object.keys(merged).filter(function (id) { return E.CORE.indexOf(id) < 0 && person(id); }).map(function (id) {
      var o = merged[id]; return { id: id, sv: o.sv, sp: o.sp, bk: o.bk, lv: o.lv, total: o.sv + o.sp + o.bk };
    }).filter(function (x) { return x.total > 0 || x.lv > 0; }).sort(function (a, b) { return (b.total - a.total) || (a.id < b.id ? -1 : 1); });
    var mx = 1; plist.forEach(function (x) { if (x.total > mx) mx = x.total; });
    var tSv = 0, tSp = 0, tBk = 0, tLv = 0, nP = 0;
    plist.forEach(function (x) { tSv += x.sv; tSp += x.sp; tBk += x.bk; tLv += x.lv; if (x.total > 0) nP++; });
    var tAll = tSv + tSp + tBk;
    function tile(v, l) { return '<div style="background:#fff;border-radius:20px;padding:14px 12px;box-shadow:0 4px 18px rgba(60,40,20,.06);display:flex;flex-direction:column;gap:2px"><div style="font-family:\'Noto Serif Thai\',serif;font-size:28px;font-weight:600;line-height:1.1">' + v + '</div><div style="font-size:12px;color:#8A857C;line-height:1.4">' + l + '</div></div>'; }
    h += '<section style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px">' + tile(tSv + tSp, 'วัน สว. (คนหมุนเวียน)') + tile(nP, 'คนที่เข้าเวร') + tile(tLv, 'วันลา/ลากิจ') + '</section>';
    // โดนัท
    var C = 2 * Math.PI * 44;
    var defs = [{ label: 'สิบเวร (สว.)', n: tSv, color: '#E8A3A3' }, { label: 'สว./ผช.', n: tSp, color: '#8CC7A0' }];
    var live = defs.filter(function (t) { return t.n > 0; }), cum = 0, segs = '';
    live.forEach(function (t) {
      var frac = t.n / (tAll || 1), dash = Math.max(0, frac * C - (live.length > 1 ? 2 : 0));
      segs += '<circle cx="60" cy="60" r="44" fill="none" stroke="' + t.color + '" stroke-width="16" stroke-dasharray="' + dash.toFixed(2) + ' ' + (C - dash).toFixed(2) + '" stroke-dashoffset="' + (-cum * C).toFixed(2) + '" transform="rotate(-90 60 60)"></circle>';
      cum += frac;
    });
    h += '<section class="card" style="gap:16px"><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:19px;font-weight:600">สัดส่วนประเภทเวร</h2><div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:20px">' +
      '<svg viewBox="0 0 120 120" width="168" height="168" role="img" aria-label="แผนภูมิโดนัทสัดส่วนประเภทเวร"><circle cx="60" cy="60" r="44" fill="none" stroke="#F1ECE4" stroke-width="16"></circle>' + segs +
      '<text x="60" y="62" text-anchor="middle" font-size="24" font-weight="600" fill="#2B2A28">' + tAll + '</text><text x="60" y="78" text-anchor="middle" font-size="9" fill="#8A857C">ครั้ง</text></svg>' +
      '<div style="display:flex;flex-direction:column;gap:10px;min-width:150px">' + defs.map(function (t) {
        return '<div style="display:flex;align-items:center;gap:10px;font-size:14px"><span style="width:14px;height:14px;border-radius:50%;background:' + t.color + ';flex:none"></span><span style="flex:1">' + t.label + '</span><b>' + t.n + '</b><span style="color:#8A857C;width:40px;text-align:right">' + (tAll ? Math.round(t.n / tAll * 100) : 0) + '%</span></div>';
      }).join('') + '</div></div></section>';
    // แท่งรายคน
    h += '<section class="card" style="gap:14px"><div><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:19px;font-weight:600">เข้าเวรกี่ครั้ง รายคน</h2><div style="margin-top:4px;font-size:12px;color:#8A857C">เรียงจากมากไปน้อย</div></div><div style="display:flex;flex-direction:column;gap:12px">';
    if (!plist.length) h += '<div style="font-size:14px;color:#8A857C">ยังไม่มีข้อมูล</div>';
    plist.forEach(function (x) {
      var pn = parts(x.id), pc = function (n) { return (n / mx * 100).toFixed(1); };
      h += '<div style="display:flex;flex-direction:column;gap:5px"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><div style="font-size:14px;line-height:1.3"><b>' + esc(pn.first) + '</b> <span style="font-size:12px;color:#8A857C">' + esc((pn.rank + ' ' + pn.last).trim()) + '</span></div><div style="font-size:14px;font-weight:600;white-space:nowrap">' + x.total + ' ครั้ง</div></div>' +
        '<div style="display:flex;height:14px;border-radius:999px;overflow:hidden;background:#F1ECE4"><span style="width:' + pc(x.sv) + '%;background:#E8A3A3"></span><span style="width:' + pc(x.sp) + '%;background:#8CC7A0"></span></div>' +
        (x.lv > 0 ? '<div style="font-size:12px;color:#8A857C">ลา ' + x.lv + ' วัน</div>' : '') + '</div>';
    });
    h += '</div><div style="display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;color:#5D5A54;border-top:1px solid #F1ECE4;padding-top:12px"><span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#E8A3A3;margin-right:6px"></span>สว.</span><span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:#8CC7A0;margin-right:6px"></span>สว./ผช.</span></div></section>';
    // เฉลี่ย
    var gS = 0, gN = 0, oS = 0, oN = 0;
    plist.forEach(function (x) { if (x.total <= 0) return; if (isGreen(person(x.id))) { gS += x.total; gN++; } else { oS += x.total; oN++; } });
    var gA = gN ? gS / gN : 0, oA = oN ? oS / oN : 0, aMax = Math.max(gA, oA, 1);
    function cmpRow(l, v, c) { return '<div style="display:flex;flex-direction:column;gap:5px"><div style="display:flex;justify-content:space-between;gap:8px;font-size:14px"><span>' + l + '</span><b>' + v.toFixed(1) + '</b></div><div style="height:18px;border-radius:999px;background:#F1ECE4;overflow:hidden"><div style="height:100%;width:' + (v / aMax * 100).toFixed(1) + '%;background:' + c + ';border-radius:999px"></div></div></div>'; }
    h += '<section class="card" style="gap:14px"><div><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:19px;font-weight:600">เฉลี่ยกี่ครั้งต่อคน</h2><div style="margin-top:4px;font-size:12px;color:#8A857C">เทียบสองกลุ่มในลิสต์หมุนเวียน</div></div>' +
      cmpRow('ทั่วไป · สว. (' + oN + ' คน)', oA, '#E8A3A3') + cmpRow('จ.ส.ต. · สว./ผช. (' + gN + ' คน)', gA, '#8CC7A0') + '</section>';
    // กำลังจะถึง
    var up = [], t = todayAbsInfo();
    st.months.forEach(function (M) {
      if (M.key < t.key) return;
      for (var d = (M.key === t.key ? t.d : 1); d <= M.N && up.length < 5; d++) {
        var v = M.svD[d];
        if (v) up.push('<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;border-top:1px solid #F1ECE4;padding-top:10px"><div style="min-width:0"><div style="font-size:12px;color:#8A857C">' + WDF[M.wd(d)] + ' ' + d + ' ' + M.short + '</div><div style="font-size:15px;font-weight:600;line-height:1.35">' + esc(nm(v.id)) + '</div></div><span class="pill ' + v.type + '">' + (v.type === 'sp' ? 'สว./ผช.' : 'สว.') + '</span></div>');
      }
    });
    h += '<section class="card"><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:19px;font-weight:600">เวรที่กำลังจะถึง</h2>' + up.join('') + '</section>';
    h += '<footer style="font-size:12px;color:#8A857C;line-height:1.6;padding:0 8px">นับเฉพาะคนในลิสต์หมุนเวียน ไม่รวมชุดสลับ 4 คน · ก.ย.–ต.ค. ยังไม่รวม</footer>';
    return h;
  }

  /* ----- แอดมิน ----- */
  function gateHtml() {
    return '<section class="card" style="padding:28px 20px;align-items:center;gap:16px;text-align:center"><div style="width:64px;height:64px;border-radius:50%;background:#F4EAE2;display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="#8C5A45" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"></rect><path d="M8 11V8a4 4 0 0 1 8 0v3"></path></svg></div>' +
      '<div><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:20px;font-weight:600">ส่วนของแอดมิน</h2><div style="margin-top:4px;font-size:13px;line-height:1.5;color:#8A857C">ใส่รหัสเพื่อแก้ไขตารางเวรและรายชื่อ</div></div>' +
      '<div style="width:100%;display:flex;flex-direction:column;gap:6px;text-align:left"><label for="pw" style="font-size:14px;font-weight:500;color:#5D5A54">รหัสแอดมิน</label><input id="pw" class="fld" type="password" autocomplete="current-password" placeholder="••••••">' +
      (st.adminErr ? '<div style="font-size:13px;color:#8C2B2B">' + esc(st.adminErr) + '</div>' : '') + '</div><button type="button" class="btn" style="width:100%" data-act="login">' + (st.busy ? 'กำลังตรวจสอบ…' : 'เข้าสู่ระบบ') + '</button>' +
      (DEMO ? '<div style="font-size:12px;color:#8A857C;line-height:1.5">โหมดทดลองใช้รหัส demo</div>' : '<div style="font-size:12px;color:#8A857C;line-height:1.5">ตรวจรหัสที่เซิร์ฟเวอร์ ใส่ผิดหลายครั้งจะถูกล็อกชั่วคราว</div>') + '</section>';
  }
  function doLogin() {
    var pw = ($('#pw') || {}).value || '';
    if (!pw || st.busy) return;
    st.busy = true; st.adminErr = ''; render();
    api('login', { password: pw }).then(function (r) {
      st.busy = false;
      if (r.ok) { st.token = r.token; try { sessionStorage.setItem('dr_token', r.token); } catch (e) {} st.adminErr = ''; }
      else if (r.error === 'locked') st.adminErr = 'ใส่รหัสผิดหลายครั้ง ถูกล็อกชั่วคราว รอประมาณ ' + (r.minutes || 15) + ' นาที';
      else st.adminErr = 'รหัสไม่ถูกต้อง' + (r.left != null ? ' (เหลือ ' + r.left + ' ครั้งก่อนถูกล็อก)' : '');
      render();
    }).catch(function () { st.busy = false; st.adminErr = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; render(); });
  }
  function doLogout(silent) {
    var t = st.token; st.token = null;
    try { sessionStorage.removeItem('dr_token'); } catch (e) {}
    if (t && !silent) api('logout', { token: t });
    render();
  }
  function opt(items, sel, ph) {
    return '<option value="">' + ph + '</option>' + items.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === sel ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('');
  }
  function adminHtml() {
    var c = counts(), total = st.data.people.length - c.tr, tgt = parseInt(st.data.config.target, 10);
    var diff = 'ใส่ยอดกำลังพลที่ถูกต้อง', ok = false;
    if (tgt >= 0) { if (total === tgt) { diff = 'ตรงยอด ' + tgt + ' นาย'; ok = true; } else if (total > tgt) diff = 'เกินยอดอยู่ ' + (total - tgt) + ' นาย · ยังไม่ได้กรอกปรับย้าย หรือมีชื่อซ้ำ'; else diff = 'ขาดจากยอดอยู่ ' + (tgt - total) + ' นาย · อาจมีชื่อที่ลบไปเกิน'; }
    var f = st.form;
    var h = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 6px"><span style="font-size:13px;color:#8A857C">เข้าสู่ระบบแอดมินอยู่ · <span id="savemsg">' + esc(st.saveMsg) + '</span></span><button type="button" class="del" style="color:#5D5A54" data-act="logout">ออกจากระบบ</button></div>';
    h += '<section class="card"><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:20px;font-weight:600">ตรวจยอดกำลังพล</h2><div style="display:flex;align-items:baseline;gap:8px"><span style="font-family:\'Noto Serif Thai\',serif;font-size:40px;font-weight:600;line-height:1.1">' + total + '</span><span style="font-size:15px;color:#5D5A54">นาย ในระบบ</span></div>' +
      '<div style="font-size:13px;color:#5D5A54;line-height:1.7">' + countLine(c) + '</div><div style="display:flex;flex-direction:column;gap:6px"><label for="tg" style="font-size:14px;font-weight:500;color:#5D5A54">ยอดกำลังพลที่ถูกต้อง</label><input id="tg" class="fld" type="number" inputmode="numeric" value="' + esc(st.data.config.target) + '"></div>' +
      '<span class="chip ' + (ok ? 'ok' : 'warn') + '" style="align-self:flex-start">' + diff + '</span></section>';
    // ลา
    var opts = E.CORE.concat(bySec('rot', function (p) { return !!p.queue; }).map(function (p) { return p.key; })).filter(function (k) { return person(k); }).map(function (k) { return { id: k, label: nm(k) }; });
    var valid = f.leaveKey && f.from && f.to && f.to >= f.from;
    var summ = 'เลือกชื่อ ประเภท และช่วงวันที่';
    if (valid) summ = nm(f.leaveKey) + ' · ' + f.leaveType + ' ' + (Math.round((Date.parse(f.to) - Date.parse(f.from)) / 864e5) + 1) + ' วัน (' + thDate(f.from) + (f.to > f.from ? ' – ' + thDate(f.to) : '') + ')';
    else if (f.from && f.to && f.to < f.from) summ = 'วันที่สิ้นสุดต้องไม่ก่อนวันที่เริ่ม';
    h += '<section class="card" style="gap:16px"><div><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:20px;font-weight:600">เพิ่มวันลา</h2><div style="margin-top:4px;font-size:13px;line-height:1.5;color:#8A857C">ระบบจะตัดชื่อออกจากคิวตลอดช่วงลา แล้วนำกลับเข้าคิวเป็นคนแรกเมื่อครบกำหนด</div></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><label for="fp" style="font-size:14px;font-weight:500;color:#5D5A54">ชื่อ</label><select id="fp" class="fld">' + opt(opts, f.leaveKey, 'เลือกชื่อ') + '</select></div>' +
      '<div style="display:flex;flex-direction:column;gap:6px"><span style="font-size:14px;font-weight:500;color:#5D5A54">ประเภท</span><div style="display:flex;gap:8px"><button type="button" class="ty' + (f.leaveType === 'ลา' ? ' on' : '') + '" data-act="ltype" data-v="ลา">ลา</button><button type="button" class="ty' + (f.leaveType === 'ลากิจ' ? ' on' : '') + '" data-act="ltype" data-v="ลากิจ">ลากิจ</button></div></div>' +
      '<div style="display:flex;gap:12px"><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><label for="ff" style="font-size:14px;font-weight:500;color:#5D5A54">ตั้งแต่วันที่</label><input id="ff" class="fld" type="date" value="' + esc(f.from) + '" min="2026-12-01"></div>' +
      '<div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:6px"><label for="ft" style="font-size:14px;font-weight:500;color:#5D5A54">ถึงวันที่</label><input id="ft" class="fld" type="date" value="' + esc(f.to) + '" min="2026-12-01"></div></div>' +
      '<div style="font-size:14px;color:#5D5A54;background:#F4EAE2;border-radius:14px;padding:10px 14px;line-height:1.5">' + esc(summ) + '</div><button type="button" class="btn" data-act="addleave"' + (valid ? '' : ' disabled') + '>เพิ่มรายการ</button></section>';
    // รายการลา
    h += '<section style="display:flex;flex-direction:column;gap:10px"><h2 style="margin:0 0 0 6px;font-family:\'Noto Serif Thai\',serif;font-size:19px;font-weight:600">รายการลา</h2>';
    if (!st.data.leaves.length) h += '<div style="background:#fff;border-radius:20px;padding:18px;font-size:14px;color:#8A857C;line-height:1.5;box-shadow:0 4px 18px rgba(60,40,20,.05)">ยังไม่มีรายการลา</div>';
    st.data.leaves.slice().sort(function (a, b) { return a.from < b.from ? -1 : 1; }).forEach(function (l) {
      var days = Math.round((Date.parse(l.to) - Date.parse(l.from)) / 864e5) + 1;
      h += '<div style="background:#fff;border-radius:20px;padding:14px 16px;display:flex;align-items:center;justify-content:space-between;gap:12px;box-shadow:0 4px 18px rgba(60,40,20,.05)"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><div style="font-size:15px;font-weight:600">' + esc(nm(l.key)) + '</div><div style="display:flex;align-items:center;gap:8px;font-size:13px;color:#5D5A54"><span class="pill ' + (l.type === 'ลา' ? 'lv' : 'bz') + '">' + (l.type === 'ลา' ? 'ลา' : 'ลากิจ') + '</span><span>' + thDate(l.from) + (l.to > l.from ? ' – ' + thDate(l.to) : '') + ' · ' + days + ' วัน</span></div></div><button type="button" class="del" data-act="delleave" data-v="' + esc(l.id) + '">ลบ</button></div>';
    });
    h += '</section>';
    // เพิ่มคน
    h += '<section class="card" style="gap:12px"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:20px;font-weight:600">เพิ่มคน</h2><span style="font-size:13px;color:#8A857C">กำลังพลใหม่</span></div>' +
      '<div style="font-size:12px;line-height:1.5;color:#8A857C">ใส่ยศ ชื่อ นามสกุล แล้วเลือกว่าจะอยู่ส่วนไหน ถ้าเข้ารายชื่อหมุนเวียน ชื่อจะต่อท้ายคิว</div>' +
      '<input id="nn" class="fld" type="text" placeholder="เช่น ส.ท.ชื่อ นามสกุล" value="' + esc(f.nName) + '"><select id="nd" class="fld">' +
      [['rotw', 'หมุนเวียนสิบเวร (ทั่วไป)'], ['rotg', 'หมุนเวียนสิบเวร (จ.ส.ต.ขึ้นไป สว./ผช.)'], ['ch', 'ชรก.'], ['ltc', 'LTC'], ['mis', 'มีภารกิจ']].map(function (o) { return '<option value="' + o[0] + '"' + (f.nDest === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      (f.nErr ? '<div style="font-size:13px;color:#8C2B2B">' + esc(f.nErr) + '</div>' : '') + '<button type="button" class="btn" data-act="addperson">เพิ่มคน</button></section>';
    h += '<div style="padding:4px 8px 0 8px;font-size:13px;line-height:1.6;color:#8A857C">ส่วนด้านล่าง: ชื่อหนึ่งอยู่ได้ส่วนเดียว เลือกชื่อเข้าส่วนไหน ชื่อจะย้ายออกจากส่วนเดิมและถูกตัดออกจากคิวสิบเวรอัตโนมัติ</div>';
    var defs = [['tr', 'ปรับย้าย', 'เลือกชื่อแล้วระบบตัดออกจากรายชื่อหมุนเข้าเวรทันที และหักออกจากยอดกำลังพล'], ['ch', 'รายชื่อ ชรก.', 'ผู้ที่อยู่ใน ชรก. ไม่เข้าคิวสิบเวร'], ['ltc', 'รายชื่อ LTC', 'เลือกชื่อเข้ารายชื่อ LTC ชื่อจะถูกตัดออกจากคิวสิบเวร'], ['mis', 'มีภารกิจ', 'เลือกชื่อแล้วตัดออกจากคิวสิบเวรทันที กด "จบภารกิจ" เมื่อเสร็จ ชื่อจะกลับเข้าคิว']];
    var RET = { mis: 'จบภารกิจ', tr: 'ยกเลิก' };
    defs.forEach(function (d) {
      var k = d[0], items = secPeople(k);
      var options = st.data.people.filter(function (p) { return p.section !== k; }).sort(function (a, b) { return a.ord - b.ord; }).map(function (p) { return { id: p.key, label: p.name + ' · ' + SEC_LABEL[p.section] }; });
      h += '<section class="card" style="gap:14px"><div style="display:flex;align-items:baseline;justify-content:space-between;gap:8px"><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:20px;font-weight:600">' + d[1] + '</h2><span style="font-size:13px;color:#8A857C">' + items.length + ' นาย</span></div><div style="font-size:12px;line-height:1.5;color:#8A857C">' + d[2] + '</div>';
      if (k === 'tr') h += '<input class="fld" type="text" id="trn" aria-label="ย้ายไป" placeholder="ย้ายไป (ไม่บังคับ) เช่น ชื่อหน่วยปลายทาง" value="' + esc(f.trNote) + '">';
      h += '<div style="display:flex;gap:8px"><select class="fld" data-pick="' + k + '">' + opt(options, f.pick[k], 'เลือกชื่อ') + '</select><button type="button" class="btn" style="padding:0 18px;flex:none" data-act="moveto" data-v="' + k + '">ย้ายเข้า</button></div>';
      if (!items.length) h += '<div style="font-size:14px;color:#8A857C">ยังไม่มีรายชื่อ</div>';
      h += '<div style="max-height:360px;overflow-y:auto;border-top:1px solid #F1ECE4">';
      items.forEach(function (p, i) {
        var sub = k === 'tr' ? (p.note ? 'ย้ายไป ' + p.note : 'ไม่ระบุหน่วยปลายทาง') : '';
        h += '<div class="lrow"><span style="width:28px;font-size:12px;color:#8A857C;text-align:right;flex:none">' + (i + 1) + '</span><div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:1px"><span style="font-size:14px;line-height:1.4">' + esc(p.name) + '</span>' + (sub ? '<span style="font-size:12px;color:#8A857C">' + esc(sub) + '</span>' : '') + '</div>' +
          (home(p) !== k ? '<button type="button" class="del" style="color:#5D5A54;padding:0 12px;font-size:13px" data-act="ret" data-v="' + esc(p.key) + '">' + (RET[k] || 'นำออก') + '</button>' : '') +
          (/^n/.test(p.key) ? '<button type="button" class="del" style="padding:0 12px;font-size:13px" data-act="delperson" data-v="' + esc(p.key) + '">ลบ</button>' : '') + '</div>';
      });
      h += '</div></section>';
    });
    // เปลี่ยนรหัส
    h += '<section class="card" style="gap:12px"><h2 style="margin:0;font-family:\'Noto Serif Thai\',serif;font-size:20px;font-weight:600">เปลี่ยนรหัสแอดมิน</h2>' +
      '<input id="op" class="fld" type="password" placeholder="รหัสปัจจุบัน" autocomplete="current-password"><input id="np" class="fld" type="password" placeholder="รหัสใหม่ (อย่างน้อย 6 ตัว)" autocomplete="new-password">' +
      (f.pwMsg ? '<div style="font-size:13px;color:#5D5A54">' + esc(f.pwMsg) + '</div>' : '') + '<button type="button" class="btn" data-act="chpw">เปลี่ยนรหัส</button></section>';
    return h;
  }

  /* ---------- เหตุการณ์ ---------- */
  function mutate(fn, msg) {
    fn(); setData(st.data); render(); persist(); if (msg) toast(msg);
  }
  function maxOrd() { return st.data.people.reduce(function (m, p) { return Math.max(m, +p.ord || 0); }, 0); }
  function bind() {
    var app = $('#app');
    var q = $('#q');
    if (q) q.oninput = function () {
      st.q = q.value;
      var M = curMonth();
      $('#results').innerHTML = resultsHtml(M);
      var g = $('#gridscroll'), sl = g.scrollLeft, stp = g.scrollTop;
      g.innerHTML = gridHtml(M); g.scrollLeft = sl; g.scrollTop = stp;
    };
    var pw = $('#pw'); if (pw) pw.onkeydown = function (e) { if (e.key === 'Enter') doLogin(); };
    var tg = $('#tg'); if (tg) tg.onchange = function () { st.data.config.target = parseInt(tg.value, 10) || 0; render(); persist(); };
    var fp = $('#fp'); if (fp) fp.onchange = function () { st.form.leaveKey = fp.value; render(); };
    var ff = $('#ff'); if (ff) ff.onchange = function () { st.form.from = ff.value; if (!st.form.to || st.form.to < ff.value) st.form.to = ff.value; render(); };
    var ft = $('#ft'); if (ft) ft.onchange = function () { st.form.to = ft.value; render(); };
    var nn = $('#nn'); if (nn) nn.oninput = function () { st.form.nName = nn.value; st.form.nErr = ''; };
    var nd = $('#nd'); if (nd) nd.onchange = function () { st.form.nDest = nd.value; };
    var trn = $('#trn'); if (trn) trn.oninput = function () { st.form.trNote = trn.value; };
    var picks = app.querySelectorAll('[data-pick]');
    for (var i = 0; i < picks.length; i++) (function (el) { el.onchange = function () { st.form.pick[el.getAttribute('data-pick')] = el.value; }; })(picks[i]);
    var btns = app.querySelectorAll('[data-act]');
    for (var j = 0; j < btns.length; j++) (function (b) { b.onclick = function () { act(b.getAttribute('data-act'), b.getAttribute('data-v')); }; })(btns[j]);
  }
  function act(a, v) {
    var f = st.form;
    if (a === 'tab') { st.tab = v; if (v === 'view') st._scrollTo = st.sel; render(); }
    else if (a === 'month') { st.mkey = v; var M = st.model[v], t = todayAbsInfo(); st.sel = (M.key === t.key) ? t.d : 1; st._scrollTo = st.sel; render(); }
    else if (a === 'day') { st.sel = +v; render(); }
    else if (a === 'statm') { st.statM = v; render(); }
    else if (a === 'login') doLogin();
    else if (a === 'logout') doLogout();
    else if (a === 'ltype') { f.leaveType = v; render(); }
    else if (a === 'addleave') {
      if (!(f.leaveKey && f.from && f.to && f.to >= f.from)) return;
      mutate(function () { st.data.leaves.push({ id: 'l' + Date.now().toString(36), key: f.leaveKey, type: f.leaveType, from: f.from, to: f.to }); f.from = ''; f.to = ''; f.leaveKey = ''; }, 'เพิ่มรายการลาแล้ว');
    }
    else if (a === 'delleave') mutate(function () { st.data.leaves = st.data.leaves.filter(function (l) { return l.id !== v; }); });
    else if (a === 'addperson') {
      var n = (f.nName || '').trim().replace(/\s+/g, ' ');
      if (!n) { f.nErr = 'ใส่ชื่อก่อน'; return render(); }
      var dup = st.data.people.filter(function (p) { return p.name === n; })[0];
      if (dup) { f.nErr = 'มีชื่อนี้อยู่แล้วในส่วน ' + SEC_LABEL[dup.section]; return render(); }
      var d = f.nDest;
      mutate(function () {
        st.data.people.push({ key: 'n' + Date.now().toString(36), name: n, section: (d === 'rotw' || d === 'rotg') ? 'rot' : d, queue: d === 'rotw' ? 'w' : (d === 'rotg' ? 'g' : ''), core: 0, note: '', ord: maxOrd() + 1 });
        f.nName = ''; f.nErr = '';
      }, 'เพิ่มคนแล้ว');
    }
    else if (a === 'moveto') {
      var key = f.pick[v]; if (!key) return;
      mutate(function () {
        var p = st.byKey[key]; p.section = v; p.note = v === 'tr' ? (f.trNote || '').trim() : '';
        f.pick[v] = ''; if (v === 'tr') f.trNote = '';
      });
    }
    else if (a === 'ret') mutate(function () { var p = st.byKey[v]; p.section = home(p); p.note = ''; });
    else if (a === 'delperson') {
      if (!confirm('ลบชื่อนี้ออกจากระบบ?')) return;
      mutate(function () { st.data.people = st.data.people.filter(function (p) { return p.key !== v; }); st.data.leaves = st.data.leaves.filter(function (l) { return l.key !== v; }); });
    }
    else if (a === 'chpw') {
      var op = ($('#op') || {}).value, np = ($('#np') || {}).value;
      api('changePassword', { token: st.token, oldPassword: op, newPassword: np }).then(function (r) {
        f.pwMsg = r.ok ? 'เปลี่ยนรหัสแล้ว' : (r.error === 'wrong_password' ? 'รหัสปัจจุบันไม่ถูกต้อง' : (r.error === 'too_short' ? 'รหัสใหม่สั้นเกินไป' : (r.error === 'demo' ? 'โหมดทดลองเปลี่ยนรหัสไม่ได้' : 'เปลี่ยนรหัสไม่สำเร็จ')));
        render();
      });
    }
  }

  /* ---------- เริ่มต้น ---------- */
  function start() {
    api('state', null, 'GET').then(function (r) {
      var state = DEMO ? r.state : (r.state || r);
      if (!state || !state.people) throw new Error('bad state');
      setData(state);
      var t = todayAbsInfo();
      st.mkey = st.model[t.key] ? t.key : '2026-12';
      st.sel = st.model[st.mkey].key === t.key ? t.d : 1;
      st.statM = 'all'; st._scrollTo = st.sel;
      render();
    }).catch(function () {
      $('#app').innerHTML = '<div class="sk">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้อีกครั้ง</div>';
    });
  }
  start();
})();
