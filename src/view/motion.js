/* How things move on the table — shared by the battle (game.js) and the Unit
   Viewer (viewer.js), so a unit walks, burrows, flies and arrives on the bench
   exactly as it does in a game.

   Everything here is timing and shape: how far a pace is, how long a move or
   a strafing run takes, how an arriving unit is drawn at a given moment. The
   callers own the clocks and the effects; this only answers "where, and how
   far through". */
(function (root) {
  'use strict';
  var R = root.PMC;

  /* ---- walking ----
     A footfall happens every so many inches covered, not every so many
     milliseconds, so a fast unit puts its legs down faster rather than sliding.
     The body rides with the feet: up between paces, down onto each one. */
  var PACE = 2.2;          // inches a pace, for a squad on foot
  var STRIDE = 3.4;        // a walker's legs are longer, and slower
  var ROLL = 2.8;          // how often a ground hull pitches on its suspension
  var STEP_GAP = 130;      // never more than one footstep sound this often

  function gaitOf(u) {
    // jump troops go up on their jets and come down where they were going
    if (u.jets) return { arc: true };
    if (!R.isMachine(u)) return { span: PACE, lift: 1.6, sound: true };
    if (u.prop === 'walker') return { span: STRIDE, lift: 1.3, sound: true };
    // grav and hover hulls float: nothing to bounce, nothing to hear
    if (u.prop === 'grav' || u.prop === 'hover') return null;
    if (u.cls === 'aircraft') return null;
    return { span: ROLL, lift: 0.5, sound: false };   // wheels and tracks, pitching
  }

  // how high a jump squad's arc peaks, in plate pixels, for a bound this long
  function jetApex(inches) {
    var K = root.PMCIso.K;
    return Math.min(K * 3, K * (0.9 + inches * 0.22));
  }

  /* An aircraft covers a lot of table in one move; at a squad's pace it
     flashes across, so it takes its time and reads as flying. */
  function moveMs(u, total) {
    if (u.cls === 'aircraft') return Math.min(3200, 700 + total * 85);
    return Math.min(1400, 240 + total * 42);
  }

  /* ---- burrowing ----
     Underground Bugs do not walk across the table: they go down and come up.
     A burrowing move is in three parts — fading out where it stands as it
     sinks, unseen under a line of churned earth, fading back in where it comes
     up — split at these fractions of the move. */
  function burrows(u) { return !!u && u.faction === 'bugs' && u.group === 'Underground Bugs'; }
  var BURROW_SINK = 0.28, BURROW_RISE = 0.72;
  // how wide the ground falls in where it goes down and comes up
  function burrowR(u) { return R.isMachine(u) ? 2.4 : 1.6; }
  function burrowMs(total) { return Math.max(1900, Math.min(3200, 1300 + total * 60)); }

  /* ---- a strafing run ----
     The craft flies the length of it, guns going: 1.1s plus 140ms an inch of
     run, between 1.9s and 4s. */
  function strafeMs(span) { return Math.max(1900, Math.min(4000, 1100 + span * 140)); }

  /* ---- arriving ----
     A craft falls out of the sky onto its landing point; a squad is already on
     the ground and comes up out of cover — drawn broken, then suppressed, then
     standing; a Xenotripod squad teleports in; a giant bug heaves itself up
     out of the ground. Only how it is drawn: nothing the rules see changes. */
  var DROP_MS = 900;          // how long a craft is falling
  var STAND_MS = 1150;        // how long a squad takes to get up
  var TELE_MS = 1300;         // how long a Xenotripod squad takes to teleport in
  // how wide the pillar of light is that a unit teleports in through
  function teleportR(u) { return u.cls === 'aircraft' ? 2.6 : R.isMachine(u) ? 2.2 : 1.4; }
  function arrivalMs(kind) { return kind === 'drop' ? DROP_MS : kind === 'teleport' ? TELE_MS : STAND_MS; }

  /* How an arrival `age` ms in is drawn: a lift above the ground (plate
     pixels), a pose, and whether it is hidden or faint. Null once it is over.
     `dropFrom` is the height a craft falls from, if not the default. */
  function arrival(kind, age, machine, dropFrom) {
    if (age >= arrivalMs(kind)) return null;
    if (kind === 'drop') {
      // gathering speed the whole way down, so it arrives hard rather than drifting in
      var eased = 1 - Math.pow(1 - age / DROP_MS, 0.45);
      var fromUp = dropFrom != null ? dropFrom : root.PMCIso.ELEV * 5.5;
      return { lift: Math.round(fromUp * (1 - eased)), pose: null };
    }
    if (kind === 'teleport') {
      /* A pillar of light forms on the landing point, the squad flickers into
         being inside it, and the light thins away. Before it forms the squad
         is not drawn at all. */
      var tk = age / TELE_MS;
      if (tk < 0.3) return { lift: 0, pose: null, hidden: true };
      var ta = Math.min(1, (tk - 0.3) / 0.35);
      // flickering in: every other few frames it drops out, less often as it firms up
      var flick = ta < 1 && Math.floor(age / 55) % (ta < 0.5 ? 2 : 4) === 0;
      return { lift: 0, pose: null, alpha: flick ? ta * 0.3 : ta };
    }
    /* A giant bug has no poses to get up through: the ground splits, the dust
       goes up, and it is there in the dust as it clears. */
    if (machine) {
      var hk = Math.min(1, age / (STAND_MS * 0.85));
      if (hk < 0.18) return { lift: 0, pose: null, hidden: true };
      var ha = Math.min(1, (hk - 0.18) / 0.6);
      return { lift: 0, pose: null, alpha: ha * ha * (3 - 2 * ha) };
    }
    // flat on its face, then up on one knee, then standing
    return { lift: 0, pose: age < STAND_MS * 0.38 ? 'prone' : age < STAND_MS * 0.74 ? 'kneel' : null };
  }

  root.PMCMotion = {
    PACE: PACE, STRIDE: STRIDE, ROLL: ROLL, STEP_GAP: STEP_GAP,
    gaitOf: gaitOf, jetApex: jetApex, moveMs: moveMs,
    burrows: burrows, BURROW_SINK: BURROW_SINK, BURROW_RISE: BURROW_RISE, burrowR: burrowR, burrowMs: burrowMs,
    strafeMs: strafeMs,
    DROP_MS: DROP_MS, STAND_MS: STAND_MS, TELE_MS: TELE_MS, teleportR: teleportR, arrivalMs: arrivalMs, arrival: arrival
  };
})(typeof window !== 'undefined' ? window : globalThis);
