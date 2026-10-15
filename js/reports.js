/* BillMitra — reports: ledger, outstanding, GST summary, GSTR-1 Excel */
(function (root) {
  'use strict';
  const r2 = GST.r2;
  const live = inv => inv.status !== 'CANCELLED';
  const inRange = (d, a, b) => (!a || d >= a) && (!b || d <= b);
  const counts = inv => live(inv) && (inv.type === 'TAX' || inv.type === 'BOS');   // खाते में जाने वाले बिल
  const daysBetween = (a, b) => Math.floor((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 86400000);
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  // ---- एक पार्टी का खाता ----
  function ledger(party, invoices, payments) {
    const rows = [];
    if (Number(party.opening)) rows.push({ date: party.openingDate || '', desc: 'Opening balance', dr: Math.max(0, Number(party.opening)), cr: Math.max(0, -Number(party.opening)) });
    invoices.filter(i => i.partyId === party.id && counts(i)).forEach(i => rows.push({ date: i.date, desc: 'Bill ' + i.no, dr: i.totals.total, cr: 0, ref: i.id, kind: 'inv' }));
    payments.filter(p => p.partyId === party.id).forEach(p => rows.push({ date: p.date, desc: 'Payment' + (p.mode ? ' (' + p.mode + ')' : '') + (p.ref ? ' ' + p.ref : ''), dr: 0, cr: Number(p.amount) || 0, ref: p.id, kind: 'pay' }));
    rows.sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.kind === 'pay') - (b.kind === 'pay'));
    let bal = 0;
    rows.forEach(r => { bal = r2(bal + r.dr - r.cr); r.bal = bal; });
    return { rows, balance: bal };
  }

  // ---- बकाया: पुराने बिल पहले चुकते (FIFO), बाकी दिनों के हिसाब से ----
  function outstanding(parties, invoices, payments, asOn) {
    asOn = asOn || today();
    return parties.map(p => {
      let paid = payments.filter(x => x.partyId === p.id).reduce((a, x) => a + (Number(x.amount) || 0), 0);
      const open = Number(p.opening) || 0;
      if (open < 0) paid += -open;
      const bills = invoices.filter(i => i.partyId === p.id && counts(i)).sort((a, b) => a.date.localeCompare(b.date));
      const items = (open > 0 ? [{ date: p.openingDate || '2000-01-01', amt: open }] : []).concat(bills.map(b => ({ date: b.date, amt: b.totals.total })));
      const age = { d30: 0, d60: 0, d90: 0, d90p: 0 };
      items.forEach(it => {
        let due = it.amt;
        const use = Math.min(due, paid); due -= use; paid -= use;
        if (due <= 0.004) return;
        const d = daysBetween(it.date, asOn);
        if (d <= 30) age.d30 += due; else if (d <= 60) age.d60 += due; else if (d <= 90) age.d90 += due; else age.d90p += due;
      });
      const total = r2(age.d30 + age.d60 + age.d90 + age.d90p - paid);    // paid बचा = advance (minus)
      return { party: p, d30: r2(age.d30), d60: r2(age.d60), d90: r2(age.d90), d90p: r2(age.d90p), advance: r2(paid), total };
    }).filter(o => Math.abs(o.total) > 0.004).sort((a, b) => b.total - a.total);
  }

  // ---- बिक्री रजिस्टर + GST सारांश ----
  function sales(invoices, from, to) {
    const list = invoices.filter(i => live(i) && i.type !== 'EST' && inRange(i.date, from, to)).sort((a, b) => a.date.localeCompare(b.date) || (a.seq || 0) - (b.seq || 0));
    const sum = { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 };
    const byRate = {};
    list.forEach(i => {
      const t = i.totals;
      sum.taxable += t.taxable; sum.cgst += t.cgst; sum.sgst += t.sgst; sum.igst += t.igst; sum.total += t.total;
      Object.values(t.byRate).forEach(b => {
        const k = b.rate, x = byRate[k] || (byRate[k] = { rate: k, taxable: 0, cgst: 0, sgst: 0, igst: 0 });
        x.taxable += b.taxable; x.cgst += b.cgst; x.sgst += b.sgst; x.igst += b.igst;
      });
    });
    Object.keys(sum).forEach(k => sum[k] = r2(sum[k]));
    const rates = Object.values(byRate).map(b => ({ rate: b.rate, taxable: r2(b.taxable), cgst: r2(b.cgst), sgst: r2(b.sgst), igst: r2(b.igst) })).sort((a, b) => a.rate - b.rate);
    return { list, sum, rates };
  }

  // ---- GSTR-1 (GST offline tool जैसी sheets) ----
  const UQC = { NOS: 'NOS-NUMBERS', PCS: 'PCS-PIECES', KGS: 'KGS-KILOGRAMS', GMS: 'GMS-GRAMMES', MTR: 'MTR-METERS', CMS: 'CMS-CENTIMETERS',
    LTR: 'LTR-LITRES', MLT: 'MLT-MILILITRE', BOX: 'BOX-BOX', PAC: 'PAC-PACKS', SET: 'SET-SETS', PRS: 'PRS-PAIRS', DOZ: 'DOZ-DOZENS',
    ROL: 'ROL-ROLLS', BAG: 'BAG-BAGS', SQM: 'SQM-SQUARE METERS', SQF: 'SQF-SQUARE FEET', TON: 'TON-TONNES', QTL: 'QTL-QUINTAL', OTH: 'OTH-OTHERS', NA: 'NA' };
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const gdate = d => { const p = d.split('-'); return p[2] + '-' + MON[Number(p[1]) - 1] + '-' + p[0]; };
  const posTxt = c => c + '-' + GST.stateName(c);
  const B2CL_LIMIT = 100000;          // inter-state B2C बिल इससे ज़्यादा = B2CL (Aug 2024 से ₹1 लाख)

  function gstr1(biz, invoices, from, to) {
    const all = invoices.filter(i => i.type === 'TAX' && inRange(i.date, from, to));
    const tax = all.filter(live);
    const b2b = [['GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge',
      'Applicable % of Tax Rate', 'Invoice Type', 'E-Commerce GSTIN', 'Rate', 'Taxable Value', 'Cess Amount']];
    const b2cl = [['Invoice Number', 'Invoice date', 'Invoice Value', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN']];
    const b2csMap = {};
    const hsnB2B = {}, hsnB2C = {};
    tax.forEach(i => {
      const g = (i.party && i.party.gstin) || '';
      const isB2B = !!g;
      Object.values(i.totals.byRate).forEach(b => {
        if (isB2B) b2b.push([g, i.party.name || '', i.no, gdate(i.date), i.totals.total, posTxt(i.pos), 'N', '', 'Regular B2B', '', b.rate, b.taxable, 0]);
        else if (i.totals.inter && i.totals.total > B2CL_LIMIT) b2cl.push([i.no, gdate(i.date), i.totals.total, posTxt(i.pos), '', b.rate, b.taxable, 0, '']);
        else {
          const k = i.pos + '|' + b.rate, x = b2csMap[k] || (b2csMap[k] = { pos: i.pos, rate: b.rate, taxable: 0 });
          x.taxable += b.taxable;
        }
      });
      i.lines.forEach((l, j) => {
        const c = i.totals.lines[j]; if (!c) return;
        const map = isB2B ? hsnB2B : hsnB2C;
        const unit = String(l.hsn || '').startsWith('99') ? 'NA' : (l.unit || 'OTH');      // SAC (service) = NA
        const k = (l.hsn || '') + '|' + unit + '|' + c.gst, x = map[k] || (map[k] = { hsn: l.hsn || '', desc: l.name, unit: unit, rate: c.gst, qty: 0, value: 0, taxable: 0, igst: 0, cgst: 0, sgst: 0 });
        x.qty += Number(l.qty) || 0; x.value += c.amount; x.taxable += c.taxable; x.igst += c.igst; x.cgst += c.cgst; x.sgst += c.sgst;
      });
    });
    const b2cs = [['Type', 'Place Of Supply', 'Applicable % of Tax Rate', 'Rate', 'Taxable Value', 'Cess Amount', 'E-Commerce GSTIN']]
      .concat(Object.values(b2csMap).map(x => ['OE', posTxt(x.pos), '', x.rate, r2(x.taxable), 0, '']));
    const hsnHead = ['HSN', 'Description', 'UQC', 'Total Quantity', 'Total Value', 'Rate', 'Taxable Value', 'Integrated Tax Amount', 'Central Tax Amount', 'State/UT Tax Amount', 'Cess Amount'];
    const hsnRows = m => [hsnHead].concat(Object.values(m).map(x => [x.hsn, x.desc, UQC[x.unit] || 'OTH-OTHERS', r2(x.qty), r2(x.value), x.rate, r2(x.taxable), r2(x.igst), r2(x.cgst), r2(x.sgst), 0]));
    const nums = all.map(i => i.no).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    const docs = [['Nature of Document', 'Sr. No. From', 'Sr. No. To', 'Total Number', 'Cancelled']];
    if (nums.length) docs.push(['Invoices for outward supply', nums[0], nums[nums.length - 1], all.length, all.length - tax.length]);
    const s = sales(invoices.filter(i => i.type === 'TAX'), from, to);
    const summary = [['GSTR-1 data', biz.name || ''], ['GSTIN', biz.gstin || ''], ['Period', from + ' to ' + to], [],
      ['Rate %', 'Taxable', 'IGST', 'CGST', 'SGST', 'Total Tax']]
      .concat(s.rates.map(b => [b.rate, b.taxable, b.igst, b.cgst, b.sgst, r2(b.igst + b.cgst + b.sgst)]))
      .concat([['Total', s.sum.taxable, s.sum.igst, s.sum.cgst, s.sum.sgst, r2(s.sum.igst + s.sum.cgst + s.sum.sgst)], [],
        ['Bill of Supply / exempt बिक्री और credit note इस file में नहीं हैं — CA से अलग से जोड़वाएँ.']]);
    return [
      { name: 'summary', rows: summary }, { name: 'b2b', rows: b2b }, { name: 'b2cl', rows: b2cl }, { name: 'b2cs', rows: b2cs },
      { name: 'hsn(b2b)', rows: hsnRows(hsnB2B) }, { name: 'hsn(b2c)', rows: hsnRows(hsnB2C) }, { name: 'docs', rows: docs }
    ];
  }

  function salesSheet(list) {
    return [['Date', 'Bill No', 'Type', 'Party', 'GSTIN', 'POS', 'Taxable', 'CGST', 'SGST', 'IGST', 'Round off', 'Total']]
      .concat(list.map(i => [i.date, i.no, i.type, (i.party && i.party.name) || 'Cash', (i.party && i.party.gstin) || '', i.pos,
        i.totals.taxable, i.totals.cgst, i.totals.sgst, i.totals.igst, i.totals.roundOff, i.totals.total]));
  }

  root.REP = { ledger, outstanding, sales, gstr1, salesSheet, today, daysBetween };
})(window);
