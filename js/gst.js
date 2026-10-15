/* BillMitra — GST helpers (no DOM). Works in browser and Node (for tests). */
(function (root) {
  'use strict';

  // GST state codes (GSTIN पहले 2 अंक)
  const STATES = [
    ['01', 'Jammu & Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'],
    ['05', 'Uttarakhand'], ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'],
    ['10', 'Bihar'], ['11', 'Sikkim'], ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'],
    ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'], ['18', 'Assam'], ['19', 'West Bengal'],
    ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'], ['24', 'Gujarat'],
    ['26', 'Dadra & Nagar Haveli and Daman & Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
    ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'],
    ['35', 'Andaman & Nicobar Islands'], ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
    ['97', 'Other Territory']
  ];
  const stateName = code => (STATES.find(s => s[0] === String(code)) || [, ''])[1];

  const GST_RATES = [0, 0.25, 3, 5, 12, 18, 28, 40];
  const UNITS = ['NOS', 'PCS', 'KGS', 'GMS', 'MTR', 'CMS', 'LTR', 'MLT', 'BOX', 'PAC', 'SET', 'PRS', 'DOZ', 'ROL', 'BAG', 'SQM', 'SQF', 'TON', 'QTL', 'OTH'];

  const r2 = n => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

  // ---- GSTIN check (format + checksum) ----
  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
  function gstinValid(g) {
    g = String(g || '').trim().toUpperCase();
    if (!GSTIN_RE.test(g)) return false;
    const cs = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      const v = cs.indexOf(g[i]) * (i % 2 ? 2 : 1);
      sum += Math.floor(v / 36) + (v % 36);
    }
    return cs[(36 - (sum % 36)) % 36] === g[14];
  }
  const gstinState = g => (String(g || '').length >= 2 ? String(g).slice(0, 2) : '');

  // ---- Financial year: Apr–Mar → "26-27" ----
  function fyOf(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const y = d.getFullYear(), m = d.getMonth() + 1;
    const start = m >= 4 ? y : y - 1;
    return String(start % 100).padStart(2, '0') + '-' + String((start + 1) % 100).padStart(2, '0');
  }

  /**
   * Invoice calculation.
   * inv = { type: 'TAX'|'BOS'|'EST', sellerState, posState, inclusive, lines:[{qty, rate, disc, gst}], roundOff:true }
   * returns { lines:[{taxable, gst, cgst, sgst, igst, amount}], taxable, cgst, sgst, igst, tax, roundOff, total, inter, byRate }
   */
  function calc(inv) {
    const noTax = inv.type === 'BOS';
    const inter = !noTax && String(inv.posState || inv.sellerState) !== String(inv.sellerState);
    const out = { lines: [], taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0, roundOff: 0, total: 0, inter, byRate: {} };
    (inv.lines || []).forEach(l => {
      const qty = Number(l.qty) || 0, rate = Number(l.rate) || 0, disc = Number(l.disc) || 0;
      const g = noTax ? 0 : (Number(l.gst) || 0);
      let gross = qty * rate * (1 - disc / 100);
      let taxable = inv.inclusive ? gross / (1 + g / 100) : gross;
      taxable = r2(taxable);
      const tax = inv.inclusive ? r2(gross - taxable) : r2(taxable * g / 100);
      let cgst = 0, sgst = 0, igst = 0;
      if (inter) igst = tax;
      else { cgst = r2(tax / 2); sgst = r2(tax - cgst); }
      const L = { taxable, gst: g, cgst, sgst, igst, tax, amount: r2(taxable + tax) };
      out.lines.push(L);
      out.taxable += taxable; out.cgst += cgst; out.sgst += sgst; out.igst += igst;
      const k = String(g);
      const b = out.byRate[k] || (out.byRate[k] = { rate: g, taxable: 0, cgst: 0, sgst: 0, igst: 0 });
      b.taxable += taxable; b.cgst += cgst; b.sgst += sgst; b.igst += igst;
    });
    out.taxable = r2(out.taxable); out.cgst = r2(out.cgst); out.sgst = r2(out.sgst); out.igst = r2(out.igst);
    out.tax = r2(out.cgst + out.sgst + out.igst);
    const exact = r2(out.taxable + out.tax);
    out.total = inv.roundOff === false ? exact : Math.round(exact);
    out.roundOff = r2(out.total - exact);
    Object.values(out.byRate).forEach(b => { b.taxable = r2(b.taxable); b.cgst = r2(b.cgst); b.sgst = r2(b.sgst); b.igst = r2(b.igst); });
    return out;
  }

  // ---- Amount in words (Indian system) ----
  const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
    'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
  function three(n) { return (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : ''); }
  function intWords(n) {
    if (n === 0) return 'Zero';
    const parts = [];
    const cr = Math.floor(n / 10000000); n %= 10000000;
    const lk = Math.floor(n / 100000); n %= 100000;
    const th = Math.floor(n / 1000); n %= 1000;
    if (cr) parts.push(intWords(cr) + ' Crore');
    if (lk) parts.push(two(lk) + ' Lakh');
    if (th) parts.push(two(th) + ' Thousand');
    if (n) parts.push(three(n));
    return parts.join(' ');
  }
  function amountWords(amt) {
    amt = r2(Math.abs(Number(amt) || 0));
    const rs = Math.floor(amt), ps = Math.round((amt - rs) * 100);
    return 'Rupees ' + intWords(rs) + (ps ? ' and ' + two(ps) + ' Paise' : '') + ' Only';
  }

  const inr = n => (Number(n) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const api = { STATES, stateName, GST_RATES, UNITS, r2, gstinValid, gstinState, fyOf, calc, amountWords, inr };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GST = api;
})(typeof window !== 'undefined' ? window : globalThis);
