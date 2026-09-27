/* A picture's two fingerprints, for artsnap and terrainsnap.

   The exact one (a hash of the PNG) says whether a single pixel moved: what a
   refactor on the machine the baseline was taken on must not do. But another
   machine's Chromium can take a different vector path through the same drawing
   and land the edges of a shape a level or two apart, which changes the hash of
   nearly every picture while changing nothing anyone could see. So each picture
   also keeps a grid: the average colour of every CELL x CELL square, stored
   deflated. Edge noise all but vanishes in an average; a part recoloured,
   moved, grown or lost does not.

   A picture passes when its hash matches, or (unless --exact) when no cell of
   its grid has moved more than TOL levels in any channel. */
const zlib = require('zlib');
const crypto = require('crypto');

const CELL = 12;
const TOL = 3;

/* Run in the page: the canvas's pixels, averaged over the grid, as a byte array
   (r, g, b, a per cell, row by row, with the width and height in front). */
function gridIn(canvas, cell) {
  const w = canvas.width, h = canvas.height;
  const d = canvas.getContext('2d').getImageData(0, 0, w, h).data;
  const gw = Math.ceil(w / cell), gh = Math.ceil(h / cell);
  const sum = new Float64Array(gw * gh * 4), n = new Uint32Array(gw * gh);
  for (let y = 0; y < h; y++) {
    const gy = (y / cell) | 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, c = gy * gw + ((x / cell) | 0), a = d[i + 3];
      // premultiplied, so a transparent pixel's leftover colour counts for nothing
      sum[c * 4] += d[i] * a / 255; sum[c * 4 + 1] += d[i + 1] * a / 255;
      sum[c * 4 + 2] += d[i + 2] * a / 255; sum[c * 4 + 3] += a;
      n[c]++;
    }
  }
  const out = [gw & 255, gw >> 8, gh & 255, gh >> 8];
  for (let c = 0; c < gw * gh; c++) for (let k = 0; k < 4; k++) out.push(Math.round(sum[c * 4 + k] / n[c]));
  return out;
}

/* The fingerprints of one picture: from its data URL and its grid bytes. */
function print(url, grid) {
  return {
    h: crypto.createHash('sha1').update(url).digest('hex').slice(0, 16),
    g: zlib.deflateRawSync(Buffer.from(grid), { level: 9 }).toString('base64')
  };
}

/* How far apart two grids are: the largest move of any cell in any channel
   (Infinity if they are not the same size). */
function apart(g1, g2) {
  const a = zlib.inflateRawSync(Buffer.from(g1, 'base64')), b = zlib.inflateRawSync(Buffer.from(g2, 'base64'));
  if (a.length !== b.length || a[0] !== b[0] || a[1] !== b[1] || a[2] !== b[2] || a[3] !== b[3]) return Infinity;
  let worst = 0;
  for (let i = 4; i < a.length; i++) { const dv = Math.abs(a[i] - b[i]); if (dv > worst) worst = dv; }
  return worst;
}

/* Sort each picture against the baseline: the same pixel for pixel, the same
   within tolerance (only when not exact), or changed, with how far each moved.
   A baseline entry that is a bare hash, from before the grids, can only match
   exactly. */
function judge(want, got, exact) {
  const out = { same: [], near: [], changed: [], added: [], gone: [], worst: 0, by: {} };
  Object.keys(got).forEach((k) => {
    const w = want[k], g = got[k];
    if (w == null) return out.added.push(k);
    const wh = typeof w === 'string' ? w : w.h;
    if (wh === g.h) return out.same.push(k);
    const d = typeof w === 'string' ? Infinity : apart(w.g, g.g);
    out.by[k] = d;
    if (d !== Infinity && d > out.worst) out.worst = d;
    (!exact && d <= TOL ? out.near : out.changed).push(k);
  });
  Object.keys(want).forEach((k) => { if (!(k in got)) out.gone.push(k); });
  return out;
}

function stored(got) {
  const o = {};
  Object.keys(got).sort().forEach((k) => { o[k] = { h: got[k].h, g: got[k].g }; });
  return o;
}

module.exports = { CELL, TOL, gridIn, print, apart, judge, stored };
