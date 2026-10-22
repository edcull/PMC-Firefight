/* PMC 2670 — Firefight : story mode's screens (docs/story-mode-plan.md, section 5)

   Made once by dossier.js, the first time it is wanted, as the other dossier
   screens are. E is what it needs of dossier.js. The story itself is
   src/story/story.js (where it is, what each choice does); a battle is set up
   by src/story/levers.js and fought on the board as a campaign battle is,
   and its aftermath is the campaign's own. These are the screens around them:

   - a new story: which story, its name, ironman or not; then the campaign's
     own founding screen;
   - the story's node: a chapter's card, a brief, an event and its options, a
     battle's briefing, a debrief, an interlude (with the way to the hub), the
     second half's jobs, the ending;
   - the muster for a story battle: the company's units, picked by hand or for
     the player, for the Tier and Priority Level the story set;
   - the journal: what was chosen and how each battle went, the meters the
     player can see, and (not in ironman) the checkpoints to go back to. */
(function (root) {
  'use strict';
  root.PMCStoryScreens = function (E) {
    var C = E.C, R = E.R, esc = E.esc, ROMAN = E.ROMAN;
    function S() { return root.PMCStory; }
    function L() { return root.PMCStoryLevers; }
    function SC() { return root.PMCScen; }

    // the new-story form's choices, and the muster's picks
    var want = { id: null, ironman: false };
    var muster = null;     // { node, tier, pl, rids: [], role }

    function def() { return E.camp && E.camp.story ? S().get(E.camp.story.id) : null; }
    // (before the story has begun there is nothing to fill the text in from)
    function words(t) { return E.camp && E.camp.story ? S().render(E.camp, t || '') : t || ''; }
    function para(t) { return t ? '<p class="story-text">' + esc(words(t)) + '</p>' : ''; }
    function scenName(id) { var s = SC() && SC().SCENARIOS[id]; return s ? s.name : id; }

    /* ================= a new story ================= */

    function newView() {
      var list = S().list();
      if (!want.id && list.length) want.id = list[0].id;
      var h = '<h2>Story</h2>';
      h += '<div class="olob-name"><label for="story-pick">Story</label><select id="story-pick" class="tin">' + list.map(function (d) {
        return '<option value="' + esc(d.id) + '"' + (d.id === want.id ? ' selected' : '') + '>' + esc(d.name) + '</option>';
      }).join('') + '</select></div>';
      var d = S().get(want.id);
      if (d && d.blurb) h += para(d.blurb);
      h += '<p class="hint">You found your own company, under the campaign’s own rules. The story finds work for it.</p>';
      h += '<div class="field"><div class="opt-list"><label class="opt-row"><input type="checkbox" id="story-ironman"' + (want.ironman ? ' checked' : '') + '>' +
        '<span class="opt-name">Ironman</span></label></div>' +
        '<p class="hint small">One save, written as you go: no going back to a checkpoint, and a battle thrown away counts as a rout. Chosen now, for good.</p></div>';
      h += '<div class="olob-bar"><button class="start" data-go="storynew">Found the company</button></div>';
      h += '<p class="camp-foot"><button class="lnk" data-go="campmenu">← Back</button></p>';
      return h;
    }
    function readNew() {
      var p = document.getElementById('story-pick'), im = document.getElementById('story-ironman');
      if (p) want.id = p.value;
      if (im) want.ironman = !!im.checked;
    }

    /* ================= the story, where it is ================= */

    var GRADE = { decisive: 'Decisive victory', victory: 'Victory', draw: 'Draw', defeat: 'Defeat', rout: 'Rout' };

    /* The meters the company can see, as numbers and words. */
    function meterBar() {
      var d = def(), st = E.camp.story;
      var shown = Object.keys(d._meters).filter(function (k) { return d._meters[k].shown || st.revealed[k]; });
      if (!shown.length) return '';
      return '<div class="story-meters">' + shown.map(function (k) {
        var v = st.meters[k], m = d._meters[k];
        var tone = v >= 2 ? 'good' : v <= -2 ? 'bad' : '';
        return '<span class="story-meter ' + tone + '" title="' + esc(m.name) + '"><small>' + esc(m.name) + '</small><b>' + (v > 0 && m.min < 0 ? '+' : '') + v + '</b></span>';
      }).join('') + '</div>';
    }

    function chapterOf() {
      var d = def(), st = E.camp.story;
      return st.chapter ? d._chapters[st.chapter] : null;
    }

    function foot(extra) {
      return '<p class="camp-foot story-foot">' + (extra || '') +
        '<button class="lnk" data-go="storyjournal">Journal</button>' +
        '<button class="lnk" data-go="hub">The company</button>' +
        '<button class="lnk" data-go="menu">Menu</button></p>';
    }

    function storyView() {
      var d = def(), st = E.camp.story;
      if (!d) return '<h2>Story</h2><p>This story is not in this version of the game.</p>' + foot();
      if (st.ended) return endingView();
      var v = S().view(E.camp), ch = chapterOf();
      if (!v) return '<h2>' + esc(d.name) + '</h2><p>The story has lost its place.</p>' + foot();
      var h = '<h2>' + esc(d.name) + (ch && ch.counts !== false ? ' — ' + esc(ch.title) : '') + '</h2>';
      h += meterBar();
      // a chapter's card, on its first page
      var node = d._nodes[v.id];
      if (node && node._first && ch && !ch.shared) {
        h += '<div class="story-card"><small>' + (ch.counts === false ? '' : 'Chapter ' + st.chapterNo + (ch.half === 2 ? ' · Fault Lines' : ' · The Contract')) + '</small>' +
          '<b>' + esc(ch.title) + '</b>' + (ch.intro ? para(ch.intro) : '') + '</div>';
      }
      if (v.type === 'brief') h += para(v.text) + '<div class="story-go"><button class="start" data-go="storyon">Go on</button></div>';
      else if (v.type === 'event') h += eventView(v);
      else if (v.type === 'battle') h += battleView(v);
      else if (v.type === 'debrief') {
        h += '<div class="story-grade ' + (st.lastGrade === 'decisive' || st.lastGrade === 'victory' ? 'good' : 'bad') + '">' + esc(GRADE[st.lastGrade] || '') + '</div>';
        h += para(v.text) + '<div class="story-go"><button class="start" data-go="storyon">Go on</button></div>';
      } else if (v.type === 'interlude') {
        h += para(v.text);
        h += sideView(v);
        h += '<p class="hint">Between chapters: recruit, promote and spend at the company before you go on.</p>';
        h += '<div class="story-go"><button class="lnk" data-go="hub">To the company</button><button class="start" data-go="storyon">Go on</button></div>';
      } else if (v.type === 'pool') h += poolView(v);
      return h + foot();
    }

    /* An interlude's side contracts: each a small job, its pay, what taking it
       costs and what passing it up does; one can be taken. */
    function sideView(v) {
      if (!v.side || !v.side.length) return '';
      var d = def(), words = function (list) {
        return (list || []).filter(function (e) { return e.meter && !e.if; }).map(function (e) {
          var m = d._meters[e.meter];
          return (m ? m.name : e.meter) + ' ' + (e.add > 0 ? '+' : '') + e.add;
        }).concat((list || []).some(function (e) { return e.if && e.meter === 'hive'; }) && E.camp.story.chapterNo >= 5 ? ['time: Hive Growth +1'] : []).join(', ');
      };
      var h = '<div class="story-side"><h3>Side contracts</h3><p class="hint">' + (v.side.length > 1 ? 'Work on offer between chapters. You can take one.' : 'Work on offer between chapters.') + '</p>';
      v.side.forEach(function (o) {
        var cost = words(o.cost), passed = words(o.passed), sides = def().sides || {};
        h += '<div class="story-job"><b>' + esc(o.title) + '</b><small>' + esc(o.pay + ' kUC') +
          (o.against && sides[o.against] ? ' \u00b7 against ' + esc(sides[o.against].name) : '') + '</small>' + para(o.text) +
          (o.catchUp ? '<small class="good">Offered to help the company catch up: it costs no time.</small>' : cost ? '<small>Taking it: ' + esc(cost) + '</small>' : '') +
          (passed ? '<small class="warn">Passed up: ' + esc(passed) + '</small>' : '') +
          '<button class="lnk" data-go="storyside" data-j="' + esc(o.id) + '">Take the job</button></div>';
      });
      return h + '</div>';
    }

    function eventView(v) {
      var h = '<div class="story-event">' + (v.title ? '<h3>' + esc(v.title) + '</h3>' : '') + para(v.text) + '<div class="story-opts">';
      v.options.forEach(function (o) {
        var cost = o.cost ? Object.keys(o.cost).map(function (k) {
          var m = def()._meters[k];
          return o.cost[k] + ' ' + (k === 'kUC' ? 'kUC' : m ? m.name : k);
        }).join(', ') : '';
        h += '<button class="story-opt' + (o.extreme ? ' extreme' : '') + '"' + (o.ok ? ' data-go="storyopt" data-o="' + esc(o.id) + '"' : ' disabled') + '>' +
          '<b>' + esc(words(o.text)) + '</b>' +
          (cost ? '<small>Costs ' + esc(cost) + '</small>' : '') +
          (o.extreme ? '<small class="warn">This crosses a line.</small>' : '') +
          (!o.ok && o.why ? '<small class="why">' + esc(o.why) + '</small>' : '') + '</button>';
      });
      return h + '</div></div>';
    }

    /* A battle's briefing: what and where, how big, the enemy as far as you know them. */
    function battleView(v) {
      var spec = v.battle, co = E.camp.companies.A, d = def();
      var tier = L().tierFor(co, { tier: spec.tier, minTier: spec.minTier, maxTier: spec.maxTier });
      var pl = L().plFor(co, tier, spec.levers.pl || spec.pl);
      var side = spec.enemy && d.sides && d.sides[spec.enemy.side] || {};
      /* The mission first, as a story tells it: its name, where it is, the briefing.
         Then what it is under the rules: the book's scenario, how big, against whom. */
      var maps = (root.PMCStoryMaps && root.PMCStoryMaps[d.id]) || {}, map = spec.map && maps[spec.map];
      var compound = SC() && SC().SCENARIOS[spec.scenario] && SC().SCENARIOS[spec.scenario].compound;
      var h = '<div class="story-battle"><h3>' + esc(spec.name || scenName(spec.scenario)) + '</h3>';
      if (map && !compound) h += '<p class="story-where">' + esc(map.name) + '</p>';
      if (spec.text) h += para(spec.text);
      var win = SC() && SC().SCENARIOS[spec.scenario] && SC().SCENARIOS[spec.scenario].win;
      h += '<div class="story-rules"><small>' + esc(scenName(spec.scenario)) + ' \u00b7 Battle Tier ' + ROMAN[tier] + ', Priority Level ' + pl +
        (side.name ? ' \u00b7 against ' + esc(side.name) : '') + '</small>' + (win ? '<small class="win">' + esc(win) + '</small>' : '') + '</div>';
      var notes = [];
      if (spec.levers.strikes) notes.push('Strikes before the first turn (' + spec.levers.strikes + ').');
      if (spec.levers.suppressOwn) notes.push('Some of your squads start the battle pinned.');
      if (spec.levers.allies) notes.push('Allies fight beside you.');
      if (spec.variant && spec.variant.target) notes.push('The target: ' + spec.variant.target + (spec.variant.capture ? ', to be taken alive.' : '.'));
      if (spec.variant && spec.variant.ambush) notes.push(spec.variant.ambush === 'player' ? 'You spring the ambush.' : 'You are walking into an ambush.');
      if (notes.length) h += '<ul class="story-notes">' + notes.map(function (n) { return '<li>' + esc(n) + '</li>'; }).join('') + '</ul>';
      /* The enemy, as much as the company knows: word of them, an outline, or every unit. */
      var f = L().buildForce(spec.enemy, { campaign: E.camp, tier: tier, pl: pl, allowance: L().allowance(co), readiness: spec.levers.readiness || 0 });
      var known = L().describeForce(f, S().intel(E.camp, spec), side.faction || (spec.enemy && spec.enemy.faction));
      h += '<div class="story-enemy intel-' + known.level + '"><small>The enemy, as you know them</small><p>' + esc(known.word) + '</p>' +
        (known.items.length ? '<ul>' + known.items.map(function (it) {
          return '<li>' + esc(it.name) + (it.tier ? ' <span class="ct">' + ROMAN[it.tier] + '</span>' : '') + '</li>';
        }).join('') + '</ul>' : '') +
        (known.level < 2 ? '<small class="hint">Intel, the locals and the right questions tell you more.</small>' : '') + '</div>';
      h += '<div class="story-go"><button class="start" data-go="storymuster">Choose your force</button></div></div>';
      return h;
    }

    function poolView(v) {
      var d = def(), h = '<div class="story-event"><h3>The next job</h3><p class="story-text">Two jobs, and only time for one. The one you leave will not wait.</p><div class="story-opts">';
      v.options.forEach(function (o) {
        var ch = d._chapters[o.id], t = d.threads[o.thread];
        h += '<button class="story-opt" data-go="storyopt" data-o="' + esc(o.id) + '"><b>' + esc(ch.title) + '</b><small>' + esc(t ? t.name : '') + '</small></button>';
      });
      return h + '</div></div>';
    }

    /* ================= the muster ================= */

    function beginMuster() {
      var spec = S().battleSpec(E.camp), co = E.camp.companies.A;
      var tier = L().tierFor(co, { tier: spec.tier, minTier: spec.minTier, maxTier: spec.maxTier });
      var pl = L().plFor(co, tier, spec.levers.pl || spec.pl);
      var picks = C.pickForce(co, tier, pl, null, { scenario: spec.scenario });
      muster = { node: spec.node, tier: tier, pl: pl, rids: picks.map(function (e) { return e.rid; }), role: 'A' };
    }
    function picked() {
      var co = E.camp.companies.A;
      return muster.rids.map(function (r) { return C.byRid(co, r); }).filter(Boolean);
    }
    function legal() {
      var co = E.camp.companies.A;
      return R.checkArmy(picked().map(function (e) { return R.entryPick(e); }), muster.tier, muster.pl, co.doctrines || [], null);
    }
    function musterView() {
      if (!muster || muster.node !== E.camp.story.node) beginMuster();
      var co = E.camp.companies.A, spec = S().battleSpec(E.camp);
      var h = '<h2>Your force — ' + esc(scenName(spec.scenario)) + '</h2>';
      h += '<p>Battle Tier ' + ROMAN[muster.tier] + ', Priority Level ' + muster.pl + ': ' + (R.COMPOSITION[muster.tier].points * muster.pl) + ' composition points.</p>';
      var role = spec.levers.role || spec.role;
      if (role === 'choose') {
        h += '<div class="segs story-role">' + [['A', 'Attack'], ['B', 'Defend']].map(function (r) {
          return '<button class="lnk' + (muster.role === r[0] ? ' on' : '') + '" data-go="storyrole" data-r="' + r[0] + '">' + r[1] + '</button>';
        }).join('') + '</div>';
      }
      // where the battle lets you choose it: the edge you come in from (the map laid the other way about)
      if (spec.levers.edge === 'choose' && spec.map) {
        h += '<p class="hint">Come in from:</p><div class="segs story-edge">' + [['west', 'The west edge'], ['east', 'The east edge']].map(function (r) {
          return '<button class="lnk' + ((muster.edge || 'west') === r[0] ? ' on' : '') + '" data-go="storyedge" data-e="' + r[0] + '">' + r[1] + '</button>';
        }).join('') + '</div>';
      }
      var res = legal();
      h += '<div class="story-roster">' + co.roster.map(function (e) {
        var p = R.profile(e.key), on = muster.rids.indexOf(e.rid) >= 0, resting = e.restUntil > 0;
        return '<button class="story-unit' + (on ? ' on' : '') + '"' + (resting ? ' disabled' : ' data-go="storypick" data-rid="' + esc(e.rid) + '"') + '>' +
          '<span class="ct">' + ROMAN[p ? p.tier : 1] + '</span> ' + esc(e.name) + (resting ? ' <small>resting</small>' : '') + '</button>';
      }).join('') + '</div>';
      h += res.ok ? '<p class="hint">A legal army.</p>' : '<p class="warn">' + esc((res.faults || res.errors || ['Not a legal army.']).join(' ')) + '</p>';
      h += '<div class="story-go"><button class="lnk" data-go="storyauto">Pick for me</button>' +
        '<button class="start" data-go="storyfight"' + (res.ok ? '' : ' disabled') + '>To battle</button></div>';
      h += '<p class="camp-foot"><button class="lnk" data-go="story">← Back</button></p>';
      return h;
    }

    /* The battle fought as a campaign battle is: its result comes back through
       the dossier (onFinish), the story moves on, and the aftermath is the
       campaign's own. */
    function fight() {
      var co = E.camp.companies.A, picks = picked();
      var cfg = L().toCfg(E.camp, { picks: picks, role: muster.role, edge: muster.edge || 'west', tier: muster.tier, pl: muster.pl, options: E.camp.options || {} });
      cfg.colourA = E.colourOf(co);
      cfg.campLid = root.PMC_CAMPAIGN && root.PMC_CAMPAIGN.lid ? root.PMC_CAMPAIGN.lid() : null;
      cfg.track = !!E.camp.debugTrack;
      E.camp.pending = {
        tier: cfg.tier, pl: cfg.pl, scenario: cfg.scenario, site: null, story: cfg.story.node,
        A: picks.map(function (e) { return e.rid; }), B: [], drugged: []
      };
      E.save();
      muster = null;
      E.close();
      root.PMC_NEWGAME(cfg);
    }

    /* ================= the journal ================= */

    function journalView() {
      var d = def(), st = E.camp.story;
      var h = '<h2>Journal — ' + esc(d.name) + '</h2>';
      if (st.ironman) h += '<p class="story-badge">Ironman</p>';
      // the meters the company can see, with how they went
      var shown = Object.keys(d._meters).filter(function (k) { return d._meters[k].shown || st.revealed[k] || st.ended; });
      h += '<div class="story-hist">' + shown.map(function (k) {
        return '<div><b>' + esc(d._meters[k].name) + '</b> ' + (st.history[k] || []).map(function (x) { return x.v; }).join(' → ') + '</div>';
      }).join('') + '</div>';
      // what is known, told as prose
      var facts = Object.keys(st.flags).filter(function (f) { return d.flagText && d.flagText[f]; }).map(function (f) { return d.flagText[f]; });
      if (facts.length) h += '<ul class="story-facts">' + facts.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul>';
      // chapter by chapter: each choice and each battle
      var lines = [], lastCh = null;
      st.journal.forEach(function (j) {
        var ch = d._chapters[j.chapter];
        if (j.chapter !== lastCh && ch && !ch.shared) { lines.push('<h3>' + esc(ch.title) + '</h3>'); lastCh = j.chapter; }
        var n = d._nodes[j.node];
        if (j.choice && n) {
          var o = (n.options || []).filter(function (x) { return x.id === j.choice; })[0];
          var label = o ? o.text : d._chapters[j.choice] ? d._chapters[j.choice].title : j.choice;
          lines.push('<p>' + esc(n.title || 'The next job') + ': <i>' + esc(words(label)) + '</i></p>');
        }
        // a side contract: taken, and how it went
        var sj = j.side ? (d.side.jobs || []).filter(function (x) { return x.id === j.side; })[0] : null;
        if (sj) lines.push('<p>Side contract: <i>' + esc(sj.title) + '</i></p>');
        if (j.grade) lines.push('<p>' + esc(GRADE[j.grade]) + '.</p>');
        if (j.skipped) lines.push('<p>No battle.</p>');
        (j.effects || []).forEach(function (e) { if (e.journal) lines.push('<p class="hint">' + esc(e.journal) + '</p>'); });
      });
      h += '<div class="story-journal">' + lines.join('') + '</div>';
      // the checkpoints to go back to
      if (!st.ironman && st.checkpoints.length) {
        h += '<h3>Go back</h3><div class="story-cps">' + st.checkpoints.map(function (cp, i) {
          var ch = d._chapters[cp.chapter], n = d._nodes[cp.node];
          return '<button class="lnk" data-go="storyrewind" data-i="' + i + '">' + esc((ch ? ch.title : cp.chapter) + (cp.kind === 'node' && n && n.title ? ' — ' + n.title : '')) + '</button>';
        }).join('') + '</div>';
      }
      h += '<p class="camp-foot"><button class="lnk" data-go="story">← Back</button></p>';
      return h;
    }

    /* ================= the ending ================= */

    function endingView() {
      var d = def(), st = E.camp.story, co = E.camp.companies.A;
      var en = (d.endings || []).filter(function (x) { return x.id === st.ended; })[0] || { title: 'The end' };
      var h = '<h2>' + esc(d.name) + ' — ' + esc(en.title || en.id) + '</h2>';
      if (st.ironman) h += '<p class="story-badge">Ironman</p>';
      h += '<div class="story-card"><b>' + esc(en.title || en.id) + '</b>' + para(en.text || '') + '</div>';
      // the epilogue: what became of the moon and its people, and who stayed with the company
      var ep = S().epilogue(E.camp);
      if (ep.lines.length) h += '<div class="story-epilogue">' + ep.lines.map(para).join('') + '</div>';
      if (ep.stayed.length) {
        h += '<h3>Who stayed</h3><ul class="story-stayed">' + ep.stayed.map(function (x) {
          return '<li><b>' + esc(x.name) + '</b> ' + esc([x.first ? 'on Kessler\u2019s Reach from the first day' : '', x.honours ? x.honours + (x.honours === 1 ? ' honour' : ' honours') : ''].filter(Boolean).join(', ')) + '</li>';
        }).join('') + '</ul>';
      }
      // every meter, hidden or not, now the story is over
      h += '<div class="story-hist">' + Object.keys(d._meters).map(function (k) {
        return '<div><b>' + esc(d._meters[k].name) + '</b> ' + (st.history[k] || []).map(function (x) { return x.v; }).join(' → ') + '</div>';
      }).join('') + '</div>';
      var rec = co.record || {};
      h += '<p>' + esc(co.name) + ': ' + (rec.battles || 0) + ((rec.battles || 0) === 1 ? ' battle, ' : ' battles, ') + (rec.wins || 0) + ' won, ' + (rec.losses || 0) + ' lost.</p>';
      if ((co.memorial || []).length) h += '<h3>Roll of honour</h3>' + E.memorialList(co);
      h += foot();
      return h;
    }

    /* ================= the clicks ================= */

    // what follows a step on: a broken company ends the story at once
    function after() {
      if (E.camp.story && !E.camp.story.ended && S().broken(E.camp)) S().breakCompany(E.camp);
      E.save(); E.view = 'story'; E.render();
    }

    function act(go, t) {
      switch (go) {
        case 'storynew':
          readNew();
          E.beginStory(want.id, want.ironman);
          return true;
        case 'story': E.view = 'story'; E.render(); return true;
        case 'storyon': S().proceed(E.camp); after(); return true;
        case 'storyopt': S().choose(E.camp, t.getAttribute('data-o')); after(); return true;
        case 'storyside': S().takeSide(E.camp, t.getAttribute('data-j')); after(); return true;
        case 'storymuster': muster = null; E.view = 'storymuster'; E.render(); return true;
        case 'storypick': {
          var rid = t.getAttribute('data-rid'), i = muster.rids.indexOf(rid);
          if (i >= 0) muster.rids.splice(i, 1); else muster.rids.push(rid);
          E.render(); return true;
        }
        case 'storyauto': beginMuster(); E.render(); return true;
        case 'storyrole': muster.role = t.getAttribute('data-r') === 'B' ? 'B' : 'A'; E.render(); return true;
        case 'storyedge': muster.edge = t.getAttribute('data-e') === 'east' ? 'east' : 'west'; E.render(); return true;
        case 'storyfight': if (legal().ok) fight(); return true;
        case 'storyjournal': E.view = 'storyjournal'; E.render(); return true;
        case 'storyrewind':
          E.ask({ kind: 'confirm', title: 'Go back?', text: 'The story and the company go back to how they were then: the dead, the kUC and the EXP with them.',
            okLabel: 'Go back', onOk: function () { S().rewind(E.camp, +t.getAttribute('data-i')); E.save(); E.view = 'story'; E.render(); } });
          return true;
      }
      return false;
    }

    /* A story battle's result: the story moves on first, then the campaign's
       aftermath (pay, EXP, trauma) is worked through as for any battle. */
    function onFinish(report) {
      var st = E.camp && E.camp.story;
      if (!st || !E.camp.pending || E.camp.pending.story !== st.node) return;
      S().resolveBattle(E.camp, report);
    }
    /* A story battle thrown away: in ironman a rout, otherwise put back to be fought again. */
    function abandoned() {
      var st = E.camp && E.camp.story;
      if (!st || !E.camp.pending || E.camp.pending.story !== st.node) return;
      if (st.ironman) S().forfeit(E.camp);
    }

    return {
      newView: newView, storyView: storyView, musterView: musterView, journalView: journalView,
      act: act, onFinish: onFinish, abandoned: abandoned
    };
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCStoryScreens;
})(typeof window !== 'undefined' ? window : global);
