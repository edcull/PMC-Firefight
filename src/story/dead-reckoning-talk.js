/* PMC 2670 — Firefight : what is said in Dead Reckoning (docs/story-dead-reckoning-plan.md, phase 3)

   As Deep Contract's talk (deep-contract-talk.js): the conversations that open
   the story's pages, keyed by the node they open; what is said in its
   battles, by the battle's own lines first and the enemy side's otherwise
   (story.js talkFor), at the moments the battle names (start, turn3, kill,
   loss, bhalf, ahalf, wave, parley, target, sighted, searched, found, guard,
   contact); and the hired companies' voices when they fight beside the
   company. The Xenotripods speak through Mental Projection: their lines are in
   brackets, in every head at once. In the first half nobody knows what they
   are: they are `unknown`, a shape with lights in it, and have no name.

   Written in full for the first half (chapters 1 to 4, both one-offs). The
   second half's voices come in phase 5. */
(function (root) {
  'use strict';
  root.PMCStoryTalk = root.PMCStoryTalk || {};

  root.PMCStoryTalk['dead-reckoning'] = {
    // the voices heard on the trail, beside the story's people
    people: {
      reader: { name: 'Halloran', role: 'Vane’s chief reader', face: { bg: '#9a8ab9', skin: '#e2b48f', hair: '#bdbdbd', hairStyle: 'short', clothes: '#3a3248', clothesStyle: 'suit', accent: '#c8a040', extras: ['glasses', 'beard'] } },
      kettleman: { name: 'A Brass Ledger hand', role: 'Brass Ledger', face: { bg: '#c9a65a', skin: '#a8754f', hair: '#3a2a20', hat: 'beanie', hatColour: '#5a4a3a', clothes: '#5a4a3a', clothesStyle: 'jacket', accent: '#e0b070', extras: ['stubble'] } },
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
        { who: 'vane', text: '{commander:rank}. This is Lucan Vane. No, you won’t see me; nobody does, and I find that keeps things simple. I’ve read your company’s file, and I don’t mind it. That’s rarer than you’d think.' },
        { who: 'commander', text: 'Your agent said an auction. He didn’t say why an auction needs a company.' },
        { who: 'vane', text: 'Because everyone else in that room has brought one. Lot 47 is a dead man’s log, {commander:rank}, and the dead man found something nobody else ever has.' },
        { who: 'reader', text: 'Elias Morrow. Surveyor. He wrote in dead reckoning: headings and burn times, no fixes. Without his stones it’s gibberish. With them, it’s a road.' },
        { who: 'commander', text: 'And the stones? Whose are they?' },
        { who: 'reader', text: 'Nobody’s that we know of. That’s rather the point.' },
        { who: 'vane', text: 'A road to a world he called the Quiet. I want Halloran out of that room with the log, and alive. After that you follow the road, and whoever files the first claim at the end owns everything there. Shall we begin?' }
      ],
      'c1.agent': [
        { who: 'kettering', text: 'You’ve got one of mine. Let’s be clear about what happens now, {commander:rank}: he walks, or the next time we meet I bring three times the men and no reason to be polite.' },
        { who: 'commander', text: 'Your men tried to take the log off my employer in the street.' },
        { who: 'kettering', text: 'They were paid to. It’s a job, not a grudge. You did yours, we did ours, and the client who lost is the one who’ll be unhappy. Hand him back and the account’s square. Keep him and it isn’t.' }
      ],

      // ---- 2. The First Lodestone ----
      'c2.brief': [
        { who: 'reader', text: 'Two readings, {commander:rank}. Both fit the burn times. One puts him on Vantor III, on the Glass Flats. The other at Station Thule.' },
        { who: 'vane', text: 'Somebody will be at whichever one you don’t choose. Somebody may be at both. I pay for results, {commander:rank}, not for reasons.' },
        { who: 'commander', text: 'What’s at Thule?' },
        { who: 'reader', text: 'A survey relay. Morrow stopped there for three days. Nobody stops at a relay for three days unless something is wrong, or something is right.' },
        { who: 'reader', text: 'And the Flats is where he dug. Mr Vane leaves it to you, {commander:rank}. You’re the one who has to dig.' }
      ],
      'c2f.dig': [
        { who: 'ops', text: 'Tents by the dig. A mast. No sentries I can see, which means they’re there and I can’t see them.' },
        { who: 'nine', text: 'Company on the flats. This is Nine. We read your copy. We were here first, and we have the high ground and every approach covered.' },
        { who: 'commander', text: 'The dig is Vane’s, Nine. Pack up and go home.' },
        { who: 'nine', text: 'Vane doesn’t pay us. Our client does, and our client wants what’s in that ground. Turn your dropships round and nobody on your side gets shot. Come any closer and we start with your officers.' }
      ],
      'c2t.airlock': [
        { who: 'ops', text: 'Main lock is welded. Somebody’s inside, and they’ve been inside a while: there’s a cooking vent on the north side.' },
        { who: 'scav', text: 'You’re on our pad, ship. Thule’s taken. Lift off now, or we open up on your hull.' },
        { who: 'commander', text: 'We want three days of a dead man’s records. Then we leave.' },
        { who: 'scav', text: 'Everything in this station is salvage, and salvage is ours. You want it, you pay for it, or you come through that lock and earn it. We’ve done this before.' }
      ],

      // ---- 3. The Drowned Beacon ----
      'c3.brief': [
        { who: 'ops', text: 'Fog’s too thick for the drones. The Reavers’ dig is lit up like a fairground. And there’s motion out past it, a lot of it. It stopped when we landed.' },
        { who: 'commander', text: 'Reavers?' },
        { who: 'ops', text: 'Not Reavers. Reavers don’t stop all at once, like somebody told them to.' },
        { who: 'reader', text: 'Morrow’s entry for this world is one line: “They let me in. I don’t know why. I took the stone and they watched me take it.” He never says who they were.' },
        { who: 'unknown', text: '[a pressure behind the eyes, like a hand on the back of the neck: you are seen]' }
      ],
      'c3.contact': [
        { who: 'hal', text: 'Company! First come, first served, and we came first. The beacon’s our claim. You land one more boat on this island and I sink it.' },
        { who: 'commander', text: 'You’re cutting into something you don’t understand, Hal.' },
        { who: 'hal', text: 'Don’t need to understand it to sell it. Nothing against you, it’s a buyer’s market. But my crew don’t get paid if you get the stone, so you come in, we kill you. Simple as that.' }
      ],

      // ---- 4. The Broker ----
      'c4.brief': [
        { who: 'kettering', text: 'Kerrigan, {commander:rank}. My broker, my rules: anyone starts shooting before the hammer falls, Brass Ledger finishes it, and sends the bill to whoever’s left.' },
        { who: 'agathe', text: 'The heading is in my warehouse. My warehouse has my tanks in front of it. That is the whole of the auction.' },
        { who: 'commander', text: 'You bought the building to stop the sale?' },
        { who: 'agathe', text: 'My client bought it, and my client pays me to keep it. You can buy a seat at the broker’s table at the broker’s price. Or you can try my front door, and I will put every one of your vehicles in the harbour. Choose before the tide turns.' }
      ],

      // ---- Into the Warren ----
      'warren.brief': [
        { who: 'ops', text: 'Rad counters are ticking. Not bad. Not good. Air’s breathable, if you like the taste of pennies.' },
        { who: 'commander', text: 'Where are we?' },
        { who: 'ops', text: 'Navigation says nowhere. No stars to fix on through the rock. We are, technically, lost. And the Reavers are down here somewhere, shooting at the walls.' },
        { who: 'unknown', text: '[something old turns its attention to you, slowly, the way a sleeper turns over]' }
      ],

      // ---- The Double-Cross ----
      'dx.brief': [
        { who: 'daw', text: 'Commander Iselin Daw, the Ninth Lance. You’ll have heard of us. You won’t have heard that we work for Lucan Vane, because he doesn’t tell people anything.' },
        { who: 'commander', text: 'He didn’t tell me.' },
        { who: 'daw', text: 'No. He thought you’d stay bought. You haven’t, or he thinks you haven’t, which comes to the same thing on a court order.' },
        { who: 'commander', text: 'And if I hand you the log?' },
        { who: 'daw', text: 'Then you go home with your pay to date, and nobody on either deck gets hurt. Refuse, and I take it by force, at your expense. This is a contract dispute, {commander:rank}. I settle them for a living.' }
      ]
    },

    // the hired companies, when they fight beside the company (story.js allyVoice)
    allies: {
      kettle: { who: 'kettering',
        report: ['Brass Ledger, as contracted. Lots of us, cheap. Point us at something.', 'Ledger’s lads on your flank, {commander:rank}. Paid up and ready.'],
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
        start: [{ who: 'kettleman', text: 'There they are! Five hundred to whoever brings back the slate! Shoot anything that gets in the way!' }],
        kill: [{ who: 'kettleman', text: 'Man down! Keep pushing, the rate’s gone up!' }],
        loss: [{ who: 'kettleman', text: 'Got one! That’s a bonus! Who else wants to stand in front of us?' }],
        bhalf: [{ who: 'kettleman', text: 'Contract’s not worth this! Fall back, fall back, we bill them for it later!' }]
      },
      wraith: {
        start: [{ who: 'nine', text: 'All Wraith units: weapons free. Officers and radios first. They don’t leave with anything.' }],
        kill: [{ who: 'nine', text: 'Nine to all. We lost one. Price of the job. Keep firing.' }],
        loss: [{ who: 'nine', text: 'One down. Next.' }],
        bhalf: [{ who: 'nine', text: 'Wraith, break contact. The client gets a report, not a body count.' }]
      },
      sable: {
        start: [{ who: 'agathe', text: 'Sable Armour Group holds. Anything that crosses the line, destroy it.' }],
        kill: [{ who: 'agathe', text: 'A hull lost. It is insured; the ground is not. Close the gap. Nobody steps back.' }],
        loss: [{ who: 'agathe', text: 'Target destroyed. Next one. They are paying for every metre of this.' }],
        bhalf: [{ who: 'agathe', text: 'We are not finished while one of us is standing in that warehouse.' }]
      },
      scavengers: {
        start: [{ who: 'scav', text: 'Lights out, everyone. They don’t know the station. We do. Nobody takes our salvage.' }],
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
      reavers: {
        start: [{ who: 'hal', text: 'Reavers! Nobody touches our claim! Boarders away!' }],
        kill: [{ who: 'hal', text: 'They got one of mine! That comes off their share. Get in there!' }],
        loss: [{ who: 'hal', text: 'Ha! One less to split it with! Who’s next?' }],
        bhalf: [{ who: 'hal', text: 'Not worth it! Grab what you’ve got and run for the boats!' }]
      },
      lance: {
        start: [{ who: 'daw', text: 'Lance, take the log. Minimum force, but take it.' }],
        kill: [{ who: 'daw', text: 'That was one of mine, {commander:rank}. It goes on your bill. Lance, stop being gentle.' }],
        loss: [{ who: 'lancer', text: 'Contact down. They’re not as good as their file.' }],
        bhalf: [{ who: 'daw', text: 'Lance, disengage. Mr Vane can pay for a second try.' }]
      }
    },

    /* What is said in each battle, at its moments: its own lines first, its
       enemy side's for the moments it has none of. */
    battles: {
      'c1.battle': {
        start: [
          { who: 'kettering', text: 'Nothing personal, {commander:rank}. Hand over the reader and the slate and everyone goes home. Otherwise my lads go through you, and I don’t care how much it costs.' },
          { who: 'kettering', if: { flag: 'kettle_marked' }, text: 'You had my lad followed? Clever. Not clever enough.' }
        ],
        kill: [{ who: 'kettering', text: 'You’re costing me money, {commander:rank}. I don’t forgive that. I invoice it.' }],
        turn3: [{ who: 'reader', text: 'I’m in the arcade, {commander:rank}. Mr Vane is asking, rather calmly, whether I mean to reach the end of it.' }],
        loss: [{ who: 'vane', text: 'You’re losing people, {commander:rank}. Don’t lose Halloran. He reads, and I don’t.' }]
      },
      'c2f.battle': {
        start: [{ who: 'nine', text: 'Wraith to company on the flats. Last warning. Anyone who lifts a spade gets a round through the visor.' }],
        searched: [{ who: 'ops', text: 'Nothing here but glass and somebody’s old boots. Next site.' }],
        found: [{ who: 'ops', text: 'Got it! Lodestone, in the ground, right where Morrow left it! Get it home!' }],
        guard: [{ who: 'nine', text: 'They have it. All Wraith: the carrier, nobody else. It doesn’t leave the flats.' }]
      },
      'c2t.battle': {
        start: [{ who: 'scav', text: 'Seal the bulkheads! Nobody leaves the control room without my say!' }],
        turn3: [{ who: 'ops', text: 'Suit seals are holding. Keep it that way; there’s nothing out there to breathe.' }]
      },
      'c3.battle': {
        start: [
          { who: 'unknown', if: { flag: 'signal_failed' }, text: '[the signal comes back, louder, wrong, from everywhere in the fog at once]' },
          { who: 'hal', text: 'Reavers! They want the dig, they can come and die for it!' }
        ],
        searched: [{ who: 'ops', text: 'Nothing in the shrine. Next one. Watch the water.' }],
        found: [{ who: 'ops', text: 'The stone, it’s in the socket! It’s glowing. Pull it and run!' }],
        contact: [{ who: 'ops', text: 'Contact! Contact by the spire! Big, three legs, they just stepped out of the air! What the hell are they?' }],
        guard: [{ who: 'unknown', text: '[a howl inside the skull: put it back. PUT IT BACK]' }]
      },
      'c4.battle': {
        start: [{ who: 'agathe', text: 'Sable holds. If you want my warehouse, {commander:rank}, come and knock. Bring a great deal of money for the repairs.' }],
        bhalf: [{ who: 'agathe', text: 'Pull back to the strongroom. They will have to dig us out, and pay for every shovel.' }]
      },
      'warren.battle': {
        start: [{ who: 'ops', text: 'Lights on. Stay together. Reavers ahead, dug in. We find a way out, or we make one.' }],
        contact: [{ who: 'ops', text: 'Movement in the walls! It came out of the rock! Small ones, lots of them, and the Reavers are running!' }],
        turn3: [{ who: 'unknown', text: '[the tunnels breathe out, and something in them wakes]' }]
      },
      'dx.battle': {
        start: [
          { who: 'daw', if: { flag: 'lance_burned' }, text: 'You fired on my people under a court order. Vane will have your company’s name struck off every register there is.' },
          { who: 'daw', text: 'Lance, advance. Professionally, please. Disable what you can, kill what you have to.' }
        ]
      }
    }
  };
})(typeof window !== 'undefined' ? window : global);
