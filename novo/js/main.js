// Ponto de entrada único. Camadas, de baixo para cima:
// 1) HTML/CSS mostram tudo (estado final); 2) IO revela blocos; 3) a assinatura se escreve
// por canvas (capa ao abrir, rodapé com a rolagem), sem depender de biblioteca; 4) GSAP, se
// carregou, sobe textos por máscara, faz parallax e o trilho dos depoimentos; 5) Lenis só com
// ponteiro fino e movimento livre. Sem GSAP/Lenis o site continua completo e navegável.

const mq = (q) => window.matchMedia(q);
const reduce = () => mq('(prefers-reduced-motion: reduce)').matches;
const clamp01 = (v) => Math.min(Math.max(v, 0), 1);

/* ---------------------------------------------------------------- cabeçalho */
// Esconde ao descer e volta ao subir; troca de cor conforme a seção que passa por baixo
// (data-theme="dark" | "light" | "none"); a assinatura pequena só aparece depois da capa.
function Header(el) {
  const ac = new AbortController();
  const zones = [...document.querySelectorAll('[data-theme]')];
  const hero = document.querySelector('[data-hero]');
  let lastY = window.scrollY, queued = false;
  const update = () => {
    queued = false;
    const y = window.scrollY;
    const probe = el.offsetHeight / 2;
    let theme = 'light';
    for (const z of zones) {
      const r = z.getBoundingClientRect();
      if (r.top <= probe && r.bottom > probe) theme = z.dataset.theme; // o último que cobre vence (painéis empilhados)
    }
    el.classList.toggle('is-dark', theme === 'dark');
    // fundo só quando o cabeçalho volta no meio de uma seção (no topo dela, fica solto como nas telas)
    el.classList.toggle('is-solid', y > 8 && !zones.some((z) => { const t = z.getBoundingClientRect().top; return t > -probe * 2 && t <= probe; }));
    el.classList.toggle('is-off', theme === 'none' && !el.contains(document.activeElement));
    if (hero) el.classList.toggle('at-hero', hero.getBoundingClientRect().bottom > window.innerHeight * 0.4);
    const down = y > lastY + 4, up = y < lastY - 4;
    if (down && y > window.innerHeight * 0.6 && !el.contains(document.activeElement)) el.classList.add('is-hidden');
    else if (up || y < 80) el.classList.remove('is-hidden');
    lastY = y;
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true, signal: ac.signal });
  window.addEventListener('resize', onScroll, { passive: true, signal: ac.signal });
  el.addEventListener('focusin', () => el.classList.remove('is-hidden', 'is-off'), { signal: ac.signal });
  update();
  return { destroy: () => ac.abort() };
}

/* ---------------------------------------------------------------- reveal (IO + CSS) */
function Reveal(root = document) {
  const els = root.querySelectorAll('[data-reveal]');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return { destroy() {} }; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  els.forEach((el) => io.observe(el));
  return { destroy: () => io.disconnect() };
}

/* ---------------------------------------------------------------- assinatura escrita */
// O mapa de tinta (scripts/build-signature-ink.mjs) diz, para cada pixel do traço, em que
// instante a caneta passa por ele. Os pixels ficam ordenados por instante; a cada quadro só
// os que mudaram são escritos, e só o retângulo alterado sobe para o canvas.
const inkMaps = new Map();
function loadInkMap(url) {
  if (!inkMaps.has(url)) {
    inkMaps.set(url, (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error('mapa de tinta indisponível');
      const bmp = await createImageBitmap(await res.blob(), { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const w = bmp.width, h = bmp.height, total = w * h;
      const read = document.createElement('canvas');
      read.width = w; read.height = h;
      const rctx = read.getContext('2d', { willReadFrequently: true });
      rctx.drawImage(bmp, 0, 0);
      const src = rctx.getImageData(0, 0, w, h).data;
      bmp.close?.();
      // ordenação por contagem: 65 536 instantes possíveis
      const start = new Uint32Array(65537);
      let n = 0;
      for (let p = 0, i = 0; p < total; p++, i += 4) if (src[i + 2]) { start[((src[i] << 8) | src[i + 1]) + 1]++; n++; }
      for (let t = 1; t < 65537; t++) start[t] += start[t - 1];
      const order = new Uint32Array(n), times = new Uint16Array(n), cover = new Uint8Array(n);
      for (let p = 0, i = 0; p < total; p++, i += 4) {
        if (!src[i + 2]) continue;
        const t = (src[i] << 8) | src[i + 1], k = start[t]++;
        order[k] = p; times[k] = t; cover[k] = src[i + 2];
      }
      return { w, h, n, order, times, cover };
    })());
  }
  return inkMaps.get(url);
}

function inkCanvas({ w, h, n, order, times, cover }, [r, g, b]) {
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(w, h);
  const out = img.data;
  for (let i = 0; i < out.length; i += 4) { out[i] = r; out[i + 1] = g; out[i + 2] = b; }
  let shown = 0;
  const draw = (q) => {
    const limit = q * 65535;
    let lo = 0, hi = n;
    while (lo < hi) { const m = (lo + hi) >> 1; if (times[m] <= limit) lo = m + 1; else hi = m; }
    const target = q >= 1 ? n : lo;
    if (target === shown) return;
    const from = Math.min(shown, target), to = Math.max(shown, target), on = target > shown;
    let x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (let k = from; k < to; k++) {
      const p = order[k];
      out[p * 4 + 3] = on ? cover[k] : 0;
      const x = p % w, y = (p / w) | 0;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    shown = target;
    ctx.putImageData(img, 0, 0, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
  };
  return { canvas, draw };
}

// Capa: a assinatura se escreve sozinha ao abrir a página.
function HeroInk(holder, color) {
  const root = document.documentElement;
  if (reduce()) { root.classList.remove('ink-wait'); return null; }
  let raf = 0;
  loadInkMap(holder.dataset.heroInk).then((map) => {
    const ink = inkCanvas(map, color);
    holder.append(ink.canvas);
    holder.classList.add('is-live');
    // se o mapa demorou e a assinatura já apareceu pronta, não reescreve
    if (!root.classList.contains('ink-wait')) { ink.draw(1); return; }
    root.classList.remove('ink-wait');
    const DUR = 2600, DELAY = 250, t0 = performance.now();
    const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2) * 0.35 + t * 0.65; // quase constante, como a mão
    const step = (now) => {
      const t = clamp01((now - t0 - DELAY) / DUR);
      ink.draw(ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  }).catch(() => root.classList.remove('ink-wait'));
  return { destroy: () => cancelAnimationFrame(raf) };
}

// Rodapé: a assinatura se escreve conforme a rolagem chega ao fim da página.
function ScrollInk(section, color) {
  if (reduce()) return null; // movimento reduzido: assinatura completa (SVG)
  const holder = section.querySelector('[data-ink]');
  if (!holder) return null;
  const ac = new AbortController();
  let ink = null, queued = false;
  const progress = () => {
    const r = section.getBoundingClientRect();
    const range = Math.min(r.height, document.documentElement.scrollHeight - window.innerHeight) || 1;
    const entered = clamp01((window.innerHeight - r.top) / range);
    return clamp01((entered - 0.3) / 0.62);
  };
  const update = () => { queued = false; ink?.draw(progress()); };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true, signal: ac.signal });
  window.addEventListener('resize', onScroll, { passive: true, signal: ac.signal });
  // o mapa só é montado quando o rodapé se aproxima; até lá (ou se falhar) fica o SVG
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    loadInkMap(holder.dataset.ink).then((map) => {
      if (ac.signal.aborted) return;
      ink = inkCanvas(map, color);
      holder.append(ink.canvas);
      ink.draw(progress());
      holder.classList.add('is-live');
    }).catch(() => {});
  }, { rootMargin: '100% 0px' });
  io.observe(holder);
  return { destroy: () => { ac.abort(); io.disconnect(); holder.classList.remove('is-live'); holder.querySelector('canvas')?.remove(); } };
}

/* ---------------------------------------------------------------- serviços */
// Acordeão (um aberto por vez) + prévia de projeto que segue o cursor (só com mouse).
function Services(list) {
  const ac = new AbortController();
  const { signal } = ac;
  const items = [...list.querySelectorAll('.svc')];
  const setOpen = (li, open) => {
    li.classList.toggle('is-open', open);
    li.querySelector('.svc-btn').setAttribute('aria-expanded', String(open));
  };
  items.forEach((li) => {
    li.querySelector('.svc-btn').addEventListener('click', () => {
      const open = !li.classList.contains('is-open');
      items.forEach((o) => setOpen(o, o === li && open));
    }, { signal });
  });

  // "Conversar sobre este serviço" já deixa o assunto escrito no formulário
  list.querySelectorAll('[data-service]').forEach((a) => a.addEventListener('click', () => {
    const msg = document.querySelector('[data-contact-form] textarea[name="mensagem"]');
    if (msg && !msg.value.trim()) msg.value = `Tenho interesse em ${a.dataset.service}. `;
  }, { signal }));

  const box = document.querySelector('[data-preview-box]');
  if (box && mq('(hover: hover) and (pointer: fine)').matches) {
    const img = box.querySelector('img');
    // a prévia fica logo abaixo e à direita da ponta do cursor, como nas telas de referência
    const OX = -22, OY = -26;
    let x = 0, y = 0, tx = 0, ty = 0, raf = 0, active = null;
    const loop = () => {
      const k = reduce() ? 1 : 0.18;
      x += (tx - x) * k; y += (ty - y) * k;
      box.style.translate = `${x + OX}px ${y + OY}px`;
      raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.3 ? requestAnimationFrame(loop) : 0;
    };
    const move = (e) => { tx = e.clientX; ty = e.clientY; if (!raf) raf = requestAnimationFrame(loop); };
    items.forEach((li) => {
      const btn = li.querySelector('.svc-btn');
      btn.addEventListener('pointerenter', (e) => {
        if (!box.classList.contains('is-on')) { x = tx = e.clientX; y = ty = e.clientY; box.style.translate = `${x + OX}px ${y + OY}px`; }
        if (active !== li) { img.src = li.dataset.preview; active = li; }
        items.forEach((o) => o.classList.toggle('is-hover', o === li));
        box.classList.add('is-on');
      }, { signal });
      btn.addEventListener('pointerleave', () => { box.classList.remove('is-on'); li.classList.remove('is-hover'); }, { signal });
    });
    list.addEventListener('pointermove', move, { signal, passive: true });
    window.addEventListener('scroll', () => box.classList.remove('is-on'), { signal, passive: true });
    // pré-carrega as prévias quando a lista se aproxima
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); items.forEach((li) => { new Image().src = li.dataset.preview; }); } }, { rootMargin: '50% 0px' });
    io.observe(list);
    signal.addEventListener('abort', () => { io.disconnect(); cancelAnimationFrame(raf); });
  }
  return { destroy: () => ac.abort() };
}

/* ---------------------------------------------------------------- motion (GSAP) */
function Motion() {
  const { gsap, ScrollTrigger, SplitText } = window;
  if (!gsap || !ScrollTrigger) return null;
  gsap.registerPlugin(ScrollTrigger, ...(SplitText ? [SplitText] : []));
  const EASE = 'expo.out';
  const mm = gsap.matchMedia();

  mm.add({
    motionOK: '(prefers-reduced-motion: no-preference)',
    desktop: '(min-width: 1024px)',
  }, (ctx) => {
    const { motionOK, desktop } = ctx.conditions;
    if (!motionOK) return;

    /* capa: o Samuel sobe, a assinatura se escreve atrás dele (HeroInk), o texto entra */
    const photo = document.querySelector('[data-hero-photo]');
    const sign = document.querySelector('[data-sign]');
    if (photo || sign) {
      const tl = gsap.timeline({ defaults: { ease: EASE } });
      // entrada em px (y); o parallax da rolagem usa yPercent: os dois se somam sem brigar
      if (photo) tl.from(photo, { y: 60, opacity: 0, duration: 1.6 }, 0);
      if (sign) tl.fromTo(sign, { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% 0% -20% 0%)', duration: 1.7, ease: 'power2.inOut' }, 0.35);
      const role = document.querySelector('[data-hero-split]');
      if (role && SplitText) {
        SplitText.create(role, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'none', autoSplit: true,
          onSplit: (self) => tl.from(self.lines, { yPercent: 110, duration: 1.1, stagger: 0.08 }, 1.1) });
      }
      tl.fromTo('[data-hero-fade]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.08, immediateRender: true }, 1.4);

      // ao rolar: a foto desce mais devagar que a assinatura (profundidade)
      const stage = (photo || sign).closest('section');
      const away = () => ({ trigger: stage, start: 'top top', end: 'bottom top', scrub: true });
      if (photo) gsap.to(photo, { yPercent: 8, ease: 'none', scrollTrigger: away() });
      const heroInk = document.querySelector('[data-hero-ink]');
      if (heroInk) gsap.to(heroInk, { yPercent: -18, ease: 'none', scrollTrigger: away() });
      if (sign) gsap.to(sign, { xPercent: -6, ease: 'none', scrollTrigger: away() });
    }

    /* textos: linhas sobem por máscara ao entrar */
    if (SplitText) {
      gsap.utils.toArray('[data-split]').forEach((el) => {
        SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
          aria: el.matches('h1, h2, h3') ? 'auto' : 'none',
          onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.1, ease: EASE, stagger: 0.08,
            scrollTrigger: { trigger: el, start: 'top 85%', once: true } }) });
      });
      gsap.utils.toArray('[data-lit]').forEach((el) => {
        SplitText.create(el, { type: 'words', aria: 'none', autoSplit: true,
          onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.16 }, { opacity: 1, ease: 'none', stagger: 0.12,
            scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 } }) });
      });
    }

    /* foto do Sobre abre por recorte */
    gsap.utils.toArray('[data-clip]').forEach((el) => {
      gsap.timeline({ scrollTrigger: { trigger: el, start: 'top 85%', once: true }, defaults: { ease: EASE } })
        .fromTo(el, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4 })
        .from(el.querySelector('img'), { scale: 1.2, duration: 1.8 }, 0);
    });

    /* ilustrações botânicas e fotos com parallax leve */
    gsap.utils.toArray('[data-drift]').forEach((el) => {
      const s = Number(el.dataset.drift) || 8;
      gsap.fromTo(el, { yPercent: s / 2 }, { yPercent: -s / 2, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });
    gsap.utils.toArray('[data-speed]').forEach((el) => {
      const s = Number(el.dataset.speed) || 6;
      gsap.fromTo(el, { yPercent: -s / 2 }, { yPercent: s / 2, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* projetos: cada tela entra com a imagem se assentando; a de baixo escurece ao ser coberta */
    const panels = gsap.utils.toArray('.pj');
    panels.forEach((pj, i) => {
      const img = pj.querySelector('.pj-img');
      gsap.fromTo(img, { scale: 1.14 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: pj, start: 'top bottom', end: 'top top', scrub: true } });
      const next = panels[i + 1];
      if (next) gsap.to(img, { opacity: 0.35, ease: 'none', scrollTrigger: { trigger: next, start: 'top bottom', end: 'top top', scrub: true } });
    });

    /* depoimentos: trilho horizontal fixado, só no desktop */
    const section = document.querySelector('[data-hscroll]');
    if (desktop && section) {
      const track = section.querySelector('[data-track]');
      section.classList.add('is-pinned');
      track.removeAttribute('tabindex');
      // medido pelo último cartão: com overflow visível, scrollWidth não conta o que passa da borda
      const last = track.lastElementChild;
      const pad = () => parseFloat(getComputedStyle(track).paddingRight) || 0;
      const distance = () => Math.max(last.offsetLeft + last.offsetWidth + pad() - track.clientWidth, 0);
      const tween = gsap.to(track, { x: () => -distance(), ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 0.5, invalidateOnRefresh: true, anticipatePin: 1 } });
      return () => {
        tween.scrollTrigger?.kill();
        section.classList.remove('is-pinned');
        track.setAttribute('tabindex', '0');
      };
    }
  });

  // as fontes da Adobe mudam a quebra das linhas: medir de novo quando chegarem
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  return { destroy: () => mm.revert() };
}

/* ---------------------------------------------------------------- rolagem suave */
function Smooth() {
  const { Lenis, gsap, ScrollTrigger } = window;
  if (!Lenis || !gsap || !ScrollTrigger || reduce() || !mq('(pointer: fine)').matches) return null;
  const lenis = new Lenis({ autoRaf: false, lerp: 0.11 });
  lenis.on('scroll', ScrollTrigger.update);
  const tick = (t) => lenis.raf(t * 1000);
  gsap.ticker.add(tick);
  gsap.ticker.lagSmoothing(0);
  const onClick = (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href') === '#') return;
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    lenis.scrollTo(target, { offset: 0 });
    history.replaceState(null, '', a.getAttribute('href'));
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  };
  document.addEventListener('click', onClick);
  return { lenis, destroy: () => { document.removeEventListener('click', onClick); gsap.ticker.remove(tick); lenis.destroy(); } };
}

/* ---------------------------------------------------------------- início */
const RED = [229, 57, 23], INK = [13, 13, 13];
const heroInk = document.querySelector('[data-hero-ink]');
if (heroInk) HeroInk(heroInk, RED);
else document.documentElement.classList.remove('ink-wait');
const header = document.querySelector('[data-header]');
if (header) Header(header);
Reveal();
const accordion = document.querySelector('[data-accordion]');
if (accordion) Services(accordion);
document.querySelectorAll('[data-ink-footer]').forEach((s) => ScrollInk(s, INK));
Smooth();
Motion();
