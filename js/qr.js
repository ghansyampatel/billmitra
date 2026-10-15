/* BillMitra — UPI QR code (offline, बिना library). Byte mode, ECC level M, version 1–15.
   QR.svg('upi://pay?pa=...', 4) → SVG string */
(function (root) {
  'use strict';
  const ECC_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24];
  const BLK_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10];
  const FORMAT_M = 0;

  function rawModules(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const dataCodewords = v => Math.floor(rawModules(v) / 8) - ECC_M[v] * BLK_M[v];
  function gmul(x, y) { let z = 0; for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; } return z & 0xFF; }
  function rsDivisor(deg) {
    const r = new Array(deg).fill(0); r[deg - 1] = 1; let root = 1;
    for (let i = 0; i < deg; i++) {
      for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
      root = gmul(root, 2);
    }
    return r;
  }
  function rsRem(data, div) {
    const r = new Array(div.length).fill(0);
    data.forEach(b => { const f = b ^ r.shift(); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); });
    return r;
  }
  function alignPos(v) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2, size = v * 4 + 17;
    const step = Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
    const r = [6];
    for (let p = size - 7; r.length < n; p -= step) r.splice(1, 0, p);
    return r;
  }

  function encode(text) {
    const bytes = Array.from(new TextEncoder().encode(text));
    let v = 1;
    for (; v <= 15; v++) {
      const cc = v < 10 ? 8 : 16;
      if (4 + cc + bytes.length * 8 <= dataCodewords(v) * 8) break;
    }
    if (v > 15) throw new Error('QR: text बहुत लंबा');
    const cap = dataCodewords(v) * 8, cc = v < 10 ? 8 : 16;
    const bits = [];
    const put = (val, n) => { for (let i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
    put(4, 4); put(bytes.length, cc); bytes.forEach(b => put(b, 8));
    put(0, Math.min(4, cap - bits.length));
    put(0, (8 - bits.length % 8) % 8);
    for (let p = 0xEC; bits.length < cap; p ^= 0xEC ^ 0x11) put(p, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }

    // blocks + ECC + interleave
    const nb = BLK_M[v], el = ECC_M[v], raw = Math.floor(rawModules(v) / 8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const div = rsDivisor(el), blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - el + (i < nShort ? 0 : 1)); k += dat.length;
      const ecc = rsRem(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const cw = [];
    for (let i = 0; i < blocks[0].length; i++)
      blocks.forEach((b, j) => { if (i !== shortLen - el || j >= nShort) cw.push(b[i]); });

    // matrix
    const size = v * 4 + 17;
    const M = Array.from({ length: size }, () => new Array(size).fill(false));
    const F = Array.from({ length: size }, () => new Array(size).fill(false));
    const set = (x, y, d) => { M[y][x] = d; F[y][x] = true; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    [[3, 3], [size - 4, 3], [3, size - 4]].forEach(([x, y]) => {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy)), xx = x + dx, yy = y + dy;
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) set(xx, yy, d !== 2 && d !== 4);
      }
    });
    const ap = alignPos(v), last = ap.length - 1;
    ap.forEach((a, i) => ap.forEach((b, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(a + dx, b + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    const drawFormat = mask => {
      const d = (FORMAT_M << 3) | mask; let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412, bit = i => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (v >= 7) {
      let r = v; for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1F25);
      const b = (v << 12) | r;
      for (let i = 0; i < 18; i++) { const d = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3); set(a, c, d); set(c, a, d); }
    }
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
        if (!F[y][x] && i < cw.length * 8) { M[y][x] = ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
      }
    }
    const MASKS = [
      (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
      (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
      (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0, (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0];
    const apply = m => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!F[y][x] && MASKS[m](x, y)) M[y][x] = !M[y][x]; };
    const penalty = () => {               // नियम 1, 2, 4 (काफ़ी)
      let p = 0, dark = 0;
      for (let y = 0; y < size; y++) {
        let rx = 1, ry = 1;
        for (let x = 0; x < size; x++) {
          if (M[y][x]) dark++;
          if (x > 0) { if (M[y][x] === M[y][x - 1]) { rx++; if (rx === 5) p += 3; else if (rx > 5) p++; } else rx = 1; }
          if (x > 0) { if (M[x][y] === M[x - 1][y]) { ry++; if (ry === 5) p += 3; else if (ry > 5) p++; } else ry = 1; }
          if (x > 0 && y > 0 && M[y][x] === M[y][x - 1] && M[y][x] === M[y - 1][x] && M[y][x] === M[y - 1][x - 1]) p += 3;
        }
      }
      return p + Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10;
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) { apply(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m; } apply(m); }
    apply(best); drawFormat(best);
    return M;
  }

  function svg(text, px) {
    const M = encode(text), n = M.length, q = 4, s = n + q * 2;
    let d = '';
    M.forEach((row, y) => row.forEach((on, x) => { if (on) d += 'M' + (x + q) + ' ' + (y + q) + 'h1v1h-1z'; }));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" width="' + (px || s * 3) + '" height="' + (px || s * 3) +
      '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  function upiLink(o) {
    const p = ['pa=' + encodeURIComponent(o.vpa), 'pn=' + encodeURIComponent(o.name || '')];
    if (o.amount) p.push('am=' + Number(o.amount).toFixed(2));
    p.push('cu=INR');
    if (o.note) p.push('tn=' + encodeURIComponent(o.note));
    return 'upi://pay?' + p.join('&');
  }
  root.QR = { encode, svg, upiLink };
})(typeof window !== 'undefined' ? window : globalThis);
