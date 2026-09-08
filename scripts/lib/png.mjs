/**
 * png.mjs — 極小的 PNG 解碼器，只為了讓守門**真的去看畫素**。
 *
 * 為什麼需要它：環境層（env wash）是好幾層半透明漸層疊出來的，
 * 「它到底多亮」不是任何一條 CSS 宣告回答得了的問題 —— 用 getComputedStyle
 * 去讀，讀到的是**宣告**（`color-mix(... 18% ...)`），不是**結果**。
 * 而這個 repo 已經為「斷言看的東西跟使用者看的東西不是同一個」付過很多次學費
 * （overflow:hidden 的容器、opacity:0 的分頁、backgroundImage 裡的顏色）。
 *
 * Playwright 的 screenshot 回傳 PNG buffer；這裡把它變成畫素，
 * 守門就能問「地面實際上是什麼顏色」而不是「CSS 說它應該是什麼顏色」。
 *
 * 只支援 Chromium screenshot 會產生的形狀：8-bit、colorType 2(RGB) / 6(RGBA)、
 * 無交錯。遇到別的形狀直接丟例外（**不猜** —— 猜出來的畫素比沒有畫素更糟）。
 */
import { inflateSync } from 'node:zlib';

/**
 * Decodes a PNG buffer into raw pixels.
 *
 * @param {Buffer} buf - PNG file bytes.
 * @returns {{width:number,height:number,at:(x:number,y:number)=>[number,number,number]}}
 */
export function decodePng(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error('not a PNG');
  let pos = 8;
  let width = 0, height = 0, depth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      depth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG unsupported');
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`);
  const ch = colorType === 6 ? 4 : colorType === 2 ? 3 : 0;
  if (!ch) throw new Error(`unsupported color type ${colorType}`);

  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * ch;
  const out = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const up = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0;
      const b = up ? up[i] : 0;
      const c = up && i >= ch ? up[i - ch] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      } else if (filter !== 0) throw new Error(`bad filter ${filter}`);
      cur[i] = v & 0xff;
    }
  }
  return {
    width, height,
    at(x, y) {
      const i = y * stride + x * ch;
      return [out[i], out[i + 1], out[i + 2]];
    },
  };
}
