// Ponto de entrada único. Camadas, de baixo para cima:
// 1) HTML/CSS mostram tudo (estado final); 2) IO revela blocos; 3) GSAP (se carregou)
// escreve a assinatura, sobe títulos por máscara, acende o texto do Sobre, faz parallax
// leve e o trilho horizontal dos projetos; 4) Lenis só com ponteiro fino e movimento livre.
// Sem GSAP/Lenis (CDN bloqueada) o site continua completo e navegável.

const mq = (q) => window.matchMedia(q);
const reduce = () => mq('(prefers-reduced-motion: reduce)').matches;

/* ---------------------------------------------------------------- cabeçalho */
function Header(el) {
  const ac = new AbortController();
  let lastY = window.scrollY;
  let queued = false;
  const update = () => {
    queued = false;
    const y = window.scrollY;
    el.classList.toggle('is-scrolled', y > 8);
    const goingDown = y > lastY + 4;
    const goingUp = y < lastY - 4;
    if (goingDown && y > window.innerHeight * 0.6 && !el.contains(document.activeElement)) el.classList.add('is-hidden');
    else if (goingUp || y < 80) el.classList.remove('is-hidden');
    lastY = y;
  };
  window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true, signal: ac.signal });
  el.addEventListener('focusin', () => el.classList.remove('is-hidden'), { signal: ac.signal });
  update();
  return { destroy: () => ac.abort() };
}

/* ---------------------------------------------------------------- menu (mobile) */
function Menu(panel, { onOpen, onClose } = {}) {
  const ac = new AbortController();
  const { signal } = ac;
  const opener = document.querySelector('[data-menu-open]');
  const closer = panel.querySelector('[data-menu-close]');
  const outside = [...document.body.children].filter((n) => n !== panel && n.tagName !== 'SCRIPT');

  const open = () => {
    panel.hidden = false;
    opener?.setAttribute('aria-expanded', 'true');
    outside.forEach((n) => (n.inert = true));
    document.documentElement.style.overflow = 'hidden';
    onOpen?.();
    closer?.focus();
    if (!reduce()) panel.animate([{ clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)' }], { duration: 520, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
  };
  const close = (restore = true) => {
    if (panel.hidden) return;
    panel.hidden = true;
    opener?.setAttribute('aria-expanded', 'false');
    outside.forEach((n) => (n.inert = false));
    document.documentElement.style.overflow = '';
    onClose?.();
    if (restore) opener?.focus();
  };

  opener?.addEventListener('click', open, { signal });
  closer?.addEventListener('click', () => close(), { signal });
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); }, { signal });
  panel.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', () => close(false), { signal }));
  // ao crescer para desktop, o menu some
  mq('(min-width: 1024px)').addEventListener('change', (e) => { if (e.matches) close(false); }, { signal });
  return { destroy: () => { close(false); ac.abort(); } };
}

/* ---------------------------------------------------------------- reveal (IO + CSS) */
function Reveal(root = document) {
  const els = root.querySelectorAll('[data-reveal], [data-reveal-line]');
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('is-in')); return { destroy() {} }; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
  els.forEach((el) => io.observe(el));
  return { destroy: () => io.disconnect() };
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
    if (!motionOK) return; // reduzido: tudo já está no estado final (CSS)

    /* capa: a foto abre, o nome sobe por máscara (na página Sobre, a assinatura passa), o texto entra */
    const photo = document.querySelector('[data-hero-photo]');
    const sign = document.querySelector('[data-sign]');
    const names = gsap.utils.toArray('[data-hero-name] .hn > span');
    if (photo || sign || names.length) {
      const tl = gsap.timeline({ defaults: { ease: EASE } });
      if (photo) {
        tl.fromTo(photo, { clipPath: 'inset(7% 7% 7% 7%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4 }, 0)
          .fromTo(photo.querySelector('img'), { scale: 1.12 }, { scale: 1, duration: 1.6 }, 0);
      }
      if (names.length) tl.from(names, { yPercent: 105, duration: 1.3, stagger: 0.14 }, 0.2);
      if (sign) tl.fromTo(sign, { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% 0% -20% 0%)', duration: 1.7, ease: 'power2.inOut' }, 0.35);
      const role = document.querySelector('[data-hero-split]');
      if (role && SplitText) {
        SplitText.create(role, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'none', autoSplit: true,
          onSplit: (self) => tl.from(self.lines, { yPercent: 110, duration: 1.1, stagger: 0.08 }, 0.55) });
      }
      tl.fromTo('[data-hero-fade]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, immediateRender: true }, 0.5);

      // ao rolar, o nome se abre para os lados enquanto a foto desce: profundidade
      const stage = (photo || sign || names[0]).closest('section');
      const away = () => ({ trigger: stage, start: 'top top', end: 'bottom top', scrub: true });
      if (sign) gsap.to(sign, { xPercent: -6, ease: 'none', scrollTrigger: away() });
      if (names.length) {
        gsap.to('.hn-1', { xPercent: -8, ease: 'none', scrollTrigger: away() });
        gsap.to('.hn-2', { xPercent: 8, ease: 'none', scrollTrigger: away() });
      }
      if (photo) gsap.to(photo, { yPercent: 6, ease: 'none', scrollTrigger: away() });
    }

    /* títulos: linhas sobem por máscara ao entrar */
    if (SplitText) {
      gsap.utils.toArray('[data-split]').forEach((el) => {
        SplitText.create(el, { type: 'lines', mask: 'lines', linesClass: 'split-line', autoSplit: true,
          aria: el.matches('h1, h2, h3') ? 'auto' : 'none',
          onSplit: (self) => gsap.from(self.lines, { yPercent: 110, duration: 1.1, ease: EASE, stagger: 0.09,
            scrollTrigger: { trigger: el, start: 'top 85%', once: true } }) });
      });

      /* Sobre: as palavras acendem com a leitura */
      gsap.utils.toArray('[data-lit]').forEach((el) => {
        SplitText.create(el, { type: 'words', aria: 'none', autoSplit: true,
          onSplit: (self) => gsap.fromTo(self.words, { opacity: 0.16 }, { opacity: 1, ease: 'none', stagger: 0.12,
            scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: 0.6 } }) });
      });
    }

    /* parallax leve nas fotos (a moldura recorta; a imagem tem 16% de sobra) */
    gsap.utils.toArray('[data-speed]').forEach((el) => {
      const s = Number(el.dataset.speed) || 6;
      gsap.fromTo(el, { yPercent: -s / 2 }, { yPercent: s / 2, ease: 'none',
        scrollTrigger: { trigger: el.parentElement, start: 'top bottom', end: 'bottom top', scrub: true } });
    });

    /* projetos: trilho horizontal fixado, só no desktop */
    const section = document.querySelector('[data-hscroll]');
    if (desktop && section) {
      const track = section.querySelector('.work-track');
      section.classList.add('is-pinned');
      track.removeAttribute('tabindex');
      const distance = () => Math.max(track.scrollWidth - document.documentElement.clientWidth, 0);
      const tween = gsap.to(track, { x: () => -distance(), ease: 'none',
        scrollTrigger: { trigger: section, start: 'top top', end: () => '+=' + distance(), pin: true, scrub: 0.5, invalidateOnRefresh: true, anticipatePin: 1 } });
      const onFocus = (e) => {
        const card = e.target.closest('.pj');
        if (!card) return;
        const st = tween.scrollTrigger;
        const ratio = Math.min(card.offsetLeft / Math.max(distance(), 1), 1);
        requestAnimationFrame(() => window.scrollTo({ top: st.start + ratio * (st.end - st.start), behavior: 'instant' }));
      };
      track.addEventListener('focusin', onFocus);
      return () => {
        track.removeEventListener('focusin', onFocus);
        section.classList.remove('is-pinned');
        track.setAttribute('tabindex', '0');
      };
    }
  });

  // as fontes da Adobe mudam a quebra das linhas: medir de novo quando chegarem
  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  return { destroy: () => mm.revert() };
}

/* ---------------------------------------------------------------- assinatura escrita pela rolagem */
// O mapa de tinta (scripts/build-signature-ink.mjs) diz, para cada pixel do traço, em que
// instante a caneta passa por ele. Os pixels ficam ordenados por instante; a cada quadro só
// os que mudaram de estado são escritos, e só o retângulo alterado sobe para o canvas.
async function loadInk(url, [r, g, b]) {
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

  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
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

function InkSection(section) {
  if (reduce()) return null; // movimento reduzido: assinatura completa e texto corrido (CSS base)
  const holder = section.querySelector('[data-ink]');
  const beats = [...section.querySelectorAll('[data-ink-beats] > li')];
  const count = section.querySelector('[data-ink-count]');
  const ac = new AbortController();
  // a assinatura termina em 78% do percurso; o resto é respiro com ela inteira na tela
  const INK_END = 0.78;
  const STEPS = [0, 0.2, 0.44, 0.68];
  let ink = null, beat = -1, queued = false;

  section.classList.add('is-scrolly');

  const progress = () => {
    const r = section.getBoundingClientRect();
    const span = r.height - window.innerHeight;
    return span > 0 ? Math.min(Math.max(-r.top / span, 0), 1) : 1;
  };
  const update = () => {
    queued = false;
    const p = progress();
    ink?.draw(Math.min(p / INK_END, 1));
    let b = 0;
    STEPS.forEach((s, i) => { if (p >= s) b = i; });
    if (b !== beat) {
      beat = b;
      beats.forEach((li, i) => li.classList.toggle('is-on', i === b));
      if (count) count.textContent = `${String(b + 1).padStart(2, '0')} / ${String(beats.length).padStart(2, '0')}`;
    }
  };
  const onScroll = () => { if (!queued) { queued = true; requestAnimationFrame(update); } };
  window.addEventListener('scroll', onScroll, { passive: true, signal: ac.signal });
  window.addEventListener('resize', onScroll, { passive: true, signal: ac.signal });
  update();

  // o mapa só carrega quando a seção se aproxima; até lá (ou se falhar) fica o SVG inteiro
  const io = new IntersectionObserver(([e]) => {
    if (!e.isIntersecting) return;
    io.disconnect();
    loadInk(holder.dataset.ink, [239, 238, 234]).then((i) => {
      if (ac.signal.aborted) return;
      ink = i;
      holder.append(i.canvas);
      ink.draw(Math.min(progress() / INK_END, 1));
      holder.classList.add('is-live');
    }).catch(() => {});
  }, { rootMargin: '100% 0px' });
  if (holder) io.observe(holder);

  return {
    destroy: () => {
      ac.abort(); io.disconnect();
      section.classList.remove('is-scrolly');
      holder?.classList.remove('is-live');
      holder?.querySelector('canvas')?.remove();
      beats.forEach((li) => li.classList.remove('is-on'));
    },
  };
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
const header = document.querySelector('[data-header]');
if (header) Header(header);
Reveal();
const smooth = Smooth();
const panel = document.querySelector('[data-menu]');
if (panel) Menu(panel, { onOpen: () => smooth?.lenis.stop(), onClose: () => smooth?.lenis.start() });
// antes do Motion: a seção muda de altura e o ScrollTrigger precisa medir já com ela alta
document.querySelectorAll('[data-ink-section]').forEach((s) => InkSection(s));
Motion();
