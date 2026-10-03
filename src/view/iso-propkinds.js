/* PMC 2670 — Firefight : each kind of scenery piece: trees, rocks, buildings, walls, sandbags, wire, craters and the rest

   Made by iso-props.js once, with the palettes and pieces it shares (S).
   drawKind paints a piece of scenery by its kind, at the screen point p,
   lifted onto a hill by lift, cut away where the camera looks through it. */
(function (root) {
  'use strict';
  root.PMCIsoPropKinds = function (S) {
    var BAG = S.BAG, BARK = S.BARK, BASALTS = S.BASALTS, BRICK = S.BRICK, CHAR = S.CHAR,
        CONCRETE = S.CONCRETE, K = S.K, LEAF = S.LEAF, PIXEL = S.PIXEL, PREFAB = S.PREFAB, ROOF = S.ROOF,
        STONE = S.STONE, a = S.a, boulder = S.boulder, box = S.box, brokenWall = S.brokenWall,
        conifer = S.conifer, dot = S.dot, edgeLine = S.edgeLine, ellipse = S.ellipse, lerp2 = S.lerp2,
        pebble = S.pebble, poly = S.poly, rect = S.rect, rng = S.rng, shadowBlob = S.shadowBlob,
        toScreen = S.toScreen, vgrad = S.vgrad;

    function drawKind(cutaway, g, lift, p, pr) {
      switch (pr.kind) {
        case 'tree': {
          shadowBlob(g, { x: p.x + a(2), y: p.y + a(1) }, pr.rad + a(1), (pr.rad + a(1)) / 2);
          var tr = rng(pr.seed);
          // trunk, with bark texture and a flare at the base
          if (pr.tone < 0.28) { conifer(g, p, pr, tr); break; }
          rect(g, p.x - a(0.7), p.y - pr.h, a(1.4), pr.h, BARK[1]);
          rect(g, p.x - a(0.7), p.y - pr.h, a(0.5), pr.h, BARK[2]);
          rect(g, p.x + a(0.4), p.y - pr.h, a(0.3), pr.h, BARK[0]);
          rect(g, p.x - a(1.1), p.y - a(0.9), a(2.2), a(0.9), BARK[0]);
          rect(g, p.x - a(1.1), p.y - a(0.9), a(0.6), a(0.5), BARK[1]);
          for (var bk = 0; bk < pr.h / 5; bk++) {
            dot(g, p.x - a(0.7) + tr() * a(1.4), p.y - tr() * pr.h, tr() > 0.5 ? BARK[0] : BARK[2], 1);
          }
          pr = { rad: pr.rad * 1.2, h: pr.h, tone: pr.tone };
          var cy = p.y - pr.h * 0.9 - pr.rad * 0.35;
          var base = 1 + Math.round(pr.tone * 1.4);
          // branches reaching out of the canopy
          for (var b2 = 0; b2 < 3; b2++) {
            var ba = Math.PI + tr() * Math.PI;
            rect(g, p.x + Math.cos(ba) * pr.rad * 0.5, p.y - pr.h + Math.sin(ba) * pr.rad * 0.2,
              PIXEL * 2, PIXEL, BARK[0]);
          }
          // the canopy, built from overlapping clumps rather than one smooth blob
          ellipse(g, p.x, cy + a(1.4), pr.rad * 1.02, pr.rad * 0.84, LEAF[0]);   // underside
          ellipse(g, p.x, cy + a(0.6), pr.rad, pr.rad * 0.82, LEAF[base]);
          var lobes = 5 + (tr() * 3 | 0);
          for (var lb = 0; lb < lobes; lb++) {
            var ang = tr() * Math.PI * 2, dist = pr.rad * (0.18 + tr() * 0.46);
            var lx2 = p.x + Math.cos(ang) * dist, ly2 = cy + Math.sin(ang) * dist * 0.72;
            var up = (Math.cos(ang) + Math.sin(ang)) < 0;      // lit from the north-west
            ellipse(g, lx2, ly2, pr.rad * (0.32 + tr() * 0.26), pr.rad * (0.26 + tr() * 0.2),
              LEAF[up ? Math.min(5, base + 2) : Math.max(0, base - 1)]);
          }
          ellipse(g, p.x - pr.rad * 0.36, cy - pr.rad * 0.34, pr.rad * 0.42, pr.rad * 0.3,
            LEAF[Math.min(5, base + 3)]);                      // the crown catching the sun
          // leaf grain, one pixel at a time
          var grains = Math.round(pr.rad * pr.rad * 0.22);
          for (var i = 0; i < grains; i++) {
            var la = tr() * Math.PI * 2, ld = Math.sqrt(tr()) * pr.rad * 0.96;
            var lx = p.x + Math.cos(la) * ld, ly = cy + Math.sin(la) * ld * 0.8;
            var far = (Math.cos(la) + Math.sin(la)) > 0.2;
            dot(g, lx, ly, far ? LEAF[Math.max(0, base - 1)] : LEAF[Math.min(5, base + 3)], 1);
          }
          for (var gp = 0; gp < pr.rad / 8; gp++) {            // gaps showing sky through
            var ga = tr() * Math.PI * 2, gd = Math.sqrt(tr()) * pr.rad * 0.7;
            dot(g, p.x + Math.cos(ga) * gd, cy + Math.sin(ga) * gd * 0.8, LEAF[0], 2);
          }
          break;
        }
        case 'bush': {
          var br2 = rng((pr.tone * 9999) | 0);
          shadowBlob(g, { x: p.x + a(1), y: p.y }, pr.rad, pr.rad / 2);
          var bb = 1 + Math.round(pr.tone);
          ellipse(g, p.x, p.y - a(0.6), pr.rad, pr.rad * 0.72, LEAF[0]);
          ellipse(g, p.x, p.y - a(1.2), pr.rad * 0.94, pr.rad * 0.66, LEAF[bb]);
          ellipse(g, p.x - a(1), p.y - a(2), pr.rad * 0.5, pr.rad * 0.4, LEAF[Math.min(5, bb + 2)]);
          for (var bg = 0; bg < pr.rad * 0.9; bg++) {
            var ba2 = br2() * Math.PI * 2, bd = Math.sqrt(br2()) * pr.rad * 0.9;
            dot(g, p.x + Math.cos(ba2) * bd, p.y - a(1.2) + Math.sin(ba2) * bd * 0.7,
              (Math.cos(ba2) + Math.sin(ba2)) > 0 ? LEAF[0] : LEAF[Math.min(5, bb + 2)], 1);
          }
          break;
        }
        case 'rock': {
          boulder(g, p.x, p.y, pr.rad * K * 0.72, pr.h * 0.8, rng(pr.seed), pr.basalt ? BASALTS : null);
          break;
        }
        case 'reeds': {
          // a clump of reeds standing out of the shallows, a few with a brown head
          var rr5 = rng(pr.seed), nre = 5 + (rr5() * 5 | 0);
          ellipse(g, p.x, p.y, a(1.6), a(0.6), 'rgba(20,40,30,.35)');
          for (var re = 0; re < nre; re++) {
            var rx5 = p.x + (rr5() - 0.5) * a(2.6), rh = a(2.2 + rr5() * 3.2), lean = (rr5() - 0.5) * a(1.2);
            var rc = rr5() > 0.6 ? '#7a8a44' : rr5() > 0.3 ? '#56702f' : '#3e5423';
            edgeLine(g, [rx5, p.y], [rx5 + lean, p.y - rh], rc, 1);
            if (rr5() > 0.7) rect(g, rx5 + lean - 1, p.y - rh - 1, 2, a(0.9), '#5a3c22');
          }
          break;
        }
        case 'lily': {
          var lr = rng(pr.seed);
          for (var lpd = 0; lpd < 2 + (lr() * 3 | 0); lpd++) {
            var lx5 = p.x + (lr() - 0.5) * a(2.4), ly5 = p.y + (lr() - 0.5) * a(1);
            ellipse(g, lx5, ly5, a(0.8), a(0.36), '#3f6a2c');
            ellipse(g, lx5 - 1, ly5 - 1, a(0.5), a(0.2), '#5b8a3a');
            if (lr() > 0.75) dot(g, lx5, ly5 - 1, '#e8b4c8', 2);
          }
          break;
        }
        case 'crystals': {
          /* A cluster of green crystal: faceted prisms from one root, lit from
             within — a glow pooled on the ground round them and brightest at the tips. */
          var cr7 = rng(pr.seed), n7 = 3 + (cr7() * 4 | 0), sz7 = pr.size || 1;
          /* a radioactive glow: light added to the ground, not paint on it —
             a wide pool that fades out, with a hot core under the roots */
          function halo(rx, ry, cy, alpha) {
            g.save(); g.globalCompositeOperation = 'lighter';
            g.translate(p.x, cy); g.scale(1, ry / rx);
            var hg = g.createRadialGradient(0, 0, 0, 0, 0, rx);
            hg.addColorStop(0, 'rgba(110,255,160,' + alpha + ')');
            hg.addColorStop(0.35, 'rgba(60,230,120,' + alpha * 0.55 + ')');
            hg.addColorStop(1, 'rgba(30,200,90,0)');
            g.fillStyle = hg; g.beginPath(); g.arc(0, 0, rx, 0, Math.PI * 2); g.fill();
            g.restore();
          }
          halo(a(4.6 * sz7), a(2.2 * sz7), p.y, 0.45);
          ellipse(g, p.x, p.y, a(1.4 * sz7), a(0.6 * sz7), 'rgba(150,255,190,.3)');
          var shards = [];
          for (var k7 = 0; k7 < n7; k7++) {
            var lean = (cr7() - 0.5) * 0.8, hgt = a((1.6 + cr7() * 2.4) * sz7), wid = a((0.6 + cr7() * 0.45) * sz7);
            shards.push({ ox: (cr7() - 0.5) * a(1.4 * sz7), lean: lean, h: hgt, w: wid });
          }
          shards.sort(function (s1, s2) { return s2.h - s1.h; }).forEach(function (sh) {
            var bx7 = p.x + sh.ox, by7 = p.y, tx = bx7 + Math.sin(sh.lean) * sh.h, ty = by7 - Math.cos(sh.lean) * sh.h;
            var cx7 = tx - Math.sin(sh.lean) * sh.w * 0.9, cy7 = ty + Math.cos(sh.lean) * sh.w * 0.9;
            poly(g, [[bx7 - sh.w, by7], [cx7 - sh.w * 0.8, cy7], [tx, ty], [bx7, by7 + sh.w * 0.35]],
              vgrad(g, ty, by7, ['#7dffb4', '#2fb56a', '#12502f']));                                  // shaded face
            poly(g, [[bx7, by7 + sh.w * 0.35], [tx, ty], [cx7 + sh.w * 0.8, cy7], [bx7 + sh.w, by7]],
              vgrad(g, ty, by7, ['#d4ffe6', '#5cf09a', '#1f8a4c']));                                  // lit face
            edgeLine(g, [bx7, by7 + sh.w * 0.35], [tx, ty], 'rgba(235,255,245,.85)', 1);           // the glint down the edge
            ellipse(g, tx, ty, a(0.5 * sz7), a(0.5 * sz7), 'rgba(160,255,200,.35)');               // the glow at the tip
            dot(g, tx, ty, '#ffffff', 1);
          });
          halo(a(2.6 * sz7), a(2.6 * sz7), p.y - a(2 * sz7), 0.3);             // the air round them lit too
          break;
        }
        case 'vent': {
          // a vent over the hottest ground: a glow on the crust and smoke going up
          var vr = rng(pr.seed);
          ellipse(g, p.x, p.y, a(1.3), a(0.6), 'rgba(255,150,60,.16)');
          ellipse(g, p.x, p.y, a(0.5), a(0.22), 'rgba(255,210,130,.45)');
          for (var sm2 = 0; sm2 < 5; sm2++) {
            var sy2 = a(1.5) + sm2 * a(2.2);
            ellipse(g, p.x + sm2 * a(0.9) + vr() * a(1), p.y - sy2, a(1.1 + sm2 * 0.55), a(0.7 + sm2 * 0.3),
              'rgba(' + (60 - sm2 * 6) + ',' + (50 - sm2 * 5) + ',' + (46 - sm2 * 4) + ',' + (0.34 - sm2 * 0.055) + ')');
          }
          for (var em = 0; em < 3; em++) dot(g, p.x + (vr() - 0.5) * a(2), p.y - a(1 + vr() * 5), '#ffb040', 1);
          break;
        }
        case 'scrap': {
          // a twisted girder or a torn plate half-buried in the rubble
          var sr5 = rng(pr.seed), ang5 = sr5() * Math.PI, ln5 = a(3 + sr5() * 3);
          var ex5 = p.x + Math.cos(ang5) * ln5, ey5 = p.y + Math.sin(ang5) * ln5 * 0.5 - a(1 + sr5() * 1.5);
          shadowBlob(g, { x: p.x + a(1), y: p.y + a(0.4) }, ln5 * 0.6, a(0.8));
          edgeLine(g, [p.x, p.y], [ex5, ey5], '#2a2724', 3);
          edgeLine(g, [p.x, p.y - 1], [ex5, ey5 - 1], '#5a534a', 1);
          edgeLine(g, [ex5, ey5], [ex5 + a(1), ey5 - a(1.2)], '#3a3530', 2);
          if (sr5() > 0.5) dot(g, p.x + (ex5 - p.x) * 0.5, p.y + (ey5 - p.y) * 0.5, '#6b3a22', 2);   // rust
          break;
        }
        case 'log': {
          // a fallen trunk lying across the floor of the wood
          var lr6 = rng(pr.seed), dx6 = Math.cos(pr.ang) * pr.len, dy6 = Math.sin(pr.ang) * pr.len * 0.5;
          var A6 = [p.x - dx6 / 2, p.y - dy6 / 2], B6 = [p.x + dx6 / 2, p.y + dy6 / 2];
          shadowBlob(g, { x: p.x + a(0.8), y: p.y + a(0.5) }, pr.len * 0.55, a(1));
          edgeLine(g, [A6[0], A6[1] - a(0.3)], [B6[0], B6[1] - a(0.3)], BARK[0], a(1.6));
          edgeLine(g, [A6[0], A6[1] - a(0.7)], [B6[0], B6[1] - a(0.7)], BARK[1], a(0.9));
          edgeLine(g, [A6[0], A6[1] - a(1)], [B6[0], B6[1] - a(1)], BARK[2], 1);
          ellipse(g, B6[0], B6[1] - a(0.5), a(0.7), a(0.6), '#6b5238');       // the sawn or snapped end
          ellipse(g, B6[0], B6[1] - a(0.5), a(0.35), a(0.3), '#8a6c48');
          for (var ms = 0; ms < 4; ms++) {                                     // moss
            var f6 = lr6();
            dot(g, A6[0] + (B6[0] - A6[0]) * f6, A6[1] + (B6[1] - A6[1]) * f6 - a(1), LEAF[3], 2);
          }
          break;
        }
        case 'stump': {
          rect(g, p.x - a(0.8), p.y - a(1.4), a(1.6), a(1.4), BARK[1]);
          rect(g, p.x - a(0.8), p.y - a(1.4), a(0.5), a(1.4), BARK[2]);
          ellipse(g, p.x, p.y - a(1.4), a(0.8), a(0.4), '#7a6040');
          ellipse(g, p.x, p.y - a(1.4), a(0.4), a(0.2), '#5e4830');
          break;
        }
        case 'fern': {
          // undergrowth: a spray of fronds under the trees
          var fr6 = rng(pr.seed), fc = LEAF[1 + Math.round(pr.tone * 2)];
          for (var fd = 0; fd < 5; fd++) {
            var fa = Math.PI + fd / 4 * Math.PI + (fr6() - 0.5) * 0.3, fl = a(1.2 + fr6() * 1.2);
            edgeLine(g, [p.x, p.y], [p.x + Math.cos(fa) * fl * 1.3, p.y + Math.sin(fa) * fl * 0.8], fd % 2 ? fc : LEAF[Math.min(5, 3 + Math.round(pr.tone))], 1);
          }
          break;
        }
        case 'wire': {
          /* Barbed wire: two pickets a run, and loops of wire between them —
             a spiral seen side-on, catching the light where it turns. */
          var wr2 = rng(pr.seed), lf2 = lift || 0;
          var ux2 = pr.horiz ? 1 : 0, uy2 = pr.horiz ? 0 : 1;
          function ws(t, z) { var q = toScreen(pr.x + ux2 * t, pr.y + uy2 * t); return [q.x, q.y - lf2 - z]; }
          var L2 = (pr.len || 1.5) / 2, HT = a(2.6);
          [-L2 + 0.1, L2 - 0.1].forEach(function (t) {
            var b0 = ws(t, 0), b1 = ws(t, HT + a(0.6));
            g.strokeStyle = '#3b3326'; g.lineWidth = Math.max(1, a(0.35));
            g.beginPath(); g.moveTo(b0[0], b0[1]); g.lineTo(b1[0], b1[1]); g.stroke();
          });
          g.lineWidth = 1;
          for (var loop = 0; loop < 2; loop++) {
            g.strokeStyle = loop ? 'rgba(170,176,178,.85)' : 'rgba(70,72,74,.9)';
            g.beginPath();
            for (var k2 = 0; k2 <= 28; k2++) {
              var tt2 = -L2 + (k2 / 28) * 2 * L2, ph = k2 / 28 * Math.PI * 2 * 3 + loop * 0.6 + wr2() * 0.2;
              var q2 = ws(tt2 + Math.cos(ph) * 0.12, HT * (0.5 + Math.sin(ph) * 0.45));
              if (k2) g.lineTo(q2[0] + (loop ? 0 : 1), q2[1] + (loop ? 0 : 1)); else g.moveTo(q2[0], q2[1]);
            }
            g.stroke();
          }
          break;
        }
        case 'sandbag': {
          /* A run of a low sandbag wall: two courses of bags laid end to end
             along the wall's own line, each course set half a bag over the one
             below, so run after run joins into one wall. */
          var sr = rng(pr.seed || ((pr.tone * 9999) | 0));
          var ux = pr.horiz ? 1 : 0, uy = pr.horiz ? 0 : 1, vx = 1 - ux, vy = 1 - uy;
          var len6 = pr.len || 0.75, BL = 0.5, HW = 0.2, HC = a(1.9), lf = lift || 0;
          var nb = Math.max(1, Math.round(len6 / BL)), bl = len6 / nb;
          function scr(wx2, wy2, up) { var q = toScreen(wx2, wy2); return [q.x, q.y - lf - up]; }
          // the shadow along the foot of the wall
          var s0 = -len6 / 2, s1 = len6 / 2;
          poly(g, [scr(pr.x + ux * s0 + vx * (HW + 0.25), pr.y + uy * s0 + vy * (HW + 0.25), 0),
            scr(pr.x + ux * s1 + vx * (HW + 0.25), pr.y + uy * s1 + vy * (HW + 0.25), 0),
            scr(pr.x + ux * s1 + vx * HW, pr.y + uy * s1 + vy * HW, 0),
            scr(pr.x + ux * s0 + vx * HW, pr.y + uy * s0 + vy * HW, 0)], 'rgba(16,12,8,.35)');
          for (var course = 0; course < (pr.courses || 2); course++) {
            var off = course % 2 ? bl / 2 : 0;
            var bags = [];
            for (var bi = -1; bi <= nb; bi++) {
              var c0 = -len6 / 2 + bi * bl + off, c1 = c0 + bl;
              // clip to this run, so neighbouring runs meet without overlapping
              var a0 = Math.max(c0, -len6 / 2), a1 = Math.min(c1, len6 / 2);
              if (a1 - a0 < 0.06) continue;
              // the very ends of the wall are squared off rather than left ragged
              bags.push([a0, a1]);
            }
            var z0 = course * HC, z1 = z0 + HC;
            var inset = course * 0.02;
            bags.forEach(function (bg) {
              /* a bag is a filled sack, not a brick: its outline is a rounded
                 oblong, it bulges at the middle, sits lower at its tied ends, and
                 the weave of the hessian catches the light across its top */
              var p0 = bg[0] + 0.02, p1 = bg[1] - 0.02, w0 = HW - inset, cm = (p0 + p1) / 2, hl = (p1 - p0) / 2;
              var cutL = bg[0] <= -len6 / 2 + 1e-6 && !pr.first, cutR = bg[1] >= len6 / 2 - 1e-6 && !pr.last;
              function P(t, v, z) { return scr(pr.x + ux * t + vx * v, pr.y + uy * t + vy * v, z); }
              function outline(k, z, sag) {
                var pts = [];
                for (var q = 0; q < 16; q++) {
                  var th = q / 16 * Math.PI * 2, cc = Math.cos(th), ss = Math.sin(th);
                  var ex = 0.35;                                  // squarish in plan, round at the corners
                  var tt = (cc < 0 ? -1 : 1) * Math.pow(Math.abs(cc), ex), vv = (ss < 0 ? -1 : 1) * Math.pow(Math.abs(ss), ex);
                  // a bag cut where one run meets the next is squared off so the wall reads unbroken
                  if ((cutL && tt < 0) || (cutR && tt > 0)) tt = tt < 0 ? -1 : 1;
                  var zz = z - sag * Math.pow(Math.abs(tt), 4);   // the tied ends slump
                  pts.push(P(cm + tt * hl * k, vv * w0 * k, zz));
                }
                return pts;
              }
              var tint = BAG[Math.min(3, 1 + ((sr() * 2.2) | 0))];
              poly(g, outline(1, z0, 0), '#3e331d');                                  // the bag's foot, in shade
              poly(g, outline(1, z0 + HC * 0.45, HC * 0.15), pr.horiz ? BAG[0] : BAG[1]);   // its flank
              poly(g, outline(0.97, z1 - 1, HC * 0.3), tint);                         // the top
              var hi = outline(0.62, z1 + 1, HC * 0.2);
              poly(g, hi.map(function (q) { return [q[0] - 1, q[1] - 1]; }), BAG[3]);    // the belly catching the sun
              // the weave: a few rows of darker stitches across the top
              for (var wv = 0; wv < 6; wv++) {
                var wt = cm + (sr() - 0.5) * hl * 1.4, wvv = (sr() - 0.5) * w0 * 1.4;
                var wq = P(wt, wvv, z1 - 1);
                dot(g, wq[0], wq[1], sr() > 0.5 ? 'rgba(60,46,24,.55)' : 'rgba(200,180,130,.35)', 1);
              }
              // the seam between this bag and the next, and a tied ear on the odd one
              var sA = P(p1, -w0 * 0.8, z1 - HC * 0.3), sB = P(p1, w0 * 0.8, z1 - HC * 0.3);
              if (!cutR) edgeLine(g, sA, sB, 'rgba(40,32,18,.6)', 1);
              if (!cutR && sr() > 0.72) { var ear = P(p1 + 0.03, w0 * 0.3, z1 - HC * 0.2); rect(g, ear[0], ear[1] - 1, 2, 2, '#5a4a2a'); }
            });
          }
          break;
        }
        case 'wallrun': {
          /* A run of high wall: cast concrete panels between square posts, a
             coping along the top, grime rising from the foot, rain streaks, the
             odd crack and bullet pock, and on some walls a coil of razor wire. */
          var wr2 = rng(pr.seed), lf2 = lift || 0;
          var ux2 = pr.horiz ? 1 : 0, uy2 = pr.horiz ? 0 : 1, vx2 = 1 - ux2, vy2 = 1 - uy2;
          // a reinforced wall (p. 41) is thicker, and banded at the foot so it reads as one that stays up
          var L2 = pr.len, T2 = pr.reinforced ? 0.36 : 0.22, H2 = pr.height;
          function Q(t, v, z) { var q = toScreen(pr.x + ux2 * t + vx2 * v, pr.y + uy2 * t + vy2 * v); return [q.x, q.y - lf2 - z]; }
          function slab(t0, t1, v0, v1, z0, z1, pal2) {
            // the near side and the far end in shade, the top lit
            poly(g, [Q(t0, v1, z0), Q(t1, v1, z0), Q(t1, v1, z1), Q(t0, v1, z1)], pr.horiz ? pal2[3] : pal2[2]);
            poly(g, [Q(t1, v0, z0), Q(t1, v1, z0), Q(t1, v1, z1), Q(t1, v0, z1)], pr.horiz ? pal2[2] : pal2[3]);
            poly(g, [Q(t0, v0, z1), Q(t1, v0, z1), Q(t1, v1, z1), Q(t0, v1, z1)], pal2[4]);
          }
          var h0 = -L2 / 2, h1 = L2 / 2;
          // a shadow along the foot
          poly(g, [Q(h0, T2, 0), Q(h1, T2, 0), Q(h1, T2 + 0.5, 0), Q(h0, T2 + 0.5, 0)], 'rgba(14,11,8,.35)');
          slab(h0, h1, -T2, T2, 0, H2, CONCRETE);
          // panel joints, and the grime and streaks on the face that shows
          var np = Math.max(1, Math.round(L2 / 0.75));
          for (var pj = 1; pj < np; pj++) {
            var tj = h0 + (h1 - h0) * pj / np;
            edgeLine(g, Q(tj, T2, 1), Q(tj, T2, H2 - 1), CONCRETE[1], 1);
          }
          edgeLine(g, Q(h0, T2, H2 * 0.5), Q(h1, T2, H2 * 0.5), 'rgba(40,38,34,.35)', 1);   // the pour line
          if (pr.reinforced) {
            // hazard chevrons along the foot of the face that shows
            var nb = Math.max(2, Math.round(L2 / 0.35)), bz = Math.max(2, H2 * 0.14);
            for (var hb = 0; hb < nb; hb++) {
              var ta = h0 + (h1 - h0) * hb / nb, tb = h0 + (h1 - h0) * (hb + 1) / nb;
              poly(g, [Q(ta, T2, 0), Q(tb, T2, 0), Q(tb, T2, bz), Q(ta, T2, bz)], hb % 2 ? '#26241f' : '#c9a23a');
            }
          }
          for (var gm = 0; gm < 26; gm++) {
            var gt = h0 + wr2() * L2, gz = wr2() * wr2() * H2 * 0.5;
            var gq = Q(gt, T2, gz); dot(g, gq[0], gq[1], 'rgba(40,34,26,.5)', 1);
          }
          for (var rs = 0; rs < 3; rs++) {
            var rt = h0 + wr2() * L2, rl = wr2() * H2 * 0.5;
            for (var rz = 0; rz < rl; rz++) { var rq = Q(rt, T2, H2 - 2 - rz); dot(g, rq[0], rq[1], 'rgba(50,46,40,.35)', 1); }
          }
          if (wr2() > 0.6) {                                 // a crack across a panel
            var ct = h0 + wr2() * L2, cz = H2 * (0.3 + wr2() * 0.5), cq = Q(ct, T2, cz);
            for (var ck = 0; ck < 6; ck++) { var nq2 = [cq[0] + (wr2() - 0.3) * 4, cq[1] + (wr2() - 0.5) * 4]; edgeLine(g, cq, nq2, '#34322d', 1); cq = nq2; }
          }
          for (var bp2 = 0; bp2 < 3; bp2++) {                // bullet pocks
            if (wr2() > 0.5) continue;
            var bq = Q(h0 + wr2() * L2, T2, H2 * (0.2 + wr2() * 0.7)); dot(g, bq[0], bq[1], '#2e2c28', 2); dot(g, bq[0], bq[1] - 1, CONCRETE[5], 1);
          }
          // the coping, a little proud of the wall, chipped here and there
          slab(h0, h1, -T2 - 0.05, T2 + 0.05, H2, H2 + a(0.8), CONCRETE);
          edgeLine(g, Q(h0, T2 + 0.05, H2 + a(0.8)), Q(h1, T2 + 0.05, H2 + a(0.8)), CONCRETE[5], 1);
          // the posts: at the start of every run, and at the far end of the last
          var posts = [h0].concat(pr.last ? [h1 - 0.3] : []);
          posts.forEach(function (pt0) {
            slab(pt0, pt0 + 0.3, -T2 - 0.08, T2 + 0.08, 0, H2 + a(1.4), CONCRETE);
            edgeLine(g, Q(pt0, T2 + 0.08, H2 + a(1.4)), Q(pt0, T2 + 0.08, 1), CONCRETE[5], 1);
          });
          if (pr.wire) {
            // razor wire: a coil of loops along the top
            for (var lp2 = 0; lp2 < 7; lp2++) {
              var lt = h0 + (lp2 + 0.5) * L2 / 7, lc = Q(lt, 0, H2 + a(2.4));
              ellipse(g, lc[0], lc[1], a(1.3), a(1.3), 'rgba(0,0,0,0)');
              g.save(); g.strokeStyle = 'rgba(150,154,158,.85)'; g.lineWidth = 1;
              g.beginPath(); g.ellipse(lc[0], lc[1], a(1.1), a(1.4), 0.5, 0, Math.PI * 2); g.stroke(); g.restore();
              dot(g, lc[0] + a(0.8), lc[1] - a(0.6), '#d0d4d8', 1);
            }
          }
          break;
        }
        case 'rubble': {
          var rr = rng(pr.seed), nch = 3 + (rr() * 4 | 0);
          for (var ch = 0; ch < nch; ch++) {
            pebble(g, p.x + (rr() - 0.5) * a(5), p.y + (rr() - 0.5) * a(2.4), 1 + (rr() * 4 | 0), rr);
          }
          break;
        }
        case 'wreckstone': {
          /* A broken block of stone or concrete: two or three chunks, each with a
             lit top, a shaded flank and a darker one, cracked across, with grit
             scattered round them. */
          var wr3 = rng(pr.seed), sb = 1 + Math.round(pr.tone * 2);
          shadowBlob(g, { x: p.x, y: p.y + a(0.6) }, a(2.8), a(1.3));
          var nck = 2 + (wr3() * 2 | 0), cks = [];
          for (var ck = 0; ck < nck; ck++) cks.push({ x: p.x + (wr3() - 0.5) * a(3.4), y: p.y + (wr3() - 0.5) * a(1.4), w: a(0.8 + wr3() * 1.1), h: a(0.5 + wr3() * 1.1) });
          cks.sort(function (m, n) { return m.y - n.y; });
          cks.forEach(function (c) {
            var d = c.w * 0.5, j = function () { return (wr3() - 0.5) * c.w * 0.25; };
            var T = [[c.x - c.w + j(), c.y - c.h + j() * 0.5], [c.x + j(), c.y - c.h - d * 0.5 + j() * 0.5], [c.x + c.w + j(), c.y - c.h + j() * 0.5], [c.x + j(), c.y - c.h + d * 0.5]];
            poly(g, [T[0], T[3], [T[3][0], c.y + d * 0.5], [T[0][0], c.y]], STONE[sb]);                 // the face to the light's side
            poly(g, [T[3], T[2], [T[2][0], c.y], [T[3][0], c.y + d * 0.5]], STONE[Math.max(0, sb - 1)]); // the face in shade
            poly(g, T, STONE[Math.min(5, sb + 2)]);                                                     // the broken top
            edgeLine(g, T[0], T[1], STONE[Math.min(5, sb + 3)], 1);                                      // its lit edge
            edgeLine(g, lerp2(T[0], T[2], 0.3 + wr3() * 0.2), lerp2(T[1], T[3], 0.4 + wr3() * 0.3), STONE[Math.max(0, sb - 1)], 1);   // a crack
            for (var pk = 0; pk < 3; pk++) dot(g, c.x + (wr3() - 0.5) * c.w, c.y - c.h * wr3(), wr3() > 0.5 ? STONE[0] : STONE[Math.min(5, sb + 1)], 1);
          });
          for (var dq = 0; dq < 9; dq++) {
            dot(g, p.x + (wr3() - 0.5) * a(5.5), p.y + (wr3() - 0.3) * a(2), wr3() > 0.6 ? CHAR[0] : STONE[1 + (wr3() * 3 | 0)], 1);
          }
          break;
        }
        case 'wreckbag': {
          /* A low wall brought down: its bags burst and slumped, the sand spilled
             out across the ground in a fan, the hessian torn open. */
          var wb = rng(pr.seed);
          ellipse(g, p.x + (wb() - 0.5) * a(1), p.y + a(0.4), a(3.2), a(1.3), 'rgba(150,122,74,.5)');
          for (var sg = 0; sg < 26; sg++) {
            var ga = wb() * Math.PI * 2, gd = Math.sqrt(wb());
            dot(g, p.x + Math.cos(ga) * gd * a(3.2), p.y + a(0.4) + Math.sin(ga) * gd * a(1.3), wb() > 0.5 ? BAG[1] : BAG[3], 1);
          }
          var nbag = 1 + (wb() * 2 | 0);
          for (var bg2 = 0; bg2 < nbag; bg2++) {
            var bx = p.x + (wb() - 0.5) * a(2.6), by = p.y + (wb() - 0.5) * a(1), ang2 = (wb() - 0.5) * 1.2;
            var L3 = a(1.1 + wb() * 0.5), W3 = a(0.55), H3 = a(0.45 + wb() * 0.3);
            var ca = Math.cos(ang2), sa2 = Math.sin(ang2);
            var bagAt = function (k, up) {
              var pts = [];
              for (var q2 = 0; q2 < 14; q2++) {
                var th2 = q2 / 14 * Math.PI * 2, cc2 = Math.cos(th2), ss2 = Math.sin(th2);
                var tx2 = (cc2 < 0 ? -1 : 1) * Math.pow(Math.abs(cc2), 0.45) * L3 * k, ty2 = (ss2 < 0 ? -1 : 1) * Math.pow(Math.abs(ss2), 0.45) * W3 * k;
                pts.push([bx + tx2 * ca - ty2 * sa2, by + (tx2 * sa2 + ty2 * ca) * 0.55 - up]);
              }
              return pts;
            };
            poly(g, bagAt(1, 0), '#3e331d');                                   // its foot, in shade
            poly(g, bagAt(0.98, H3 * 0.5), BAG[0]);                            // the slumped flank
            poly(g, bagAt(0.9, H3), BAG[Math.min(3, 1 + (wb() * 2 | 0))]);     // the top
            poly(g, bagAt(0.5, H3 + 1).map(function (q3) { return [q3[0] - 1, q3[1] - 1]; }), BAG[3]);
            // the tear: a dark gash with sand at its lip
            var te = [bx + ca * L3 * 0.55, by + sa2 * L3 * 0.3 - H3];
            poly(g, [[te[0] - a(0.5), te[1]], [te[0], te[1] - a(0.25)], [te[0] + a(0.45), te[1] + a(0.1)], [te[0], te[1] + a(0.3)]], '#241c10');
            dot(g, te[0] + a(0.5), te[1] + a(0.3), BAG[3], 2);
            for (var wv2 = 0; wv2 < 4; wv2++) dot(g, bx + (wb() - 0.5) * L3, by + (wb() - 0.5) * W3 * 0.5 - H3, 'rgba(60,46,24,.55)', 1);
          }
          break;
        }
        case 'burntshell': {
          // the gutted footprint: scorched walls, no roof
          var b1 = toScreen(pr.x, pr.y), b2 = toScreen(pr.x + pr.w, pr.y);
          var b3 = toScreen(pr.x + pr.w, pr.y + pr.h), b4 = toScreen(pr.x, pr.y + pr.h);
          var bh = pr.height;
          var br = rng(pr.seed);
          poly(g, [[b1.x, b1.y], [b2.x, b2.y], [b3.x, b3.y], [b4.x, b4.y]], '#1a1512');
          // the floor inside: ash, embers still glowing, fallen roof beams
          for (var ash = 0; ash < pr.w * pr.h * 22; ash++) {
            var aq = toScreen(pr.x + br() * pr.w, pr.y + br() * pr.h), ar = br();
            dot(g, aq.x, aq.y, ar > 0.93 ? '#e0702a' : ar > 0.86 ? '#8c2a0c' : ar > 0.5 ? '#2b241f' : '#100c0a', ar > 0.86 ? 1 : 2);
          }
          for (var bm = 0; bm < 3 + (br() * 3 | 0); bm++) {
            var bA = toScreen(pr.x + br() * pr.w, pr.y + br() * pr.h);
            var bB = toScreen(pr.x + br() * pr.w, pr.y + br() * pr.h);
            edgeLine(g, [bA.x, bA.y - 2], [bB.x, bB.y - 2], '#0c0907', 3);
            edgeLine(g, [bA.x, bA.y - 3], [bB.x, bB.y - 3], '#3a2d22', 1);
          }
          poly(g, [[b2.x, b2.y], [b3.x, b3.y], [b3.x, b3.y - bh], [b2.x, b2.y - bh]],
            vgrad(g, b3.y - bh, b3.y, ['#15110d', '#2e251c', '#3a2e22']));
          poly(g, [[b4.x, b4.y], [b3.x, b3.y], [b3.x, b3.y - bh], [b4.x, b4.y - bh]],
            vgrad(g, b3.y - bh, b3.y, ['#1a140f', '#3d3226', '#4a3c2c']));
          // soot licking up from the empty window holes
          [[b4, b3], [b2, b3]].forEach(function (wv) {
            for (var wi = 0.2; wi < 0.9; wi += 0.25) {
              var wq = lerp2([wv[0].x, wv[0].y], [wv[1].x, wv[1].y], wi);
              rect(g, wq[0] - a(0.6), wq[1] - bh * 0.6, a(1.2), a(1.6), '#0a0806');
              for (var sl = 0; sl < bh * 0.4; sl++) {
                dot(g, wq[0] - a(0.6) + br() * a(1.2), wq[1] - bh * 0.6 - sl, 'rgba(8,6,5,.5)', 1);
              }
            }
          });
          // jagged remains of the upper courses
          for (var jc = 0; jc < 7; jc++) {
            var t2 = br();
            var jx = b4.x + (b3.x - b4.x) * t2, jy = b4.y + (b3.y - b4.y) * t2;
            rect(g, jx - a(1), jy - bh - a(1.6) - br() * a(2), a(2), a(2 + br() * 2), '#3a2f23');
          }
          for (var jd = 0; jd < 7; jd++) {
            var t3 = br();
            var kx = b2.x + (b3.x - b2.x) * t3, ky = b2.y + (b3.y - b2.y) * t3;
            rect(g, kx - a(1), ky - bh - a(1.4) - br() * a(2), a(2), a(2 + br() * 2), '#44372a');
          }
          break;
        }
        case 'flame': {
          var fr = rng(pr.seed);
          var fh = a(2 + pr.tone * 2.4);
          // light thrown on the ground, then the fire as layered tongues:
          // a red outer flame, orange body, a yellow-white heart low down
          ellipse(g, p.x, p.y, a(4), a(2), 'rgba(240,120,40,.16)');
          ellipse(g, p.x, p.y, a(2.4), a(1.2), 'rgba(250,160,60,.22)');
          var tongues = 3 + (fr() * 2 | 0);
          for (var tg = 0; tg < tongues; tg++) {
            var tx2 = p.x + (tg - (tongues - 1) / 2) * a(0.8) + (fr() - 0.5) * a(0.5);
            var th2 = fh * (0.6 + fr() * 0.6) * (tg === (tongues / 2 | 0) ? 1.25 : 1);
            [['#9a2e10', 1], ['#e0702a', 0.72], ['#f6c056', 0.45], ['#fff0c0', 0.2]].forEach(function (L) {
              var hh = th2 * L[1] + a(0.6), ww = a(1.1) * (0.5 + L[1] * 0.6);
              poly(g, [[tx2 - ww, p.y - a(0.3)], [tx2 + ww, p.y - a(0.3)],
                [tx2 + ww * 0.4, p.y - hh * 0.55], [tx2 + (fr() - 0.5) * a(0.6), p.y - hh], [tx2 - ww * 0.5, p.y - hh * 0.5]], L[0]);
            });
          }
          for (var sp3 = 0; sp3 < 3; sp3++) dot(g, p.x + (fr() - 0.5) * a(3), p.y - fh * (1.1 + fr() * 0.8), '#ffb040', 1);
          dot(g, p.x, p.y, '#4a2a16', 2);
          // smoke drifting up and away
          for (var sm = 0; sm < 4; sm++) {
            var sy = fh + a(2) + sm * a(2.4);
            ellipse(g, p.x + a(0.8) + sm * a(1.1) + fr() * a(1.2), p.y - sy,
              a(1.6 + sm * 0.6), a(1 + sm * 0.35), 'rgba(38,32,28,' + (0.3 - sm * 0.055) + ')');
          }
          break;
        }
        case 'wall': {
          brokenWall(g, pr);
          break;
        }
        /* The Demolish scenario's target: a tall concrete mast on a plinth, so it is
           obvious from across the table what has to come down. */
        case 'objective': {
          /* The Demolish target (p. 54): a hardened uplink station. A squat
             blockhouse of reinforced concrete, striped with hazard paint at the
             foot and shut with a blast door, carrying a lattice mast with two
             dishes, guy wires and a red warning light — so from across the table
             it is plain what has to come down. */
          var ol = lift || 0;
          box(g, pr, CONCRETE, { roof: '#45443e', roofEdge: '#6a675e', windows: null, lift: ol });
          function O(x, y, up) { var q = toScreen(x, y); return [q.x, q.y - ol - (up || 0)]; }
          var H0 = pr.height;
          var o1 = O(pr.x, pr.y + pr.h), o2 = O(pr.x + pr.w, pr.y + pr.h), o3 = O(pr.x + pr.w, pr.y);
          // hazard stripes round the foot of the two walls you can see
          [[o1, o2], [o3, o2]].forEach(function (F) {
            var A = F[0], B = F[1], L = Math.hypot(B[0] - A[0], B[1] - A[1]), n = Math.round(L / a(2.2));
            for (var i = 0; i < n; i++) {
              var p0 = lerp2(A, B, i / n), p1 = lerp2(A, B, (i + 1) / n), hs = a(1.8);
              poly(g, [p0, p1, [p1[0], p1[1] - hs], [p0[0], p0[1] - hs]], i % 2 ? '#1b1a17' : '#d9a441');
            }
            edgeLine(g, [A[0], A[1] - a(1.8)], [B[0], B[1] - a(1.8)], '#2e2c28', 1);
          });
          // the blast door: a steel slab in a heavy frame, riveted, with a warning lamp
          var dA = lerp2(o1, o2, 0.36), dB = lerp2(o1, o2, 0.64), dh2 = Math.min(H0 - a(2), a(8));
          poly(g, [[dA[0] - 2, dA[1]], [dB[0] + 2, dB[1]], [dB[0] + 2, dB[1] - dh2 - 3], [dA[0] - 2, dA[1] - dh2 - 3]], '#2b2a26');
          poly(g, [dA, dB, [dB[0], dB[1] - dh2], [dA[0], dA[1] - dh2]], '#5d6166');
          poly(g, [dA, lerp2(dA, dB, 0.5), [lerp2(dA, dB, 0.5)[0], lerp2(dA, dB, 0.5)[1] - dh2], [dA[0], dA[1] - dh2]], '#6c7176');
          edgeLine(g, lerp2(dA, dB, 0.5), [lerp2(dA, dB, 0.5)[0], lerp2(dA, dB, 0.5)[1] - dh2], '#34373a', 1);
          for (var rv = 0; rv < 6; rv++) {
            var rq = lerp2(dA, dB, rv % 2 ? 0.88 : 0.12);
            dot(g, rq[0], rq[1] - dh2 * (0.15 + Math.floor(rv / 2) * 0.33), '#8e949a', 1);
          }
          var lamp = lerp2(dA, dB, 0.5);
          dot(g, lamp[0] - 1, lamp[1] - dh2 - a(1.6), '#ff5a3a', 3);
          ellipse(g, lamp[0], lamp[1] - dh2 - a(1.4), a(1.4), a(0.7), 'rgba(255,90,58,.2)');
          // louvred vents high on the right-hand wall
          for (var vn = 0; vn < 2; vn++) {
            var v0 = lerp2(o3, o2, 0.25 + vn * 0.35), v1 = lerp2(o3, o2, 0.4 + vn * 0.35);
            poly(g, [[v0[0], v0[1] - H0 + a(4)], [v1[0], v1[1] - H0 + a(4)], [v1[0], v1[1] - H0 + a(6.5)], [v0[0], v0[1] - H0 + a(6.5)]], '#2a2926');
            for (var lv = 0; lv < 3; lv++) edgeLine(g, [v0[0], v0[1] - H0 + a(4.5) + lv * a(0.7)], [v1[0], v1[1] - H0 + a(4.5) + lv * a(0.7)], '#6a675e', 1);
          }
          // the mast: a lattice tower, tapering, cross-braced, on the middle of the roof
          var mc = toScreen(pr.x + pr.w / 2, pr.y + pr.h / 2), mx = mc.x, my = mc.y - ol - H0;
          var MH = a(36), bw0 = a(3.2), bw1 = a(1.2);
          // guy wires from the top down to the roof corners
          [O(pr.x + 0.4, pr.y + 0.4, H0), O(pr.x + pr.w - 0.4, pr.y + 0.4, H0), O(pr.x + pr.w - 0.4, pr.y + pr.h - 0.4, H0), O(pr.x + 0.4, pr.y + pr.h - 0.4, H0)].forEach(function (q) {
            edgeLine(g, [mx, my - MH * 0.8], q, 'rgba(40,40,38,.7)', 1);
          });
          rect(g, mx - a(3.4), my - a(1.2), a(6.8), a(1.2), '#3a3934');   // the footing
          var legs = [-1, 1];
          legs.forEach(function (sd) { edgeLine(g, [mx + sd * bw0, my], [mx + sd * bw1, my - MH], sd < 0 ? '#8a877e' : '#4a4843', 2); });
          edgeLine(g, [mx, my + 1], [mx, my - MH], '#5d5b54', 1);          // the third leg, behind
          for (var st2 = 0; st2 < 6; st2++) {
            var f0 = st2 / 6, f1 = (st2 + 1) / 6;
            var w0 = bw0 + (bw1 - bw0) * f0, w1 = bw0 + (bw1 - bw0) * f1;
            var y0 = my - MH * f0, y1 = my - MH * f1;
            edgeLine(g, [mx - w0, y0], [mx + w1, y1], '#6a675e', 1);
            edgeLine(g, [mx + w0, y0], [mx - w1, y1], '#5a574f', 1);
            edgeLine(g, [mx - w1, y1], [mx + w1, y1], '#7a776e', 1);
          }
          // two dishes, turned different ways, and a whip aerial on top
          function dish(dx, dy, r2, face) {
            ellipse(g, mx + dx, my - dy, r2, r2 * 1.1, '#3e3d38');
            ellipse(g, mx + dx + face, my - dy, r2 * 0.9, r2, '#c9c6bb');
            ellipse(g, mx + dx + face * 1.5, my - dy, r2 * 0.55, r2 * 0.6, '#a9a699');
            edgeLine(g, [mx + dx + face, my - dy], [mx + dx + face * 3.5, my - dy - 1], '#3e3d38', 1);
            dot(g, mx + dx + face * 3.5 - 1, my - dy - 2, '#5a574f', 2);
          }
          dish(-a(3.2), MH * 0.42, a(2.2), -a(0.8));
          dish(a(2.8), MH * 0.66, a(1.7), a(0.7));
          rect(g, mx, my - MH - a(6), 1, a(6), '#2a2926');
          // the warning lamps, unlit: they flash over the table every frame (drawLive)
          dot(g, mx - 1, my - MH - a(6) - 1, '#5a2018', 3);
          dot(g, mx - 1, my - MH * 0.5, '#5a2018', 2);
          break;
        }
        case 'building':
        case 'bunker':
        case 'highwall': {
          var bst = pr.kind === 'building' ? (pr.style || 'concrete') : null;
          var bp = pr.kind === 'bunker' ? CONCRETE : pr.kind === 'highwall' ? STONE : bst === 'brick' ? BRICK : bst === 'prefab' ? PREFAB : CONCRETE;
          box(g, pr, bp, {
            style: bst, main: pr.main !== false,
            roof: pr.kind === 'bunker' ? '#3a3a35' : pr.kind === 'highwall' ? STONE[4] : bst === 'brick' ? '#3e3a36' : bst === 'prefab' ? '#4a4f47' : ROOF[2],
            roofEdge: pr.kind === 'bunker' ? '#4c4c45' : pr.kind === 'highwall' ? STONE[5] : bst === 'brick' ? '#56504a' : bst === 'prefab' ? '#5e645a' : ROOF[3],
            windows: pr.kind === 'building' ? 'lit' : pr.kind === 'bunker' ? 'slit' : null,
            lift: lift || 0, bunker: pr.kind === 'bunker',
            cutaway: !!cutaway
          });
          break;
        }
        /* A possible objective location (p. 52): a prised-open hatch. Searched and
           ruled out, it is struck through; the one found becomes an objective marker
           of its own. */
        case 'searchsite': {
          var sr = rng(pr.seed || 7);
          shadowBlob(g, { x: p.x, y: p.y }, a(7), a(3.5));
          ellipse(g, p.x, p.y, a(7), a(3.5), '#2e2820');
          ellipse(g, p.x, p.y, a(5), a(2.5), '#221d17');
          // the hatch rim, a low collar of plating
          poly(g, [[p.x - a(4), p.y], [p.x, p.y + a(2)], [p.x + a(4), p.y], [p.x, p.y - a(2)]], '#4a4a44');
          poly(g, [[p.x - a(3.2), p.y - a(0.4)], [p.x, p.y + a(1.2)], [p.x + a(3.2), p.y - a(0.4)], [p.x, p.y - a(2)]], '#5d5d55');
          poly(g, [[p.x - a(2.4), p.y], [p.x, p.y + a(1.2)], [p.x + a(2.4), p.y], [p.x, p.y - a(1.2)]], '#15181b');
          for (var sn = 0; sn < 5; sn++) {
            dot(g, p.x - a(3) + sr() * a(6), p.y - a(1.4) + sr() * a(2.8), '#6e6e64');
          }
          // a location ruled out is struck through
          if (pr.checked && pr.cold) {
            edgeLine(g, [p.x - a(4), p.y - a(2)], [p.x + a(4), p.y + a(2)], '#8c3c2e', 2);
            edgeLine(g, [p.x - a(4), p.y + a(2)], [p.x + a(4), p.y - a(2)], '#8c3c2e', 2);
          }
          break;
        }
        case 'beacon': {
          if (pr.lz) {
            /* An Invasion landing zone (p. 53): a smoke canister set down in the
               middle of it, its smoke (the attacker's colour) drawn rising every frame (drawLive). */
            shadowBlob(g, { x: p.x + a(0.6), y: p.y + a(0.3) }, a(2.2), a(1.1));
            ellipse(g, p.x, p.y, a(2.4), a(1.2), 'rgba(30,30,28,.32)');       // the ground scorched round it
            rect(g, p.x - a(0.8), p.y - a(2.2), a(1.6), a(2.2), '#3c4a38');
            rect(g, p.x - a(0.8), p.y - a(2.2), a(0.6), a(2.2), '#5a6a52');
            rect(g, p.x - a(0.8), p.y - a(1.4), a(1.6), a(0.5), '#c9cdd2');    // its band
            ellipse(g, p.x, p.y - a(2.2), a(0.8), a(0.4), '#2a3326');
            break;
          }
          /* An objective marker: a steel post on a concrete plinth ringed with
             hazard paint, a cloth pennant from its head and a lamp on top, so it is
             plain from anywhere on the table where the point to hold is. */
          var bq = rng(7 + (pr.index || 0) * 31);
          shadowBlob(g, { x: p.x + a(1), y: p.y + a(0.4) }, a(4.6), a(2.2));
          // the plinth: a low slab with a bevelled top
          var D0 = [[p.x - a(4.4), p.y], [p.x, p.y + a(2.2)], [p.x + a(4.4), p.y], [p.x, p.y - a(2.2)]];
          var lift3 = a(1.1), D1 = D0.map(function (q) { return [q[0], q[1] - lift3]; });
          poly(g, [D0[0], D0[1], D1[1], D1[0]], '#2a2f36');
          poly(g, [D0[1], D0[2], D1[2], D1[1]], '#1d2127');
          poly(g, D1, '#4a525d');
          poly(g, D1.map(function (q) { return [p.x + (q[0] - p.x) * 0.78, p.y - lift3 + (q[1] - p.y + lift3) * 0.78]; }), '#59626e');
          // hazard paint round the rim of the slab
          [[D1[0], D1[1]], [D1[1], D1[2]]].forEach(function (F) {
            var n = 7;
            for (var i = 0; i < n; i++) {
              var q0 = lerp2(F[0], F[1], i / n), q1 = lerp2(F[0], F[1], (i + 1) / n);
              poly(g, [q0, q1, [q1[0], q1[1] + a(0.6)], [q0[0], q0[1] + a(0.6)]], i % 2 ? '#1b1a17' : '#d9a441');
            }
          });
          edgeLine(g, D1[3], D1[0], '#7b8592', 1);
          edgeLine(g, D1[3], D1[2], '#6a7380', 1);
          // the post: square steel, lit down its left face
          var px0 = p.x - a(0.7), pw = a(1.4), top = p.y - lift3 - a(14), bot = p.y - lift3;
          rect(g, px0, top, pw, bot - top, '#2c343e');
          rect(g, px0, top, pw * 0.5, bot - top, '#4a5664');
          rect(g, px0, top, 1, bot - top, '#7e8b9a');
          rect(g, px0 + pw - 1, top, 1, bot - top, '#1a1f25');
          rect(g, px0 - 1, top - a(0.5), pw + 2, a(0.6), '#1a1f25');          // the cap
          /* the pennant (flown only by a side holding the point) and the lamp's light
             move, so they are drawn over the table every frame (drawLive); the lamp's
             housing is baked, unlit */
          rect(g, px0 + pw / 2 - a(0.45), top - a(1.6), a(0.9), a(1.1), '#7a6438');
          break;
        }
      }
    }

    // '#rrggbb' as 'r,g,b', for a colour mixed with a changing alpha
    function rgbOf(hex) {
      var h = String(hex || '#70c858').replace('#', '');
      if (h.length === 3) h = h.replace(/(.)/g, '$1$1');
      return parseInt(h.slice(0, 2), 16) + ',' + parseInt(h.slice(2, 4), 16) + ',' + parseInt(h.slice(4, 6), 16);
    }
    /* The moving parts of a piece, drawn over the table every frame at the
       time t (ms): an objective beacon's pennant fluttering (in the colours of
       the side holding it: `pr.holder`, a palette, set by the board; none while it
       is nobody's or contested) and its lamp flashing slowly. */
    function drawLive(g, lift, p, pr, t) {
      if (pr.kind === 'objective') {
        // the uplink's warning lamps: a slow beat, on for about a second in three
        var mc = toScreen(pr.x + pr.w / 2, pr.y + pr.h / 2), mx = mc.x, my = mc.y - (lift || 0) - pr.height, MH = a(36);
        var beat = Math.max(0, Math.sin((t / 3000) * Math.PI * 2));
        if (beat <= 0.02) return;
        g.save();
        g.globalAlpha = beat;
        ellipse(g, mx, my - MH - a(6), a(2.6), a(1.9), 'rgba(255,60,40,.3)');
        dot(g, mx - 1, my - MH - a(6) - 1, '#ff4a32', 3);
        ellipse(g, mx, my - MH * 0.5, a(1.4), a(1), 'rgba(255,60,40,.25)');
        dot(g, mx - 1, my - MH * 0.5, '#ff4a32', 2);
        g.restore();
        return;
      }
      if (pr.kind === 'beacon' && pr.lz) {
        /* Smoke off the canister: puffs born at its mouth, rising, swelling
           and leaning off downwind as they thin out. Each puff is set by the time
           alone, so the plume needs nothing kept between frames. */
        var N = 22, LIFE = 4600, cx = p.x, cy = p.y - a(2.4), off = (pr.index || 0) * 0.29;
        // in the attacker's colours (`pr.holder`, set by the board), green until it is known
        var pal = pr.holder, rgbA = pal ? rgbOf(pal.ink) : '112,200,88', rgbB = pal ? rgbOf(pal.mid) : '86,166,70', rgbC = pal ? rgbOf(pal.light) : '190,245,150';
        g.save();
        for (var i = N - 1; i >= 0; i--) {
          var age = ((t / LIFE) + i / N + off) % 1;
          // each puff on a slightly different line, so the plume is ragged
          var lean = 0.75 + ((i * 37) % 11) / 22;
          var sx2 = cx + age * age * a(12) * lean + Math.sin(age * 6 + i * 1.7) * a(1.4) * age;
          var sy2 = cy - age * a(26) - Math.cos(i * 2.3) * a(1.2) * age;
          var r = a(1.6) + age * a(6.5);
          var al = (age < 0.08 ? age / 0.08 : 1) * (1 - age * 0.85) * 0.62;
          // soft-edged: a puff is dense in the middle and fades out to nothing
          var rg = g.createRadialGradient(sx2, sy2, 0, sx2, sy2, r);
          var c = i % 3 ? rgbA : rgbB;
          rg.addColorStop(0, 'rgba(' + c + ',' + al.toFixed(3) + ')');
          rg.addColorStop(0.6, 'rgba(' + c + ',' + (al * 0.55).toFixed(3) + ')');
          rg.addColorStop(1, 'rgba(' + c + ',0)');
          g.fillStyle = rg;
          g.beginPath(); g.ellipse(sx2, sy2, r, r * 0.85, 0, 0, Math.PI * 2); g.fill();
        }
        // the hot core at the canister's mouth
        var core = g.createRadialGradient(cx, cy - a(0.6), 0, cx, cy - a(0.6), a(1.6));
        core.addColorStop(0, 'rgba(' + rgbC + ',.55)');
        core.addColorStop(1, 'rgba(' + rgbC + ',0)');
        g.fillStyle = core;
        g.beginPath(); g.arc(cx, cy - a(0.6), a(1.6), 0, Math.PI * 2); g.fill();
        g.restore();
        return;
      }
      if (pr.kind === 'beacon') {
        var bq = rng(7 + (pr.index || 0) * 31), wob = bq() * 6, pal = pr.holder;
        var px0 = p.x - a(0.7), pw = a(1.4), top = p.y - a(1.1) - a(14);
        if (pal) {
        // the pennant: a ripple running out to the fly, the fly moving most
        var fx = px0 + pw, fy = top + a(0.4), FL = a(6.2), FH = a(3.2);
        var ph = t / 850 * Math.PI * 2 + wob, upper = [], lower = [];
        for (var k = 0; k <= 8; k++) {
          var f = k / 8, wave = Math.sin(f * Math.PI * 1.8 - ph) * a(0.75) * f;
          var hh = FH * (1 - f * 0.45) * (1 - 0.08 * Math.cos(f * Math.PI * 1.8 - ph) * f);
          upper.push([fx + FL * f * (1 - 0.04 * Math.abs(Math.sin(ph * 0.5)) * f), fy + wave]);
          lower.push([upper[k][0], fy + hh + wave]);
        }
        poly(g, upper.concat(lower.slice().reverse()), pal.mid);
        poly(g, upper.concat(lower.map(function (q, i) { return [q[0], q[1] - (q[1] - upper[i][1]) * 0.5]; }).reverse()), pal.ink || pal.light);
        for (var k2 = 1; k2 < 8; k2++) {
          // a fold turning away from the light is shaded, one turning to it lit
          var turn = Math.cos(k2 / 8 * Math.PI * 1.8 - ph);
          if (Math.abs(turn) < 0.45) continue;
          edgeLine(g, [upper[k2][0], upper[k2][1] + 1], [lower[k2][0], lower[k2][1] - 1], turn < 0 ? 'rgba(0,0,0,.28)' : 'rgba(255,255,255,.22)', 1);
        }
        for (var k3 = 0; k3 < 8; k3++) edgeLine(g, upper[k3], upper[k3 + 1], pal.light || pal.ink, 1);
        edgeLine(g, [fx, fy], [fx, fy + FH], pal.dark, 1);
        }
        // the lamp: a slow beat, swelling and fading every two and a half seconds
        var lit = 0.5 + 0.5 * Math.sin((t / 2500 + (pr.index || 0) * 0.37) * Math.PI * 2);
        var lx = px0 + pw / 2;
        g.save();
        g.globalAlpha = lit;
        ellipse(g, lx, top - a(1.4), a(2.6), a(1.9), 'rgba(255,214,120,.3)');
        rect(g, lx - a(0.45), top - a(1.6), a(0.9), a(1.1), '#ffd878');
        dot(g, lx - a(0.25), top - a(1.5), '#fff4c8', 1);
        g.restore();
        return;
      }
    }
    // the pieces with moving parts
    function lives(pr) { return pr.kind === 'beacon' || pr.kind === 'objective'; }

    return { drawKind: drawKind, drawLive: drawLive, lives: lives };
  };
})(window);
