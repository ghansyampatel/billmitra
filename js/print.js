/* BillMitra — bill का A4 और 80mm (thermal) layout */
(function (root) {
  'use strict';
  const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n2 = v => GST.inr(v);
  const dmy = d => { const p = String(d || '').split('-'); return p.length === 3 ? p[2] + '-' + p[1] + '-' + p[0] : d; };
  const TITLE = { TAX: 'TAX INVOICE', BOS: 'BILL OF SUPPLY', EST: 'ESTIMATE / QUOTATION' };
  const qty = v => { v = Number(v) || 0; return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, ''); };

  function upiQr(biz, inv, size) {
    if (!biz.upi || inv.type === 'EST') return '';
    try {
      const link = QR.upiLink({ vpa: biz.upi, name: biz.name, amount: inv.totals.total, note: inv.no });
      return QR.svg(link, size || 84);
    } catch (x) { return ''; }
  }

  function a4(inv, biz) {
    const t = inv.totals, tax = inv.type !== 'BOS', inter = t.inter, p = inv.party || {};
    const lines = inv.lines.map((l, i) => {
      const c = t.lines[i] || {};
      return `<tr><td>${i + 1}</td><td>${e(l.name)}${l.desc ? '<div class="small">' + e(l.desc) + '</div>' : ''}</td><td>${e(l.hsn)}</td>
        <td class="n">${qty(l.qty)} ${e(l.unit || '')}</td><td class="n">${n2(l.rate)}</td><td class="n">${l.disc ? Number(l.disc) + '%' : ''}</td>
        <td class="n">${n2(c.taxable)}</td>${tax ? `<td class="n">${Number(l.gst) || 0}%</td>` : ''}<td class="n">${n2(c.amount)}</td></tr>`;
    }).join('');
    const minRows = Math.max(0, 8 - inv.lines.length);
    const blank = Array.from({ length: minRows }, () => `<tr><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td><td></td>${tax ? '<td></td>' : ''}<td></td></tr>`).join('');
    const rates = Object.values(t.byRate).filter(b => b.taxable);
    const taxTable = tax ? `<table style="margin-top:0"><tr><th>GST %</th><th class="n">Taxable</th>${inter ? '<th class="n">IGST</th>' : '<th class="n">CGST</th><th class="n">SGST</th>'}<th class="n">Total Tax</th></tr>
      ${rates.map(b => `<tr><td>${b.rate}%</td><td class="n">${n2(b.taxable)}</td>${inter ? `<td class="n">${n2(b.igst)}</td>` : `<td class="n">${n2(b.cgst)}</td><td class="n">${n2(b.sgst)}</td>`}<td class="n">${n2(b.cgst + b.sgst + b.igst)}</td></tr>`).join('')}</table>` : '';
    const qr = upiQr(biz, inv, 84);
    return `<div class="inv">
      <div class="hd"><div class="biz"><b>${e(biz.name)}</b>${e(biz.address).replace(/\n/g, '<br>')}<br>
        ${biz.phone ? 'Ph: ' + e(biz.phone) : ''}${biz.email ? ' · ' + e(biz.email) : ''}<br>
        ${biz.gstin ? '<b style="font-size:12px;display:inline">GSTIN: ' + e(biz.gstin) + '</b> · ' : ''}State: ${e(GST.stateName(biz.state))} (${e(biz.state)})</div>
        ${biz.logo ? `<img src="${biz.logo}" alt="">` : ''}</div>
      <div class="ttl">${TITLE[inv.type] || 'INVOICE'}</div>
      <div class="meta">
        <div><b>Bill To:</b><br><b style="font-size:13px">${e(p.name || 'Cash')}</b><br>${e(p.address || '').replace(/\n/g, '<br>')}
          ${p.mobile ? '<br>Ph: ' + e(p.mobile) : ''}${p.gstin ? '<br><b>GSTIN: ' + e(p.gstin) + '</b>' : ''}</div>
        <div>No.: <b>${e(inv.no)}</b><br>Date: <b>${dmy(inv.date)}</b><br>Place of Supply: ${e(GST.stateName(inv.pos))} (${e(inv.pos)})
          ${inv.type === 'TAX' ? '<br>Reverse Charge: No' : ''}${inv.dueDate ? '<br>Due: ' + dmy(inv.dueDate) : ''}</div>
      </div>
      <table><tr><th>#</th><th>Description</th><th>HSN/SAC</th><th class="n">Qty</th><th class="n">Rate${inv.inclusive && tax ? '<br><span style="font-weight:400">(incl. GST)</span>' : ''}</th><th class="n">Disc</th><th class="n">Taxable</th>${tax ? '<th class="n">GST</th>' : ''}<th class="n">Amount</th></tr>
        ${lines}${blank}</table>
      <div class="sum">
        <div>${taxTable}<div style="margin-top:6px"><b>Amount in words:</b><br>${GST.amountWords(t.total)}</div>
          ${inv.notes ? '<div style="margin-top:6px"><b>Notes:</b> ' + e(inv.notes) + '</div>' : ''}</div>
        <div>
          <div class="r"><span>Taxable value</span><span>${n2(t.taxable)}</span></div>
          ${tax ? (inter ? `<div class="r"><span>IGST</span><span>${n2(t.igst)}</span></div>` :
            `<div class="r"><span>CGST</span><span>${n2(t.cgst)}</span></div><div class="r"><span>SGST</span><span>${n2(t.sgst)}</span></div>`) : ''}
          ${t.roundOff ? `<div class="r"><span>Round off</span><span>${n2(t.roundOff)}</span></div>` : ''}
          <div class="r g"><span>TOTAL ₹</span><span>${n2(t.total)}</span></div>
        </div>
      </div>
      <div class="ft">
        <div class="small">${biz.bank ? '<b>Bank:</b> ' + e(biz.bank).replace(/\n/g, '<br>') + '<br>' : ''}
          ${biz.upi ? '<b>UPI:</b> ' + e(biz.upi) : ''}
          ${qr ? `<div style="display:flex;gap:8px;align-items:center;margin-top:4px"><span class="qr">${qr}</span><span>Scan &amp; Pay</span></div>` : ''}
          ${biz.terms ? '<div style="margin-top:4px"><b>Terms:</b><br>' + e(biz.terms).replace(/\n/g, '<br>') + '</div>' : ''}</div>
        <div><span>For <b>${e(biz.name)}</b></span><span style="margin-top:40px">Authorised Signatory</span></div>
      </div>
      <div class="small" style="text-align:center;margin-top:4px;color:#555">${inv.type === 'EST' ? 'This is an estimate, not a tax invoice.' : 'This is a computer generated invoice.'}</div>
    </div>`;
  }

  function thermal(inv, biz) {
    const t = inv.totals, p = inv.party || {}, tax = inv.type !== 'BOS';
    const rows = inv.lines.map((l, i) => {
      const c = t.lines[i] || {};
      return `<tr><td colspan="3">${e(l.name)}</td></tr><tr><td>${qty(l.qty)} x ${n2(l.rate)}</td><td>${tax ? (Number(l.gst) || 0) + '%' : ''}</td><td class="n">${n2(c.amount)}</td></tr>`;
    }).join('');
    const qr = upiQr(biz, inv, 140);
    return `<div class="th">
      <div class="c"><b style="font-size:14px">${e(biz.name)}</b><br>${e(biz.address).replace(/\n/g, '<br>')}${biz.phone ? '<br>Ph: ' + e(biz.phone) : ''}
        ${biz.gstin ? '<br>GSTIN: ' + e(biz.gstin) : ''}</div><hr>
      <div class="c"><b>${TITLE[inv.type]}</b></div>
      No: ${e(inv.no)}<br>Date: ${dmy(inv.date)}<br>${p.name ? 'To: ' + e(p.name) + '<br>' : ''}${p.gstin ? 'GSTIN: ' + e(p.gstin) + '<br>' : ''}<hr>
      <table>${rows}</table><hr>
      <table><tr><td>Taxable</td><td class="n">${n2(t.taxable)}</td></tr>
        ${tax ? (t.inter ? `<tr><td>IGST</td><td class="n">${n2(t.igst)}</td></tr>` : `<tr><td>CGST</td><td class="n">${n2(t.cgst)}</td></tr><tr><td>SGST</td><td class="n">${n2(t.sgst)}</td></tr>`) : ''}
        ${t.roundOff ? `<tr><td>Round off</td><td class="n">${n2(t.roundOff)}</td></tr>` : ''}
        <tr><td><b>TOTAL ₹</b></td><td class="n"><b style="font-size:14px">${n2(t.total)}</b></td></tr></table><hr>
      ${qr ? `<div class="c">${qr}<br>UPI: ${e(biz.upi)}</div><hr>` : ''}
      <div class="c">Thank you! Visit again</div></div>`;
  }

  function print(inv, biz, mode) {
    document.getElementById('print').innerHTML = mode === '80' ? thermal(inv, biz) : a4(inv, biz);
    document.getElementById('pageStyle').textContent = mode === '80'
      ? '@media print{@page{size:80mm auto;margin:0}}' : '@media print{@page{size:A4;margin:8mm}}';
    const old = document.title;
    document.title = (inv.no || 'bill').replace(/[\/\\]/g, '-');      // PDF file का नाम
    setTimeout(() => { window.print(); document.title = old; }, 50);
  }

  root.PRINT = { a4, thermal, print, dmy };
})(window);
