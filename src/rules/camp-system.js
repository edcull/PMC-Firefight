/* PMC 2670 — Firefight : the star system a single-player campaign is fought
   across (roadmap v0.5).

   Made once, when the campaign is founded, from a seed kept with it: a star and
   four to seven planets, each with a kind of world (the terrain generator's) and
   conditions rolled once on the Other Worlds table (pp. 164-165) and kept for
   good. Every force has a share of influence on each planet; the rivals each
   have a home, and the company a base. The contracts of a turn are still rolled
   as ever (camp-rivals.js rollOffers); this file only says where each is fought —
   a planet, weighted by the rival's influence there, and a site on its map — and
   what a battle there does to who holds it. Now and then an event on a planet
   changes its conditions for a few turns.

   Readings, where the book has nothing to say (it has no star systems):
   - The book's dice leave about half the worlds like home. So that a system is
     worth looking at, at least half its planets carry a condition: the dice are
     rolled again for the rest until they do.
   - Standing is the company's own share of influence on a planet: a win there
     moves 12 of the rival's to the company, a loss 10 the other way. For now it
     is for show — standing and holding a planet bring nothing in themselves
     (the owner's ruling), and no event touches the campaign beyond the planet:
     its conditions, and who holds it. */
(function (root) {
  'use strict';
  var R = root.PMC;

  var KINDS = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'];
  var KIND_NAMES = { desert: 'Desert world', arctic: 'Arctic world', sparse: 'Temperate world', dense: 'Colonised world',
    industrial: 'Industrial world', jungle: 'Jungle world', mountain: 'Mountain world', unstable: 'Unstable world' };
  var STARS = ['Hadley', 'Vantor', 'Okoro', 'Tessaly', 'Marrick', 'Ansel', 'Corvin', 'Ilya', 'Brannock', 'Sedra', 'Kasimir', 'Orlo'];
  var STAR_KIND = [
    { kind: 'yellow', colour: '#ffcf7a' }, { kind: 'orange', colour: '#ffad5c' }, { kind: 'red', colour: '#ff7a5c' },
    { kind: 'white', colour: '#e8f0ff' }, { kind: 'blue', colour: '#9cc3ff' }
  ];
  var PLANET_NAMES = ['Vesk', 'Thule', 'Marrow', 'Caldera', 'Ossian', 'Kerrigan', 'Dunmore', 'Halcyon', 'Pell', 'Sorrow', 'Tamsin',
    'Varga', 'Ember', 'Hollin', 'Jessup', 'Lyre', 'Morrow', 'Nadir', 'Quill', 'Rook', 'Stour', 'Tarn', 'Umber', 'Wick', 'Yarrow'];
  var NUMERALS = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII'];
  // the places on a world a job is fought over, by its kind
  var SITES = {
    desert: ['Dry Well', 'Kessler Ridge', 'Glass Flats', 'Dune Station', 'Salt Pan', 'Sandcrawler Depot'],
    arctic: ['Relay Station', 'Ice Shelf', 'Frost Camp', 'Drill Head', 'Whiteout Pass', 'Cold Store'],
    sparse: ['Farmstead', 'River Crossing', 'Mill', 'Hilltop Mast', 'Orchard', 'Waystation'],
    dense: ['Hab Block', 'Market Square', 'Transit Hub', 'Old Town', 'Civic Centre', 'Suburb'],
    industrial: ['Pumping Station', 'Dockyard', 'Refinery', 'Foundry', 'Rail Yard', 'Slag Heaps'],
    jungle: ['Firebase', 'Canopy Lift', 'Delta', 'Logging Camp', 'Mangrove', 'Research Dome'],
    mountain: ['Pass', 'Quarry', 'Monastery', 'Funicular', 'Watchtower', 'Ridge Line'],
    unstable: ['Vent Field', 'Magma Works', 'Fault Line', 'Ash Plain', 'Survey Post', 'Caldera Rim']
  };
  // a Close Encounters job is fought inside something
  var COMPOUNDS = ['Mine', 'Bunker', 'Hab Block', 'Research Station', 'Vault', 'Reactor Hall'];

  /* ---- rare events: a condition for a few turns, a blow to whoever holds a
     planet — nothing that reaches the campaign itself ---- */
  var EVENTS = [
    { kind: 'breach', title: 'Reactor breach', set: { anomaly: 'radiation' }, turns: 3, text: 'A reactor has breached: high radiation until it is contained.' },
    { kind: 'dust', title: 'Storm season', set: { atmosphere: 'foggy' }, turns: 2, text: 'Storms close in: nobody sees far.' },
    { kind: 'spill', title: 'Chemical spill', set: { atmosphere: 'toxic' }, turns: 3, text: 'Something has got into the air.' },
    { kind: 'gravitic', title: 'Gravitic anomaly', set: { anomaly: 'time' }, turns: 2, text: 'Time runs strangely near the anomaly.' },
    { kind: 'sickness', title: 'Wasting sickness', set: { anomaly: 'weakness' }, turns: 2, text: 'A sickness saps everyone who fights there.' },
    { kind: 'uprising', title: 'Uprising', turns: 1, text: 'The locals rise against whoever holds the planet.' }
  ];
  var STANDING = [{ at: 75, name: 'Favoured' }, { at: 50, name: 'Held' }, { at: 25, name: 'Known' }, { at: 0, name: 'Unknown' }];
  var YOU = 'you';

  // a small seeded random: the same seed draws the same system
  function seeded(seed) {
    var s = (seed >>> 0) || 1;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }
  function shuffle(a, rand) {
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rand() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function rollConditions(rand) {
    var W = R.WORLD_ROLL, d10 = function () { return Math.floor(rand() * 10); };
    return { gravity: W.gravity[d10()], atmosphere: W.atmosphere[d10()], anomaly: W.anomaly[d10()] };
  }
  function likeHome(w) { return !w || (w.gravity === 'standard' && w.atmosphere === 'standard' && w.anomaly === 'none'); }
  function rivalsOf(campaign) {
    return (campaign.rivals && campaign.rivals.length ? campaign.rivals : [campaign.companies.B]).filter(Boolean);
  }
  function total(inf) { var n = 0; for (var k in inf) n += inf[k]; return n; }
  // a share added on a planet, taken from the unaligned part first and then from the largest other share
  function give(planet, who, n) {
    var inf = planet.influence;
    inf[who] = Math.min(100, (inf[who] || 0) + n);
    while (total(inf) > 100) {
      var over = total(inf) - 100, big = null;
      for (var k in inf) if (k !== who && inf[k] > 0 && (!big || inf[k] > inf[big])) big = k;
      if (!big) { inf[who] = 100; break; }
      inf[big] = Math.max(0, inf[big] - over);
    }
  }
  function take(planet, who, n) { planet.influence[who] = Math.max(0, (planet.influence[who] || 0) - n); }

  /* ---- the system ---- */
  function makeSystem(campaign, opts) {
    opts = opts || {};
    var seed = opts.seed != null ? opts.seed >>> 0 : (Math.random() * 4294967296) >>> 0;
    var rand = seeded(seed);
    var n = 4 + Math.floor(rand() * 4);
    var star = STAR_KIND[Math.floor(rand() * STAR_KIND.length)], starName = STARS[Math.floor(rand() * STARS.length)];
    var names = shuffle(PLANET_NAMES.slice(), rand), kinds = shuffle(KINDS.slice(), rand);
    var planets = [];
    for (var i = 0; i < n; i++) {
      var name = names[i] + (rand() < 0.3 ? NUMERALS[1 + Math.floor(rand() * 5)] : '');
      planets.push({
        id: 'p' + i, name: name, kind: kinds[i % kinds.length], world: rollConditions(rand),
        orbit: i + 1, angle: Math.floor(rand() * 360), size: Math.round((0.75 + rand() * 0.65) * 100) / 100,
        home: null, base: false, influence: {}
      });
    }
    // at least half the planets out of the ordinary
    var odd = function () { return planets.filter(function (p) { return !likeHome(p.world); }).length; };
    for (var g = 0; g < 200 && odd() < Math.ceil(n / 2); g++) {
      var plain = planets.filter(function (p) { return likeHome(p.world); });
      plain[Math.floor(rand() * plain.length)].world = rollConditions(rand);
    }
    var sys = { v: 1, seed: seed, name: 'The ' + starName + ' Reach', star: { name: starName + '’s Star', kind: star.kind, colour: star.colour },
      planets: planets, events: [], news: [], turn: campaign.turn || 0 };
    // homes for the rivals, a base for the company
    var order = shuffle(planets.map(function (p, k) { return k; }), rand);
    rivalsOf(campaign).forEach(function (co, k) { homeFor(sys, co.name, rand, order[k % order.length]); });
    var free = planets.filter(function (p) { return !p.home; });
    var base = free.length ? free[Math.floor(rand() * free.length)] : planets[Math.floor(rand() * planets.length)];
    base.base = true; give(base, YOU, 35);
    return sys;
  }
  // a home for a rival (on `at`, or the planet with the least influence on it), and a foothold or two besides
  function homeFor(sys, name, rand, at) {
    var ps = sys.planets;
    var home = at != null ? ps[at] : ps.slice().sort(function (a, b) { return total(a.influence) - total(b.influence) || (a.home ? 1 : 0) - (b.home ? 1 : 0); })[0];
    if (!home.home) home.home = name;
    give(home, name, 50 + Math.floor(rand() * 21));
    var others = shuffle(ps.filter(function (p) { return p !== home; }), rand).slice(0, 1 + Math.floor(rand() * 2));
    others.forEach(function (p) { give(p, name, 5 + Math.floor(rand() * 11)); });
  }
  function byId(sys, id) { return sys.planets.filter(function (p) { return p.id === id; })[0] || null; }
  // what a planet is like this turn: its own conditions, with any event's laid over them
  function conditions(sys, p) {
    var w = Object.assign({}, p.world);
    activeEvents(sys, p).forEach(function (e) { if (e.set) Object.assign(w, e.set); });
    return w;
  }
  function activeEvents(sys, p) {
    return (sys.events || []).filter(function (e) { return e.planet === p.id && e.until >= sys.turn; });
  }
  function standing(sys, p) { return (p.influence[YOU] || 0); }
  function standingName(n) { for (var i = 0; i < STANDING.length; i++) if (n >= STANDING[i].at) return STANDING[i].name; return 'Unknown'; }
  // who holds a planet: 50 or more of it; null where it is contested
  function holder(p) {
    var best = null;
    for (var k in p.influence) if (p.influence[k] >= 50 && (!best || p.influence[k] > p.influence[best])) best = k;
    return best;
  }

  /* ---- a new campaign turn: news, events, the forces that have come and gone ---- */
  function newTurn(campaign) {
    var sys = campaign.system;
    if (!sys || sys.turnSeen === campaign.turn) return [];
    var first = sys.turnSeen == null;
    sys.turnSeen = campaign.turn; sys.turn = campaign.turn;
    var said = [], names = rivalsOf(campaign).map(function (co) { return co.name; });
    // a force that has left loses half its hold a turn; a new one is given a home
    sys.planets.forEach(function (p) {
      Object.keys(p.influence).forEach(function (k) {
        if (k === YOU || names.indexOf(k) >= 0) return;
        p.influence[k] = Math.floor(p.influence[k] / 2);
        if (!p.influence[k]) delete p.influence[k];
        if (p.home === k) p.home = null;
      });
    });
    names.forEach(function (nm) {
      if (sys.planets.some(function (p) { return p.home === nm || (p.influence[nm] || 0) > 0; })) return;
      homeFor(sys, nm, Math.random);
      said.push(nm + ' arrives in the system.');
    });
    sys.events = (sys.events || []).filter(function (e) { return e.until >= campaign.turn; });
    // a rare event: one turn in six, on a planet with none going on
    if (!first && Math.random() < 1 / 6) {
      var quiet = sys.planets.filter(function (p) { return !activeEvents(sys, p).length; });
      if (quiet.length) {
        var p = quiet[Math.floor(Math.random() * quiet.length)], d = EVENTS[Math.floor(Math.random() * EVENTS.length)];
        var ev = { kind: d.kind, title: d.title, text: d.text, planet: p.id, from: campaign.turn, until: campaign.turn + d.turns - 1, set: d.set || null };
        if (d.kind === 'uprising') { var h = holder(p); if (h) take(p, h, 20); }
        sys.events.push(ev);
        said.push(d.title + ' on ' + p.name + ': ' + d.text);
      }
    }
    said.forEach(function (t) { sys.news.push({ turn: campaign.turn, text: t }); });
    sys.news = sys.news.slice(-12);
    return said;
  }

  /* ---- where each of a turn's contracts is fought ---- */
  function placeOffers(campaign, offers) {
    var sys = campaign.system;
    if (!sys || !offers) return offers;
    newTurn(campaign);
    var rivals = rivalsOf(campaign), dealt = {};
    offers.forEach(function (o) {
      var co = rivals[o.rival] || rivals[0], nm = co ? co.name : null;
      // in proportion to its hold there (a lot at home), a little everywhere — and spread out
      var weights = sys.planets.map(function (p) {
        var w = 4 + (p.influence[nm] || 0);
        return w * Math.pow(0.45, dealt[p.id] || 0);
      });
      var sum = weights.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * sum, k = 0;
      while (k < weights.length - 1 && r >= weights[k]) { r -= weights[k]; k++; }
      var p = sys.planets[k];
      dealt[p.id] = (dealt[p.id] || 0) + 1;
      o.site = siteOn(sys, p, o, offers);
      o.planet = p.kind;
      o.world = conditions(sys, p);
    });
    return offers;
  }
  function siteOn(sys, p, o, offers) {
    var ce = /^ce_|^s_besieged/.test((o.scenario && o.scenario.id) || '');
    var pool = ce ? COMPOUNDS : SITES[p.kind] || SITES.sparse;
    var name = pool[Math.floor(Math.random() * pool.length)] + (Math.random() < 0.6 ? ' ' + (2 + Math.floor(Math.random() * 18)) : '');
    var taken = offers.filter(function (x) { return x !== o && x.site && x.site.planet === p.id; });
    var x = 0.5, y = 0.5;
    for (var g = 0; g < 60; g++) {
      x = 0.14 + Math.random() * 0.72; y = 0.18 + Math.random() * 0.64;
      if (taken.every(function (t) { return Math.hypot(t.site.x - x, t.site.y - y) > 0.2; })) break;
    }
    return { planet: p.id, name: name, x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 };
  }

  /* ---- a battle fought there: the shares that move, and what the company is paid for its standing ---- */
  function afterBattle(campaign, site, rivalName, winner) {
    var sys = campaign.system, p = sys && site && byId(sys, site.planet);
    if (!p) return null;
    var was = holder(p), lines = [];
    if (winner === 'A') {
      var moved = Math.min(12, p.influence[rivalName] || 0);
      take(p, rivalName, moved); give(p, YOU, 12);
      lines.push('Your standing on ' + p.name + ' rises to ' + standing(sys, p) + ' (' + standingName(standing(sys, p)) + ').');
    } else if (winner === 'B') {
      take(p, YOU, 10); give(p, rivalName, 10);
      lines.push(rivalName + ' tightens its grip on ' + p.name + '; your standing there falls to ' + standing(sys, p) + '.');
    }
    var now = holder(p);
    if (now !== was) {
      lines.push(now === YOU ? 'You hold ' + p.name + ' now.' : now ? now + ' holds ' + p.name + ' now.' : p.name + ' is contested now.');
    }
    lines.forEach(function (t) { sys.news.push({ turn: campaign.turn, text: t }); });
    sys.news = sys.news.slice(-12);
    return { planet: p.id, lines: lines, standing: standing(sys, p) };
  }

  // a system as it came from a save or a file, made safe to read (null if it is no system)
  function cleanSystem(s) {
    if (!s || typeof s !== 'object' || !Array.isArray(s.planets) || !s.planets.length) return null;
    var kinds = {};
    KINDS.forEach(function (k) { kinds[k] = 1; });
    s.planets = s.planets.slice(0, 7).filter(function (p) { return p && typeof p.id === 'string'; }).map(function (p) {
      var inf = {};
      if (p.influence && typeof p.influence === 'object') Object.keys(p.influence).slice(0, 16).forEach(function (k) { var v = +p.influence[k]; if (v > 0) inf[k] = Math.min(100, Math.floor(v)); });
      return { id: p.id, name: String(p.name || p.id).slice(0, 30), kind: kinds[p.kind] ? p.kind : 'sparse', world: R.cleanWorld(p.world) || { gravity: 'standard', atmosphere: 'standard', anomaly: 'none' },
        orbit: +p.orbit || 1, angle: +p.angle || 0, size: +p.size || 1, home: typeof p.home === 'string' ? p.home : null, base: !!p.base, influence: inf };
    });
    s.events = Array.isArray(s.events) ? s.events.filter(function (e) { return e && typeof e.planet === 'string' && e.kind !== 'bounty'; }) : [];
    s.news = Array.isArray(s.news) ? s.news.slice(-12) : [];
    return s.planets.length ? s : null;
  }

  root.PMCSystem = {
    KINDS: KINDS, KIND_NAMES: KIND_NAMES, EVENTS: EVENTS, YOU: YOU,
    makeSystem: makeSystem, newTurn: newTurn, placeOffers: placeOffers, afterBattle: afterBattle, cleanSystem: cleanSystem,
    byId: byId, conditions: conditions, activeEvents: activeEvents, standing: standing, standingName: standingName, holder: holder,
    likeHome: likeHome, seeded: seeded
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCSystem;
})(typeof window !== 'undefined' ? window : global);
