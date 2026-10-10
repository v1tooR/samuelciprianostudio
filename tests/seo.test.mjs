import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { root } from '../scripts/preview.mjs';
import { configureSEO } from '../scripts/configure-seo.mjs';

const config = JSON.parse(await readFile(resolve(root, 'seo.config.json'), 'utf8'));

test('Todas as páginas têm conteúdo estático, metadados únicos e imagens acessíveis', async () => {
  const titles = new Set();
  const descriptions = new Set();
  for (const page of config.pages) {
    const html = await readFile(resolve(root, page.file), 'utf8');
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1];
    assert.ok(head, page.file);
    assert.match(html, /<html lang="pt-BR">/);
    assert.equal((head.match(/<title>/g) || []).length, 1);
    assert.equal((head.match(/<meta name="description"/g) || []).length, 1);
    assert.match(head, /max-image-preview:large/);
    assert.equal((html.match(/<h1\b/g) || []).length, 1);
    assert.equal((html.match(/<main\b/g) || []).length, 1);
    assert.doesNotMatch(html, /<helmet>|<x-dc>|text\/x-dc|\{\{\s/);
    titles.add(head.match(/<title>(.*?)<\/title>/)[1]);
    descriptions.add(head.match(/<meta name="description" content="([^"]+)"/)[1]);
    for (const tag of html.matchAll(/<img\b[^>]*>/g)) {
      assert.match(tag[0], /\balt="/);
      assert.match(tag[0], /\bwidth="\d+"/);
      assert.match(tag[0], /\bheight="\d+"/);
      const src = tag[0].match(/\bsrc="([^"]+)"/)?.[1];
      if (src && !src.startsWith('http')) await readFile(resolve(root, dirname(page.file), src));
    }
    for (const link of html.matchAll(/\bhref="([^"]+)"/g)) {
      if (/^(https?:|mailto:|tel:|data:)/.test(link[1])) continue;
      const [path, anchor] = link[1].split('#');
      const target = path ? resolve(root, dirname(page.file), path, path.endsWith('/') ? 'index.html' : '') : resolve(root, page.file);
      const content = await readFile(target, 'utf8');
      if (anchor) assert.ok(content.includes(`id="${anchor}"`), `${page.file}: ${link[1]}`);
    }
    const image = resolve(root, '.' + page.image);
    const metadata = await sharp(image).metadata();
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 630);
    assert.equal(metadata.format, 'jpeg');
    assert.ok((await readFile(image)).byteLength < 350000, `${page.image}: manter capa leve`);
  }
  assert.equal(titles.size, config.pages.length);
  assert.equal(descriptions.size, config.pages.length);
});

test('O domínio gera canônicos, capas absolutas, dados estruturados e sitemap coerentes', async () => {
  const fixture = await mkdtemp(resolve(tmpdir(), 'samuel-seo-'));
  try {
    await writeFile(resolve(fixture, 'seo.config.json'), JSON.stringify({ ...config, siteUrl: null }));
    for (const page of config.pages) {
      await mkdir(dirname(resolve(fixture, page.file)), { recursive: true });
      await writeFile(resolve(fixture, page.file), await readFile(resolve(root, page.file)));
    }
    await assert.rejects(configureSEO(fixture), /domínio oficial/);
    await assert.rejects(configureSEO(fixture, 'http://example.com'), /HTTPS/);
    await assert.rejects(configureSEO(fixture, 'https://example.com/subdirectory'), /sem caminho/);
    await configureSEO(fixture, 'https://example.com');
    const first = await Promise.all(config.pages.map(page => readFile(resolve(fixture, page.file), 'utf8')));
    await configureSEO(fixture);
    const second = await Promise.all(config.pages.map(page => readFile(resolve(fixture, page.file), 'utf8')));
    assert.deepEqual(second, first, 'Reexecutar não duplica nem altera metadados');
    for (const [index, page] of config.pages.entries()) {
      const head = second[index].match(/<head>([\s\S]*?)<\/head>/)[1];
      assert.equal((head.match(/rel="canonical"/g) || []).length, 1);
      assert.ok(head.includes(`rel="canonical" href="https://example.com${page.path}"`));
      assert.ok(head.includes(`property="og:image" content="https://example.com${page.image}"`));
      assert.match(head, /name="twitter:card" content="summary_large_image"/);
      const data = JSON.parse(head.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
      assert.equal(data['@context'], 'https://schema.org');
      assert.ok(data['@graph'].some(node => node['@type'] === 'Organization'));
      assert.ok(data['@graph'].some(node => node['@type'] === 'WebSite'));
      assert.ok(data['@graph'].some(node => node['@type'] === 'WebPage' && node.url === 'https://example.com' + page.path));
      if (page.name) assert.ok(data['@graph'].some(node => node['@type'] === 'BreadcrumbList'));
      else assert.equal(data['@graph'].filter(node => node['@type'] === 'Service').length, 3);
    }
    const sitemap = await readFile(resolve(fixture, 'sitemap.xml'), 'utf8');
    assert.equal((sitemap.match(/<loc>/g) || []).length, config.pages.length);
    for (const page of config.pages) assert.ok(sitemap.includes(`<loc>https://example.com${page.path}</loc>`));
    assert.match(await readFile(resolve(fixture, 'robots.txt'), 'utf8'), /Sitemap: https:\/\/example.com\/sitemap.xml/);
  } finally { await rm(fixture, { recursive: true, force: true }); }
});
