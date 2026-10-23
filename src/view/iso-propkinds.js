/* PMC 2670 — Firefight : each kind of scenery piece: trees, rocks, buildings, walls, sandbags, wire, craters and the rest

   Made by iso-props.js once, with the palettes and pieces it shares (S).
   drawKind paints a piece of scenery by its kind, at the screen point p,
   lifted onto a hill by lift, cut away where the camera looks through it. */
(function (root) {
  'use strict';
  root.PMCIsoPropKinds = function (S) {
    var BAG = S.BAG, BARK = S.BARK, BASALTS = S.BASALTS, BRICK = S.BRICK, CHAR = S.CHAR,
        CONCRETE = S.CONCRETE, K = S.K, LEAF = S.LEAF, PIXEL = S.PIXEL, PREFAB = S.PREFAB, ROOF = S.ROOF,
        STONE = S.STONE, WALL_THEME = S.WALL_THEME, a = S.a, boulder = S.boulder, box = S.box, brokenWall = S.brokenWall,
        conifer = S.conifer, dot = S.dot, edgeLine = S.edgeLine, ellipse = S.ellipse, lerp2 = S.lerp2,
        pebble = S.pebble, poly = S.poly, rect = S.rect, rng = S.rng, shadowBlob = S.shadowBlob,
        toScreen = S.toScreen, vgrad = S.vgrad;

    // a compound's plating, and its doors (Close Encounters)
    var BULK = ['#1d2124', '#2a2f33', '#3a4146', '#4a535a', '#5c666e', '#76818a'];
    var DOOR_RED = ['#2a1412', '#4a1d18', '#7a2a22', '#9c352a', '#b8473a', '#d0675a'];
    var DOOR_AMBER = ['#2a1e10', '#4a3418', '#7a5222', '#a06a2a', '#c08636', '#d9a456'];
    var CRATE = ['#22231c', '#3a3a2a', '#545338', '#6b6946', '#848155', '#9c9a6c'];
    var CRATE2 = ['#1f2326', '#33393e', '#4a535a', '#5f6a72', '#76828b', '#8f9ba3'];
    var MACH = ['#1a1e22', '#2a3036', '#3d454c', '#50595f', '#636d74', '#86919a'];
    var SHIELD = ['#1f2428', '#2e353b', '#46515a', '#5d6a74', '#73808a', '#94a1ab'];
    var DOOR_STEEL = ['#23282c', '#323a40', '#465058', '#58636c', '#6b7781', '#8a96a0'];
    // a market: the stalls' steel, their canopies (sheet, neon, holo-sign), and what is for sale
    var KIOSK = ['#181c20', '#262c32', '#363e46', '#48525c', '#5c6872', '#7a8792'];
    var CANOPY = [['#1f5866', '#6fe8ff', 'rgba(111,232,255,.28)'], ['#5e2a56', '#ff7ad8', 'rgba(255,122,216,.28)'], ['#6a5218', '#ffcf5a', 'rgba(255,207,90,.28)'],
      ['#24503a', '#7affb0', 'rgba(122,255,176,.28)'], ['#2e3470', '#9aa8ff', 'rgba(154,168,255,.28)']];
    var WARES = ['#6fe8ff', '#ffcf5a', '#7affb0', '#d8dee4', '#ff7ad8', '#8a96a0'];
    // a boulevard: the railings' steel, the planters' cast stone and the trees in them
    var RAIL = ['#1e2328', '#3a434b', '#7d8a95', '#a9b6c0', '#dbe4ea'];
    var PLANTER = ['#2a2c2c', '#3c3f3f', '#545858', '#6a6f6f', '#7f8484', '#989d9c'];
    var SHRUB = ['#1f3a1c', '#2e5a2a', '#4a7e3a', '#6a9e4a'];
    // a spaceport: a shuttle's hull, a fuel bowser's tank and cab, a cargo lifter's paint
    var HULL = ['#1e2226', '#2e343a', '#454d55', '#5e6871', '#7a858f', '#9aa6b0'];
    var TANK = ['#4a4636', '#6a6450', '#9a9478', '#bcb698', '#d8d2b2', '#ece6c8'];
    var CAB = ['#3a2e0c', '#6a5418', '#a8842a', '#c89c32', '#e0b440', '#f0cc60'];
    var LIFT = ['#3a240c', '#6a4214', '#a8661e', '#d08428', '#e8a038', '#f4bc58'];
    // a glass tower: tinted curtain wall, its mullions, and the light in it
    var GLASS = ['#0c1820', '#13283a', '#1a3a54', '#21506e', '#2b6a8a', '#3c86a8'];
    /* A glass tower (a map's landmark, style 'glass'): a tinted curtain wall
       ruled into panes by bright mullions and floor by floor, a sheen of sky
       slanting across it, lit offices here and there, and a narrower crown on
       top with a lit band and a mast. Cut away, it is a building like any other. */
    function glassTower(g, pr, lift, cutaway) {
      if (cutaway) { box(g, pr, GLASS, { roof: GLASS[1], roofEdge: GLASS[5], windows: null, lift: lift, cutaway: true }); return; }
      var gr = rng(pr.seed || 11), body = Math.round(pr.height * 0.82);
      function pt(x, y, up) { var q = toScreen(x, y); return [q.x, q.y - lift - (up || 0)]; }
      function curtain(q, h, base) {
        box(g, { x: q.x, y: q.y, w: q.w, h: q.h, height: h, seed: q.seed }, GLASS, { roof: '#18232c', roofEdge: '#7fd8f0', windows: null, lift: lift + (base || 0), noShadow: !!base });
        var faces = [[[q.x + q.w, q.y], [q.x + q.w, q.y + q.h]], [[q.x, q.y + q.h], [q.x + q.w, q.y + q.h]]];
        faces.forEach(function (F, fi) {
          var len = Math.hypot(F[1][0] - F[0][0], F[1][1] - F[0][1]), cols = Math.max(2, Math.round(len / 0.8)), floors = Math.max(3, Math.round(h / a(2.2)));
          // the glass, lit floor by floor: an office's lights on in some of the panes
          for (var fl = 0; fl < floors; fl++) {
            for (var c = 0; c < cols; c++) {
              if (gr() > 0.16) continue;
              var u0 = c / cols, u1 = (c + 1) / cols, z0 = base + h * fl / floors + 2, z1 = base + h * (fl + 1) / floors - 2;
              var A = lerp2(F[0], F[1], u0), B2 = lerp2(F[0], F[1], u1);
              poly(g, [pt(A[0], A[1], z0), pt(B2[0], B2[1], z0), pt(B2[0], B2[1], z1), pt(A[0], A[1], z1)], gr() > 0.4 ? 'rgba(255,214,140,.55)' : 'rgba(150,230,255,.45)');
            }
          }
          // the sky's sheen, one slanting band across the face
          for (var sb = 0; sb < 1; sb++) {
            var s0 = 0.2 + gr() * 0.3, sw = 0.16, zz0 = base + h * 0.05, zz1 = base + h * 0.95;
            var P0 = lerp2(F[0], F[1], s0), P1 = lerp2(F[0], F[1], Math.min(1, s0 + sw)), P2 = lerp2(F[0], F[1], Math.min(1, s0 + sw + 0.18)), P3 = lerp2(F[0], F[1], Math.min(1, s0 + 0.18));
            poly(g, [pt(P0[0], P0[1], zz0), pt(P1[0], P1[1], zz0), pt(P2[0], P2[1], zz1), pt(P3[0], P3[1], zz1)], fi ? 'rgba(200,240,255,.07)' : 'rgba(200,240,255,.12)');
          }
          // mullions up the face and a spandrel at every floor
          for (var m = 1; m < cols; m++) { var M = lerp2(F[0], F[1], m / cols); edgeLine(g, pt(M[0], M[1], base + 1), pt(M[0], M[1], base + h - 1), 'rgba(160,215,235,.35)', 1); }
          for (var f2 = 1; f2 < floors; f2++) edgeLine(g, pt(F[0][0], F[0][1], base + h * f2 / floors), pt(F[1][0], F[1][1], base + h * f2 / floors), 'rgba(10,20,28,.55)', 1);
        });
        // the corner nearest the viewer, catching the light all the way up
        edgeLine(g, pt(q.x + q.w, q.y + q.h, base), pt(q.x + q.w, q.y + q.h, base + h), '#a8eaff', 1);
      }
      curtain(pr, body, 0);
      // a lit band where the crown begins
      var cA = pt(pr.x + pr.w, pr.y, body), cB = pt(pr.x + pr.w, pr.y + pr.h, body), cC = pt(pr.x, pr.y + pr.h, body);
      edgeLine(g, cA, cB, '#6fe8ff', 2); edgeLine(g, cC, cB, '#6fe8ff', 2);
      // the crown: set back from the edge, a storey and a half taller
      var inset = Math.min(pr.w, pr.h) * 0.22;
      var crown = { x: pr.x + inset, y: pr.y + inset, w: pr.w - inset * 2, h: pr.h - inset * 2, seed: (pr.seed || 11) + 3 };
      curtain(crown, pr.height - body, body);
      // the mast on the crown, a warning light at its tip
      var mb = pt(crown.x + crown.w / 2, crown.y + crown.h / 2, pr.height), mh = a(9);
      edgeLine(g, mb, [mb[0], mb[1] - mh], '#8a96a0', 2);
      edgeLine(g, [mb[0] - a(0.6), mb[1] - mh * 0.45], [mb[0] + a(0.6), mb[1] - mh * 0.45], '#8a96a0', 1);
      dot(g, mb[0], mb[1] - mh - 1, '#ff4a3a', 3);
    }
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
        /* Fuel drums: a cluster of steel barrels, hazard-banded, in a compound's
           dangerous section (Close Encounters). */
        // a control console: a steel desk with a lit screen and a row of lamps
        case 'console': {
          var cl7 = lift || 0, cw7 = a(1.6), ch7 = a(1.4);
          shadowBlob(g, { x: p.x + a(0.5), y: p.y - cl7 + a(0.3) }, a(1.8), a(0.8));
          rect(g, p.x - cw7 / 2, p.y - cl7 - ch7, cw7, ch7, '#3a4148');
          rect(g, p.x - cw7 / 2, p.y - cl7 - ch7, cw7, Math.max(1, a(0.25)), '#5c666e');
          rect(g, p.x - cw7 * 0.38, p.y - cl7 - ch7 * 0.82, cw7 * 0.76, ch7 * 0.42, '#1a3a28');
          rect(g, p.x - cw7 * 0.3, p.y - cl7 - ch7 * 0.74, cw7 * 0.6, ch7 * 0.26, '#4fd08a');
          dot(g, p.x - cw7 * 0.3, p.y - cl7 - ch7 * 0.2, '#ff5a3a', 2);
          dot(g, p.x, p.y - cl7 - ch7 * 0.2, '#ffb02e', 2);
          dot(g, p.x + cw7 * 0.3, p.y - cl7 - ch7 * 0.2, '#7bdc6a', 2);
          break;
        }
        /* A market stall (a settlement's barricade, iso-props.js): a steel
           kiosk counter laid with glowing wares, two masts at the back holding a
           canopy of tinted panels that slopes down towards the viewer, a neon
           strip along its front edge and a holo-sign over the back. */
        case 'stall': {
          var str = rng(pr.seed), slf = lift || 0, hz = pr.horiz, sl0 = (pr.len || 1.6) - 0.15, dp = 0.75;
          var tx0 = hz ? pr.x - sl0 / 2 : pr.x - dp / 2, ty0 = hz ? pr.y - dp / 2 : pr.y - sl0 / 2, tw = hz ? sl0 : dp, th = hz ? dp : sl0;
          var tH = a(1.4), pH = a(4.4), cn = CANOPY[Math.floor((pr.tone || 0) * CANOPY.length) % CANOPY.length];
          box(g, { x: tx0, y: ty0, w: tw, h: th, height: tH, seed: pr.seed }, KIOSK, { roof: KIOSK[4], roofEdge: KIOSK[5], windows: null, lift: slf });
          function sp(x, y, up) { var q = toScreen(x, y); return [q.x, q.y - slf - up]; }
          // a lit strip along the counter's front face
          edgeLine(g, sp(hz ? tx0 : tx0 + tw, ty0 + th, tH * 0.55), sp(tx0 + tw, ty0 + th, tH * 0.55), cn[1], 1);
          // the wares on the counter: cases and cells, some of them glowing
          for (var wi = 0; wi < 6; wi++) {
            var wq = sp(tx0 + 0.1 + str() * (tw - 0.2), ty0 + 0.1 + str() * (th - 0.2), tH + a(0.2));
            dot(g, wq[0], wq[1], WARES[Math.floor(str() * WARES.length)], 2);
          }
          // the masts at the back corners (the back being the side away from the viewer)
          var ax0 = tx0 - 0.08, ay0 = ty0 - 0.08, ax1 = tx0 + tw + 0.08, ay1 = ty0 + th + 0.08;
          var backs = hz ? [[ax0, ay0], [ax1, ay0]] : [[ax0, ay0], [ax0, ay1]];
          backs.forEach(function (c) { edgeLine(g, sp(c[0], c[1], 0), sp(c[0], c[1], pH + a(0.6)), KIOSK[1], 2); edgeLine(g, sp(c[0], c[1], tH), sp(c[0], c[1], pH + a(0.6)), KIOSK[3], 1); });
          // the canopy: one tinted sheet, high at the back and lower at the front, ribbed into panels
          var cA = sp(ax0, ay0, pH + a(0.6)), cB = hz ? sp(ax1, ay0, pH + a(0.6)) : sp(ax0, ay1, pH + a(0.6));
          var cC = sp(ax1, ay1, pH - a(0.2)), cD = hz ? sp(ax0, ay1, pH - a(0.2)) : sp(ax1, ay0, pH - a(0.2));
          poly(g, [cA, cB, cC, cD], cn[0]);
          var nrib = 4;
          for (var ri = 1; ri < nrib; ri++) {
            var f = ri / nrib;
            edgeLine(g, [cA[0] + (cB[0] - cA[0]) * f, cA[1] + (cB[1] - cA[1]) * f], [cD[0] + (cC[0] - cD[0]) * f, cD[1] + (cC[1] - cD[1]) * f], 'rgba(10,14,18,.45)', 1);
          }
          // the back edge catches the light; the front edge is the neon strip
          edgeLine(g, cA, cB, 'rgba(255,255,255,.25)', 1);
          edgeLine(g, cD, cC, cn[1], 2);
          // the holo-sign over the back of the canopy, see-through, its letters a flicker of light
          var hm = [(cA[0] + cB[0]) / 2, (cA[1] + cB[1]) / 2], hw = a(0.9), hh = a(0.55);
          rect(g, hm[0] - hw, hm[1] - hh * 2.2, hw * 2, hh, cn[2]);
          edgeLine(g, [hm[0] - hw, hm[1] - hh * 2.2], [hm[0] + hw, hm[1] - hh * 2.2], cn[1], 1);
          for (var li = 0; li < 3; li++) dot(g, hm[0] - hw * 0.6 + li * hw * 0.6, hm[1] - hh * 1.7, cn[1], 1);
          break;
        }
        /* A stretch of boulevard (a settlement's barricade, iso-props.js): steel
           posts and two rails with a glass panel between them, a planter with a
           young tree in it every other length, and a street lamp at its head. */
        case 'railing': {
          var rr = rng(pr.seed), rl = lift || 0, rhz = pr.horiz, half = (pr.len || 1.25) / 2;
          function rp(x, y, up) { var q = toScreen(x, y); return [q.x, q.y - rl - (up || 0)]; }
          var RA = rhz ? [pr.x - half, pr.y] : [pr.x, pr.y - half], RB = rhz ? [pr.x + half, pr.y] : [pr.x, pr.y + half];
          if (pr.planter) {
            var pw2 = rhz ? pr.len * 0.8 : 0.7, ph2 = rhz ? 0.7 : pr.len * 0.8;
            box(g, { x: pr.x - pw2 / 2, y: pr.y - ph2 / 2, w: pw2, h: ph2, height: a(1.3), seed: pr.seed }, PLANTER, { roof: '#3a2c1e', roofEdge: PLANTER[5], windows: null, lift: rl });
            // a young tree: a slim trunk and a crown of leaves, a shade lighter where the light comes from
            var tb = rp(pr.x, pr.y, a(1.3)), th2 = a(3.4 + rr() * 1.2), cr = a(1.5 + rr() * 0.4);
            rect(g, tb[0] - 1, tb[1] - th2, 2, th2, BARK[1]);
            ellipse(g, tb[0], tb[1] - th2 - cr * 0.3, cr, cr * 0.85, SHRUB[1]);
            ellipse(g, tb[0] - cr * 0.25, tb[1] - th2 - cr * 0.55, cr * 0.65, cr * 0.55, SHRUB[2]);
            for (var lf = 0; lf < 5; lf++) dot(g, tb[0] + (rr() - 0.5) * cr * 1.4, tb[1] - th2 - cr * 0.3 + (rr() - 0.5) * cr, SHRUB[rr() > 0.5 ? 0 : 3], 1);
          } else {
            var rH = a(2.4), rM = a(1.2);
            // the glass between the rails, then the posts, then the rails over them
            poly(g, [rp(RA[0], RA[1], rM), rp(RB[0], RB[1], rM), rp(RB[0], RB[1], rH), rp(RA[0], RA[1], rH)], 'rgba(140,210,230,.22)');
            [RA, RB].forEach(function (c) { edgeLine(g, rp(c[0], c[1], 0), rp(c[0], c[1], rH), RAIL[1], 2); edgeLine(g, rp(c[0], c[1], 0), rp(c[0], c[1], rH), RAIL[3], 1); });
            edgeLine(g, rp(RA[0], RA[1], rM), rp(RB[0], RB[1], rM), RAIL[2], 1);
            edgeLine(g, rp(RA[0], RA[1], rH), rp(RB[0], RB[1], rH), RAIL[2], 2);
            edgeLine(g, rp(RA[0], RA[1], rH + 1), rp(RB[0], RB[1], rH + 1), RAIL[4], 1);
          }
          if (pr.lamp) {
            // the street lamp: a tall mast, an arm over the walk and a cold white light under it
            var lb = rp(RA[0], RA[1], 0), lh = a(7.5), arm = a(1.2);
            edgeLine(g, lb, [lb[0], lb[1] - lh], RAIL[0], 2);
            edgeLine(g, [lb[0] + 1, lb[1]], [lb[0] + 1, lb[1] - lh], RAIL[3], 1);
            edgeLine(g, [lb[0], lb[1] - lh], [lb[0] + arm, lb[1] - lh + a(0.3)], RAIL[2], 2);
            ellipse(g, lb[0] + arm, lb[1] - lh + a(0.6), a(0.9), a(0.5), 'rgba(190,240,255,.25)');
            rect(g, lb[0] + arm - a(0.35), lb[1] - lh + a(0.25), a(0.7), a(0.3), '#e8faff');
          }
          break;
        }
        /* A landing pad's markings: a hazard-striped border, a ring in the middle
           and the scorch of a hundred landings. */
        case 'padmark': {
          var pl = lift || 0, pm = rng(pr.seed);
          function PM(x, y) { var q = toScreen(x, y); return [q.x, q.y - pl]; }
          var cx = pr.x + pr.w / 2, cy = pr.y + pr.h / 2, rad = Math.min(pr.w, pr.h) * 0.36;
          var sc = PM(cx, cy);
          ellipse(g, sc[0], sc[1], a(rad * 1.1 * 1.4), a(rad * 1.1 * 0.7), 'rgba(16,14,12,.28)');
          var ring = [];
          for (var ri2 = 0; ri2 <= 40; ri2++) { var an = ri2 / 40 * Math.PI * 2; ring.push(PM(cx + Math.cos(an) * rad, cy + Math.sin(an) * rad)); }
          for (var rs = 0; rs < 40; rs++) edgeLine(g, ring[rs], ring[rs + 1], 'rgba(226,184,74,.75)', 2);
          // the border, inset a little, in hazard stripes
          var ins = 0.5, X0 = pr.x + ins, Y0 = pr.y + ins, X1 = pr.x + pr.w - ins, Y1 = pr.y + pr.h - ins;
          [[[X0, Y0], [X1, Y0]], [[X1, Y0], [X1, Y1]], [[X1, Y1], [X0, Y1]], [[X0, Y1], [X0, Y0]]].forEach(function (E2) {
            var len = Math.hypot(E2[1][0] - E2[0][0], E2[1][1] - E2[0][1]), n = Math.max(2, Math.round(len / 0.7));
            for (var k = 0; k < n; k++) {
              var t0 = k / n, t1 = (k + 1) / n;
              edgeLine(g, PM(E2[0][0] + (E2[1][0] - E2[0][0]) * t0, E2[0][1] + (E2[1][1] - E2[0][1]) * t0),
                PM(E2[0][0] + (E2[1][0] - E2[0][0]) * t1, E2[0][1] + (E2[1][1] - E2[0][1]) * t1), k % 2 ? 'rgba(20,18,16,.8)' : 'rgba(226,184,74,.85)', 3);
            }
          });
          // the slab joints
          for (var jx = 1; jx < 4; jx++) edgeLine(g, PM(pr.x + pr.w * jx / 4, pr.y + 0.1), PM(pr.x + pr.w * jx / 4, pr.y + pr.h - 0.1), 'rgba(30,32,34,.35)', 1);
          for (var jy = 1; jy < 4; jy++) edgeLine(g, PM(pr.x + 0.1, pr.y + pr.h * jy / 4), PM(pr.x + pr.w - 0.1, pr.y + pr.h * jy / 4), 'rgba(30,32,34,.35)', 1);
          for (var sp2 = 0; sp2 < pr.w * pr.h * 0.4; sp2++) { var sq3 = PM(pr.x + pm() * pr.w, pr.y + pm() * pr.h); dot(g, sq3[0], sq3[1], 'rgba(20,18,16,.35)', 2); }
          break;
        }
        /* A bowser's fuel hoses, run out across the apron to the shuttle: two
           heavy lines lying in loose curves, a coupling at the far end. */
        case 'hose': {
          var hl = lift || 0, hr = rng(pr.seed);
          function HP(x, y) { var q = toScreen(x, y); return [q.x, q.y - hl - 1]; }
          for (var hn = 0; hn < 2; hn++) {
            var off = (hn - 0.5) * 0.5, bend = 0.5 + hr() * 0.5, pts = [];
            var dx = pr.to.x - pr.x, dy = pr.to.y - pr.y, ln = Math.hypot(dx, dy) || 1, nx = -dy / ln, ny = dx / ln;
            for (var hk = 0; hk <= 12; hk++) {
              var t = hk / 12, sw = Math.sin(t * Math.PI) * bend + Math.sin(t * Math.PI * 3) * 0.15;
              pts.push(HP(pr.x + dx * t + nx * (sw + off), pr.y + dy * t + ny * (sw + off)));
            }
            for (var hs = 0; hs < 12; hs++) { edgeLine(g, pts[hs], pts[hs + 1], '#141414', 3); edgeLine(g, [pts[hs][0], pts[hs][1] - 1], [pts[hs + 1][0], pts[hs + 1][1] - 1], hn ? '#5a4a2a' : '#3e3e3a', 1); }
            dot(g, pts[12][0], pts[12][1], '#e0b440', 3);
          }
          break;
        }
        /* A shuttle, down on its pad: a lifting body on four legs, nose to the
           west, swept wings, a tall fin, two engines glowing in its tail, its
           ramp down under them, and its owner's gold stripe down the side. */
        case 'shuttle': {
          var sl = lift || 0, x0 = pr.x, w = pr.w, yc = pr.y + pr.h / 2, hb = a(6), ht = a(22), wz = a(10);
          function SP(x, y, z) { var q = toScreen(x, y); return [q.x, q.y - sl - z]; }
          var sm = SP(x0 + w / 2, yc, 0);
          shadowBlob(g, { x: sm[0] + a(3), y: sm[1] + a(1.5) }, a(w * 4.2), a(pr.h * 2));
          // the legs, each on a foot
          [[x0 + 2.8, yc - 1.1], [x0 + 2.8, yc + 1.1], [x0 + 8.2, yc - 1.1], [x0 + 8.2, yc + 1.1]].forEach(function (L) {
            var f = SP(L[0], L[1], 0); ellipse(g, f[0], f[1], a(1.6), a(0.8), '#1a1d20');
            edgeLine(g, f, SP(L[0], L[1], hb + 2), HULL[1], 4); edgeLine(g, f, SP(L[0], L[1], hb + 2), HULL[3], 1);
          });
          // the far wing, under everything
          var FW = [SP(x0 + 3.6, yc - 1.2, wz), SP(x0 + 7.2, pr.y + 0.3, wz + a(1)), SP(x0 + 9.0, pr.y + 0.3, wz + a(1)), SP(x0 + 9.4, yc - 1.2, wz)];
          poly(g, FW, HULL[2]);
          // the ramp, down from the tail, lit inside
          poly(g, [SP(x0 + 9.5, yc - 0.8, hb + a(2)), SP(x0 + 9.5, yc + 0.8, hb + a(2)), SP(x0 + w, yc + 0.8, 0), SP(x0 + w, yc - 0.8, 0)], HULL[3]);
          poly(g, [SP(x0 + 9.5, yc - 0.6, hb + a(2)), SP(x0 + 9.5, yc + 0.6, hb + a(2)), SP(x0 + 9.5, yc + 0.6, hb + a(7)), SP(x0 + 9.5, yc - 0.6, hb + a(7))], 'rgba(255,214,140,.55)');
          edgeLine(g, SP(x0 + w, yc - 0.8, 0), SP(x0 + w, yc + 0.8, 0), HULL[5], 1);
          // the fuselage, its spine catching the light, and its nose
          box(g, { x: x0 + 2.2, y: yc - 1.2, w: 7.4, h: 2.4, height: ht - hb, seed: pr.seed }, HULL, { roof: HULL[4], roofEdge: HULL[5], windows: null, lift: sl + hb, noShadow: true });
          edgeLine(g, SP(x0 + 2.2, yc, ht + 1), SP(x0 + 9.6, yc, ht + 1), HULL[5], 2);
          poly(g, [SP(x0 + 2.2, yc + 1.2, hb), SP(x0 + 2.2, yc + 1.2, ht), SP(x0 + 0.1, yc, hb + a(9)), SP(x0 + 0.1, yc, hb + a(4))], HULL[3]);
          poly(g, [SP(x0 + 2.2, yc - 1.2, ht), SP(x0 + 2.2, yc + 1.2, ht), SP(x0 + 0.1, yc, hb + a(9))], HULL[5]);
          // the cockpit's glass, wrapped round the top of the nose
          poly(g, [SP(x0 + 0.9, yc - 0.45, hb + a(10)), SP(x0 + 0.9, yc + 0.45, hb + a(10)), SP(x0 + 2.3, yc + 1.05, ht - a(1)), SP(x0 + 2.3, yc - 1.05, ht - a(1))], '#16303e');
          edgeLine(g, SP(x0 + 1.1, yc + 0.35, hb + a(10.6)), SP(x0 + 2.2, yc + 0.9, ht - a(1.4)), 'rgba(170,230,255,.7)', 1);
          // the gold stripe of the company that owns it, and a row of ports
          edgeLine(g, SP(x0 + 2.2, yc + 1.2, hb + a(8)), SP(x0 + 9.6, yc + 1.2, hb + a(8)), '#c9a65a', 4);
          for (var pw = 0; pw < 6; pw++) { var pq = SP(x0 + 3 + pw * 1.0, yc + 1.2, hb + a(12)); rect(g, pq[0] - 2, pq[1] - 2, 4, 3, '#9ad8f0'); }
          // the near wing: its leading edge lit, a gold chevron on it, its trailing edge in shadow
          var NW = [SP(x0 + 3.6, yc + 1.2, wz), SP(x0 + 7.2, pr.y + pr.h - 0.3, wz + a(1)), SP(x0 + 9.0, pr.y + pr.h - 0.3, wz + a(1)), SP(x0 + 9.4, yc + 1.2, wz)];
          poly(g, NW.map(function (q) { return [q[0], q[1] + a(1.5)]; }), HULL[0]);
          poly(g, NW, HULL[3]);
          edgeLine(g, NW[0], NW[1], HULL[5], 2);
          edgeLine(g, NW[2], NW[3], HULL[1], 2);
          poly(g, [SP(x0 + 6.3, yc + 2.2, wz + a(0.6)), SP(x0 + 7.4, yc + 2.2, wz + a(0.6)), SP(x0 + 8.0, yc + 3.0, wz + a(0.8)), SP(x0 + 6.9, yc + 3.0, wz + a(0.8))], '#c9a65a');
          dot(g, NW[1][0], NW[1][1], '#3aff7a', 4);                  // the starboard light
          // the fin, tall over the tail, and the engines glowing in the tail
          var F0 = SP(x0 + 6.8, yc, ht), F1 = SP(x0 + 9.6, yc, ht), F2 = SP(x0 + 9.9, yc, ht + a(16)), F3 = SP(x0 + 9.0, yc, ht + a(16));
          poly(g, [F0, F1, F2, F3], HULL[2]);
          edgeLine(g, F0, F3, HULL[5], 2);
          edgeLine(g, SP(x0 + 7.6, yc, ht + a(8)), SP(x0 + 9.7, yc, ht + a(8)), '#c9a65a', 3);
          dot(g, F2[0], F2[1], '#ff4a3a', 4);
          [-0.6, 0.6].forEach(function (o) {
            var e = SP(x0 + 9.6, yc + o, hb + a(9));
            ellipse(g, e[0], e[1], a(3.2), a(3.2), '#14171a');
            ellipse(g, e[0], e[1], a(2.4), a(2.4), 'rgba(255,150,70,.6)');
            ellipse(g, e[0], e[1], a(1.3), a(1.3), '#ffd28a');
          });
          break;
        }
        /* A fuel bowser: a long pale tank on a chassis, a yellow cab at its
           east end with a dark windscreen, red hazard bands, six wheels. */
        case 'fueltruck': {
          var tl = lift || 0, tx = pr.x, ty = pr.y, tw2 = pr.w, th3 = pr.h;
          function TP(x, y, z) { var q = toScreen(x, y); return [q.x, q.y - tl - z]; }
          var tm = TP(tx + tw2 / 2, ty + th3 / 2, 0);
          shadowBlob(g, { x: tm[0] + a(2), y: tm[1] + a(1) }, a(tw2 * 3.4), a(th3 * 2.4));
          box(g, { x: tx, y: ty + 0.25, w: tw2, h: th3 - 0.5, height: a(3), seed: pr.seed }, HULL, { roof: HULL[2], roofEdge: HULL[3], windows: null, lift: tl + a(1.5), noShadow: true });
          box(g, { x: tx + 0.15, y: ty + 0.3, w: tw2 - 1.6, h: th3 - 0.6, height: a(8), seed: pr.seed + 1 }, TANK, { roof: TANK[4], roofEdge: TANK[5], windows: null, lift: tl + a(4.5), noShadow: true });
          edgeLine(g, TP(tx + 0.15, ty + th3 - 0.3, a(8.5)), TP(tx + tw2 - 1.45, ty + th3 - 0.3, a(8.5)), '#b8402e', 4);
          edgeLine(g, TP(tx + 0.15, ty + th3 - 0.3, a(10)), TP(tx + tw2 - 1.45, ty + th3 - 0.3, a(10)), '#b8402e', 2);
          edgeLine(g, TP(tx + 0.3, ty + 0.9, a(12.6)), TP(tx + tw2 - 1.6, ty + 0.9, a(12.6)), 'rgba(255,255,255,.4)', 1);
          box(g, { x: tx + tw2 - 1.35, y: ty + 0.25, w: 1.3, h: th3 - 0.5, height: a(10), seed: pr.seed + 2 }, CAB, { roof: CAB[4], roofEdge: CAB[5], windows: null, lift: tl + a(1.5), noShadow: true });
          poly(g, [TP(tx + tw2 - 0.05, ty + 0.45, a(7)), TP(tx + tw2 - 0.05, ty + th3 - 0.45, a(7)), TP(tx + tw2 - 0.05, ty + th3 - 0.45, a(10.6)), TP(tx + tw2 - 0.05, ty + 0.45, a(10.6))], '#16303e');
          dot(g, TP(tx + tw2 - 0.7, ty + 0.9, a(11.6))[0], TP(tx + tw2 - 0.7, ty + 0.9, a(11.6))[1], '#ffb02e', 4);    // its beacon
          // the hose reel at the back, and the wheels
          var rl2 = TP(tx + tw2 - 1.7, ty + th3 - 0.2, a(6)); ellipse(g, rl2[0], rl2[1], a(1.6), a(1.6), '#141414'); ellipse(g, rl2[0], rl2[1], a(0.7), a(0.7), '#e0b440');
          [0.8, 1.9, tw2 - 0.7].forEach(function (wx) { var wq = TP(tx + wx, ty + th3 - 0.2, a(1.6)); ellipse(g, wq[0], wq[1], a(1.6), a(1.6), '#121314'); ellipse(g, wq[0], wq[1], a(0.6), a(0.6), '#5a5e62'); });
          break;
        }
        /* A cargo lifter: a squat orange loader, a roll cage over its seat, and a
           mast at its east end with a crate up on its forks. */
        case 'cargolifter': {
          var ll = lift || 0, lx = pr.x, ly = pr.y, lw = pr.w, lh2 = pr.h;
          function LP(x, y, z) { var q = toScreen(x, y); return [q.x, q.y - ll - z]; }
          var lm = LP(lx + lw / 2, ly + lh2 / 2, 0);
          shadowBlob(g, { x: lm[0] + a(1.5), y: lm[1] + a(0.8) }, a(lw * 3), a(lh2 * 1.6));
          box(g, { x: lx + 0.15, y: ly + 0.5, w: lw - 0.9, h: lh2 - 0.8, height: a(5), seed: pr.seed }, LIFT, { roof: LIFT[4], roofEdge: LIFT[5], windows: null, lift: ll + a(1.2), noShadow: true });
          // the roll cage over the seat
          var c0 = [[lx + 0.4, ly + 0.7], [lx + 1.3, ly + 0.7], [lx + 1.3, ly + lh2 - 0.5], [lx + 0.4, ly + lh2 - 0.5]];
          c0.forEach(function (c) { edgeLine(g, LP(c[0], c[1], a(6)), LP(c[0], c[1], a(12)), '#1e2226', 2); });
          poly(g, c0.map(function (c) { return LP(c[0], c[1], a(12)); }), HULL[2]);
          // the crate up on the forks, then the mast in front of it
          box(g, { x: lx + lw - 1.25, y: ly + 0.55, w: 0.95, h: lh2 - 1.0, height: a(5), seed: pr.seed + 3 }, CRATE2, { roof: CRATE2[3], roofEdge: CRATE2[4], windows: null, lift: ll + a(7), noShadow: true });
          [[lx + lw - 0.15, ly + 0.5], [lx + lw - 0.15, ly + lh2 - 0.4]].forEach(function (m) { edgeLine(g, LP(m[0], m[1], 0), LP(m[0], m[1], a(15)), '#2a2e32', 3); edgeLine(g, LP(m[0], m[1], 0), LP(m[0], m[1], a(15)), '#7a858f', 1); });
          edgeLine(g, LP(lx + lw - 0.15, ly + 0.5, a(15)), LP(lx + lw - 0.15, ly + lh2 - 0.4, a(15)), '#2a2e32', 3);
          [0.6, lw - 0.9].forEach(function (wx) { var wq = LP(lx + wx, ly + lh2 - 0.25, a(1.3)); ellipse(g, wq[0], wq[1], a(1.3), a(1.3), '#121314'); });
          dot(g, LP(lx + 0.85, ly + 1.2, a(12.6))[0], LP(lx + 0.85, ly + 1.2, a(12.6))[1], '#ffb02e', 4);   // the beacon on the cage
          break;
        }
        case 'sacks': {
          // grain sacks, heaped: round-shouldered bags, a tie at the neck
          var skr = rng(pr.seed), skl = lift || 0;
          shadowBlob(g, { x: p.x + a(0.5), y: p.y - skl + a(0.3) }, a(1.8), a(0.7));
          for (var ski = 0; ski < (pr.n || 2) + 1; ski++) {
            var sx = p.x + (ski - 1) * a(0.9) + (skr() - 0.5) * a(0.3), sy = p.y - skl + (skr() - 0.5) * a(0.5);
            ellipse(g, sx, sy - a(0.8), a(0.55), a(0.75), ski % 2 ? '#b8a07a' : '#a8906a');
            ellipse(g, sx - a(0.12), sy - a(1.0), a(0.25), a(0.35), '#d0bc94');
            rect(g, sx - a(0.15), sy - a(1.6), a(0.3), a(0.2), '#6a5236');
          }
          break;
        }
        case 'drums': {
          var dr6 = rng(pr.seed), dl6 = lift || 0;
          shadowBlob(g, { x: p.x + a(0.6), y: p.y - dl6 + a(0.3) }, a(2.2), a(0.9));
          for (var di = 0; di < (pr.n || 2); di++) {
            var ox = (di - ((pr.n || 2) - 1) / 2) * a(1.1) + (dr6() - 0.5) * a(0.4), oy = (dr6() - 0.5) * a(0.6);
            var cx6 = p.x + ox, cy6 = p.y - dl6 + oy, rw = a(0.5), hh6 = a(1.5);
            rect(g, cx6 - rw, cy6 - hh6, rw * 2, hh6, di % 2 ? '#8a3a1c' : '#9c4a20');
            rect(g, cx6 - rw, cy6 - hh6 * 0.62, rw * 2, Math.max(1, a(0.22)), '#d9b13a');
            rect(g, cx6 - rw, cy6 - hh6 * 0.32, rw * 2, Math.max(1, a(0.12)), '#2a1a12');
            ellipse(g, cx6, cy6 - hh6, rw, rw * 0.5, '#b8603a');
            ellipse(g, cx6, cy6 - hh6, rw * 0.6, rw * 0.3, '#5a2a14');
          }
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
        /* A room's crates and lockers: a few boxes of different heights along the
           wall, stencilled, one maybe a shade off the others. */
        case 'crates': {
          var cr = rng(pr.seed || 3), hz3 = pr.w >= pr.h, ln3 = hz3 ? pr.w : pr.h, nb = Math.max(1, Math.round(ln3 / 0.75)), bl = ln3 / nb;
          for (var cb = 0; cb < nb; cb++) {
            var cpal = cr() < 0.5 ? CRATE : CRATE2, ch = pr.height * (0.6 + cr() * 0.6);
            var cq = hz3 ? { x: pr.x + cb * bl + 0.04, y: pr.y + 0.04, w: bl - 0.08, h: pr.h - 0.08 } : { x: pr.x + 0.04, y: pr.y + cb * bl + 0.04, w: pr.w - 0.08, h: bl - 0.08 };
            box(g, { x: cq.x, y: cq.y, w: cq.w, h: cq.h, height: Math.round(ch), seed: pr.seed + cb }, cpal, { roof: cpal[3], roofEdge: cpal[4], windows: null, lift: lift || 0 });
          }
          break;
        }
        /* A bank of machinery: a tall plated cabinet with a lit display, vents and a
           run of pipe along its top. */
        case 'machinery': {
          box(g, pr, MACH, { roof: MACH[3], roofEdge: MACH[5], windows: null, lift: lift || 0, cutaway: !!cutaway });
          var ml = lift || 0, hz4 = pr.w >= pr.h;
          // the face towards the viewer: +y for one along x, +x for one along y
          function onM(t, up) {
            var q = hz4 ? toScreen(pr.x + pr.w * t, pr.y + pr.h) : toScreen(pr.x + pr.w, pr.y + pr.h * t);
            return [q.x, q.y - ml - up];
          }
          var mr = rng(pr.seed || 9);
          for (var mv = 0; mv < 3; mv++) {                 // vents
            var v0 = onM(0.12 + mv * 0.1, pr.height * 0.35), v1 = onM(0.18 + mv * 0.1, pr.height * 0.35);
            edgeLine(g, v0, v1, '#14181b', 2);
          }
          var d0 = onM(0.55, pr.height * 0.7), d1 = onM(0.85, pr.height * 0.7);      // the display
          edgeLine(g, d0, d1, mr() < 0.5 ? '#5fd0b4' : '#e2b84a', 3);
          var p0 = onM(0.05, pr.height + 2), p1 = onM(0.95, pr.height + 2);         // the pipe along the top
          edgeLine(g, p0, p1, '#6b7680', 2);
          break;
        }
        // the floor's small clutter (drawn only): a deck grate, a cable run, a small box, litter
        case 'deckgrate': {
          var gq = [[-0.45, -0.45], [0.45, -0.45], [0.45, 0.45], [-0.45, 0.45]].map(function (o) { var t = toScreen(pr.x + o[0], pr.y + o[1]); return [t.x, t.y - (lift || 0)]; });
          poly(g, gq, 'rgba(14,17,20,.55)');
          for (var gl = 1; gl < 5; gl++) edgeLine(g, lerp2(gq[0], gq[3], gl / 5), lerp2(gq[1], gq[2], gl / 5), 'rgba(110,120,128,.35)', 1);
          break;
        }
        case 'cable': {
          var cr2 = rng(pr.seed || 4), cpts = [], cx0 = pr.x - 0.9, cy0 = pr.y + (cr2() - 0.5) * 0.4;
          for (var cs = 0; cs <= 6; cs++) {
            var cw = pr.horiz ? toScreen(cx0 + cs * 0.3, cy0 + Math.sin(cs * 1.3 + cr2()) * 0.12) : toScreen(pr.x + Math.sin(cs * 1.3 + cr2()) * 0.12, pr.y - 0.9 + cs * 0.3);
            cpts.push([cw.x, cw.y - (lift || 0)]);
          }
          for (var cl = 1; cl < cpts.length; cl++) edgeLine(g, cpts[cl - 1], cpts[cl], pr.tone < 0.5 ? '#14171a' : '#3a2a18', 2);
          break;
        }
        case 'smallbox': {
          var sbp = pr.tone < 0.5 ? CRATE : CRATE2;
          box(g, { x: pr.x - 0.22, y: pr.y - 0.18, w: 0.44, h: 0.36, height: a(0.9), seed: pr.seed }, sbp, { roof: sbp[3], roofEdge: sbp[4], windows: null, lift: lift || 0 });
          break;
        }
        case 'litter': {
          var lr = rng(pr.seed || 5);
          for (var li = 0; li < 5; li++) {
            var lq = toScreen(pr.x + (lr() - 0.5) * 0.9, pr.y + (lr() - 0.5) * 0.9);
            dot(g, lq.x, lq.y - (lift || 0), lr() < 0.5 ? 'rgba(200,196,180,.55)' : 'rgba(30,32,30,.6)', 2);
          }
          break;
        }
        /* A portable ballistic shield: a steel plate on its feet, a vision slit
           near the top, a hazard band across its foot. */
        /* A plate of the hive's barrier (iso-props.js): a curved shell of
           carapace on edge, its back darker for its thickness, ribbed across,
           a sheen along its crown and a hooked spine at each end. */
        /* The hive's growth (a brood chamber): a heap of resin, glossy, ribbed
           with veins, heaped against a wall or spread on the floor; burnt, a
           black crust. */
        case 'hivegrowth': {
          var hr = rng(pr.seed || 5), HR = a(pr.rad * 4.2), HU = a(pr.up * 9), hlf = lift || 0, py = p.y - hlf;
          var hcol = pr.burnt ? ['#141110', '#211b18', '#2e2622', '#3a302a'] : pr.tone < 0.5 ? ['#2a1424', '#44203a', '#5e2e50', '#8a5476'] : ['#26201a', '#3e3426', '#584a32', '#82704a'];
          var hpts = [];
          for (var hk = 0; hk <= 12; hk++) {
            var ang = Math.PI + Math.PI * hk / 12, wob = 0.8 + hr() * 0.35;
            hpts.push([p.x + Math.cos(ang) * HR * wob, py + Math.sin(ang) * HU * wob]);
          }
          hpts.push([p.x + HR, py + a(0.6)]); hpts.push([p.x - HR, py + a(0.6)]);
          ellipse(g, p.x, py + a(0.3), HR * 1.15, HR * 0.45, hcol[0]);
          poly(g, hpts, hcol[1]);
          ellipse(g, p.x - HR * 0.15, py - HU * 0.45, HR * 0.55, Math.max(1, HU * 0.35), hcol[2]);
          // the veins over it, and a wet highlight
          for (var hv = 0; hv < 3; hv++) {
            var vx = p.x - HR * 0.7 + hr() * HR * 1.4;
            edgeLine(g, [vx, py], [vx + (hr() - 0.5) * HR * 0.6, py - HU * (0.4 + hr() * 0.5)], hcol[0], 1);
          }
          if (!pr.burnt) dot(g, p.x - HR * 0.25, py - HU * 0.6, hcol[3], 2);
          break;
        }
        /* A clutch of the hive's eggs: leathery ovals standing on end in a
           pool of resin, veined, faintly lit from inside; burnt, split and black. */
        case 'eggs': {
          var er = rng(pr.seed || 9), elf = lift || 0;
          ellipse(g, p.x, p.y - elf, a(3.4), a(1.6), pr.burnt ? '#120f0e' : '#2c1a28');
          for (var ek = 0; ek < pr.n; ek++) {
            var eang = ek / pr.n * Math.PI * 2 + er(), ed = ek === 0 ? 0 : a(1.2 + er() * 0.9);
            var ex = p.x + Math.cos(eang) * ed, ey = p.y - elf + Math.sin(eang) * ed * 0.5, EH = a(2.2 + er() * 0.8), EW = a(1.1 + er() * 0.3);
            if (pr.burnt) {
              ellipse(g, ex, ey - EH * 0.35, EW, EH * 0.45, '#1e1915');
              edgeLine(g, [ex - EW * 0.6, ey - EH * 0.7], [ex + EW * 0.5, ey - EH * 0.2], '#0c0a09', 1);
              continue;
            }
            ellipse(g, ex, ey - EH * 0.5, EW, EH * 0.55, pr.tone < 0.5 ? '#8a8a5a' : '#7a8a6a');
            ellipse(g, ex - EW * 0.25, ey - EH * 0.62, EW * 0.55, EH * 0.38, pr.tone < 0.5 ? '#b0ae78' : '#9eb08a');
            edgeLine(g, [ex - EW * 0.3, ey - EH * 0.15], [ex + EW * 0.1, ey - EH * 0.9], 'rgba(90,40,70,.6)', 1);
            dot(g, ex, ey - EH * 0.5, 'rgba(200,230,140,.45)', 2);
          }
          break;
        }
        case 'carapace': {
          var cr = rng(pr.seed || 11), chl = pr.len / 2, cH = pr.height, clf = lift || 0;
          var cux = pr.horiz ? 1 : 0, cuy = pr.horiz ? 0 : 1, cvx = 1 - cux, cvy = 1 - cuy, CT = 0.12;
          var ctn = pr.tone || 0;
          var shell = ctn < 0.33 ? ['#2a1f2c', '#46324a', '#6a4c6a', '#9a7a94'] : ctn < 0.66 ? ['#2c2418', '#4a3b24', '#6e5634', '#a8895a'] : ['#1f2622', '#334036', '#4c5e4c', '#82947a'];
          var cs = function (t, off, up) {
            var q = toScreen(pr.x + cux * (t * chl) + cvx * off, pr.y + cuy * (t * chl) + cvy * off);
            return [q.x, q.y - clf - up];
          };
          // its profile: a low arch, highest a little off the middle, as no two shells are alike
          var peak = (cr() - 0.5) * 0.4, N2 = 10;
          var upAt = function (t) { var k = 1 - Math.pow((t - peak) / (t < peak ? 1 + peak : 1 - peak), 2); return cH * Math.max(0, k) * 0.85 + cH * 0.15; };
          shadowBlob(g, { x: cs(0, 0.3, 0)[0], y: cs(0, 0.3, 0)[1] }, a(pr.len * 2.4), a(1));
          ['back', 'front'].forEach(function (side2) {
            var off = side2 === 'back' ? -CT : CT, pts2 = [];
            for (var i2 = 0; i2 <= N2; i2++) { var t2 = -1 + 2 * i2 / N2; pts2.push(cs(t2, off, upAt(t2))); }
            pts2.push(cs(1, off, 0)); pts2.push(cs(-1, off, 0));
            poly(g, pts2, side2 === 'back' ? shell[0] : shell[1]);
          });
          // the crown, joining back to front
          for (var i3 = 0; i3 < N2; i3++) {
            var ta = -1 + 2 * i3 / N2, tb = -1 + 2 * (i3 + 1) / N2;
            poly(g, [cs(ta, -CT, upAt(ta)), cs(tb, -CT, upAt(tb)), cs(tb, CT, upAt(tb)), cs(ta, CT, upAt(ta))], shell[2]);
          }
          // the ribs, curving down across the front
          for (var rb = 1; rb < 5; rb++) {
            var tr = -1 + 2 * rb / 5 + (cr() - 0.5) * 0.1;
            edgeLine(g, cs(tr, CT, upAt(tr) - a(0.3)), cs(tr * 1.08, CT, a(0.4)), shell[0], 1);
          }
          // the sheen along the crown, and a hooked spine at each end
          for (var i4 = 2; i4 < N2 - 2; i4++) {
            var tc = -1 + 2 * i4 / N2, td = -1 + 2 * (i4 + 1) / N2;
            edgeLine(g, cs(tc, CT * 0.4, upAt(tc)), cs(td, CT * 0.4, upAt(td)), shell[3], 1);
          }
          [-1, 1].forEach(function (end) {
            var base = cs(end * 0.92, 0, upAt(end * 0.92)), tip = [base[0] + end * a(0.9), base[1] - a(1.4)];
            poly(g, [[base[0] - a(0.35), base[1]], [base[0] + a(0.35), base[1]], tip], shell[0]);
          });
          break;
        }
        case 'shield': {
          var hl = pr.len / 2, th2 = 0.07;
          var sq = pr.horiz ? { x: pr.x - hl, y: pr.y - th2, w: pr.len, h: th2 * 2 } : { x: pr.x - th2, y: pr.y - hl, w: th2 * 2, h: pr.len };
          box(g, { x: sq.x, y: sq.y, w: sq.w, h: sq.h, height: pr.height, seed: pr.seed }, SHIELD, { roof: SHIELD[4], roofEdge: SHIELD[5], windows: null, lift: lift || 0, noShadow: true });
          // the slit and the band on the face towards the viewer (+x or +y side)
          function onFace(t, up) {
            var q = pr.horiz ? toScreen(pr.x - hl + pr.len * t, pr.y + th2) : toScreen(pr.x + th2, pr.y - hl + pr.len * t);
            return [q.x, q.y - (lift || 0) - up];
          }
          var s0 = onFace(0.3, pr.height * 0.78), s1 = onFace(0.7, pr.height * 0.78);
          edgeLine(g, s0, s1, '#0e1114', 2);
          var b0 = onFace(0.05, pr.height * 0.12), b1 = onFace(0.95, pr.height * 0.12);
          for (var bi = 0; bi < 4; bi++) {
            var c0 = lerp2(b0, b1, bi / 4), c1 = lerp2(b0, b1, (bi + 1) / 4);
            edgeLine(g, c0, c1, bi % 2 ? '#1b1a17' : '#c9a23c', 2);
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
        /* A compound's bulkhead: a block of steel plate, one of the many the solid
           is laid in, drawn so they read as one mass (box: solid). */
        case 'bulkhead': {
          box(g, pr, BULK, { roof: '#2b3034', roofEdge: '#59626a', windows: null, lift: lift || 0, cutaway: !!cutaway, solid: true });
          break;
        }
        /* A door: a blast hatch framed in the compound's own plating — two jambs
           and a lintel the height of the walls, the shutter down (a door blocks
           sight). Working, the shutter is banded in hazard stripes, its lamp green;
           locked, banded red (both sides) or amber (one), its lamp to match. */
        case 'door': {
          var dl = lift || 0, H = pr.height, hz = pr.horiz;
          // the opening: narrower than the doorway's whole run and lower than the wall, cut into it, so the wall goes on round it
          var len = hz ? pr.w : pr.h, jl = Math.max(0.5, (len - Math.min(1.7, len * 0.6)) / 2);
          // the wall's own thickness (a door's piece is a shade thicker than a wall)
          var WT = 0.4, cen = hz ? pr.y + pr.h / 2 : pr.x + pr.w / 2;
          // a piece of the doorway from u0 to u1 along it, `th` thick, set off the wall's line by `off`
          function part(u0, u1, th, off) {
            var a0 = cen - th / 2 + (off || 0);
            return hz ? { x: pr.x + u0, y: a0, w: u1 - u0, h: th } : { x: a0, y: pr.y + u0, w: th, h: u1 - u0 };
          }
          // plating like the walls': one mass with them, a lip only along the faces either side
          function wallPart(q, height, up) {
            // the face towards the viewer (+y, or +x) looks into section B: its room's colours
            var tb = pr.themeB == null ? -1 : pr.themeB, ta = pr.themeA == null ? -1 : pr.themeA;
            var o = { kind: 'door', x: q.x, y: q.y, w: q.w, h: q.h, height: height, seed: pr.seed,
              open: hz ? [['N', q.x, q.x + q.w, ta], ['S', q.x, q.x + q.w, tb]] : [['W', q.y, q.y + q.h, ta], ['E', q.y, q.y + q.h, tb]] };
            // the frame looks into a room on the side towards the viewer: all of it in that room's colours, the reveal of the opening too
            box(g, o, (tb >= 0 && WALL_THEME[tb]) || BULK, { roof: '#2b3034', roofEdge: '#59626a', windows: null, lift: dl + (up || 0), solid: true });
          }
          function slab(q, height, up, palQ) {
            var o = { kind: 'door', x: q.x, y: q.y, w: q.w, h: q.h, height: height, seed: pr.seed };
            box(g, o, palQ, { roof: palQ[3], roofEdge: palQ[4], windows: null, lift: dl + (up || 0), noShadow: !!up });
          }
          var lamp = pr.lock === 'door' ? '#7bdc6a' : pr.lock === 'doorlock' ? '#ff4a3a' : '#ffb02e';
          var band = pr.lock === 'doorlock' ? DOOR_RED : pr.lock === 'door' ? null : DOOR_AMBER;
          var lt = Math.max(2, Math.round(H * 0.3));
          // the hatch set back in the middle of the wall, the frame's depth showing from either side
          function hatch() {
            var hoff = 0;
            /* Shut, as a door is unless something is going through it (it blocks sight,
               p. 157): the shutter down over the doorway. Working, a band of hazard
               stripes across it; locked, a band of warning paint (red both sides, amber one). */
            var sq = part(jl, len - jl, 0.14, hoff);
            slab(sq, H - lt, 0, DOOR_STEEL);
            var bh2 = Math.max(2, Math.round(H * 0.16)), by2 = Math.round(H * 0.3);
            if (band) slab(part(jl, len - jl, 0.16, hoff), bh2, by2, band);
            else {
              // the stripes on the face towards the viewer (+y, or +x)
              var f0 = hz ? toScreen(sq.x, sq.y + sq.h) : toScreen(sq.x + sq.w, sq.y);
              var f1 = hz ? toScreen(sq.x + sq.w, sq.y + sq.h) : toScreen(sq.x + sq.w, sq.y + sq.h);
              var A0 = [f0.x, f0.y - dl - by2], A1 = [f1.x, f1.y - dl - by2];
              for (var i = 0; i < 8; i++) {
                var q0 = lerp2(A0, A1, i / 8), q1 = lerp2(A0, A1, (i + 1) / 8);
                poly(g, [[q0[0], q0[1] - bh2], [q1[0], q1[1] - bh2], [q1[0], q1[1]], [q0[0], q0[1]]], i % 2 ? '#1b1a17' : '#c9a23c');
              }
            }
            // the seam where its two leaves meet, down the middle
            var m0 = hz ? toScreen(sq.x + sq.w / 2, sq.y + sq.h) : toScreen(sq.x + sq.w, sq.y + sq.h / 2);
            edgeLine(g, [m0.x, m0.y - dl - 1], [m0.x, m0.y - dl - (H - lt) + 1], '#1a1e22', 1);
          }
          // the wall either side and over the doorway, all one with the walls it joins; the hatch in the opening between
          wallPart(part(0, jl, WT), H, 0);
          hatch();
          wallPart(part(jl, len - jl, WT), lt, H - lt);
          wallPart(part(len - jl, len, WT), H, 0);
          var dc = toScreen(pr.x + pr.w / 2, pr.y + pr.h / 2);
          dot(g, dc.x - 1, dc.y - dl - H - 2, lamp, 3);
          break;
        }
        /* A pump house (rules.js `pumphouse`): a prefab shed over a wellhead, a
           fat pipe out of its side to a valve wheel, a vent stack on the roof.
           Searched and empty, its roof is struck through in red; the one that
           holds the objective has its lamp lit and the company's tape on the door. */
        case 'parleyflag': {
          // the table: a top on four legs, two crates either side, and the pole with its flag
          var tlf = lift || 0, T0 = function (x, y, up) { var q = toScreen(x, y); return [q.x, q.y - tlf - up]; };
          shadowBlob(g, { x: p.x, y: p.y }, a(5), a(2.5));
          [[-0.5, -0.3], [0.5, -0.3], [-0.5, 0.3], [0.5, 0.3]].forEach(function (L) {
            var f0 = T0(pr.x + L[0], pr.y + L[1], 0); edgeLine(g, f0, [f0[0], f0[1] - a(3)], '#3a3630', 1);
          });
          poly(g, [T0(pr.x - 0.6, pr.y - 0.4, a(3)), T0(pr.x + 0.6, pr.y - 0.4, a(3)), T0(pr.x + 0.6, pr.y + 0.4, a(3)), T0(pr.x - 0.6, pr.y + 0.4, a(3))], '#7a6a52');
          [[-1.2, 0], [1.2, 0]].forEach(function (C2) {
            var c0 = T0(pr.x + C2[0], pr.y + C2[1], 0);
            rect(g, c0[0] - a(1), c0[1] - a(1.8), a(2), a(1.8), '#5a4a34');
            rect(g, c0[0] - a(1), c0[1] - a(1.8), a(2), a(0.4), '#6e5c42');
          });
          var pole = T0(pr.x - 0.7, pr.y - 0.5, 0);
          edgeLine(g, pole, [pole[0], pole[1] - a(16)], '#bdb6a8', 2);
          poly(g, [[pole[0], pole[1] - a(16)], [pole[0] + a(6), pole[1] - a(15)], [pole[0] + a(5.4), pole[1] - a(12.6)], [pole[0], pole[1] - a(12)]], '#f2efe6');
          edgeLine(g, [pole[0] + a(2.5), pole[1] - a(15.6)], [pole[0] + a(2.3), pole[1] - a(12.3)], '#cfcabd', 1);
          break;
        }
        /* A town square's fountain: a round stone basin of water with a broad
           rim, a column rising out of it and a figure on top, and water falling
           from a bowl half way up. Tall enough to block the view across the square. */
        case 'fountain': {
          var fl = lift || 0, fcx = pr.x + pr.w / 2, fcy = pr.y + pr.h / 2, fR = Math.min(pr.w, pr.h) / 2 - 0.55;
          function FQ(x, y, up) { var q = toScreen(x, y); return [q.x, q.y - fl - (up || 0)]; }
          function ring(rad, up) { var pts = []; for (var fi = 0; fi < 28; fi++) { var th = fi / 28 * Math.PI * 2; pts.push(FQ(fcx + Math.cos(th) * rad, fcy + Math.sin(th) * rad, up)); } return pts; }
          var rimH = a(2.2);
          /* a stone pillar at each corner of the fountain's square, capped, with a
             lamp on top: the three behind the basin drawn before it, the near one after */
          function pillar(px, py) {
            var pb = FQ(px, py), pw = a(1.1), ph = a(8.5);
            shadowBlob(g, { x: pb[0] + a(1), y: pb[1] + a(0.4) }, a(1.8), a(0.7));
            rect(g, pb[0] - pw, pb[1] - ph, pw * 2, ph, STONE[3]);
            rect(g, pb[0] - pw, pb[1] - ph, pw * 0.7, ph, STONE[4]);
            rect(g, pb[0] + pw * 0.5, pb[1] - ph, pw * 0.5, ph, STONE[2]);
            rect(g, pb[0] - pw * 1.4, pb[1] - ph - a(0.8), pw * 2.8, a(0.8), STONE[4]);
            ellipse(g, pb[0], pb[1] - ph - a(1.8), a(0.9), a(0.9), '#ffd27a');
            ellipse(g, pb[0], pb[1] - ph - a(1.8), a(2.2), a(1.4), 'rgba(255,210,122,.18)');
          }
          var pin = 0.35;
          pillar(pr.x + pin, pr.y + pin); pillar(pr.x + pr.w - pin, pr.y + pin); pillar(pr.x + pin, pr.y + pr.h - pin);
          shadowBlob(g, { x: FQ(fcx, fcy)[0] + a(2), y: FQ(fcx, fcy)[1] + a(1) }, a(fR * 6.2), a(fR * 3.1));
          // the basin's outer wall, then its rim, then the water inside
          var outer = ring(fR, 0), top = ring(fR, rimH);
          for (var fw = 0; fw < 28; fw++) {
            var n2 = (fw + 1) % 28;
            poly(g, [outer[fw], outer[n2], top[n2], top[fw]], fw > 3 && fw < 17 ? STONE[2] : STONE[3]);
          }
          poly(g, top, STONE[4]);
          poly(g, ring(fR - 0.35, rimH), '#2c5a6a');
          poly(g, ring(fR - 0.55, rimH), '#3a7486');
          var fr2 = rng(pr.seed || 3);
          for (var fd = 0; fd < 10; fd++) { var fa = fr2() * Math.PI * 2, fdr = fr2() * (fR - 0.7); var fq = FQ(fcx + Math.cos(fa) * fdr, fcy + Math.sin(fa) * fdr, rimH); dot(g, fq[0], fq[1], '#8ac8d8', 1); }
          // the column, the bowl half way up with water falling from it, and the figure on top
          var cb = FQ(fcx, fcy, rimH), colH = pr.height - a(6), cw2 = a(2.2);
          // a stepped plinth, then the column
          rect(g, cb[0] - a(3.4), cb[1] - a(2.4), a(6.8), a(2.4), STONE[3]); rect(g, cb[0] - a(3.4), cb[1] - a(2.4), a(2.2), a(2.4), STONE[4]);
          rect(g, cb[0] - cw2, cb[1] - colH, cw2 * 2, colH, STONE[3]);
          rect(g, cb[0] - cw2, cb[1] - colH, cw2 * 0.7, colH, STONE[4]);
          rect(g, cb[0] + cw2 * 0.6, cb[1] - colH, cw2 * 0.4, colH, STONE[2]);
          var bowlY = cb[1] - colH * 0.45;
          ellipse(g, cb[0], bowlY, a(3.4), a(1.2), STONE[4]);
          ellipse(g, cb[0], bowlY - a(0.3), a(2.8), a(0.9), '#3a7486');
          for (var fs = -2; fs <= 2; fs++) edgeLine(g, [cb[0] + fs * a(1.3), bowlY + a(0.6)], [cb[0] + fs * a(1.7), cb[1] - a(0.4)], 'rgba(150,210,225,.55)', 1);
          // the figure: a cloaked statue with an arm raised, weathered green
          var sy = cb[1] - colH;
          rect(g, cb[0] - a(2.6), sy - a(0.8), a(5.2), a(0.8), STONE[4]);
          rect(g, cb[0] - a(1.7), sy - a(6.4), a(3.4), a(5.6), '#5f7a66');
          rect(g, cb[0] - a(1.7), sy - a(6.4), a(1.2), a(5.6), '#78947e');
          ellipse(g, cb[0], sy - a(7.3), a(1.2), a(1.2), '#6a866f');
          edgeLine(g, [cb[0] + a(1.4), sy - a(5.4)], [cb[0] + a(3.2), sy - a(9.2)], '#5f7a66', 3);
          pillar(pr.x + pr.w - pin, pr.y + pr.h - pin);
          break;
        }
        case 'pumphouse': {
          var pl2 = lift || 0, PH = pr.height;
          box(g, pr, PREFAB, { roof: '#4a4f47', roofEdge: '#5e645a', windows: null, lift: pl2 });
          var Q = function (x, y, up) { var q = toScreen(x, y); return [q.x, q.y - pl2 - (up || 0)]; };
          var f1 = Q(pr.x, pr.y + pr.h), f2 = Q(pr.x + pr.w, pr.y + pr.h), f3 = Q(pr.x + pr.w, pr.y);
          // the door, on the front wall
          var pdA = lerp2(f1, f2, 0.38), pdB = lerp2(f1, f2, 0.6), pdh = Math.min(PH - a(2), a(7));
          poly(g, [pdA, pdB, [pdB[0], pdB[1] - pdh], [pdA[0], pdA[1] - pdh]], pr.found ? '#2a2620' : '#3a3d38');
          // the pipe out of the right-hand wall, down to the valve
          var pp = lerp2(f3, f2, 0.5);
          rect(g, pp[0], pp[1] - a(4.2), a(3.2), a(1.4), '#5c6a72');
          rect(g, pp[0] + a(3.2) - a(0.8), pp[1] - a(4.2), a(1.4), a(4.2), '#4c5960');
          ellipse(g, pp[0] + a(3.2), pp[1] - a(5.2), a(1.3), a(1.3), '#a8413a');
          ellipse(g, pp[0] + a(3.2), pp[1] - a(5.2), a(0.7), a(0.7), '#4a4f47');
          // the vent stack on the roof
          var vs = Q(pr.x + pr.w * 0.7, pr.y + pr.h * 0.35, PH);
          rect(g, vs[0] - a(0.8), vs[1] - a(5), a(1.6), a(5), '#6a706a');
          ellipse(g, vs[0], vs[1] - a(5), a(0.8), a(0.4), '#2a2c2a');
          // a lamp over the door: lit red on the one she is in
          var pl3 = lerp2(pdA, pdB, 0.5);
          dot(g, pl3[0] - 1, pl3[1] - pdh - a(1.4), pr.found ? '#ff5a3a' : '#4a3a30', 3);
          if (pr.found) {
            ellipse(g, pl3[0], pl3[1] - pdh - a(1.2), a(2), a(1), 'rgba(255,90,58,.25)');
            edgeLine(g, [pdA[0], pdA[1] - pdh * 0.5], [pdB[0], pdB[1] - pdh * 0.7], '#d9a441', 2);
          }
          // searched and empty, or left cold: struck through on the roof
          if (pr.checked && !pr.found) {
            var r1 = Q(pr.x + 0.5, pr.y + 0.5, PH), r2 = Q(pr.x + pr.w - 0.5, pr.y + 0.5, PH),
              r3 = Q(pr.x + pr.w - 0.5, pr.y + pr.h - 0.5, PH), r4 = Q(pr.x + 0.5, pr.y + pr.h - 0.5, PH);
            edgeLine(g, r1, r3, '#d0503c', 4);
            edgeLine(g, r2, r4, '#d0503c', 4);
          }
          break;
        }
        case 'building':
        case 'bunker':
        case 'highwall': {
          var bst = pr.kind === 'building' ? (pr.style || 'concrete') : null;
          if (bst === 'glass') { glassTower(g, pr, lift || 0, !!cutaway); break; }
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
          /* a location ruled out is struck through in red: searched and empty, or
             left cold once the objective turned up somewhere else */
          if (pr.checked && !pr.found) {
            edgeLine(g, [p.x - a(6.5), p.y - a(3.2)], [p.x + a(6.5), p.y + a(3.2)], '#d0503c', 4);
            edgeLine(g, [p.x - a(6.5), p.y + a(3.2)], [p.x + a(6.5), p.y - a(3.2)], '#d0503c', 4);
          }
          break;
        }
        case 'beacon': {
          /* A relic (the relic variant): a lodestone the size of a palm. On the
             ground it sits in a scrape of turned earth; carried, nothing is on the
             ground, and the stone is drawn over its carrier, live (drawLive). */
          if (pr.relic) {
            if (!pr.carried) {
              shadowBlob(g, { x: p.x, y: p.y }, a(3), a(1.5));
              ellipse(g, p.x, p.y, a(2.8), a(1.4), 'rgba(40,30,22,.55)');
              ellipse(g, p.x, p.y, a(1.9), a(0.95), 'rgba(20,16,12,.6)');
            }
            break;
          }
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
    /* A door opening (draw.js sets pr.openK, 0 shut to 1 open): over the shut
       hatch baked into the table, the doorway dark beyond and the two leaves
       slid apart into the frame, all kept inside the opening so the frame stays
       in front of them. The same measures as the door's own drawing. */
    function doorOpening(g, lift, pr) {
      var dl = lift || 0, H = pr.height, hz = pr.horiz, k = pr.openK;
      var len = hz ? pr.w : pr.h, jl = Math.max(0.5, (len - Math.min(1.7, len * 0.6)) / 2), WT = 0.4;
      var lt = Math.max(2, Math.round(H * 0.3)), oh = H - lt, cen = hz ? pr.y + pr.h / 2 : pr.x + pr.w / 2, base = hz ? pr.x : pr.y;
      // a point along the doorway (u), across it (off, + towards the viewer) and up (z)
      function P(u, off, z) { var q = hz ? toScreen(base + u, cen + off) : toScreen(cen + off, base + u); return [q.x, q.y - dl - z]; }
      var u0 = jl, u1 = len - jl, F = WT / 2, w = (u1 - u0) / 2, LO = 0;
      g.save();
      g.beginPath();
      [P(u0, F, 0), P(u1, F, 0), P(u1, F, oh), P(u1, -F, oh), P(u0, -F, oh), P(u0, F, oh)].forEach(function (q, i) { if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); });
      g.closePath(); g.clip();
      // the floor through the doorway (the ground the hatch was baked over), a little shadowed under the lintel
      if (pr.ground) {
        var hx = [P(u0, F, 0), P(u1, F, 0), P(u1, -F, oh), P(u0, -F, oh), P(u1, F, oh), P(u0, F, oh)];
        var bx0 = Math.floor(Math.min.apply(null, hx.map(function (q) { return q[0]; }))) - 1, by0 = Math.floor(Math.min.apply(null, hx.map(function (q) { return q[1]; }))) - 1;
        var bx1 = Math.ceil(Math.max.apply(null, hx.map(function (q) { return q[0]; }))) + 1, by1 = Math.ceil(Math.max.apply(null, hx.map(function (q) { return q[1]; }))) + 1;
        bx0 = Math.max(0, bx0); by0 = Math.max(0, by0); bx1 = Math.min(pr.ground.width, bx1); by1 = Math.min(pr.ground.height, by1);
        if (bx1 > bx0 && by1 > by0) g.drawImage(pr.ground, bx0, by0, bx1 - bx0, by1 - by0, bx0, by0, bx1 - bx0, by1 - by0);
      }
      poly(g, [P(u0, F, 0), P(u1, F, 0), P(u1, F, oh), P(u1, -F, oh), P(u0, -F, oh), P(u0, F, oh)], 'rgba(8,10,12,' + (pr.ground ? 0.35 : 0.9) + ')');
      // the leaves, each sliding out of the opening into the frame on its own side
      var slide = w * k;
      [[u0 - slide, u0 + w - slide], [u0 + w + slide, u1 + slide]].forEach(function (L) {
        poly(g, [P(L[0], LO, 0), P(L[1], LO, 0), P(L[1], LO, oh), P(L[0], LO, oh)], vgrad(g, P(L[0], LO, oh)[1], P(L[0], LO, 0)[1], [DOOR_STEEL[4], DOOR_STEEL[3], DOOR_STEEL[2]]));
        var by = Math.round(H * 0.3), bh = Math.max(2, Math.round(H * 0.16)), n = 4;
        for (var i = 0; i < n; i++) {
          var a0 = L[0] + (L[1] - L[0]) * i / n, a1 = L[0] + (L[1] - L[0]) * (i + 1) / n;
          poly(g, [P(a0, LO, by), P(a1, LO, by), P(a1, LO, by + bh), P(a0, LO, by + bh)], pr.lock === 'door' ? (i % 2 ? '#1b1a17' : '#c9a23c') : pr.lock === 'doorlock' ? DOOR_RED[3] : DOOR_AMBER[3]);
        }
        edgeLine(g, P(L[1], LO, 1), P(L[1], LO, oh - 1), '#1a1e22', 1);
      });
      g.restore();
      // its lamp, lit bright while it stands open
      var lc = toScreen(pr.x + pr.w / 2, pr.y + pr.h / 2);
      dot(g, lc.x - 1, lc.y - dl - H - 2, '#b4ff9a', 3);
    }
    function drawLive(g, lift, p, pr, t) {
      if (pr.kind === 'door') { doorOpening(g, lift, pr); return; }
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
      if (pr.kind === 'beacon' && pr.relic) {
        // the lodestone: a faceted stone, its veins glowing in a slow beat, lifted over a carrier
        var rup = pr.carried ? a(13) + Math.sin(t / 600) * a(0.6) : a(1.4), rx = p.x, ry = p.y - rup;
        var glow = 0.55 + 0.45 * Math.sin(t / 1400 * Math.PI * 2);
        g.save();
        g.globalAlpha = 0.35 + 0.35 * glow;
        ellipse(g, rx, ry, a(3.2), a(2.6), 'rgba(120,230,210,.35)');
        if (pr.carried) edgeLine(g, [rx, ry + a(1.2)], [rx, p.y - a(6)], 'rgba(120,230,210,.35)', 2);
        g.restore();
        poly(g, [[rx - a(1.3), ry], [rx - a(0.5), ry - a(1.4)], [rx + a(0.9), ry - a(1.1)], [rx + a(1.4), ry + a(0.2)], [rx + a(0.4), ry + a(1.2)], [rx - a(0.9), ry + a(0.9)]], '#2b3a3f');
        poly(g, [[rx - a(0.5), ry - a(1.4)], [rx + a(0.9), ry - a(1.1)], [rx + a(0.2), ry - a(0.1)], [rx - a(0.8), ry - a(0.2)]], '#4a6670');
        g.save();
        g.globalAlpha = 0.5 + 0.5 * glow;
        edgeLine(g, [rx - a(0.8), ry + a(0.4)], [rx + a(0.2), ry - a(0.3)], '#8ff0dc', 1);
        edgeLine(g, [rx + a(0.2), ry - a(0.3)], [rx + a(0.9), ry + a(0.5)], '#8ff0dc', 1);
        dot(g, rx - a(0.1), ry - a(0.4), '#e6fff8', 2);
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
    function lives(pr) { return pr.kind === 'beacon' || pr.kind === 'objective' || (pr.kind === 'door' && pr.openK > 0); }

    return { drawKind: drawKind, drawLive: drawLive, lives: lives };
  };
})(window);
