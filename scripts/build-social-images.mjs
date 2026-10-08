import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { root, startPreview } from './preview.mjs';

const server = await startPreview(0);
let browser;
try {
  browser = await chromium.launch({ headless: true, ...(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {}) });
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await mkdir(resolve(root, 'assets/social'), { recursive: true });
  const base = `http://127.0.0.1:${server.address().port}`;
  const cards = [
    { file: 'samuel-cipriano-studio' },
    { file: 'entremeio', name: 'Entremeio', scope: 'Identidade visual para pousada · Projeto conceitual', photo: '/assets/projetos/entremeio/capa.webp' },
    { file: 'lets-dance', name: 'Espaço Let’s Dance', scope: 'Estratégia de marca e identidade visual', photo: '/assets/projetos/lets-dance/capa.webp' },
    { file: 'identidade-samuel-cipriano', name: 'A identidade do nosso estúdio', scope: 'Estratégia de marca · Identidade verbal · Identidade visual', photo: '/assets/projetos/samuel-cipriano-studio/lacres.webp' }
  ];
  for (const card of cards) {
    await page.goto(`${base}/scripts/templates/social-card.html`, { waitUntil: 'networkidle' });
    await page.evaluate(async cardData => {
      if (cardData.name) {
        document.querySelector('.card').classList.add('project');
        document.querySelector('.project-photo').src = cardData.photo;
        document.querySelector('.project-name').textContent = cardData.name;
        document.querySelector('.project-scope').textContent = cardData.scope;
      }
      await document.fonts.ready;
      await Promise.all([...document.images].filter(img => img.getAttribute('src')).map(img => img.decode()));
    }, card);
    const screenshot = await page.screenshot();
    const file = resolve(root, `assets/social/${card.file}.jpg`);
    await sharp(screenshot).jpeg({ quality: 92, mozjpeg: true }).toFile(file);
    console.log(`${card.file}.jpg: 1200 × 630`);
  }
  const emblem = await sharp(resolve(root, 'assets/isotipo-verde.svg')).resize(320, 320, { fit: 'inside' }).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: '#F2EBE7' } }).composite([{ input: emblem, gravity: 'centre' }]).png().toFile(resolve(root, 'assets/favicon.png'));
} finally {
  if (browser) await browser.close();
  await new Promise(done => server.close(done));
}
