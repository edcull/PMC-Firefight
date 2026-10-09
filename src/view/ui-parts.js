/* PMC 2670 — Firefight : the small pieces of markup the screens share.

   Every screen is written as a string of HTML, and a few pieces of it turn up
   on several: a force's colours as a chip, the swatches popped up to change
   them, the armies a force can be, a unit to pick from a list, a rule as a tag
   with what it does in its tip, the count at each Tier against its limits. Each
   is written here once, so it looks and behaves the same wherever it appears,
   and a change to one is made in one place. Loaded by both pages (the game and
   the unit viewer), ahead of every screen that uses it. */
(function (root) {
  'use strict';

  function esc(t) { return root.PMC.esc(t); }   // the shared one, in the rules
  function colours() { return (root.PMCIso && root.PMCIso.COLOURS) || {}; }
  function colourKeys() { return (root.PMCIso && root.PMCIso.COLOUR_KEYS) || Object.keys(colours()); }

  /* ---------- a force's colours ---------- */
  // the colours as a swatch paints them: light, mid and dark, corner to corner
  function fill(c) {
    return 'linear-gradient(135deg,' + c.light + ' 0 38%,' + c.mid + ' 38% 74%,' + c.dark + ' 74%)';
  }
  // the face of a swatch button, inside it
  function face(c) { return '<span style="background:' + fill(c) + '"></span>'; }
  // a swatch to pick: `attrs` the button's own (class, data-…, title)
  function swatch(attrs, c) { return '<button ' + attrs + '>' + face(c) + '</button>'; }
  // a force's colours on a lobby line, as a chip (blank when it has none yet)
  function chip(key) {
    var c = colours()[key];
    return '<span class="olob-chip"' + (c ? ' style="background:' + fill(c) + '"' : '') + '></span>';
  }
  // the chip as a button that opens the colours by it: `attrs` its data-… (and aria-label)
  function chipButton(attrs, chipHTML, open, title) {
    return '<button type="button" class="olob-colour" ' + attrs + ' aria-expanded="' + !!open + '" title="' + esc(title) + '">' + chipHTML + '</button>';
  }
  // ...or the chip only, for colours this screen cannot change
  function chipStill(chipHTML, title) {
    return '<span class="olob-colour still"' + (title == null ? '' : ' title="' + esc(title) + '"') + '>' + chipHTML + '</span>';
  }
  /* The colours popped up by a chip (the campaign lobby, a new campaign's
     forces, the skirmish set-up, a network game's room): a swatch each, the
     one worn lit. `attrs` names the pop-up; `each(k)` says how each colour is
     held — { attrs: its data-…, note: what its title adds, off: another force
     wears it (greyed out), ai: an AI force wears it (to be taken from it) }. */
  function colourPop(attrs, cur, each) {
    var CO = colours(), cc = CO[cur];
    return '<div class="found-pop olob-pop" ' + attrs + '><label>Colours' + (cc ? ' — ' + esc(cc.name) : '') + '</label><div class="csw">' +
      colourKeys().map(function (k) {
        var s = each(k);
        return swatch('type="button" class="' + (k === cur ? 'on' : '') + (s.ai ? ' olob-aicol' : '') + '" ' + s.attrs + (s.off ? ' disabled' : '') +
          ' title="' + esc(CO[k].name + (s.note || '')) + '"', CO[k]);
      }).join('') + '</div></div>';
  }

  /* ---------- the armies ---------- */
  var ARMIES = ['pmc', 'rebel', 'bugs', 'xeno'];
  // the short words a lobby line uses (the rules' own names are longer: R.FACTIONS)
  var ARMY_NAMES = { pmc: 'PMC', rebel: 'Rebel', bugs: 'Bugs', xeno: 'Xenotripods', random: 'Random' };
  /* The army picker on a force's line: `want` selected, and for an AI force a
     Random choice first, `random` its value. */
  function armySelect(attrs, want, random) {
    var opt = function (v, t) { return '<option value="' + v + '"' + (v === want ? ' selected' : '') + '>' + t + '</option>'; };
    return '<select ' + attrs + '>' + (random == null ? '' : opt(random, 'Random')) +
      ARMIES.map(function (f) { return opt(f, ARMY_NAMES[f]); }).join('') + '</select>';
  }
  // ...and the army read out, where it is not this player's to change
  function armyStill(f) { return '<span class="olob-army">' + esc(ARMY_NAMES[f] || '') + '</span>'; }
  /* The name a force is given from its colours and kind ("Jade swarm"), and
     whether a name is one of those — such a name follows them when either
     changes; one the player typed stays. */
  var FORCE_NOUN = { pmc: 'company', rebel: 'insurgents', bugs: 'swarm', xeno: 'tribe' };
  function forceName(colour, faction, keys, current, avoid) {
    // a force rolled to a personality (R.rollArmy) goes by one of its names instead: Kessler Combine
    var pn = personaName(keys, current, avoid);
    if (pn) return pn;
    var c = colours()[colour];
    return (c ? c.name + ' ' : '') + FORCE_NOUN[faction];
  }
  /* The names a personality's companies go by (campaign.js ARCHETYPES `names`):
     the one it has kept if it is one of them, else one of them not taken by the
     other side. Null for a force rolled to no personality. */
  function personaNames(keys) {
    var C = root.PMCCamp, st = keys && keys.style;
    if (!st || !C || !C.archetypesFor) return null;
    var a = ['pmc', 'rebel', 'bugs', 'xeno'].map(function (f) {
      return C.archetypesFor(f).filter(function (x) { return x.id === st; })[0];
    }).filter(Boolean)[0];
    return a && a.names && a.names.length ? a.names : null;
  }
  function personaName(keys, current, avoid) {
    var names = personaNames(keys);
    if (!names) return null;
    if (current && names.indexOf(current) >= 0 && current !== avoid) return current;
    var free = names.filter(function (n) { return n !== avoid; });
    return (free.length ? free : names)[Math.floor(Math.random() * (free.length || names.length))];
  }
  // one of any personality's names: made up, not typed, so it follows the force
  function isPersonaName(n) {
    var C = root.PMCCamp;
    if (!n || !C || !C.archetypesFor) return false;
    return ['pmc', 'rebel', 'bugs', 'xeno'].some(function (f) {
      return C.archetypesFor(f).some(function (a) { return (a.names || []).indexOf(n) >= 0; });
    });
  }
  function isForceName(n) {
    if (isPersonaName(n)) return true;
    var CO = colours();
    return Object.keys(CO).some(function (k) {
      return ARMIES.some(function (f) { return n === CO[k].name + ' ' + FORCE_NOUN[f]; });
    });
  }

  /* ---------- rules and units ---------- */
  // the tooltip attributes, from tips.js; a page without it falls back to `title`
  function tip(head, body) {
    return root.PMCTips ? root.PMCTips.attr(head, body)
      : 'title="' + esc((head ? head + ' — ' : '') + body) + '"';
  }
  // a rule, a doctrine, an honour or a trauma as a tag, what it does in its tip (`cls`: good, bad)
  function mark(x, cls) {
    return '<span class="mk' + (cls ? ' ' + cls : '') + '" ' + tip(x.name, x.text || '') + '>' + esc(x.name) + '</span>';
  }
  // a unit's special rules, a tag each, as a picked unit's card shows them
  function ruleMarks(rules) {
    var TXT = root.PMCRuleText;
    return (rules || []).length ? '<div class="fcard-rules">' + rules.map(function (r) {
      return mark(TXT ? TXT.describe(r) : { name: r, text: '' });
    }).join('') + '</div>' : '';
  }
  /* A unit to pick from a list (the muster's, founding's, recruiting's, a
     contract's): its Tier, its name and a line under it, and down the right
     what it costs or is (`st`, left off when null). `attrs` are the button's
     own, its class included; `name` and `small` come written. */
  function unitRow(attrs, tier, name, small, st) {
    return '<button ' + attrs + '><span class="t">' + root.PMC.ROMAN[tier] + '</span><span>' + name + '<small>' + small + '</small></span>' +
      (st == null ? '' : '<span class="st">' + st + '</span>') + '</button>';
  }
  /* The free units (Penal troops, Armed civilians, Tiny bug swarms, Primitive Epsilon
     troopers) carry a gift tag next to their name wherever they are recruited. */
  var GIFT = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round">' +
    '<path d="M4 12v9h16v-9M2.5 8h19v4h-19zM12 8v13M12 8C10 3.5 6.5 4 7 6s3 2 5 2zM12 8c2-4.5 5.5-4 5-2s-3 2-5 2z"/></svg>';
  function freeMark(key) {
    var why = root.PMCCamp && root.PMCCamp.freeUnit ? root.PMCCamp.freeUnit(key) : null;
    return why ? '<span class="freemark" title="' + esc(why) + '" aria-label="' + esc(why) + '">' + GIFT + '</span>' : '';
  }
  /* The count at each Tier against what the composition allows, on one line:
     I 1/0-8 · II 0/0-8 · … — `limits` from R.compFor, multiplied up by the
     Priority Level `pl` (1 when they come already worked out). */
  function limitsLine(limits, counts, pl) {
    pl = pl || 1;
    return [1, 2, 3, 4, 5].map(function (t) {
      var lo = limits[t - 1][0] * pl, hi = limits[t - 1][1] === 99 ? 99 : limits[t - 1][1] * pl;
      if (hi === 0) return null;
      var n = counts[t] || 0, short = n < lo || n > hi;
      return root.PMC.ROMAN[t] + ' <b' + (short ? ' class="short"' : '') + '>' + n + '/' + (hi === 99 ? lo + '+' : lo + '-' + hi) + '</b>';
    }).filter(Boolean).join(' · ');
  }

  /* ---------- the screens' frame ---------- */
  // the Back at the top left of a full screen (`attrs`: what it does)
  function backButton(attrs) {
    return '<button type="button" class="camp-back" ' + attrs + ' aria-label="Back"><span class="bk-ar" aria-hidden="true">←</span><span class="bk-w"> Back</span></button>';
  }

  /* A vehicle's propulsion and its crew or Drone Control, as icons (the
     campaign's founding cards and the skirmish muster's). */
  var SVG = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>'; };
  var HULL = '<path d="M3 12h18v-2.5L18 6H8L5 9.5H3z"/>';
  var DRIVE_ICON = {
    none: SVG('<path d="M3 14h18v-3l-3-4H8l-3 4H3z"/><path d="M3 14v3h18v-3"/>'),
    wheeled: SVG(HULL + '<circle cx="7.5" cy="16.5" r="2.5"/><circle cx="16.5" cy="16.5" r="2.5"/>'),
    tracked: SVG('<path d="M5 9h14l-2-3H7z"/><rect x="2.5" y="11" width="19" height="7.5" rx="3.75"/><circle cx="7" cy="14.75" r="1.3"/><circle cx="12" cy="14.75" r="1.3"/><circle cx="17" cy="14.75" r="1.3"/>'),
    grav: SVG(HULL + '<path d="M6 15.5h12M8 18.5h8M10.5 21.5h3"/>'),
    hover: SVG(HULL + '<path d="M3 13.5h18l-2.5 3.5h-13z"/><path d="M7 20.5l-1 1M12 20v1.5M17 20.5l1 1"/>'),
    walker: SVG('<path d="M5 6h14v5H5z"/><path d="M8 11l-2.5 5 2.5 5.5M16 11l2.5 5-2.5 5.5"/>')
  };
  var CREW_ICON = SVG('<circle cx="12" cy="8" r="3.6"/><path d="M8.6 6.6c.6-2 1.8-3 3.4-3s2.8 1 3.4 3"/><path d="M4.5 21c0-4 3.4-6.8 7.5-6.8s7.5 2.8 7.5 6.8"/>');
  var DRONE_ICON = SVG('<rect x="9" y="10" width="6" height="4" rx="1"/><path d="M9.5 10.5 6.5 7.5M14.5 10.5l3-3M9.5 13.5l-3 3M14.5 13.5l3 3"/><circle cx="5.5" cy="6.5" r="2.3"/><circle cx="18.5" cy="6.5" r="2.3"/><circle cx="5.5" cy="17.5" r="2.3"/><circle cx="18.5" cy="17.5" r="2.3"/>');
  /* A list opened by its button, fixed so a scrolling list does not cut it off:
     under the button, or over it when there is no room below. */
  function placePop(pop, btn) {
    var r = btn.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight;
    var left = Math.max(12, Math.min(r.right - w, innerWidth - w - 12));
    var top = r.bottom + 6 + h > innerHeight - 8 ? Math.max(8, r.top - 6 - h) : r.bottom + 6;
    pop.style.left = left + 'px'; pop.style.top = top + 'px'; pop.style.visibility = 'visible';
  }

  root.PMCUi = {
    fill: fill, face: face, swatch: swatch, chip: chip, chipButton: chipButton, chipStill: chipStill, colourPop: colourPop,
    ARMIES: ARMIES, ARMY_NAMES: ARMY_NAMES, armySelect: armySelect, armyStill: armyStill,
    FORCE_NOUN: FORCE_NOUN, forceName: forceName, isForceName: isForceName, personaName: personaName, isPersonaName: isPersonaName,
    tip: tip, mark: mark, ruleMarks: ruleMarks, unitRow: unitRow, freeMark: freeMark, limitsLine: limitsLine, backButton: backButton,
    DRIVE_ICON: DRIVE_ICON, CREW_ICON: CREW_ICON, DRONE_ICON: DRONE_ICON, placePop: placePop
  };
})(window);
