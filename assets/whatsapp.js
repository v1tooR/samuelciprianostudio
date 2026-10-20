// Floating WhatsApp button, shared by every page. It stays out of the way: hidden on the
// opening screen, shown once the visitor scrolls, and hidden again over the footer (which
// already has the form and the WhatsApp link) and while the menu is open. Ink on paper,
// wool over dark screens, blue on hover, like the site's buttons.
(function () {
  var NUMBER = '5512991550799';
  var TEXT = 'Olá, Samuel! Vim pelo site e gostaria de conversar sobre um projeto.';

  var css = [
    '.wa { position: fixed; z-index: 110; right: calc(clamp(16px, 2.4vw, 36px) + env(safe-area-inset-right, 0px));',
    '  bottom: calc(clamp(16px, 2.4vw, 36px) + env(safe-area-inset-bottom, 0px));',
    '  display: flex; align-items: center; height: 56px; padding: 0 17px; gap: 0; border-radius: 999px;',
    '  background: #034638; color: #F2EBE7; text-decoration: none; box-shadow: 0 10px 30px -12px rgba(3,70,56,.45);',
    '  opacity: 0; visibility: hidden; transform: translateY(14px) scale(.92);',
    '  transition: opacity .45s cubic-bezier(.16,1,.3,1), transform .6s cubic-bezier(.16,1,.3,1), visibility 0s linear .45s,',
    '    background-color .3s, color .3s, gap .5s cubic-bezier(.16,1,.3,1), box-shadow .3s; }',
    '.wa.is-on { opacity: 1; visibility: visible; transform: none; transition-delay: 0s; }',
    '.wa svg { flex: none; width: 22px; height: 22px; display: block; }',
    '.wa-t { max-width: 0; overflow: hidden; white-space: nowrap; font-family: "neue-haas-grotesk-display", "Helvetica Neue", sans-serif;',
    '  font-weight: 500; font-size: 15px; line-height: 1; letter-spacing: .01em; transition: max-width .55s cubic-bezier(.16,1,.3,1); }',
    '.wa:hover, .wa:focus-visible { background: #0047BB; color: #F2EBE7; gap: 10px; }',
    '.wa:hover .wa-t, .wa:focus-visible .wa-t { max-width: 140px; }',
    '.wa:focus-visible { outline: 2px solid #0047BB; outline-offset: 3px; }',
    /* over the dark project screens the button turns wool so it never disappears */
    '.wa.is-dark { background: #E5D0B1; color: #034638; box-shadow: 0 10px 30px -12px rgba(0,0,0,.5); }',
    '.wa.is-dark:hover, .wa.is-dark:focus-visible { background: #0047BB; color: #F2EBE7; }',
    '@media (max-width: 640px) { .wa { height: 52px; padding: 0 15px; } }',
    '@media (hover: none) { .wa:hover { background: #034638; gap: 0; } .wa:hover .wa-t { max-width: 0; } .wa.is-dark:hover { background: #E5D0B1; } }',
    '@media (prefers-reduced-motion: reduce) { .wa { transform: none !important; transition: opacity .2s, visibility 0s linear .2s, background-color .2s; } .wa.is-on { transition-delay: 0s; } }',
    '@media print { .wa { display: none; } }'
  ].join('\n');

  var ICON = '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' +
    '<path d="M12 3.4a8.6 8.6 0 0 0-7.4 13l-1.2 4.2 4.3-1.1A8.6 8.6 0 1 0 12 3.4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>' +
    '<path d="M9.3 7.8c.25 0 .45.05.6.4l.7 1.65c.08.2.04.42-.1.6l-.5.6c-.12.14-.17.3-.06.5.5.85 1.15 1.55 1.95 2.05.3.18.56.33.85.45.2.08.38.05.52-.12l.62-.72c.16-.2.32-.22.52-.13l1.6.78c.2.1.32.18.34.3.05.4-.08 1.02-.58 1.43-.5.42-1.2.62-1.85.5-1-.2-2.3-.82-3.6-2.06-1.22-1.18-1.9-2.4-2.1-3.3-.17-.72.03-1.4.42-1.88.28-.36.55-.55.97-.55z" fill="currentColor"/>' +
    '</svg>';

  var DARK = '.pj, .foot, [data-cursor-dark]';

  function start() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);

    var a = document.createElement('a');
    a.className = 'wa';
    a.href = 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent(TEXT);
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Conversar com o estúdio no WhatsApp');
    a.setAttribute('data-cursor-dark', ''); // the cursor ring turns wool over the green button
    a.innerHTML = ICON + '<span class="wa-t" aria-hidden="true">Vamos conversar</span>';
    document.body.appendChild(a);

    var footVisible = false;
    var menuOpen = false;
    var dark = false;

    var update = function () {
      var past = window.scrollY > window.innerHeight * 0.6;
      var on = past && !footVisible && !menuOpen;
      a.classList.toggle('is-on', on);
      a.tabIndex = on ? 0 : -1;
      if (!on) return;
      // what sits under the button: dark project screens switch it to wool
      var r = a.getBoundingClientRect();
      var stack = document.elementsFromPoint ? document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2) : [];
      var under = null;
      for (var i = 0; i < stack.length; i++) { if (stack[i] !== a && !a.contains(stack[i])) { under = stack[i]; break; } }
      var d = !!(under && under.closest && under.closest(DARK));
      if (d !== dark) {
        dark = d;
        a.classList.toggle('is-dark', d);
        if (d) a.removeAttribute('data-cursor-dark'); else a.setAttribute('data-cursor-dark', '');
      }
    };

    var queued = false;
    var schedule = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; update(); });
    };
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);

    // the footer already offers WhatsApp and the form: step aside there
    var foot = document.querySelector('.foot');
    if (foot && window.IntersectionObserver) {
      new IntersectionObserver(function (entries) {
        footVisible = entries[0].isIntersecting;
        schedule();
      }, { rootMargin: '0px 0px -12% 0px' }).observe(foot);
    }

    // hide while the menu covers the page
    var trigger = document.querySelector('[data-menu-open]');
    if (trigger && window.MutationObserver) {
      new MutationObserver(function () {
        menuOpen = trigger.getAttribute('aria-expanded') === 'true';
        schedule();
      }).observe(trigger, { attributes: true, attributeFilter: ['aria-expanded'] });
    }

    update();
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
