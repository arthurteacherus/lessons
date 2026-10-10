// MD5 для версии на планшете (в браузере нет встроенного md5, а Яндекс.Диск сообщает именно md5 файла).
// Принимает Uint8Array, возвращает hex-строку.
function lcMd5Hex(bytes) {
  const add = (x, y) => (x + y) | 0;
  const S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const K = [];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) | 0;
  const len = bytes.length;
  const nBlocks = ((len + 8) >> 6) + 1;
  const total = nBlocks * 64;
  const buf = new Uint8Array(total);
  buf.set(bytes);
  buf[len] = 0x80;
  const dv = new DataView(buf.buffer);
  dv.setUint32(total - 8, (len << 3) >>> 0, true);
  dv.setUint32(total - 4, Math.floor(len / 536870912), true);
  let a0 = 0x67452301, b0 = 0xefcdab89 | 0, c0 = 0x98badcfe | 0, d0 = 0x10325476;
  const M = new Int32Array(16);
  for (let blk = 0; blk < nBlocks; blk++) {
    for (let i = 0; i < 16; i++) M[i] = dv.getInt32(blk * 64 + i * 4, true);
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = add(add(add(F, A), K[i]), M[g]);
      A = D; D = C; C = B;
      const s = S[(i >> 4) * 4 + (i & 3)];
      B = add(B, (F << s) | (F >>> (32 - s)));
    }
    a0 = add(a0, A); b0 = add(b0, B); c0 = add(c0, C); d0 = add(d0, D);
  }
  return [a0, b0, c0, d0].map((v) => [0, 8, 16, 24].map((sh) => ((v >>> sh) & 255).toString(16).padStart(2, "0")).join("")).join("");
}
if (typeof module !== "undefined") module.exports = { lcMd5Hex };
