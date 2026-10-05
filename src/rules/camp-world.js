/* Online campaigns: a world of two to ten forces, each run by a player on their
   own device or by the server, fighting whenever they each have the time. The
   server keeps the world and owns its rules: a player sends a command, the server
   runs it with the campaign's own functions (the ones the dossier uses at one
   screen), saves it, and tells the others it has changed.

   It begins in a lobby: slots, open until a player takes one (by the campaign's
   code, or from the Multiplayer list if it is public), or set by the host to an AI
   force of a chosen army; a colour for each; a chat; and everyone ready. The host
   starts it: the AI forces are raised, and each player founds their own.

   Then each player sees the world as a single-player campaign sees it — their
   own force, and every other force on the world a rival with a dossier to read —
   and fights one of two ways:
     - against an AI force: the contracts on offer, rolled for them once a turn
       and kept (as single-player), the battle fought on the server with the AI
       side played there, the aftermath applied there, and the other AI forces
       fighting it out elsewhere meanwhile;
     - against another player: one challenges, the other accepts, and only then
       is a contract drawn up between them, as between two players at one screen.
   Battles run side by side: each is a table of its own on the server.

   Kept in the database's campaigns table (kind 'online'), its players as members
   (side = their slot), with an invite code.

   Shared by the server (server/online.js, its db the database) and the browser,
   where a hotseat campaign with AI forces is the same world kept on this device. */
(function (root) {
  'use strict';
  const C = root.PMCCamp, R = root.PMC, SC = root.PMCScen, P = root.PMCProto, Cmds = root.PMCCampCmds;
  // a fair die for the invite codes: node's crypto on the server, the browser's own otherwise
  const nodeCrypto = typeof window === 'undefined' && typeof require === 'function' ? require('crypto') : null;
  function randomInt(n) {
    if (nodeCrypto) return nodeCrypto.randomInt(n);
    if (root.crypto && root.crypto.getRandomValues) { const u = new Uint32Array(1); root.crypto.getRandomValues(u); return u[0] % n; }
    return Math.floor(Math.random() * n);
  }
  root.PMCWorld = (function () {
    const MIN_SLOTS = 2, MAX_SLOTS = 10;          // two to ten forces (an odd one out sits a round out elsewhere)
    const FACTIONS = ['pmc', 'rebel', 'bugs', 'xeno'];
    const PLANETS = ['desert', 'arctic', 'sparse', 'dense', 'industrial', 'jungle', 'mountain', 'unstable'];
    const text = (v, n) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, n);
    const no = (why, code) => ({ ok: false, why: why, code: code || 400 });
    const pickOne = (a) => a[Math.floor(Math.random() * a.length)];
    const founded = (co) => !!(co && co.roster && co.roster.length);
    const colourOf = (co) => (co && P.COLOURS.indexOf(co.colour) >= 0 ? co.colour : null);

    function inviteCode() {
      const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let s = '';
      for (let i = 0; i < 8; i++) s += a[randomInt(a.length)];
      return s;
    }

    /* ================= the world ================= */
    function newWorld(host) {
      return {
        world: 2, phase: 'lobby', name: host.name + '’s campaign',
        slots: [
          { kind: 'human', user: host.userId, name: host.name, colour: 'ochre', faction: 'pmc', ready: false },
          { kind: 'open', user: null, name: null, colour: 'steel', faction: 'random', ready: false },
          { kind: 'ai', user: null, name: null, colour: 'olive', faction: 'random', ready: true },
          { kind: 'ai', user: null, name: null, colour: 'crimson', faction: 'random', ready: true }
        ],
        chat: [], forces: [], players: {}, duels: [], nextDuel: 1, applied: [], over: null
      };
    }
    const humanSlots = (W) => W.slots.map((s, i) => (s.kind === 'human' ? i : -1)).filter((i) => i >= 0);
    const aiSlots = (W) => W.slots.map((s, i) => (s.kind === 'ai' ? i : -1)).filter((i) => i >= 0);
    const slotOf = (W, userId) => W.slots.findIndex((s) => s.kind === 'human' && s.user === userId);
    const playing = (W, i) => W.slots[i] && W.slots[i].kind === 'human' && !W.slots[i].out;
    function duelOf(W, i) { return (W.duels || []).filter((d) => d.phase !== 'asked' && (d.a === i || d.b === i))[0] || null; }
    // a player with something under way (a contract, a battle, questions after one): nothing else starts for them
    function busy(W, i) {
      const p = W.players[i] || {};
      return !!(p.contract || p.pending || p.post || duelOf(W, i));
    }
    // an AI force already in a player's contract or battle
    function aiBusy(W, slot) {
      return Object.keys(W.players).some((k) => { const p = W.players[k]; return (p.contract && p.contract.vs === slot) || (p.pending && p.pending.vs === slot); }) ||
        inFront(W, slot);
    }
    // an AI force with a battle elsewhere still to be fought out (fronts below)
    function inFront(W, slot) { return (W.fronts || []).some((f) => f.pairs.some((pr) => pr[0] === slot || pr[1] === slot)); }

    /* The world as one player is to see it and as the rules want it: the single-player
       shape — their force as A, the AI forces as the rivals (the offers point into
       these, in slot order) — with the other players' forces after them, for the hub
       to show. `faced`: an AI slot to stand as B. */
    function viewOf(W, i, faced) {
      const p = W.players[i] || { turn: 0, log: [] };
      const ai = aiSlots(W), rivals = ai.map((s) => W.forces[s]);
      const facing = faced != null ? Math.max(0, ai.indexOf(faced)) : 0;
      return {
        mode: 'solo', world: true, turn: p.turn || 0, created: 0, name: W.name,
        companies: { A: W.forces[i], B: rivals[facing] || null }, rivals: rivals, facing: facing,
        offers: p.offers || null, offersTurn: p.offersTurn == null ? null : p.offersTurn, log: p.log || []
      };
    }
    /* The world as the aftermath of player i's battle with AI force `vs` wants it:
       that force as B, and as the others fighting it out elsewhere only the AI forces
       not in another player's contract or battle just now. */
    function afterView(W, i, vs) {
      const v = viewOf(W, i, vs);
      const free = aiSlots(W).filter((s) => s !== vs && !inFront(W, s) && !Object.keys(W.players).some((k) => +k !== i && (((W.players[k].contract || {}).vs === s) || ((W.players[k].pending || {}).vs === s))));
      v.rivals = [W.forces[vs]].concat(free.map((s) => W.forces[s]));
      v.rivalSlots = [vs].concat(free);
      v.facing = 0; v.companies.B = W.forces[vs];
      return v;
    }
    function keepView(W, i, v) {
      const p = W.players[i];
      p.turn = v.turn; p.log = v.log; p.offers = v.offers || null; p.offersTurn = v.offersTurn == null ? null : v.offersTurn;
    }
    // the offers against the AI forces, rolled once a turn for a player who is free to take one (single-player rollOffers)
    function ensureOffers(W, i) {
      const p = W.players[i];
      if (!p || !playing(W, i) || !founded(W.forces[i]) || busy(W, i) || !aiSlots(W).length) return;
      if (p.offers && p.offersTurn === p.turn) return;
      const v = viewOf(W, i);
      C.rollOffers(v);
      keepView(W, i, v);
    }
    // a two-player camp of the shape the contract commands and the hotseat aftermath want
    function pairOf(W, d) {
      const A = W.forces[d.a], B = W.forces[d.b];
      return { mode: 'hotseat', companies: { A: A, B: B }, rivals: [B], facing: 0, turn: (W.players[d.a] || {}).turn || 0, log: [],
        online: { contract: d.contract || null }, pending: d.pending || null, post: d.post || null };
    }

    /* ================= the battle, and after it ================= */
    const benchOf = (co, pk) => co.roster.filter((e) => pk.indexOf(e) < 0 && !(e.restUntil > 0));
    // Drug Dealer: the chosen few of a pick go in Determined
    function drugged(co, picks, want) {
      picks.forEach((e) => { delete e.drugged; });
      if (!C.hasDoctrine(co, 'V4')) return [];
      return Cmds.drugAble(picks).filter((e) => (want || []).indexOf(e.rid) >= 0).map((e) => { e.drugged = true; return e; });
    }
    function pendingOf(k, pA, pB) {
      return {
        tier: k.tier, pl: k.pl, scenario: k.scenario.id,
        A: pA.map((e) => e.rid), B: pB.map((e) => e.rid),
        drugged: pA.concat(pB).filter((e) => e.drugged).map((e) => e.rid)
      };
    }
    // a contract with an AI force: the AI's list picked here, as the single-player dossier's fight() picks it
    function aiBattleConfig(W, i, k) {
      const A = W.forces[i], B = W.forces[k.vs];
      const pA = Cmds.pickEntries(A, k.picks.A);
      drugged(A, pA, k.picks.A.drugs);
      const tacticB = B.faction === 'rebel' ? pickOne([null, 'laststand', 'wave', 'guerillas']) : null;
      let pB = C.pickForce(B, k.tier, k.pl, tacticB) || [];
      if (!R.checkArmy(pB.map((e) => R.entryPick(e)), k.tier, k.pl, B.doctrines, tacticB).ok) {
        C.developRival(B);                                      // it hires in for this battle
        pB = C.pickForce(B, k.tier, k.pl, tacticB) || [];
      }
      pB.forEach((e) => { delete e.drugged; });
      const pending = Object.assign(pendingOf(k, pA, pB), { vs: k.vs });
      return {
        pending: pending,
        cfg: {
          tier: k.tier, pl: k.pl, scenario: k.scenario.id, roles: k.roles || null,
          armyA: pA.map((e) => R.entryPick(e)), armyB: pB.map((e) => R.entryPick(e)),
          nameA: A.name, nameB: B.name, colourA: colourOf(A), colourB: colourOf(B) || (colourOf(A) === 'steel' ? 'ochre' : 'steel'),
          dossier: { A: pA, B: pB }, bench: { A: benchOf(A, pA), B: [] },
          doctrines: { A: A.doctrines.slice(), B: B.doctrines.slice() },
          // the player's tactic is chosen at the table (askTactics); the AI's is settled here
          tactics: { A: null, B: tacticB }, askTactics: true,
          campaign: true, mode: 'ai',
          planet: k.planet && k.planet !== 'random' ? k.planet : null, terrainSetup: 'auto'
        }
      };
    }
    // a contract between two players: both picks theirs, each modifying their army unseen
    function duelBattleConfig(W, d) {
      const k = d.contract, A = W.forces[d.a], B = W.forces[d.b];
      const pA = Cmds.pickEntries(A, k.picks.A), pB = Cmds.pickEntries(B, k.picks.B);
      drugged(A, pA, k.picks.A.drugs); drugged(B, pB, k.picks.B.drugs);
      return {
        pending: pendingOf(k, pA, pB),
        cfg: {
          tier: k.tier, pl: k.pl, scenario: k.scenario.id, roles: k.roles || null,
          armyA: pA.map((e) => R.entryPick(e)), armyB: pB.map((e) => R.entryPick(e)),
          nameA: A.name, nameB: B.name, colourA: colourOf(A), colourB: colourOf(B) || (colourOf(A) === 'steel' ? 'ochre' : 'steel'),
          dossier: { A: pA, B: pB }, bench: { A: benchOf(A, pA), B: benchOf(B, pB) },
          doctrines: { A: A.doctrines.slice(), B: B.doctrines.slice() },
          // each player's tactic is chosen at the table, as in a skirmish
          tactics: { A: null, B: null }, askTactics: true,
          campaign: true, mode: 'hotseat', readyUp: true,
          planet: k.planet && k.planet !== 'random' ? k.planet : null, terrainSetup: 'auto'
        }
      };
    }

    // the post-battle questions, in the order the book puts them (dossier-after.js onFinish), for the players at the table
    function postSteps(camp, report, sides) {
      const steps = [];
      sides.forEach((sd) => { if (report.winner === sd && C.hasDoctrine(camp.companies[sd], 'V2')) steps.push({ kind: 'plunder', side: sd }); });
      sides.forEach((sd) => {
        if (C.hasDoctrine(camp.companies[sd], 'S2')) steps.push({ kind: 'negotiate', side: sd });
        if (C.hasDoctrine(camp.companies[sd], 'V5')) steps.push({ kind: 'weak', side: sd });
      });
      return steps;
    }
    function lossOf(report) {
      const out = {};
      ['A', 'B'].forEach((sd) => {
        let st = 0, en = 0;
        (report.units || []).forEach((l) => {
          if (l.side !== sd) return;
          st += l.startSize || 0;
          en += l.wiped || l.destroyed ? 0 : Math.min(l.endSize || 0, l.startSize || 0);
        });
        out[sd] = st ? Math.round(100 * (st - en) / st) : null;
      });
      return out;
    }
    /* No Place for the Weak! wants the battle's Trauma Points (and the salvage dice
       before them) rolled — here, so the dice are the server's — and is passed over
       when nobody qualifies. True once every question is answered. */
    function prepPost(camp) {
      const post = camp.post;
      while (post && post.steps.length) {
        const st = post.steps[0];
        if (st.kind !== 'weak') break;
        const pre = post.pre;
        if (!pre.tp[st.side]) {
          pre.salvage = pre.salvage || {};
          pre.salvage[st.side] = C.salvageRolls(camp, post.report, st.side, pre.salvage[st.side]);
          pre.tp[st.side] = C.rollTP(camp, post.report, st.side);
        }
        if (C.weakCandidates(camp, st.side, pre.tp[st.side]).length) break;
        post.steps.shift();
      }
      return !!post && !post.steps.length;
    }
    const preOpts = (post) => Object.assign({}, post.pre);
    // a record of an aftermath, as the player reading it is A (a duel's Player 2 has it turned round)
    function flip(o) {
      if (!o || typeof o !== 'object') return o;
      const sw = (x) => (x && typeof x === 'object' && ('A' in x || 'B' in x) ? Object.assign({}, x, { A: x.B, B: x.A }) : x);
      const out = Object.assign({}, o);
      ['sides', 'payment', 'loss', 'kUC', 'balances'].forEach((k) => { if (out[k]) out[k] = sw(out[k]); });
      if (out.winner === 'A' || out.winner === 'B') out.winner = out.winner === 'A' ? 'B' : 'A';
      return out;
    }

    // a duel's questions after the battle, as its Player 2 is to see them: their own force as A
    const flipSide = (x) => (x === 'A' ? 'B' : x === 'B' ? 'A' : x);
    const swapAB = (o) => (o && typeof o === 'object' ? Object.assign({}, o, { A: o.B, B: o.A }) : o);
    function flipPost(post) {
      if (!post) return post;
      const r = post.report || {}, pre = post.pre || {}, outPre = {};
      Object.keys(pre).forEach((k) => { outPre[k] = swapAB(pre[k]); });
      return {
        report: Object.assign({}, r, { winner: flipSide(r.winner), units: (r.units || []).map((u) => Object.assign({}, u, { side: flipSide(u.side) })),
          casualties: (r.casualties || []).map((c) => Object.assign({}, c, { side: flipSide(c.side) })) }),
        pre: outPre, steps: (post.steps || []).map((s) => Object.assign({}, s, { side: flipSide(s.side) }))
      };
    }

    function create(opts) {
      const db = opts.db, notify = opts.notify || function () { }, mailer = opts.mailer || null;
      const opened = opts.listedChanged || function () { };   // the lobby's list of public campaigns changed
      const startBattle = opts.startBattle || null;          // makes a battle (lobby.campaignBattle): its room's code
      const dropBattle = opts.dropBattle || null;            // ...and takes one away again, unplayed (lobby.dropCampaignBattle)
      /* The battles a command has made, while it runs: a battle is made inside the
         command, before the campaign is saved, and if the command then fails or its
         save loses to another (a 409) they go again — no battle left live that no
         campaign points to. */
      let madeNow = null;
      function makeBattle(o) {
        const code = startBattle(o);
        if (madeNow) madeNow.push(code);
        return code;
      }
      const offTable = opts.offTable === undefined ? (root.PMCOffTable || null) : opts.offTable;
      const now = opts.now || Date.now;
      const mailedAt = {};

      const load = (row) => JSON.parse(JSON.stringify(row.state));
      const isWorld = (row) => !!(row && row.kind === 'online' && row.state && row.state.world === 2);
      function save(row, W) {
        return db.saveOnline({ id: row.id, version: row.version, state: W, name: W.name, turn: Math.max(0, ...Object.keys(W.players).map((k) => W.players[k].turn || 0)), at: now() });
      }
      function seat(W, i) {
        const s = W.slots[i], m = db.members(W.id).filter((x) => +x.side === i)[0];
        return { id: 'u' + s.user, pub: m ? m.pub : null, name: s.name };
      }
      function tellAll(id, W, but) {
        W.slots.forEach((s) => { if (s.kind === 'human' && s.user !== but) notify(s.user, { t: 'camp.changed', id: id }); });
      }

      /* ---- whose move it is ----
         'you' (something of theirs to do: found, answer, pick, fight, answer a
         challenge), 'them' (waiting on another player), 'either' (free to take a
         contract or make a challenge), 'lobby', or null (it is over, or they are out). */
      function waitingOn(W, i) {
        if (!W || W.over || W.phase === 'over') return null;
        if (W.phase === 'lobby') return 'lobby';
        if (!playing(W, i)) return null;
        if (!founded(W.forces[i])) return 'you';
        const p = W.players[i] || {};
        if (p.post) return p.post.steps.length && p.post.steps[0].side !== 'A' ? 'them' : 'you';
        if (p.battle || p.contract) return 'you';
        const d = duelOf(W, i);
        if (d) {
          const me = d.a === i ? 'A' : 'B';
          if (d.post) return d.post.steps[0] && d.post.steps[0].side === me ? 'you' : 'them';
          if (d.battle) return 'you';
          const k = d.contract;
          if (k && k.fore && !k.fore.done) return k.fore.order[k.fore.ignored.length] === me ? 'you' : 'them';
          return k && k.ready[me] ? 'them' : 'you';
        }
        if ((W.duels || []).some((x) => x.phase === 'asked' && x.b === i)) return 'you';
        return 'either';
      }
      function waitsNow(id) {
        try {
          const row = db.campaign(id);
          if (!isWorld(row)) return {};
          const W = load(row), out = {};
          W.slots.forEach((s, i) => { if (s.kind === 'human') out[s.user] = { waiting: waitingOn(W, i), name: W.name }; });
          return out;
        } catch (e) { return {}; }
      }
      /* "Your move" by email (an account's choice, off unless turned on): sent when a
         campaign comes to be waiting on a player who did not make the change, at most
         once in ten minutes for each player and campaign. */
      function tellWhoseMove(id, before, actor) {
        if (!mailer) return;
        const after = waitsNow(id);
        Object.keys(after).forEach((uid) => {
          const a = after[uid], b = before[uid];
          if (+uid === actor || a.waiting !== 'you' || (b && b.waiting === 'you')) return;
          const user = db.userById(+uid);
          if (!user || !user.notify || !user.email) return;
          const key = uid + ':' + id, t = now();
          if (mailedAt[key] && t - mailedAt[key] < 10 * 60 * 1000) return;
          mailedAt[key] = t;
          const link = mailer.link ? mailer.link('campaign', id) : '';
          mailer.send({
            to: user.email,
            subject: 'Your move in ' + (a.name || 'your PMC 2670 campaign'),
            text: 'Hello ' + user.name + ',\n\nYour online campaign, ' + (a.name || 'in PMC 2670') + ', is waiting on you.' +
              (link ? '\n\nGo back to it:\n' + link : '') +
              '\n\nYou asked for these emails on your account screen; you can turn them off there.\n\nPMC 2670 — Firefight'
          });
        });
      }

      /* ---- what a player is shown ----
         In the lobby: the slots, the chat, whether they are the host. Under way: the
         world as their single-player campaign (viewOf), with what is only online on
         it — the players, their own contract or duel (the other side's pick kept from
         them until both are ready), the challenges, the aftermath to read. */
      function shownTo(W, i, row) {
        const slots = W.slots.map((s, j) => ({
          kind: s.kind, name: s.kind === 'human' ? s.name : null, colour: s.colour, faction: s.faction, ready: !!s.ready,
          you: j === i, host: j === 0, out: !!s.out, force: W.forces[j] && founded(W.forces[j]) ? W.forces[j].name : null
        }));
        const out = { phase: W.phase, name: W.name, slot: i, host: i === 0, slots: slots, invite: row && W.phase === 'lobby' ? row.invite : null,
          listed: !!(row && row.listed), chat: (W.chat || []).slice(-60), waiting: waitingOn(W, i), over: W.over || null };
        if (W.phase === 'lobby') return out;
        const p = W.players[i] || {};
        const v = viewOf(W, i, p.contract ? p.contract.vs : p.pending ? p.pending.vs : p.post ? p.post.vs : null);
        // the other players' forces after the AI ones, marked, for the hub to show as it shows a rival
        const others = humanSlots(W).filter((j) => j !== i).map((j) => Object.assign({}, W.forces[j], { human: true, slot: j, player: W.slots[j].name, out: !!W.slots[j].out, busy: busy(W, j) }));
        const camp = Object.assign({}, v, { rivals: v.rivals.concat(others), post: p.post || null, pending: p.pending || null });
        camp.online = {
          slot: i,
          contract: p.contract ? Object.assign({}, p.contract) : null,
          battle: p.battle || null,
          after: p.after || null,
          busyAi: aiSlots(W).filter((s) => aiBusy(W, s) && !(p.contract && p.contract.vs === s)).map((s) => aiSlots(W).indexOf(s)),
          challenges: (W.duels || []).filter((d) => d.phase === 'asked' && (d.a === i || d.b === i)).map((d) => ({ id: d.id, from: d.a, to: d.b, mine: d.a === i })),
          duel: null
        };
        const d = duelOf(W, i);
        if (d) {
          const me = d.a === i ? 'A' : 'B', foe = d.a === i ? d.b : d.a;
          camp.online.duel = { id: d.id, side: me, foe: foe, foeName: W.forces[foe].name, player: W.slots[foe].name,
            names: { A: W.forces[d.a].name, B: W.forces[d.b].name },
            contract: Cmds.contractFor(d.contract, me), battle: d.battle || null, post: d.post || null, phase: d.phase };
          // the other player stands as B while the duel is on (the hub, the questions after it)
          camp.facing = camp.rivals.findIndex((r) => r.human && r.slot === foe);
          if (d.post) { camp.post = me === 'A' ? d.post : flipPost(d.post); camp.online.duel.post = camp.post; }
        }
        out.state = camp;
        return out;
      }

      /* ================= the commands ================= */
      const LOBBY = {
        // the host: how many slots (two to ten); only open and AI slots go
        lobbySlots(W, i, a) {
          if (i !== 0) return no('the host sets the slots');
          const n = Math.max(MIN_SLOTS, Math.min(MAX_SLOTS, Math.round(+a.n || 0)));
          while (W.slots.length > n) {
            const last = W.slots[W.slots.length - 1];
            if (last.kind === 'human') return no('a player has that slot: they leave it first');
            W.slots.pop();
          }
          while (W.slots.length < n) W.slots.push({ kind: 'open', user: null, name: null, colour: freeColour(W), faction: 'random', ready: false });
          unreadyAll(W);
          return { ok: true };
        },
        // the host: a slot open for a player, or an AI force
        lobbySlot(W, i, a) {
          if (i !== 0) return no('the host sets the slots');
          const s = W.slots[+a.i];
          if (!s) return no('no such slot');
          if (s.kind === 'human') return no('a player has that slot');
          const kind = a.kind === 'ai' ? 'ai' : 'open';
          s.kind = kind; s.ready = kind === 'ai';
          unreadyAll(W);
          return { ok: true };
        },
        // an army for a slot: the host's for an AI force, a player's own for theirs
        lobbyFaction(W, i, a) {
          const s = W.slots[+a.i];
          if (!s) return no('no such slot');
          if (!(+a.i === i || (i === 0 && s.kind === 'ai'))) return no('not your slot');
          s.faction = FACTIONS.concat(['random']).indexOf(a.faction) >= 0 ? a.faction : 'random';
          if (s.kind === 'human') s.faction = s.faction === 'random' ? 'pmc' : s.faction;
          unreadyAll(W);
          return { ok: true };
        },
        // a colour for a slot, none worn twice
        lobbyColour(W, i, a) {
          const s = W.slots[+a.i];
          if (!s) return no('no such slot');
          if (!(+a.i === i || (i === 0 && s.kind !== 'human'))) return no('not your slot');
          const c = text(a.colour, 20);
          if (P.COLOURS.indexOf(c) < 0) return no('no such colour');
          // a player's colour is theirs; one an AI force (or an open slot) wears is given up, for a new one at random
          const holder = W.slots.findIndex((x, j) => j !== +a.i && x.colour === c);
          if (holder >= 0 && W.slots[holder].kind === 'human') return no('another player wears that colour');
          s.colour = c;
          if (holder >= 0) {
            const free = P.COLOURS.filter((k) => !W.slots.some((x) => x.colour === k));
            W.slots[holder].colour = free.length ? pickOne(free) : null;
          }
          return { ok: true };
        },
        lobbyReady(W, i, a) { W.slots[i].ready = a.ready !== false; return { ok: true }; },
        // the host: listed in Multiplayer for anyone to join, or found by its code only
        lobbyListed(W, i, a, ctx) {
          if (i !== 0) return no('the host decides whether it is listed');
          if (!ctx || !ctx.row) return no('not now');
          db.setListed(ctx.row.id, !!a.on);
          ctx.row.listed = a.on ? 1 : 0;
          return { ok: true, relist: true };
        },
        // the host: the campaign's name, as the lobby list and every player's campaigns show it
        lobbyName(W, i, a) {
          if (i !== 0) return no('the host names the campaign');
          const t = text(a.name, 40);
          if (!t) return no('give it a name');
          W.name = t;
          return { ok: true, relist: true };
        },
        lobbyChat(W, i, a) {
          const t = text(a.text, 300);
          if (!t) return no('say something');
          W.chat = (W.chat || []).concat([{ from: W.slots[i].name, slot: i, text: t, at: now() }]).slice(-100);
          return { ok: true };
        },
        // the host starts it: every slot filled (a player or an AI force), every player ready
        lobbyStart(W, i) {
          if (i !== 0) return no('the host starts the campaign');
          if (W.slots.some((s) => s.kind === 'open')) return no('every slot needs a player or an AI force — or fewer slots');
          if (W.slots.length < MIN_SLOTS) return no('a campaign needs at least two forces');
          const waiting = W.slots.filter((s) => s.kind === 'human' && !s.ready);
          if (waiting.length) return no(waiting.map((s) => s.name).join(', ') + (waiting.length === 1 ? ' is' : ' are') + ' not ready yet');
          begin(W);
          return { ok: true, started: true };
        }
      };
      function freeColour(W) { return P.COLOURS.filter((c) => !W.slots.some((s) => s.colour === c))[0] || 'steel'; }
      function unreadyAll(W) { W.slots.forEach((s) => { if (s.kind === 'human') s.ready = false; }); }
      /* Under way: the AI forces raised (their armies as asked, each its own archetype
         and name), each player's force waiting to be founded, in their colour. */
      function begin(W) {
        const used = {}, names = [];
        W.forces = W.slots.map((s) => {
          if (s.kind === 'ai') {
            const f = s.faction === 'random' ? pickOne(FACTIONS) : s.faction;
            const pool = C.archetypesFor(f).filter((x) => !used[x.id]);
            const arch = pickOne(pool.length ? pool : C.archetypesFor(f));
            used[arch.id] = 1;
            const co = C.newCompany('Rival', { faction: f });
            C.foundRival(co, arch.id, names);
            names.push(co.name);
            co.colour = s.colour;
            return co;
          }
          const co = C.newCompany(s.name + '’s force', { faction: s.faction === 'random' ? 'pmc' : s.faction });
          co.roster = []; co.colour = s.colour;
          return co;
        });
        W.players = {};
        humanSlots(W).forEach((j) => { W.players[j] = { turn: 0, log: [], offers: null, offersTurn: null, contract: null, pending: null, post: null, after: null, afterN: 0, battle: null }; });
        W.phase = 'run';
      }

      // the force's own changes (campcmds.js), on the camp of whatever the player has under way
      const FORCE = ['found', 'recruit', 'disband', 'rename', 'mark', 'renameSoldier', 'promote', 'honour', 'upgrade', 'mount', 'takeDoctrine', 'swapDoctrine', 'promoteCompany', 'aspire', 'colour'];
      function forceCmd(W, i, cmd, a) {
        const co = W.forces[i];
        // the army and the colours are the ones picked in the lobby
        if (cmd === 'found') { a.faction = co.faction; a.colour = co.colour; }
        if (cmd === 'colour') return no('the colours are the ones picked in the lobby');
        if (cmd === 'found' || cmd === 'colour') {
          const name = cmd === 'found' ? text(a.name, 40).toLowerCase() : null;
          const others = W.forces.filter((x, j) => j !== i && x);
          if (name && others.some((x) => founded(x) && (x.name || '').toLowerCase() === name)) return no('another force on this world is called that');
          if (a.colour && others.some((x) => x.colour === a.colour)) return no('another force on this world wears that colour');
        }
        const d = duelOf(W, i), p = W.players[i];
        let camp, side;
        if (d) { camp = pairOf(W, d); side = d.a === i ? 'A' : 'B'; }
        else { camp = { companies: { A: co, B: null }, online: { contract: p.contract }, pending: p.pending }; side = 'A'; }
        const r = Cmds.run(camp, side, cmd, a);
        if (r.ok && cmd === 'found') ensureOffers(W, i);
        return r;
      }

      /* ---- a contract with an AI force: one of the offers taken, terms as it came ---- */
      const AI = {
        aiTake(W, i, a) {
          if (busy(W, i)) return no('something else is under way — finish it first');
          ensureOffers(W, i);
          const p = W.players[i], o = (p.offers || [])[+a.i | 0];
          if (!o) return no('no such contract');
          const vs = aiSlots(W)[o.rival];
          if (vs == null || !W.forces[vs]) return no('that force is gone');
          if (aiBusy(W, vs)) return no(W.forces[vs].name + ' is fighting someone else just now — take another, or try again later');
          const lv = o.levels.filter((n) => n <= 2);
          p.contract = {
            vs: vs, tierRoll: o.tierRoll, tier: o.tier, levels: lv, pl: C.defaultLevel(W.forces[i], W.forces[vs], o.tier, lv),
            scenario: o.scenario, planet: o.planet || 'random', roles: o.roles || null,
            alt: o.alt || null, altRoles: o.altRoles || null, altBy: o.alt ? 'A' : null, altUsed: false,
            fore: o.fore ? JSON.parse(JSON.stringify(o.fore)) : null, foreNote: o.foreNote || null,
            terms: {}, picks: { A: null, B: null }, ready: { A: false, B: true }, turn: p.turn, caught: o.caught || null
          };
          return { ok: true };
        },
        /* A contract with the AI force the player picked (from the other forces): its
           offer this turn if it has one, otherwise one rolled for it now as an offer
           is rolled, and kept with the others. `r`: its place among the AI forces. */
        aiContract(W, i, a) {
          if (busy(W, i)) return no('something else is under way — finish it first');
          const ai = aiSlots(W), vs = ai[+a.r | 0];
          if (vs == null || !W.forces[vs]) return no('no such force');
          if (aiBusy(W, vs)) return no(W.forces[vs].name + ' is fighting someone else just now — try again later');
          ensureOffers(W, i);
          const p = W.players[i];
          p.offers = p.offers || [];
          let at = p.offers.findIndex((o) => ai[o.rival] === vs);
          if (at < 0) {
            const v = viewOf(W, i);
            v.rivals = [W.forces[vs]]; v.companies.B = W.forces[vs]; v.offers = null; v.offersTurn = null;
            const o = C.rollOffers(v)[0];
            o.rival = ai.indexOf(vs);
            p.offers.push(o);
            at = p.offers.length - 1;
          }
          return AI.aiTake(W, i, { i: at });
        },
        // backed out of before the battle: the offers stay as they were (rolled once a turn)
        aiDrop(W, i) {
          const p = W.players[i];
          if (!p.contract) return no('there is no contract');
          if (p.battle || p.pending) return no('the battle has begun');
          p.contract = null;
          return { ok: true };
        },
        // On Our Terms… (p. 87): the Battle Tier one step, once
        aiTerms(W, i, a) {
          const k = W.players[i].contract;
          if (!k) return no('there is no contract');
          if (!C.hasDoctrine(W.forces[i], 'S4')) return no('only On Our Terms… moves the Battle Tier');
          if (k.terms.A !== undefined) return no('you have had your say on the terms');
          const dir = Math.sign(+a.dir || 0);
          k.terms.A = dir;
          const was = k.tier;
          k.tier = Math.max(1, Math.min(k.tierRoll.cap, k.tier + dir));
          if (k.tier !== was) {
            k.levels = C.levelsFor(W.forces[i], W.forces[k.vs], k.tier).filter((n) => n <= 2);
            if (k.levels.indexOf(k.pl) < 0) k.pl = C.defaultLevel(W.forces[i], W.forces[k.vs], k.tier, k.levels);
            k.picks.A = null; k.ready.A = false;
          }
          return { ok: true };
        },
        // Foresighted Command with both holding it: the player sets a die aside; the AI then takes its turn
        aiForego(W, i, a) {
          const k = W.players[i].contract;
          if (!k || !k.fore || k.fore.done) return no('nothing to set aside');
          if (!C.foreIgnore(k, 'A', +a.i, true)) return no('not that one');
          if (k.fore.done) k.roles = SC.rollRoles(k.scenario.id, { A: W.forces[i].doctrines || [], B: W.forces[k.vs].doctrines || [] }, null, ['A']);
          return { ok: true };
        },
        aiForesee(W, i) {
          const k = W.players[i].contract;
          if (!k || !k.alt || k.altUsed || k.altBy !== 'A') return no('there is no other scenario to take');
          const was = k.scenario, wasRoles = k.roles;
          k.scenario = k.alt; k.alt = was; k.altUsed = true;
          k.roles = k.altRoles || SC.rollRoles(k.scenario.id, { A: W.forces[i].doctrines || [], B: W.forces[k.vs].doctrines || [] }, null, ['A']);
          k.altRoles = wasRoles;
          k.picks.A = null; k.ready.A = false;
          return { ok: true };
        },
        aiBestDefence(W, i) {
          const k = W.players[i].contract, bd = k && k.roles && k.roles.bestDefence;
          if (!bd || !bd.pending || bd.side !== 'A') return no('there is nothing to take up');
          SC.bestDefence(k.roles);
          return { ok: true, roll: k.roles.bestDefence.roll, swapped: k.roles.bestDefence.swapped };
        },
        aiLevel(W, i, a) {
          const k = W.players[i].contract;
          if (!k) return no('there is no contract');
          if (a.pl != null) {
            if (k.levels.indexOf(+a.pl) < 0) return no('not a Priority Level on offer');
            if (+a.pl !== k.pl) { k.pl = +a.pl; k.picks.A = null; k.ready.A = false; }
          }
          return { ok: true };
        },
        // the player's force for it, checked as at one screen (campcmds contractPick)
        aiPick(W, i, a) {
          const p = W.players[i], k = p.contract;
          if (!k) return no('there is no contract');
          const camp = { companies: { A: W.forces[i], B: W.forces[k.vs] }, online: { contract: k } };
          const r = Cmds.COMMANDS.contractPick(camp, 'A', a);
          k.ready.B = true;
          return r;
        },
        // ready: the AI's list picked, and the battle made on the server
        aiReady(W, i, a, ctx) {
          const p = W.players[i], k = p.contract;
          if (!k) return no('there is no contract');
          if (a.ready === false) { k.ready.A = false; return { ok: true }; }
          if (!k.picks.A) return no('pick a force first');
          if (k.fore && !k.fore.done) return no('Foresighted Command’s dice are still out');
          // ready once: a second press (or a retry) does not make a second battle
          if (p.battle) return no('the battle is already made — go to it');
          if (!startBattle) return no('this server cannot run battles');
          k.ready.A = true;
          const made = aiBattleConfig(W, i, k);
          p.pending = made.pending;
          made.cfg.onlineCampaign = ctx.id;            // which campaign it is for: a screen that comes back to it any way finds it again
          const code = makeBattle({ campaignId: ctx.id, ref: { kind: 'ai', slot: i }, name: W.forces[i].name + ' v ' + W.forces[k.vs].name,
            cfg: made.cfg, seats: { A: seat(W, i) } });
          p.battle = { code: code, at: now() };
          return { ok: true, battle: code };
        }
      };

      /* ---- a duel: a challenge between two players, accepted, then a contract drawn up ---- */
      const DUEL = {
        duelAsk(W, i, a) {
          const j = +a.to;
          if (j === i || !playing(W, j)) return no('no such player');
          if (!founded(W.forces[i]) || !founded(W.forces[j])) return no('both forces must be founded first');
          if ((W.duels || []).some((d) => (d.a === i && d.b === j) || (d.a === j && d.b === i))) return no('there is a challenge between you already');
          if (busy(W, j)) return no(W.slots[j].name + ' is fighting someone else just now');
          W.duels.push({ id: W.nextDuel++, a: i, b: j, phase: 'asked', at: now(), contract: null });
          return { ok: true };
        },
        duelCancel(W, i, a) {
          const d = (W.duels || []).filter((x) => x.id === +a.id && x.phase === 'asked' && (x.a === i || x.b === i))[0];
          if (!d) return no('no such challenge');
          W.duels = W.duels.filter((x) => x !== d);
          return { ok: true };
        },
        // accepted: both must be free; the contract is drawn up now, between them
        duelAccept(W, i, a) {
          const d = (W.duels || []).filter((x) => x.id === +a.id && x.phase === 'asked' && x.b === i)[0];
          if (!d) return no('no such challenge to you');
          if (busy(W, d.a)) return no(W.slots[d.a].name + ' has something else under way — try again when it is done');
          if (busy(W, i)) return no('finish what you have under way first');
          const camp = pairOf(W, d);
          const r = Cmds.COMMANDS.contractBegin(camp, 'A', {});
          if (!r.ok) return r;
          d.contract = camp.online.contract;
          d.phase = 'contract';
          // the challenges either had out wait until this is done
          return { ok: true };
        },
        // a contract called off before the battle, by either: back to how it was
        duelOff(W, i) {
          const d = duelOf(W, i);
          if (!d || d.phase !== 'contract') return no('there is no contract to call off');
          W.duels = W.duels.filter((x) => x !== d);
          return { ok: true };
        },
        // the contract's own steps (campcmds.js), each player's on their own side of it
        duel(W, i, a, ctx) {
          const d = duelOf(W, i);
          if (!d || d.phase !== 'contract') return no('there is no contract between you');
          const sub = String(a.cmd || '');
          if (['contractTerms', 'contractForego', 'contractForesee', 'contractBestDefence', 'contractLevel', 'contractPick', 'contractReady'].indexOf(sub) < 0) return no('no such step');
          const side = d.a === i ? 'A' : 'B', camp = pairOf(W, d);
          const r = Cmds.run(camp, side, sub, a.args || {});
          if (!r.ok) return r;
          d.contract = camp.online.contract;
          if (sub === 'contractReady' && r.both) {
            if (d.battle) return no('the battle is already made — go to it');
            if (!startBattle) return no('this server cannot run battles');
            const made = duelBattleConfig(W, d);
            d.pending = made.pending;
            made.cfg.onlineCampaign = ctx.id;
            const code = makeBattle({ campaignId: ctx.id, ref: { kind: 'duel', id: d.id }, name: W.forces[d.a].name + ' v ' + W.forces[d.b].name,
              cfg: made.cfg, seats: { A: seat(W, d.a), B: seat(W, d.b) } });
            d.battle = { code: code, at: now() };
            d.phase = 'battle';
            r.battle = code;
            r.battleFor = [d.a, d.b];
          }
          return r;
        }
      };

      /* ---- after a battle: the questions, each put to its own player, then the aftermath ---- */
      function finishAi(W, i, v) {
        const p = W.players[i], post = p.post;
        v.post = post;
        // the other AI forces' battles are handed back, to be fought out on a table nobody sees (fronts, below)
        const after = C.aftermath(v, post.report, Object.assign(preOpts(post), { defer: true }));
        after.rival = C.developRival(v.companies.B);
        after.loss = lossOf(post.report);
        const pairs = (after.pairs || []).map((pr) => [v.rivalSlots[pr[0]], pr[1] == null ? null : v.rivalSlots[pr[1]]]);
        const keep = { turn: after.turn, winner: after.winner, payment: after.payment, loss: after.loss, sides: { A: after.sides.A, B: after.sides.B || null },
          rival: after.rival || null, fronts: null, elsewhere: [], frontsLeft: pairs.length };
        const last = v.log[v.log.length - 1];
        if (last && last.turn === after.turn) { last.after = JSON.parse(JSON.stringify(keep)); last.balance = v.companies.A.kUC; }
        v.offers = null; v.offersTurn = null;
        keepView(W, i, v);
        p.after = Object.assign(JSON.parse(JSON.stringify(keep)), { n: (p.afterN = (p.afterN || 0) + 1) });
        p.post = null; p.pending = null; p.contract = null; p.battle = null;
        if (pairs.length) {
          W.fronts = (W.fronts || []).concat([{ slot: i, n: p.after.n, turn: after.turn, pairs: pairs, planet: post.report.planet || null }]);
          W.frontsDue = true;
        }
        ensureOffers(W, i);
      }
      function finishDuel(W, d) {
        const camp = pairOf(W, d), post = d.post;
        camp.post = post;
        const pa = W.players[d.a], pb = W.players[d.b];
        camp.turn = pa.turn || 0;
        const after = C.aftermath(camp, post.report, preOpts(post));
        after.loss = lossOf(post.report);
        const keep = { winner: after.winner, payment: after.payment, loss: after.loss, sides: { A: after.sides.A, B: after.sides.B }, rival: null, fronts: null, elsewhere: [] };
        const entry = camp.log[camp.log.length - 1] || { scenario: post.report.scenario, tier: post.report.battleTier, pl: post.report.pl, winner: post.report.winner, kUC: {} };
        [[d.a, pa, false], [d.b, pb, true]].forEach((t) => {
          const j = t[0], pl = t[1], turned = t[2];
          const mine = turned ? flip(keep) : JSON.parse(JSON.stringify(keep));
          pl.turn = (pl.turn || 0) + 1;
          mine.turn = pl.turn;
          const e = Object.assign({}, turned ? flip(entry) : entry, { turn: pl.turn, against: W.forces[turned ? d.a : d.b].name, after: JSON.parse(JSON.stringify(mine)), balance: W.forces[j].kUC, duel: true });
          pl.log = (pl.log || []).concat([e]).slice(-40);
          pl.after = Object.assign(mine, { n: (pl.afterN = (pl.afterN || 0) + 1), side: turned ? 'B' : 'A' });
          pl.offers = null; pl.offersTurn = null;
        });
        W.duels = W.duels.filter((x) => x !== d);
        ensureOffers(W, d.a); ensureOffers(W, d.b);
      }
      // a question answered by the player it is put to (dossier.js: plunder, negotiate, data-weak, postnext)
      function answer(camp, side, cmd, a) {
        const post = camp.post, st = post && post.steps[0];
        if (!st) return no('there is no question to answer');
        if (st.side !== side) return no('waiting for the other player’s answer');
        const pre = post.pre;
        if (cmd === 'postPlunder') {
          if (st.kind !== 'plunder' || (pre.plunder[side] && pre.plunder[side].now)) return no('not now');
          const was = pre.dice[side];
          pre.dice[side] = C.rollPayment(post.report.battleTier, post.report.pl);
          pre.plunder[side] = { was: was.slice(), now: pre.dice[side].slice() };
          return { ok: true };
        }
        if (cmd === 'postNegotiate') {
          if (st.kind !== 'negotiate' || pre.neg[side]) return no('not now');
          const dice = pre.dice[side].slice(), cap = Math.ceil(dice.length / 2);
          const sel = Array.from(new Set((Array.isArray(a.sel) ? a.sel : []).map(Number))).filter((n) => n >= 0 && n < dice.length).slice(0, cap);
          if (!sel.length) return no('pick the dice to roll again');
          const sw = sel.map((n) => { const was = dice[n]; dice[n] = 1 + Math.floor(Math.random() * 6); return { was: was, now: dice[n] }; });
          pre.dice[side] = dice;
          pre.neg[side] = { dice: dice.slice(), swapped: sw, idx: sel };
          return { ok: true };
        }
        if (cmd === 'postWeak') {
          if (st.kind !== 'weak') return no('not now');
          const cand = C.weakCandidates(camp, side, pre.tp[side] || {}).map((e) => e.rid);
          if (a.choice && cand.indexOf(String(a.choice)) < 0) return no('that unit is not one of those to choose from');
          pre.weak[side] = a.choice ? String(a.choice) : false;
          post.steps.shift();
        } else if (cmd === 'postNext') {
          if (st.kind === 'weak') return no('say who is executed, or spare them');
          post.steps.shift();
        } else return no('no such command');
        return { ok: true, step: true };
      }
      function postCmd(W, i, cmd, a) {
        const p = W.players[i];
        // Enhanced Genetic Memory: a lost unit recruited again, its D6 rolled here
        if (cmd === 'postReborn') {
          const rec = p.after && p.after.sides && p.after.sides.A;
          const offer = rec && rec.rebornOffer && rec.rebornOffer[+a.i];
          if (!offer) return no('no such unit to bring back');
          if (offer.done) return no('that unit has been brought back already');
          const rr = C.rebirth(W.forces[i], offer);
          if (rr.ok) {
            offer.done = rr;
            const last = (p.log || [])[p.log.length - 1];
            const lo = last && last.after && last.after.sides && last.after.sides.A && last.after.sides.A.rebornOffer;
            if (lo && lo[+a.i]) lo[+a.i].done = rr;
          }
          return rr;
        }
        if (p.post) {
          const v = afterView(W, i, p.post.vs);
          v.post = p.post;
          const r = answer(v, 'A', cmd, a);
          if (r.ok && r.step && prepPost(v)) finishAi(W, i, v);
          return r;
        }
        const d = duelOf(W, i);
        if (d && d.post) {
          const camp = pairOf(W, d);
          camp.post = d.post;
          const r = answer(camp, d.a === i ? 'A' : 'B', cmd, a);
          if (r.ok && r.step && prepPost(camp)) finishDuel(W, d);
          return r;
        }
        return no('there is no question to answer');
      }

      // a player stepping out of the world (giving it up, or a force that can no longer fight)
      function retire(W, i, why) {
        const s = W.slots[i];
        if (s.out) return no('you are out of this campaign already');
        if (busy(W, i) && (W.players[i].battle || (duelOf(W, i) || {}).battle)) return no('a battle is being fought — finish it, or walk away from it, first');
        s.out = { turn: (W.players[i] || {}).turn || 0, why: why };
        W.players[i].contract = null;
        W.duels = W.duels.filter((d) => !(d.a === i || d.b === i) || d.phase === 'battle');
        const left = humanSlots(W).filter((j) => playing(W, j));
        if (!left.length) { W.phase = 'over'; W.over = { text: 'Every player has left the world.' }; }
        return { ok: true };
      }

      function runCmd(W, i, cmd, a, ctx) {
        if (W.phase === 'lobby') {
          if (!Object.prototype.hasOwnProperty.call(LOBBY, cmd)) return no('the campaign has not started yet');
          return LOBBY[cmd](W, i, a || {}, ctx);
        }
        if (W.phase === 'over') return no('the campaign is over');
        if (cmd === 'lobbyChat') return LOBBY.lobbyChat(W, i, a || {});
        if (!playing(W, i)) return no('you are out of this campaign');
        if (FORCE.indexOf(cmd) >= 0) return forceCmd(W, i, cmd, a || {});
        if (Object.prototype.hasOwnProperty.call(AI, cmd)) return AI[cmd](W, i, a || {}, ctx);
        if (Object.prototype.hasOwnProperty.call(DUEL, cmd)) return DUEL[cmd](W, i, a || {}, ctx);
        if (/^post/.test(cmd)) return postCmd(W, i, cmd, a || {});
        if (cmd === 'concede') return retire(W, i, 'gave it up');
        if (cmd === 'campEnd') {
          if (!C.cannotFight(W.forces[i])) return no(W.forces[i].name + ' can still field an army');
          return retire(W, i, 'could no longer field an army');
        }
        return no('no such command');
      }

      /* ================= elsewhere on the world =================
         While the players count the cost of a battle with an AI force, the other AI
         forces fight each other two by two — each battle played out in full by the AI
         on both sides on a table nobody sees (engine/offtable.js), a slice at a time
         so the server keeps answering everyone else meanwhile — and each is settled
         like any battle as it ends, its report added to that player's aftermath. The
         forces in one are not offered to anyone until it is over. Kept on the world
         (W.fronts), so a restart picks up where it was. */
      const running = new Set();
      let idleWaiters = [];
      function runFronts(id) {
        if (running.has(id)) return;
        running.add(id);
        const done = () => { running.delete(id); if (!running.size) idleWaiters.splice(0).forEach((r) => r()); };
        const next = () => {
          let row;
          try { row = db.campaign(id); } catch (e) { row = null; }
          if (!isWorld(row)) return done();
          const W = load(row), f = (W.fronts || [])[0];
          if (!f) return done();
          const pr = f.pairs[0];
          const x = W.forces[pr[0]] ? JSON.parse(JSON.stringify(W.forces[pr[0]])) : null;
          const y = pr[1] != null && W.forces[pr[1]] ? JSON.parse(JSON.stringify(W.forces[pr[1]])) : null;
          const settle = (rep) => {
            try { settleFront(id, f, pr, x, y, rep); } catch (e) { /* a front that cannot be settled is let go below */ }
            setTimeout(next, 0);
          };
          // the odd one out fights the locals, and that is rolled
          if (!x || !y || !offTable) return settle(null);
          try { offTable.play(x, y, { planet: f.planet || 'random' }, settle); } catch (e) { settle(null); }
        };
        setTimeout(next, 0);
      }
      function settleFront(id, f0, pr, x, y, rep) {
        let ok = false, W = null;
        db.transaction(() => {
          const row = db.campaign(id);
          if (!isWorld(row)) return;
          W = load(row);
          const f = (W.fronts || []).filter((q) => q.n === f0.n && q.slot === f0.slot)[0];
          if (!f || !f.pairs.length || f.pairs[0][0] !== pr[0]) return;
          let out = [];
          if (x) {
            try { out = C.battleElsewhere({ turn: f.turn }, x, y, rep || null); } catch (e) { out = []; }
            W.forces[pr[0]] = x;
            if (y) W.forces[pr[1]] = y;
          }
          f.pairs.shift();
          if (!f.pairs.length) W.fronts = W.fronts.filter((q) => q !== f);
          // the battle's report goes on the aftermath of the player whose battle it followed
          const p = W.players[f.slot];
          if (p) {
            if (p.after && p.after.n === f.n) { p.after.elsewhere = (p.after.elsewhere || []).concat(out); p.after.frontsLeft = f.pairs.length; }
            const e = (p.log || []).filter((l) => l.after && l.turn === f.turn)[0];
            if (e) { e.after.elsewhere = (e.after.elsewhere || []).concat(out); e.after.frontsLeft = f.pairs.length; }
          }
          ok = save(row, W);
        });
        if (ok) tellAll(id, W, null);
      }

      return {
        // the battles elsewhere left half-fought by a restart: picked up again
        resumeFronts() {
          let n = 0;
          (db.allCampaigns(1000) || []).forEach((c) => {
            if (c.kind !== 'online') return;
            try { const row = db.campaign(c.id); if (isWorld(row) && (row.state.fronts || []).length) { runFronts(c.id); n++; } } catch (e) { }
          });
          return n;
        },
        // (the tests) resolves once no battle elsewhere is being fought
        idle() { return running.size ? new Promise((r) => idleWaiters.push(r)) : Promise.resolve(); },

        /* A new campaign, in its lobby: the player who makes it is the host, in the
           first slot, and is given the code that brings the others in. */
        make(me, how) {
          if (!me || me.guest) return no('sign in to play a campaign online', 401);
          const listed = !!(how && how.listed);
          const W = newWorld(me);
          let id, code;
          db.transaction(() => {
            id = db.addCampaign({ owner: me.userId, kind: 'online', name: W.name, turn: 0, state: W, at: now() });
            db.addMember(id, me.userId, '0', now());
            for (let tries = 0; tries < 20; tries++) {
              code = inviteCode();
              try { db.setInvite(id, code); break; } catch (e) { code = null; }
            }
            if (listed) db.setListed(id, true);
          });
          if (listed) opened();
          return { ok: true, id: id, invite: code, slot: 0, listed: listed };
        },

        // a player coming in, with the code or from the list: the first open slot, while it is still in its lobby
        join(me, code) {
          if (!me || me.guest) return no('sign in to play a campaign online', 401);
          const row = db.byInvite(String(code || '').trim().toUpperCase());
          if (!isWorld(row)) return no('no campaign with that code', 404);
          const W = load(row);
          const have = slotOf(W, me.userId);
          if (have >= 0) return { ok: true, id: row.id, slot: have };
          if (W.phase !== 'lobby') return no('that campaign is under way — players join before it starts', 409);
          const at = W.slots.findIndex((s) => s.kind === 'open');
          if (at < 0) return no('that campaign has no open slot', 409);
          const fac = W.slots[at].faction;
          W.slots[at] = { kind: 'human', user: me.userId, name: me.name, colour: W.slots[at].colour, faction: fac === 'random' ? 'pmc' : fac, ready: false };
          let ok = false;
          db.transaction(() => {
            db.addMember(row.id, me.userId, String(at), now());
            ok = save(row, W);
          });
          if (!ok) return no('the campaign changed meanwhile — try again', 409);
          tellAll(row.id, W, me.userId);
          if (row.listed) opened();
          return { ok: true, id: row.id, slot: at };
        },

        // leaving a campaign still in its lobby: the slot opens again; the host leaving closes it
        leave(me, id) {
          const row = db.campaign(id);
          if (!isWorld(row)) return no('no such campaign', 404);
          const W = load(row), i = slotOf(W, me && me.userId);
          if (i < 0) return no('no such campaign of yours', 404);
          if (W.phase !== 'lobby') return no('the campaign is under way — give it up from the campaign instead');
          if (i === 0) {
            db.dropAnyCampaign(row.id);
            W.slots.forEach((s) => { if (s.kind === 'human' && s.user !== me.userId) notify(s.user, { t: 'camp.closed', id: row.id }); });
            if (row.listed) opened();
            return { ok: true, closed: true };
          }
          W.slots[i] = { kind: 'open', user: null, name: null, colour: W.slots[i].colour, faction: 'random', ready: false };
          db.transaction(() => { db.dropMember(row.id, me.userId); save(row, W); });
          tellAll(row.id, W, me.userId);
          if (row.listed) opened();
          return { ok: true };
        },

        // the public campaigns still in their lobby with a slot open, for the Multiplayer list
        listed() {
          return db.listedOpen(20).map((r) => {
            let W = null;
            try { W = typeof r.state === 'string' ? JSON.parse(r.state) : r.state; } catch (e) { W = null; }
            if (!W || W.world !== 2 || W.phase !== 'lobby') return null;
            const open = W.slots.filter((s) => s.kind === 'open').length;
            if (!open) return null;
            return { invite: r.invite, owner: r.owner, at: r.updated, slots: W.slots.length, open: open };
          }).filter(Boolean);
        },

        // the player's online campaigns, the latest first, each with whose move it is
        list(me) {
          if (!me || me.guest) return [];
          return db.onlineOf(me.userId).map((r) => {
            let W = null;
            try { W = JSON.parse(r.state); } catch (e) { W = null; }
            if (!W || W.world !== 2) return null;
            const i = slotOf(W, me.userId);
            return { id: r.id, name: r.name, turn: ((W.players || {})[i] || {}).turn || 0, version: r.version, updated: r.updated, slot: i,
              phase: W.phase, players: humanSlots(W).length, forces: W.slots.length, waiting: waitingOn(W, i) };
          }).filter(Boolean);
        },

        view(me, id) {
          if (!me || me.guest) return no('sign in to play a campaign online', 401);
          const row = db.campaign(id);
          if (!isWorld(row)) return no('no such campaign of yours', 404);
          let W = load(row);
          const i = slotOf(W, me.userId);
          if (i < 0) return no('no such campaign of yours', 404);
          // the offers rolled for a player free to take one, if they have none for this turn yet
          if (W.phase === 'run' && W.players[i] && !(W.players[i].offers && W.players[i].offersTurn === W.players[i].turn) && founded(W.forces[i]) && !busy(W, i)) {
            db.transaction(() => {
              const fresh = db.campaign(id), W2 = load(fresh);
              ensureOffers(W2, i);
              if (save(fresh, W2)) { W = W2; row.version = fresh.version + 1; }
            });
          }
          return Object.assign({ ok: true, id: row.id, version: row.version }, shownTo(W, i, row));
        },

        /* A command from one of its players, run with the campaign's rules on the
           world as it stands, and kept; the others are told. One at a time, each over
           the version the last one left. */
        command(me, id, cmd, args) {
          if (!me || me.guest) return no('sign in to play a campaign online', 401);
          let out = null, W = null;
          const before = mailer ? waitsNow(id) : {};
          madeNow = [];
          db.transaction(() => {
            const row = db.campaign(id);
            if (!isWorld(row)) { out = no('no such campaign of yours', 404); return; }
            W = load(row);
            W.id = row.id;
            const i = slotOf(W, me.userId);
            if (i < 0) { out = no('no such campaign of yours', 404); return; }
            const r = runCmd(W, i, String(cmd || ''), args || {}, { id: row.id, row: row });
            if (!r.ok) { out = Object.assign({ code: 400 }, r); return; }
            delete W.id;
            if (!save(row, W)) { out = no('the campaign changed meanwhile — try again', 409); return; }
            row.version += 1;
            out = Object.assign({}, r, { version: row.version }, shownTo(W, i, row));
          });
          // a battle made by a command that did not stand (refused, or its save lost) goes again
          const made = madeNow; madeNow = null;
          if (!out.ok && dropBattle) made.forEach((code) => { try { dropBattle(code); } catch (e) { } });
          if (out.ok) {
            tellAll(id, W, me.userId);
            if (out.battle) {
              (out.battleFor || [slotOf(W, me.userId)]).forEach((j) => { const s = W.slots[j]; if (s) notify(s.user, { t: 'camp.battle', id: id, code: out.battle }); });
            }
            if (out.started) {
              const row = db.campaign(id);
              if (row && row.listed) { db.setListed(id, false); opened(); }
            }
            if (cmd === 'lobbySlot' || cmd === 'lobbySlots' || out.relist) opened();
            if ((W.fronts || []).length) runFronts(id);
            tellWhoseMove(id, before, me.userId);
          }
          return out;
        },

        /* A battle is over (lobby.js finished): its aftermath applied once, by the
           battle's id — its questions put to their players — and everyone told.
           `ref`: which of the world's battles it was ({ kind: 'ai', slot } or { kind: 'duel', id }). */
        battleOver(id, report, gameId, ref) {
          let done = false, W = null;
          const before = mailer ? waitsNow(id) : {};
          db.transaction(() => {
            const row = db.campaign(id);
            if (!isWorld(row) || !ref) return;
            W = load(row);
            W.applied = W.applied || [];
            if (gameId != null && W.applied.indexOf(gameId) >= 0) return;
            if (ref.kind === 'ai') {
              const i = +ref.slot, p = W.players[i];
              if (!p || !p.pending) return;
              report.battleTier = p.pending.tier; report.pl = p.pending.pl; report.scenario = p.pending.scenario;
              const v = afterView(W, i, p.pending.vs);
              C.clearOffers(v);
              keepView(W, i, v);
              const inc = C.rollIncome(report.battleTier, report.pl, v.companies.A, v.companies.B, report.winner, ['A']);
              p.post = { report: report, vs: p.pending.vs, pre: { dice: inc.dice, plunder: inc.plunder, neg: inc.neg, tp: {}, weak: {}, askReborn: { A: true } }, steps: postSteps(v, report, ['A']) };
              p.battle = null;
              v.post = p.post;
              if (prepPost(v)) finishAi(W, i, v);
            } else if (ref.kind === 'duel') {
              const d = (W.duels || []).filter((x) => x.id === +ref.id)[0];
              if (!d || !d.pending) return;
              report.battleTier = d.pending.tier; report.pl = d.pending.pl; report.scenario = d.pending.scenario;
              const camp = pairOf(W, d);
              const inc = C.rollIncome(report.battleTier, report.pl, camp.companies.A, camp.companies.B, report.winner, ['A', 'B']);
              d.post = { report: report, pre: { dice: inc.dice, plunder: inc.plunder, neg: inc.neg, tp: {}, weak: {}, askReborn: { A: true, B: true } }, steps: postSteps(camp, report, ['A', 'B']) };
              d.battle = null; d.phase = 'post';
              camp.post = d.post;
              if (prepPost(camp)) finishDuel(W, d);
            } else return;
            if (gameId != null) W.applied = W.applied.concat([gameId]).slice(-100);
            done = save(row, W);
          });
          if (done) { tellAll(id, W, null); tellWhoseMove(id, before, null); if ((W.fronts || []).length) runFronts(id); }
          return done;
        }
      };
    }

    return { create: create, newWorld: newWorld };
  })();
  if (typeof module !== 'undefined' && module.exports) module.exports = root.PMCWorld;
})(typeof window !== 'undefined' ? window : global);
