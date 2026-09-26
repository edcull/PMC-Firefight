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
    var FIRE = {
      /* A rifle line: aimed shots, not a stream. Eight men firing deliberately put
         fewer rounds down per second than an autocannon does — what makes it read
         as a volley is that it runs on for a second, not that it is fast. */
      small:    { n: function (h) { return clampN(h * 2 + 3, 5, 11); }, gap: 112, tracer: { spread: 0.42 }, land: 330, muzzle: 520, perShot: true },
      /* A sidearm: a few deliberate shots with a long gap between them, at close
         range. Fewer rounds than anything else fires, and you can count them. */
      pistol:   { n: function (h) { return clampN(h + 2, 3, 6); }, gap: 185, tracer: { spread: 0.34, short: true }, land: 300, muzzle: 150, perShot: true },
      /* A carbine at close range: quicker than an aimed rifle line and with more
         rounds in it, but still recognisably single shots rather than a stream. */
      smg:      { n: function (h) { return clampN(h * 2 + 4, 5, 12); }, gap: 68, tracer: { spread: 0.5, short: true }, land: 300, muzzle: 460 },
      // a machine gun, rattling
      burst:    { n: function (h) { return clampN(h * 2 + 4, 6, 12); }, gap: 38, tracer: { spread: 0.55 }, land: 300, muzzle: 460 },
      // an autocannon: heavier, slower, countable
      chain:    { n: function (h) { return clampN(h * 2 + 3, 5, 10); }, gap: 92, tracer: { spread: 0.3, fat: true }, land: 330, muzzle: 92, perShot: true },
      // a bug's volley of chitin spines: a quick dry spray, bone-pale, no flash
      spine:    { n: function (h) { return clampN(h * 2 + 4, 6, 12); }, gap: 45, tracer: { spread: 0.6, short: true, bio: true }, land: 320, muzzle: 0, noFlash: true }
    };
    function clampN(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
    // how long a stream of that style takes to get all its rounds away
    function streamLength(style, hits) {
      var f = FIRE[style] || FIRE.small;
      var n = f.n(hits);
      if (!f.clump) return n * f.gap;
      return Math.floor((n - 1) / f.clump) * f.clumpGap + ((n - 1) % f.clump) * f.gap;
    }

    /* A flamethrower is not one squeeze of a trigger. The operator holds it down
       and walks the cone across the frontage, in two or three jets, each one
       laid a little off the last — which is why it takes ground rather than
       picking a target out of it. */
    var FLAME_JET = 620, FLAME_GAP = 165;
    function flameJets(from, to, n, onLand) {
      var dx = to.x - from.x, dy = to.y - from.y;
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
    var BUG_GREEN = '150,220,80';
    function glowRGB(u) { return XENO_BLUE; }
    function shotRGB(u) { return R.isXeno(u) ? XENO_BLUE : null; }
    function playEnergy(shooter, from, to, count, land, gap) {
      var rgb = glowRGB(shooter), n = count || 1;
      for (var q = 0; q < n; q++) {
        (function (j) {
          setTimeout(function () {
            if (!alive()) return;
            if (SFX) (SFX.zap || SFX.rail).call(SFX);
            add({ kind: 'pulse', from: pick(from, j), to: to, rgb: rgb, dur: 260, blocking: true });
            if (land) setTimeout(function () { land(j === n - 1 ? 1 : 0); }, 250);
            redraw();
          }, j * (gap || 120));
        })(q);
      }
      return n * (gap || 120) + 300;
    }
    function playOrbs(shooter, from, to, count, land, tele, big) {
      var rgb = glowRGB(shooter), n = count || 1;
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
            var aim = n > 1 ? { x: to.x + (j - (n - 1) / 2) * 1.1, y: to.y + (j % 2 ? 0.7 : -0.7), up: to.up } : to;
            add({ kind: 'orb', from: pick(from, j), to: aim, rgb: rgb, tele: !!tele, exit: exit, big: !!big, dur: fl, blocking: true });
            setTimeout(function () {
              if (!alive()) return;
              add({ kind: 'orbburst', x: aim.x, y: aim.y, up: aim.up, rgb: rgb, big: !!big, dur: big ? 800 : 600, blocking: true });
              /* A heavy round throws the ground up with it: a wider ring of blue
                 fire and a scatter of it around the crater. */
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
              if (land && j === n - 1) land(2);
            }, fl);
            redraw();
          }, j * 200);
        })(q);
      }
      return fl + (n - 1) * 200 + 600;
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

    /* The primary weapon, played out. `o` carries the hits it scored, the range
       (how long anything lobbed is in the air), and `land(extra)`, called as
       the rounds arrive. Returns how long it takes, in ms, before any
       secondary is added on. */
    function primary(spec, shooter, from, to, o) {
      var hits = o.hits || 1, land = o.land, dist = o.dist || 0, curve = curveFor(shooter, dist);
      switch (spec.p) {
        case 'none':
          // nothing in hand: what it throws (the secondary) is the attack, and lands its hits
          if (spec.s) { setTimeout(function () { land(3); }, 150 + 520 + ((spec.sn || 1) - 1) * 170); return 120; }
          return 120;

        // Xenotripod small arms: pulses of the army's own light
        case 'energy': {
          return playEnergy(shooter, from, to, spec.n, land, R.isMachine(shooter) ? 150 : 110);
        }
        // plasma orbs: lobbed from craft and turrets, teleported from a Gamma's launcher
        case 'orb': {
          return playOrbs(shooter, from, to, spec.n, land, !R.isMachine(shooter));
        }
        // an energy howitzer: heavier orbs, lobbed, bursting blue on the ground
        case 'orbbig': {
          return playOrbs(shooter, from, to, spec.n, land, false, true);
        }

        /* Bug acid: a glob (or `n` of them from the squad) lobbed low, landing in
           a green splash. `spitbig` is a sac of bio-plasma, bigger and slower. */
        case 'spit':
        case 'spitbig': {
          var sbig = spec.p === 'spitbig';
          var sr = dist;
          var sflight = Math.round((sbig ? 560 : 420) + Math.min(600, sr * 12));
          var globs = spec.n || 1, sgap = sbig ? 260 : 150;
          for (var gi = 0; gi < globs; gi++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                var F = pick(from, j);
                if (SFX) SFX.spit(0, sbig);
                var aim = globs > 1
                  ? { x: to.x + (j - (globs - 1) / 2) * 0.9, y: to.y + (j % 2 ? 0.6 : -0.6), up: to.up }
                  : to;
                add({ kind: 'glob', from: F, to: aim, dur: sflight, big: sbig, blocking: true });
                setTimeout(function () {
                  if (!alive()) return;
                  add({ kind: 'splat', x: aim.x, y: aim.y, up: aim.up, big: sbig, dur: 620, blocking: true });
                  if (SFX) SFX.splat();
                  if (j === globs - 1) land(sbig ? 3 : 1);
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
          var rounds = spec.n || 1, shellGap = 230;
          var flightMs = big ? 340 : 300;
          for (var sh = 0; sh < rounds; sh++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                var F = pick(from, j);
                if (SFX) SFX.shell();
                add({ kind: 'muzzle', x: F.x, y: F.y, up: F.up, mz: F.mz, dur: big ? 320 : 260, big: true, blocking: true });
                add({ kind: 'bolt', from: F, to: to, dur: flightMs, heavy: big, blocking: true });
                setTimeout(function () { land(big ? 4 : 2); }, flightMs);
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
          var tubes = spec.n || 1;
          // the Protectors' charges leave the leader's shoulder pod, one after another
          var tubeFrom = from.pod ? { x: from.x, y: from.y, up: from.up, mz: from.pod } : from;
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
                var aim = tubes > 1
                  ? { x: to.x + (i - (tubes - 1) / 2) * 1.6, y: to.y + (i % 2 ? 1 : -1) * 0.9, up: to.up }
                  : to;
                add({ kind: 'lob', from: F, to: aim, dur: flight, heavy: heavy, blocking: true });
                if (SFX) SFX.incoming(flight / 1000 - 0.45, 0.45);
                setTimeout(function () { land(heavy ? 4 : 3); }, flight);
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
          var birdsP = spec.n || 1, birdGap = 260;
          for (var mi2 = 0; mi2 < birdsP; mi2++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                var F = pick(from, j);
                if (SFX) SFX.missile(0, mflight / 1000, mflight / 1000 * 0.52);
                // no flash at the tube: it is ejected cold and lights further out
                add({ kind: 'missile', from: F, to: to, seed: j, dur: mflight, curve: curve, blocking: true,
                  sam: shooter.art === 'samlauncher' ? { aim: shooter.facing || 0, elev: 0.8 } : null });
                setTimeout(function () { land(3); }, mflight);
                redraw();
              }, j * birdGap);
            })(mi2);
          }
          return mflight + 460 + (birdsP - 1) * birdGap;
        }

        /* Unguided rockets, off the rails in a ripple. */
        case 'rocket': {
          var rn = clampN(hits + 2, 3, 6);
          var rflight = 420;
          if (SFX) SFX.rocket(hits);
          for (var r = 0; r < rn; r++) {
            (function (i) {
              setTimeout(function () {
                if (!alive()) return;
                var F = pick(from, i);
                add({ kind: 'muzzle', x: F.x, y: F.y, up: F.up, mz: F.mz, dur: 180, big: true, blocking: true });
                add({
                  kind: 'missile', from: F, to: to, rocket: true, seed: i,
                  dur: rflight, blocking: true
                });
                setTimeout(function () { land(i === rn - 1 ? 3 : 0); }, rflight);
              }, i * 78);
            })(r);
          }
          return rn * 78 + rflight + 420;
        }

        /* A cone of fire. Nothing flies: the ground between burns. */
        case 'flame': {
          var span = flameJets(from, to, 6, function () { land(2); });
          return span + 220;
        }

        /* A Gauss weapon: an instant white line, gone as you look at it. */
        /* A Gauss weapon: an instant white line, gone as you look at it. `n` is
           how many go out — a marksman's rifle fires one, a crew-served cannon
           puts three down in quick succession. */
        case 'rail': {
          var shots = spec.n || 1;
          var railGap = 170;
          for (var rs = 0; rs < shots; rs++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.rail();
                // each line leaves its own barrel, spread through a squad rather than the two at the front
                add({ kind: 'rail', from: R.isMachine(shooter) ? pick(from, j) : spread(from, j, shots), to: to, rgb: shotRGB(shooter), dur: 380, blocking: true });
                if (j === shots - 1) setTimeout(function () { land(1); }, 90);
                redraw();
              }, j * railGap);
            })(rs);
          }
          return 560 + (shots - 1) * railGap;
        }

        default:
          playStream(spec.p, shooter, from, to, hits, land);
          return Math.max(820, streamLength(spec.p, hits) + 320);
      }
    }

    /* A secondary weapon: the coaxial under a tank's main gun, the guns beneath a
       gunship's rockets, the grenades assault troops throw as they close. It makes
       its own noise and its own mark, but the casualties belong to the primary —
       they are one attack, resolved once. */
    function playSecondary(style, shooter, from, to, hits, count) {
      if (FIRE[style]) { playStream(style, shooter, from, to, hits, null); return; }
      switch (style) {
        case 'energy': playEnergy(shooter, from, to, count, null, 120); return;
        case 'orb': playOrbs(shooter, from, to, count, null, !R.isMachine(shooter)); return;
        case 'orbbig': playOrbs(shooter, from, to, count, null, false, true); return;
        case 'spit': case 'spitbig': {
          var sn = count || 1, sfl = 480;
          for (var q0 = 0; q0 < sn; q0++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.spit(0, style === 'spitbig');
                var aim = sn > 1 ? { x: to.x + (j - (sn - 1) / 2) * 0.9, y: to.y + (j % 2 ? 0.6 : -0.6), up: to.up } : to;
                add({ kind: 'glob', from: pick(from, j), to: aim, dur: sfl, big: style === 'spitbig', blocking: true });
                setTimeout(function () {
                  if (!alive()) return;
                  add({ kind: 'splat', x: aim.x, y: aim.y, up: aim.up, dur: 560, blocking: true });
                  if (SFX) SFX.splat();
                }, sfl);
                redraw();
              }, j * 170);
            })(q0);
          }
          return;
        }
        case 'arc': case 'arcbig': {
          /* Thrown charges: a short, high lob with a puff where it lands, and
             `count` of them — assault troops go in with a grenade in each hand. */
          var flight = 520, thrown = count || 1;
          // a squad with a shoulder pod fires its charges from the leader's pod rather than throwing them
          var throwFrom = from.pod ? { x: from.x, y: from.y, up: from.up, mz: from.pod } : from;
          for (var q = 0; q < thrown; q++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                // spread them either side of the mark rather than one on top of the other
                var aim = thrown > 1
                  ? { x: to.x + (j - (thrown - 1) / 2) * 1.4, y: to.y + (j % 2 ? 0.9 : -0.9), up: to.up }
                  : to;
                if (SFX) SFX.launch();
                add({ kind: 'lob', from: from.pod ? throwFrom : spread(throwFrom, j, thrown), to: aim, dur: flight, heavy: style === 'arcbig', blocking: true });
                setTimeout(function () {
                  if (!alive()) return;
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
          var fired = count || 1;
          for (var q2 = 0; q2 < fired; q2++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.shell();
                add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pick(from, j).mz, dur: 240, big: true, blocking: true });
                add({ kind: 'bolt', from: pick(from, j), to: to, dur: 300, heavy: style === 'shellbig', blocking: true });
                redraw();
              }, j * 230);
            })(q2);
          }
          return;
        }
        case 'rail': {
          var lines = count || 1;
          for (var q3 = 0; q3 < lines; q3++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.rail();
                add({ kind: 'rail', from: pick(from, j), to: to, rgb: shotRGB(shooter), dur: 380, blocking: true });
                redraw();
              }, j * 170);
            })(q3);
          }
          return;
        }
        case 'missile': {
          // missiles off the rail one after another, not all at once
          var birds = count || 1;
          for (var q4 = 0; q4 < birds; q4++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                if (SFX) SFX.missile(0, 0.9, 0.47);
                add({ kind: 'missile', from: pick(from, j), to: to, seed: j, dur: 900, blocking: true });
                redraw();
              }, j * 260);
            })(q4);
          }
          return;
        }
        case 'rocket': {
          // a rack of unguided rockets, rippling off in a salvo
          if (SFX) SFX.rocket(3);
          for (var q5 = 0; q5 < 5; q5++) {
            (function (j) {
              setTimeout(function () {
                if (!alive()) return;
                add({ kind: 'muzzle', x: from.x, y: from.y, up: from.up, mz: pick(from, j).mz, dur: 180, big: true, blocking: true });
                add({ kind: 'missile', from: pick(from, j), to: to, rocket: true, seed: j, dur: 420, blocking: true });
                redraw();
              }, j * 78);
            })(q5);
          }
          return;
        }
        case 'flame':
          flameJets(from, to, 4, null);
          return;
        default:
          playStream(style, shooter, from, to, hits, null);
      }
    }

    /* The four styles that put a stream of rounds down: rifles, SMGs, machine guns
       and autocannon. They differ only in how many, how fast and how they look, so
       one routine draws them all. `land` is null for a secondary, which does its
       own noise but leaves the casualties to the primary. */
    function playStream(style, shooter, from, to, hits, land) {
      var f = FIRE[style] || FIRE.small;
      var n = f.n(hits);
      var heavy = shooter.fp >= 5;
      // a Xenotripod unit's guns keep their rhythm but fire energy, not rounds
      if (SFX && R.isXeno(shooter) && SFX.zaps) SFX.zaps(style, hits);
      else if (SFX) {
        if (style === 'chain') SFX.chain(hits);
        else if (style === 'burst') SFX.rattle(hits);
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
      for (var i = 0; i < n; i++) {
        // a clumped weapon pauses between bursts; the rest fire evenly
        var at = f.clump
          ? Math.floor(i / f.clump) * f.clumpGap + (i % f.clump) * f.gap
          : i * f.gap;
        add({
          kind: 'tracer', from: gun(i), to: to,
          spread: f.tracer.spread, fat: f.tracer.fat, short: f.tracer.short, bio: f.tracer.bio, rgb: shotRGB(shooter),
          delay: at, dur: 250 + at, blocking: true
        });
      }
      if (land) setTimeout(function () { land(style === 'chain' ? 1 : 0); }, f.land);
    }

    return {
      FIRE: FIRE, streamLength: streamLength, glowRGB: glowRGB, shotRGB: shotRGB,
      primary: primary, secondary: playSecondary, stream: playStream, energy: playEnergy, orbs: playOrbs,
      flameJets: flameJets, spread: spread, pick: pick, hit: hit, curve: curveFor
    };
  }

  /* A squad's guns: every surviving man's muzzle, and which of them each of
     its weapons fires from. `pool` is ISO.muzzles for the unit; `from` gains
     the muzzle (mz), the pool, the leader's shoulder pod if it carries one,
     and poolFor(style) for a secondary. */
  function troop(from, spec, pool) {
    // the grenades leave the leader's shoulder pod, where the squad carries one
    var pod = pool.filter(function (m) { return m.pod; })[0];
    if (pod) from.pod = pod.pod;
    // a spotter with his optics up is not one of the guns
    var guns = pool.filter(function (m) { return !m.tool; });
    if (guns.length) pool = guns;
    /* A machine gun's burst comes off the men holding machine guns; the carbines
       and rifles off everyone else — each weapon from the hands that carry it. */
    var mgs = pool.filter(function (m) { return /^(mg|saw)$/.test(m.gun || ''); });
    var rest = pool.filter(function (m) { return !/^(mg|saw)$/.test(m.gun || ''); });
    var poolFor = function (style) {
      var mgStyle = style === 'burst' || style === 'chain';
      // (a SAW in a rifle squad is one of its rifles: only a unit with an MG weapon splits its men)
      var mgUnit = /^(burst|chain)$/.test(spec.p) || /^(burst|chain)$/.test(spec.s || '');
      var pl = mgStyle ? (mgs.length ? mgs : pool) : (mgUnit && rest.length && mgs.length ? rest : pool);
      // a shell or a missile leaves a launcher, where the squad carries them
      if (style === 'shell' || style === 'missile') {
        var tubes = pool.filter(function (m) { return /^(rpg|atlauncher)$/.test(m.gun || ''); });
        if (tubes.length) pl = tubes;
      }
      return { x: from.x, y: from.y, up: from.up, mz: pl[0], pool: pl, pod: from.pod };
    };
    if (pool.length) { var pf = poolFor(spec.p); from.mz = pf.mz; from.pool = pf.pool; from.poolFor = poolFor; }
    return from;
  }

  root.PMCFire = { make: make, troop: troop, XENO_BLUE: '110,190,255', BUG_GREEN: '150,220,80' };
})(typeof window !== 'undefined' ? window : globalThis);
