/* PMC 2670 — Firefight : tooltips.

   A Battle Honour or a Battle Trauma is a name and a rule, and the name on its
   own tells you nothing: "Rain of Fire" and "Suicidal Tendencies" both need the
   sentence behind them before you can play around either. The browser's own
   `title` attribute carries that sentence, but it takes a second to appear, it
   cannot be styled, and on a phone it never appears at all — which is where
   most of this game is played.

   So: one floating panel, shared by every screen. An element asks for it with
   `data-tip` (the body) and optionally `data-tip-title` (the heading). It opens
   on hover or keyboard focus, and on a tap where there is no hover to be had —
   and closes on the next tap, on Escape, on a scroll, or when the pointer
   leaves. Nothing else on the page has to know it exists.
*/
(function (root) {
  'use strict';

  var doc = root.document;
  if (!doc) return;

  var panel = null, open = null, hideTimer = null;
  // a device without hover has to be tapped, so the first tap opens the tip
  var canHover = !!(root.matchMedia && root.matchMedia('(hover: hover)').matches);

  function ensure() {
    if (panel) return panel;
    panel = doc.createElement('div');
    panel.className = 'tip';
    panel.setAttribute('role', 'tooltip');
    panel.hidden = true;
    doc.body.appendChild(panel);
    return panel;
  }

  function esc(t) {
    return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  /* Put the panel beside what it explains: above it if there is room, below if
     there is not, and always inside the window rather than half off the edge. */
  function place(el) {
    var r = el.getBoundingClientRect();
    var p = panel.getBoundingClientRect();
    var pad = 8;
    var x = Math.round(r.left + r.width / 2 - p.width / 2);
    x = Math.max(pad, Math.min(x, root.innerWidth - p.width - pad));
    var above = r.top - p.height - 10;
    var below = r.bottom + 10;
    var y = above >= pad ? above : below;
    if (y + p.height > root.innerHeight - pad) y = Math.max(pad, root.innerHeight - p.height - pad);
    panel.style.left = x + 'px';
    panel.style.top = Math.round(y) + 'px';
    panel.classList.toggle('tip-below', y === below);
  }

  function show(el) {
    var body = el.getAttribute('data-tip');
    if (!body) return;
    clearTimeout(hideTimer);
    ensure();
    var head = el.getAttribute('data-tip-title');
    /* Several honours at once come through as one line each, and each line is
       "Name — what it does": the name is set apart so a list of three can be
       read at a glance rather than as a paragraph. */
    var lines = body.split('\n').map(function (line) {
      var cut = line.indexOf(' \u2014 ');
      return cut > 0
        ? '<span><i>' + esc(line.slice(0, cut)) + '</i>' + esc(line.slice(cut + 3)) + '</span>'
        : '<span>' + esc(line) + '</span>';
    }).join('');
    panel.innerHTML = (head ? '<b>' + esc(head) + '</b>' : '') + lines;
    panel.hidden = false;
    panel.classList.remove('tip-below');
    // measure once it is laid out, then put it where it fits
    place(el);
    panel.classList.add('on');
    open = el;
  }

  function hide() {
    if (!panel) return;
    panel.classList.remove('on');
    open = null;
    // let the fade finish before it stops taking part in layout
    hideTimer = setTimeout(function () { if (!open) panel.hidden = true; }, 140);
  }

  function target(e) {
    var el = e.target;
    return el && el.closest ? el.closest('[data-tip]') : null;
  }

  doc.addEventListener('mouseover', function (e) {
    if (!canHover) return;
    var el = target(e);
    if (el && el !== open) show(el);
  });
  doc.addEventListener('mouseout', function (e) {
    if (!canHover || !open) return;
    var el = target(e);
    if (el === open && !(e.relatedTarget && el.contains(e.relatedTarget))) hide();
  });
  doc.addEventListener('focusin', function (e) {
    var el = target(e);
    if (el) show(el);
  });
  doc.addEventListener('focusout', function () { if (open) hide(); });

  /* A tip that sits inside a button belongs to the button: tapping a unit's
     name in the roster has to pick the unit, not open a note about it. Only a
     tip standing on its own swallows the tap. */
  function standalone(el) {
    var c = el.closest('button, a, input, select, label, [data-pick], [data-act], [data-do]');
    return !c;
  }

  /* On a touch screen the tip is the point of the tap, so it opens there and
     the tap goes no further — a second tap on the same chip closes it again. */
  doc.addEventListener('click', function (e) {
    var el = target(e);
    if (!el) { if (open) hide(); return; }
    if (canHover || !standalone(el)) return;
    e.preventDefault();
    e.stopPropagation();
    if (el === open) hide(); else show(el);
  }, true);

  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape' && open) hide(); });
  root.addEventListener('scroll', function () { if (open) hide(); }, true);
  root.addEventListener('resize', function () { if (open) hide(); });

  /* The markup helper every screen uses, so a chip is written the same way
     wherever it appears: `<span class="chip" ' + PMCTips.attr(h.name, h.text) + '>` */
  function attr(head, body) {
    if (!body) return '';
    return 'data-tip="' + esc(body) + '"' +
      (head ? ' data-tip-title="' + esc(head) + '"' : '') + ' tabindex="0"';
  }
  // the same without the tab stop, for a tip inside something already focusable
  function quiet(head, body) {
    return body ? attr(head, body).replace(' tabindex="0"', '') : '';
  }

  root.PMCTips = { attr: attr, quiet: quiet, show: show, hide: hide, open: function () { return open; } };
})(window);
