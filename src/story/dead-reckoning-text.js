/* PMC 2670 — Firefight : Dead Reckoning's words (docs/story-dead-reckoning-plan.md, phase 3)

   The story's prose, kept apart from its working (dead-reckoning.js), as
   Deep Contract's is. Keyed by what it belongs to:
     a chapter's id           its intro, on the chapter's card
     a node's id              its text (a brief, an event, a debrief, an interlude)
     'node/option'            an option's text
     'node/option.why'        why an option is closed
     'node#name'              a battle's mission name
   Anything not here keeps the one-liner in dead-reckoning.js. Text can name
   the company's own units ({unit:…}, {soldier:…}), the company ({name}), its
   commander ({commander}, {commander:rank}), and say one thing or another by
   what has happened ({if flag}…{/if}; `success` and `failure` are the last
   battle's, `relic` that the company came away with it).

   Written in full: the first half (chapters 1 to 4), both one-offs, and the
   events shared between chapters. The second half comes in phase 5. */
(function (root) {
  'use strict';
  root.PMCStoryText = root.PMCStoryText || {};
  root.PMCStoryText['dead-reckoning'] = {

    /* ================= 1. Lot 47 ================= */
    c1: 'Forty years ago a surveyor called Elias Morrow flew past the edge of the charts and came home with a hold full of carved stones that no human hand had made, and a log nobody could read. He died before he could sell either. Tonight the log comes up for auction in Vesk Free Port as Lot 47. Lucan Vane wants it. Nobody in the room has met Lucan Vane, and very few people anywhere have: he owns shipping lines, three banks and a moon, and he is known by his money and his voice on a scrambled line. He has hired {name} to see that his reader leaves the room with the log, and leaves the port alive.',
    'c1.brief': 'Vesk Free Port is a market with a landing field attached. The auction house stands on the square, its windows lit, its doors guarded by people who are not the auction house’s. Halloran, Vane’s chief reader, walks in with {commander:rank} at his elbow and a line open to his employer in his ear, and the room goes quiet for a moment, the way rooms do when they recognise whose money has come in.',
    'c1.bidding': 'Lot 47 is a battered data slate and a bundle of handwritten pages, and half the room wants it. Moss Kettering of Coin & Kettle is bidding in person, and smiling. Two of the bidders at the back are bidding for somebody else, and checking a screen between bids. In Halloran’s ear, Vane’s voice says only: “Whatever it takes.”',
    'c1.bidding/outbid': 'Have Halloran outbid them in the open, with the company at his back. Let the room see whose company it is.',
    'c1.bidding/watch': 'Let Halloran bid, and have the company watch the room: who leaves, who signals, who checks their weapons.',
    'c1.bidding/follow': 'Have Coin & Kettle’s agent followed out of the room the moment the hammer falls.',
    'c1.battle#name': 'Lot 47',
    'c1.battle': 'Vane has his log, and Coin & Kettle mean to take it off his reader in the market square before Halloran reaches the landing field on the far side. Get him across: Halloran is yours to move, and he is no soldier. Coin & Kettle are many and cheap, they will go for him and nothing else, and they will keep coming as long as somebody is paying.',
    'c1.debrief': '{if success}Coin & Kettle melt back into the market, leaving their wounded for the port to deal with. Halloran walks up the ramp of Vane’s ship with the log under his arm, and the line in his ear says: “Good.”{/if}{if failure}The log is held, but it was taken off Halloran once in the arcade and had to be taken back. Coin & Kettle know the company’s faces now, and its weak points.{/if}',
    'c1.agent': 'Kettering’s man is in the back of the company’s transport with his hands tied. He is young, frightened, and very keen to tell anyone who will listen that he was only paid to watch. Within the hour Kettering is on the line: return his man, or Coin & Kettle will treat the company as a standing contract.',
    'c1.agent/message': 'Let him go, with a message for Kettering: the company is not for sale, but it does listen.',
    'c1.agent/pay': 'Pay him for what he knows, and let him find his own way home.',
    'c1.agent/pay.why': 'The company can’t spare the money.',
    'c1.agent/police': 'Hand him to the port police, and make sure Vane hears you did.',
    'c1.interlude': 'The company lifts off Vesk with the log in Vane’s strongroom and his first heading on the navigator’s board. Morrow wrote no star fixes, only headings, times and what he saw. Halloran has been reading it for a week, and the readers he reports to disagree about where it starts.',

    /* ================= 2. The First Lodestone ================= */
    c2: 'Morrow’s first entry is a heading, a burn time, and a line: “Glass under me for a day and a night. Put the first stone where I could find it again.” Vane’s readers have found two places it could mean. The company can only follow one, and whoever follows the other will not be sharing.',
    'c2.brief': 'Two readings of the first heading, a day apart by jump, and both of them wrong in places. Vane leaves the choice to {commander:rank}. “You’re the one who has to dig,” says the voice on the line.',
    'c2.readings': 'One reading puts Morrow at a dig on a desert world called Vantor III, where a meteor once turned a plain to glass. The other puts him at Station Thule, a survey relay on an airless moon, where his log stops for three days. Kettering’s people have been seen buying cold-weather kit. Somebody else has been asking about Vantor.',
    'c2.readings/flats': 'The Glass Flats. If Morrow dug, there’s something buried.',
    'c2.readings/thule': 'Station Thule. If he stopped for three days, he left something behind.',

    'c2f.dig': 'The Glass Flats shine like a sheet of ice under two suns. Morrow’s dig is a ring of rusted marker posts, half buried, and Wraith Section is already camped beside it: a dozen low tents, a mast, and no sentries anyone can see. Nine, who leads them, sends a message on the open channel. It says: “We read your copy. We hold the dig. Turn back, or be fired on.”',
    'c2f.dig/night': 'Dig at night, when the glass is cold and the snipers can’t see far.',
    'c2f.dig/jam': 'Jam their comms first. Wraith is nothing without its listening.',
    'c2f.dig/jam.why': 'There is no Intel to spend on it.',
    'c2f.dig/rush': 'Go straight for the dig, now, before they’re ready.',
    'c2f.battle#name': 'The Glass Flats',
    'c2f.battle': 'Three places on the flats could be Morrow’s dig: a ring of marker posts, a half-buried shelter, a scorched hollow in the glass. One holds the lodestone. Search them, dig it out, and get it off the flats: carried home across your own edge, it is yours whatever else happens. Wraith Section fights from far away, and does not miss often. The gravity is light here, and everything moves further than it should.',
    'c2f.debrief': '{if relic}The lodestone is yours: a warm, dull stone the size of a palm, carved on every face in lines that are not writing, or not any writing anybody knows.{/if}{if not relic}You come away from the flats without the lodestone.{/if}',
    'c2f.drop': 'Wraith Section left in a hurry. Their camp still has a dead drop in it: a sealed case with their orders inside, and their copy of the company’s copy of the log.',
    'c2f.drop/read': 'Read their orders. Find out who they work for, and what they know.',
    'c2f.drop/warn': 'Leave a message in the drop, for Nine, and leave the rest alone.',
    'c2f.drop/take': 'Take back their stolen copy of the log.',
    'c2f.second': 'The stone got away from you. Whoever has it now is a step ahead, and they know you know.',
    'c2f.second/chase': 'Follow their dropship’s trail while it’s fresh. The company can rest later.',
    'c2f.second/dig': 'Let it go, and dig on. Morrow may have left more than one thing here.',

    'c2t.airlock': 'Station Thule is a dome on an airless moon, half buried in its own frozen breath. The main lock has been welded shut from inside, and something has been living in the station: scavengers, by the litter on the landing pad, and enough of them to have opinions about visitors.',
    'c2t.airlock/cut': 'Cut through the main lock and go in hard.',
    'c2t.airlock/hatch': 'Find Morrow’s maintenance hatch. His log mentions it, twice.',
    'c2t.airlock/pay': 'Pay them to leave. Nobody needs to die for a relay.',
    'c2t.airlock/pay.why': 'The company can’t pay them.',
    'c2t.battle#name': 'Station Thule',
    'c2t.battle': 'Station Thule is corridors and rooms under a dome, sealed against a vacuum outside. Its control room holds the relay’s archive, and Morrow’s three days are in it. The scavengers hold the station and know every corner of it. Take the control room and keep it: there is no air outside the walls, and nowhere to run to.',
    'c2t.debrief': '{if success}The station is the company’s, and so is the archive: three days of Morrow, talking to himself in an empty room.{/if}{if failure}The scavengers fired the archive on their way out. The air in the control room still smells of it.{/if}',
    'c2t.records': 'The relay kept everything Morrow said for three days. Most of it is to himself. Some of it is to the stone on the desk in front of him. He sounds frightened, and then, towards the end, he sounds happy.',
    'c2t.records/listen': 'Listen to all of it, every hour, with the company.',
    'c2t.records/send': 'Send the records to Vane. He’s paying for them.',
    'c2t.records/sell': 'Sell a copy to a newsfeed. Someone will pay well for a dead man’s voice.',
    'c2t.burned': 'The scavengers fired the archive. The racks are melted, but not all of them, and the company has a man who used to repair this kind of thing.',
    'c2t.burned/sift': 'Sift the ashes for whatever survived.',
    'c2t.burned/go': 'Take what’s left of the records and go. The rivals aren’t waiting.',
    'c2.interlude': 'The company jumps on. Whatever Morrow found at his first stop, it pointed him to a world of water and trees, and a thing standing in the water that he called the beacon.',

    /* ================= 3. The Drowned Beacon ================= */
    c3: 'Tessaly IV is a world of drowned forest under a permanent fog. Morrow’s beacon stands in the middle of it, half under water: a spire of something like stone and something like glass, older than anything humans have built, and humming. Nobody built it that anybody knows of. Morrow called it a beacon because it was lit. It is still lit. And the Red Reavers, who turn up wherever somebody else has done the work, are already digging at its foot.',
    'c3.brief': 'The landing craft sets down on a mud bank a mile from the beacon. The fog is thick enough to taste. The Reavers’ dig is lit up like a fairground, all floodlights and generators, and the instruments say there is something else moving in the fog: and that it stopped moving when the company landed.',
    'c3.contact': 'Big Hal Reaver has a crew of thirty in the shallows with cutting gear, going at the foot of the spire. He has seen the company land, and sends a message on the open channel: first come, first served, and he came first.',
    'c3.contact/storm': 'Storm the dig, now, while they’re still arguing about who you are.',
    'c3.contact/watch': 'Watch first. Learn the Reavers’ lines, and what else is moving out there.',
    'c3.contact/signal': 'Signal the beacon itself, on every band, as Morrow did. He got in and out alive.',
    'c3.battle#name': 'The Drowned Beacon',
    'c3.battle': 'Three places on the beacon’s island could hold its lodestone: the socket at the foot of the spire, a sunken shrine, a ring of standing stones in the shallows. One does. Find it, prise it loose, and carry it out across your own edge, or hold it when the fog closes in. The Reavers are between the company and all three. And whatever is moving in the fog has not finished deciding what to do about any of you.',
    'c3.debrief': '{if success}The beacon is quiet. The things that came out of the air have gone back into it; nobody saw how. The Reavers have gone too, and are telling everyone who will listen.{/if}{if failure}They drove the company off the island: tall, armoured, three-legged things that came out of nowhere and took no notice of a single shot. From the mud bank, the beacon is still lit.{/if}{if relic} The lodestone is in the company’s strongroom, and the beacon’s hum has dropped a note.{/if}',
    'c3.left': 'In the shelter of the spire, one of them is down: three legs folded under it, a carapace like wet ceramic, a slit of a helmet with lights in it that follow the company as it comes near. It is hurt, and it is not afraid. Above it, still in its socket, the beacon’s lodestone glows.',
    'c3.left/stone': 'Take the lodestone, and leave it where it lies.',
    'c3.left/leave': 'Leave the stone in its socket, and the hurt one with it.',
    'c3.left/both': 'Take both. Vane will pay anything for one of them alive.',
    'c3.left/gate': 'The air beside the spire is still open where they stepped out of it. Step through.',
    'c3.left/gate.why': 'The air closed behind them.',
    'c3.copy': 'A message reaches the company in orbit, from Moss Kettering. Someone, he does not say who, would pay handsomely for a copy of the chart so far. He names a sum that would buy the company a great many things, and adds that if the chart is not for sale, his client has asked him to price the alternative.',
    'c3.copy/sell': 'Sell them a copy. Vane hasn’t earned your loyalty.',
    'c3.copy/sell.why': 'You still work for Vane, and he still trusts you.',
    'c3.copy/refuse': 'Refuse, and say nothing to Vane.',
    'c3.copy/report': 'Refuse, and tell Vane exactly who asked.',
    'c3.interlude': 'The company leaves Tessaly IV with the fog closing behind it, and nobody aboard says what they saw, because nobody has a word for it. Vane, on the line, asks for a full report, and then for every frame of footage, and then says nothing at all for a long time. The next heading in Morrow’s log is crossed out, and a note beside it in someone else’s hand says: “Sold. Kerrigan.”',

    /* ================= 4. The Broker ================= */
    c4: 'Somebody got to Morrow’s next stop before anyone in the race was born, and sold what was there. The buyer’s heirs have just put it back on the market. Coin & Kettle’s broker on Kerrigan is auctioning the next heading again, to everyone, and Sable Armour Group has bought the warehouse it sits in.',
    'c4.brief': 'Kerrigan is docks and cranes and the smell of reaction mass. Sable Armour Group has parked its tanks in a warehouse on the waterfront and its colonel in the broker’s office. Everybody in the race has a seat at the broker’s table, and nobody has sat down.',
    'c4.lot': 'Colonel Agathe Sable does not bid. She has the warehouse, the heading is in the warehouse, and her tanks are in front of it. She will sell the company a seat at her table, at her price. Anyone who tries to take one instead, she says, will be shot before they reach the door. It is not a threat; it is the terms of her contract.',
    'c4.lot/buy': 'Buy the heading, at the broker’s price.',
    'c4.lot/buy.why': 'The company can’t afford the broker’s price.',
    'c4.lot/take': 'Take the warehouse. Sable dares anyone to; dare back.',
    'c4.lot/follow': 'Let Sable have it, and follow Sable wherever she goes next.',
    'c4.lot/hire_kettle': 'Hire Coin & Kettle for the takeover. They know the docks.',
    'c4.battle#name': 'The Broker’s Warehouse',
    'c4.battle': 'Sable’s warehouse stands in the middle of the docks, dug in and walled, with the heading in its strongroom. Sable Armour Group fights from inside steel and does not move unless it has to. Take the warehouse and hold it, and the heading is the company’s; let Sable hold it, and she sells it to somebody else.',
    'c4.debrief': '{if success}The warehouse is the company’s. The heading was in a strongbox in the office, behind the broker’s desk, and the broker is very sorry.{/if}{if failure}Sable keeps the warehouse, and the heading goes to the highest bidder. The company was not it.{/if}',
    'c4.copies': 'The broker has been selling copies of the heading all week, to everyone who could pay. He has five left, and a ship to catch.',
    'c4.copies/burn': 'Burn his stock, in front of him.',
    'c4.copies/buyall': 'Buy every copy he has left.',
    'c4.copies/buyall.why': 'The company can’t afford them all.',
    'c4.copies/let': 'Let him go. Everybody has a copy anyway.',
    'c4.interlude': 'Morrow’s log runs out of easy headings at Kerrigan. From here on he wrote less and less, and what he wrote was mostly about the stones, which had started to point, and about the ones who keep them, whom he never names.',

    /* ================= Into the Warren (one-off) ================= */
    warren: 'The company stepped through the air at the beacon, and came out underground, on a world that is on nobody’s chart, in tunnels older than anything on the human record. The way behind is closing. The Red Reavers came through first, after whatever is down here, and they are not the only ones in the dark.',
    'warren.brief': 'The air is thick and warm and tastes of metal, and the instruments say there is radiation in the rock, not enough to kill quickly. The tunnels are high and wide, cut for something taller than a man, and something has been walking through them for a very long time.',
    'warren.other': 'Behind the company, the way back is shrinking: a ring of light in the rock, closing. Ahead, the tunnels branch, and somewhere down them the Reavers are shouting at each other. Under the shouting there is something else, not quite a sound, in a language that feels like a headache.',
    'warren.other/hold': 'Hold the gate open with charges. The company needs a way home.',
    'warren.other/close': 'Let it close. The company will find another way.',
    'warren.other/voices': 'Follow the other sound.',
    'warren.battle#name': 'Into the Warren',
    'warren.battle': 'The tunnels are corridors and chambers, warm, close and dark. The Reavers have dug in among them with the hoard they came for. Clear them, room by room, until the way out is open. And keep an eye on the walls: the Reavers keep firing at them.',
    'warren.debrief': '{if success}The company comes out the long way round, into daylight, on a world that is on nobody’s chart. It had better start being on one.{/if}{if failure}The company gets out, but not the way it went in, and not all of it.{/if}',
    'warren.hoard': 'Deep in the tunnels, past where the Reavers stopped, there is a chamber of relics: hundreds of them, in rows, as carefully kept as a library. Somebody keeps it. Among them is a lodestone that no rival will ever know about.',
    'warren.hoard/stone': 'Take the lodestone, and only the lodestone.',
    'warren.hoard/all': 'Take everything the company can carry.',
    'warren.hoard/mark': 'Take nothing, and mark the way here. Whoever keeps it should be asked first.',
    'warren.interlude': 'The company finds its ship where it left it, on Tessaly IV, two days and a whole world later. Nobody in the company talks about the warren much, and nobody forgets it.',

    /* ================= The Double-Cross (one-off) ================= */
    doublecross: 'Lucan Vane has a company of his own: the Ninth Lance, as expensive as its name, and as hard to find on any register as he is. It docks beside the company’s ship on Kerrigan’s orbital with a court order in its commander’s hand, and its weapons hot.',
    'dx.brief': 'Commander Iselin Daw of the Ninth Lance comes aboard alone, with two pages of legal text and a very calm voice. Vane has terminated the company’s contract for breach, and the log is his property. The Lance has come to collect it.',
    'dx.repo': '“Hand back the log,” Daw says, “and you walk away with your pay to date. That’s generous, and Vane knows it. Refuse, and I take it. Fire on my people, and I won’t be the one who decides what happens next.”',
    'dx.repo/hand': 'Hand back the log. It isn’t worth the company.',
    'dx.repo/refuse': 'Refuse. If he wants it, he can come out of hiding and take it.',
    'dx.repo/fire': 'Fire first, while Daw is still on your deck.',
    'dx.battle#name': 'The Double-Cross',
    'dx.battle': 'The orbital’s docking ring is cranes, cargo stacks and open deck, under heavy spin gravity that makes every step a labour. The Ninth Lance is small, expensive and very good: every unit it has is better than the company’s best. Break them, and the log stays where it is.',
    'dx.debrief': '{if success}The Lance pulls back to its ship and casts off. Daw salutes from the airlock, which is either very professional or very insulting.{/if}{if failure}The Lance takes what it came for, and a lodestone besides.{/if}',
    'dx.terms': 'Vane’s lawyer calls before the smoke has cleared the deck. Her client is prepared to be reasonable. Her client always is, when reason is cheaper.',
    'dx.terms/pay': 'Pay him for the log, and be his company again, on paper.',
    'dx.terms/pay.why': 'The company can’t pay him.',
    'dx.terms/tell': 'Tell him where to put his offer.',
    'dx.terms/offer': 'Offer him the next lodestone the company finds.',
    'dx.interlude': 'The company jumps on with the log and without a patron. Every company on the trail has heard by now, and some of them have started calling.',

    /* ================= between chapters ================= */
    'i.wake': 'The company buries its own, on a world none of them had heard of a month ago.',
    'i.wake/pay': 'Pay the death benefits in full, out of the company’s own pocket.',
    'i.wake/pay.why': 'The company can’t pay them.',
    'i.wake/dont': 'Put it off. The company needs the money for the next jump.',
    'i.sendahead': 'Vane wants a lodestone sent ahead to his vault, now, by courier, to an address that changes twice before the courier lands. He doesn’t say why. He doesn’t have to.',
    'i.sendahead/send': 'Send it. He’s paying.',
    'i.sendahead/refuse': 'Refuse. The stones stay with the company until the end of the trail.',
    'i.voices': '{soldier:veteran} has started hearing them: voices, at night, when the lodestones are near. Not words. Something like a crowd, a long way off, all saying the same thing.',
    'i.voices/listen': 'Sit up with them, and listen.',
    'i.voices/home': 'Send them home, on the next ship, with full pay.',
    'i.warm': 'The lodestones are warm. All of them, in their case, and pointing the same way, like compass needles. Nobody has touched them.',
    'i.warm/follow': 'Follow where they point.',
    'i.warm/shield': 'Shield the case, and stop them calling to whatever they’re calling.',
    'i.warm/shield.why': 'The company can’t afford the shielding.',
    'i.newsfeed': 'Rook Kestrel calls in person, from a ship full of cameras. Her newsfeed wants pictures from the trail, and pays for them better than Vane pays for anything.',
    'i.newsfeed/sell': 'Sell them pictures. Leave out anything that matters.',
    'i.newsfeed/refuse': 'Refuse. Nobody on the trail needs to see where the company has been.',
    'i.catalogue': 'Coin & Kettle are selling what they know about the race, in a neat catalogue, to anyone. There is a page about the company in it.',
    'i.catalogue/buy': 'Buy the catalogue.',
    'i.catalogue/buy.why': 'The company can’t afford it.',
    'i.catalogue/sell': 'Sell them a page or two of your own.',
    'i.jump': 'The jump drive is failing, slowly, the way old drives do. There is a yard on the way, and the yard has a price.',
    'i.jump/yard': 'Put in at the yard and pay for the work.',
    'i.jump/yard.why': 'The company can’t pay the yard.',
    'i.jump/jump': 'Jump anyway, and trust the engineers.',

    /* ---- the hired guns ---- */
    'hired.invoice': 'Coin & Kettle’s invoice arrives before the dust settles, and it is for more than was agreed: hazard pay, ammunition, a line marked “sundries”.',
    'hired.invoice/pay': 'Pay it. Good help costs.',
    'hired.invoice/pay.why': 'The company can’t pay it.',
    'hired.invoice/dispute': 'Dispute every line.',
    'hired.invoice/share': 'Offer them a share of the claim at the end instead.',
    'hired.edit': 'Kestrel’s cameras were rolling the whole time. Rook wants to cut the footage her way, and her way makes Kestrel the heroes.',
    'hired.edit/theirs': 'Let her cut it. Pictures are her business.',
    'hired.edit/raw': 'Demand the raw footage first.',
    'hired.edit/interview': 'Give her an interview instead: the company, in its own words.',
    'hired.mess': 'The Red Reavers have left a mess where they fought: the dead stripped, the wounded left, and something on fire that should not be.',
    'hired.mess/pay': 'Pay them off and walk away from it.',
    'hired.mess/pay.why': 'The company can’t pay them.',
    'hired.mess/clean': 'Make them clean it up, at gunpoint if it comes to that.',
    'hired.mess/look': 'Look the other way. They fought well.',
    'hired.favour': 'Colonel Sable sends word: the favour is paid, and Sable Armour Group owes the company nothing more.',
    'hired.favour/thank': 'Thank her properly, and mean it.',
    'hired.favour/again': 'Ask whether she’d do it again.',
    'hired.kettleoffer': 'Moss Kettering calls, not in the least apologetic: someone has offered Coin & Kettle more than the company is paying, and business is business. Match it by the end of the day, or the next time his lads see the company it will be over their sights.',
    'hired.kettleoffer/match': 'Match the offer.',
    'hired.kettleoffer/match.why': 'The company can’t match it.',
    'hired.kettleoffer/let': 'Let them go to whoever it is.',
    'hired.reaversoffer': 'Big Hal has had a better offer, and is honest enough to say so, which for Hal is a kind of loyalty.',
    'hired.reaversoffer/match': 'Match it.',
    'hired.reaversoffer/match.why': 'The company can’t match it.',
    'hired.reaversoffer/let': 'Let them go.'
  };
})(typeof window !== 'undefined' ? window : global);
