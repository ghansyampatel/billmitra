/* BillMitra — app (screens + logic). Vanilla JS, कोई framework नहीं. */
(function () {
  'use strict';
  const APP = { name: 'BillMitra', version: '1.0.0' };
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = n => '₹' + GST.inr(n);
  const num = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isFinite(n) ? n : 0; };
  const today = () => REP.today();
  const dmy = d => PRINT.dmy(d);
  const TYPE_NAME = { TAX: 'taxInvoice', BOS: 'bos', EST: 'estimate' };
  const PILL = { TAX: '', BOS: 'bos', EST: 'est' };
  const MODES = ['Cash', 'UPI', 'Bank', 'Cheque', 'Card'];

  // ---------- data cache ----------
  const S = { biz: null, parties: [], items: [], invoices: [], payments: [] };
  async function load() {
    S.biz = await DB.getBiz();
    [S.parties, S.items, S.invoices, S.payments] = await Promise.all(['parties', 'items', 'invoices', 'payments'].map(DB.all));
    S.parties.sort((a, b) => a.name.localeCompare(b.name));
    S.items.sort((a, b) => a.name.localeCompare(b.name));
  }
  const partyById = id => S.parties.find(p => p.id === id);
  const partyBal = p => REP.ledger(p, S.invoices, S.payments).balance;

  // ---------- UI helpers ----------
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200); }
  function modal(html, mount) {
    $('#sheet').innerHTML = html; $('#modal').classList.remove('hidden');
    if (mount) mount($('#sheet'));
    const first = $('#sheet').querySelector('input,select,textarea'); if (first && window.innerWidth > 700) first.focus();
  }
  function closeModal() { $('#modal').classList.add('hidden'); $('#sheet').innerHTML = ''; }
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') closeModal(); });
  function confirmBox(msg) { return Promise.resolve(window.confirm(msg)); }
  function setTop(title, back, actHtml) {
    $('#title').textContent = title;
    $('#backBtn').classList.toggle('hidden', !back);
    $('#backBtn').onclick = () => (typeof back === 'string' ? (location.hash = back) : history.back());
    $('#topAct').innerHTML = actHtml || '';
  }
  function nav(r) { $$('#nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r)); }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const stateOptions = sel => GST.STATES.map(s => `<option value="${s[0]}" ${s[0] === sel ? 'selected' : ''}>${s[0]} - ${s[1]}</option>`).join('');
  const field = (lbl, html, cls) => `<label class="l ${cls || ''}">${lbl}${html}</label>`;
  const view = html => { const v = $('#view'); v.onclick = null; window.onresize = null; v.innerHTML = html; window.scrollTo(0, 0); };
  const formData = root => { const o = {}; root.querySelectorAll('[name]').forEach(el => o[el.name] = el.type === 'checkbox' ? el.checked : el.value.trim()); return o; };
  const mobile10 = m => String(m || '').replace(/\D/g, '').slice(-10);
  function waOpen(mobile, text) {
    const m = mobile10(mobile);
    window.open('https://wa.me/' + (m.length === 10 ? '91' + m : '') + '?text=' + encodeURIComponent(text), '_blank');
  }

  // ---------- invoice numbering ----------
  function prefixOf(type) { const b = S.biz || {}; return type === 'EST' ? (b.estPrefix || 'EST') : type === 'BOS' ? (b.bosPrefix || 'BOS') : (b.prefix || 'INV'); }
  function nextNo(type, date) {
    const fy = GST.fyOf(date);
    const seq = 1 + S.invoices.filter(i => i.type === type && i.fy === fy).reduce((m, i) => Math.max(m, i.seq || 0), 0);
    return { fy, seq, no: prefixOf(type) + '/' + fy + '/' + String(seq).padStart(3, '0') };
  }

  // =====================================================================
  //  ROUTER
  // =====================================================================
  async function route() {
    closeModal();
    if (!S.biz && !location.hash.startsWith('#/settings')) { location.hash = '#/settings/setup'; return; }
    const [, r, a, b, c] = (location.hash || '#/home').split('/');
    $('#nav').classList.toggle('hidden', r === 'settings' && a === 'setup');
    try {
      if (r === 'home' || !r) return home();
      if (r === 'bills') return bills();
      if (r === 'bill' && a === 'new') return billForm(null, b);
      if (r === 'bill' && a === 'edit') return billForm(b);
      if (r === 'bill' && a === 'view') return billView(b);
      if (r === 'bill' && a === 'copy') return billForm(null, c, b);
      if (r === 'parties') return parties();
      if (r === 'party') return partyView(a);
      if (r === 'items') return items();
      if (r === 'payments') return payments();
      if (r === 'reports') return reports(a);
      if (r === 'more') return more();
      if (r === 'settings') return settings(a === 'setup');
      if (r === 'backup') return backup();
      home();
    } catch (err) { console.error(err); view('<div class="card err">Error: ' + esc(err.message) + '</div>'); }
  }
  window.addEventListener('hashchange', route);

  // =====================================================================
  //  HOME
  // =====================================================================
  function home() {
    nav('home'); setTop(S.biz.name || APP.name);
    const t = today(), m = t.slice(0, 7);
    const live = S.invoices.filter(i => i.status !== 'CANCELLED' && i.type !== 'EST');
    const todaySale = live.filter(i => i.date === t).reduce((a, i) => a + i.totals.total, 0);
    const month = live.filter(i => i.date.startsWith(m));
    const monthSale = month.reduce((a, i) => a + i.totals.total, 0);
    const recv = S.parties.reduce((a, p) => a + Math.max(0, partyBal(p)), 0);
    const recent = S.invoices.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 8);
    const lb = S.biz.lastBackup ? REP.daysBetween(S.biz.lastBackup.slice(0, 10), t) : 999;
    view(`
      ${S.invoices.length && lb > 7 ? `<div class="card" style="background:#fff4dc"><b>⚠ Backup</b> — ${S.biz.lastBackup ? lb + ' दिन से backup नहीं लिया' : 'अभी तक backup नहीं लिया'}. <a href="#/backup">अभी लें →</a></div>` : ''}
      <div class="stats">
        <div class="stat hl"><span>${T('todaySale')}</span><b>${money(todaySale)}</b></div>
        <div class="stat"><span>${T('monthSale')}</span><b>${money(monthSale)}</b></div>
        <div class="stat"><span>${T('toReceive')}</span><b class="${recv > 0 ? 'red' : ''}">${money(recv)}</b></div>
        <div class="stat"><span>${T('billsMonth')}</span><b>${month.length}</b></div>
      </div>
      <div class="quick" style="margin-bottom:12px">
        <a href="#/bill/new/TAX"><i>🧾</i>${T('taxInvoice')}</a>
        <a href="#/bill/new/EST"><i>📝</i>${T('estimate')}</a>
        <a href="#/payments"><i>💰</i>${T('addPayment')}</a>
        <a href="#/reports"><i>📊</i>${T('reports')}</a>
      </div>
      <div class="card" style="padding:0">
        <h2 style="padding:14px 14px 0">${T('recent')}</h2>
        ${recent.length ? '<div class="list" style="box-shadow:none">' + recent.map(billRow).join('') + '</div>' : `<div class="empty">${T('noData')}<br><br><a class="btn" href="#/bill/new">＋ ${T('newBill')}</a></div>`}
      </div>`);
  }
  function billRow(i) {
    const p = i.party || {};
    return `<a class="row" href="#/bill/view/${i.id}"><div class="main"><div class="t">${esc(p.name || 'Cash')}</div>
      <div class="s">${esc(i.no)} · ${dmy(i.date)} ${i.type !== 'TAX' ? `<span class="pill ${PILL[i.type]}">${T(TYPE_NAME[i.type])}</span>` : ''}${i.status === 'CANCELLED' ? ' <span class="pill x">CANCELLED</span>' : ''}</div></div>
      <div class="amt">${money(i.totals.total)}</div></a>`;
  }

  // =====================================================================
  //  BILLS LIST
  // =====================================================================
  function bills() {
    nav('bills'); setTop(T('bills'));
    let type = 'ALL', q = '';
    view(`<div class="seg" id="bt">${['ALL', 'TAX', 'BOS', 'EST'].map(t => `<button data-t="${t}" class="${t === 'ALL' ? 'on' : ''}">${t === 'ALL' ? 'All' : T(TYPE_NAME[t])}</button>`).join('')}</div>
      <input class="search" id="bq" placeholder="${T('search')}"><div id="bl"></div>`);
    const draw = () => {
      const L = S.invoices.filter(i => (type === 'ALL' || i.type === type) &&
        (!q || (i.no + ' ' + ((i.party && i.party.name) || '')).toLowerCase().includes(q)))
        .sort((a, b) => b.date.localeCompare(a.date) || (b.seq || 0) - (a.seq || 0));
      $('#bl').innerHTML = L.length ? '<div class="list">' + L.slice(0, 300).map(billRow).join('') + '</div>' : `<div class="empty">${T('noData')}</div>`;
    };
    $('#bt').onclick = e => { const b = e.target.closest('button'); if (!b) return; type = b.dataset.t; $$('#bt button').forEach(x => x.classList.toggle('on', x === b)); draw(); };
    $('#bq').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
    draw();
  }

  // =====================================================================
  //  BILL FORM (new / edit / copy)
  // =====================================================================
  async function billForm(editId, type, copyId) {
    nav('new');
    const src = editId ? S.invoices.find(i => i.id === editId) : copyId ? S.invoices.find(i => i.id === copyId) : null;
    if (editId && !src) { location.hash = '#/bills'; return; }
    const biz = S.biz;
    const f = src ? JSON.parse(JSON.stringify(src)) : {
      type: type || (biz.gstin ? 'TAX' : 'BOS'), date: today(), partyId: '', party: null, pos: biz.state, inclusive: false,
      lines: [{ name: '', hsn: '', qty: 1, unit: 'NOS', rate: '', disc: '', gst: biz.defaultGst != null && biz.defaultGst !== '' ? Number(biz.defaultGst) : 18 }], notes: ''
    };
    if (copyId) { delete f.id; delete f.no; delete f.seq; delete f.fy; f.status = 'ACTIVE'; f.date = today(); if (type) f.type = type; }
    if (!editId) Object.assign(f, nextNo(f.type, f.date));
    setTop(editId ? T('edit') + ' ' + f.no : T('newBill'), true);

    const partyName = f.party ? f.party.name : '';
    view(`
      <div class="card"><div class="f">
        ${field(T('taxInvoice') + ' / ' + T('estimate'), `<select id="ftype" ${editId ? 'disabled' : ''}>
          <option value="TAX" ${f.type === 'TAX' ? 'selected' : ''}>${T('taxInvoice')}</option>
          <option value="BOS" ${f.type === 'BOS' ? 'selected' : ''}>${T('bos')}</option>
          <option value="EST" ${f.type === 'EST' ? 'selected' : ''}>${T('estimate')}</option></select>`)}
        ${field(T('date'), `<input type="date" id="fdate" value="${f.date}">`)}
        ${field(T('billNo'), `<input id="fno" value="${esc(f.no)}" maxlength="16">`)}
        ${field(T('pos'), `<select id="fpos">${stateOptions(f.pos)}</select>`)}
        <label class="l full">${T('party')}<span style="display:flex;gap:8px"><input id="fparty" list="plist" value="${esc(partyName)}" placeholder="${T('cashSale')}" autocomplete="off"><button type="button" class="btn sec" id="addParty" style="padding:8px 12px;white-space:nowrap">＋ New</button></span></label>
        <div class="full hint" id="pinfo"></div>
        <label class="chk full"><input type="checkbox" id="fincl" ${f.inclusive ? 'checked' : ''}> ${T('inclusive')}</label>
      </div>
      <datalist id="plist">${S.parties.map(p => `<option value="${esc(p.name)}">${esc(p.mobile || '')}</option>`).join('')}</datalist>
      <datalist id="ilist">${S.items.map(i => `<option value="${esc(i.name)}">${esc(i.hsn || '')} · ₹${i.rate || 0}</option>`).join('')}</datalist>
      </div>
      <div id="lines"></div>
      <button class="btn sec block" id="addLine" style="margin-bottom:12px">${T('addLine')}</button>
      <div class="card">
        <div class="tot" id="tot"></div>
        <div class="words" id="words"></div>
      </div>
      <div class="card"><div class="f">
        ${field(T('notes'), `<textarea id="fnotes" placeholder="e.g. Delivery, vehicle no., PO no.">${esc(f.notes || '')}</textarea>`, 'full')}
        ${!editId ? field(T('receivedNow'), `<input id="fpaid" type="number" inputmode="decimal" placeholder="0">`) +
          field(T('mode'), `<select id="fmode">${MODES.map(m => `<option>${m}</option>`).join('')}</select>`) : ''}
      </div></div>
      <div class="err" id="ferr"></div>
      <div class="sticky-save"><button class="btn" id="fsave">💾 ${T('save')}</button></div>`);

    const unitOpts = sel => GST.UNITS.map(u => `<option ${u === sel ? 'selected' : ''}>${u}</option>`).join('');
    const gstOpts = sel => GST.GST_RATES.map(r => `<option value="${r}" ${Number(sel) === r ? 'selected' : ''}>${r}%</option>`).join('');
    let drawing = false;
    function drawLines() {
      if (drawing) { setTimeout(drawLines, 0); return; }     // innerHTML बदलते समय blur→change दोबारा न चलाए
      drawing = true;
      try { drawLinesNow(); } finally { drawing = false; }
    }
    function drawLinesNow() {
      const noTax = f.type === 'BOS';
      $('#lines').innerHTML = f.lines.map((l, k) => `<div class="line" data-k="${k}">
        <div class="lh"><span>${T('item')} ${k + 1}</span>${f.lines.length > 1 ? `<button data-rm="${k}">✕ ${T('del')}</button>` : ''}</div>
        <div class="g">
          ${field(T('item'), `<input data-f="name" list="ilist" value="${esc(l.name)}" autocomplete="off">`)}
          ${field(T('hsn'), `<input data-f="hsn" value="${esc(l.hsn)}" inputmode="numeric" maxlength="8">`)}
          ${field(T('unit'), `<select data-f="unit">${unitOpts(l.unit)}</select>`)}
        </div>
        <div class="g4">
          ${field(T('qty'), `<input data-f="qty" type="number" inputmode="decimal" value="${l.qty}">`)}
          ${field(T('rate'), `<input data-f="rate" type="number" inputmode="decimal" value="${l.rate}">`)}
          ${field(T('disc'), `<input data-f="disc" type="number" inputmode="decimal" value="${l.disc || ''}">`)}
          ${field(T('gst'), `<select data-f="gst" ${noTax ? 'disabled' : ''}>${gstOpts(noTax ? 0 : l.gst)}</select>`)}
        </div>
        <div class="lamt" data-amt="${k}"></div></div>`).join('');
      recalc();
    }
    function inv() {
      return { type: f.type, sellerState: biz.state, posState: f.pos, inclusive: f.inclusive,
        lines: f.lines.map(l => ({ qty: num(l.qty), rate: num(l.rate), disc: num(l.disc), gst: num(l.gst) })) };
    }
    function recalc() {
      const t = GST.calc(inv());
      t.lines.forEach((c, k) => { const el = $(`[data-amt="${k}"]`); if (el) el.innerHTML = `${T('taxable')} ${money(c.taxable)}${c.tax ? ' + GST ' + money(c.tax) : ''} = <b>${money(c.amount)}</b>`; });
      $('#tot').innerHTML = `<div><span>${T('taxable')}</span><span>${money(t.taxable)}</span></div>
        ${f.type === 'BOS' ? '' : t.inter ? `<div><span>IGST</span><span>${money(t.igst)}</span></div>` :
          `<div><span>CGST</span><span>${money(t.cgst)}</span></div><div><span>SGST</span><span>${money(t.sgst)}</span></div>`}
        ${t.roundOff ? `<div><span>${T('roundOff')}</span><span>${money(t.roundOff)}</span></div>` : ''}
        <div class="gt"><span>${T('total')}</span><span>${money(t.total)}</span></div>`;
      $('#words').textContent = GST.amountWords(t.total);
      return t;
    }
    function setParty(name) {
      const p = S.parties.find(x => x.name.toLowerCase() === name.trim().toLowerCase());
      f.partyId = p ? p.id : ''; f.party = p ? { name: p.name, gstin: p.gstin || '', state: p.state || '', address: p.address || '', mobile: p.mobile || '' } : (name.trim() ? { name: name.trim() } : null);
      if (p && p.state) { f.pos = p.state; $('#fpos').value = p.state; }
      $('#pinfo').innerHTML = p ? `${p.gstin ? 'GSTIN ' + esc(p.gstin) + ' · ' : 'Unregistered · '}${esc(GST.stateName(p.state))}${(() => { const b = partyBal(p); return b ? ' · ' + T('balance') + ' <b class="' + (b > 0 ? 'red' : 'green') + '">' + money(b) + '</b>' : ''; })()}`
        : name.trim() ? 'नई पार्टी — save पर सिर्फ़ नाम जाएगा. पूरी जानकारी के लिए "+ New" दबाएँ.' : '';
      recalc();
    }
    $('#ftype').onchange = e => {
      f.type = e.target.value;
      if (!editId) { Object.assign(f, nextNo(f.type, f.date)); $('#fno').value = f.no; }
      drawLines();
    };
    $('#fdate').onchange = e => { f.date = e.target.value; if (!editId) { Object.assign(f, nextNo(f.type, f.date)); $('#fno').value = f.no; } };
    $('#fno').oninput = e => { f.no = e.target.value.trim(); };
    $('#fpos').onchange = e => { f.pos = e.target.value; recalc(); };
    $('#fincl').onchange = e => { f.inclusive = e.target.checked; recalc(); };
    $('#fparty').onchange = e => setParty(e.target.value);
    $('#addParty').onclick = () => partyForm(null, p => { $('#fparty').value = p.name; $('#plist').innerHTML = S.parties.map(x => `<option value="${esc(x.name)}">`).join(''); setParty(p.name); });
    $('#addLine').onclick = () => { const last = f.lines[f.lines.length - 1] || {}; f.lines.push({ name: '', hsn: '', qty: 1, unit: last.unit || 'NOS', rate: '', disc: '', gst: last.gst != null ? last.gst : 18 }); drawLines(); };
    $('#lines').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { f.lines.splice(Number(b.dataset.rm), 1); drawLines(); } });
    $('#lines').addEventListener('input', e => {
      const el = e.target, box = el.closest('.line'); if (!box || !el.dataset.f) return;
      const l = f.lines[Number(box.dataset.k)];
      l[el.dataset.f] = el.value;
      recalc();
    });
    $('#lines').addEventListener('change', e => {
      const el = e.target, box = el.closest('.line'); if (!box || el.dataset.f !== 'name') return;
      const l = f.lines[Number(box.dataset.k)], it = S.items.find(i => i.name.toLowerCase() === el.value.trim().toLowerCase());
      if (it) {
        l.name = it.name; l.hsn = it.hsn || ''; l.unit = it.unit || 'NOS';
        if (f.type !== 'BOS') l.gst = it.gst != null ? it.gst : l.gst;
        // item master में rate GST से पहले का है; "rate में GST शामिल" वाले बिल में GST जोड़कर दिखाओ
        l.rate = it.rate ? (f.inclusive && f.type !== 'BOS' ? GST.r2(it.rate * (1 + num(l.gst) / 100)) : it.rate) : '';
        setTimeout(drawLines, 0);
      }
    });
    $('#fsave').onclick = async () => {
      const err = m => { $('#ferr').textContent = m; toast(m); };
      f.notes = $('#fnotes').value.trim();
      f.lines = f.lines.filter(l => String(l.name).trim() && num(l.qty) > 0);
      if (!f.lines.length) { f.lines.push({ name: '', qty: 1, unit: 'NOS', gst: 18 }); drawLines(); return err('कम से कम एक आइटम (नाम + मात्रा) भरें'); }
      if (!f.no) return err('बिल नंबर भरें');
      if (f.type === 'TAX' && !biz.gstin) return err('Tax Invoice के लिए Settings में अपना GSTIN भरें, या Bill of Supply चुनें');
      if (S.invoices.some(i => i.id !== f.id && i.type === f.type && i.no === f.no)) return err('यह बिल नंबर पहले से है: ' + f.no);
      if (f.party && f.party.gstin && !GST.gstinValid(f.party.gstin)) return err('पार्टी का GSTIN ग़लत है');
      f.lines = f.lines.map(l => ({ name: String(l.name).trim(), hsn: String(l.hsn || '').trim(), unit: l.unit || 'NOS', qty: num(l.qty), rate: num(l.rate), disc: num(l.disc), gst: f.type === 'BOS' ? 0 : num(l.gst) }));
      f.totals = GST.calc(inv());
      f.fy = GST.fyOf(f.date);
      if (!f.status) f.status = 'ACTIVE';
      if (!f.createdAt) f.createdAt = new Date().toISOString();
      // नई पार्टी (सिर्फ़ नाम) → master में जोड़ो
      if (f.party && !f.partyId) {
        const np = await DB.put('parties', { name: f.party.name, state: f.pos, gstin: '', mobile: '', address: '' });
        f.partyId = np.id; f.party.state = f.pos;
      }
      // नए आइटम → master में जोड़ो (अगली बार अपने आप भरेंगे)
      for (const l of f.lines) {
        if (!S.items.some(i => i.name.toLowerCase() === l.name.toLowerCase()))
          await DB.put('items', { name: l.name, hsn: l.hsn, unit: l.unit, rate: f.inclusive && l.gst ? GST.r2(l.rate / (1 + l.gst / 100)) : l.rate, gst: l.gst });
      }
      const saved = await DB.put('invoices', f);
      const paid = !editId && $('#fpaid') ? num($('#fpaid').value) : 0;
      if (paid > 0 && f.type !== 'EST' && f.partyId)
        await DB.put('payments', { date: f.date, partyId: f.partyId, amount: paid, mode: $('#fmode').value, ref: '', invoiceId: saved.id, note: 'Against ' + f.no });
      await load();
      toast('✓ ' + f.no + ' saved');
      location.hash = '#/bill/view/' + saved.id;
    };
    if (f.party) setParty(f.party.name);
    drawLines();
  }

  // =====================================================================
  //  BILL VIEW
  // =====================================================================
  function billView(id) {
    const i = S.invoices.find(x => x.id === id);
    if (!i) { location.hash = '#/bills'; return; }
    nav('bills'); setTop(i.no, '#/bills');
    const p = i.party || {};
    const partyRec = partyById(i.partyId);
    const paidAgainst = S.payments.filter(x => x.invoiceId === i.id).reduce((a, x) => a + num(x.amount), 0);
    view(`
      ${i.status === 'CANCELLED' ? '<div class="card" style="background:#fde7e7"><b class="red">यह बिल CANCELLED है</b> — रिपोर्ट और खाते में नहीं गिना जाता.</div>' : ''}
      <div class="card"><div class="row" style="padding:0;cursor:default"><div class="main">
        <div class="t" style="font-size:17px">${esc(p.name || 'Cash')}</div>
        <div class="s">${T(TYPE_NAME[i.type])} · ${esc(i.no)} · ${dmy(i.date)}</div>
        ${partyRec && i.type !== 'EST' ? `<div class="s">${T('balance')}: <b class="${partyBal(partyRec) > 0 ? 'red' : 'green'}">${money(partyBal(partyRec))}</b>${paidAgainst ? ' · इस बिल पर मिला ' + money(paidAgainst) : ''}</div>` : ''}
      </div><div class="amt" style="font-size:20px">${money(i.totals.total)}</div></div></div>
      <div class="btns" style="margin-bottom:12px">
        <button class="btn" id="pA4">🖨 ${T('printA4')}</button>
        <button class="btn sec" id="p80">🧾 ${T('print80')}</button>
        <button class="btn wa" id="wa">💬 ${T('whatsapp')}</button>
      </div>
      <div class="paper" id="paper">${PRINT.a4(i, S.biz)}</div>
      <div class="btns" style="margin-top:12px">
        ${i.type !== 'EST' && i.partyId && i.status !== 'CANCELLED' ? `<button class="btn sec" id="pay">💰 ${T('addPayment')}</button>` : ''}
        ${i.type === 'EST' ? `<button class="btn sec" id="conv">➡ ${T('taxInvoice')} बनाएँ</button>` : ''}
        <a class="btn sec" href="#/bill/edit/${i.id}">✏ ${T('edit')}</a>
        <a class="btn sec" href="#/bill/copy/${i.id}">⧉ Copy</a>
        ${i.status !== 'CANCELLED' && i.type !== 'EST' ? '<button class="btn warn" id="cancelB">⊘ Cancel bill</button>' : ''}
        ${i.type === 'EST' || i.status === 'CANCELLED' ? `<button class="btn danger" id="delB">🗑 ${T('del')}</button>` : ''}
      </div>`);
    // A4 preview phone पर छोटा दिखे
    const paper = $('#paper'), inner = paper.firstElementChild;
    const fitPaper = () => { const w = paper.clientWidth, sc = Math.min(1, w / 794); inner.style.width = '794px'; inner.style.transform = `scale(${sc})`; inner.style.transformOrigin = '0 0'; paper.style.height = inner.offsetHeight * sc + 'px'; };
    fitPaper(); window.onresize = fitPaper;
    $('#pA4').onclick = () => PRINT.print(i, S.biz, 'A4');
    $('#p80').onclick = () => PRINT.print(i, S.biz, '80');
    $('#wa').onclick = () => {
      const lines = [`*${S.biz.name}*`, `${T(TYPE_NAME[i.type])}: *${i.no}*`, `Date: ${dmy(i.date)}`, `Amount: *${money(i.totals.total)}*`];
      if (partyRec && i.type !== 'EST') { const b = partyBal(partyRec); if (b > 0) lines.push(`Total balance: ${money(b)}`); }
      if (S.biz.upi && i.type !== 'EST') lines.push('', 'Pay by UPI: ' + QR.upiLink({ vpa: S.biz.upi, name: S.biz.name, amount: i.totals.total, note: i.no }));
      lines.push('', 'Thank you!');
      waOpen(p.mobile, lines.join('\n'));
    };
    const pay = $('#pay'); if (pay) pay.onclick = () => paymentForm({ partyId: i.partyId, invoiceId: i.id, amount: Math.max(0, partyBal(partyRec)) }, () => billView(id));
    const conv = $('#conv'); if (conv) conv.onclick = () => { location.hash = '#/bill/copy/' + i.id + '/TAX'; };
    const cb = $('#cancelB'); if (cb) cb.onclick = async () => {
      if (!await confirmBox('बिल ' + i.no + ' cancel करें? नंबर वही रहेगा, रिपोर्ट में नहीं गिना जाएगा.')) return;
      i.status = 'CANCELLED'; await DB.put('invoices', i); await load(); toast('Cancelled'); billView(id);
    };
    const db = $('#delB'); if (db) db.onclick = async () => {
      if (!await confirmBox('पूरी तरह हटाएँ? यह वापस नहीं आएगा.')) return;
      await DB.del('invoices', i.id); await load(); toast('Deleted'); location.hash = '#/bills';
    };
  }

  // =====================================================================
  //  PARTIES
  // =====================================================================
  function parties() {
    nav('parties'); setTop(T('parties'), false, `<button class="tbtn" id="padd">＋ ${T('addParty')}</button>`);
    view(`<input class="search" id="pq" placeholder="${T('search')}"><div id="pl"></div>`);
    let q = '';
    const draw = () => {
      const L = S.parties.filter(p => !q || (p.name + ' ' + (p.mobile || '') + ' ' + (p.gstin || '')).toLowerCase().includes(q));
      $('#pl').innerHTML = L.length ? '<div class="list">' + L.map(p => { const b = partyBal(p); return `<a class="row" href="#/party/${p.id}"><div class="main"><div class="t">${esc(p.name)}</div>
        <div class="s">${esc(p.mobile || '')}${p.gstin ? ' · ' + esc(p.gstin) : ''}</div></div>
        <div class="amt ${b > 0 ? 'red' : b < 0 ? 'green' : ''}">${money(Math.abs(b))}<small>${b > 0 ? 'लेना' : b < 0 ? 'advance' : ''}</small></div></a>`; }).join('') + '</div>'
        : `<div class="empty">${T('noData')}</div>`;
    };
    $('#pq').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
    $('#padd').onclick = () => partyForm(null, () => parties());
    draw();
  }
  function partyForm(p, done) {
    p = p || { name: '', mobile: '', gstin: '', state: S.biz.state, address: '', opening: '' };
    modal(`<h3>${p.id ? T('edit') : T('addParty')}</h3><div class="f">
      ${field('Name *', `<input name="name" value="${esc(p.name)}">`, 'full')}
      ${field('Mobile', `<input name="mobile" type="tel" inputmode="tel" value="${esc(p.mobile)}">`)}
      ${field('GSTIN', `<input name="gstin" value="${esc(p.gstin)}" maxlength="15" placeholder="Optional" autocapitalize="characters">`)}
      ${field('State', `<select name="state">${stateOptions(p.state || S.biz.state)}</select>`, 'full')}
      ${field('Address', `<textarea name="address">${esc(p.address)}</textarea>`, 'full')}
      ${field('Opening balance (₹)', `<input name="opening" type="number" inputmode="decimal" value="${esc(p.opening)}" placeholder="लेना = +, advance = −">`)}
      ${field('As on', `<input name="openingDate" type="date" value="${esc(p.openingDate || '')}">`)}
      </div><div class="err" id="perr"></div>
      <div class="btns" style="margin-top:12px"><button class="btn sec" id="pc">${T('cancel')}</button><button class="btn" id="ps">${T('save')}</button></div>`, sh => {
      const g = sh.querySelector('[name=gstin]');
      g.oninput = () => { g.value = g.value.toUpperCase(); const v = g.value.trim(); if (v.length >= 2 && GST.stateName(v.slice(0, 2))) sh.querySelector('[name=state]').value = v.slice(0, 2); };
      sh.querySelector('#pc').onclick = closeModal;
      sh.querySelector('#ps').onclick = async () => {
        const d = formData(sh); d.gstin = d.gstin.toUpperCase();
        if (!d.name) return sh.querySelector('#perr').textContent = 'नाम भरें';
        if (d.gstin && !GST.gstinValid(d.gstin)) return sh.querySelector('#perr').textContent = 'GSTIN ग़लत है (15 अक्षर, checksum)';
        if (S.parties.some(x => x.id !== p.id && x.name.toLowerCase() === d.name.toLowerCase())) return sh.querySelector('#perr').textContent = 'इस नाम की पार्टी पहले से है';
        d.opening = d.opening === '' ? '' : num(d.opening);
        const saved = await DB.put('parties', Object.assign(p, d));
        await load(); closeModal(); toast('✓ Saved');
        if (done) done(saved);
      };
    });
  }
  function partyView(id) {
    const p = partyById(id); if (!p) { location.hash = '#/parties'; return; }
    nav('parties'); setTop(p.name, '#/parties', `<button class="tbtn" id="pedit">✏</button>`);
    const L = REP.ledger(p, S.invoices, S.payments);
    view(`<div class="card"><div class="row" style="padding:0;cursor:default"><div class="main">
        <div class="s">${esc(p.mobile || '')}${p.gstin ? ' · GSTIN ' + esc(p.gstin) : ' · Unregistered'} · ${esc(GST.stateName(p.state))}</div>
        <div class="s">${esc(p.address || '')}</div></div>
        <div class="amt ${L.balance > 0 ? 'red' : 'green'}" style="font-size:20px">${money(Math.abs(L.balance))}<small>${L.balance > 0 ? 'लेना बाकी' : L.balance < 0 ? 'advance' : 'clear'}</small></div></div></div>
      <div class="btns" style="margin-bottom:12px">
        <button class="btn" id="ppay">💰 ${T('addPayment')}</button>
        <a class="btn sec" href="#/bill/new/TAX" id="pbill">🧾 ${T('newBill')}</a>
        ${L.balance > 0 ? `<button class="btn wa" id="prem">💬 ${T('reminder')}</button>` : ''}
      </div>
      <h3 style="margin:6px 2px 8px">${T('ledger')}</h3>
      <div class="tw"><table class="t"><thead><tr><th>Date</th><th>Particulars</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr></thead>
      <tbody>${L.rows.map(r => `<tr ${r.kind === 'inv' ? `style="cursor:pointer" onclick="location.hash='#/bill/view/${r.ref}'"` : ''}><td>${dmy(r.date)}</td><td>${esc(r.desc)}</td>
        <td class="n">${r.dr ? GST.inr(r.dr) : ''}</td><td class="n">${r.cr ? GST.inr(r.cr) : ''}</td><td class="n">${GST.inr(r.bal)}</td></tr>`).join('') || `<tr><td colspan="5" class="muted">${T('noData')}</td></tr>`}</tbody></table></div>
      <div class="btns" style="margin-top:12px"><button class="btn danger" id="pdel">🗑 ${T('del')} party</button></div>`);
    $('#pedit').onclick = () => partyForm(p, () => partyView(id));
    $('#ppay').onclick = () => paymentForm({ partyId: p.id, amount: Math.max(0, L.balance) }, () => partyView(id));
    $('#pbill').onclick = e => { e.preventDefault(); sessionStorage.setItem('bm_party', p.name); location.hash = '#/bill/new/TAX'; };
    const rem = $('#prem'); if (rem) rem.onclick = () => {
      const msg = [`Dear ${p.name},`, `Your outstanding balance with *${S.biz.name}* is *${money(L.balance)}*.`, 'Kindly pay at the earliest.'];
      if (S.biz.upi) msg.push('', 'UPI: ' + QR.upiLink({ vpa: S.biz.upi, name: S.biz.name, amount: L.balance, note: 'Balance' }));
      msg.push('', 'Thank you.'); waOpen(p.mobile, msg.join('\n'));
    };
    $('#pdel').onclick = async () => {
      if (S.invoices.some(i => i.partyId === p.id) || S.payments.some(x => x.partyId === p.id)) return toast('इस पार्टी के बिल / पेमेंट हैं — हटा नहीं सकते');
      if (!await confirmBox('पार्टी हटाएँ?')) return;
      await DB.del('parties', p.id); await load(); location.hash = '#/parties';
    };
  }

  // =====================================================================
  //  ITEMS
  // =====================================================================
  function items() {
    nav('more'); setTop(T('items'), '#/more', `<button class="tbtn" id="iadd">＋ ${T('addItem')}</button>`);
    view(`<input class="search" id="iq" placeholder="${T('search')}"><div id="il"></div>`);
    let q = '';
    const draw = () => {
      const L = S.items.filter(i => !q || (i.name + ' ' + (i.hsn || '')).toLowerCase().includes(q));
      $('#il').innerHTML = L.length ? '<div class="list">' + L.map(i => `<div class="row" data-id="${i.id}"><div class="main"><div class="t">${esc(i.name)}</div>
        <div class="s">HSN ${esc(i.hsn || '-')} · ${esc(i.unit || 'NOS')} · GST ${i.gst != null ? i.gst : '-'}%</div></div><div class="amt">${money(i.rate || 0)}</div></div>`).join('') + '</div>'
        : `<div class="empty">${T('noData')}</div>`;
    };
    $('#iq').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
    $('#il').onclick = e => { const r = e.target.closest('[data-id]'); if (r) itemForm(S.items.find(i => i.id === r.dataset.id)); };
    $('#iadd').onclick = () => itemForm(null);
    function itemForm(it) {
      it = it || { name: '', hsn: '', unit: 'NOS', rate: '', gst: S.biz.defaultGst != null && S.biz.defaultGst !== '' ? Number(S.biz.defaultGst) : 18 };
      modal(`<h3>${it.id ? T('edit') : T('addItem')}</h3><div class="f">
        ${field('Name *', `<input name="name" value="${esc(it.name)}">`, 'full')}
        ${field(T('hsn'), `<input name="hsn" inputmode="numeric" maxlength="8" value="${esc(it.hsn)}">`)}
        ${field(T('unit'), `<select name="unit">${GST.UNITS.map(u => `<option ${u === it.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>`)}
        ${field(T('rate') + ' (₹, GST से पहले)', `<input name="rate" type="number" inputmode="decimal" value="${esc(it.rate)}">`)}
        ${field(T('gst'), `<select name="gst">${GST.GST_RATES.map(r => `<option value="${r}" ${Number(it.gst) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select>`)}
        </div><div class="err" id="ierr"></div>
        <div class="btns" style="margin-top:12px">${it.id ? `<button class="btn danger" id="idel">${T('del')}</button>` : ''}<button class="btn sec" id="ic">${T('cancel')}</button><button class="btn" id="is">${T('save')}</button></div>`, sh => {
        sh.querySelector('#ic').onclick = closeModal;
        const del = sh.querySelector('#idel'); if (del) del.onclick = async () => { await DB.del('items', it.id); await load(); closeModal(); draw(); };
        sh.querySelector('#is').onclick = async () => {
          const d = formData(sh);
          if (!d.name) return sh.querySelector('#ierr').textContent = 'नाम भरें';
          if (S.items.some(x => x.id !== it.id && x.name.toLowerCase() === d.name.toLowerCase())) return sh.querySelector('#ierr').textContent = 'यह आइटम पहले से है';
          d.rate = num(d.rate); d.gst = num(d.gst);
          await DB.put('items', Object.assign(it, d)); await load(); closeModal(); toast('✓ Saved'); draw();
        };
      });
    }
    draw();
  }

  // =====================================================================
  //  PAYMENTS
  // =====================================================================
  function payments() {
    nav('more'); setTop(T('payments'), '#/more', `<button class="tbtn" id="yadd">＋ ${T('addPayment')}</button>`);
    const L = S.payments.slice().sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    view(L.length ? '<div class="list">' + L.map(y => { const p = partyById(y.partyId) || {}; return `<div class="row" data-id="${y.id}"><div class="main"><div class="t">${esc(p.name || '?')}</div>
      <div class="s">${dmy(y.date)} · ${esc(y.mode || '')}${y.ref ? ' · ' + esc(y.ref) : ''}${y.note ? ' · ' + esc(y.note) : ''}</div></div><div class="amt green">${money(y.amount)}</div></div>`; }).join('') + '</div>'
      : `<div class="empty">${T('noData')}</div>`);
    $('#yadd').onclick = () => paymentForm({}, payments);
    $('#view').onclick = e => { const r = e.target.closest('[data-id]'); if (r) paymentForm(S.payments.find(y => y.id === r.dataset.id), payments); };
  }
  function paymentForm(y, done) {
    const isNew = !y.id;
    y = Object.assign({ date: today(), mode: 'Cash', amount: '', ref: '', note: '' }, y);
    const partyBills = pid => S.invoices.filter(i => i.partyId === pid && i.type !== 'EST' && i.status !== 'CANCELLED').sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
    modal(`<h3>${isNew ? T('addPayment') : T('edit')}</h3><div class="f">
      ${field(T('party') + ' *', `<select name="partyId"><option value="">— select —</option>${S.parties.map(p => `<option value="${p.id}" ${p.id === y.partyId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select>`, 'full')}
      ${field('Amount (₹) *', `<input name="amount" type="number" inputmode="decimal" value="${y.amount ? GST.r2(y.amount) : ''}">`)}
      ${field(T('date'), `<input name="date" type="date" value="${y.date}">`)}
      ${field(T('mode'), `<select name="mode">${MODES.map(m => `<option ${m === y.mode ? 'selected' : ''}>${m}</option>`).join('')}</select>`)}
      ${field('Ref / UTR / Cheque no.', `<input name="ref" value="${esc(y.ref)}">`)}
      ${field('Against bill (optional)', `<select name="invoiceId" id="yinv"></select>`, 'full')}
      ${field(T('notes'), `<input name="note" value="${esc(y.note)}">`, 'full')}
      </div><div class="err" id="yerr"></div>
      <div class="btns" style="margin-top:12px">${!isNew ? `<button class="btn danger" id="ydel">${T('del')}</button>` : ''}<button class="btn sec" id="yc">${T('cancel')}</button><button class="btn" id="ys">${T('save')}</button></div>`, sh => {
      const fillBills = pid => { sh.querySelector('#yinv').innerHTML = '<option value="">—</option>' + partyBills(pid).map(i => `<option value="${i.id}" ${i.id === y.invoiceId ? 'selected' : ''}>${esc(i.no)} · ${dmy(i.date)} · ${money(i.totals.total)}</option>`).join(''); };
      fillBills(y.partyId);
      sh.querySelector('[name=partyId]').onchange = e => fillBills(e.target.value);
      sh.querySelector('#yc').onclick = closeModal;
      const del = sh.querySelector('#ydel'); if (del) del.onclick = async () => { if (!await confirmBox('Payment हटाएँ?')) return; await DB.del('payments', y.id); await load(); closeModal(); done && done(); };
      sh.querySelector('#ys').onclick = async () => {
        const d = formData(sh);
        if (!d.partyId) return sh.querySelector('#yerr').textContent = 'पार्टी चुनें';
        if (!(num(d.amount) > 0)) return sh.querySelector('#yerr').textContent = 'Amount भरें';
        d.amount = num(d.amount);
        await DB.put('payments', Object.assign(y, d)); await load(); closeModal(); toast('✓ ' + money(d.amount) + ' saved'); done && done();
      };
    });
  }

  // =====================================================================
  //  REPORTS
  // =====================================================================
  function reports(tab) {
    nav('more'); setTop(T('reports'), '#/more');
    tab = tab || 'sales';
    const t = today(), y = Number(t.slice(0, 4)), m = Number(t.slice(5, 7));
    const ym = (yy, mm) => yy + '-' + String(mm).padStart(2, '0');
    const lastDay = (yy, mm) => new Date(yy, mm, 0).getDate();
    const thisM = [ym(y, m) + '-01', ym(y, m) + '-' + lastDay(y, m)];
    const pm = m === 1 ? [y - 1, 12] : [y, m - 1];
    const lastM = [ym(pm[0], pm[1]) + '-01', ym(pm[0], pm[1]) + '-' + lastDay(pm[0], pm[1])];
    const fyS = m >= 4 ? y : y - 1, thisFY = [fyS + '-04-01', (fyS + 1) + '-03-31'];
    let range = tab === 'gstr1' ? lastM : thisM;
    view(`<div class="seg" id="rt">${[['sales', T('salesReg')], ['gst', T('gstSum')], ['gstr1', 'GSTR-1'], ['out', T('outstanding')]].map(([k, l]) => `<button data-k="${k}" class="${k === tab ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="card" id="rng" ${tab === 'out' ? 'style="display:none"' : ''}><div class="f">
        ${field(T('from'), `<input type="date" id="rf" value="${range[0]}">`)}${field(T('to'), `<input type="date" id="rto" value="${range[1]}">`)}
        <div class="full btns"><button class="btn sec" data-p="m">This month</button><button class="btn sec" data-p="l">Last month</button><button class="btn sec" data-p="y">This FY</button></div>
      </div></div><div id="rb"></div>`);
    $('#rt').onclick = e => { const b = e.target.closest('button'); if (b) location.hash = '#/reports/' + b.dataset.k; };
    $('#rng').onclick = e => { const b = e.target.closest('[data-p]'); if (!b) return; range = b.dataset.p === 'm' ? thisM : b.dataset.p === 'l' ? lastM : thisFY; $('#rf').value = range[0]; $('#rto').value = range[1]; draw(); };
    $('#rf').onchange = $('#rto').onchange = draw;
    function draw() {
      const from = $('#rf').value, to = $('#rto').value, nm = (S.biz.name || 'billmitra').replace(/\W+/g, '_');
      if (tab === 'sales') {
        const s = REP.sales(S.invoices, from, to);
        $('#rb').innerHTML = `<div class="stats"><div class="stat hl"><span>${T('total')}</span><b>${money(s.sum.total)}</b></div><div class="stat"><span>Bills</span><b>${s.list.length}</b></div></div>
          <div class="tw"><table class="t"><thead><tr><th>Date</th><th>No.</th><th>Party</th><th class="n">Taxable</th><th class="n">Tax</th><th class="n">Total</th></tr></thead>
          <tbody>${s.list.map(i => `<tr onclick="location.hash='#/bill/view/${i.id}'" style="cursor:pointer"><td>${dmy(i.date)}</td><td>${esc(i.no)}</td><td>${esc((i.party && i.party.name) || 'Cash')}</td>
          <td class="n">${GST.inr(i.totals.taxable)}</td><td class="n">${GST.inr(i.totals.cgst + i.totals.sgst + i.totals.igst)}</td><td class="n">${GST.inr(i.totals.total)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">Total</td><td class="n">${GST.inr(s.sum.taxable)}</td><td class="n">${GST.inr(s.sum.cgst + s.sum.sgst + s.sum.igst)}</td><td class="n">${GST.inr(s.sum.total)}</td></tr></tfoot></table></div>
          <button class="btn block" style="margin-top:12px" id="xs">⬇ ${T('export')}</button>`;
        $('#xs').onclick = () => download(XLSX.make([{ name: 'Sales', rows: REP.salesSheet(s.list) }]), `${nm}_sales_${from}_${to}.xlsx`);
      }
      if (tab === 'gst') {
        const s = REP.sales(S.invoices, from, to);
        $('#rb').innerHTML = `<div class="tw"><table class="t"><thead><tr><th>GST %</th><th class="n">Taxable</th><th class="n">CGST</th><th class="n">SGST</th><th class="n">IGST</th><th class="n">Total Tax</th></tr></thead>
          <tbody>${s.rates.map(b => `<tr><td>${b.rate}%</td><td class="n">${GST.inr(b.taxable)}</td><td class="n">${GST.inr(b.cgst)}</td><td class="n">${GST.inr(b.sgst)}</td><td class="n">${GST.inr(b.igst)}</td><td class="n">${GST.inr(b.cgst + b.sgst + b.igst)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td>Total</td><td class="n">${GST.inr(s.sum.taxable)}</td><td class="n">${GST.inr(s.sum.cgst)}</td><td class="n">${GST.inr(s.sum.sgst)}</td><td class="n">${GST.inr(s.sum.igst)}</td><td class="n">${GST.inr(s.sum.cgst + s.sum.sgst + s.sum.igst)}</td></tr></tfoot></table></div>
          <p class="hint">Tax Invoice + Bill of Supply (cancelled और estimate को छोड़कर).</p>`;
      }
      if (tab === 'gstr1') {
        const wb = REP.gstr1(S.biz, S.invoices, from, to), c = n => wb.find(s => s.name === n).rows.length - 1;
        const noHsn = S.invoices.filter(i => i.type === 'TAX' && i.status !== 'CANCELLED' && i.date >= from && i.date <= to).reduce((a, i) => a + i.lines.filter(l => !l.hsn).length, 0);
        $('#rb').innerHTML = `${noHsn ? `<div class="card" style="background:#fff4dc"><b>⚠ ${noHsn} बिल-लाइन में HSN/SAC नहीं है.</b> GSTR-1 में HSN ज़रूरी है — Items में HSN भरें और उन बिलों को Edit करके HSN डालें.</div>` : ''}<div class="card"><h2>GSTR-1 · ${dmy(from)} → ${dmy(to)}</h2>
          <div class="tot"><div><span>B2B rows (GSTIN वाले)</span><b>${c('b2b')}</b></div><div><span>B2C Large (inter-state &gt; ₹1 लाख)</span><b>${c('b2cl')}</b></div>
          <div><span>B2C Small (state + rate)</span><b>${c('b2cs')}</b></div><div><span>HSN rows (B2B / B2C)</span><b>${c('hsn(b2b)')} / ${c('hsn(b2c)')}</b></div></div>
          <p class="hint">Excel में GST offline tool जैसी sheets हैं (b2b, b2cl, b2cs, hsn, docs). File अपने CA को भेजें — filing से पहले CA से जाँच करवाएँ.</p>
          <button class="btn block" id="xg">⬇ GSTR-1 Excel</button></div>`;
        $('#xg').onclick = () => download(XLSX.make(wb), `GSTR1_${(S.biz.gstin || nm)}_${from.slice(0, 7)}.xlsx`);
      }
      if (tab === 'out') {
        const O = REP.outstanding(S.parties, S.invoices, S.payments);
        const sum = k => O.reduce((a, o) => a + o[k], 0);
        $('#rb').innerHTML = `<div class="tw"><table class="t"><thead><tr><th>Party</th><th class="n">0-30</th><th class="n">31-60</th><th class="n">61-90</th><th class="n">90+</th><th class="n">Total</th></tr></thead>
          <tbody>${O.map(o => `<tr onclick="location.hash='#/party/${o.party.id}'" style="cursor:pointer"><td>${esc(o.party.name)}</td><td class="n">${GST.inr(o.d30)}</td><td class="n">${GST.inr(o.d60)}</td>
          <td class="n">${GST.inr(o.d90)}</td><td class="n ${o.d90p ? 'red' : ''}">${GST.inr(o.d90p)}</td><td class="n"><b>${GST.inr(o.total)}</b></td></tr>`).join('') || `<tr><td colspan="6" class="muted">सब clear ✓</td></tr>`}</tbody>
          <tfoot><tr><td>Total</td><td class="n">${GST.inr(sum('d30'))}</td><td class="n">${GST.inr(sum('d60'))}</td><td class="n">${GST.inr(sum('d90'))}</td><td class="n">${GST.inr(sum('d90p'))}</td><td class="n">${GST.inr(sum('total'))}</td></tr></tfoot></table></div>
          <button class="btn block" style="margin-top:12px" id="xo">⬇ ${T('export')}</button>`;
        $('#xo').onclick = () => download(XLSX.make([{ name: 'Outstanding', rows: [['Party', 'Mobile', '0-30', '31-60', '61-90', '90+', 'Advance', 'Total']].concat(O.map(o => [o.party.name, o.party.mobile || '', o.d30, o.d60, o.d90, o.d90p, o.advance, o.total])) }]), `${nm}_outstanding_${today()}.xlsx`);
      }
    }
    draw();
  }

  // =====================================================================
  //  MORE / SETTINGS / BACKUP
  // =====================================================================
  function more() {
    nav('more'); setTop(T('more'));
    view(`<div class="list">
      <a class="row" href="#/items"><div class="main"><div class="t">📦 ${T('items')}</div><div class="s">${S.items.length} items</div></div><span>›</span></a>
      <a class="row" href="#/payments"><div class="main"><div class="t">💰 ${T('payments')}</div><div class="s">${S.payments.length} entries</div></div><span>›</span></a>
      <a class="row" href="#/reports"><div class="main"><div class="t">📊 ${T('reports')}</div><div class="s">Sales · GST · GSTR-1 · Outstanding</div></div><span>›</span></a>
      <a class="row" href="#/settings"><div class="main"><div class="t">🏢 ${T('settings')}</div><div class="s">${esc(S.biz.name)}${S.biz.gstin ? ' · ' + esc(S.biz.gstin) : ''}</div></div><span>›</span></a>
      <a class="row" href="#/backup"><div class="main"><div class="t">💾 ${T('backup')}</div><div class="s">${S.biz.lastBackup ? 'Last: ' + dmy(S.biz.lastBackup.slice(0, 10)) : 'अभी तक नहीं'}</div></div><span>›</span></a>
      <div class="row" id="lng"><div class="main"><div class="t">🌐 ${T('lang')}</div><div class="s">${I18N.lang === 'hi' ? 'हिंदी' : 'English'} — बदलने के लिए दबाएँ</div></div><span>⇄</span></div>
    </div>
    <p class="hint" style="text-align:center;margin-top:18px">${APP.name} v${APP.version} · सारा data इसी phone में है — नियमित backup लें.<br><a href="privacy.html" target="_blank">Privacy Policy</a></p>`);
    $('#lng').onclick = () => { I18N.set(I18N.lang === 'hi' ? 'en' : 'hi'); I18N.apply(); more(); };
  }

  function settings(setup) {
    const b = S.biz || { name: '', gstin: '', state: '24', address: '', phone: '', email: '', upi: '', bank: '', terms: 'Goods once sold will not be taken back.\nSubject to local jurisdiction.', prefix: 'INV', bosPrefix: 'BOS', estPrefix: 'EST', defaultGst: 18 };
    nav('more'); setTop(setup ? 'Welcome — ' + APP.name : T('settings'), setup ? false : '#/more');
    view(`${setup ? '<div class="card" style="background:var(--brand-soft)"><b>नमस्ते! 🙏</b><br>पहले अपने business की जानकारी भरें — यह हर बिल पर छपेगी. बाद में More → Business Settings से बदल सकते हैं.</div>' : ''}
      <div class="card" id="sf"><div class="f">
        ${field('Business name *', `<input name="name" value="${esc(b.name)}">`, 'full')}
        ${field('GSTIN', `<input name="gstin" value="${esc(b.gstin)}" maxlength="15" placeholder="Optional" autocapitalize="characters">`)}
        ${field('State *', `<select name="state">${stateOptions(b.state)}</select>`)}
        ${field('Address', `<textarea name="address">${esc(b.address)}</textarea>`, 'full')}
        ${field('Phone', `<input name="phone" type="tel" value="${esc(b.phone)}">`)}
        ${field('Email', `<input name="email" type="email" value="${esc(b.email)}">`)}
        ${field('UPI ID (बिल पर QR)', `<input name="upi" value="${esc(b.upi)}" placeholder="name@bank">`)}
        ${field('Default GST %', `<select name="defaultGst">${GST.GST_RATES.map(r => `<option value="${r}" ${Number(b.defaultGst) === r ? 'selected' : ''}>${r}%</option>`).join('')}</select>`)}
        ${field('Bank details', `<textarea name="bank" placeholder="Bank, A/c no., IFSC">${esc(b.bank)}</textarea>`, 'full')}
        ${field('Terms & conditions', `<textarea name="terms">${esc(b.terms)}</textarea>`, 'full')}
        ${field('Invoice prefix', `<input name="prefix" maxlength="6" value="${esc(b.prefix)}">`)}
        ${field('Estimate prefix', `<input name="estPrefix" maxlength="6" value="${esc(b.estPrefix)}">`)}
        ${field('Bill of Supply prefix', `<input name="bosPrefix" maxlength="6" value="${esc(b.bosPrefix)}">`)}
        ${field('Logo', `<input type="file" accept="image/*" id="logo">`)}
        <div class="full" id="logoPrev">${b.logo ? `<img src="${b.logo}" style="max-height:60px"> <a href="javascript:void 0" id="rmLogo">हटाएँ</a>` : ''}</div>
      </div><div class="err" id="serr"></div>
      <button class="btn block" style="margin-top:12px" id="ss">💾 ${T('save')}</button></div>`);
    let logo = b.logo || '';
    $('#logo').onchange = e => {
      const file = e.target.files[0]; if (!file) return;
      const img = new Image(), rd = new FileReader();
      rd.onload = () => { img.onload = () => { const c = document.createElement('canvas'), sc = Math.min(1, 300 / img.width, 120 / img.height); c.width = img.width * sc; c.height = img.height * sc; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); logo = c.toDataURL('image/png'); $('#logoPrev').innerHTML = `<img src="${logo}" style="max-height:60px">`; }; img.src = rd.result; };
      rd.readAsDataURL(file);
    };
    const rm = $('#rmLogo'); if (rm) rm.onclick = () => { logo = ''; $('#logoPrev').innerHTML = ''; };
    const g = $('[name=gstin]');
    g.oninput = () => { g.value = g.value.toUpperCase(); const v = g.value.trim(); if (v.length >= 2 && GST.stateName(v.slice(0, 2))) $('[name=state]').value = v.slice(0, 2); };
    $('#ss').onclick = async () => {
      const d = formData($('#sf')); d.gstin = d.gstin.toUpperCase();
      if (!d.name) return $('#serr').textContent = 'Business name भरें';
      if (d.gstin && !GST.gstinValid(d.gstin)) return $('#serr').textContent = 'GSTIN ग़लत है';
      if (d.gstin && d.gstin.slice(0, 2) !== d.state) return $('#serr').textContent = 'GSTIN के पहले 2 अंक और State मेल नहीं खाते';
      ['prefix', 'estPrefix', 'bosPrefix'].forEach(k => d[k] = (d[k] || '').replace(/[^A-Za-z0-9-]/g, '').toUpperCase() || { prefix: 'INV', estPrefix: 'EST', bosPrefix: 'BOS' }[k]);
      d.defaultGst = num(d.defaultGst); d.logo = logo;
      S.biz = await DB.saveBiz(Object.assign(S.biz || {}, d));
      toast('✓ Saved');
      location.hash = setup ? '#/home' : '#/more';
    };
  }

  function backup() {
    nav('more'); setTop(T('backup'), '#/more');
    view(`<div class="card"><h2>💾 Backup लें</h2><p class="hint">सारा data (बिल, पार्टी, पेमेंट, settings) एक file में. इसे Google Drive / WhatsApp पर अपने पास रखें. Phone बदलें या app हटे तो इसी से वापस आएगा.</p>
      <button class="btn block" id="bk">⬇ Backup file download</button></div>
      <div class="card"><h2>♻ Restore</h2><p class="hint red">ध्यान दें: restore करने पर इस phone का अभी का सारा data हट कर backup वाला आ जाएगा.</p>
      <input type="file" accept=".json,application/json" id="rs"></div>
      <div class="card"><h2>ℹ Data कहाँ है?</h2><p class="hint">अभी यह version सारा data इसी phone के browser storage में रखता है (internet के बिना भी चलता है). Cloud sync (कई phone / PC पर एक साथ) अगले version में.</p></div>`);
    $('#bk').onclick = async () => {
      const data = await DB.exportAll();
      download(new Blob([JSON.stringify(data)], { type: 'application/json' }), `billmitra-backup-${today()}.json`);
      S.biz.lastBackup = new Date().toISOString(); await DB.saveBiz(S.biz); toast('✓ Backup downloaded');
    };
    $('#rs').onchange = async e => {
      const file = e.target.files[0]; if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (!await confirmBox(`Restore: ${(data.invoices || []).length} बिल, ${(data.parties || []).length} पार्टी. अभी का data हट जाएगा. आगे बढ़ें?`)) return;
        await DB.importAll(data); await load(); toast('✓ Restored'); location.hash = '#/home';
      } catch (x) { toast('✗ ' + x.message); }
    };
  }

  // ---------- start ----------
  (async function start() {
    I18N.set(I18N.lang); I18N.apply();
    try { await load(); } catch (e) { view('<div class="card err">Storage error: ' + esc(e.message) + '<br>Browser का private mode बंद करें.</div>'); return; }
    // party page से "New Bill" → पार्टी पहले से भरी
    window.addEventListener('hashchange', () => {
      const pn = sessionStorage.getItem('bm_party');
      if (pn && location.hash.startsWith('#/bill/new')) {
        sessionStorage.removeItem('bm_party');
        setTimeout(() => { const el = $('#fparty'); if (el) { el.value = pn; el.dispatchEvent(new Event('change')); } }, 0);
      }
    });
    route();
  })();
})();
