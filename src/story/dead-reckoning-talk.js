/* PMC 2670 — Firefight : what is said in Dead Reckoning (docs/story-dead-reckoning-plan.md, phase 3)

   As Deep Contract's talk (deep-contract-talk.js): the conversations that open
   the story's pages, keyed by the node they open; what is said in its
   battles, by the battle's own lines first and the enemy side's otherwise
   (story.js talkFor), at the moments the battle names (start, turn3, kill,
   loss, bhalf, ahalf, wave, parley, target, sighted, searched, found, guard);
   and the hired companies' voices when they fight beside the company. The
   Xenotripods speak through Mental Projection: their lines are in brackets,
   in every head at once.

   Written in full for the first half (chapters 1 to 4, both one-offs). The
   second half's voices come in phase 5. */
(function (root) {
  'use strict';
  root.PMCStoryTalk = root.PMCStoryTalk || {};

  root.PMCStoryTalk['dead-reckoning'] = {
    // the voices heard on the trail, beside the story's people
    people: {
      reader: { name: 'Halloran', role: 'Vane’s chief reader', face: { bg: '#9a8ab9', skin: '#e2b48f', hair: '#bdbdbd', hairStyle: 'short', clothes: '#3a3248', clothesStyle: 'suit', accent: '#c8a040', extras: ['glasses', 'beard'] } },
      kettleman: { name: 'A Coin & Kettle hand', role: 'Coin & Kettle', face: { bg: '#c9a65a', skin: '#a8754f', hair: '#3a2a20', hat: 'beanie', hatColour: '#5a4a3a', clothes: '#5a4a3a', clothesStyle: 'jacket', accent: '#e0b070', extras: ['stubble'] } },
      scav: { name: 'Mags', role: 'The Thule scavengers', face: { bg: '#7a9ab0', skin: '#d8a682', hair: '#c8c8c8', hairStyle: 'long', hat: 'beanie', hatColour: '#3a4a5a', clothes: '#4a4a52', clothesStyle: 'jacket', accent: '#e07a3a', extras: ['scar', 'earring'] } },
      shkar: { name: 'The Sh’kar', role: 'Xenotripods, the beacon’s keepers', face: { tripod: true, bg: '#1e3a3a', shell: '#9ab8a8', glow: '#7ae0c8' } },
      mithdu: { name: 'The Mithdu', role: 'Xenotripods, under the rock', face: { tripod: true, bg: '#2a2418', shell: '#a89870', glow: '#e0a040' } },
      lancer: { name: 'A Lance trooper', role: 'The Ninth Lance', face: { bg: '#5a4a7a', skin: '#c99a76', hair: '#222', hat: 'visor', hatColour: '#2a2238', clothes: '#2a2238', clothesStyle: 'armour', accent: '#c8a040' } }
    },

    /* Conversations on the story's own pages, before the page's text: keyed by
       the node they open. `commander` is the company's own commander, named. */
    conversations: {
      // ---- 1. Lot 47 ----
      'c1.brief': [
        { who: 'vane', text: 'You’ll be {commander:rank}. Ottilie Vane. I’ve read your company’s file, and I don’t mind it. That’s rarer than you’d think.' },
        { who: 'commander', text: 'Your agent said an auction. He didn’t say why an auction needs a company.' },
        { who: 'vane', text: 'Because everyone else in that room has brought one. Lot 47 is a dead man’s log, {commander:rank}, and the dead man found something nobody else ever has.' },
        { who: 'reader', text: 'Elias Morrow. Surveyor. He wrote in dead reckoning: headings and burn times, no fixes. Without his stones it’s gibberish. With them, it’s a road.' },
        { who: 'vane', text: 'A road to a world he called the Quiet. Halloran thinks it’s a Xenotripod home world. I think Halloran is being modest.' },
        { who: 'commander', text: 'And the companies in that room?' },
        { who: 'vane', text: 'Want the road. I want you to see that I leave with it. After that, we follow it together, and whoever files the first claim at the end owns everything there. Shall we go in?' }
      ],
      'c1.agent': [
        { who: 'kettering', text: 'You have one of mine, I hear. Young lad, nervous. Don’t hurt him, there’s a good soldier. He’s only staff.' },
        { who: 'commander', text: 'Your staff tried to take the log off my employer in the street.' },
        { who: 'kettering', text: 'And you stopped them, very professionally. No hard feelings: this week somebody paid me to try. Next week, who knows? Maybe it’ll be you.' }
      ],

      // ---- 2. The First Lodestone ----
      'c2.brief': [
        { who: 'reader', text: 'Two readings, {commander:rank}. Both fit the burn times. One puts him on Vantor III, on the Glass Flats. The other at Station Thule.' },
        { who: 'vane', text: 'Somebody will be at whichever one we don’t choose. Somebody may be at both.' },
        { who: 'commander', text: 'What’s at Thule?' },
        { who: 'reader', text: 'A survey relay. Morrow stopped there for three days. Nobody stops at a relay for three days unless something is wrong, or something is right.' },
        { who: 'vane', text: 'And the Flats is where he dug. Your choice, {commander:rank}. You’re the one who has to dig.' }
      ],
      'c2f.dig': [
        { who: 'ops', text: 'Tents by the dig. A mast. No sentries I can see, which means they’re there and I can’t see them.' },
        { who: 'nine', text: 'Company on the flats. This is Nine. We read your copy. It was very kind of you to leave it lying about.' },
        { who: 'commander', text: 'The dig is Vane’s, Nine. Pack up and go home.' },
        { who: 'nine', text: 'Nobody owns a dig until something comes out of it. Come and find out what’s in the ground, if you like. We’ll be watching.' }
      ],
      'c2t.airlock': [
        { who: 'ops', text: 'Main lock is welded. Somebody’s inside, and they’ve been inside a while: there’s a cooking vent on the north side.' },
        { who: 'scav', text: 'You’re on our pad, ship. Thule’s taken. Find your own rock.' },
        { who: 'commander', text: 'We want three days of a dead man’s records. Then we leave.' },
        { who: 'scav', text: 'Everything in this station is ours, records included. Make an offer, or make a hole. We don’t care which.' }
      ],

      // ---- 3. The Drowned Beacon ----
      'c3.brief': [
        { who: 'ops', text: 'Fog’s too thick for the drones. Motion everywhere, then nothing. They stopped when we landed.' },
        { who: 'commander', text: 'Stopped, or stopped where we can see them?' },
        { who: 'ops', text: 'Stopped. All of them. At once. Like somebody told them to.' },
        { who: 'reader', text: 'Morrow’s entry for this world is one line: “They let me in. I don’t know why. I took the stone and they watched me take it.”' },
        { who: 'shkar', text: '[a pressure behind the eyes, like a hand on the back of the neck: you are seen]' }
      ],
      'c3.contact': [
        { who: 'ops', text: 'Contact. Three of them, in the water by the spire. Big. Not moving.' },
        { who: 'shkar', text: '[the fog thins around them, as if to let you look. It is not a welcome]' },
        { who: 'commander', text: 'Nobody fires. Nobody so much as raises a muzzle until I say.' }
      ],

      // ---- 4. The Broker ----
      'c4.brief': [
        { who: 'kettering', text: 'Welcome to Kerrigan, {commander:rank}. You’ll want my broker. Everyone wants my broker this week.' },
        { who: 'agathe', text: 'The heading is in my warehouse. My warehouse has my tanks in front of it. That is the whole of the auction.' },
        { who: 'commander', text: 'You bought the building to stop the sale?' },
        { who: 'agathe', text: 'I bought the building because it is easier to hold a thing than to win it. Pay the broker, or take it from me. I would rather you tried the second. It will save me a great deal of conversation.' }
      ],

      // ---- Into the Warren ----
      'warren.brief': [
        { who: 'ops', text: 'Rad counters are ticking. Not bad. Not good. Air’s breathable, if you like the taste of pennies.' },
        { who: 'commander', text: 'Where are we?' },
        { who: 'ops', text: 'Navigation says nowhere. No stars to fix on through the rock. We are, technically, lost.' },
        { who: 'mithdu', text: '[something old turns its attention to you, slowly, the way a sleeper turns over]' }
      ],

      // ---- The Double-Cross ----
      'dx.brief': [
        { who: 'daw', text: 'Commander Iselin Daw, the Ninth Lance. You’ll have heard of us. You won’t have heard that we work for Ottilie Vane, because she doesn’t tell people.' },
        { who: 'commander', text: 'She didn’t tell me.' },
        { who: 'daw', text: 'No. She thought you’d stay bought. You haven’t, or she thinks you haven’t, which comes to the same thing on a court order.' },
        { who: 'commander', text: 'And if I hand you the log?' },
        { who: 'daw', text: 'Then you go home with your pay to date, and nobody on either deck gets hurt. I’d take it, {commander:rank}. I’m very good at what happens otherwise.' }
      ]
    },

    // the hired companies, when they fight beside the company (story.js allyVoice)
    allies: {
      kettle: { who: 'kettering',
        report: ['Coin & Kettle, as contracted. Lots of us, cheap. Point us at something.', 'Kettle’s lads on your flank, {commander:rank}. Paid up and ready.'],
        move: ['Moving, moving. Mind the invoice.', 'On our way.'],
        attack: ['Right, lads, earn it!', 'Going in. Hazard pay, mind.'],
        hold: ['We’ll sit tight. Sitting tight’s cheaper.', 'Holding.'],
        clear: ['Our own judgement, then. Always costs extra.'] },
      kestrel: { who: 'rook',
        report: ['Kestrel’s up. Cameras rolling, guns hot. Try to look good, {name}.'],
        move: ['Repositioning. Better angle anyway.', 'Moving.'],
        attack: ['Kestrel, going in! Get the shot!', 'Engaging.'],
        hold: ['We’ll hold. Not our favourite thing.', 'Holding.'],
        clear: ['Free hand. Now we’re talking.'] },
      reavers: { who: 'hal',
        report: ['Reavers are here. Don’t ask what we charge for the mess.'],
        move: ['Moving.', 'Right, boys, shift.'],
        attack: ['Boarders away!', 'About time.'],
        hold: ['Holding. Boring.', 'We’ll hold.'],
        clear: ['Our way, then.'] },
      sable: { who: 'agathe',
        report: ['Sable Armour Group, as owed. We do not run. Plan accordingly.'],
        move: ['Advancing. Slowly.', 'Moving.'],
        attack: ['Sable, forward.', 'Engaging.'],
        hold: ['Holding. This is what we are for.', 'We hold.'],
        clear: ['We will hold what we stand on.'] }
    },

    // what each enemy side says, where a battle has nothing of its own for the moment
    sides: {
      kettle: {
        start: [{ who: 'kettleman', text: 'There they are! Five hundred to whoever brings back the slate!' }],
        kill: [{ who: 'kettleman', text: 'Man down! That wasn’t in the contract!' }],
        loss: [{ who: 'kettleman', text: 'Got one! That’s a bonus, that is!' }],
        bhalf: [{ who: 'kettleman', text: 'It’s not worth it, lads, it’s not worth it! Fall back!' }]
      },
      wraith: {
        start: [{ who: 'nine', text: 'All Wraith units: they come to us. Nobody shows themselves.' }],
        kill: [{ who: 'nine', text: 'Nine to all. We lost one. Stay off the open glass.' }],
        loss: [{ who: 'nine', text: 'One down. Next.' }],
        bhalf: [{ who: 'nine', text: 'Wraith, break contact. We’ve seen enough.' }]
      },
      sable: {
        start: [{ who: 'agathe', text: 'Sable Armour Group holds. Let them come.' }],
        kill: [{ who: 'agathe', text: 'A hull lost. Close the gap. Nobody steps back.' }],
        bhalf: [{ who: 'agathe', text: 'We are not finished while one of us is standing in that warehouse.' }]
      },
      scavengers: {
        start: [{ who: 'scav', text: 'Lights out, everyone. They don’t know the station. We do.' }],
        kill: [{ who: 'scav', text: 'They got Pell! Make them pay for Pell!' }],
        bhalf: [{ who: 'scav', text: 'Grab what you can carry and get to the hatch!' }]
      },
      shkar: {
        start: [{ who: 'shkar', text: '[a single word, in every head at once, like a door shutting: no]' }],
        kill: [{ who: 'shkar', text: '[grief, sharp and sudden, and not yours]' }],
        loss: [{ who: 'shkar', text: '[satisfaction, cold as the water]' }],
        bhalf: [{ who: 'shkar', text: '[they are going back into the fog. They are not running. They are making room]' }]
      },
      mithdu: {
        start: [{ who: 'mithdu', text: '[the rock hums. Every turret in the warren is waking]' }],
        kill: [{ who: 'mithdu', text: '[the hum stutters, and picks up again]' }],
        loss: [{ who: 'ops', text: 'Man down! It came out of a wall that wasn’t there a second ago!' }],
        sighted: [{ who: 'ops', text: 'Contact! Xenotripods, small ones, dozens. They live down here.' }]
      },
      lance: {
        start: [{ who: 'daw', text: 'Lance, take the log. Nobody needs to die over a court order.' }],
        kill: [{ who: 'daw', text: 'That was one of mine. Now it’s personal, {commander:rank}.' }],
        loss: [{ who: 'lancer', text: 'Contact down. They’re not as good as their file.' }],
        bhalf: [{ who: 'daw', text: 'Lance, disengage. Vane can pay for a second try.' }]
      }
    },

    /* What is said in each battle, at its moments: its own lines first, its
       enemy side's for the moments it has none of. */
    battles: {
      'c1.battle': {
        start: [
          { who: 'kettering', text: 'Nothing personal, {commander:rank}. The slate, and everyone goes home.' },
          { who: 'kettering', if: { flag: 'kettle_marked' }, text: 'You had my lad followed? Clever. Not clever enough.' }
        ],
        turn3: [{ who: 'vane', text: 'I’m in the arcade, {commander:rank}. I would very much like to reach the end of it.' }]
      },
      'c2f.battle': {
        start: [{ who: 'nine', text: 'Wraith to company on the flats. Take your time digging. We have all day.' }],
        searched: [{ who: 'ops', text: 'Nothing here but glass and somebody’s old boots. Next site.' }],
        found: [{ who: 'ops', text: 'Got it! Lodestone, in the ground, right where Morrow left it! Get it home!' }],
        guard: [{ who: 'nine', text: 'They have it. All Wraith: the carrier, nobody else.' }]
      },
      'c2t.battle': {
        start: [{ who: 'scav', text: 'Seal the bulkheads! Nobody leaves the control room without my say!' }],
        turn3: [{ who: 'ops', text: 'Suit seals are holding. Keep it that way; there’s nothing out there to breathe.' }]
      },
      'c3.battle': {
        start: [
          { who: 'shkar', if: { flag: 'signal_failed' }, text: '[the signal comes back, louder, wrong, and every one of them turns towards you at once]' },
          { who: 'shkar', text: '[the beacon’s hum rises, and the fog moves against the wind]' }
        ],
        searched: [{ who: 'ops', text: 'Nothing in the shrine. Next one. Watch the water.' }],
        found: [{ who: 'ops', text: 'The stone, it’s in the socket! It’s glowing. Pull it and run!' }],
        guard: [{ who: 'shkar', text: '[a howl inside the skull: put it back. PUT IT BACK]' }]
      },
      'c4.battle': {
        start: [{ who: 'agathe', text: 'Sable holds. If you want my warehouse, {commander:rank}, come and knock.' }],
        bhalf: [{ who: 'agathe', text: 'Pull back to the strongroom. They will have to dig us out.' }]
      },
      'warren.battle': {
        start: [{ who: 'ops', text: 'Lights on. Stay together. We find a way out, or we make one.' }],
        turn3: [{ who: 'mithdu', text: '[the tunnels breathe out, and the turrets turn with them]' }]
      },
      'dx.battle': {
        start: [
          { who: 'daw', if: { flag: 'lance_burned' }, text: 'You fired on my people under a court order. Vane will have your company’s name struck off every register there is.' },
          { who: 'daw', text: 'Lance, advance. Professionally, please.' }
        ]
      }
    }
  };
})(typeof window !== 'undefined' ? window : global);
