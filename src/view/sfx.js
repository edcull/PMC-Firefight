/* PMC 2670 — Firefight : synthesised sound.
   Everything is generated with the Web Audio API — no files to load. The context
   is created on the first gesture, as browsers require. */
(function (root) {
  'use strict';

  var ctx = null, master = null, noise = null;
  var on = true;

  try {
    var saved = localStorage.getItem('pmc-sound');
    if (saved !== null) on = saved === '1';
  } catch (e) { }

  function ensure() {
    if (!on) return false;
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = 0.22;
        master.connect(ctx.destination);
        var len = Math.floor(ctx.sampleRate * 1.2);
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        var d = noise.getChannelData(0);
        for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      } catch (e2) { ctx = null; return false; }
    }
    if (ctx.state === 'suspended') { try { ctx.resume(); } catch (e3) { } }
    return true;
  }

  function now() { return ctx.currentTime; }

  function burstOfNoise(t, dur, gain, filter, freq, q, sweepTo) {
    var src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    src.playbackRate.value = 0.8 + Math.random() * 0.5;
    var f = ctx.createBiquadFilter();
    f.type = filter || 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
    f.Q.value = q === undefined ? 1 : q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function tone(t, dur, gain, type, f0, f1) {
    var o = ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  var SFX = {
    enabled: function () { return on; },
    setEnabled: function (v) {
      on = !!v;
      try { localStorage.setItem('pmc-sound', on ? '1' : '0'); } catch (e) { }
      if (on) ensure();
    },
    unlock: function () { ensure(); },

    /* a single shot: crack plus the tail of the report */
    shot: function (heavy, delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      burstOfNoise(t, heavy ? 0.16 : 0.09, heavy ? 0.5 : 0.34, 'bandpass', heavy ? 1500 : 2400, 0.9, heavy ? 320 : 600);
      tone(t, heavy ? 0.1 : 0.06, heavy ? 0.22 : 0.13, 'square', heavy ? 180 : 260, heavy ? 60 : 110);
    },

    /* A rifle line. Eight men do not fire once each and stop: the volley runs on,
       ragged, for the better part of a second. */
    burst: function (rounds, heavy) {
      if (!ensure()) return;
      var n = Math.max(5, Math.min(12, (rounds || 2) * 2 + 4));
      // aimed shots, ragged: about nine a second, not a stream
      var t = 0;
      for (var i = 0; i < n; i++) {
        SFX.shot(heavy, t);
        t += 0.09 + Math.random() * 0.06;
      }
    },

    /* A sidearm. Officers, medics and signallers are not putting fire down —
       they are defending themselves, in deliberate single shots. Sharper than a
       rifle and with far less weight behind it: a flat crack and almost no tail,
       with a long enough gap between rounds to hear each one land. */
    pistol: function (rounds, delay) {
      if (!ensure()) return;
      var n = Math.max(3, Math.min(6, (rounds || 2) + 2));
      var t0 = (delay || 0);
      for (var i = 0; i < n; i++) {
        var t = now() + t0 + i * (0.17 + Math.random() * 0.06);
        burstOfNoise(t, 0.055, 0.3, 'bandpass', 2700 + Math.random() * 600, 1.4, 900);
        burstOfNoise(t + 0.01, 0.1, 0.07, 'lowpass', 600, 0.5, 220);   // the little slap under it
        tone(t, 0.035, 0.1, 'square', 330, 150);
      }
    },

    /* A machine gun does not fire in ones. It works in long rattling bursts,
       with the rate audible in the gaps rather than the rounds. */
    rattle: function (rounds, delay) {
      if (!ensure()) return;
      var n = Math.max(8, Math.min(22, (rounds || 3) * 4));
      var t0 = (delay || 0);
      for (var i = 0; i < n; i++) {
        var t = now() + t0 + i * 0.038 + Math.random() * 0.008;
        burstOfNoise(t, 0.05, 0.19 - i * 0.003, 'bandpass', 2100 + Math.random() * 700, 1.2, 700);
        tone(t, 0.035, 0.085, 'square', 300, 130);
      }
      // the muzzle wash that hangs under a long burst
      burstOfNoise(now() + t0, n * 0.042, 0.06, 'lowpass', 700, 0.5, 200);
    },

    /* An autocannon: heavy rapid fire. Slower than a machine gun and far more
       weight behind each round — you can count them going out. */
    chain: function (rounds, delay) {
      if (!ensure()) return;
      var n = Math.max(5, Math.min(12, (rounds || 3) * 2 + 3));
      var t0 = (delay || 0);
      for (var i = 0; i < n; i++) {
        var t = now() + t0 + i * 0.092 + Math.random() * 0.006;
        burstOfNoise(t, 0.09, 0.4, 'bandpass', 1300, 0.8, 280);   // the report
        burstOfNoise(t, 0.16, 0.16, 'lowpass', 420, 0.6, 110);    // the weight under it
        tone(t, 0.08, 0.2, 'square', 165, 52);
      }
      // the drum of the mount working
      burstOfNoise(now() + t0, n * 0.095, 0.05, 'lowpass', 340, 0.5, 130);
    },

    /* A tank gun or an anti-tank missile: one round, and you feel it. A sharp
       crack over a deep thump, with the blast rolling away after it. */
    shell: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      /* A tank gun is chest, not ear. The old version led with a 2.6kHz highpass
         crack, which rang; the report is now a short band of midrange over a long
         low blast, with the body carried by sub-bass sines rather than a square
         wave. Nothing above about 1.6kHz, so there is no ping left in it. */
      burstOfNoise(t, 0.07, 0.34, 'bandpass', 900, 0.8, 260);      // the report
      burstOfNoise(t + 0.005, 0.55, 0.62, 'lowpass', 300, 0.5, 60); // the blast under it
      burstOfNoise(t + 0.03, 0.9, 0.2, 'lowpass', 160, 0.4, 45);    // and the roll away
      tone(t, 0.34, 0.42, 'sine', 96, 30);                          // the punch
      tone(t + 0.01, 0.22, 0.2, 'triangle', 190, 52);               // a little edge on it
      tone(t + 0.04, 0.8, 0.18, 'sine', 48, 21);                    // the weight
    },

    /* Short, close bursts — an SMG or a carbine. Faster than a rifle and much
       flatter, with no reach in the report. */
    smg: function (rounds, delay) {
      if (!ensure()) return;
      var n = Math.max(5, Math.min(14, (rounds || 2) * 2 + 5));
      var t0 = (delay || 0);
      // quicker than an aimed rifle line, and lighter: a carbine, not a rifle
      for (var i = 0; i < n; i++) {
        var t = now() + t0 + i * (0.058 + Math.random() * 0.03);
        burstOfNoise(t, 0.05, 0.28, 'bandpass', 2200 + Math.random() * 500, 1.1, 640);
        tone(t, 0.035, 0.11, 'square', 250, 115);
      }
    },

    /* A flamethrower has no report at all — there is nothing to crack. What it
       is, is a soft whump as the fuel lights and then a roar that holds for as
       long as the trigger is down, with the crackle of what is burning on the
       ground under it. `hold` is how long the burst runs, in seconds. */
    flame: function (delay, hold) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      var d = Math.max(0.4, Math.min(3, hold || 0.9));
      burstOfNoise(t, 0.18, 0.24, 'lowpass', 540, 0.6, 250);       // the igniter, soft
      burstOfNoise(t + 0.02, d, 0.52, 'lowpass', 880, 0.35, 560);  // the roar of the fuel
      burstOfNoise(t + 0.02, d, 0.3, 'bandpass', 360, 0.5, 300);   // the body under it
      burstOfNoise(t + 0.05, d, 0.1, 'highpass', 1900, 0.4);       // a breath of hiss, no more
      tone(t + 0.01, d * 0.92, 0.11, 'sawtooth', 56, 38);          // the low roar
      // the crackle of it burning where it fell, for as long as it burns
      for (var i = 0; i < Math.round(d * 20); i++) {
        burstOfNoise(t + 0.2 + Math.random() * (d + 0.3), 0.05, 0.06,
          'bandpass', 1200 + Math.random() * 1800, 2);
      }
    },

    /* Each pump of the trigger after the first: the fuel surging, felt rather
       than heard over the roar already running. */
    flamepuff: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      burstOfNoise(t, 0.14, 0.26, 'lowpass', 700, 0.5, 300);
      tone(t, 0.1, 0.07, 'sawtooth', 84, 48);
    },

    /* A Gauss weapon or a las-cutter: a capacitor dumping, and a crack of air
       where the line went. Nothing mechanical about it. */
    rail: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      tone(Math.max(0, t - 0.06), 0.07, 0.1, 'sawtooth', 180, 900);             // the charge, rising
      burstOfNoise(t, 0.03, 0.5, 'highpass', 3600, 1.2);           // the discharge
      tone(t, 0.14, 0.3, 'sine', 1800, 180);                       // the line itself
      burstOfNoise(t + 0.01, 0.3, 0.2, 'lowpass', 700, 0.5, 120);  // the air closing
      tone(t + 0.02, 0.4, 0.08, 'triangle', 90, 40);
    },

    /* A Xenotripod energy pulse: a bright chirp falling away, and a soft
       glassy ring after it — nothing of a cartridge in it. */
    zap: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      tone(t, 0.09, 0.16, 'square', 2400, 620);
      tone(t, 0.18, 0.1, 'sine', 1320, 1180);
      burstOfNoise(t, 0.04, 0.18, 'highpass', 4200, 1.1);
    },
    /* A stream of energy fire from a Xenotripod unit using an ordinary
       firearm's rhythm: the same shots, spaced the same, but every one an energy pulse.
       `style` is the gun's style, `n` roughly how much fire goes down. */
    zaps: function (style, n) {
      if (!ensure()) return;
      var R = { pistol: [4, 0.19, 1.15], small: [8, 0.11, 1], smg: [10, 0.065, 1.1], burst: [12, 0.045, 0.92], chain: [8, 0.1, 0.75] }[style] || [8, 0.11, 1];
      var count = Math.max(3, Math.min(R[0] + (n || 0), R[0] + 4)), t0 = now();
      for (var i = 0; i < count; i++) {
        var t = t0 + i * R[1] + (i % 3) * 0.003, pf = R[2] * (0.985 + (i % 4) * 0.01);
        // each shot is the energy pulse's own sound: a chirp falling away and a glassy ring
        tone(t, 0.09, 0.13, 'square', 2400 * pf, 620 * pf);
        tone(t, 0.16, 0.08, 'sine', 1320 * pf, 1180 * pf);
        burstOfNoise(t, 0.04, 0.14, 'highpass', 4200, 1.1);
      }
    },
    /* A Teleport pad or a Regain Control: a rising shimmer. */
    shimmer: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      tone(t, 0.5, 0.08, 'sine', 420, 1680);
      tone(t + 0.05, 0.45, 0.06, 'triangle', 630, 2520);
      burstOfNoise(t, 0.5, 0.06, 'bandpass', 3200, 2, 5200);
    },

    /* A guided missile: the motor lights, then howls away and gets quieter as it
       goes. `flight` is how long it is in the air. */
    missile: function (delay, flight) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      var d = Math.max(0.3, Math.min(1.8, flight || 0.7));
      /* No tone sweeping up: that is a ray gun, not a rocket motor. What a
         missile is, is a hard crack of pressure as the booster lights, a thump
         as it leaves the rail, and then a rough roar that holds for as long as
         it is flying and thins as it goes away from you. */
      burstOfNoise(t, 0.05, 0.42, 'highpass', 1700, 0.8);            // the igniter
      burstOfNoise(t, 0.26, 0.55, 'lowpass', 900, 0.6, 170);         // the blast off the rail
      tone(t, 0.24, 0.26, 'sine', 132, 42);                          // and the thump of it
      burstOfNoise(t + 0.03, d, 0.38, 'bandpass', 520, 0.45, 240);   // the motor, running
      burstOfNoise(t + 0.03, d, 0.2, 'highpass', 1300, 0.4, 2800);   // the hiss over it
      tone(t + 0.02, d * 0.95, 0.11, 'sawtooth', 64, 36);            // the rumble under it
    },

    /* Unguided rockets off the rails: a ripple, not a single launch. */
    rocket: function (rounds, delay) {
      if (!ensure()) return;
      var n = Math.max(2, Math.min(6, (rounds || 2) + 1));
      var t0 = (delay || 0);
      for (var i = 0; i < n; i++) {
        var t = now() + t0 + i * (0.075 + Math.random() * 0.03);
        burstOfNoise(t, 0.05, 0.38, 'highpass', 1500, 0.7);         // the igniter
        burstOfNoise(t, 0.16, 0.4, 'lowpass', 1000, 0.6, 220);      // it leaves the rail
        burstOfNoise(t + 0.02, 0.45, 0.2, 'bandpass', 620, 0.45, 300);  // the motor after it
        tone(t, 0.14, 0.18, 'sine', 150, 48);
      }
    },

    /* A mortar or a gun firing indirect: a hollow thump as it leaves the tube,
       then a pause while the round is in the air, then the whistle coming down.
       `flight` is how long the shell is up, in seconds. */
    launch: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      /* An arcing round leaving the tube: a bass "thoop" — a soft puff of gas
         and a deep hollow note that drops away under it. No crack, and nothing
         high enough to read as a "pew". */
      burstOfNoise(t, 0.08, 0.5, 'lowpass', 520, 0.7, 150);       // the puff of the charge
      burstOfNoise(t + 0.01, 0.32, 0.7, 'lowpass', 200, 0.6, 50);  // the air pushed out of the tube
      burstOfNoise(t, 0.12, 0.28, 'bandpass', 480, 1.2, 160);      // its body, so small speakers carry it
      tone(t, 0.36, 1.1, 'sine', 140, 44);                         // the "thoop" itself
      tone(t, 0.44, 0.7, 'sine', 66, 34);                          // and the sub under it
      tone(t + 0.01, 0.24, 0.28, 'triangle', 190, 70);             // the tube's hollow ring
    },
    incoming: function (delay, flight) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      var d = Math.max(0.2, Math.min(1.2, flight || 0.5));
      /* The round coming down: air over a falling shell, not a tone. A band of
         noise sliding down low, a rush of air rather than a whistle. */
      burstOfNoise(t, d, 0.14, 'bandpass', 620, 2.2, 180);
      burstOfNoise(t + d * 0.4, d * 0.6, 0.14, 'lowpass', 360, 0.6, 110);
    },

    /* The bugs. A spit: a wet, throaty hawk — a gurgle rising, then the glob
       leaving with a slap. `big` is the bio-plasma sac, deeper and longer. */
    spit: function (delay, big) {
      if (!ensure()) return;
      var t = now() + (delay || 0), m = big ? 0.62 : 1;
      burstOfNoise(t, 0.16, 0.28, 'bandpass', 700 * m, 3.5, 1500 * m);   // the gurgle, rising
      tone(t, 0.14, 0.2, 'sawtooth', 90 * m, 170 * m);
      burstOfNoise(t + 0.14, 0.09, 0.45, 'lowpass', 1400 * m, 0.8, 300); // the slap as it leaves
      tone(t + 0.14, 0.12, 0.3, 'sine', 240 * m, 80 * m);
    },
    // acid landing: a splash and a long hiss
    splat: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      burstOfNoise(t, 0.1, 0.3, 'lowpass', 900, 0.8, 250);
      burstOfNoise(t + 0.05, 0.6, 0.12, 'highpass', 3600, 0.7, 2200);
    },
    // a volley of chitin spines: dry clicks, fast, then a soft whip
    spine: function (rounds, delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0), n = Math.max(4, Math.min(12, (rounds || 2) * 2 + 3));
      for (var i = 0; i < n; i++) {
        var ti = t + i * 0.045 + Math.random() * 0.015;
        burstOfNoise(ti, 0.025, 0.3, 'bandpass', 3200 + Math.random() * 1400, 4);
        burstOfNoise(ti + 0.01, 0.07, 0.08, 'highpass', 5000, 0.8, 2500);
      }
    },
    // the Psychic Wave: a deep throb swelling out, with a shimmer on top
    wave: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      tone(t, 1.2, 0.35, 'sine', 48, 36);
      tone(t, 1.1, 0.16, 'triangle', 96, 72);
      tone(t + 0.05, 0.9, 0.06, 'sine', 820, 1240);
      tone(t + 0.08, 0.9, 0.05, 'sine', 870, 1310);
      burstOfNoise(t, 1.1, 0.1, 'bandpass', 300, 1.5, 900);
    },
    // bugs going in: a rising chitter of mandibles
    chitter: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      for (var i = 0; i < 9; i++) {
        burstOfNoise(t + i * 0.035, 0.03, 0.22, 'bandpass', 2200 + i * 160, 6);
      }
      tone(t, 0.3, 0.06, 'square', 340, 520);
    },

    /* rounds striking home */
    impact: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      burstOfNoise(t, 0.13, 0.26, 'lowpass', 900, 0.7, 260);
      tone(t, 0.09, 0.16, 'sine', 120, 55);
    },

    /* a model down */
    casualty: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      burstOfNoise(t, 0.2, 0.3, 'lowpass', 700, 0.6, 180);
      tone(t + 0.02, 0.26, 0.2, 'triangle', 300, 90);
    },

    /* A jump pack lighting: a roar of burn that swells as the squad goes up,
       holds through the arc and dies as they come down, with a thump at each end. */
    jetpack: function (dur, delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0), d = Math.max(0.4, Math.min(1.6, dur || 0.8));
      burstOfNoise(t, 0.16, 0.22, 'lowpass', 500, 0.8, 160);              // the kick off the ground
      burstOfNoise(t + 0.02, d, 0.2, 'bandpass', 900, 0.9, 520);          // the burn
      burstOfNoise(t + 0.04, d * 0.9, 0.12, 'highpass', 2400, 0.7, 1500); // its hiss
      burstOfNoise(t + d - 0.05, 0.18, 0.2, 'lowpass', 420, 0.8, 120);    // the landing
      tone(t, d, 0.05, 'sawtooth', 72, 58);
    },

    /* boots on the ground */
    step: function (delay) {
      if (!ensure()) return;
      burstOfNoise(now() + (delay || 0), 0.06, 0.1, 'bandpass', 420 + Math.random() * 200, 1.4);
    },

    /* blades and rifle butts */
    clash: function (delay) {
      if (!ensure()) return;
      var t = now() + (delay || 0);
      burstOfNoise(t, 0.09, 0.3, 'highpass', 2200, 0.8);
      tone(t, 0.16, 0.16, 'triangle', 1400 + Math.random() * 300, 700);
    },

    /* suppression taking hold */
    suppress: function () {
      if (!ensure()) return;
      tone(now(), 0.4, 0.14, 'sine', 320, 140);
    },
    /* A unit breaking: not a falling "bew" but a dull, uneasy chord — two low
       notes a semitone apart, held flat and fading — over a thud and the
       scuffle of men scattering. */
    broken: function () {
      if (!ensure()) return;
      var t = now();
      burstOfNoise(t, 0.22, 0.34, 'lowpass', 300, 0.7, 90);        // the thud of it
      tone(t, 0.7, 0.16, 'triangle', 110, 110);                    // the chord, held, not sliding
      tone(t, 0.7, 0.13, 'triangle', 116.5, 116.5);
      tone(t + 0.02, 0.6, 0.06, 'sine', 55, 55);
      for (var i = 0; i < 6; i++) {                                // feet scattering
        burstOfNoise(t + 0.08 + i * 0.07 + Math.random() * 0.03, 0.05, 0.12, 'bandpass', 380 + Math.random() * 260, 1.4);
      }
    },

    /* dice and interface */
    dice: function () {
      if (!ensure()) return;
      var t = now();
      for (var i = 0; i < 3; i++) burstOfNoise(t + i * 0.045, 0.04, 0.16, 'bandpass', 1800 + Math.random() * 900, 2.5);
    },
    click: function () {
      if (!ensure()) return;
      burstOfNoise(now(), 0.025, 0.08, 'highpass', 2600, 1);
    },
    chime: function () {
      if (!ensure()) return;
      var t = now();
      tone(t, 0.5, 0.12, 'sine', 523, 523);
      tone(t + 0.07, 0.5, 0.1, 'sine', 784, 784);
    },
    victory: function () {
      if (!ensure()) return;
      var t = now();
      [523, 659, 784, 1046].forEach(function (f, i) { tone(t + i * 0.11, 0.5, 0.12, 'triangle', f, f); });
    }
  };

  root.SFX = SFX;
})(window);
