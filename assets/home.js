const FILM_ID = 'UV6QA-hE1Y4';

class StudioSite {
  constructor() { this.props = { motion: 'cinematografico' }; }

  q(sel) { return Array.from(document.querySelectorAll(sel)); }
  one(sel) { return document.querySelector(sel); }

  init() {
    const open = this.one('[data-menu-open]');
    const close = this.one('[data-menu-close]');
    if (open) open.addEventListener('click', () => this.toggleMenu(true));
    if (close) close.addEventListener('click', () => this.toggleMenu(false));
    this.q('[data-menu-item]').forEach(a => a.addEventListener('click', () => this.toggleMenu(false)));
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && this.menuOpen) this.toggleMenu(false); });
    // Resolve anchor positions again once fonts and animation pins have settled.
    this.initialHash = /^#[\w-]+$/.test(window.location.hash) ? window.location.hash : '';
    if (this.initialHash && 'scrollRestoration' in history) history.scrollRestoration = 'manual';
    this.reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.mob = window.innerWidth <= 760;
    this.onViewport = () => { this.mob = window.innerWidth <= 760; };
    window.addEventListener('resize', this.onViewport);
    this.setupHeaderLogo();
    this.onFloraResize = () => this.layoutCapaFlora();
    window.addEventListener('resize', this.onFloraResize);
    const capaMark = this.one('.capa-mark');
    if (capaMark) capaMark.addEventListener('load', this.onFloraResize);
    this.layoutCapaFlora();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => this.layoutCapaFlora());
    this.bindFilm();
    // gsap and ScrollTrigger arrive as separate scripts; wait for both
    this.waitFor(() => window.gsap && window.ScrollTrigger, 8000).then(() => {
      if (!window.gsap) { this.revealCurtain(true); this.staticFilm(); this.goToHash(); return; }
      this.setupLenis();
      this.setupMotion();
    });
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.onViewport);
    if (this.onFilmResize) window.removeEventListener('resize', this.onFilmResize);
    if (this.onFloraResize) window.removeEventListener('resize', this.onFloraResize);
    if (this.onHlogo) { window.removeEventListener('scroll', this.onHlogo); window.removeEventListener('resize', this.onHlogoResize); }
    if (this.filmIO) this.filmIO.disconnect();
    if (this.filmSound && this.onFilmSound) this.filmSound.removeEventListener('click', this.onFilmSound);
    if (this.ytPlayer && this.ytPlayer.destroy) this.ytPlayer.destroy();
    if (this.onAnchor) document.removeEventListener('click', this.onAnchor);
    if (this.lenis) this.lenis.destroy();
    if (window.ScrollTrigger) window.ScrollTrigger.getAll().forEach((t) => t.kill());
  }

  waitFor(test, timeout) {
    return new Promise((res) => {
      const t0 = Date.now();
      const i = setInterval(() => {
        if (test()) { clearInterval(i); res(true); }
        else if (Date.now() - t0 > timeout) { clearInterval(i); res(false); }
      }, 60);
    });
  }

  setupLenis() {
    if (!window.Lenis || this.reduced) return;
    try {
      this.lenis = new window.Lenis({ lerp: 0.09, wheelMultiplier: 1, autoRaf: false });
      window.__lenis = this.lenis;
      this.onAnchor = (e) => {
        const a = e.target && e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!a) return;
        const id = a.getAttribute('href');
        if (!id || id === '#') return;
        const el = document.querySelector(id);
        if (!el) return;
        e.preventDefault();
        if (a.closest('[data-menu]')) this.toggleMenu(false);
        this.lenis.scrollTo(el, { duration: 1.4 });
      };
      document.addEventListener('click', this.onAnchor);
      const g = window.gsap;
      g.ticker.add((time) => { this.lenis.raf(time * 1000); });
      g.ticker.lagSmoothing(0);
      if (window.ScrollTrigger) this.lenis.on('scroll', window.ScrollTrigger.update);
    } catch (e) { this.lenis = null; }
  }

  toggleMenu(open) {
    const menu = this.one('[data-menu]');
    if (!menu) return;
    this.menuOpen = open;
    menu.inert = !open;
    const trigger = this.one('[data-menu-open]');
    if (trigger) trigger.setAttribute('aria-expanded', String(open));
    const focusTarget = open ? this.one('[data-menu-close]') : trigger;
    if (focusTarget) focusTarget.focus({ preventScroll: true });
    menu.style.pointerEvents = open ? 'auto' : 'none';
    if (this.lenis) { if (open) this.lenis.stop(); else this.lenis.start(); }
    const items = this.q('[data-menu-item]');
    if (!window.gsap) { menu.style.clipPath = open ? 'inset(0 0 0 0)' : 'inset(0 0 100% 0)'; return; }
    const g = window.gsap;
    if (open) {
      g.timeline()
        .to(menu, { clipPath: 'inset(0% 0 0% 0)', duration: .8, ease: 'power4.inOut' })
        .from(items, { yPercent: 30, opacity: 0, duration: .7, stagger: .05, ease: 'expo.out' }, .3);
    } else {
      g.to(menu, { clipPath: 'inset(0 0 100% 0)', duration: .7, ease: 'power4.inOut' });
    }
  }

  revealCurtain(instant) {
    const curtain = this.one('[data-curtain]');
    if (!curtain) return;
    if (instant || !window.gsap) { curtain.style.display = 'none'; return; }
    curtain.style.display = 'block';
    const g = window.gsap;
    const emblem = this.one('[data-curtain-emblem]');
    const fill = this.one('[data-curtain-fill]');
    const load = { v: 0 };
    g.timeline({ delay: .12 })
      .from(emblem, { scale: .86, opacity: 0, duration: .9, ease: 'expo.out' })
      .to(load, {
        v: 1, duration: 1.4, ease: 'power2.inOut',
        onUpdate: () => { if (fill) fill.style.clipPath = 'inset(' + ((1 - load.v) * 100).toFixed(2) + '% 0 0 0)'; }
      }, .3)
      .to(emblem, { scale: .9, opacity: 0, duration: .7, ease: 'power3.in' }, 1.9)
      .to(curtain, { opacity: 0, duration: .6, ease: 'power2.out' }, 2.4)
      .set(curtain, { display: 'none' });
  }

  // ---- 03 manifesto film: a small 4:3 plate that opens into a large plate on the page.
  // Nothing plays by itself: the visitor presses play and the film starts with sound.
  bindFilm() {
    const wrap = this.one('[data-film-yt]');
    const plate = this.one('[data-film-plate]');
    const play = this.one('[data-film-play]');
    const btn = this.one('[data-film-sound]');
    this.filmWrap = wrap;
    this.filmPlate = plate;
    this.filmSound = btn;
    this.filmPlaying = false;
    if (!wrap || !plate) return;
    const mount = document.createElement('div');
    wrap.appendChild(mount);
    const create = () => {
      this.ytPlayer = new window.YT.Player(mount, {
        videoId: FILM_ID,
        host: 'https://www.youtube-nocookie.com',
        playerVars: { autoplay: 0, controls: 0, loop: 1, playlist: FILM_ID, playsinline: 1, rel: 0, modestbranding: 1, iv_load_policy: 3, disablekb: 1, fs: 0, cc_load_policy: 0 },
        events: {
          onReady: () => {
            this.filmReady = true;
            this.noCaptions();
            if (this.filmWanted) this.playFilm();
          },
          onStateChange: (e) => {
            this.filmPlaying = e.data === 1;
            if (this.filmPlaying) this.noCaptions();
            plate.classList.toggle('film-on', this.filmPlaying || (this.filmWanted && e.data === 3));
            this.paintSound();
          }
        }
      });
    };
    // The player is requested only when the visitor presses play.
    this.loadFilm = () => {
      if (this.filmRequested) return;
      this.filmRequested = true;
      if (window.YT && window.YT.Player) { create(); return; }
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => { if (prev) prev(); create(); };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const sc = document.createElement('script');
        sc.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(sc);
      }
    };
    this.onFilmSound = () => { if (this.filmPlaying || this.filmWanted) this.pauseFilm(); else this.playFilm(); };
    if (play) play.addEventListener('click', this.onFilmSound);
    if (btn) btn.addEventListener('click', this.onFilmSound);
    this.paintSound();
    // leaving the section pauses it
    if ('IntersectionObserver' in window) {
      this.filmIO = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (!e.isIntersecting && (this.filmPlaying || this.filmWanted)) this.pauseFilm(); });
      }, { threshold: 0.15 });
      this.filmIO.observe(this.one('[data-film]'));
    }
  }

  // the film carries its own subtitles; YouTube's captions would double them
  noCaptions() {
    const p = this.ytPlayer;
    if (!p || !p.unloadModule) return;
    try { p.unloadModule('captions'); p.unloadModule('cc'); } catch (e) {}
  }

  // pressed before the player is ready: it starts as soon as it is
  playFilm() {
    if (this.loadFilm) this.loadFilm();
    this.filmWanted = true;
    if (this.filmPlate) this.filmPlate.classList.add('film-on');
    this.paintSound();
    if (!this.filmReady || !this.ytPlayer) return;
    this.ytPlayer.unMute();
    this.ytPlayer.setVolume(100);
    this.ytPlayer.playVideo();
  }

  pauseFilm() {
    this.filmWanted = false;
    if (this.filmPlate) this.filmPlate.classList.remove('film-on');
    if (this.filmReady && this.ytPlayer) this.ytPlayer.pauseVideo();
    this.paintSound();
  }

  paintSound() {
    const label = this.filmWanted ? 'Pausar' : 'Assistir com som';
    if (this.filmSound) this.filmSound.textContent = label;
    const play = this.one('[data-film-play]');
    if (play) play.setAttribute('aria-label', this.filmWanted ? 'Pausar o filme' : 'Assistir ao filme manifesto com som');
  }

  filmLayout(p) {
    this.lastFP = p;
    const sec = this.one('[data-film]');
    const plate = this.one('[data-film-plate]');
    if (!sec || !plate) return;
    const vw = sec.clientWidth, vh = sec.clientHeight;
    const cl = (v, a, b) => Math.min(Math.max(v, a), b);
    const seg = (a, b) => cl((p - a) / (b - a), 0, 1);
    const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    const lerp = (a, b, t) => a + (b - a) * t;
    const gut = cl(vw * .03, 16, 46);
    const nav = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav')) || 60;
    const top = nav + cl(vh * .05, 28, 56);
    const bottom = 64;                              // caption
    // the plate at rest: as large as the page allows, always 4:3
    const H1 = Math.max(120, Math.min((vw - gut * 2) * 3 / 4, vh - top - bottom));
    const W1 = H1 * 4 / 3;
    const y1 = top + (vh - top - bottom - H1) / 2;
    const x1 = (vw - W1) / 2;
    const W0 = this.mob ? vw * .5 : Math.min(vw * .24, 360);
    const s0 = Math.min(1, W0 / W1);
    const E = ease(seg(0, .74));
    const s = lerp(s0, 1, E);
    Object.assign(plate.style, { left: x1.toFixed(1) + 'px', top: y1.toFixed(1) + 'px', width: W1.toFixed(1) + 'px', height: H1.toFixed(1) + 'px', margin: '0', transform: 'scale(' + s.toFixed(4) + ')' });
    if (this.filmWrap) this.filmWrap.style.transform = 'scale(' + lerp(1.12, 1, E).toFixed(4) + ')';
    // the play mark keeps its size on screen while the plate grows around it
    const playIn = this.one('[data-film-play-in]');
    if (playIn) playIn.style.transform = 'scale(' + (1 / s).toFixed(4) + ')';

    // the two lines sit on the plate's centre line and are pushed out by its edges
    const words = this.one('[data-film-words]');
    if (words) words.style.transform = 'translate3d(0,' + (y1 + H1 / 2 - vh / 2).toFixed(1) + 'px,0)';
    const H0 = H1 * s0;
    const gap = this.one('[data-film-gap]');
    if (gap) gap.style.height = (H0 + (this.mob ? 24 : 40)).toFixed(0) + 'px';
    const push = (H1 * s - H0) / 2;
    const fade = 1 - seg(.3, .62);
    this.q('[data-film-line]').forEach((el) => {
      const dir = parseFloat(el.getAttribute('data-film-line')) || 1;
      el.style.transform = 'translate3d(0,' + (dir * push * 1.1).toFixed(1) + 'px,0)';
      el.style.opacity = fade.toFixed(3);
    });
    const cap = this.one('[data-film-cap]');
    if (cap) {
      const t = seg(.76, .94);
      Object.assign(cap.style, { left: x1.toFixed(1) + 'px', top: (y1 + H1 + 12).toFixed(1) + 'px', width: W1.toFixed(1) + 'px', opacity: t.toFixed(3), pointerEvents: t > .5 ? 'auto' : 'none' });
    }
  }

  setupFilm(g, ST) {
    const sec = this.one('[data-film]');
    if (!sec) return;
    const dist = () => this.mob
      ? Math.min(Math.max(window.innerHeight * 1.1, 700), 1100)
      : Math.min(Math.max(window.innerHeight * 1.5, 1000), 1700);
    ST.create({
      trigger: sec, start: 'top top', end: () => '+=' + dist(),
      pin: true, scrub: true, anticipatePin: 1, invalidateOnRefresh: true,
      onUpdate: (self) => this.filmLayout(self.progress),
      onRefresh: (self) => this.filmLayout(self.progress || 0)
    });
    this.filmLayout(0);
    this.onFilmResize = () => this.filmLayout(this.lastFP || 0);
    window.addEventListener('resize', this.onFilmResize);
  }

  // no scroll engine or reduced motion: the film simply rests as the large plate
  staticFilm() {
    this.filmLayout(1);
    this.paintSound();
    this.onFilmResize = () => this.filmLayout(1);
    window.addEventListener('resize', this.onFilmResize);
  }

  // ---- header logo: the cover logotipo scrolls up with the page while it shrinks into the header slot.
  // Its top follows the scroll exactly (linear), only its size eases, so it reads as one object.
  setupHeaderLogo() {
    const el = this.one('[data-hlogo]'), slot = this.one('[data-nav-slot]'), mark = this.one('.capa-mark');
    if (!el || !slot || !mark) return;
    document.documentElement.classList.add('has-hlogo');
    const ease = (t) => t * t * (3 - 2 * t);
    let A = null, B = null;
    this.onHlogoResize = () => {
      const a = mark.parentElement.getBoundingClientRect(), b = slot.getBoundingClientRect();
      A = { x: a.left, y: a.top + window.scrollY, w: a.width };
      B = { x: b.left, y: b.top, w: b.width };
      this.onHlogo();
    };
    this.onHlogo = () => {
      if (!A || !A.w) return;
      const D = Math.max(1, A.y - B.y);
      const t = Math.min(Math.max(window.scrollY / D, 0), 1);
      const e = ease(t);
      const x = A.x + (B.x - A.x) * e;
      const y = A.y - window.scrollY * (t < 1 ? 1 : 0) - (t < 1 ? 0 : D);
      const w = A.w + (B.w - A.w) * e;
      // moving: one size, scaled (cheap); arrived: drawn at its real size, so the small logo stays crisp
      if (t < 1) { el.style.width = A.w + 'px'; el.style.transform = 'translate3d(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px,0) scale(' + (w / A.w).toFixed(5) + ')'; }
      else { el.style.width = B.w + 'px'; el.style.transform = 'translate3d(' + B.x.toFixed(2) + 'px,' + B.y.toFixed(2) + 'px,0)'; }
    };
    window.addEventListener('scroll', this.onHlogo, { passive: true });
    window.addEventListener('resize', this.onHlogoResize);
    mark.addEventListener('load', this.onHlogoResize);
    this.onHlogoResize();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(this.onHlogoResize);
  }

  // ---- flora
  // the cover plates grow from the bottom corners only as tall as the room left under
  // the logotipo's safe area (the height of its "O") and the line, so they never touch either
  layoutCapaFlora() {
    const capa = this.one('#capa');
    if (!capa) return;
    const logo = this.one('.capa-mark');
    const box = (el) => el ? el.getBoundingClientRect() : null;
    const c = capa.getBoundingClientRect();
    const vw = capa.clientWidth;
    const L = box(logo && logo.parentElement), T = box(this.one('.capa-tag') && this.one('.capa-tag').parentElement), M = box(this.one('.capa-meta span'));
    const obstacles = [];
    if (L && L.height) { const safe = L.width * .104; obstacles.push({ l: L.left - c.left - safe, r: L.right - c.left + safe, b: L.bottom - c.top + safe }); }
    if (T && T.height) obstacles.push({ l: T.left - c.left - 24, r: T.right - c.left + 24, b: T.bottom - c.top + 24 });
    if (M && M.height) obstacles.push({ l: M.left - c.left - 20, r: M.right - c.left + 20, b: M.bottom - c.top + 8 });
    this.q('.flora-capa-l, .flora-capa-r').forEach((el) => {
      const ar = parseFloat(el.style.getPropertyValue('--ar')) || .6;
      const left = el.classList.contains('flora-capa-l');
      const bleed = left ? .16 : .14;
      // the tallest plate whose visible part clears every obstacle above it
      const fits = (h) => {
        const vis = h * ar * (1 - bleed);
        if (vis > vw * .4) return false;
        const span = left ? [0, vis] : [vw - vis, vw];
        return obstacles.every((o) => !(o.l < span[1] && o.r > span[0]) || o.b <= c.height - h);
      };
      let h = Math.min(c.height * .62, 620);
      while (h >= 120 && !fits(h)) h -= 6;
      el.style.height = (h >= 120 ? h : 0).toFixed(1) + 'px';
      el.style.display = h >= 120 ? '' : 'none';
    });
  }

  // a torn-paper edge that rises from the stem: p = 0 hidden, p = 1 whole plate
  ragged(p, seed) {
    const n = 22, pts = [];
    for (let i = 0; i <= n; i++) {
      const r = Math.abs(Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453) % 1;
      const wob = .5 + .5 * Math.sin(p * 7 + i * 1.7 + seed);
      const y = (1 - p) * 116 - 16 * (.65 * r + .35 * wob);
      pts.push((i / n * 100).toFixed(2) + '% ' + y.toFixed(2) + '%');
    }
    return 'polygon(' + pts.join(',') + ',100% 100%,0% 100%)';
  }

  setupFlora(g, ST) {
    const soft = this.props.motion === 'contido';
    this.q('[data-flora]').forEach((el, i) => {
      const clip = el.querySelector('[data-flora-clip]');
      const img = el.querySelector('[data-flora-img]');
      if (!clip || !img) return;
      const seed = i * 3.1 + 1;
      const onCover = !!el.closest('#capa');
      const side = el.getBoundingClientRect().left + el.offsetWidth / 2 < window.innerWidth / 2 ? -1 : 1;
      const st = { p: 0 };
      const paint = () => { clip.style.clipPath = st.p >= .999 ? 'none' : this.ragged(st.p, seed); };
      paint();

      // the wind: each plate sways on its stem at its own pace, forever
      const amp = soft ? .7 : 1.3, dur = 3.6 + (i % 3) * .9;
      const sway = () => g.fromTo(clip, { rotation: 0 }, { rotation: amp * side, duration: dur / 2, ease: 'sine.out', onComplete: () => {
        g.fromTo(clip, { rotation: amp * side }, { rotation: -amp * side, duration: dur, ease: 'sine.inOut', yoyo: true, repeat: -1 });
      } });

      if (onCover) {
        // entrance: grows out of the corner as the curtain clears, then drifts away from the logo on scroll
        g.timeline({ delay: 2.55 + (side > 0 ? .3 : 0), onComplete: sway })
          .to(st, { p: 1, duration: soft ? 1.6 : 2.4, ease: 'power2.out', onUpdate: paint }, 0)
          .from(img, { rotation: -9 * side, scale: .86, duration: soft ? 1.8 : 2.8, ease: 'expo.out' }, 0);
        if (ST) g.to(el, { scale: this.mob ? 1.12 : 1.5, rotation: 3.5 * side, transformOrigin: side < 0 ? '0% 100%' : '100% 100%', ease: 'none', scrollTrigger: { trigger: '#capa', start: 'top top', end: 'bottom top', scrub: 1.2 } });
        return;
      }
      if (!ST) { st.p = 1; paint(); return; }
      // in the page: the plate unfurls from its stem as it is scrolled into view, then keeps drifting
      g.timeline({ scrollTrigger: { trigger: el, start: 'top 96%', end: 'top 38%', scrub: 1.4, onLeave: () => { if (!el.dataset.swaying) { el.dataset.swaying = '1'; sway(); } } } })
        .to(st, { p: 1, ease: 'none', onUpdate: paint }, 0)
        .fromTo(img, { rotation: -12 * side, scale: .84 }, { rotation: 0, scale: 1, ease: 'power1.out' }, 0);
      // plates rooted in the footer stay put, so their stem never lifts off the green
      if (!el.hasAttribute('data-flora-rooted')) g.fromTo(el, { y: soft ? 30 : 70 }, { y: soft ? -30 : -70, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: 1.6 } });
    });
  }

  // lands on the section named in the address, measured after pins and fonts have settled
  goToHash() {
    const id = this.initialHash;
    if (!id) return;
    const el = document.querySelector(id);
    if (!el) return;
    const go = () => {
      const y = el.getBoundingClientRect().top + window.scrollY;
      if (this.lenis) { this.lenis.resize(); this.lenis.scrollTo(y, { immediate: true, force: true }); }
      else window.scrollTo(0, y);
    };
    go();
    // once more after late layout (images, the film pin) so it does not stop short
    setTimeout(go, 400);
    setTimeout(() => { this.initialHash = ''; }, 500);
  }

  setupMotion() {
    const g = window.gsap;
    const ST = window.ScrollTrigger;
    if (ST) g.registerPlugin(ST);
    const soft = this.props.motion === 'contido';

    if (this.reduced) { this.revealCurtain(true); this.staticFilm(); this.layoutCapaFlora(); this.goToHash(); return; }
    this.revealCurtain(!!this.initialHash);

    const hIn = this.one('[data-hlogo-in]');
    if (hIn) g.from(hIn, { yPercent: 108, duration: soft ? .9 : 1.25, ease: 'expo.out', delay: 2.7 });

    // type rises out of its line; on the cover it waits for the curtain to clear
    this.q('[data-mask]').forEach((wrap) => {
      const inner = wrap.querySelectorAll('[data-mask-in]');
      if (!inner.length) return;
      const onCover = !!wrap.closest('#capa');
      g.from(inner, {
        yPercent: 108, duration: soft ? .9 : 1.25, ease: 'expo.out', stagger: .09,
        delay: onCover ? 2.7 : 0,
        scrollTrigger: ST && !onCover ? { trigger: wrap, start: 'top 90%', once: true } : undefined
      });
    });

    this.q('[data-fade]').forEach((el) => {
      g.from(el, {
        y: soft ? 10 : 18, opacity: 0, duration: soft ? .7 : 1, ease: 'expo.out',
        scrollTrigger: ST ? { trigger: el, start: 'top 92%', once: true } : undefined
      });
    });

    if (!ST) { this.staticFilm(); this.goToHash(); return; }

    // plates are uncovered like a print laid on the page
    this.q('[data-plate]').forEach((fig) => {
      const frame = fig.querySelector('.frame');
      const img = fig.querySelector('img');
      if (!frame) return;
      g.timeline({ scrollTrigger: { trigger: fig, start: 'top 88%', once: true } })
        .fromTo(frame, { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: soft ? 1 : 1.4, ease: 'expo.out' })
        .fromTo(img, { scale: 1.12 }, { scale: 1, duration: soft ? 1.2 : 1.8, ease: 'expo.out' }, 0);
    });

    this.setupFilm(g, ST);
    this.setupFlora(g, ST);
    const settle = () => { ST.refresh(); this.goToHash(); };
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(settle); else settle();
  }
}


if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new StudioSite().init(), { once: true });
} else {
  new StudioSite().init();
}
