/* The shots, drawn the way each weapon works — shared by the battle
   (game.js) and the Unit Viewer (viewer.js), so a unit fires on the bench
   exactly as it does on the table.

   PMCFire.make(ctx) gives a set of players bound to the screen they draw on:
     ctx.add(fx)    put an effect up (fx.js) and keep the frames coming
     ctx.redraw()   draw a frame now
     ctx.alive()    false once the battle behind it has gone (the timers check it)
   The battle adds the casualties and the timing of its turn around these; the
   bench just watches. */
(function (root) {
  'use strict';
  var R = root.PMC;

  function make(ctx) {
    var add = ctx.add, redraw = ctx.redraw || function () { }, alive = ctx.alive || function () { return true; };
    var SFX = root.SFX;
    var ISO = root.PMCIso;

    /* ---- a shot, played the way that unit's weapon actually works ----
       `R.weaponSpec` says what it carries: a primary, sometimes a secondary that
       goes off with it, and how many tubes fire at once. Each style has its own
       cadence, its own effect on the table and its own sound, and the whole thing
       is timed so the hits land when the rounds arrive rather than on a fixed
       beat. Every one of them ends by calling `done`, once. */
    /* How many rounds each style puts out (`n`) is fixed: the weapon fires its
       full volley whatever was rolled, and the hits only decide how many of
       those rounds land on the target. (It used to scale with the hits, so a
       poor roll looked like a shorter burst.) */
    var FIRE = {
      /* A rifle line: aimed shots, not a stream. Eight men firing deliberately put
         fewer rounds down per second than an autocannon does — what makes it read
         as a volley is that it runs on for a second, not that it is fast. */
      small:    { n: function () { return 11; }, gap: 112, tracer: { spread: 0.42 }, land: 330, muzzle: 520, perShot: true },
      /* A sidearm: a few deliberate shots with a long gap between them, at close
         range. Fewer rounds than anything else fires, and you can count them. */
      pistol:   { n: function () { return 6; }, gap: 185, tracer: { spread: 0.34, short: true }, land: 300, muzzle: 150, perShot: true },
      /* A carbine at close range: quicker than an aimed rifle line and with more
         rounds in it, but still recognisably single shots rather than a stream. */
      smg:      { n: function () { return 12; }, gap: 68, tracer: { spread: 0.5, short: true }, land: 300, muzzle: 460 },
      /* A machine gun, rattling in a double burst: the rounds split into two
         long bursts with a breath between them (`bursts`, `pause` ms). */
      burst:    { n: function () { return 24; }, gap: 38, bursts: 2, pause: 220, tracer: { spread: 0.55 }, land: 300, muzzle: 460 },
      // an autocannon: heavier, slower, countable
      chain:    { n: function () { return 10; }, gap: 92, tracer: { spread: 0.3, fat: true }, land: 330, muzzle: 92, perShot: true },
      // a bug's volley of chitin spines: a quick dry spray, bone-pale, no flash
      spine:    { n: function () { return 12; }, gap: 45, tracer: { spread: 0.6, short: true, bio: true }, land: 320, muzzle: 0, noFlash: true }
    };
    function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    /* How a stream of n rounds is clumped: a fixed clump, or split evenly into
       `bursts` with a pause after each. Null for an even stream. */
    function clumping(f, n) {
      if (f.bursts) { var c = Math.ceil(n / f.bursts); return { clump: c, gap: c * f.gap + f.pause }; }
      return f.clump ? { clump: f.clump, gap: f.clumpGap } : null;
    }
    // when the i-th round of n goes out
    function roundAt(f, n, i) {
      var c = clumping(f, n);
      return c ? Math.floor(i / c.clump) * c.gap + (i % c.clump) * f.gap : i * f.gap;
    }
    // how long a stream of that style takes to get all its rounds away
    function streamLength(style, hits) {
      var f = FIRE[style] || FIRE.small;
      var n = f.n(hits);
      if (!clumping(f, n)) return n * f.gap;
      return roundAt(f, n, n - 1);
    }

    /* A flamethrower is not one squeeze of a trigger. The operator holds it down
       and walks the cone across the frontage, in two or three jets, each one
       laid a little off the last — which is why it takes ground rather than
       picking a target out of it. */
    var FLAME_JET = 620, FLAME_GAP = 165;
    function flameJets(from, to, n, onLand, outcome) {
      var dx = to.x - from.x, dy = to.y - from.y;
      var plan = outcome ? roundPlan(n, outcome) : null, kills = 0;
      var len = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));
      var px = -dy / len, py = dx / len;               // across the line of fire
      var span = (n - 1) * FLAME_GAP + FLAME_JET;      // how long the roar has to hold
      for (var i = 0; i < n; i++) {
        (function (j) {
          setTimeout(function () {
            if (!alive()) return;
            // barely off the mark: the jets converge rather than sweeping a line
            var off = (j - (n - 1) / 2) * 0.45;
            var aim = { x: to.x + px * off, y: to.y + py * off, up: to.up };
            /* by its part in the attack: a jet that kills washes over the men who fall,
               one that pins them licks at their feet, and one that does nothing falls short
               (fire does not go over their heads) */
            if (plan) {
              var role = plan[j], ux = dx / len, uy = dy / len;
              if (role === 'kill') {
                var figs = outcome.figs || [], kk = kills++, fg = figs.length ? figs[kk % figs.length] : to; aim = { x: fg.x, y: fg.y, up: to.up };
                // the man it washes over drops as it reaches him
                if (outcome.onKill) setTimeout(function () { if (alive()) outcome.onKill(kk); }, FLAME_JET * 0.6);
              }
              else if (role === 'glance') { var all = outcome.all || outcome.figs || [], gm = all.length ? all[j % all.length] : to; aim = { x: gm.x, y: gm.y, up: to.up }; }
              else if (role === 'supp') { var sh = 0.4 + Math.random() * 0.7; aim = { x: aim.x - ux * sh, y: aim.y - uy * sh, up: to.up }; }
              else { var fs = 0.9 + Math.random() * 0.7; aim = { x: aim.x - ux * fs, y: aim.y - uy * fs, up: to.up }; }
            }
            if (SFX) { if (j === 0) SFX.flame(0, span / 1000); else SFX.flamepuff(); }
            add({ kind: 'flame', from: from, to: aim, dur: FLAME_JET, blocking: true });
            if (onLand && j === n - 1) setTimeout(onLand, 360);
            redraw();
          }, j * FLAME_GAP);
        })(i);
      }
      return span;
    }


    /* Charges thrown by a squad come from men spread through it rather than the
       two at the front: the i-th of n goes to the man that far along the rank. */
    function spread(from, i, n) {
      if (!from.pool || from.pool.length < 2 || n < 2) return pick(from, i);
      var len = from.pool.length, at = Math.round(i * (len - 1) / (n - 1));
      return { x: from.x, y: from.y, up: from.up, mz: from.pool[at % len], pool: from.pool };
    }
    // the i-th round of a volley leaves the i-th barrel or tube in the pool
    function pick(from, i) {
      if (!from.pool || from.pool.length < 2) return from;
      return { x: from.x, y: from.y, up: from.up, mz: from.pool[i % from.pool.length], pool: from.pool };
    }

    // the colour a Xenotripod's weapons burn: the light of its army
    /* Xenotripod energy — their shots, the orbs and the blasts — burns blue,
       whatever the army's colour; the colour stays on the models. */
    var XENO_BLUE = '110,190,255';
    /* A unit's own colour, where its weapon entry names one (`glow`): 'none'
       for plain rounds. Otherwise a Xenotripod's shots burn blue and anyone
       else's are plain; an orb or a pulse always glows, blue if nothing else. */
    function glowOf(u) { var g = u ? R.weaponSpec(u).glow : null; return g ? (g === 'none' ? 'none' : GLOWS[g] || null) : null; }
    function glowRGB(u) { var g = glowOf(u); return g && g !== 'none' ? g : XENO_BLUE; }
    function shotRGB(u) { var g = glowOf(u); return g ? (g === 'none' ? null : g) : R.isXeno(u) ? XENO_BLUE : null; }
    /* What a splashing round (`splash`) bursts in when its shots are plain: the
       army's own — a Xenotripod's blue, a bug's acid green, and amber for the
       mercenaries and the revolt. */
    function splashRGB(u) { return R.isXeno(u) ? XENO_BLUE : (u && u.faction === 'bugs') ? '150,220,80' : '255,190,90'; }
    function playEnergy(shooter, from, to, count, land, gap, outcome) {
      var rgb = glowRGB(shooter), n = count || 1, plan = outcome ? roundPlan(n, outcome) : null, kills = 0;
      for (var q = 0; q < n; q++) {
        (function (j) {
          setTimeout(function () {
            if (!alive()) return;
            if (SFX) (SFX.zap || SFX.rail).call(SFX);
            if (plan) {
              // each pulse by its part in the volley: into a man, into the ground at their feet, or past them
              var lr = lineRound(plan[j], plan[j] === 'kill' ? kills++ : 0, outcome, from, to);
              add({ kind: 'pulse', from: pick(from, j), to: lr.to, low: lr.low, over: lr.over, rgb: rgb, dur: lr.over ? 320 : 260, blocking: true });
              if (lr.glance || plan[j] === 'kill') strike(lr.glance ? 'glance' : 'kill', lr.to, outcome, from, to, 220, false, lr.k);
              else if (!lr.over) add({ kind: 'impact', x: lr.to.x, y: lr.to.y, up: to.up || 0, n: 1, rgb: rgb, delay: 220, dur: 680, blocking: true });
            } else add({ kind: 'pulse', from: pick(from, j), to: to, rgb: rgb, dur: 260, blocking: true });
            if (land) setTimeout(function () { land(j === n - 1 ? 1 : 0); }, 250);
            redraw();
          }, j * (gap || 120));
        })(q);
      }
      return n * (gap || 120) + 300;
    }
    function playOrbs(shooter, from, to, count, land, tele, big, outcome) {
      var rgb = glowRGB(shooter), n = count || 1, blast = R.weaponSpec(shooter).blast;
      var plan = outcome && n > 1 ? roundPlan(n, outcome) : null;
      var fl = tele ? 1000 : Math.round((big ? 760 : 560) + Math.min(600, R.unitDist(shooter, { x: to.x, y: to.y }) * 12));
      /* a Gamma's salvo all comes out of one exit portal, hanging short of the
         target on the shooter's side, and spreads from it */
      var exit = null;
      if (tele) {
        var ex = shooter.x - to.x, ey = shooter.y - to.y, ed = Math.hypot(ex, ey) || 1, eb = Math.min(ed * 0.45, 2.4);
        exit = { x: to.x + ex / ed * eb, y: to.y + ey / ed * eb, up: to.up };
        add({ kind: 'exitportal', exit: exit, open: 300, dur: fl + (n - 1) * 200, blocking: true });
      }
      for (var q = 0; q < n; q++) {
        (function (j) {
          setTimeout(function () {
            if (!alive()) return;
            if (tele && SFX && SFX.shimmer) SFX.shimmer(); else if (SFX && SFX.launch) SFX.launch();
            var aim = landing(outcome, plan, j, n, to, from, n > 1 ? { x: to.x + (j - (n - 1) / 2) * 1.1, y: to.y + (j % 2 ? 0.7 : -0.7), up: to.up } : to);
            add({ kind: 'orb', from: pick(from, j), to: aim, rgb: rgb, tele: !!tele, exit: exit, big: !!big, dur: fl, blocking: true });
            setTimeout(function () {
              if (!alive()) return;
              // where the weapon entry says (`blast: 'frag'`), it goes off as a fragmentation blast instead
              down(aim);
              if (blast === 'frag') fragBlast(aim, big ? 1.8 : 1.15, j);
              else plasmaSplash(aim, rgb, big);
              if (land && j === n - 1) land(2, aim);
            }, fl);
            redraw();
          }, j * 200);
        })(q);
      }
      return fl + (n - 1) * 200 + 600;
    }

    /* A fragmentation blast where a round lands (a frag grenade's, or an orb's
       whose entry asks for one): `scale` how big, 1 a hand grenade's. */
    function fragBlast(aim, scale, seed) {
      add({ kind: 'fragburst', x: aim.x, y: aim.y, up: aim.up, seed: seed || 0, scale: scale || 1, dur: Math.round(1000 * Math.max(1, Math.sqrt(scale || 1))), blocking: true });
      if (SFX) { SFX.impact(); SFX.shell(); if (scale > 1.5) SFX.impact(0.06); }
    }

    // where the i-th rocket of a ripple bursts: scattered a little about the mark, not all on one spot
    function rocketSpot(to, i) {
      var a = i * 2.4 + 0.7, r = 0.5 + (i % 3) * 0.45;
      return { x: to.x + Math.cos(a) * r, y: to.y + Math.sin(a) * r * 0.8, up: to.up };
    }

    /* Where plasma lands: a ring of blue light and a white flash. A heavy round
       throws the ground up with it — a wider ring of blue fire and a scatter of
       it around the crater (the energy howitzer, the plasma breaching gun). */
    function plasmaSplash(aim, rgb, big) {
      add({ kind: 'orbburst', x: aim.x, y: aim.y, up: aim.up, rgb: rgb, big: !!big, dur: big ? 800 : 600, blocking: true });
      if (big) {
        add({ kind: 'orbburst', x: aim.x, y: aim.y, up: aim.up, rgb: rgb, dur: 1000, blocking: true });
        for (var sp = 0; sp < 5; sp++) {
          add({
            kind: 'orbburst', rgb: rgb, dur: 520 + Math.random() * 260, blocking: true,
            x: aim.x + (Math.random() - 0.5) * 3.2, y: aim.y + (Math.random() - 0.5) * 3.2, up: aim.up
          });
        }
      }
      if (SFX) { SFX.impact(); if (big) SFX.impact(0.08); }
    }
    /* A plasma breaching gun: one big blue bolt, flat and fast like a shell,
       bursting in a single large splash where it strikes. */
    function playPlasmaBolts(shooter, from, to0, count, land, outcome) {
      var rgb = glowRGB(shooter), n = count || 1, fl = 420;
      var plan = outcome && n > 1 ? roundPlan(n, outcome) : null;
      for (var q = 0; q < n; q++) {
        (function (j) {
          setTimeout(function () {
            if (!alive()) return;
            if (SFX) { SFX.shell(); if (SFX.zap) SFX.zap(0.02); }
            var F = pick(from, j), to = landing(outcome, plan, j, n, to0, from, to0);
            add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: F.mz, rgb: rgb, dur: 260, big: true, blocking: true });
            add({ kind: 'plasmabolt', from: F, to: to, rgb: rgb, dur: fl, blocking: true });
            setTimeout(function () {
              if (!alive()) return;
              // one big burst where it strikes: no scatter, the whole charge in one place
              down(to);
              add({ kind: 'orbburst', x: to.x, y: to.y, up: to.up, rgb: rgb, huge: true, dur: 1000, blocking: true });
              if (SFX) { SFX.impact(); SFX.impact(0.08); }
              if (land && j === n - 1) land(2, to);
            }, fl);
            redraw();
          }, j * 260);
        })(q);
      }
      return fl + (n - 1) * 260 + 800;
    }

    /* Where the ground goes up when a shot lands on its mark: the more hits,
       the more of it, in the colour of what did it. */
    function hit(shooter, to, hits, extra) {
      add({
        kind: 'impact', x: to.x, y: to.y, up: to.up, rgb: shotRGB(shooter),
        n: Math.min(9, (hits || 1) + (extra || 0)), dur: extra ? 560 : 420, blocking: true
      });
      if (SFX) { SFX.impact(); if (extra) SFX.impact(0.06); }
    }

    /* Suppressive Fire (p. 59): the rounds that did not hit anyone still walk the
       ground round the unit, kicking dirt up on every side of it for a moment
       after the shot lands, so the extra Suppression has something to show for it. */
    function suppress(to) {
      for (var i = 0; i < 9; i++) {
        var a = i * 2.4 + 0.4, r = 1.1 + (i % 3) * 0.55;
        add({ kind: 'impact', x: to.x + Math.cos(a) * r, y: to.y + Math.sin(a) * r * 0.8, up: to.up || 0,
          n: 1 + (i % 2), delay: 60 + i * 70, dur: 420 + 60 + i * 70, blocking: true });
      }
      if (SFX) { SFX.impact(0.05); setTimeout(function () { if (SFX) SFX.impact(0.04); }, 260); }
    }

    /* An aircraft's missiles leave on the line the craft is flying and turn
       onto the mark from there, rather than climbing over it: it is already
       above everything, so the climb read as the missile going the wrong way.
       The control point is a spot out ahead of the nose, and the missile is
       drawn along the curve through it. */
    function curveFor(shooter, dist) {
      if (shooter.cls !== 'aircraft' || shooter.facing == null) return null;
      var reach = Math.max(4, dist * 0.55);
      return {
        x: shooter.x + Math.cos(shooter.facing) * reach,
        y: shooter.y + Math.sin(shooter.facing) * reach,
        up: ISO.flyLift(shooter)
      };
    }

    /* A surface-to-air missile (`launch` in its weapon entry) leaves as the SAM
       team's do: pushed cold up the line the tubes are laid on, climbing, then
       lighting and running at the aircraft. 'sam' is laid the way the unit
       faces (the team's launcher); 'samturret' turns onto the target, as the
       anti-aircraft vehicle's turret does, and fires up a little steeper. Any
       other missile flies flat. */
    function samLaunch(spec, shooter, to) {
      if (spec.launch === 'sam') return { aim: shooter.facing || 0, elev: 0.8 };
      if (spec.launch === 'samturret') return { aim: Math.atan2(to.y - shooter.y, to.x - shooter.x), elev: 0.95 };
      return null;
    }

    /* Molotov cocktails: `count` bottles thrown from men through the squad, each
       tumbling end over end along a high lob with its rag alight, and bursting
       into a fiery splash where it lands — glass, a fireball, the fuel burning
       on. `land` (the primary's) is told as the last one breaks. */
    function playMolotovs(shooter, from, to, count, land, outcome) {
      var n = count || 1, gap = 210, plan = outcome && n > 1 ? roundPlan(n, outcome) : null;
      var fl = Math.round(560 + Math.min(420, R.unitDist(shooter, { x: to.x, y: to.y }) * 18));
      for (var q = 0; q < n; q++) {
        (function (j) {
          setTimeout(function () {
            if (!alive()) return;
            var aim = landing(outcome, plan, j, n, to, from, n > 1 ? { x: to.x + (j - (n - 1) / 2) * 1.3, y: to.y + (j % 2 ? 0.8 : -0.8), up: to.up } : to);
            if (SFX) SFX.launch();
            add({ kind: 'molotov', from: spread(from, j, n), to: aim, seed: j, dur: fl, blocking: true });
            setTimeout(function () {
              if (!alive()) return;
              down(aim);
              add({ kind: 'firesplash', x: aim.x, y: aim.y, up: aim.up, seed: j, dur: 1500, blocking: true });
              if (SFX) { SFX.splat(); SFX.flamepuff(0.05); }
              if (land && j === n - 1) land(2, aim);
            }, fl);
            redraw();
          }, j * gap);
        })(q);
      }
      return fl + (n - 1) * gap + 900;
    }

    /* Fragmentation grenades: `count` thrown from men through the squad, each
       turning over along a short lob, skipping once and rolling to the mark,
       then going off in a sharp burst of splinters, dust and earth. `land`
       (the primary's) is told as the last one goes off. */
    function playFrags(shooter, from, to, count, land, outcome) {
      var n = count || 1, gap = 190, plan = outcome && n > 1 ? roundPlan(n, outcome) : null;
      var fl = Math.round(480 + Math.min(360, R.unitDist(shooter, { x: to.x, y: to.y }) * 16));
      for (var q = 0; q < n; q++) {
        (function (j) {
          setTimeout(function () {
            if (!alive()) return;
            var aim = landing(outcome, plan, j, n, to, from, n > 1 ? { x: to.x + (j - (n - 1) / 2) * 1.4, y: to.y + (j % 2 ? 0.9 : -0.9), up: to.up } : to);
            if (SFX) SFX.launch();
            add({ kind: 'frag', from: spread(from, j, n), to: aim, seed: j, dur: fl, blocking: true });
            setTimeout(function () {
              if (!alive()) return;
              down(aim);
              fragBlast(aim, 1, j);
              if (land && j === n - 1) land(3, aim);
            }, fl);
            redraw();
          }, j * gap);
        })(q);
      }
      return fl + (n - 1) * gap + 700;
    }

    /* The primary weapon, played out. `o` carries the hits it scored, the range
       (how long anything lobbed is in the air), and `land(extra)`, called as
       the rounds arrive. Returns how long it takes, in ms, before any
       secondary is added on. */
    function primary(spec, shooter, from, to, o) {
      var hits = o.hits || 1, land = o.land, dist = o.dist || 0, curve = curveFor(shooter, dist), oc = o.outcome || null;
      switch (spec.p) {
        case 'none':
          // nothing in hand: what it throws (the secondary) is the attack, and lands its hits
          if (spec.s) { setTimeout(function () { land(3); }, 150 + 520 + ((spec.sn || 1) - 1) * 170); return 120; }
          return 120;

        // fragmentation grenades, thrown: skipping to the mark and going off
        case 'frag': {
          return playFrags(shooter, from, to, spec.n, land, oc);
        }

        // Molotov cocktails, thrown: tumbling, alight, bursting into fire
        case 'molotov': {
          return playMolotovs(shooter, from, to, spec.n, land, oc);
        }

        // Xenotripod small arms: pulses of the army's own light
        case 'energy': {
          return playEnergy(shooter, from, to, spec.n, land, R.isMachine(shooter) ? 150 : 110, oc);
        }
        // plasma orbs: lobbed from craft and turrets, teleported from a Gamma's launcher (or as `orb` says)
        case 'orb': {
          return playOrbs(shooter, from, to, spec.n, land, spec.orb ? spec.orb === 'tele' : !R.isMachine(shooter), false, oc);
        }
        // an energy howitzer: heavier orbs, lobbed, bursting blue on the ground
        case 'orbbig': {
          return playOrbs(shooter, from, to, spec.n, land, false, true, oc);
        }
        // a plasma breaching gun: a big blue bolt, straight in, splashing blue
        case 'plasmabolt': {
          return playPlasmaBolts(shooter, from, to, spec.n, land, oc);
        }

        /* Bug acid: a glob (or `n` of them from the squad) lobbed low, landing in
           a green splash. `spitbig` is a sac of bio-plasma, bigger and slower. */
        case 'spit':
        case 'spitbig': {
          var sbig = spec.p === 'spitbig';
          var sr = dist;
          var sflight = Math.round((sbig ? 560 : 420) + Math.min(600, sr * 12));
          var globs = spec.n || 1, sgap = sbig ? 260 : 150, splan = oc && globs > 1 ? roundPlan(globs, oc) : null;
          for (var gi = 0; gi < globs; gi++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                var F = pick(from, j);
                if (SFX) SFX.spit(0, sbig);
                var aim = landing(oc, splan, j, globs, to, from, globs > 1
                  ? { x: to.x + (j - (globs - 1) / 2) * 0.9, y: to.y + (j % 2 ? 0.6 : -0.6), up: to.up }
                  : to);
                add({ kind: 'glob', from: F, to: aim, dur: sflight, big: sbig, blocking: true });
                setTimeout(function () {
                  if (!alive()) return;
                  down(aim);
                  add({ kind: 'splat', x: aim.x, y: aim.y, up: aim.up, big: sbig, dur: 620, blocking: true });
                  if (SFX) SFX.splat();
                  if (j === globs - 1) land(sbig ? 3 : 1, aim);
                }, sflight);
                redraw();
              }, j * sgap);
            })(gi);
          }
          return sflight + (globs - 1) * sgap + 520;
        }

        /* One heavy round, flat and fast. `shellbig` is the same thing with more
           behind it: a bigger blast at the muzzle and a heavier landing. */
        case 'shell':
        case 'shellbig': {
          var big = spec.p === 'shellbig';
          var rounds = spec.n || 1, shellGap = 230, shplan = oc && rounds > 1 ? roundPlan(rounds, oc) : null;
          var flightMs = big ? 340 : 300, pairs = paired(spec) ? Math.min(rounds, spec.sn || 1) : 0;
          for (var sh = 0; sh < rounds; sh++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                var F = pick(from, j), sto = landing(oc, shplan, j, rounds, to, from, to);
                if (SFX) SFX.shell();
                add({ kind: 'muzzle', x: F.x, y: F.y, up: F.up, mz: F.mz, dur: big ? 320 : 260, big: true, blocking: true });
                add({ kind: 'bolt', from: F, to: sto, dur: flightMs, heavy: big, blocking: true });
                // a Gauss line paired with it: out of the same barrel, at the same spot, at the same moment
                if (j < pairs) {
                  if (SFX) SFX.rail();
                  add({ kind: 'rail', from: F, to: sto, rgb: shotRGB(shooter), dur: 380, blocking: true });
                }
                setTimeout(function () {
                  // where the weapon entry says (`blast: 'frag'`), each round goes off as a fragmentation blast
                  down(sto);
                  if (alive() && spec.blast === 'frag') fragBlast(sto, big ? 1.5 : 1.05, j);
                  land(big ? 4 : 2, oc ? sto : undefined);
                }, flightMs);
                redraw();
              }, j * shellGap);
            })(sh);
          }
          return (big ? 900 : 820) + (rounds - 1) * shellGap;
        }

        /* Up and over. The round is in the air for as long as the range warrants,
           and `n` tubes fire together — a section, a team or a battery. */
        case 'arc':
        case 'arcbig': {
          var heavy = spec.p === 'arcbig';
          var range = dist;
          var flight = Math.round((heavy ? 640 : 520) + Math.min(760, range * 16));
          var tubes = spec.n || 1, aplan = oc && tubes > 1 ? roundPlan(tubes, oc) : null;
          // the charges leave the shoulder pods, one after another — the Protectors' leader's, or each drone's in turn
          var tubeFrom = from.pod ? { x: from.x, y: from.y, up: from.up, mz: from.pod, pool: from.pods } : from;
          for (var q = 0; q < tubes; q++) {
            (function (i) {
              var off = i * 130;
              setTimeout(function () {
                if (!alive()) return;
                var F = from.pod ? pick(tubeFrom, i) : R.isMachine(shooter) ? pick(tubeFrom, i) : spread(tubeFrom, i, tubes);
                if (SFX) SFX.launch();
                // a mortar's tube gives a short flash at its mouth, not a tank gun's blast
                add({ kind: 'muzzle', x: F.x, y: F.y, up: F.up, mz: F.mz, dur: 220, big: !F.mz, blocking: true });
                // each tube walks its round a little off the others
                var aim = landing(oc, aplan, i, tubes, to, from, tubes > 1
                  ? { x: to.x + (i - (tubes - 1) / 2) * 1.6, y: to.y + (i % 2 ? 1 : -1) * 0.9, up: to.up }
                  : to);
                add({ kind: 'lob', from: F, to: aim, dur: flight, heavy: heavy, blocking: true });
                if (SFX) SFX.incoming(flight / 1000 - 0.45, 0.45);
                setTimeout(function () {
                  // where the weapon entry says (`blast: 'frag'`), each round goes off as a fragmentation blast
                  down(aim);
                  if (alive() && spec.blast === 'frag') fragBlast(aim, heavy ? 1.5 : 1.05, i);
                  land(heavy ? 4 : 3, aim);
                }, flight);
              }, off);
            })(q);
          }
          return flight + (tubes - 1) * 130 + 480;
        }

        /* A guided missile: off the rail, then it turns onto the target. */
        case 'missile': {
          var mr = dist;
          // longer than the distance alone asks for: it leaves the tube slowly
          var mflight = Math.round(700 + Math.min(700, mr * 14));
          // `n` birds off the rail one after another, not all at once
          var birdsP = spec.n || 1, birdGap = 260, mplan = oc && birdsP > 1 ? roundPlan(birdsP, oc) : null;
          for (var mi2 = 0; mi2 < birdsP; mi2++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                var F = pick(from, j), mto = landing(oc, mplan, j, birdsP, to, from, to);
                if (SFX) SFX.missile(0, mflight / 1000, mflight / 1000 * 0.52);
                // no flash at the tube: it is ejected cold and lights further out
                add({ kind: 'missile', from: F, to: mto, seed: j, dur: mflight, curve: curve, blocking: true,
                  sam: samLaunch(spec, shooter, to) });
                setTimeout(function () {
                  // where the weapon entry says (`blast: 'frag'`), each missile goes off as a fragmentation blast
                  down(mto);
                  if (alive() && spec.blast === 'frag') fragBlast(mto, 1.2, j);
                  land(3, oc ? mto : undefined);
                }, mflight);
                redraw();
              }, j * birdGap);
            })(mi2);
          }
          return mflight + 460 + (birdsP - 1) * birdGap;
        }

        /* Unguided rockets, off the rails in a ripple. */
        case 'rocket': {
          var rn = Math.max(1, Math.min(6, spec.n || 1));  // the salvo its weapon fires (the weapon table's ×), whatever hit
          var rflight = 420, rplan = oc ? roundPlan(rn, oc) : null;
          if (SFX) SFX.rocket(hits);
          for (var r = 0; r < rn; r++) {
            (function (i) {
              setTimeout(function () {
                if (!alive()) return;
                var F = pick(from, i);
                add({ kind: 'muzzle', x: F.x, y: F.y, up: F.up, mz: F.mz, dur: 180, big: true, blocking: true });
                var rto = landing(oc, rplan, i, rn, to, from, rocketSpot(to, i));
                add({
                  kind: 'missile', from: F, to: oc ? rto : to, rocket: true, seed: i,
                  dur: rflight, blocking: true
                });
                setTimeout(function () {
                  // as `blast: 'frag'` asks: each rocket a smaller blast, scattered about the mark
                  down(rto);
                  if (alive() && spec.blast === 'frag') fragBlast(rto, 0.8, i);
                  land(i === rn - 1 ? 3 : 0, oc ? rto : undefined);
                }, rflight);
              }, i * 78);
            })(r);
          }
          return rn * 78 + rflight + 420;
        }

        /* A cone of fire. Nothing flies: the ground between burns. */
        case 'flame': {
          var span = flameJets(from, to, 6, function () { land(2); }, oc);
          return span + 220;
        }

        /* A Gauss weapon: an instant white line, gone as you look at it. */
        /* A Gauss weapon: an instant white line, gone as you look at it. `n` is
           how many go out — a marksman's rifle fires one, a crew-served cannon
           puts three down in quick succession. */
        case 'rail': {
          var shots = spec.n || 1;
          var railGap = 170, rlplan = oc ? roundPlan(shots, oc) : null, rlk = 0;
          for (var rs = 0; rs < shots; rs++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.rail();
                // each line leaves its own barrel, spread through a squad rather than the two at the front
                var rl = rlplan ? lineRound(rlplan[j], rlplan[j] === 'kill' ? rlk++ : 0, oc, from, to) : { to: to };
                add({ kind: 'rail', from: R.isMachine(shooter) ? pick(from, j) : spread(from, j, shots), to: rl.to, low: rl.low, over: rl.over, rgb: shotRGB(shooter), dur: 380, blocking: true });
                if (rlplan && (rl.glance || rlplan[j] === 'kill')) strike(rl.glance ? 'glance' : 'kill', rl.to, oc, from, to, 0, true, rl.k);
                else if (rlplan && !rl.over) add({ kind: 'impact', x: rl.to.x, y: rl.to.y, up: to.up || 0, n: 2, rgb: shotRGB(shooter), dur: 460, blocking: true });
                if (j === shots - 1) setTimeout(function () { land(1); }, 90);
                redraw();
              }, j * railGap);
            })(rs);
          }
          return 560 + (shots - 1) * railGap;
        }

        default:
          playStream(spec.p, shooter, from, to, hits, land, spec.splash, o.outcome);
          return Math.max(820, streamLength(spec.p, hits) + 320);
      }
    }

    // where a secondary's round comes down: its own burst, the casualties left to the primary
    function secondaryLands(shooter, to, n) {
      add({ kind: 'impact', x: to.x, y: to.y, up: to.up, rgb: shotRGB(shooter), n: n, dur: 420, blocking: true });
      if (SFX) SFX.impact();
    }

    /* A secondary weapon: the coaxial under a tank's main gun, the guns beneath a
       gunship's rockets, the grenades assault troops throw as they close. It makes
       its own noise and its own mark, but the casualties belong to the primary —
       they are one attack, resolved once. */
    /* `outcome` (when the shot's outcome is known): the secondary's rounds are shared
       out the same way as the primary's — into the men who fall, close in for the
       Suppression, wide or over for the rest — so the coaxial and the main gun together
       show what the attack did. */
    /* A gun with a Gauss weapon beside it (a sniper team's, a hull's coaxial rail)
       fires the two as a pair: each rail line goes out with a shell, from the same
       barrel to the same spot (primary, 'shell'), not as a secondary of its own. */
    function paired(spec) { return !!spec && spec.s === 'rail' && (spec.p === 'shell' || spec.p === 'shellbig'); }

    function playSecondary(style, shooter, from, to, hits, count, outcome) {
      if (FIRE[style]) { playStream(style, shooter, from, to, hits, null, null, outcome); return; }
      var oc = outcome || null;
      switch (style) {
        case 'energy': playEnergy(shooter, from, to, count, null, 120, oc); return;
        case 'orb': playOrbs(shooter, from, to, count, null, !R.isMachine(shooter), false, oc); return;
        case 'orbbig': playOrbs(shooter, from, to, count, null, false, true, oc); return;
        case 'plasmabolt': playPlasmaBolts(shooter, from, to, count, null, oc); return;
        case 'spit': case 'spitbig': {
          var sn = count || 1, sfl = 480, snp = oc && sn > 1 ? roundPlan(sn, oc) : null;
          for (var q0 = 0; q0 < sn; q0++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.spit(0, style === 'spitbig');
                var aim = landing(oc, snp, j, sn, to, from, sn > 1 ? { x: to.x + (j - (sn - 1) / 2) * 0.9, y: to.y + (j % 2 ? 0.6 : -0.6), up: to.up } : to);
                add({ kind: 'glob', from: pick(from, j), to: aim, dur: sfl, big: style === 'spitbig', blocking: true });
                setTimeout(function () {
                  if (!alive()) return;
                  down(aim);
                  add({ kind: 'splat', x: aim.x, y: aim.y, up: aim.up, dur: 560, blocking: true });
                  if (SFX) SFX.splat();
                }, sfl);
                redraw();
              }, j * 170);
            })(q0);
          }
          return;
        }
        case 'molotov': playMolotovs(shooter, from, to, count, null, oc); return;
        case 'frag': playFrags(shooter, from, to, count, null, oc); return;
        case 'arc': case 'arcbig': {
          /* Thrown charges: a short, high lob with a puff where it lands, and
             `count` of them — assault troops go in with a grenade in each hand. */
          var flight = 520, thrown = count || 1, thp = oc && thrown > 1 ? roundPlan(thrown, oc) : null;
          // a squad with a shoulder pod fires its charges from the leader's pod rather than throwing them
          var throwFrom = from.pod ? { x: from.x, y: from.y, up: from.up, mz: from.pod, pool: from.pods } : from;
          for (var q = 0; q < thrown; q++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                // spread them either side of the mark rather than one on top of the other
                var aim = landing(oc, thp, j, thrown, to, from, thrown > 1
                  ? { x: to.x + (j - (thrown - 1) / 2) * 1.4, y: to.y + (j % 2 ? 0.9 : -0.9), up: to.up }
                  : to);
                if (SFX) SFX.launch();
                add({ kind: 'lob', from: from.pod ? pick(throwFrom, j) : spread(throwFrom, j, thrown), to: aim, dur: flight, heavy: style === 'arcbig', blocking: true });
                setTimeout(function () {
                  if (!alive()) return;
                  down(aim);
                  if (R.weaponSpec(shooter).blast === 'frag') { fragBlast(aim, style === 'arcbig' ? 1.5 : 1.05, j); return; }
                  add({ kind: 'impact', x: aim.x, y: aim.y, up: aim.up, n: 4, dur: 380, blocking: true });
                  if (SFX) SFX.impact();
                }, flight);
                redraw();
              }, j * 190);
            })(q);
          }
          return;
        }
        case 'shell': case 'shellbig': {
          // `count` rounds in quick succession, each with its own flash and bolt
          var fired = count || 1, shp2 = oc && fired > 1 ? roundPlan(fired, oc) : null;
          for (var q2 = 0; q2 < fired; q2++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.shell();
                var sto = landing(oc, shp2, j, fired, to, from, to);
                add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pick(from, j).mz, dur: 240, big: true, blocking: true });
                add({ kind: 'bolt', from: pick(from, j), to: sto, dur: 300, heavy: style === 'shellbig', blocking: true });
                setTimeout(function () {
                  if (!alive()) return;
                  down(sto);
                  if (R.weaponSpec(shooter).blast === 'frag') fragBlast(sto, style === 'shellbig' ? 1.5 : 1.05, j);
                  else secondaryLands(shooter, sto, style === 'shellbig' ? 3 : 2);
                }, 300);
                redraw();
              }, j * 230);
            })(q2);
          }
          return;
        }
        case 'rail': {
          var lines = count || 1, lnp = oc ? roundPlan(lines, oc) : null, lnk = 0;
          for (var q3 = 0; q3 < lines; q3++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.rail();
                var rl = lnp ? lineRound(lnp[j], lnp[j] === 'kill' ? lnk++ : 0, oc, from, to) : { to: to };
                add({ kind: 'rail', from: pick(from, j), to: rl.to, low: rl.low, over: rl.over, rgb: shotRGB(shooter), dur: 380, blocking: true });
                redraw();
              }, j * 170);
            })(q3);
          }
          return;
        }
        case 'missile': {
          // missiles off the rail one after another, not all at once
          var birds = count || 1, bdp = oc && birds > 1 ? roundPlan(birds, oc) : null;
          for (var q4 = 0; q4 < birds; q4++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.missile(0, 0.9, 0.47);
                var mto = landing(oc, bdp, j, birds, to, from, to);
                add({ kind: 'missile', from: pick(from, j), to: mto, seed: j, dur: 900, blocking: true });
                setTimeout(function () {
                  if (!alive()) return;
                  down(mto);
                  if (R.weaponSpec(shooter).blast === 'frag') fragBlast(mto, 1.2, j);
                  else secondaryLands(shooter, mto, 3);
                }, 900);
                redraw();
              }, j * 260);
            })(q4);
          }
          return;
        }
        case 'rocket': {
          // a rack of unguided rockets, rippling off in a salvo of as many as its weapon fires (the weapon table's ×)
          var rk = Math.max(1, Math.min(6, count || 1));
          if (SFX) SFX.rocket(Math.min(3, rk));
          var rkp = oc ? roundPlan(rk, oc) : null;
          for (var q5 = 0; q5 < rk; q5++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                var rto = landing(oc, rkp, j, rk, to, from, rocketSpot(to, j));
                add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pick(from, j).mz, dur: 180, big: true, blocking: true });
                add({ kind: 'missile', from: pick(from, j), to: oc ? rto : to, rocket: true, seed: j, dur: 420, blocking: true });
                setTimeout(function () { if (alive()) down(rto); }, 420);
                if (R.weaponSpec(shooter).blast === 'frag') setTimeout(function () { if (alive()) fragBlast(rto, 0.8, j); }, 420);
                else if (oc) setTimeout(function () { if (alive()) secondaryLands(shooter, rto, 2); }, 420);
                else if (j === rk - 1) setTimeout(function () { if (alive()) secondaryLands(shooter, to, 3); }, 420);
                redraw();
              }, j * 78);
            })(q5);
          }
          return;
        }
        case 'flame':
          flameJets(from, to, 4, null, oc);
          return;
        default:
          playStream(style, shooter, from, to, hits, null, null, oc);
      }
    }

    /* The four styles that put a stream of rounds down: rifles, SMGs, machine guns
       and autocannon. They differ only in how many, how fast and how they look, so
       one routine draws them all. `land` is null for a secondary, which does its
       own noise but leaves the casualties to the primary. `splash` lands every
       round in its own small burst of light around the mark (the Delta SMGs). */
    /* What each round of a volley does, when the shot's outcome is known (the rules'
       ladder, shoot.js missRungs, as shares): the kills go into the men who fall; the
       near misses into the ground at their feet, kicking it up; the deflections
       strike one of them and glance off; the rest go over their heads and on, for
       nothing. `outcome`: { kill, supp, glance } as shares 0-1, `figs`, where the
       fallen stood, and `all`, where every man stood. */
    /* Where a round strikes them: a deflection pings off their armour and flies on;
       one that kills throws a spray on away from the shooter, as the target bleeds
       (outcome.blood; `hitFx: 'sparks'` for a hull, a drone or a Xeno's plates). */
    /* (`k`, for a kill: the how-manyth man the attack kills, told to outcome.onKill as
       the round strikes him, so he drops then) */
    function strike(role, at, outcome, from, to, delay, fat, k) {
      if (role === 'kill' && outcome && outcome.onKill && k != null) setTimeout(function () { if (alive()) outcome.onKill(k); }, delay || 0);
      if (role === 'glance') {
        add({ kind: 'ricochet', x: at.x, y: at.y, up: (to.up || 0) + 0.6, seed: Math.floor(Math.random() * 1000), delay: delay, dur: 380 + delay, blocking: true });
      } else if (role === 'kill') {
        add({ kind: 'spray', x: at.x, y: at.y, up: (to.up || 0) + 0.6, dx: at.x - from.x, dy: at.y - from.y,
          rgb: (outcome && outcome.blood) || '170,30,25', spark: !!(outcome && outcome.hitFx === 'sparks'),
          n: fat ? 16 : 10, seed: Math.floor(Math.random() * 1000), delay: delay, dur: 560 + delay, blocking: true });
      }
    }
    /* A critical hit on a hull: a shower of sparks off it for each, one after another. */
    function crits(to, n) {
      for (var i = 0; i < (n || 0); i++) {
        add({ kind: 'sparks', x: to.x + (Math.random() - 0.5) * 0.8, y: to.y + (Math.random() - 0.5) * 0.8, up: (to.up || 0) + 0.4,
          seed: Math.floor(Math.random() * 1000), n: 34, delay: i * 160, dur: 950 + i * 160, blocking: true });
      }
      if (n) redraw();
    }
    function roundPlan(n, outcome) {
      var kill = Math.max(0, Math.min(1, outcome.kill || 0)), supp = Math.max(0, Math.min(1 - kill, outcome.supp || 0));
      var kN = Math.round(n * kill), sN = Math.round(n * supp);
      if (kill > 0 && !kN) kN = 1;
      // a round for every man it kills, so each drops as his own round strikes him (outcome.minKill)
      if (outcome.minKill) kN = Math.max(kN, Math.min(n, outcome.minKill));
      if (supp > 0 && !sN && kN < n) sN = 1;
      sN = Math.min(sN, n - kN);
      // and the rounds that reach them and are stopped by their armour: they strike and glance off
      var glance = Math.max(0, Math.min(1, outcome.glance || 0)), gN = Math.min(n - kN - sN, Math.round(n * glance));
      var plan = [], i;
      for (i = 0; i < kN; i++) plan.push('kill');
      for (i = 0; i < sN; i++) plan.push('supp');
      for (i = 0; i < gN; i++) plan.push('glance');
      while (plan.length < n) plan.push('over');
      // dealt through the volley rather than in blocks, the killing rounds not all at the start
      for (i = plan.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = plan[i]; plan[i] = plan[j]; plan[j] = t; }
      return plan;
    }
    /* Where the j-th of n rounds that come down on a spot (a grenade, a shell, a
       rocket, a glob) lands, when the shot's outcome is known: a round that kills
       lands among the men who fall; one that only pins them close by; one that does
       nothing well off. A lone round lands on the men if it kills, among their feet
       if it puts any Suppression on them, on one of them if their armour turned any
       of it, and misses only if none of these. Off
       to either side, or short and over along the line of fire. `plan` is the
       volley's roundPlan; `def` where the round would have come down otherwise. */
    /* A round coming down where it was meant to kill (landing tags the spot): the man
       it kills drops now — or, a lone round killing several, all of them. */
    function down(spot) {
      if (!spot || spot.kill == null || !spot.oc || !spot.oc.onKill) return;
      var k0 = spot.kill, k1 = spot.killAll ? Math.max(k0 + 1, spot.oc.minKill || 1) : k0 + 1;
      spot.kill = null;
      for (var k = k0; k < k1; k++) spot.oc.onKill(k);
    }
    function landing(outcome, plan, j, n, to, from, def) {
      if (!outcome) return def;
      var lx = to.x - from.x, ly = to.y - from.y, ll = Math.hypot(lx, ly) || 1;
      lx /= ll; ly /= ll;
      var figs = outcome.figs || [], kill = Math.max(0, outcome.kill || 0), supp = Math.max(0, outcome.supp || 0);
      function off(d) {
        // along the line (short or over) more than across it, as rounds fall
        var along = (Math.random() < 0.5 ? -1 : 1) * d * (0.55 + Math.random() * 0.45), across = (Math.random() - 0.5) * 2 * d * 0.6;
        return { x: to.x + lx * along - ly * across, y: to.y + ly * along + lx * across, up: to.up };
      }
      function onMan(k, among) {
        var fs = among || figs, f = fs.length ? fs[k % fs.length] : to;
        return { x: f.x + (Math.random() - 0.5) * 0.4, y: f.y + (Math.random() - 0.5) * 0.4, up: to.up };
      }
      // on any of them, the fallen or not: a round their armour turns
      function onAny() { var all = outcome.all || figs; return onMan(Math.floor(Math.random() * Math.max(1, all.length)), all); }
      if (n <= 1) {
        // a lone round is the whole attack: on the men if it kills, among their feet if it
        // pins them at all, off one of them if it reached them, and wide only if none of these
        if (kill > 0) { var lone = onMan(0); lone.kill = 0; lone.killAll = true; lone.oc = outcome; return lone; }
        if (supp > 0) { var near = onMan(Math.floor(Math.random() * Math.max(1, figs.length))); return { x: near.x + (Math.random() - 0.5) * 0.6, y: near.y + (Math.random() - 0.5) * 0.6, up: to.up }; }
        if ((outcome.glance || 0) > 0) return onAny();
        return off(1.2 + Math.random() * 1.2);
      }
      var role = plan ? plan[j] : 'over';
      if (role === 'kill') {
        // the how-manyth killing round: the man it kills drops as it comes down (down)
        var kk = plan.slice(0, j).filter(function (r) { return r === 'kill'; }).length, ks = onMan(kk);
        ks.kill = kk; ks.oc = outcome;
        return ks;
      }
      if (role === 'supp') return off(0.5 + Math.random() * 0.7);
      if (role === 'glance') return onAny();
      return off(1.6 + Math.random() * 1.2);
    }
    /* Where a round fired straight at the mark (a bullet, a spine, an energy pulse, a
       Gauss line) ends up, by the part it is dealt in the volley (roundPlan): in one
       of the men who fall (`k`, the how-manyth killing round), in the ground short of
       them and among their feet (`low`), into any of them and turned by their armour
       (`glance`), or over their heads and on (`over`). */
    function lineRound(role, k, outcome, from, to) {
      var lx = to.x - from.x, ly = to.y - from.y, ll = Math.hypot(lx, ly) || 1;
      lx /= ll; ly /= ll;
      // how far either side of the line a round strays: a tight cone, not a fan
      var jitter = (Math.random() - 0.5) * 0.9;
      if (role === 'kill') {
        var figs = outcome.figs || [], fig = figs.length ? figs[k % figs.length] : to;
        return { to: { x: fig.x, y: fig.y, up: to.up }, k: k };
      }
      if (role === 'glance') {
        // into one of them, the fallen or not, and turned by the armour: sparks off it
        var all = outcome.all || outcome.figs || [], man = all.length ? all[Math.floor(Math.random() * all.length)] : to;
        return { to: { x: man.x, y: man.y, up: to.up }, glance: true };
      }
      if (role === 'supp') {
        var short = 0.2 + Math.random() * 1.1;
        return { to: { x: to.x - lx * short - ly * jitter, y: to.y - ly * short + lx * jitter, up: to.up }, low: true };
      }
      var past = 2.5 + Math.random() * 2.5;
      return { to: { x: to.x + lx * past - ly * jitter, y: to.y + ly * past + lx * jitter, up: to.up }, over: true };
    }
    function playStream(style, shooter, from, to, hits, land, splash, outcome) {
      var f = FIRE[style] || FIRE.small;
      var n = f.n(hits);
      var plan = outcome ? roundPlan(n, outcome) : null;
      var heavy = shooter.fp >= 5;
      // a double burst is heard as two, the second where its rounds start
      var second = f.bursts ? roundAt(f, n, Math.ceil(n / f.bursts)) / 1000 : 0;
      // a Xenotripod unit's guns keep their rhythm but fire energy, not rounds
      if (SFX && R.isXeno(shooter) && SFX.zaps) {
        if (second) { SFX.zaps(style, hits, 0, Math.ceil(n / 2)); SFX.zaps(style, hits, second, Math.floor(n / 2)); }
        else SFX.zaps(style, hits);
      } else if (SFX) {
        if (style === 'chain') SFX.chain(hits);
        // each burst heard round for round as it is drawn
        else if (style === 'burst') { SFX.rattle(0, 0, Math.ceil(n / 2)); SFX.rattle(0, second, Math.floor(n / 2)); }
        else if (style === 'smg') SFX.smg(hits);
        else if (style === 'pistol') SFX.pistol(hits);
        else if (style === 'spine') SFX.spine(hits);
        else SFX.burst(hits, heavy);
      }
      // each round goes to the next man along, so a volley comes from the rank
      var pool = from.pool || [from.mz];
      function gun(i) { return { x: from.x, y: from.y, up: from.up, mz: pool[i % pool.length] }; }
      if (f.noFlash) {
        // nothing to flash: a bug has no muzzle
      } else if (f.perShot) {
        for (var m = 0; m < n; m++) {
          add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pool[m % pool.length], rgb: shotRGB(shooter), delay: m * f.gap, dur: f.muzzle + m * f.gap, blocking: true });
        }
      } else {
        // a sustained burst: every gun in the squad flashing for the length of it
        for (var m2 = 0; m2 < Math.min(pool.length, n); m2++) {
          add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pool[m2], rgb: shotRGB(shooter), delay: m2 * 23, dur: f.muzzle + m2 * 23, blocking: true });
        }
      }
      var kills = 0;
      for (var i = 0; i < n; i++) {
        // a clumped weapon pauses between bursts; the rest fire evenly
        var at = roundAt(f, n, i);
        if (plan) {
          var lr = lineRound(plan[i], plan[i] === 'kill' ? kills++ : 0, outcome, from, to), dest = lr.to;
          add({ kind: 'tracer', from: gun(i), to: dest, low: lr.low, over: lr.over, fat: f.tracer.fat, short: f.tracer.short, bio: f.tracer.bio,
            rgb: shotRGB(shooter), delay: at, dur: (lr.over ? 330 : 250) + at, blocking: true });
          if (lr.glance) {
            // turned by their armour: sparks off it
            strike('glance', dest, outcome, from, to, at + 200);
          } else if (plan[i] === 'kill') {
            // where it strikes (a hull: sparks off it)
            strike('kill', dest, outcome, from, to, at + 200, f.tracer.fat, lr.k);
          } else if (lr.low) {
            // the dirt kicked up at their feet
            add({ kind: 'miss', x: dest.x, y: dest.y, up: to.up, delay: at + 200, dur: 520 + at, blocking: true });
          }
          // a round that bursts (`splash`) bursts where it ends, if it ends on anything
          if (splash && !lr.over) {
            add({ kind: 'impact', n: 2, rgb: shotRGB(shooter) || splashRGB(shooter), delay: at + 240, dur: 520 + at, blocking: true, x: dest.x, y: dest.y, up: to.up });
          }
          continue;
        }
        add({
          kind: 'tracer', from: gun(i), to: to,
          spread: f.tracer.spread, fat: f.tracer.fat, short: f.tracer.short, bio: f.tracer.bio, rgb: shotRGB(shooter),
          delay: at, dur: 250 + at, blocking: true
        });
        if (splash) {
          add({
            kind: 'impact', n: 2, rgb: shotRGB(shooter) || splashRGB(shooter), delay: at + 240, dur: 520 + at, blocking: true,
            x: to.x + (Math.random() - 0.5) * 1.6, y: to.y + (Math.random() - 0.5) * 1.6, up: to.up
          });
        }
      }
      if (land) setTimeout(function () { land(style === 'chain' ? 1 : 0); }, f.land);
    }

    return {
      FIRE: FIRE, streamLength: streamLength, glowRGB: glowRGB, shotRGB: shotRGB,
      primary: primary, secondary: playSecondary, paired: paired, crits: crits, stream: playStream, energy: playEnergy, orbs: playOrbs,
      flameJets: flameJets, spread: spread, pick: pick, hit: hit, suppress: suppress, curve: curveFor
    };
  }

  /* A squad's guns: every surviving man's muzzle, and which of them each of
     its weapons fires from. `pool` is ISO.muzzles for the unit; `from` gains
     the muzzle (mz), the pool, the leader's shoulder pod if it carries one,
     and poolFor(style) for a secondary. */
  function troop(from, spec, pool) {
    // the grenades leave the shoulder pods, where the squad carries them: the leader's, or every drone's
    var pods = pool.filter(function (m) { return m.pod; }).map(function (m) { return m.pod; });
    if (pods.length) { from.pod = pods[0]; from.pods = pods; }
    // a spotter with his optics up is not one of the guns
    var guns = pool.filter(function (m) { return !m.tool; });
    if (guns.length) pool = guns;
    // a Delta with only blades in its hands leaves the shooting to the ones carrying SMGs
    var armed = pool.filter(function (m) { return m.gun !== 'blades'; });
    if (armed.length) pool = armed;
    /* A machine gun's burst comes off the men holding machine guns; the carbines
       and rifles off everyone else — each weapon from the hands that carry it. */
    var mgs = pool.filter(function (m) { return /^(mg|saw)$/.test(m.gun || ''); });
    var rest = pool.filter(function (m) { return !/^(mg|saw)$/.test(m.gun || ''); });
    var poolFor = function (style) {
      var mgStyle = style === 'burst' || style === 'chain';
      // (a SAW in a rifle squad is one of its rifles: only a unit with an MG weapon splits its men)
      var mgUnit = /^(burst|chain)$/.test(spec.p) || /^(burst|chain)$/.test(spec.s || '') || /^(burst|chain)$/.test(spec.t || '');
      var pl = mgStyle ? (mgs.length ? mgs : pool) : (mgUnit && rest.length && mgs.length ? rest : pool);
      // a shell or a missile leaves a launcher, where the squad carries them
      var tubes = pool.filter(function (m) { return /^(rpg|atlauncher)$/.test(m.gun || ''); });
      if (style === 'shell' || style === 'missile') {
        if (tubes.length) pl = tubes;
      } else if (tubes.length && [spec.p, spec.s, spec.t].some(function (x) { return x === 'shell' || x === 'missile'; })) {
        // and where the launcher is one of the unit's weapons, the man carrying it fires nothing else
        var others = pl.filter(function (m) { return tubes.indexOf(m) < 0; });
        if (others.length) pl = others;
      }
      return { x: from.x, y: from.y, up: from.up, mz: pl[0], pool: pl, pod: from.pod, pods: from.pods };
    };
    if (pool.length) { var pf = poolFor(spec.p); from.mz = pf.mz; from.pool = pf.pool; from.poolFor = poolFor; }
    return from;
  }

  // the colours a weapon entry's `glow` may name
  var GLOWS = { blue: '110,190,255', green: '150,220,80', red: '255,110,90', violet: '190,140,255', amber: '255,190,90', white: '235,240,255' };
  /* The styles whose rounds are drawn landing one by one when a shot carries its
     outcome: each puts its own strike or dirt down, so nothing more is burst over
     the mark as the shot lands. */
  var DRAWN_EACH = ['none', 'small', 'spine', 'pistol', 'smg', 'burst', 'chain', 'energy', 'rail', 'flame'];
  /* The rules' ladder for a shot (shoot.js, missRungs: far misses, deflections,
     near misses and kills, as counts or shares) as the shares roundPlan deals the
     rounds out by. */
  function shares(L) {
    var n = (L.far || 0) + (L.glance || 0) + (L.near || 0) + (L.kill || 0) || 1;
    return { kill: (L.kill || 0) / n, supp: (L.near || 0) / n, glance: (L.glance || 0) / n };
  }
  /* What a round that kills throws off its target: a man's blood (PMC, Rebels), a
     bug's green ichor, blue sparks off a Xeno, sparks off a hull or a drone. */
  function bleedOf(t, R) {
    if (!t) return { blood: '170,30,25', hitFx: 'blood' };
    if (R.isMachine(t) || R.has(t, 'Drone unit')) return { blood: '255,205,130', hitFx: 'sparks' };
    if (R.isXeno(t)) return { blood: '120,190,255', hitFx: 'sparks' };
    if (t.faction === 'bugs' || /bug|swarm|larv/.test(t.art || '')) return { blood: '110,175,45', hitFx: 'blood' };
    return { blood: '170,30,25', hitFx: 'blood' };
  }
  root.PMCFire = { GLOWS: GLOWS, make: make, troop: troop, DRAWN_EACH: DRAWN_EACH, shares: shares, bleedOf: bleedOf, XENO_BLUE: '110,190,255', BUG_GREEN: '150,220,80' };
})(typeof window !== 'undefined' ? window : globalThis);
