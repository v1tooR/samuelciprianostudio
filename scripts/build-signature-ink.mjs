// Gera o "mapa de tinta" da assinatura: para cada pixel do desenho, o instante em que a
// caneta passa por ele. O site lê esse mapa num canvas e revela os pixels conforme a rolagem.
//
// Saída: assets/marca/assinatura-tinta.webp (sem perdas)
//   R,G = instante (16 bits, R alto · G baixo), 0 = primeiro traço, 65535 = último
//   B   = cobertura do traço (antialiasing), 0 = fora do desenho
//
// O caminho da caneta (TRACOS) foi traçado à mão sobre o SVG, em unidades do viewBox.
// Cada pixel recebe o instante do ponto do caminho mais próximo *dentro do traço*
// (distância geodésica), então a tinta nunca pula de um traço para outro vizinho.
//
// Uso: node scripts/build-signature-ink.mjs [--debug pasta]

import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(root, 'assets/marca/assinatura-preto.svg');
const OUT = path.join(root, 'assets/marca/assinatura-tinta.webp');
const VB_W = 1164.7;
const SCALE = 2; // px por unidade do viewBox → 2329 × 876
const PAUSA = 18; // "caneta no ar" entre traços, em unidades de comprimento

// Ordem de escrita: Samuel → C (do laço para a base) → ipriano → pingos → ponto final.
const TRACOS = [
  // S
  [[124,268],[140,251],[160,231],[178,210],[192,190],[200,177],[196,171],[184,174],[165,186],[140,206],[115,228],[90,252],[62,280],[35,310],[14,336],[5,355],[10,368],[25,370],[45,363],[70,352],[95,340],[108,332]],
  // cauda do S
  [[108,334],[95,352],[78,374],[60,395],[45,414],[34,430]],
  // amuel
  [[108,330],[135,322],[160,322],[185,315],[210,308],[235,312],[255,302],[280,293],[300,285],[320,280],[345,283],[372,270],[395,285],[420,268],[440,255],[452,268],[470,266],[485,250],[496,230],[506,218],[514,224],[508,240],[503,256],[518,266],[530,240],[540,215],[555,188],[578,150],[600,118],[622,98],[636,96],[640,108],[632,132],[605,168],[577,208],[550,246],[535,266]],
  // C: do laço, sobe, desce a diagonal longa e volta pela base
  [[662,164],[680,150],[700,132],[722,112],[742,90],[753,68],[755,48],[748,30],[735,17],[715,9],[695,7],[670,11],[640,24],[600,42],[550,68],[500,97],[450,128],[400,163],[350,205],[320,238],[303,262],[302,285],[315,302],[340,318],[365,332],[400,338],[460,334],[500,316],[550,290],[600,268],[622,254],[638,244]],
  // i + haste do p
  [[638,244],[646,238],[651,246],[647,260],[649,274],[645,292],[638,312],[628,332],[618,352]],
  // base do p
  [[652,280],[676,274],[700,270],[724,266],[750,260],[776,262]],
  // barriga do p → r → i → a → n → o
  [[662,262],[690,246],[712,234],[740,229],[765,228],[778,232],[786,222],[792,212],[798,226],[801,240],[818,240],[834,222],[844,208],[849,222],[858,236],[872,208],[892,192],[912,194],[918,212],[924,232],[942,222],[960,204],[974,192],[971,210],[970,222],[988,212],[1006,196],[1022,182],[1028,180],[1031,198],[1036,212],[1056,199],[1080,186],[1104,174],[1124,162],[1138,155]],
  // pingos dos is e ponto final
  [[698,188],[711,188]],
  [[860,160],[873,160]],
  [[1146,188],[1159,188]],
];

/* ------------------------------------------------------------ raster */
const { data: px, info } = await sharp(SRC, { density: 72 * SCALE })
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, N = W * H;
const k = W / VB_W;
const cov = new Uint8Array(N);
for (let i = 0; i < N; i++) cov[i] = px[i * 4 + 3];

/* ------------------------------------------------------------ caminho amostrado */
const seeds = []; // [x, y, comprimento acumulado]
let acc = 0;
TRACOS.forEach((tr, ti) => {
  if (ti > 0) acc += PAUSA;
  for (let j = 0; j < tr.length - 1; j++) {
    const [x0, y0] = tr[j], [x1, y1] = tr[j + 1];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(len * k));
    for (let s = 0; s < steps; s++) {
      const u = s / steps;
      seeds.push([(x0 + (x1 - x0) * u) * k, (y0 + (y1 - y0) * u) * k, acc + len * u]);
    }
    acc += len;
  }
  const [xl, yl] = tr[tr.length - 1];
  seeds.push([xl * k, yl * k, acc]);
});
const TOTAL = acc;

/* ------------------------------------------------------------ geodésico (Dijkstra em grade) */
// Pixel do traço = cobertura > 0. Cada semente dentro do traço espalha o seu instante;
// vence quem chega primeiro (menor distância percorrida dentro da tinta).
const INF = 0x7fffffff;
const dist = new Int32Array(N).fill(INF);
const time = new Float32Array(N).fill(-1);
// fila por baldes (custos inteiros: 10 ortogonal, 14 diagonal)
const buckets = new Map();
let minB = 0;
const push = (d, i) => { let b = buckets.get(d); if (!b) buckets.set(d, (b = [])); b.push(i); };

for (const [sx, sy, len] of seeds) {
  const x = Math.round(sx), y = Math.round(sy);
  if (x < 0 || y < 0 || x >= W || y >= H) continue;
  const i = y * W + x;
  if (cov[i] < 128) continue;
  // empate na mesma semente: fica o instante mais cedo (o primeiro traço que passou)
  if (dist[i] === 0 && time[i] <= len) continue;
  dist[i] = 0; time[i] = len; push(0, i);
}
const NB = [[1,0,10],[-1,0,10],[0,1,10],[0,-1,10],[1,1,14],[1,-1,14],[-1,1,14],[-1,-1,14]];
let maxD = 0;
for (const d of buckets.keys()) maxD = Math.max(maxD, d);
for (let d = 0; d <= maxD; d++) {
  const b = buckets.get(d);
  if (!b) continue;
  for (let q = 0; q < b.length; q++) {
    const i = b[q];
    if (dist[i] !== d) continue;
    const x = i % W, y = (i / W) | 0;
    for (const [dx, dy, c] of NB) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (!cov[n]) continue;
      const nd = d + c;
      if (nd < dist[n] || (nd === dist[n] && time[i] < time[n])) {
        dist[n] = nd; time[n] = time[i]; push(nd, n);
        if (nd > maxD) maxD = nd;
      }
    }
  }
  buckets.delete(d);
}

// pixels de tinta que nenhuma semente alcançou (ilhas): instante do ponto mais próximo
let orphans = 0;
for (let i = 0; i < N; i++) {
  if (!cov[i] || time[i] >= 0) continue;
  orphans++;
  const x = i % W, y = (i / W) | 0;
  let best = Infinity, t = TOTAL;
  for (const [sx, sy, len] of seeds) { const dd = (sx - x) ** 2 + (sy - y) ** 2; if (dd < best) { best = dd; t = len; } }
  time[i] = t;
}

/* ------------------------------------------------------------ saída */
const out = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) {
  if (!cov[i]) continue;
  const t16 = Math.round((time[i] / TOTAL) * 65535);
  out[i * 3] = t16 >> 8; out[i * 3 + 1] = t16 & 255; out[i * 3 + 2] = cov[i];
}
await sharp(out, { raw: { width: W, height: H, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(OUT);
console.log(`ok: ${W}×${H}, ${seeds.length} sementes, ${orphans} órfãos → ${path.relative(root, OUT)}`);

/* ------------------------------------------------------------ depuração */
const dbgIdx = process.argv.indexOf('--debug');
if (dbgIdx > 0) {
  const dir = process.argv[dbgIdx + 1];
  const hue = Buffer.alloc(N * 3, 255);
  for (let i = 0; i < N; i++) {
    if (!cov[i]) continue;
    const t = time[i] / TOTAL, h = t * 300, c = 1, xx = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const [r, g, b] = h < 60 ? [c, xx, 0] : h < 120 ? [xx, c, 0] : h < 180 ? [0, c, xx] : h < 240 ? [0, xx, c] : [xx, 0, c];
    const a = cov[i] / 255;
    hue[i * 3] = 255 - a * (255 - r * 230); hue[i * 3 + 1] = 255 - a * (255 - g * 230); hue[i * 3 + 2] = 255 - a * (255 - b * 230);
  }
  await sharp(hue, { raw: { width: W, height: H, channels: 3 } }).png().toFile(path.join(dir, 'ink-hue.png'));
  for (const p of [0.15, 0.3, 0.45, 0.6, 0.75, 0.9]) {
    const f = Buffer.alloc(N * 3, 255);
    for (let i = 0; i < N; i++) if (cov[i] && time[i] / TOTAL <= p) { const v = 255 - cov[i]; f[i * 3] = f[i * 3 + 1] = f[i * 3 + 2] = v; }
    await sharp(f, { raw: { width: W, height: H, channels: 3 } }).resize(900).png().toFile(path.join(dir, `ink-${Math.round(p * 100)}.png`));
  }
  console.log('depuração em', dir);
}
