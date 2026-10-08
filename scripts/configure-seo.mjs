import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { root as defaultRoot } from './preview.mjs';

export async function configureSEO(root, siteArgument) {
const configFile = resolve(root, 'seo.config.json');
const config = JSON.parse(await readFile(configFile, 'utf8'));
const siteArg = siteArgument;
if (!siteArg && !config.siteUrl) throw new Error('Defina o domínio oficial: npm run seo:configure -- --site=https://seu-dominio.com.br');
const site = new URL(siteArg || config.siteUrl);
if (site.protocol !== 'https:' || site.username || site.password || site.search || site.hash || site.pathname !== '/') {
  throw new Error('Use a origem HTTPS do site, sem caminho, parâmetros ou credenciais.');
}
config.siteUrl = site.origin;
const absolute = path => new URL(path, site.origin).href;
const escape = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const orgId = absolute('/#studio');
const websiteId = absolute('/#website');
const services = [
  { slug: 'estrategia-de-marca', name: 'Estratégia de marca', description: 'Pesquisa e diagnóstico, posicionamento, proposta de valor, missão, visão, valores e personalidade da marca.' },
  { slug: 'identidade-verbal', name: 'Identidade verbal', description: 'Naming, manifesto, voz, tom de voz, slogan e frases para a comunicação da marca.' },
  { slug: 'identidade-visual', name: 'Identidade visual', description: 'Logotipo, paleta de cores, tipografia, ilustrações, patterns, fotografia, brandbook e aplicações.' }
];

for (const page of config.pages) {
  const url = absolute(page.path);
  const pageId = url + '#webpage';
  const graph = [
    { '@type': 'Organization', '@id': orgId, name: config.name, url: absolute('/'), description: config.description,
      logo: { '@type': 'ImageObject', url: absolute('/assets/favicon.png'), width: 512, height: 512 },
      image: absolute('/assets/social/samuel-cipriano-studio.jpg'), email: 'contatosamuelcipriano@gmail.com', telephone: '+5512991550799',
      areaServed: { '@type': 'Place', name: 'Vale do Paraíba, São Paulo, Brasil' },
      sameAs: ['https://instagram.com/samuelciprianostudio', 'https://www.behance.net/samuelciprianostudio', 'https://www.linkedin.com/in/samuel-cipriano-a166a5240'] },
    { '@type': 'WebSite', '@id': websiteId, name: config.name, url: absolute('/'), inLanguage: 'pt-BR', publisher: { '@id': orgId } },
    { '@type': 'WebPage', '@id': pageId, url, name: page.title, description: page.description, inLanguage: 'pt-BR', isPartOf: { '@id': websiteId }, about: { '@id': orgId },
      primaryImageOfPage: { '@type': 'ImageObject', url: absolute(page.image), width: 1200, height: 630, caption: page.imageAlt },
      ...(page.name ? { breadcrumb: { '@id': url + '#breadcrumb' }, mainEntity: { '@id': url + '#project' } } : { mainEntity: { '@id': orgId } }) }
  ];
  if (!page.name) {
    graph.push(...services.map(service => ({ '@type': 'Service', '@id': absolute('/#' + service.slug), name: service.name, serviceType: service.name,
      description: service.description, provider: { '@id': orgId }, url: absolute('/#servicos') })));
    graph[0].hasOfferCatalog = { '@type': 'OfferCatalog', name: 'Serviços de branding', itemListElement: services.map(service => ({ '@type': 'Offer', itemOffered: { '@id': absolute('/#' + service.slug) } })) };
  } else {
    graph.push(
      { '@type': 'BreadcrumbList', '@id': url + '#breadcrumb', itemListElement: [
        { '@type': 'ListItem', position: 1, name: config.name, item: absolute('/') },
        { '@type': 'ListItem', position: 2, name: page.name, item: url }
      ] },
      { '@type': 'CreativeWork', '@id': url + '#project', name: page.name, description: page.description, url, image: absolute(page.image), creator: { '@id': orgId }, inLanguage: 'pt-BR', about: page.service }
    );
  }
  const metadata = [
    '<!-- SEO: gerado por scripts/configure-seo.mjs -->',
    `<link rel="canonical" href="${escape(url)}">`,
    '<meta property="og:type" content="website">',
    `<meta property="og:site_name" content="${escape(config.name)}">`,
    '<meta property="og:locale" content="pt_BR">',
    `<meta property="og:url" content="${escape(url)}">`,
    `<meta property="og:title" content="${escape(page.title)}">`,
    `<meta property="og:description" content="${escape(page.description)}">`,
    `<meta property="og:image" content="${escape(absolute(page.image))}">`,
    `<meta property="og:image:secure_url" content="${escape(absolute(page.image))}">`,
    '<meta property="og:image:type" content="image/jpeg">',
    '<meta property="og:image:width" content="1200">',
    '<meta property="og:image:height" content="630">',
    `<meta property="og:image:alt" content="${escape(page.imageAlt)}">`,
    '<meta name="twitter:card" content="summary_large_image">',
    `<meta name="twitter:title" content="${escape(page.title)}">`,
    `<meta name="twitter:description" content="${escape(page.description)}">`,
    `<meta name="twitter:image" content="${escape(absolute(page.image))}">`,
    `<meta name="twitter:image:alt" content="${escape(page.imageAlt)}">`,
    '<script type="application/ld+json">',
    JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replaceAll('<', '\\u003c'),
    '</script>',
    '<!-- /SEO -->'
  ].join('\n');
  const file = resolve(root, page.file);
  let html = await readFile(file, 'utf8');
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, `<meta name="description" content="${escape(page.description)}">`)
    .replace(/\n?<!-- SEO: gerado[\s\S]*?<!-- \/SEO -->\n?/, '\n');
  html = html.replace('</head>', metadata + '\n</head>');
  await writeFile(file, html);
}

const sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  config.pages.map(page => `  <url><loc>${escape(absolute(page.path))}</loc></url>`).join('\n') + '\n</urlset>\n';
await writeFile(resolve(root, 'sitemap.xml'), sitemap);
await writeFile(resolve(root, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /scripts/\nDisallow: /tests/\nDisallow: /node_modules/\nDisallow: /uploads/\n\nSitemap: ${absolute('/sitemap.xml')}\n`);
await writeFile(configFile, JSON.stringify(config, null, 2) + '\n');
console.log(`SEO configurado para ${site.origin}: ${config.pages.length} páginas, sitemap e robots.txt.`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await configureSEO(defaultRoot, process.argv.find(arg => arg.startsWith('--site='))?.slice(7));
}
