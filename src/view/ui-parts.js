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
  function forceName(colour, faction) {
    var c = colours()[colour];
    return (c ? c.name + ' ' : '') + FORCE_NOUN[faction];
  }
  function isForceName(n) {
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

  root.PMCUi = {
    fill: fill, face: face, swatch: swatch, chip: chip, chipButton: chipButton, chipStill: chipStill, colourPop: colourPop,
    ARMIES: ARMIES, ARMY_NAMES: ARMY_NAMES, armySelect: armySelect, armyStill: armyStill,
    FORCE_NOUN: FORCE_NOUN, forceName: forceName, isForceName: isForceName,
    tip: tip, mark: mark, ruleMarks: ruleMarks, unitRow: unitRow, limitsLine: limitsLine, backButton: backButton
  };
})(window);
