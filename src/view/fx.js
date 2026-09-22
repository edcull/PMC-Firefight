/* PMC 2670 — Firefight : the effects layer.

   Everything that is drawn over the table and then goes away: muzzle flashes,
   tracers, the bolt a tank throws, the arc a mortar lobs, a missile's smoke, a
   flamethrower's cone, the instant line of a Gauss weapon, dust where rounds
   land, and the ghost of a unit that has just been wiped out.

   It is its own file so the game and the unit viewer draw the same effects from
   the same code. Nothing here knows about rules, units or turns: an effect is a
   plain object with a `kind`, a `t0` and a `dur`, and this draws it.
*/
(function (root) {
  'use strict';

  var I = root.PMCIso;

  function nowMs() { return (root.performance && performance.now) ? performance.now() : Date.now(); }

  /* A list of effects in flight. `opts.lift` answers how high the ground stands
     at a point — the game takes that from its terrain; the viewer is flat. */
  function create(opts) {
    opts = opts || {};
    var list = [];
    var lift = opts.lift || function () { return 0; };

    return {
      list: list,
      add: function (f) { f.t0 = nowMs(); list.push(f); return f; },
      clear: function () { list.length = 0; },
      // drop whatever has run its course; true while something is still going
      prune: function () {
        var t = nowMs();
        for (var i = list.length - 1; i >= 0; i--) {
          if (t - list[i].t0 >= list[i].dur) list.splice(i, 1);
        }
        return list.length > 0;
      },
      busy: function () {
        for (var i = 0; i < list.length; i++) if (list[i].blocking) return true;
        return false;
      },
      kinds: function () { return list.map(function (f) { return f.kind; }); },
      draw: function (g) { paint(g, list, lift); }
    };
  }

  /* An aircraft's hull hangs well above the point it stands on, so a shot to or
     from one has to leave and arrive at the airframe rather than at the grass
     underneath it. A point carries that extra height as `up`, and a point effect
     carries its own — nothing else here needs to know what a flier is. */
  function paint(g, fx, lift) {
    var t = nowMs();
    function liftA(f) { return lift(f.from.x, f.from.y) + (f.from.up || 0); }
    function liftB(f) { return lift(f.to.x, f.to.y) + (f.to.up || 0); }
    function liftAt(f) { return lift(f.x, f.y) + (f.up || 0); }
    /* Where a shot leaves from. A trooper's shot carries `mz`, the offset of his
       own muzzle from the ground under the squad, so the round leaves the barrel
       it was fired from; anything else leaves from a fixed height over its point. */
    /* a blue portal: a ring on its edge with a dark swirl inside; `open` 0..1 */
    function drawPortal(x, y, open, sz, spin) {
      if (open <= 0) return;
      var prgb = '110,190,255';
      var rx = I.PIXEL * 4.2 * sz * open, ry = I.PIXEL * 6 * sz * open;
      I.ellipse(g, x, y, rx * 1.7, ry * 1.4, 'rgba(' + prgb + ',' + (0.22 * open) + ')');
      g.save();
      g.strokeStyle = 'rgba(' + prgb + ',' + (0.95 * open) + ')';
      g.lineWidth = I.PIXEL * 1.6;
      g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.stroke();
      I.ellipse(g, x, y, rx * 0.8, ry * 0.85, 'rgba(8,36,80,' + (0.85 * open) + ')');
      g.strokeStyle = 'rgba(200,235,255,' + (0.8 * open) + ')';
      g.lineWidth = I.PIXEL * 0.8;
      var rot = spin * Math.PI * 6;
      for (var sw = 0; sw < 2; sw++) {
        g.beginPath();
        g.ellipse(x, y, rx * (0.55 - sw * 0.2), ry * (0.6 - sw * 0.22), 0, rot + sw * Math.PI, rot + sw * Math.PI + Math.PI * 1.1);
        g.stroke();
      }
      g.restore();
    }
    // where a shared exit portal hangs: over its world point, clear of the ground
    function exitScreen(e) {
      var q = I.toScreen(e.x, e.y);
      return { x: q.x, y: q.y - lift(e.x, e.y) - (e.up || 0) - I.K * 1.3 };
    }
    function start(f, h) {
      var q = I.toScreen(f.from.x, f.from.y), mz = f.from.mz;
      if (mz) { q.x += mz.dx; q.y += mz.dy - liftA(f); } else q.y -= liftA(f) + h;
      return q;
    }
    fx.forEach(function (f) {
      var age = t - f.t0 - (f.delay || 0);
      if (age < 0) return;
      var k = Math.min(1, age / (f.dur - (f.delay || 0)));
      if (f.kind === 'tracer') {
        var a = start(f, I.K * 0.85), b = I.toScreen(f.to.x, f.to.y);
        b.y -= liftB(f) + I.K * 0.75;
        // a long burst walks about; a rifle volley does not
        if (f.spread) {
          if (f.jx === undefined) {
            f.jx = (Math.random() - 0.5) * I.K * f.spread;
            f.jy = (Math.random() - 0.5) * I.K * f.spread * 0.5;
          }
          b.x += f.jx; b.y += f.jy;
        }
        var head = Math.min(1, k * 1.6), tail = Math.max(0, head - (f.short ? 0.2 : 0.34));
        var x0 = a.x + (b.x - a.x) * tail, y0 = a.y + (b.y - a.y) * tail;
        var x1 = a.x + (b.x - a.x) * head, y1 = a.y + (b.y - a.y) * head;
        if (f.rgb) {                                     // energy: a glowing bolt, white at the heart
          g.strokeStyle = 'rgba(' + f.rgb + ',' + (0.55 - k * 0.3) + ')';
          g.lineWidth = I.PIXEL * 3;
          g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        }
        g.strokeStyle = f.rgb
          ? 'rgba(235,248,255,' + (1 - k * 0.5) + ')'
          : f.bio
          ? 'rgba(226,232,176,' + (1 - k * 0.5) + ')'      // a chitin spine, bone-pale
          : f.fat
          ? 'rgba(255,214,128,' + (1 - k * 0.4) + ')'
          : 'rgba(255,226,150,' + (0.95 - k * 0.5) + ')';
        g.lineWidth = f.fat ? I.PIXEL * 2 : I.PIXEL;
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
        if (f.fat) I.ellipse(g, x1, y1, I.PIXEL * 1.6, I.PIXEL * 1.3,
          'rgba(255,244,208,' + (1 - k * 0.4) + ')');
      } else if (f.kind === 'rail') {
        /* A Gauss weapon or a las-cutter: the line is simply there, the whole
           length of it at once, and then it is not. No travel to watch. */
        var ra = start(f, I.K * 0.85), rb = I.toScreen(f.to.x, f.to.y);
        rb.y -= liftB(f) + I.K * 0.7;
        var fade = Math.pow(1 - k, 1.7);
        g.strokeStyle = 'rgba(' + (f.rgb || '190,225,255') + ',' + (fade * (f.rgb ? 0.7 : 0.5)) + ')';   // the bloom
        g.lineWidth = I.PIXEL * 5;
        g.beginPath(); g.moveTo(ra.x, ra.y); g.lineTo(rb.x, rb.y); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,' + fade + ')';           // the line itself
        g.lineWidth = I.PIXEL * (k < 0.15 ? 2 : 1);
        g.beginPath(); g.moveTo(ra.x, ra.y); g.lineTo(rb.x, rb.y); g.stroke();
        if (k < 0.35) {                                   // the flash at each end
          I.ellipse(g, ra.x, ra.y, I.PIXEL * 4 * (1 - k * 2), I.PIXEL * 3 * (1 - k * 2),
            'rgba(226,244,255,' + (1 - k * 2.8) + ')');
          I.ellipse(g, rb.x, rb.y, I.PIXEL * 5 * (1 - k * 2), I.PIXEL * 3.5 * (1 - k * 2),
            'rgba(255,255,255,' + (1 - k * 2.8) + ')');
        }
      } else if (f.kind === 'flame') {
        /* A cone of fire. Nothing is in flight: the fuel goes out, spreads, and
           burns where it lands. Drawn as a shoal of blobs walking down the line
           and widening, hottest at the nozzle and coolest at the far end. */
        var fa = start(f, I.K * 0.6), fb = I.toScreen(f.to.x, f.to.y);
        fb.y -= liftB(f) + I.K * 0.3;
        var reach = Math.min(1, k * 2.4);                 // it takes a moment to get there
        var dying = Math.max(0, (k - 0.55) / 0.45);
        for (var fl = 0; fl < 26; fl++) {
          var ft = ((fl * 0.137 + f.t0 * 0.0016) % 1) * reach;
          if (!ft) continue;
          var fx2 = fa.x + (fb.x - fa.x) * ft, fy2 = fa.y + (fb.y - fa.y) * ft;
          var wob = Math.sin(fl * 2.3 + f.t0 * 0.01) * I.K * 0.5 * ft;
          var sz = I.PIXEL * (1.6 + ft * 5);
          // white-hot at the nozzle, through orange, to smoke at the tip
          var col = ft < 0.25 ? 'rgba(255,238,190,' : ft < 0.5 ? 'rgba(255,186,74,'
            : ft < 0.78 ? 'rgba(226,108,36,' : 'rgba(96,78,66,';
          I.ellipse(g, fx2 + wob, fy2 - ft * I.K * 0.35, sz, sz * 0.72,
            col + Math.max(0, (0.85 - ft * 0.45) * (1 - dying)) + ')');
        }
        // and what is left burning on the ground at the far end
        if (k > 0.3) {
          var gp3 = I.toScreen(f.to.x, f.to.y); gp3.y -= liftB(f);
          for (var bn = 0; bn < 9; bn++) {
            var ba = bn * 0.7 + f.t0 * 0.006;
            var bd = I.K * (0.3 + (bn % 3) * 0.35);
            var lick = Math.abs(Math.sin(f.t0 * 0.02 + bn));
            I.ellipse(g, gp3.x + Math.cos(ba) * bd, gp3.y + Math.sin(ba) * bd * 0.5 - lick * 5,
              I.PIXEL * 2, I.PIXEL * 3,
              (lick > 0.6 ? 'rgba(255,214,120,' : 'rgba(224,116,40,') +
              Math.max(0, 0.7 - dying) + ')');
          }
        }
      } else if (f.kind === 'missile') {
        /* A missile does not fly the straight line a shell does. It is pushed
           out of the tube cold and level, the motor lights, it bends up into a
           gentle climb, flares over the top — and then drops almost straight
           down onto the target. No two fly quite the same path. */
        var ma = start(f, I.K * 0.8), mb = I.toScreen(f.to.x, f.to.y);
        mb.y -= liftB(f) + I.K * 0.5;
        var mseed = (f.seed || 0);
        var climb = f.rocket ? I.K * 0.9 : I.K * 2.2;
        var sway = f.rocket ? (((mseed % 3) - 1) * I.K * 0.7) : 0;
        /* An unguided rocket is none of this: it leaves the rail lit and flies
           the shallow arc it always did. Only a guided missile runs out level,
           creeps off the ejection charge and lights its motor on the way. */
        var guided = !f.rocket;
        var RUN = guided ? 0.22 : 0;   // how much of the flight is the level run out
        /* A craft in the air throws its missiles the way it is flying and they
           turn onto the mark from there: the path bends through a point out
           ahead of the nose instead of climbing over the target. */
        var mc = null;
        if (f.curve && guided) {
          mc = I.toScreen(f.curve.x, f.curve.y);
          mc.y -= (f.curve.up || 0) + I.K * 0.5;
        }
        /* Out of the tube on the ejection charge, barely moving, then the
           motor lights and it goes: the first fifth of the flight covers a
           tenth of the ground, and the rest accelerates away. */
        var CREEP = 0.2;           // how much ground the level run out covers
        /* A little variance, from this missile's own number, so a salvo does
           not fly as one shape: where the top of the arc sits, how high it
           goes, and a touch of wander across the line. */
        var vr = (mseed * 2654435761) >>> 0;
        var v1 = ((vr >>> 8) & 255) / 255, v2 = ((vr >>> 16) & 255) / 255, v3 = ((vr >>> 24) & 255) / 255;
        var TOP = guided ? 0.52 + (v1 - 0.5) * 0.1 : 1;    // when it tips over the top
        var SPLIT = 0.46 + (v1 - 0.5) * 0.1;               // how far along it is by then
        var apex = climb * (guided ? 0.9 + v2 * 0.4 : 1);
        var wander = guided ? (v3 - 0.5) * I.K * 0.8 : 0;
        // and the same variance bends an aircraft's curve a little each time
        if (mc) { mc.x += (v3 - 0.5) * I.K * 0.7; mc.y += (v2 - 0.5) * I.K * 0.5; }

        /* Two halves. Up to the top it climbs away on a gentle curve, covering
           less than half the ground; from the top it runs straight down at the
           target, both along and down together, gathering speed all the way in. */
        function dive(t2) { var d2 = (t2 - TOP) / (1 - TOP); return d2 * d2; }
        // how far along the ground it has come
        function burn(t2) {
          if (!guided) return Math.max(0, Math.min(1, t2));
          if (t2 <= 0) return 0;
          if (t2 >= 1) return 1;
          if (t2 < RUN) return (t2 / RUN) * CREEP;          // out of the tube, flat and level
          if (t2 <= TOP) return CREEP + Math.pow((t2 - RUN) / (TOP - RUN), 1.15) * (SPLIT - CREEP);
          return SPLIT + (1 - SPLIT) * dive(t2);
        }
        // and how high it is: level, then the climb, then down the line of the dive
        function height(t2) {
          if (!guided) {
            return t2 <= 0 ? 0 : Math.sin(Math.PI * Math.pow(t2, 0.8)) * climb;
          }
          if (t2 <= RUN) return 0;
          /* The climb leaves the level run with no kink in it and rounds off at
             the top: it starts and ends flat, and bends between the two. */
          if (t2 <= TOP) return apex * (1 - Math.cos(Math.PI * ((t2 - RUN) / (TOP - RUN)))) / 2;
          return apex * (1 - dive(t2));
        }
        /* A missile off an aircraft flies level the whole way — it is already
           above everything — and leaves on the line the craft is flying: out
           ahead of the nose, curving slowly onto the target, and then, from the
           flare, straight in and gathering speed. */
        var BEND = 0.55;           // how far round the curve it comes before the flare
        function bez(sq) {
          var v = 1 - sq;
          return {
            x: v * v * ma.x + 2 * v * sq * mc.x + sq * sq * mb.x,
            y: v * v * ma.y + 2 * v * sq * mc.y + sq * sq * mb.y
          };
        }
        function mAt(t2) {
          if (mc) {
            if (t2 <= TOP) {
              // out along the nose, and round onto the target, unhurried
              var u2 = Math.max(0, t2) / TOP;
              return bez(Math.pow(u2, 1.2) * BEND);
            }
            var turn = bez(BEND), e2 = dive(t2);
            return { x: turn.x + (mb.x - turn.x) * e2, y: turn.y + (mb.y - turn.y) * e2 };
          }
          var h = burn(t2);
          return {
            x: ma.x + (mb.x - ma.x) * h + (sway + wander) * Math.sin(Math.PI * h),
            y: ma.y + (mb.y - ma.y) * h - height(t2)
          };
        }
        var mp = mAt(k);
        // the smoke trail, thinning and drifting as it ages
        for (var sm2 = 1; sm2 < 26; sm2++) {
          var st2 = k - sm2 * 0.037;
          if (st2 <= 0) break;
          var sq = mAt(st2);
          var age = sm2 / 26;
          I.ellipse(g, sq.x, sq.y - age * 3, I.PIXEL * (1.4 + age * 3.4),
            I.PIXEL * (1.1 + age * 2.6),
            'rgba(206,200,190,' + Math.max(0, 0.42 - age * 0.4) + ')');
        }
        /* It climbs cold: the motor lights at the top of the arc, in a flare,
           and burns from there down onto the target. */
        var flare = guided ? Math.max(0, 1 - Math.abs(k - TOP) / 0.12) : 0;
        if (!guided || k >= TOP) {
          I.ellipse(g, mp.x, mp.y, I.PIXEL * (3.4 + flare * 5), I.PIXEL * (2.6 + flare * 4),
            'rgba(255,170,80,' + (0.75 + flare * 0.25) + ')');
          I.ellipse(g, mp.x, mp.y, I.PIXEL * (1.8 + flare * 2.6), I.PIXEL * (1.5 + flare * 2.2),
            'rgba(255,246,214,1)');
        } else {
          // on the way up, unlit: a cold round with a wisp behind it
          I.ellipse(g, mp.x, mp.y, I.PIXEL * 1.6, I.PIXEL * 1.3, 'rgba(206,200,190,.85)');
        }
      } else if (f.kind === 'bolt') {
        /* One heavy round, flat and fast: a short thick streak with a bright
           head and a little smoke left along the line it took. */
        var ba = start(f, I.K * 0.8), bb = I.toScreen(f.to.x, f.to.y);
        bb.y -= liftB(f) + I.K * 0.7;
        var bh = Math.min(1, k * 1.25), bt = Math.max(0, bh - 0.22);
        var bx0 = ba.x + (bb.x - ba.x) * bt, by0 = ba.y + (bb.y - ba.y) * bt;
        var bx1 = ba.x + (bb.x - ba.x) * bh, by1 = ba.y + (bb.y - ba.y) * bh;
        g.strokeStyle = 'rgba(255,238,196,' + (1 - k * 0.3) + ')';
        g.lineWidth = I.PIXEL * (f.heavy ? 4 : 3);
        g.beginPath(); g.moveTo(bx0, by0); g.lineTo(bx1, by1); g.stroke();
        g.strokeStyle = 'rgba(255,170,90,' + (0.7 - k * 0.5) + ')';
        g.lineWidth = I.PIXEL * 5;
        g.beginPath(); g.moveTo(bx0, by0); g.lineTo(bx1, by1); g.stroke();
        I.ellipse(g, bx1, by1, I.PIXEL * 3, I.PIXEL * 2.4, 'rgba(255,250,224,' + (1 - k * 0.4) + ')');
        // the smoke the round leaves hanging behind it
        for (var sm = 0; sm < 5; sm++) {
          var sf = bt * (sm / 5);
          I.ellipse(g, ba.x + (bb.x - ba.x) * sf, ba.y + (bb.y - ba.y) * sf,
            I.PIXEL * (1.5 + sm * 0.6), I.PIXEL * (1 + sm * 0.4),
            'rgba(168,156,138,' + (0.3 - k * 0.3) + ')');
        }
      } else if (f.kind === 'lob') {
        /* Indirect fire: the round climbs out of the tube, arcs over whatever is
           in the way, and comes down on the target. The height of the arc is
           what tells the player it is not shooting through the terrain. */
        var la = start(f, I.K * 0.8), lb = I.toScreen(f.to.x, f.to.y);
        lb.y -= liftB(f);
        var span = Math.hypot(lb.x - la.x, lb.y - la.y);
        // high enough to read as a lob, low enough to stay in the frame
        var apex = Math.max(I.K * 1.8, Math.min(I.K * (f.heavy ? 5 : 4), span * (f.heavy ? 0.34 : 0.28)));
        function at(s) {
          return {
            x: la.x + (lb.x - la.x) * s,
            y: la.y + (lb.y - la.y) * s - Math.sin(Math.PI * s) * apex
          };
        }
        var lp = at(k);
        // the smoke trail, hanging most of the way back to the tube
        for (var tr = 1; tr < 22; tr++) {
          var ts = k - tr * 0.045;
          if (ts <= 0) break;
          var q2 = at(ts);
          I.ellipse(g, q2.x, q2.y, I.PIXEL * (1.6 - tr * 0.05), I.PIXEL * (1.2 - tr * 0.04),
            'rgba(210,202,186,' + Math.max(0, 0.5 - tr * 0.022) + ')');
        }
        // the round itself, glowing hotter as it noses over and comes down
        var lsz = f.heavy ? 1.5 : 1;
        I.ellipse(g, lp.x, lp.y, I.PIXEL * 4 * lsz, I.PIXEL * 3.2 * lsz,
          'rgba(255,196,120,' + (k > 0.6 ? 0.5 : 0.3) + ')');
        I.ellipse(g, lp.x, lp.y, I.PIXEL * 2.2 * lsz, I.PIXEL * 2 * lsz,
          k > 0.7 ? 'rgba(255,226,164,1)' : 'rgba(240,234,220,1)');
        // a shadow running along the ground under it, so the height reads
        var gp2 = { x: la.x + (lb.x - la.x) * k, y: la.y + (lb.y - la.y) * k + I.K * 0.8 };
        I.ellipse(g, gp2.x, gp2.y, I.PIXEL * 2.6, I.PIXEL * 1.3, 'rgba(10,9,7,.28)');
      } else if (f.kind === 'pulse') {
        /* A Xenotripod energy pulse: a short dash of light in the tribe's colour,
           white at the heart, crossing the table fast. */
        var pa = start(f, I.K * 0.8), pb = I.toScreen(f.to.x, f.to.y);
        pb.y -= liftB(f) + I.K * 0.7;
        var ph = Math.min(1, k * 1.15), pt = Math.max(0, ph - 0.16);
        var px0 = pa.x + (pb.x - pa.x) * pt, py0 = pa.y + (pb.y - pa.y) * pt;
        var px1 = pa.x + (pb.x - pa.x) * ph, py1 = pa.y + (pb.y - pa.y) * ph;
        var rgb = f.rgb || '150,220,255';
        g.lineCap = 'round';
        g.strokeStyle = 'rgba(' + rgb + ',' + (0.45 - k * 0.3) + ')';
        g.lineWidth = I.PIXEL * 6;
        g.beginPath(); g.moveTo(px0, py0); g.lineTo(px1, py1); g.stroke();
        g.strokeStyle = 'rgba(' + rgb + ',1)';
        g.lineWidth = I.PIXEL * 3;
        g.beginPath(); g.moveTo(px0, py0); g.lineTo(px1, py1); g.stroke();
        g.strokeStyle = 'rgba(255,255,255,.95)';
        g.lineWidth = I.PIXEL * 1.2;
        g.beginPath(); g.moveTo((px0 + px1) / 2, (py0 + py1) / 2); g.lineTo(px1, py1); g.stroke();
        g.lineCap = 'butt';
        if (k < 0.2) I.ellipse(g, pa.x, pa.y, I.PIXEL * 4, I.PIXEL * 3, 'rgba(' + rgb + ',' + (0.8 - k * 4) + ')');
      } else if (f.kind === 'orb') {
        /* A plasma orb: lobbed from a craft or a turret, or — from a Gamma
           squad's launcher — teleported: it winks out at the muzzle and flashes
           back into being beside the target. */
        var oa = start(f, I.K * 0.8), ob = I.toScreen(f.to.x, f.to.y);
        ob.y -= liftB(f) + I.K * 0.4;
        var orgb = f.rgb || '150,220,255', ok2;
        var osz = f.big ? 1.4 : 1;
        if (f.tele) {
          /* A portal opens at the gun's mouth and swallows the bomb; an exit
             portal opens in the air near the target and flings it out in an
             arc to burst on the ground. Always the blue of the tribe's energy. */
          var prgb = '110,190,255';
          var portal = function (x, y, open, sz) { drawPortal(x, y, open, sz, k); };
          // the mouth: open fast, hold while the bomb goes in, close
          var mo = k < 0.1 ? k / 0.1 : k < 0.3 ? 1 : Math.max(0, 1 - (k - 0.3) / 0.15);
          portal(oa.x, oa.y, mo, osz);
          if (k > 0.05 && k < 0.3) {                    // the bomb, shrinking into it
            var sk = 1 - (k - 0.05) / 0.25;
            I.ellipse(g, oa.x, oa.y, I.PIXEL * 2.6 * osz * sk, I.PIXEL * 2.3 * osz * sk, 'rgba(255,255,255,.95)');
          }
          /* the exit: a portal hanging in the air short of the target, on the
             shooter's side; the bomb is flung out of it in a short arc and
             bursts on the ground */
          var gy = ob.y + I.K * 0.4;
          var dxp = oa.x - ob.x, dyp = oa.y - gy, dl = Math.hypot(dxp, dyp) || 1;
          var tx, ty;
          if (f.exit) {                                   // one exit portal, shared by the whole salvo
            var es = exitScreen(f.exit); tx = es.x; ty = es.y;
          } else {
            var back = Math.min(dl * 0.45, I.K * 2.4);
            tx = ob.x + dxp / dl * back; ty = gy + dyp / dl * back - I.K * 1.3;
            var to = k < 0.3 ? 0 : k < 0.42 ? (k - 0.3) / 0.12 : k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.2);
            portal(tx, ty, to, osz * 1.15);
          }
          if (k > 0.42) {
            var kf = (k - 0.42) / 0.58;
            var apx = I.K * 0.9;
            var tat = function (s2) { return { x: tx + (ob.x - tx) * s2, y: ty + (gy - ty) * s2 - Math.sin(Math.PI * s2) * apx }; };
            for (var tr3 = 1; tr3 < 8; tr3++) {
              var ts3 = kf - tr3 * 0.05;
              if (ts3 <= 0) break;
              var q6 = tat(ts3);
              I.ellipse(g, q6.x, q6.y, I.PIXEL * (2 - tr3 * 0.18) * osz, I.PIXEL * (1.7 - tr3 * 0.16) * osz, 'rgba(' + prgb + ',' + Math.max(0, 0.5 - tr3 * 0.06) + ')');
            }
            var op3 = tat(kf), grow = Math.min(1, kf / 0.15);   // swelling out of the portal
            I.ellipse(g, op3.x, op3.y, I.PIXEL * 5 * osz * grow, I.PIXEL * 4.2 * osz * grow, 'rgba(' + prgb + ',.4)');
            I.ellipse(g, op3.x, op3.y, I.PIXEL * 2.6 * osz * grow, I.PIXEL * 2.3 * osz * grow, 'rgba(' + prgb + ',1)');
            I.ellipse(g, op3.x - I.PIXEL * 0.6, op3.y - I.PIXEL * 0.6, I.PIXEL * 1.1 * osz * grow, I.PIXEL * 0.9 * osz * grow, 'rgba(255,255,255,.95)');
          }
        } else {
          var ospan = Math.hypot(ob.x - oa.x, ob.y - oa.y);
          var oapex = Math.max(I.K * 1.2, Math.min(I.K * 3.5, ospan * 0.26));
          var oat = function (s2) { return { x: oa.x + (ob.x - oa.x) * s2, y: oa.y + (ob.y - oa.y) * s2 - Math.sin(Math.PI * s2) * oapex }; };
          for (var tr2 = 1; tr2 < 10; tr2++) {
            var ts2 = k - tr2 * 0.04;
            if (ts2 <= 0) break;
            var q5 = oat(ts2);
            I.ellipse(g, q5.x, q5.y, I.PIXEL * (2 - tr2 * 0.15) * osz, I.PIXEL * (1.7 - tr2 * 0.13) * osz, 'rgba(' + orgb + ',' + Math.max(0, 0.5 - tr2 * 0.05) + ')');
          }
          var op2 = oat(k);
          I.ellipse(g, op2.x, op2.y, I.PIXEL * 5 * osz, I.PIXEL * 4.2 * osz, 'rgba(' + orgb + ',.4)');
          I.ellipse(g, op2.x, op2.y, I.PIXEL * 2.6 * osz, I.PIXEL * 2.3 * osz, 'rgba(' + orgb + ',1)');
          I.ellipse(g, op2.x - I.PIXEL * 0.6, op2.y - I.PIXEL * 0.6, I.PIXEL * 1.1 * osz, I.PIXEL * 0.9 * osz, 'rgba(255,255,255,.95)');
        }
      } else if (f.kind === 'exitportal') {
        /* the salvo's one exit: opens as the first bomb goes into the gun,
           stays open while every bomb comes through, closes after the last */
        var ep = exitScreen(f.exit), ems = k * f.dur;
        var eo = ems < f.open ? 0 : ems < f.open + 120 ? (ems - f.open) / 120 : ems > f.dur - 200 ? Math.max(0, (f.dur - ems) / 200) : 1;
        drawPortal(ep.x, ep.y, eo, (f.big ? 1.4 : 1) * 1.15, k * f.dur / 1000);
      } else if (f.kind === 'orbburst') {
        // where the plasma lands: a ring of light thrown out, and a white flash
        var ob0 = I.toScreen(f.x, f.y); ob0.y -= liftAt(f);
        var orr = (f.big ? 1.6 : 1.1) * I.K, brgb = f.rgb || '150,220,255';
        g.save();
        g.strokeStyle = 'rgba(' + brgb + ',' + (0.9 * (1 - k)) + ')';
        g.lineWidth = I.PIXEL * 2.5 * (1 - k * 0.6);
        g.beginPath(); g.ellipse(ob0.x, ob0.y, orr * (0.2 + k), orr * (0.1 + k * 0.5), 0, 0, Math.PI * 2); g.stroke();
        g.restore();
        if (k < 0.4) I.ellipse(g, ob0.x, ob0.y - I.K * 0.3, I.K * 0.6 * (1 - k * 2), I.K * 0.5 * (1 - k * 2), 'rgba(255,255,255,' + (0.9 - k * 2) + ')');
        I.ellipse(g, ob0.x, ob0.y, orr * 0.5 * (1 - k * 0.5), orr * 0.25 * (1 - k * 0.5), 'rgba(' + brgb + ',' + (0.35 * (1 - k)) + ')');
      } else if (f.kind === 'glob') {
        /* Bug acid: a wet glob in a low lob, trailing drips, glowing green.
           `big` is the bio-plasma sac — larger, brighter, pulsing. */
        var ga0 = start(f, I.K * 0.7), gb0 = I.toScreen(f.to.x, f.to.y);
        gb0.y -= liftB(f) + I.K * 0.3;
        var gspan = Math.hypot(gb0.x - ga0.x, gb0.y - ga0.y);
        var gapex = Math.max(I.K * 0.9, Math.min(I.K * (f.big ? 3.2 : 2.2), gspan * (f.big ? 0.24 : 0.18)));
        var gat = function (s2) {
          return { x: ga0.x + (gb0.x - ga0.x) * s2, y: ga0.y + (gb0.y - ga0.y) * s2 - Math.sin(Math.PI * s2) * gapex };
        };
        var gp = gat(k), gsz = f.big ? 1.9 : 1;
        for (var dr = 1; dr < 9; dr++) {
          var ds = k - dr * 0.05;
          if (ds <= 0) break;
          var dq = gat(ds);
          I.ellipse(g, dq.x, dq.y + dr * 0.6, I.PIXEL * (1.4 - dr * 0.1) * gsz, I.PIXEL * (1.2 - dr * 0.1) * gsz,
            'rgba(150,214,70,' + Math.max(0, 0.55 - dr * 0.06) + ')');
        }
        var pulse2 = f.big ? 0.8 + 0.2 * Math.sin(age * 0.04) : 1;
        I.ellipse(g, gp.x, gp.y, I.PIXEL * 4.2 * gsz * pulse2, I.PIXEL * 3.4 * gsz * pulse2,
          f.big ? 'rgba(170,255,120,.45)' : 'rgba(150,220,80,.35)');
        I.ellipse(g, gp.x, gp.y, I.PIXEL * 2.4 * gsz, I.PIXEL * 2 * gsz, f.big ? 'rgba(206,255,150,1)' : 'rgba(170,226,86,1)');
        I.ellipse(g, gp.x - I.PIXEL * 0.6 * gsz, gp.y - I.PIXEL * 0.6 * gsz, I.PIXEL * 0.9 * gsz, I.PIXEL * 0.7 * gsz, 'rgba(240,255,210,.9)');
        var gg = { x: ga0.x + (gb0.x - ga0.x) * k, y: ga0.y + (gb0.y - ga0.y) * k + I.K * 0.5 };
        I.ellipse(g, gg.x, gg.y, I.PIXEL * 2.2 * gsz, I.PIXEL * 1.1 * gsz, 'rgba(10,9,7,.22)');
      } else if (f.kind === 'splat') {
        // where the acid lands: a green splash thrown out and a hissing pool
        var sp0 = I.toScreen(f.x, f.y); sp0.y -= liftAt(f);
        var sr = (f.big ? 1.5 : 1) * I.K;
        I.ellipse(g, sp0.x, sp0.y, sr * (0.35 + k * 0.4), sr * (0.18 + k * 0.2), 'rgba(110,170,50,' + (0.5 - k * 0.5) + ')');
        for (var sd = 0; sd < 10; sd++) {
          var sa = sd * 0.63 + f.t0 * 0.003;
          var sdist = k * sr * (0.4 + (sd % 3) * 0.25);
          I.rect(g, sp0.x + Math.cos(sa) * sdist, sp0.y + Math.sin(sa) * sdist * 0.5 - Math.sin(k * Math.PI) * 7,
            I.PIXEL * (sd % 2 ? 1 : 1.5), I.PIXEL, 'rgba(' + (sd % 3 ? '160,226,80' : '220,255,160') + ',' + (1 - k) + ')');
        }
        for (var sm2 = 0; sm2 < 4; sm2++) {                 // the fumes coming off it
          I.ellipse(g, sp0.x + (sm2 - 1.5) * I.PIXEL * 3, sp0.y - k * I.K * (0.5 + sm2 * 0.15),
            I.PIXEL * 2, I.PIXEL * 1.4, 'rgba(190,220,150,' + (0.3 - k * 0.3) + ')');
        }
      } else if (f.kind === 'wave') {
        /* Psychic Wave: rings rolling out 12" across the table, violet. */
        var wp = I.toScreen(f.x, f.y); wp.y -= liftAt(f) + I.K * 0.5;
        g.save();
        for (var wr = 0; wr < 3; wr++) {
          var wk = k - wr * 0.18;
          if (wk <= 0 || wk >= 1) continue;
          var wrad = wk * (f.r || 12) * I.K * 0.72;
          g.strokeStyle = f.rgb ? 'rgba(' + f.rgb + ',' + (0.75 * (1 - wk)) + ')' : 'rgba(196,140,255,' + (0.75 * (1 - wk)) + ')';
          g.lineWidth = I.PIXEL * (3 - wr);
          g.beginPath(); g.ellipse(wp.x, wp.y, wrad, wrad * 0.5, 0, 0, Math.PI * 2); g.stroke();
        }
        I.ellipse(g, wp.x, wp.y, I.K * 0.7 * (1 - k), I.K * 0.4 * (1 - k), f.rgb ? 'rgba(' + f.rgb + ',' + (0.8 - k * 0.8) + ')' : 'rgba(230,200,255,' + (0.8 - k * 0.8) + ')');
        g.restore();
      } else if (f.kind === 'hold') {
        /* Nothing to draw: it exists so the frame loop keeps turning while a
           unit is coming down, and so the game waits for it. */
      } else if (f.kind === 'dropmark') {
        /* The landing point, lit up while something falls onto it: a ring
           closing in, and the shadow of the craft growing as it nears. */
        var dp = I.toScreen(f.x, f.y); dp.y -= liftAt(f);
        var pulse = 0.5 + 0.5 * Math.sin(k * Math.PI * 7);
        I.ellipse(g, dp.x, dp.y, I.K * 1.5, I.K * 0.75,
          'rgba(10,9,7,' + (0.12 + k * 0.3) + ')');            // the shadow, hardening
        g.save();
        g.strokeStyle = 'rgba(232,193,90,' + (0.35 + pulse * 0.4) + ')';
        g.lineWidth = I.PIXEL;
        g.setLineDash([5, 5]);
        var rr = I.K * (2.6 - k * 1.3);
        g.beginPath();
        g.ellipse(dp.x, dp.y, rr, rr * 0.5, 0, 0, Math.PI * 2);
        g.stroke();
        g.setLineDash([]);
        g.restore();
        // grit already being blown off the ground by what is coming
        for (var gz = 0; gz < 9; gz++) {
          var ga = gz * 0.7 + f.t0 * 0.004;
          var gd = I.K * (0.5 + (gz % 3) * 0.35) * (0.6 + k);
          I.rect(g, dp.x + Math.cos(ga) * gd, dp.y + Math.sin(ga) * gd * 0.5 - k * 4,
            I.PIXEL, I.PIXEL, 'rgba(186,170,142,' + (k * 0.5) + ')');
        }
      } else if (f.kind === 'muzzle') {
        var p = I.toScreen(f.x, f.y);
        if (f.mz) { p.x += f.mz.dx; p.y += f.mz.dy - liftAt(f); } else p.y -= liftAt(f) + I.K * 0.85;
        var big = f.big ? 2.1 : 1;
        // a flash at a trooper's muzzle is his own: smaller, and just past the tip
        var r = (1 - k) * I.K * 0.22 * big * (f.mz && !f.big ? 0.6 : 1);
        // at a known muzzle the flash sits on the tip; a big one is not pushed off it
        var off = f.mz ? f.mz.dir * r * (f.big ? 0.25 : 1.2) : I.K * 0.35;
        p.x += off - I.K * 0.35;
        I.ellipse(g, p.x + I.K * 0.35, p.y, r * 1.6, r, 'rgba(' + (f.rgb || '255,216,130') + ',' + (0.9 - k * 0.9) + ')');
        if (f.mz && k < 0.5) I.ellipse(g, p.x + I.K * 0.35, p.y, r * 0.6, r * 0.45, 'rgba(' + (f.rgb ? '235,248,255' : '255,250,228') + ',' + (1 - k * 2) + ')');
        if (f.big) {
          // the blast ring and the smoke a heavy gun throws off the muzzle
          I.ellipse(g, p.x + I.K * 0.35, p.y, r * 2.4, r * 1.5,
            'rgba(255,164,86,' + (0.5 - k * 0.5) + ')');
          for (var mz = 0; mz < 7; mz++) {
            var ma = mz * 0.9 + f.t0 * 0.01;
            var md = k * I.K * 0.9 * (0.5 + (mz % 3) * 0.25);
            I.ellipse(g, p.x + I.K * 0.35 + Math.cos(ma) * md, p.y + Math.sin(ma) * md * 0.5,
              I.PIXEL * 2, I.PIXEL * 1.4, 'rgba(150,140,124,' + (0.4 - k * 0.4) + ')');
          }
        }
      } else if (f.kind === 'impact') {
        var p2 = I.toScreen(f.x, f.y); p2.y -= liftAt(f);
        for (var i = 0; i < f.n * 3; i++) {
          var ang = (i / (f.n * 3)) * Math.PI * 2 + f.t0;
          var d = k * I.K * 1.1 * (0.4 + (i % 3) * 0.3);
          I.rect(g, p2.x + Math.cos(ang) * d, p2.y + Math.sin(ang) * d * 0.5 - k * 8,
            I.PIXEL, I.PIXEL, f.rgb
              ? (i % 3 === 0 ? 'rgba(235,248,255,' + (1 - k) + ')' : 'rgba(' + f.rgb + ',' + (0.95 - k) + ')')
              : i % 4 === 0 ? 'rgba(255,196,120,' + (1 - k) + ')' : 'rgba(168,150,120,' + (0.9 - k) + ')');
        }
        if (f.rgb && k < 0.5) I.ellipse(g, p2.x, p2.y - I.K * 0.3, I.K * 0.45 * (1 - k * 2), I.K * 0.35 * (1 - k * 2), 'rgba(' + f.rgb + ',' + (0.6 - k * 1.2) + ')');
      } else if (f.kind === 'miss') {
        var p3 = I.toScreen(f.x, f.y); p3.y -= liftAt(f);
        for (var m = 0; m < 5; m++) {
          var a2 = m * 1.3 + f.t0;
          I.rect(g, p3.x + Math.cos(a2) * k * I.K * 1.4, p3.y + Math.sin(a2) * k * I.K * 0.7 - k * 5,
            I.PIXEL, I.PIXEL, 'rgba(150,138,112,' + (0.7 - k * 0.7) + ')');
        }
      } else if (f.kind === 'clash') {
        var p4 = I.toScreen(f.x, f.y); p4.y -= liftAt(f) + I.K;
        for (var c = 0; c < 8; c++) {
          var ca = c * 0.79 + f.t0;
          var cd = k * I.K * 0.9;
          I.rect(g, p4.x + Math.cos(ca) * cd, p4.y + Math.sin(ca) * cd * 0.55,
            I.PIXEL, I.PIXEL, 'rgba(255,' + (200 - c * 10) + ',140,' + (1 - k) + ')');
        }
      } else if (f.kind === 'collapse') {
        // the cloud a demolished piece throws up
        var pc = I.toScreen(f.x, f.y); pc.y -= liftAt(f);
        var rad = f.r * I.K;
        for (var d2 = 0; d2 < 22; d2++) {
          var da = d2 * 0.9 + f.t0 * 0.01;
          var dd = (0.25 + (d2 % 5) * 0.2) * rad * (0.4 + k * 0.9);
          var rise = k * I.K * (0.6 + (d2 % 3) * 0.4);
          I.ellipse(g, pc.x + Math.cos(da) * dd, pc.y + Math.sin(da) * dd * 0.5 - rise,
            I.PIXEL * (2 + (d2 % 3)), I.PIXEL * (1.4 + (d2 % 3) * 0.6),
            'rgba(' + (d2 % 4 ? '152,138,116' : '96,84,70') + ',' + (0.55 - k * 0.55) + ')');
        }
      } else if (f.kind === 'ghost') {
        g.save();
        g.globalAlpha = Math.max(0, 1 - k);
        I.drawUnit(g, { side: f.side, code: f.code, models: f.models, sp: 0, marked: false, rules: [] }, {
          at: { x: f.x, y: f.y }, lift: liftAt(f) - k * 3, status: 'broken', morale: 1
        });
        g.restore();
      }
    });
  }

  root.PMCFx = { create: create, paint: paint };
})(window);
