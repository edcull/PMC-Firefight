/* PMC 2670 — Firefight : the actions on offer (the standard six, the specials' slots and
   their icons), the combat results feed, and the phone's tabs.

   Installed by game.js with the board (B): what it borrows of the game —
   functions and fixed values bound here, and what changes as the game runs
   (the state, the engine's queries, the seats…) read through B as it is
   now. It hands back what the rest of the game uses of it. */
(function (root) {
  'use strict';
  root.PMCActions = function (B) {
    var isAI = B.isAI, SFX = B.SFX, el = B.el, resQueue = B.resQueue, show = B.show, ui = B.ui;
    // from modules installed after this one: looked up when called
    function render() { return B.render.apply(this, arguments); }
    function scheduleReturn() { return B.scheduleReturn.apply(this, arguments); }

    /* ================= actions ================= */
    var ICONS = {
      enter: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-5 8 5v12z"/><path d="M10 21v-6h4v6"/><path d="M2 14h6M6 12l2 2-2 2"/></svg>',
      exitbld: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9l8-5 8 5v12z"/><path d="M10 21v-6h4v6"/><path d="M16 14h6M20 12l2 2-2 2"/></svg>',
      move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18M3 12h18"/><path d="M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/></svg>',
      fire: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="7"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/></svg>',
      advance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17h7l4-9"/><path d="M14 8h6v6"/><circle cx="18.5" cy="17" r="2.2"/></svg>',
      assault: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20L15 9M9 4l11 11"/><path d="M4 20l1-4 3 3zM20 20l-4-1 3-3z"/></svg>',
      aux: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="6.5" stroke-dasharray="3 3"/><path d="M12 6v3M12 15v3M6 12h3M15 12h3"/></svg>',
      regroup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v5h-5"/></svg>',
      designate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l7 8-7 8-7-8z"/><circle cx="12" cy="12" r="2"/><path d="M12 1v2M12 21v2"/></svg>',
      coordinate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2.4"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="20" r="2"/><path d="M10.4 10.4L6.4 7.4M13.6 10.4l4-3M12 14.4V18"/></svg>',
      drivefirst: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="13" height="7" rx="1.5"/><circle cx="6.5" cy="19" r="1.6"/><circle cx="13" cy="19" r="1.6"/><path d="M13 6h8M18 3l3 3-3 3"/></svg>',
      embark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="13" height="7" rx="1.5"/><circle cx="6.5" cy="19" r="1.6"/><circle cx="13" cy="19" r="1.6"/><path d="M20 4v7M20 11l-2.5-2.5M20 11l2.5-2.5"/></svg>',
      disembark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="13" height="7" rx="1.5"/><circle cx="6.5" cy="19" r="1.6"/><circle cx="13" cy="19" r="1.6"/><path d="M20 11V4M20 4l-2.5 2.5M20 4l2.5 2.5"/></svg>',
      strafe: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2 8h13l4 2-4 2H2z"/><path d="M9 12v4M13 12v4M5 12v4"/></svg>',
      support: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="12" width="12" height="6" rx="1.5"/><circle cx="6.5" cy="19" r="1.5"/><circle cx="12" cy="19" r="1.5"/><path d="M15 10l6-4M17 5l4 1-1 4"/></svg>',
      hack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="7" width="16" height="10" rx="2"/><path d="M8 11l2 1-2 1M12.5 14h3"/><path d="M12 3v4M9 3h6"/></svg>',
      demolish: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20v-6h5v6M12 20v-9h4v9"/><path d="M17 4l3 3-3 3"/><path d="M20 7h-6"/></svg>',
      breach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 20h18"/><path d="M5 20V9h6v11"/><path d="M14 20v-5h5v5"/><circle cx="16.5" cy="7" r="2.5"/><path d="M16.5 4.5V3"/></svg>',
      sabotage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="6" y="9" width="12" height="10" rx="1"/><path d="M12 9V5l3-2"/><path d="M9 13l6 4M15 13l-6 4"/></svg>',
      checkarea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="6"/><path d="M15.5 15.5L21 21"/><path d="M11 8v6M8 11h6"/></svg>',
      wave: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="12" cy="12" r="2.2"/><path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9"/><path d="M4.4 4.4a10.8 10.8 0 000 15.2M19.6 4.4a10.8 10.8 0 010 15.2"/></svg>',
      rush: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L5 14h6l-2 8 8-12h-6z"/></svg>',
      laststand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 10-4-1.7-7-5.6-7-10V6z"/><path d="M12 8v5M12 16h.01"/></svg>',
      detonate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="13" width="9" height="8" rx="1"/><path d="M8.5 13V9"/><path d="M8.5 9l7-4"/><path d="M15 3l2 1-1 2"/><path d="M18 11l1.5-1.5M20 15h2M18 19l1.5 1.5"/></svg>',
      stance: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19h18"/><path d="M6 19l3-5M18 19l-3-5"/><path d="M8 14l9-7"/><path d="M16 5l3 1-1 3"/></svg>',
      empty: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 12h10"/></svg>'
    };
    // marking a target for the fire-support team is designating it by another name
    ICONS.marktarget = ICONS.designate;

    /* The six standard actions, and how many special slots sit beside them. The
       engine owns the list, because the engine is what decides whether any of
       them is available; the icons above are the view's business. */
    var STANDARD = window.PMCEngine.STANDARD;
    var SPECIAL_SLOTS = window.PMCEngine.SPECIAL_SLOTS;




    function pushRes(res) {
      resQueue.push(res);
      if (!ui.resOpen) showNextRes();
    }

    /* On a desktop the results are a running feed down the right-hand rail rather
       than a card to dismiss: nothing waits for a click, and every roll stays on
       screen to be read back. A narrow screen has no room for a rail, so it keeps
       the card — and so does the end of the battle, wherever it is played. */
    function feedHosts() {
      return ['resfeed-list', 'resfeed-m'].map(el).filter(Boolean);
    }
    function feedMode(res) {
      if (!feedHosts().length) return false;
      if (res && res.kind === 'Result') return false;         // the battle is over: say so properly
      return true;
    }

    function pushFeed(res) {
      var html = resHTML(res, true);
      var cls = 'feedcard fresh' + (res.side ? ' side-' + res.side : '');
      feedHosts().forEach(function (host) {
        var card = document.createElement('div');
        card.className = cls;
        card.innerHTML = html;
        host.appendChild(card);
        setTimeout(function () { card.classList.remove('fresh'); }, 300);
        // a rail is not a log: keep the last thirty and let the dock hold the rest
        while (host.children.length > 30) host.removeChild(host.firstChild);
        if (B.state && B.state.cfg.mode === 'demo') feedToNewest(host);   // a demo is watched as it happens
      });
      ui.feedUnread = (ui.feedUnread || 0) + 1;
      markFeedTab();
    }
    /* The feed stacks newest first, at the top, but a scrolled list stays where
       it is as cards land: this brings the newest back into view. (A reversed
       column scrolls with negative offsets; a plain one clamps to its top.) */
    function feedToNewest(host) {
      [host, host && host.parentElement].forEach(function (s) {
        if (s && s.scrollHeight > s.clientHeight) s.scrollTop = -s.scrollHeight;
      });
    }
    /* On a phone the results share the panel with everything else, so the tab
       carries a count of what has landed since it was last looked at. */
    function markFeedTab() {
      var n = el('mtab-n');
      if (!n) return;
      var con = document.querySelector('.console');
      var showing = con && con.getAttribute('data-mtab') === 'res';
      if (showing) ui.feedUnread = 0;
      n.textContent = ui.feedUnread ? (ui.feedUnread > 9 ? '9+' : ui.feedUnread) : '';
    }
    function setMTab(which) {
      var con = document.querySelector('.console');
      if (!con) return;
      if (which === 'act' && document.body.getAttribute('data-battle') === 'demo') which = 'res';   // a demo has no Actions tab
      con.setAttribute('data-mtab', which);
      document.querySelectorAll('#mtabs .mtab').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-mtab') === which);
      });
      if (which === 'res') { ui.feedUnread = 0; if (B.state && B.state.cfg.mode === 'demo' && el('resfeed-m')) feedToNewest(el('resfeed-m')); }
      markFeedTab();
    }

    function showNextRes() {
      var res = resQueue.shift();
      if (!res) { ui.resOpen = false; ui.currentRes = null; el('resolution').hidden = true; show.pump(); return; }
      if (feedMode(res)) {
        ui.resOpen = true;
        ui.currentRes = res;
        if (res.onShow) res.onShow();
        pushFeed(res);
        if (SFX) {
          if (res.kind === 'Initiative') { SFX.dice(); SFX.chime(); }
          else if (res.dice || res.blocks) SFX.dice();
        }
        clearTimeout(ui.resTimer);
        // straight on to the next one; the card it just wrote stays in the rail
        ui.resTimer = setTimeout(closeRes, 130);
        return;
      }
      ui.resOpen = true;
      ui.currentRes = res;
      if (res.onShow) res.onShow();
      el('res-card').innerHTML = resHTML(res);
      el('resolution').hidden = false;
      el('res-continue').addEventListener('click', closeRes);
      if (SFX) {
        if (res.kind === 'Result') SFX.victory();
        else if (res.kind === 'Initiative') { SFX.dice(); SFX.chime(); }
        else if (res.dice || res.blocks) SFX.dice();
        else SFX.click();
      }
      var chk = el('res-auto');
      if (chk) {
        chk.addEventListener('change', function () {
          ui.autoAdvance = chk.checked;
          try { localStorage.setItem('pmc-autoadv', ui.autoAdvance ? '1' : '0'); } catch (e) { }
          clearTimeout(ui.resTimer);
          if (ui.autoAdvance) armAutoClose(res);
        });
      }
      clearTimeout(ui.resTimer);
      armAutoClose(res);
      el('res-continue').focus();
    }

    // Cards wait for Continue. Only an explicit auto-advance, for OpFor activations,
    // closes them on a timer.
    function armAutoClose(res) {
      if (!ui.autoAdvance) return;
      var actor = res.side || B.state.activeSide;
      if (!isAI(actor) && B.state.cfg.aiSides.length < 2) return;
      var wait = res.kind === 'Assault' ? 3200 : res.kind === 'Initiative' ? 1400 : 2200;
      ui.resTimer = setTimeout(closeRes, wait);
    }

    function closeRes() {
      clearTimeout(ui.resTimer);
      el('resolution').hidden = true;
      ui.resOpen = false;
      var res = ui.currentRes;
      ui.currentRes = null;
      if (res && res.onClose) res.onClose();     // may queue the next step
      if (resQueue.length) showNextRes();
      else { render(); show.pump(); }
      scheduleReturn();
    }

    function chipClass(text) {
      if (/Man down/.test(text)) return 'hitchip kill';
      if (/Get down|Ouch|SP/.test(text)) return 'hitchip sp';
      return 'hitchip';
    }

    function resHTML(res, feed) {
      var h = '<div class="res-top"><span class="res-kind">' + res.kind + '</span><h3>' + res.title + '</h3></div><div class="res-body">';
      if (res.dice) {
        h += '<div class="dice">' + res.dice.map(function (d) {
          return '<div class="die ' + (d.tone || '') + '">' + d.value + '<small>' + d.label + '</small></div>';
        }).join('') + '</div>';
      }
      if (res.blocks) {
        res.blocks.forEach(function (b) {
          h += '<div>';
          if (b.die !== null && b.die !== undefined) {
            var tone = b.die === 9 ? 'crit' : b.die === 0 ? 'fail' : 'd10';
            h += '<div class="dice"><div class="die ' + tone + '">' + b.die + '<small>D10</small></div>' +
              '<div class="res-note" style="flex:1">' + b.head + '</div></div>';
          } else {
            h += '<div class="res-note">' + b.head + '</div>';
          }
          if (b.math) h += '<div class="calc">' + b.math.replace(/→ (\d+ hits?)/, '→ <b>$1</b>') + '</div>';
          if (b.chips.length) h += '<div class="hitrow">' + b.chips.map(function (c) {
            return '<span class="' + chipClass(c) + '">' + c + '</span>';
          }).join('') + '</div>';
          b.banners.forEach(function (bn) {
            h += '<div class="outcome ' + bn.tone + '">' + bn.text + '</div>';
          });
          h += '</div>';
        });
      }
      if (res.note) h += '<div class="res-note">' + res.note + '</div>';
      if (res.calc) h += '<div class="calc">' + res.calc + '</div>';
      if (res.list) {
        h += '<div class="calc">' + res.list.map(function (l) { return l.text; }).join('\n') + '</div>';
      }
      if (res.outcome) h += '<div class="outcome ' + (res.outcome.tone || '') + '">' + res.outcome.text + '</div>';
      if (feed) return h + '</div>';
      var count = res.progress || (resQueue.length ? resQueue.length + ' more' : '');
      h += '</div><div class="res-foot"><button class="start" id="res-continue">Continue</button>' +
        (count ? '<span class="res-count">' + count + '</span>' : '') + '</div>';
      if (B.state.cfg.aiSides.length) {
        h += '<label class="autochk" for="res-auto"><input type="checkbox" id="res-auto"' +
          (ui.autoAdvance ? ' checked' : '') + '> Advance OpFor cards automatically</label>';
      }
      return h;
    }


    return {
      ICONS: ICONS,
      SPECIAL_SLOTS: SPECIAL_SLOTS,
      STANDARD: STANDARD,
      closeRes: closeRes,
      feedHosts: feedHosts,
      pushRes: pushRes,
      setMTab: setMTab
    };
  };
})(window);
