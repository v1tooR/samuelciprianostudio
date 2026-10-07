// Custom cursor, shared by every page. Brand colours only: a green dot on paper, wool on dark
// surfaces (footer, project screens, the film). It rings links and buttons, becomes a filled
// disc with a word over projects and the film, and steps aside in text fields.
// Only for a real mouse; touch devices keep their own behaviour.
(function () {
  if (!window.matchMedia || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var css = [
    '.has-cur, .has-cur * { cursor: none !important; }',
    '.has-cur input, .has-cur textarea, .has-cur select { cursor: text !important; }',
    '.cur { position: fixed; left: 0; top: 0; z-index: 400; pointer-events: none; opacity: 0; transition: opacity .25s; }',
    '.cur.is-on { opacity: 1; }',
    '.cur-b { position: absolute; left: 0; top: 0; width: 10px; height: 10px; translate: -50% -50%; border-radius: 50%;',
    '  display: grid; place-items: center; background: #034638; border: 1px solid #034638; color: #F2EBE7;',
    '  transition: width .45s cubic-bezier(.16,1,.3,1), height .45s cubic-bezier(.16,1,.3,1), background-color .3s, border-color .3s, scale .2s; }',
    '.cur-t { font-family: "neue-haas-grotesk-display", "Helvetica Neue", sans-serif; font-weight: 400; font-size: 12px; line-height: 1;',
    '  white-space: nowrap; opacity: 0; transition: opacity .2s; }',
    /* over a link or button: a hairline ring */
    '.cur.is-link .cur-b { width: 44px; height: 44px; background: transparent; }',
    /* over a project or the film: a filled disc with a word */
    '.cur.is-label .cur-b { width: 104px; height: 104px; }',
    '.cur.is-label .cur-t { opacity: 1; transition-delay: .1s; }',
    /* on dark surfaces the cursor turns wool */
    '.cur.is-dark .cur-b { background: #E5D0B1; border-color: #E5D0B1; color: #034638; }',
    '.cur.is-dark.is-link .cur-b { background: transparent; }',
    '.cur.is-down .cur-b { scale: .82; }',
    '.cur.is-field { opacity: 0; }'
  ].join('\n');

  var DARK = '.foot, .pj, .film-plate, [data-cursor-dark]';
  var LINK = 'a, button, [role="button"], label, summary, .nav-btn';
  var FIELD = 'input, textarea, select, [contenteditable="true"]';

  function label(el) {
    if (!el) return '';
    var own = el.closest('[data-cursor]');
    if (own) return own.getAttribute('data-cursor');
    if (el.closest('.pj')) return 'Ver projeto';
    if (el.closest('.next')) return 'Próximo';
    var plate = el.closest('[data-film-plate]');
    if (plate) return plate.classList.contains('film-on') ? 'Pausar' : 'Assistir';
    return '';
  }

  function start() {
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    var cur = document.createElement('div');
    cur.className = 'cur';
    cur.setAttribute('aria-hidden', 'true');
    cur.innerHTML = '<div class="cur-b"><span class="cur-t"></span></div>';
    document.body.appendChild(cur);
    document.documentElement.classList.add('has-cur');
    var text = cur.querySelector('.cur-t');

    var x = -100, y = -100, cx = -100, cy = -100, target = null;
    var paint = function () {
      var t = target;
      var field = !!(t && t.closest && t.closest(FIELD));
      var lab = field ? '' : label(t);
      var link = !field && !lab && !!(t && t.closest && t.closest(LINK));
      cur.classList.toggle('is-field', field);
      cur.classList.toggle('is-label', !!lab);
      cur.classList.toggle('is-link', link);
      cur.classList.toggle('is-dark', !!(t && t.closest && t.closest(DARK)));
      if (lab && text.textContent !== lab) text.textContent = lab;
    };

    document.addEventListener('mousemove', function (e) {
      x = e.clientX; y = e.clientY;
      if (target !== e.target) { target = e.target; paint(); }
      if (!cur.classList.contains('is-on')) { cx = x; cy = y; cur.classList.add('is-on'); }
    }, { passive: true });
    // content moves under a still mouse while scrolling: re-read what is under it
    window.addEventListener('scroll', function () {
      if (x < 0) return;
      var el = document.elementFromPoint(x, y);
      if (el !== target) { target = el; paint(); }
    }, { passive: true });
    // the film flips between play and pause on click
    document.addEventListener('click', function () { setTimeout(paint, 60); });
    document.addEventListener('mousedown', function () { cur.classList.add('is-down'); });
    document.addEventListener('mouseup', function () { cur.classList.remove('is-down'); });
    document.documentElement.addEventListener('mouseleave', function () { cur.classList.remove('is-on'); });
    window.addEventListener('blur', function () { cur.classList.remove('is-on'); });

    // a short, soft lag behind the mouse; none with reduced motion
    var k = reduced ? 1 : 0.22;
    (function loop() {
      cx += (x - cx) * k;
      cy += (y - cy) * k;
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      requestAnimationFrame(loop);
    })();
  }

  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start);
})();
