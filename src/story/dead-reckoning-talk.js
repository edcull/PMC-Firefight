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
      reader: { name: 'Halloran', role: 'Archaeologist, reader of Morrow’s logs', face: { bg: '#9a8ab9', skin: '#e2b48f', hair: '#bdbdbd', hairStyle: 'short', clothes: '#3a3248', clothesStyle: 'suit', accent: '#c8a040', extras: ['glasses', 'beard'] } },
      kettleman: { name: 'A Brass Ledger hand', role: 'Brass Ledger', face: { bg: '#c9a65a', skin: '#a8754f', hair: '#3a2a20', hat: 'beanie', hatColour: '#5a4a3a', clothes: '#5a4a3a', clothesStyle: 'jacket', accent: '#e0b070', extras: ['stubble'] } },
      scav: { name: 'Mags', role: 'The Thule scavengers', face: { bg: '#7a9ab0', skin: '#d8a682', hair: '#c8c8c8', hairStyle: 'long', hat: 'beanie', hatColour: '#3a4a5a', clothes: '#4a4a52', clothesStyle: 'jacket', accent: '#e07a3a', extras: ['scar', 'earring'] } },
      shkar: { name: 'The Sh’kar', role: 'Xenotripods, the beacon’s keepers', face: { tripod: true, bg: '#1e3a3a', shell: '#9ab8a8', glow: '#7ae0c8' } },
      mithdu: { name: 'The Mithdu', role: 'Xenotripods, under the rock', face: { tripod: true, bg: '#2a2418', shell: '#a89870', glow: '#e0a040' } },
      ulvar: { name: 'The Ulvar', role: 'Xenotripods, the shieldwall', face: { tripod: true, bg: '#2a2e3a', shell: '#a8b0c8', glow: '#8ab0ff' } },
      amt: { name: 'The Amt', role: 'Xenotripods, the towers of the Quiet', face: { tripod: true, bg: '#2a2414', shell: '#d8c890', glow: '#ffe08a', gold: true } },
      lancer: { name: 'A Lance trooper', role: 'The Ninth Lance', face: { bg: '#5a4a7a', skin: '#c99a76', hair: '#222', hat: 'visor', hatColour: '#2a2238', clothes: '#2a2238', clothesStyle: 'armour', accent: '#c8a040' } }
    },

    /* Conversations on the story's own pages, before the page's text: keyed by
       the node they open. `commander` is the company's own commander, named. */
    conversations: {
      // ---- 1. Lot 47 ----
      'c1.brief': [
        { who: 'reader', text: '{commander:rank}. Halloran. Thank you for coming. I’ll be plain: I need your company, and I need it tonight.' },
        { who: 'commander', text: 'You said an auction. You didn’t say why an auction needs a company.' },
        { who: 'reader', text: 'Because everyone else in that room has brought one. Lot 47 is Elias Morrow’s log. Surveyor. Forty years without a word; a court declared him dead a long time ago. I’m not so sure.' },
        { who: 'reader', text: 'He never wrote down where he was, only which way he went and for how long. On its own the log is useless. You need his stones to know where each leg starts.' },
        { who: 'commander', text: 'And the stones? Whose are they?' },
        { who: 'reader', text: 'Nobody’s, now. He stole them back from whoever paid for his first trip, took them out again, and put them down along the way, one at a time. Each one points to the next. The log says where to start.' },
        { who: 'commander', text: 'Who paid for his first trip?' },
        { who: 'reader', text: 'The catalogue doesn’t say. Whoever it was, Morrow robbed him and ran.' },
        { who: 'reader', text: '[he touches his earpiece, and listens] Yes. Yes, I understand. [to you] Forgive me.' },
        { who: 'commander', text: 'Who’s on the line?' },
        { who: 'reader', text: 'My backer. They don’t want to be introduced. The money is real: it comes through a bank on Halcyon, and it’s there whenever I need it. I don’t ask whose it is.' },
        { who: 'reader', text: 'Get me out of there alive, with the log. Then we follow it to a world he called the Quiet. Whoever files the first claim there owns it. Ready?' }
      ],
      'c1.agent': [
        { who: 'kettering', text: 'You’ve got one of my lads, {commander:rank}. Send him back, or next time I bring three times as many.' },
        { who: 'commander', text: 'Your men tried to take the log off my employer in the street.' },
        { who: 'kettering', text: 'They were paid to. It’s a job, nothing personal. Send him back and we’re even. Keep him and we’re not.' }
      ],

      // (said straight after the choice: Brass Ledger's client, out of the man they left behind)
      'c1.agent/interrogate': [
        { who: 'kettleman', name: 'Kettering’s man', text: 'I watch doors! That’s all I do. The money? It comes through three companies nobody’s ever heard of, and all three bank with the Orrin Mercantile, on Kerrigan. Everyone in the crew knows it. Nobody’s meant to say it.' },
        { who: 'reader', text: 'A bank on Kerrigan. So somebody there wants the log too. It won’t last, {commander:rank}. Brass Ledger work for whoever pays. Next time it will be someone else.' }
      ],

      'c1.lost': [
        { who: 'kettering', text: 'No hard feelings, {commander:rank}. The log’s in my hold, and we lift in an hour.' },
        { who: 'client', text: 'Kettering. Name a figure.' },
        { who: 'kettering', text: 'Halloran’s money, is it? No. I’ve read the first page. It’s not for sale, not at any price. Your people can come and try to take it back if they like. I’d rather they didn’t.' },
        { who: 'reader', text: 'I photographed the first eleven pages, {commander:rank}. Wherever they go, the log will take them, and we can follow.' },
        { who: 'kettering', text: 'Or we do a deal, {commander:rank}. No money. Cut us in on whatever’s at the end, and you get the log back tonight. Don’t take long deciding.' }
      ],

      // ---- 2. The First Lodestone ----
      'c2.brief': [
        { who: 'reader', text: 'Two readings, {commander:rank}. Both fit the burn times. One puts him on Vantor III, on the Glass Flats. The other at Station Thule.' },
        { who: 'client', text: 'Somebody will be at whichever one you don’t choose. Somebody may be at both. I pay for results, {commander:rank}, not for reasons.' },
        { who: 'commander', text: 'What’s at Thule?' },
        { who: 'reader', text: 'A survey relay. Morrow stopped there for three days. Nobody stops at a relay for three days unless something is wrong, or something is right.' },
        { who: 'reader', text: 'And the Flats is where he dug. Whatever he buried, it’s still in the ground, unless he came back for it.' },
        { who: 'client', text: 'He didn’t. He’s dead.' },
        { who: 'commander', text: 'You sound very sure.' },
        { who: 'client', text: 'Your choice, {commander:rank}. You’re the one who has to dig.' }
      ],
      'c2f.dig': [
        { who: 'ops', text: 'Tents by the dig. A mast. No sentries I can see, which means they’re there and I can’t see them.' },
        { who: 'reader', text: 'The cairn by the posts, {commander:rank}. Morrow built it. He wrote: “Buried Holds-the-Lamp and First-Over-the-Water by the posts, where the glass will keep them. They carried the stone for me, and the ship that follows me killed them for it.” I took those for the names of his crew. They aren’t human names. They aren’t human.' },
        { who: 'nine', text: 'Company on the flats. This is Nine, Wraith Section. We’ve read Morrow’s log too; copies get around. We were here first, and we have the high ground and every approach covered.' },
        { who: 'commander', text: 'The dig is ours, Nine. Pack up and go home.' },
        { who: 'nine', text: 'Your client doesn’t pay us. Ours does, and our client wants what’s in that ground. Turn your dropships round and nobody on your side gets shot. Come any closer and we start with your officers.' }
      ],
      // (said straight after reading Wraith Section's orders)
      'c2f.drop/read': [
        { who: 'reader', text: 'These aren’t a company’s orders, {commander:rank}. Look at the header: the Admiralty, Office of Naval Intelligence. Wraith Section is the Navy with the badges taken off.' },
        { who: 'commander', text: 'And the Navy wants the Quiet too.' },
        { who: 'reader', text: 'The Navy wants whatever Morrow found before anybody else gets it. I would very much like to know how they heard of it.' }
      ],
      // (said straight after breaking it open)
      'c2f.drop/take': [
        { who: 'reader', text: 'The log, and their orders with it. Look at the header, {commander:rank}: the Admiralty, Office of Naval Intelligence. Wraith Section is the Navy with the badges taken off.' },
        { who: 'commander', text: 'And now the Navy knows we’ve been through their case.' },
        { who: 'reader', text: 'They’ll want it back. I’d rather they didn’t get it.' }
      ],

      'c2t.airlock': [
        { who: 'ops', text: 'Every docking arm is welded. Somebody’s aboard, and they’ve been aboard a while: there’s a heat plume off the north module. The survey office still lists Thule as theirs, unmanned. Nobody’s filed a salvage claim on it.' },
        { who: 'scav', text: 'You’re on our docking arm, ship. Thule’s ours now. Cast off, or we open up on your hull.' },
        { who: 'commander', text: 'Thule belongs to the survey office, and you know it. We don’t want your salvage: we just need access to the relay’s archive. Let us in, we copy what we need, and we leave. No need for anyone to get hurt.' },
        { who: 'scav', text: 'The survey office isn’t here. We are. Everything in this station is salvage, and salvage is ours, archive and all. You want it, you pay for it, or you come through that lock and earn it. We’ve done this before.' }
      ],

      // ---- 3. The Drowned Beacon ----
      'c3.brief': [
        { who: 'ops', text: 'Fog’s too thick for the drones. The Reavers’ dig is lit up like a fairground. And there’s motion out past it, a lot of it. It stopped when we landed.' },
        { who: 'commander', text: 'Reavers?' },
        { who: 'ops', text: 'Not Reavers. Reavers don’t stop all at once, like somebody told them to.' },
        { who: 'reader', text: 'Morrow’s entry for this world is one line: “They let me in. I don’t know why. I took the stone and they watched me take it.” He never says who they were.' },
        { who: 'reader', text: 'One more thing. He wrote that the stones were louder together. He never says louder to whom. I’ve started keeping ours in separate lockers, {commander:rank}, and I’d rather you didn’t ask me why.' },
        { who: 'unknown', text: '[a pressure behind the eyes, like a hand on the back of the neck: you are seen]' }
      ],
      'c3.contact': [
        { who: 'hal', text: 'Company! First come, first served, and we came first. The beacon’s our claim. You land one more boat on this island and I sink it.' },
        { who: 'commander', text: 'You’re cutting into something you don’t understand, Hal.' },
        { who: 'hal', text: 'Don’t need to understand it to sell it. Nobody hired us, nobody tells us where to dig. We jump claims, and we sell to whoever buys. Nothing against you, it’s a buyer’s market. But my crew don’t get paid if you get the stone, so you come in, we kill you. Simple as that.' }
      ],

      'c3.sale': [
        { who: 'ops', text: 'Ship in the reeds. It’s Brass Ledger’s, from Vesk. The Reavers’ boats are alongside, and there’s a tent lit up between them.' },
        { who: 'kettering', text: 'Hal, Hal. The price is the price. You want the road to that beacon, it’s in this case, and the case is mine.' },
        { who: 'hal', text: 'I’m digging the beacon already, Moss. I want to know what’s under it before I pay for the map to it.' },
        { who: 'reader', text: 'That’s the log, {commander:rank}. That’s our log, on a folding table, in a swamp.' }
      ],

      // ---- 4. The Broker ----
      'c4.brief': [
        { who: 'kettering', if: { not: { flag: 'beat_kettle' } }, text: 'Kerrigan, {commander:rank}. My broker, my rules: anyone starts shooting before the hammer falls, Brass Ledger finishes it, and sends the bill to whoever’s left.' },
        { who: 'kettering', if: { flag: 'beat_kettle' }, text: 'Kerrigan, {commander:rank}. My broker, my rules. And after Vesk, you’re the first name on my list: anyone starts shooting before the hammer falls, Brass Ledger finishes it. I’d very much like it to be you.' },
        { who: 'agathe', text: 'The stone and its heading are in my warehouse. My warehouse has my tanks in front of it. That is the whole of the auction.' },
        { who: 'commander', text: 'You bought the building to stop the sale?' },
        { who: 'agathe', text: 'My client bought it, and my client pays me to keep it. You can buy the lot from the broker, at the broker’s price, and I will see it delivered. Or you can try my front door, and I will put every one of your vehicles in the harbour. Choose before the tide turns.' }
      ],

      // ---- Into the Warren ----
      'warren.brief': [
        { who: 'ops', text: 'Rad counters are ticking. Not bad. Not good. Air’s breathable, if you like the taste of pennies.' },
        { who: 'commander', text: 'Where are we?' },
        { who: 'ops', text: 'Navigation says nowhere. No stars to fix on through the rock. We are, technically, lost. And the Reavers are down here somewhere, shooting at the walls.' },
        { who: 'unknown', text: '[something old turns its attention to you, slowly, the way a sleeper turns over]' }
      ],

      // ---- the second half: the Race ----
      'claim.brief': [
        { who: 'rook', text: 'Company, this is Rook Kestrel. You’re on my shelf, you’re in my shot, and you’re about to be in tonight’s feed. Smile.' },
        { who: 'commander', text: 'That cache was Morrow’s, Kestrel. It isn’t yours to film or to fly off with.' },
        { who: 'rook', if: { not: { flag: 'kestrel_deal' } }, text: 'It’s whoever’s who gets it to a ship first. That’s not a threat, it’s the rules of the race. My client wants pictures, and you on the wrong end of my guns makes great pictures.' },
        { who: 'rook', if: { flag: 'kestrel_deal' }, text: 'You sold me pictures off the trail, and they ran well. So you know how this works: whoever gets it to a ship first, on camera. I’d love it to be a fair fight. I’d love it more to be a quick one.' }
      ],
      'wreck.brief': [
        { who: 'ops', text: 'That’s her. Morrow’s ship. Sable has a ring of armour round the gully, and cutting gear on the main hatch.' },
        { who: 'agathe', if: { not: { flag: 'beat_sable' } }, text: 'This wreck is my client’s salvage, {commander:rank}. Turn your ship round. If you land inside my perimeter, I will treat it as an assault on a contracted site.' },
        { who: 'agathe', if: { flag: 'beat_sable' }, text: 'You. I wondered when you would come. I have a warehouse’s worth of reasons not to let you near this ship, {commander:rank}, and I intend to collect every one of them.' },
        { who: 'reader', text: 'His last entry will be in there, {commander:rank}. Whatever he found at the end, he wrote it down. He always wrote it down.' }
      ],
      'bounty.brief': [
        { who: 'ops', text: 'Depot’s clear. Fuel’s flowing. And the hills to the east just went very quiet.' },
        { who: 'nine', if: { not: { flag: 'beat_wraith' } }, text: 'Company on Ilya. There’s a price on your head and Wraith took the contract. Nothing personal. You can leave the stones on the pad and walk away, or you can be the job.' },
        { who: 'nine', if: { flag: 'beat_wraith' }, text: 'Company on Ilya. I asked for this contract. Do you understand? I asked. The flats were the only job Wraith ever walked away from.' },
        { who: 'commander', text: 'Then come and get it, Nine.' }
      ],
      'landing.brief': [
        { who: 'reader', text: 'That’s it, {commander:rank}. The end of the log. The Quiet. Morrow stood here forty years ago and turned round and went home.' },
        { who: 'ops', text: 'One landing field, and somebody’s already on it. Dug in, end to end. They’ve been waiting for us.' },
        { who: 'vane', if: { not: { flag: 'vane_cut_off' } }, text: 'Whoever holds that field files the claim, {commander:rank}. I have paid for a great many things to bring you here. Do not make me pay for losing.' },
        { who: 'commander', text: 'All units: this is the one. Take the field.' }
      ],
      'watchers.brief': [
        { who: 'ops', text: 'Shield domes across the whole pass, wall to wall. Turrets under every one. Nothing gets through that we can see.' },
        { who: 'ulvar', text: '[a wall, in every head at once: smooth, cold, and without a door in it]' },
        { who: 'commander', text: 'Then we make a door.' }
      ],
      'storm.brief': [
        { who: 'ops', text: 'Sensors are screaming! The air round the camp is folding, everywhere at once. Something’s coming through!' },
        { who: 'shkar', if: { flag: 'beacon_stormed' }, text: '[the beacon, the stone, the ones who took it: you, you, you]' },
        { who: 'shkar', if: { not: { flag: 'beacon_stormed' } }, text: '[a hand reaching for something that was taken]' },
        { who: 'commander', text: 'Stand to! Everybody up and on the line!' }
      ],
      'cold.brief': [
        { who: 'ops', text: 'Ruins, half under the sand. And the sand’s moving when nothing is moving it.' },
        { who: 'mithdu', text: '[a slow attention, from underneath everything]' },
        { who: 'commander', text: 'Lights on, backs to the walls. If the floor moves, shoot the floor.' }
      ],
      'spire.brief': [
        { who: 'reader', text: 'The tallest tower on the Quiet. The stones point straight at it, all of them. Whatever the Amt are, they are in there, and they are waking.' },
        { who: 'seven', if: { flag: 'eshaven_promise' }, text: 'You promised. Remember the promise in there, other hands. If the towers wake, they call us all home.' },
        { who: 'amt', text: '[something enormous, half asleep, turning towards you]' }
      ],
      // ---- the second half: First Contact ----
      'mimics.brief': [
        { who: 'seven', text: 'I am Seven-Holds-the-Staff. You are the other hands: the soldiers who choose whom they serve. We have never been asked. Our masters only told.' },
        { who: 'commander', text: 'And now you’re asking.' },
        { who: 'seven', text: 'Now I am asking. Those men on the ridge have cages. They have come for us, to sell us. Will you fight beside us, other hands? We will say the names of your dead with ours.' },
        { who: 'kettering', if: { flag: 'beat_kettle' }, text: 'You again, {commander:rank}. Stay out of this one. It’s the best manifest Brass Ledger has had all year, and you owe me for Vesk.' }
      ],
      'speaker.brief': [
        { who: 'ops', text: 'One of them, on the far shore. An Alpha, by the crest. Weapons grounded. It’s just… standing there.' },
        { who: 'amt', text: '[a single word, very gently, in every head at once: come]' },
        { who: 'reader', text: 'Morrow wrote that they let him in. Maybe this is how.' }
      ],
      'signal.brief': [
        { who: 'reader', text: 'Lit, the beacon calls. Morrow thought it called them home. Seven says it calls them to talk. We are about to find out which.' },
        { who: 'shkar', text: '[the fog thickens, and fills with movement]' },
        { who: 'commander', text: 'Hold the beacon. Whatever comes, hold it until the signal is out.' }
      ],
      // ---- the second half: the Patron ----
      'vault.brief': [
        { who: 'reader', text: 'Under the bank. Everything Mr Vane has ever bought. And perhaps everything he has ever sold.' },
        { who: 'daw', text: 'You’re a long way from your contract, {commander:rank}. The Lance holds this vault. Turn round and nobody has to explain anything to anyone.' },
        { who: 'vane', if: { not: { flag: 'vane_cut_off' } }, text: 'I would rather you didn’t, {commander:rank}. I would very much rather you didn’t.' }
      ],
      'escort.brief': [
        { who: 'vane', text: 'Three trucks, {commander:rank}, and a ship on the far side of Umber. Do not open the containers. Do not stop for anyone. Do not lose them.' },
        { who: 'nine', text: 'Wraith to the convoy on the Umber road. Those containers are impounded by order of the Admiralty. Stop the trucks and nobody on your side gets shot.' },
        { who: 'commander', text: 'We’re paid to deliver them. Convoy, move out.' }
      ],
      'debts.brief': [
        { who: 'daw', if: { not: { flag: 'beat_lance' } }, text: 'Commander Iselin Daw, the Ninth Lance, acting for Mr Vane. He says your company owes him. I collect. Nothing more to it than that.' },
        { who: 'daw', if: { flag: 'beat_lance' }, text: 'We have met before, {commander:rank}. Mr Vane says you owe him. I would have taken this one for free.' },
        { who: 'commander', text: 'We owe Vane nothing.' }
      ],
      'collector.brief': [
        { who: 'vane', text: '{commander:rank}. At last. I thought it was time we met.' },
        { who: 'commander', text: 'You’re smaller than your voice.' },
        { who: 'vane', text: 'Most men are. I have paid for every step of this road: every stone, every rival, every jump. The Quiet is mine, {commander:rank}. The only question left is whether you are.' }
      ],
      'recall.brief': [
        { who: 'ops', text: 'Every turret on the planet just opened. Every one. The fog’s full of them!' },
        { who: 'amt', text: '[HOME. HOME. HOME.]' },
        { who: 'commander', text: 'Run for the ships! Everybody, run!' }
      ],

      // ---- the second half: the name ----
      'fault.brief': [
        { who: 'reader', text: 'It’s here, {commander:rank}. The last pages. He names them. Once, underlined twice: Xenotripods. The three-legged ones, who step out of the air.' },
        { who: 'commander', text: 'He knew. Forty years ago, he knew, and he never told anyone.' },
        { who: 'reader', text: 'He told the log. “They let me take the stones because the stones were going home anyway. I was only carrying them.”' },
        { who: 'reader', if: { not: { revealed: 'client_lance' } }, text: 'And something else, {commander:rank}. I followed the money back through Halcyon, the way you follow a heading. Our backer has a name. It’s Lucan Vane.' },
        { who: 'vane', if: { not: { flag: 'vane_cut_off' } }, text: 'Well. Now you know my name. Keep going, {commander:rank}. Nothing about our arrangement has changed, except that it is now worth a great deal more.' },
        { who: 'ops', text: 'Every newsfeed in the sector has it already. They’re calling them the Xenotripods. And every company on the trail is watching the same pictures we are.' }
      ],

      // ---- between chapters ----
      'i.newsfeed': [
        { who: 'rook', text: 'Kestrel Air Cavalry flies for the Meridian, {commander:rank}, and the Meridian wants the first pictures of whatever is at the end of this. It pays very well for them.' },
        { who: 'commander', text: 'Since when does a newsfeed hire gunships?' },
        { who: 'rook', text: 'Since it changed hands last year. New owner, on Halcyon. Never comes to the office, and never asks what the pictures cost.' }
      ],
      // (said straight after buying Brass Ledger's catalogue: page one is their own client)
      'i.catalogue/buy': [
        { who: 'kettering', text: 'Page one, free with every copy: who’s paying us. The Orrin Mercantile Bank, on Kerrigan, behind three shell companies. They paid for this trip.' },
        { who: 'commander', text: 'You’re selling out your own client?' },
        { who: 'kettering', text: 'I’m selling a catalogue. The bank bought this trip, not the next one. Next time it will be whoever pays.' }
      ],
      'i.catalogue/pages': [
        { who: 'kettering', text: 'Page one, free with every copy: who’s paying us. The Orrin Mercantile Bank, on Kerrigan, behind three shell companies. The rest is Morrow, in his own hand. Copied, not the original. I’m not daft.' },
        { who: 'commander', text: 'You’re selling out your own client?' },
        { who: 'kettering', text: 'I’m selling pages. The bank bought this trip, not the next one. Next time it will be whoever pays.' }
      ],

      // ---- The Double-Cross ----
      'dx.brief': [
        { who: 'daw', text: 'Commander Iselin Daw, the Ninth Lance. You’ll have heard of us. You won’t have heard that we work for Lucan Vane. Neither, it seems, have you: he is the money behind your Mr Halloran, and he doesn’t tell people anything.' },
        { who: 'commander', text: 'Nobody told me.' },
        { who: 'daw', if: { flag: 'chart_sold' }, text: 'No. He thought you’d stay bought. Then a copy of his chart turned up in Brass Ledger’s catalogue, and he knows who sold it and what it fetched.' },
        { who: 'daw', if: { not: { flag: 'chart_sold' } }, text: 'No. He thought you’d stay bought. He has been adding up what you’ve cost him, and he’s decided you haven’t, which comes to the same thing on a court order.' },
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
        clear: ['No orders, no pay, no moving. We’ll stay where we are.'],
        demand: ['That’ll be a kUC, {commander:rank}. Every order is.', 'Pay first, then we move. That’s the deal.'],
        walk: ['That’s it, we’re done. Send the invoice to your employer.', 'Contract’s void, lads. Back to the trucks.'],
        turn: ['The other side’s paying, {commander:rank}. You’re not. Nothing personal.', 'Three turns and not a penny. Turn round, lads, we’ve got a new client.'] },
      kestrel: { who: 'rook',
        report: ['Kestrel’s up. Cameras rolling, guns hot. Try to look good, {name}.'],
        move: ['Repositioning. Better angle anyway.', 'Moving.'],
        attack: ['Kestrel, going in! Get the shot!', 'Engaging.'],
        hold: ['We’ll hold. Not our favourite thing.', 'Holding.'],
        clear: ['Free hand. Now we’re talking.'],
        demand: ['That shot isn’t worth the risk to my birds. Unless it’s worth something to you.', 'We’ll go, for a price.'],
        walk: ['Kestrel, pulling out. We’ve got what we came for.', 'Dust off, Kestrel. This isn’t our fight.'] },
      reavers: { who: 'hal',
        report: ['Reavers are here. Don’t ask what we charge for the mess.'],
        move: ['Moving.', 'Right, boys, shift.'],
        attack: ['Boarders away!', 'About time.'],
        hold: ['Holding. Boring.', 'We’ll hold.'],
        clear: ['Our way, then.'],
        demand: ['That’ll cost you.', 'Pay first. Then we kill things.'],
        walk: ['Not worth it. Reavers, to the boats!', 'We’re off. You’re on your own, company.'] },
      hashamer: { who: 'seven',
        report: ['The Hashamer stand with the other hands. Say our names if we fall.', 'Seven-Holds-the-Staff, and all of us with it. Where do you want us?'],
        move: ['We go.', 'As you say, other hands.'],
        attack: ['For the names!', 'We go in.'],
        hold: ['We hold. We have held for a very long time.', 'Holding.'],
        clear: ['Our own way, then. Our masters’ way.'] },
      sable: { who: 'agathe',
        report: ['Sable Armour Group, as owed. We do not run. Plan accordingly.'],
        move: ['Advancing. Slowly.', 'Moving.'],
        attack: ['Sable, forward.', 'Engaging.'],
        hold: ['Holding. This is what we are for.', 'We hold.'],
        clear: ['We will hold what we stand on.'],
        demand: ['That is outside what was owed. It will cost you.', 'Pay for it, or we hold where we are.'],
        walk: ['The favour is paid. Sable withdraws.', 'We are leaving. This is no longer our ground.'] }
    },

    // what each enemy side says, where a battle has nothing of its own for the moment
    sides: {
      kettle: {
        start: [{ who: 'kettering', if: { flag: 'agent_jailed' }, text: 'You gave my lad to the port, {commander:rank}. Six years on Vesk for watching a door. That’s not business. I’ve come to settle it.' },
          { who: 'kettering', if: { flag: 'beat_kettle' }, text: 'You again. Vesk cost me a quarter’s profit and six good lads, {commander:rank}. This one isn’t for the client. This one’s mine.' }, { who: 'kettleman', text: 'There they are! Five hundred to whoever brings back the slate! Shoot anything that gets in the way!' }],
        kill: [{ who: 'kettering', if: { flag: 'beat_kettle' }, text: 'That’s another one on your account. I’m keeping it, every line of it, and I always collect.' }, { who: 'kettleman', text: 'Man down! Keep pushing, the rate’s gone up!' }],
        loss: [{ who: 'kettleman', if: { flag: 'beat_kettle' }, text: 'That’s for Vesk!' }, { who: 'kettleman', text: 'Got one! That’s a bonus! Who else wants to stand in front of us?' }],
        bhalf: [{ who: 'kettering', if: { flag: 'beat_kettle' }, text: 'Fall back! We’ll settle this somewhere they can’t hide behind a client.' }, { who: 'kettleman', text: 'Contract’s not worth this! Fall back, fall back, we bill them for it later!' }]
      },
      wraith: {
        start: [{ who: 'nine', if: { flag: 'beat_wraith' }, text: 'All Wraith units: it’s the company from the Glass Flats. This time they don’t walk away from it.' }, { who: 'nine', text: 'All Wraith units: weapons free. Officers and radios first. They don’t leave with anything.' }],
        kill: [{ who: 'nine', if: { flag: 'beat_wraith' }, text: 'Nine to all. They did this to us on Vantor. Not twice.' }, { who: 'nine', text: 'Nine to all. We lost one. Price of the job. Keep firing.' }],
        loss: [{ who: 'nine', if: { flag: 'beat_wraith' }, text: 'That one’s for the flats.' }, { who: 'nine', text: 'One down. Next.' }],
        bhalf: [{ who: 'nine', if: { flag: 'beat_wraith' }, text: 'Break contact. I have their faces now, every one of them. There’ll be a next time.' }, { who: 'nine', text: 'Wraith, break contact. The client gets a report, not a body count.' }]
      },
      sable: {
        start: [{ who: 'agathe', if: { flag: 'beat_sable' }, text: 'Sable Armour Group. You took my warehouse, {commander:rank}. I have been looking forward to this for some time.' }, { who: 'agathe', text: 'Sable Armour Group holds. Anything that crosses the line, destroy it.' }],
        kill: [{ who: 'agathe', if: { flag: 'beat_sable' }, text: 'Another hull. I will collect for Kerrigan and for this one together.' }, { who: 'agathe', text: 'A hull lost. It is insured; the ground is not. Close the gap. Nobody steps back.' }],
        loss: [{ who: 'agathe', if: { flag: 'beat_sable' }, text: 'That is one back for the warehouse.' }, { who: 'agathe', text: 'Target destroyed. Next one. They are paying for every metre of this.' }],
        bhalf: [{ who: 'agathe', if: { flag: 'beat_sable' }, text: 'Hold! We did not hold at Kerrigan, and I will not have it said twice.' }, { who: 'agathe', text: 'We are not finished while one of us is still standing.' }]
      },
      scavengers: {
        start: [{ who: 'scav', text: 'Lights out, everyone. They don’t know the station. We do. Nobody takes our salvage.' }],
        kill: [{ who: 'scav', text: 'They got Dobbs! Make them pay for Dobbs!' }],
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
        start: [{ who: 'hal', if: { flag: 'beat_reavers' }, text: 'It’s the beacon lot! You ran us off our claim and left us to those things! Get ’em!' }, { who: 'hal', text: 'Reavers! Nobody touches our claim! Boarders away!' }],
        kill: [{ who: 'hal', if: { flag: 'beat_reavers' }, text: 'Another one! You owe us a whole crew already!' }, { who: 'hal', text: 'They got one of mine! That comes off their share. Get in there!' }],
        loss: [{ who: 'hal', if: { flag: 'beat_reavers' }, text: 'That’s for the beacon!' }, { who: 'hal', text: 'Ha! One less to split it with! Who’s next?' }],
        bhalf: [{ who: 'hal', if: { flag: 'beat_reavers' }, text: 'Run for it! Again! I’ll remember your faces, company!' }, { who: 'hal', text: 'Not worth it! Grab what you’ve got and run for the boats!' }]
      },
      kestrel: {
        start: [{ who: 'rook', if: { flag: 'beat_kestrel' }, text: 'Kestrel, no cameras this time. Just put them down.' }, { who: 'rook', text: 'Kestrel, going in fast! Cameras rolling, guns hot!' }],
        kill: [{ who: 'rook', if: { flag: 'beat_kestrel' }, text: 'Another bird down. That’s twice you’ve cost me, company.' }, { who: 'rook', text: 'Bird down! Somebody get me eyes on whoever did that!' }],
        loss: [{ who: 'rook', text: 'Got one! Did we get that? Tell me we got that!' }],
        bhalf: [{ who: 'rook', text: 'Kestrel, pull out! Pull out! We can still make the evening feed!' }]
      },
      ulvar: {
        start: [{ who: 'ulvar', text: '[the wall holds. The wall has always held]' }],
        kill: [{ who: 'ulvar', text: '[a crack in something smooth]' }],
        loss: [{ who: 'ulvar', text: '[patience, endless and cold]' }],
        bhalf: [{ who: 'ulvar', text: '[the wall draws back, and gathers itself, and waits]' }]
      },
      amt: {
        start: [{ who: 'amt', text: '[something vast, opening one eye]' }],
        kill: [{ who: 'amt', text: '[mild surprise, from very far away]' }],
        loss: [{ who: 'amt', text: '[small, small, small]' }],
        wave: [{ who: 'ops', text: 'More of them, out of the walls! They just keep coming!' }],
        bhalf: [{ who: 'amt', text: '[the towers dim, one by one]' }]
      },
      lance: {
        start: [{ who: 'daw', if: { flag: 'beat_lance' }, text: 'Lance. The company that embarrassed us on Kerrigan. No court order this time, {commander:rank}. Just us.' }, { who: 'daw', text: 'Lance, take the log. Minimum force, but take it.' }],
        kill: [{ who: 'daw', if: { flag: 'beat_lance' }, text: 'That makes two. I do not lose to the same company three times.' }, { who: 'daw', text: 'That was one of mine, {commander:rank}. It goes on your bill. Lance, stop being gentle.' }],
        loss: [{ who: 'lancer', if: { flag: 'beat_lance' }, text: 'Paid in part. For the docking ring.' }, { who: 'lancer', text: 'Contact down. They’re not as good as their file.' }],
        bhalf: [{ who: 'daw', if: { flag: 'beat_lance' }, text: 'Disengage. Tell Mr Vane it costs more next time. I’m not doing this one for his money.' }, { who: 'daw', text: 'Lance, disengage. Mr Vane can pay for a second try.' }]
      }
    },

    /* The talks, where a battle is a Parley (story.js parleyFor; storybattle.js
       parleyOpen), as Deep Contract's are: each side's view heard, a compromise
       looked for, and an agreement or a fight. The Amt speak in brackets until
       they have learned enough of the company to use its words. */
    parleys: {
      // The Speaker: an Amt Alpha on the shore of Orlo's lake
      'speaker.battle': {
        them: 'amt', breakAt: 5, start: 'open', broke: 'fight',
        steps: {
          open: {
            say: [
              { text: '[a question, in every head at once, without words: what are you?]' },
              { if: { flag: 'beacon_rubbing' }, text: '[recognition: the ones who asked, at the beacon, and did not take]' },
              { if: { flag: 'beacon_stormed' }, text: '[recognition, cold: the ones who came to the beacon with fire]' },
              { if: { flag: 'alpha_taken' }, text: '[a name, and a loss: one of ours, in your hold]' }
            ],
            options: [
              { text: 'We’re soldiers. We were hired to follow a dead man’s road. Now we want to know where it ends.', trust: 1, next: 'stones' },
              { text: 'We came to talk. Nobody here fires unless you do.', trust: 1, next: 'stones' },
              { text: 'The one we took at the beacon is alive. We can bring it home.', if: { flag: 'alpha_taken' }, trust: 2, tension: -1, next: 'stones',
                reply: [{ text: '[a long silence, and then something like relief]' }] },
              { text: 'We hold the stones. We’ll decide what happens next.', tension: 2, next: 'stones',
                reply: [{ text: '[the lake goes very still]' }] }
            ]
          },
          stones: {
            say: [
              { text: '[the stones, in every head: each one a piece of a road, each one a way home]' },
              { text: 'The… stones. Your word. They are ours. They go home. Always, they go home.' },
              { text: 'The one you call Morrow carried them. We let him. He was taking them home.' }
            ],
            options: [
              { text: 'Then he was carrying them to you. And so are we, I think.', trust: 1, next: 'quiet' },
              { text: 'What happens when they all get home?', next: 'quiet',
                reply: [{ text: 'The Quiet wakes. And everything that is ours comes back to it.' }] },
              { text: 'They’re worth a fortune where we come from. Why should we give them up?', tension: 2, next: 'quiet',
                reply: [{ text: 'Because they are not yours. As the Esh-Aven are not ours, any more. We learn this. Slowly.' }] }
            ]
          },
          quiet: {
            say: [
              { text: 'The Quiet sleeps. We do not want it woken. Not by you. Not by your rivals. Not by the man who pays you.' },
              { if: { flag: 'eshaven_promise' }, text: 'You promised the Hashamer. We know. They told us, as they tell everything, in names.' }
            ],
            options: [
              { text: 'Then we want the same thing. Let it sleep.', trust: 1, next: 'terms' },
              { text: 'I made the Hashamer a promise. I mean to keep it.', if: { flag: 'eshaven_promise' }, trust: 2, next: 'terms' },
              { text: 'That’s not my decision. I’m paid to get to the end of the road.', next: 'terms' }
            ]
          },
          terms: {
            say: [{ text: 'Give us the stones, and leave the Quiet asleep. In return: the road there is open to you, and nothing of ours will stand in it.' }],
            options: [
              { text: 'The stones go home. You have my word, and my company’s name under it.', need: 2, terms: ['relics_returned'], next: 'deal' },
              { text: 'Some of them. The rest are what my company is owed.', need: 1, next: 'counter' },
              { text: 'No. The stones stay with us.', tension: 3, next: 'counter' }
            ]
          },
          counter: {
            say: [{ text: 'Some is not home. Some is still a road someone else can walk.' }],
            options: [
              { text: 'Then all of them. And we keep the rivals off the Quiet as long as we can.', need: 3, terms: ['relics_returned'], next: 'deal' },
              { text: 'That’s the offer.', tension: 2, next: 'last' },
              { text: 'Then we’re done talking.', tension: 5, next: 'fight' }
            ]
          },
          last: {
            say: [{ text: '[weighing; patience, wearing thin]' }],
            options: [
              { text: 'We are not your enemy. Nobody else who comes here will say that.', need: 2, next: 'deal' },
              { text: 'Take it or leave it.', tension: 3, next: 'fight' }
            ]
          },
          deal: {
            say: [
              { text: 'Then we will remember the other hands.' },
              { text: '[something like a bow, in every head at once]' }
            ],
            end: 'agreed'
          },
          fight: {
            say: [
              { text: '[the lake shivers, and the air beside the pylon opens]' },
              { who: 'ops', text: 'They’re coming through! Weapons up!' }
            ],
            end: 'broken'
          }
        }
      },

      // Last Terms: Vane in person, on the Quiet's landing field, owing the company for his receipts
      'collector.battle': {
        them: 'vane', breakAt: 5, start: 'open', broke: 'fight',
        steps: {
          open: {
            say: [
              { text: 'You have something of mine, {commander:rank}. Receipts. I have something you want: a way off this field alive, and paid.' },
              { if: { flag: 'beat_lance' }, text: 'You have also cost me the Lance’s good humour, which was more expensive than you know.' }
            ],
            options: [
              { text: 'You sold stones to every company on the trail, and paid us to race them. Explain that.', trust: 1, next: 'why' },
              { text: 'Name a price.', next: 'why' },
              { text: 'You’re in no position to bargain. Your receipts are on my ship.', tension: 2, next: 'why',
                reply: [{ text: 'And my company is on this field. Everybody here is in a position, {commander:rank}.' }] }
            ]
          },
          why: {
            say: [
              { text: 'A race needs runners. I bought them all. Whoever reached the end, I would own what they found. It is not personal. It is how a market works.' },
              { if: { flag: 'contact' }, text: 'And then you went and spoke to the things. That, I admit, I did not price in.' }
            ],
            options: [
              { text: 'The Quiet isn’t a market. There are people here. Of a kind.', if: { any: [{ flag: 'contact' }, { flag: 'eshaven_freed' }] }, trust: 1, next: 'terms' },
              { text: 'And what do you want now?', next: 'terms' },
              { text: 'You used my company like a counter on a board.', tension: 1, next: 'terms',
                reply: [{ text: 'I used every company. Yours is the one still standing. Consider it a compliment.' }] }
            ]
          },
          terms: {
            say: [{ text: 'My terms. You hand over the receipts. I file the claim. You take a fee that would make your company rich for a generation, and the Lance stands down.' }],
            options: [
              { text: 'No claim. The Quiet stays asleep and the stones go home, or the receipts go to every newsfeed in the sector.', need: 2, terms: ['relics_returned'], next: 'deal' },
              { text: 'The claim is yours. The receipts are yours. We take the fee and go.', need: 1, next: 'deal' },
              { text: 'The receipts go public either way.', tension: 3, next: 'last' }
            ]
          },
          last: {
            say: [{ text: 'That would be very foolish of you, {commander:rank}. I do not like foolish.' }],
            options: [
              { text: 'Then don’t make me be. No claim, and you keep your secrets.', need: 2, terms: ['relics_returned'], next: 'deal' },
              { text: 'Daw! Your employer’s finished. Stand down.', tension: 3, next: 'fight' }
            ]
          },
          deal: {
            say: [
              { text: 'Very well. It seems I have bought a great deal and own very little. That happens, in markets.' },
              { who: 'daw', text: 'Lance, stand down. It’s over.' }
            ],
            end: 'agreed'
          },
          fight: {
            say: [
              { text: 'Commander Daw. Remove them.' },
              { who: 'daw', text: 'Lance, weapons free.' }
            ],
            end: 'broken'
          }
        }
      }
    },

    /* What is said in each battle, at its moments: its own lines first, its
       enemy side's for the moments it has none of. */
    battles: {
      'c1.battle': {
        start: [
          { who: 'kettering', text: 'Hand over the slate, {commander:rank}, and everyone goes home. Otherwise we take it.' },
          { who: 'kettering', if: { flag: 'kettle_marked' }, text: 'They’re on us already! Who told them? Get up, all of you, and get that slate!' },
          { who: 'kettering', if: { flag: 'room_watched' }, text: 'You knew we were here and you came out anyway? Fine. Get the slate!' },
          { who: 'kettering', if: { flag: 'caught_out' }, text: 'There he is! Get the slate, lads!' }
        ],
        kill: [{ who: 'kettering', text: 'That’s another one down. This job is costing me a fortune.' }],
        turn3: [{ who: 'reader', text: 'I’m in the arcade, {commander:rank}! Which way? Tell me which way!' }],
        loss: [{ who: 'client', text: 'Don’t lose Halloran, {commander:rank}. Nobody else can read that log.' }],
        // Halloran brought down (hit, not killed: he gets away later, with his notes), or broken and running
        vipdown: [{ who: 'reader', text: 'I’m hit, {commander:rank}. The leg. I can’t — they’re taking the slate. They’ve got the slate.' }],
        vipfled: [{ who: 'reader', text: 'I’m not staying out here to be shot! I’m going back inside!' }]
      },
      'c1r.battle': {
        start: [{ who: 'kettering', text: 'They’re coming for the ship! Load what you can, and hold the ramp until we’re up!' }],
        searched: [{ who: 'ops', text: 'Not here. Crates of tinned fish and somebody’s laundry. Next one!' }],
        found: [{ who: 'ops', text: 'The case! It’s here, it’s the log! Get it off the field!' }],
        guard: [{ who: 'kettering', text: 'They’ve got the case! Five thousand to whoever gets it back on my ship!' }]
      },
      'c3s.battle': {
        start: [{ who: 'kettering', text: 'Not now! Of all the — guard the case! Hal, your boys too, or there’s no sale!' }],
        searched: [{ who: 'ops', text: 'Not on the boats. Just shovels and somebody’s lunch. Next!' }],
        found: [{ who: 'ops', text: 'The case! It’s the log! Get it off the bank!' }],
        guard: [{ who: 'kettering', text: 'That’s my merchandise! Nobody leaves this bank with it!' }]
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
      // ---- the second half ----
      'claim.battle': {
        start: [{ who: 'rook', if: { not: { flag: 'claim_escort' } }, text: 'Convoy’s rolling! Kestrel, keep them off the trucks, and somebody keep a camera on their commander!' },
          { who: 'hal', if: { flag: 'claim_escort' }, text: 'There’s the trucks, and Kestrel’s pet company riding along! Reavers, the cache is ours! Jump ’em!' }],
        turn3: [{ who: 'ops', text: 'Thin air up here. Everyone’s jumping further than they mean to. Watch your footing.' }],
        bhalf: [{ who: 'rook', if: { not: { flag: 'claim_escort' } }, text: 'This isn’t worth the footage! Kestrel, dust off!' },
          { who: 'rook', if: { flag: 'claim_escort' }, text: 'They’re breaking! Keep rolling, keep rolling, and somebody get me that shot!' }]
      },
      'wreck.battle': {
        start: [{ who: 'agathe', if: { not: { flag: 'wreck_together' } }, text: 'Sable holds the ship. Every bulkhead, every hold. Let them come in through the hull and find out.' },
          { who: 'agathe', if: { flag: 'wreck_together' }, text: 'Brass Ledger came in through the split while I was cutting the hatch. My people take the port holds, yours the starboard. Try to keep up.' }],
        turn3: [{ who: 'ops', text: 'Seals holding, but the air in here’s bad. Keep your masks on.' }],
        sighted: [{ who: 'ops', if: { not: { flag: 'wreck_together' } }, text: 'Contact! Sable armour, in the hold, dug in behind the cargo!' },
          { who: 'ops', if: { flag: 'wreck_together' }, text: 'Contact! Brass Ledger salvage crew, in the hold, cutting gear and guns!' }]
      },
      'bounty.battle': {
        start: [{ who: 'nine', text: 'Wraith, weapons free. Officers first. They don’t leave Ilya.' }],
        loss: [{ who: 'ops', text: 'Sniper! Get down, get down, they’re in the hills!' }]
      },
      'landing.battle': {
        start: [{ who: 'ops', text: 'The field, the Quiet. Their commander’s out there somewhere. Find them, and it’s over.' }],
        turn3: [{ who: 'reader', text: 'The towers are lighting, {commander:rank}. All along the horizon. They know we’re here.' }],
        target: [{ who: 'ops', text: 'Their commander’s hit! Keep the pressure on!' }]
      },
      'watchers.battle': {
        start: [{ who: 'ops', text: 'Three turrets, three domes. Bring them down and the pass is open.' }],
        kill: [{ who: 'ops', text: 'A dome’s flickering! Keep hitting it!' }]
      },
      'storm.battle': {
        start: [{ who: 'shkar', text: '[they step out of the air, and the air is full of them]' }],
        turn3: [{ who: 'ops', text: 'They keep coming! Where are they coming from?' }],
        bhalf: [{ who: 'shkar', text: '[the air closes behind them like water]' }]
      },
      'cold.battle': {
        start: [{ who: 'ops', text: 'Into the ruins. Room by room. Stay close, stay lit.' }],
        sighted: [{ who: 'ops', text: 'Contact! Mithdu, out of the sand! Dozens of them!' }]
      },
      'spire.battle': {
        start: [{ who: 'ops', text: 'Generators in chambers all the way up. Burn every one of them out.' }],
        wave: [{ who: 'ops', text: 'More of them, out of the walls! The tower’s making them!' }],
        bhalf: [{ who: 'amt', text: '[the hum falters, and the tower dreams of falling]' }]
      },
      'mimics.battle': {
        start: [
          { who: 'kettering', if: { flag: 'beat_kettle' }, text: 'Right, {commander:rank}. Vesk, and now this. When this is done, I’m sending you the bill for both.' },
          { who: 'kettering', text: 'Brass Ledger! Fill the cages, lads, and anybody standing in the way is a write-off!' }
        ],
        loss: [{ who: 'seven', text: 'We have lost one. Say the name with us, other hands, when this is done.' }],
        bhalf: [{ who: 'kettering', text: 'Back to the trucks! This manifest isn’t worth it!' }]
      },
      'speaker.battle': {
        start: [{ who: 'ops', text: 'Weapons grounded, everyone. Nobody so much as twitches.' }],
        parley: [{ who: 'ops', text: 'They’re coming through the air! The talks are over! Weapons up!' }],
        bhalf: [{ who: 'amt', text: '[sorrow, and the lake goes still]' }]
      },
      'signal.battle': {
        start: [{ who: 'reader', text: 'The beacon’s lit! Hold it, {commander:rank}, the signal needs time!' }],
        wave: [{ who: 'shkar', text: '[more, out of the fog, and more]' }],
        turn3: [{ who: 'reader', text: 'It’s calling. Can you hear it? Like a crowd, a long way off, all saying the same thing.' }]
      },
      'vault.battle': {
        start: [{ who: 'daw', text: 'Lance holds the vault. Nobody reaches the strongrooms.' }],
        turn3: [{ who: 'ops', text: 'Strongrooms ahead. There are stones in there, {commander:rank}. Dozens.' }]
      },
      'escort.battle': {
        start: [{ who: 'nine', text: 'Wraith, the trucks. Drivers first, escort if they get in the way.' }],
        turn3: [{ who: 'vane', text: 'My cargo, {commander:rank}. I’m watching it, every metre of the way.' }]
      },
      'debts.battle': {
        start: [{ who: 'daw', text: 'Lance, collect.' }]
      },
      'collector.battle': {
        start: [{ who: 'vane', text: 'Commander Daw. Remove them from my field.' }],
        target: [{ who: 'daw', text: 'I’m hit. Lance, hold. Hold!' }],
        bhalf: [{ who: 'vane', text: 'Pay them whatever they want, Daw. Just win.' }]
      },
      'recall.battle': {
        start: [{ who: 'ops', text: 'The ships are on the field! Run! Don’t stop for anything!' }],
        wave: [{ who: 'amt', text: '[HOME]' }],
        turn3: [{ who: 'ops', text: 'Halfway! Keep moving! Leave anything you can’t carry!' }]
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
