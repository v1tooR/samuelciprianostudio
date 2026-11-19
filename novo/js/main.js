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

    /* capa: a foto abre, a assinatura se escreve, o texto sobe */
    const photo = document.querySelector('[data-hero-photo]');
    const sign = document.querySelector('[data-sign]');
    if (photo || sign) {
      const tl = gsap.timeline({ defaults: { ease: EASE } });
      if (photo) {
        tl.fromTo(photo, { clipPath: 'inset(7% 7% 7% 7%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4 }, 0)
          .fromTo(photo.querySelector('img'), { scale: 1.12 }, { scale: 1, duration: 1.6 }, 0);
      }
      if (sign) tl.fromTo(sign, { clipPath: 'inset(-20% 100% -20% 0%)' }, { clipPath: 'inset(-20% 0% -20% 0%)', duration: 1.7, ease: 'power2.inOut' }, 0.35);
      const role = document.querySelector('[data-hero-split]');
      if (role && SplitText) {
        SplitText.create(role, { type: 'lines', mask: 'lines', linesClass: 'split-line', aria: 'none', autoSplit: true,
          onSplit: (self) => tl.from(self.lines, { yPercent: 110, duration: 1.1, stagger: 0.08 }, 0.55) });
      }
      tl.fromTo('[data-hero-fade]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.9, stagger: 0.06, immediateRender: true }, 0.5);

      // ao rolar, a assinatura desliza mais devagar que a foto: profundidade
      const stage = (photo || sign).closest('section');
      const away = { trigger: stage, start: 'top top', end: 'bottom top', scrub: true };
      if (sign) gsap.to(sign, { xPercent: -6, ease: 'none', scrollTrigger: away });
      if (photo) gsap.to(photo, { yPercent: 6, ease: 'none', scrollTrigger: { ...away } });
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
Motion();
