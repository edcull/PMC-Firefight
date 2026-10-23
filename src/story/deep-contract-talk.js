/* PMC 2670 — Firefight : Deep Contract's voices in battle

   What is said over the radio, shouted across the table or broadcast from a
   loudhailer while a story battle is fought: a card with the speaker's face,
   put up when something happens (storybattle.js `storyTalk`). Each battle says
   each thing at most once.

   The moments:
     start    the battle begins (turn 1)
     turn3    the start of turn 3
     kill     side B loses its first unit
     loss     the company loses its first unit
     bhalf    side B has lost half its units
     ahalf    the company has lost half its units
     wave     the first wave comes out of the tunnels
     parley   the talks break down
     target   the battle's target is hurt

   `sides` holds what each enemy says anywhere; `battles`, keyed by a battle's
   node (a side contract's is '@side:<job>'), what is said in that one battle,
   taken first; `allies`, what the allies say, by the side they come from.
   A moment with several lines picks one whose `if` holds (a test,
   as an option's), at random; a line with an `if` that holds comes before
   those without one. Text is written as the story's prose is: {name},
   {commander}, {commander:rank}, {if flag}…{/if}. `who` is one of the story's
   people, these voices among them. */
(function (root) {
  'use strict';
  root.PMCStoryTalk = root.PMCStoryTalk || {};

  root.PMCStoryTalk['deep-contract'] = {
    // the voices heard in battle, beside the story's people
    people: {
      ops: { name: 'Company net', role: 'Your radio operator', face: { bg: '#6a8a6a', skin: '#c99a76', hair: '#3a2a1a', hairStyle: 'short', hat: 'cap', hatColour: '#3d4a38', clothes: '#4a5a40', clothesStyle: 'uniform', accent: '#d8c070', extras: ['stubble'] } },
      fighter: { name: 'A Front fighter', role: 'The Free Miners’ Front', face: { bg: '#b0502c', skin: '#9a6a48', hair: '#2a2018', hat: 'hardhat', hatColour: '#d89a20', clothes: '#4a3a2e', clothesStyle: 'overalls', accent: '#b03a2e', extras: ['bandana', 'stubble'], bandana: '#b03a2e' } },
      captain: { name: 'Captain Ilse Varn', role: 'Master of the hauler Patient Margin', face: { bg: '#3a4a6e', skin: '#e2b48f', hair: '#c8c0b0', hairStyle: 'bun', hat: 'cap', hatColour: '#1e2638', clothes: '#1e2638', clothesStyle: 'uniform', accent: '#d8c070', extras: ['scar'], eyes: '#5a7a9a' } },
      liaison: { name: 'Director Calder Hale', role: 'HTX, Kessler\u2019s Reach operations', face: { bg: '#5fb4d2', skin: '#d8a682', hair: '#3a2a1a', hairStyle: 'short', clothes: '#22262e', clothesStyle: 'suit', accent: '#3a8fb0', extras: ['glasses'], eyes: '#4a5a6a' } },
      commander: { name: 'The commander', role: 'Your company', face: { bg: '#8a7a5a', skin: '#c99a76', hair: '#2b2622', hairStyle: 'short', hat: 'cap', hatColour: '#3d4a38', clothes: '#4a5240', clothesStyle: 'uniform', accent: '#e0c25a', extras: ['stubble'] } },
      portguard: { name: 'Port security', role: 'The starport\u2019s guard', face: { bg: '#7fa3b9', skin: '#d8a682', hair: '#5a3a22', hairStyle: 'short', hat: 'cap', hatColour: '#2f3e5a', clothes: '#2f3e5a', clothesStyle: 'uniform', accent: '#e8c25a', extras: ['moustache'] } },
      garrison: { name: 'Garrison sergeant', role: 'HTX\u2019s refinery garrison', face: { bg: '#8a9a7a', skin: '#b07a55', hair: '#1d1612', hairStyle: 'bald', hat: 'helmet', hatColour: '#55604a', clothes: '#4a5240', clothesStyle: 'armour', accent: '#c8a040', extras: ['stubble', 'scar'] } },
      actual: { name: 'Lantern Actual', role: 'Black Lantern Security', face: { bg: '#d8b84a', skin: '#b88a66', hair: '#222', hairStyle: 'short', hat: 'visor', hatColour: '#1e1e24', clothes: '#2c2c34', clothesStyle: 'armour', accent: '#e0c25a', extras: ['scar'] } }
    },

    /* Conversations on the story's own pages, before the page's text: keyed by
       the node they open. `commander` is the company's own commander, named. */
    conversations: {
      'c1.brief': [
        { who: 'captain', text: 'Patient Margin to {name}. We\u2019ve made orbit over Kessler\u2019s Reach. Ten hours late, and the starport\u2019s beacon is the only one still lit on the whole moon.' },
        { who: 'captain', text: 'Something down there took a shot at our approach lights on the way in. Small arms, from the town. I\u2019m not putting my ship on the ground.' },
        { who: 'liaison', text: 'Welcome to Kessler\u2019s Reach, {commander:rank}. Calder Hale, HTX operations. I\u2019ll be your contact for the length of the contract.' },
        { who: 'liaison', text: 'The miners have stopped working and started shooting. They call themselves the Free Miners\u2019 Front. They hold half the shafts, the roads, and they want the starport.' },
        { who: 'commander', text: 'And HTX wants?' },
        { who: 'liaison', text: 'Order restored. Quickly, and quietly. The board would rather not see this moon on the news. Hold the port, and the rest of your contract can land behind you.' },
        { who: 'commander', text: 'Anything I should know about why they rose?' },
        { who: 'liaison', text: 'Pay disputes. Agitators. It\u2019s all in the briefing pack.' },
        { who: 'captain', text: 'Shuttle\u2019s on the rail, {commander:rank}. You drop in ten. After that, you\u2019re on your own until the next run.' },
        { who: 'okonkwo', text: 'Port Master to incoming shuttle\u2014pad three, the last one standing. Come in fast and low. They\u2019ve a launcher somewhere on the terminal roof.' }
      ],

      // ---- the contract ----
      'c2.brief': [
        { who: 'liaison', text: 'You’ve seen the sheet, {commander:rank}. Two jobs, one budget. HTX would like an answer by morning.' },
        { who: 'commander', text: 'And the night shift in Number Three?' },
        { who: 'liaison', text: 'Is insured. The depot is the better buy. Starve the Front of guns, and the refinery sorts itself out.' },
        { who: 'guild', text: 'Guild to whoever’s listening. Those are our people in Number Three, with families in the Pits. Don’t let HTX tell you they’re numbers.' },
        { who: 'ops', text: 'Trucks are fuelled both ways, {commander:rank}. Your call.' }
      ],
      'c3.brief': [
        { who: 'liaison', text: 'We’ve found her. Ada Varga, at the pumping station above the old workings. Finish her, and this ends.' },
        { who: 'commander', text: 'Your map has the levels under it marked in red.' },
        { who: 'liaison', text: 'Sealed levels. Unsafe. You will not need to go down there.' },
        { who: 'ops', text: 'Picking her up on an open channel, {commander:rank}. She’s talking to us.' },
        { who: 'varga', text: 'So HTX sent its dogs. Come and get me, {name}. But ask HTX what’s under the station first.' }
      ],
      'c4.brief': [
        { who: 'liaison', text: 'Pit Nine has gone over. Six thousand people. Our site manager stopped answering last night.' },
        { who: 'liaison', text: 'The office holds records belonging to the Deep Contract. They are to be secured. Not read. Secured.' },
        { who: 'commander', text: 'What is the Deep Contract?' },
        { who: 'liaison', text: 'Above your pay grade, {commander:rank}.' },
        { who: 'teacher', text: 'This is the Pit Nine school, on the town band. There are still children here. Whoever is coming—please, remember that.' },
        { who: 'fighter', text: 'Pit Nine is free. Tell HTX to come and take it.' }
      ],
      'sump.brief': [
        { who: 'ops', text: 'Lights low. We lose the surface net past the second level.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: '{commander:rank}, you are in a restricted area. Return to the surface immedi—' },
        { who: 'commander', text: 'These aren’t mine workings. Look at the walls.' },
        { who: 'ops', text: 'Something cut these. And not long ago.' },
        { who: 'hive', text: '[far below, something answers the echo of your boots]' }
      ],
      'relief.brief': [
        { who: 'liaison', text: 'HTX thanks {name} for its service. Your contract is terminated, effective at dawn.' },
        { who: 'commander', text: 'Terminated. Because I asked questions.' },
        { who: 'liaison', text: 'Because you were slow and expensive. Hand over your sector to your relief, and you’ll be paid to date.' },
        { who: 'ops', text: 'Six dropships inbound for dawn, {commander:rank}. Black Lantern colours. Those aren’t cargo haulers.' },
        { who: 'okonkwo', text: 'My people won’t take orders from HTX’s new dogs. Whatever you decide, the port is with you.' }
      ],

      // ---- fault lines ----
      'fault.brief': [
        { who: 'ops', text: 'Every channel’s a mess, {commander:rank}. The Front’s split, the shafts howl every night, and HTX sends a new order every hour.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'HTX will go on paying for results. Only for results.' },
        { who: 'ops', if: { flag: 'htx_cut_off' }, text: 'And HTX has stopped answering. Accounts says the last payment bounced.' },
        { who: 'commander', text: 'Then we pick our own work, and live with what we leave.' },
        { who: 'guild', text: 'The miners will talk to you now, if you’ll listen.' }
      ],
      'retake.brief': [
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'Number Three. HTX wants its refinery back, and its tank farm in one piece.' },
        { who: 'guild', text: 'Half the men in there used to work it. Don’t burn it down round them.' },
        { who: 'fighter', text: 'Number Three belongs to the people who sweat in it. Come and take it, if you can.' },
        { who: 'ops', text: 'They’ve had weeks to dig in, {commander:rank}. This won’t be quick.' }
      ],
      'revenge.brief': [
        { who: 'fighter', if: { flag: 'varga_dead' }, name: 'Tomas Varga', role: 'Her brother, and the Front now', text: 'You killed my sister. I was a schoolteacher, {commander:rank}. You made me this.' },
        { who: 'varga', if: { flag: 'varga_free' }, text: 'You should have finished it at the pumping station, {commander:rank}. You won’t get another chance.' },
        { who: 'ops', text: 'Every Front cell on the ridges is moving. They’re coming for us, not for HTX.' },
        { who: 'commander', text: 'Then we meet them on ground we choose.' }
      ],
      'splinter.brief': [
        { who: 'fighter', name: 'The cell', role: 'The hill country', text: 'The Front talks. We don’t. Every camp, every convoy, until HTX leaves this moon.' },
        { who: 'varga', if: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }, text: 'They aren’t mine any more. They won’t listen to me, and they won’t stop.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'Their bomb-maker took out a survey camp yesterday. HTX wants him.' },
        { who: 'ops', text: 'Woods round the old mine head. They’ll see us long before we see them.' },
        { who: 'commander', text: 'Then we go in quiet, and we find the bomb-maker first.' }
      ],
      'redoubt.brief': [
        { who: 'varga', if: { all: [{ flag: 'truce' }, { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }] }, text: 'The hardliners won’t take the truce. Finish it, {commander:rank}, before they finish the peace.' },
        { who: 'front', if: { all: [{ flag: 'truce' }, { not: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] } }] }, text: 'The hardliners won’t take the truce, and they won’t listen to us. Finish it, {commander:rank}, before they finish the peace.' },
        { who: 'fighter', if: { not: { flag: 'truce' } }, text: 'This hill is the last free ground on Kessler’s Reach. We are not leaving it.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'End it. HTX will pay for the shells.' },
        { who: 'commander', text: 'They chose their hill. Let’s see if they chose well.' },
        { who: 'ops', text: 'They’ve had weeks up there, {commander:rank}. They’ll fight for every yard of it.' }
      ],
      'ceasefire.brief': [
        { who: 'varga', if: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }, text: 'I’ll talk, {commander:rank}. At the way station. Not because I trust you. Because the shafts are getting louder.' },
        { who: 'front', if: { not: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] } }, text: 'The Front will talk, {commander:rank}. At the way station. Not because we trust you. Because the shafts are getting louder.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'HTX has authorised no negotiation. Whatever you agree, we don’t.' },
        { who: 'commander', text: 'Then I’ll agree it without you.' },
        { who: 'guild', text: 'Make it happen, {commander:rank}, and the whole moon owes you.' }
      ],
      'holdline.brief': [
        { who: 'guild', text: 'They’re coming through the pass, everyone from out past the shafts. Families. Front fighters. All of them.' },
        { who: 'ops', text: 'The trackers behind them are solid. The bugs are a mile back, and closing.' },
        { who: 'varga', if: { all: [{ flag: 'truce' }, { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }] }, text: 'My people will hold beside yours. For once we’re on the same side of something.' },
        { who: 'front', if: { all: [{ flag: 'truce' }, { not: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] } }] }, text: 'The Front will hold beside you. For once we’re on the same side of something.' },
        { who: 'commander', text: 'Nobody gets left on the wrong side of that pass.' }
      ],
      'outbreak.brief': [
        { who: 'guild', text: 'Pit Nine’s lower levels went quiet last night. The lift cages keep coming up empty.' },
        { who: 'teacher', if: { flag: 'pit9_spared' }, text: 'The school is full of families from the lower town. Please hurry.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: '{commander:rank}, HTX considers the galleries a total loss. Seal them, if you have to.' },
        { who: 'ops', text: 'There’s something in the cage shaft. It’s climbing.' }
      ],
      'shafts.brief': [
        { who: 'ops', text: 'The engineers count twelve breaches. Every one of them cleared, or sealed.' },
        { who: 'guild', text: 'Those are our shafts. Seal them all and there’s no work left on this moon.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'Whatever you see down there is covered by your non-disclosure clause.' },
        { who: 'hive', text: '[a draught from the shaft mouth: warm, and smelling of something alive]' }
      ],
      'hiveheart.brief': [
        { who: 'ops', text: 'This is it. The brood chambers are under everything. Below the Sump.' },
        { who: 'guild', text: 'Nobody who has gone that deep has come back. Bring them back, {commander:rank}.' },
        { who: 'commander', text: 'We go down, we burn it, we come up. In that order.' },
        { who: 'hive', text: '[the whole moon seems to draw a breath]' }
      ],
      'partner.brief': [
        { who: 'liaison', text: 'HTX has engaged Black Lantern Security to work alongside you. A partnership.' },
        { who: 'actual', text: 'Lantern Actual. Good to meet you, {commander:rank}. Stay out of my way and we’ll get on fine.' },
        { who: 'commander', text: 'And your orders?' },
        { who: 'actual', text: 'Are my orders.' },
        { who: 'ops', text: 'Lantern’s running a second net, encrypted. They aren’t talking to us on it.' }
      ],
      'leak.brief': [
        { who: 'ops', text: 'It’s all here. The Deep Contract. HTX knew what was down there before they opened the first shaft.' },
        { who: 'commander', text: 'And sent the miners down anyway.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: '{commander:rank}, think very carefully. Your contract has a clause about confidential material. It is a long clause.' },
        { who: 'actual', text: 'The uplink is ours. Anyone who touches the dish answers to Black Lantern.' },
        { who: 'guild', text: 'Send it. Let every miner’s family in the sector read it.' }
      ],
      'convoy.brief': [
        { who: 'ops', if: { flag: 'core_recovered' }, text: 'The core’s loaded. Far landing field, across the whole moon.' },
        { who: 'liaison', if: { not: { flag: 'core_recovered' } }, text: 'Twenty ore trucks to the far landing field. Black Lantern will be… watching.' },
        { who: 'actual', text: 'Lantern Actual to {name}. Long road. Lots of places for things to go wrong.' },
        { who: 'petrak', text: 'I know that road. The cuttings, the bridge at kilometre forty. If I were them, I’d hit you at the bridge.' },
        { who: 'commander', text: 'Then we’re over the bridge before they are.' }
      ],
      'showdown.brief': [
        { who: 'actual', text: 'This is Lantern Actual. HTX has paid for you to disappear, {commander:rank}. I always deliver.' },
        { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'This is regrettable, {commander:rank}. It could have been avoided.' },
        { who: 'commander', text: 'Tell the board it was.' },
        { who: 'ops', text: 'They’re dug in round the headquarters. Everything they’ve got.' }
      ],
      'breakout.brief': [
        { who: 'liaison', text: 'Orbital sterilisation is authorised. The board has written Kessler’s Reach off. The strikes begin in four hours.' },
        { who: 'commander', text: 'There are thousands of people down here.' },
        { who: 'liaison', text: 'There were. Good luck, {commander:rank}.' },
        { who: 'captain', text: 'Patient Margin, back in orbit. I’ve one shuttle coming down on the slag fields, {commander:rank}, and it won’t wait. Neither will I.' },
        { who: 'ops', text: 'All units. Run.' }
      ]
    },

    /* The allies, by the side they come from (a battle's `allies`): what they
       say as the table is laid and the force placed (`report`), and in answer to each order (Move
       here, Attack here, Hold here, and the order withdrawn), taken in turn. */
    allies: {
      port: { who: 'portguard',
        report: ['Port security, two squads at the terminal, ready. We know every fence on this field\u2014point us at them.'],
        move: ['Moving. Keep their heads down for us.', 'On our way.'],
        attack: ['Port security going in!', 'Understood. We\u2019ll take it to them.'],
        hold: ['We\u2019ll hold there. Nobody gets onto our pads.', 'Holding. Dug in.'],
        clear: ['Understood. We\u2019ll use our own judgement.'] },
      garrison: { who: 'garrison',
        report: ['What\u2019s left of the garrison, reporting. We\u2019ve held this place for three days. Tell us where you need us.'],
        move: ['Moving, {commander:rank}.', 'Shifting position.'],
        attack: ['About time. Garrison, advance!', 'Going in.'],
        hold: ['Holding there. We\u2019re good at holding.', 'We\u2019ll hold.'],
        clear: ['Right. We\u2019ll manage.'] },
      front: { who: 'fighter',
        report: ['The Front is here, {name}. Don\u2019t get used to it.', 'Miners in position. We fight for the moon, not for HTX. Remember that.'],
        move: ['We\u2019re moving. Don\u2019t shoot us in the back.', 'Going.'],
        attack: ['Now you\u2019re talking. Miners, with me!', 'For the Reach!'],
        hold: ['We\u2019ll hold it. We\u2019ve held worse.', 'We stay. Nobody moves us.'],
        clear: ['Fine. We\u2019ll fight our own way.'] },
      lantern: { who: 'actual',
        report: ['Black Lantern detachment on your flank. Try to keep up, {name}.'],
        move: ['Relocating. Copy.', 'Moving.'],
        attack: ['Weapons free. Lantern, advance.', 'Engaging.'],
        hold: ['Holding the position. Copy.', 'We\u2019ll hold.'],
        clear: ['Acting on our own initiative. Lantern out.'] }
    },

    sides: {
      front: {
        start: [
          { who: 'fighter', text: 'This is our moon, hired guns. Go home while you still can.' },
          { who: 'fighter', text: 'HTX pays you by the corpse, does it? Come and earn it.' },
          { who: 'fighter', text: 'Shut HTX down! Shut the mines! Not one more shift in the dark!' },
          { who: 'varga', if: { flag: 'varga_free' }, text: '{name}. I remember you. Let’s see if you remember me.' },
          { who: 'fighter', if: { flag: 'pit9_shelled' }, text: 'You shelled a school. Nobody on this moon will ever forget your name.' }
        ],
        turn3: [
          { who: 'fighter', text: 'Hold them at the fence line! Make them pay for every yard!' },
          { who: 'fighter', text: 'Every shift that walks out of a pit is one HTX can’t make walk back in.' },
          { who: 'ops', text: 'They know this ground better than we do. Keep your heads down.' }
        ],
        kill: [
          { who: 'ops', text: 'One of theirs is down. They’re still coming.' },
          { who: 'fighter', text: 'You’ll pay for that. Every one of them had a name.' },
          { who: 'fighter', if: { flag: 'varga_dead' }, text: 'For Varga! Don’t let her die for nothing!' }
        ],
        loss: [
          { who: 'fighter', text: 'Ha! Tell HTX to send more. We’ve got the rock to bury them in.' },
          { who: 'fighter', text: 'That’s one corporate dog that won’t be getting paid.' },
          { who: 'ops', text: 'We’ve lost a unit. {commander:rank}, orders?' }
        ],
        bhalf: [
          { who: 'fighter', text: 'Fall back to the tunnels! Live to fight another shift!' },
          { who: 'fighter', text: 'They’re butchering us—hold, damn you, hold!' },
          { who: 'ops', text: 'Their line is breaking. Push now and it’s done.' }
        ],
        ahalf: [
          { who: 'fighter', text: 'Look at them run! Kessler’s Reach eats mercenaries!' },
          { who: 'ops', text: 'We’re getting cut to pieces out here.' }
        ]
      },

      hive: {
        start: [
          { who: 'ops', text: 'Motion trackers are lit up. All of them. Every channel.' },
          { who: 'hive', text: '[a clicking in the walls, everywhere at once, getting closer]' },
          { who: 'ops', text: 'Something is moving in the rock. Lots of something.' }
        ],
        turn3: [
          { who: 'hive', text: '[the ground hums. The dust on the floor jumps in time with it]' },
          { who: 'ops', text: 'Check your corners. They come out of the walls here.' }
        ],
        kill: [
          { who: 'ops', text: 'Splash one. Not that it’s slowing the rest.' },
          { who: 'hive', text: '[a shriek from below, taken up by a hundred more]' }
        ],
        loss: [
          { who: 'ops', text: 'Man down! They just—they came out of the floor!' },
          { who: 'hive', text: '[the chittering rises, and something is dragged into the dark]' }
        ],
        bhalf: [
          { who: 'ops', text: 'They’re thinning out. Keep firing, keep firing.' },
          { who: 'hive', text: '[the hum drops to a growl. The hive is hurt, and it knows it]' }
        ],
        ahalf: [
          { who: 'ops', text: '{commander:rank}, there are too many of them. We can’t hold this.' }
        ],
        wave: [
          { who: 'ops', text: 'Contact at the tunnel mouths! More coming up!' },
          { who: 'hive', text: '[the tunnels breathe out, and the dark comes with them]' }
        ]
      },

      lantern: {
        start: [
          { who: 'actual', text: 'Black Lantern to {name}. Nothing personal. You’re just on the wrong invoice.' },
          { who: 'actual', text: '{commander:rank}. I’ve read your file. It’s short. It’s about to get shorter.' },
          { who: 'actual', if: { flag: 'lantern_crossed' }, text: 'You crossed Black Lantern once, {commander:rank}. Nobody does it twice.' }
        ],
        turn3: [
          { who: 'actual', text: 'Second section, flank left. Let’s show these amateurs how it’s done.' },
          { who: 'actual', text: 'HTX bought this moon. You’re standing on their property.' }
        ],
        kill: [
          { who: 'actual', text: 'Man down. Noted. That’ll be on your bill, {name}.' },
          { who: 'ops', text: 'Lantern unit down. They’re good, but they bleed.' }
        ],
        loss: [
          { who: 'actual', text: 'Scratch one. You should have taken the buyout, {commander:rank}.' },
          { who: 'actual', text: 'Professional courtesy: you can surrender now.' }
        ],
        bhalf: [
          { who: 'actual', text: 'Pull it together! Regroup on me!' },
          { who: 'actual', text: 'Huh. HTX said you were cheap. They didn’t say you were good.' }
        ],
        ahalf: [
          { who: 'actual', text: 'It’s over, {name}. Lay down your weapons and you walk out.' }
        ],
        parley: [
          { who: 'actual', text: 'So that’s how it’s going to be. Weapons free!' }
        ],
        target: [
          { who: 'actual', text: 'I’m hit—keep them off me!' }
        ]
      }
    },

    battles: {
      'c1.battle': {
        start: [
          { who: 'okonkwo', text: 'Port Master to {name}: they’re through the terminal! Get on those pads before they shut down the port!' },
          { who: 'fighter', text: 'Here come HTX’s new dogs. Welcome to Kessler’s Reach!' }
        ],
        turn3: [{ who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'HTX to {commander:rank}. The board is watching the port’s feed. Make it look tidy.' }]
      },
      'c2r.battle': {
        start: [{ who: 'fighter', text: 'Number Three belongs to the miners now. Shut HTX down for good!' }],
        bhalf: [{ who: 'fighter', text: 'Burn the refinery if we can’t hold it! Don’t leave HTX a thing!' }]
      },
      'c2d.battle': {
        start: [
          { who: 'petrak', if: { flag: 'driver_taken' }, text: 'Depot’s through the north gate. I told you everything. Just don’t let them see me with you.' },
          { who: 'fighter', text: 'Who’s there? Lights! Get the lights on!' }
        ]
      },
      'c3.battle': {
        start: [
          { who: 'varga', text: 'You’ve come a long way to die for a mining company, {commander:rank}.' },
          { who: 'varga', if: { flag: 'aim_capture' }, text: 'Alive? HTX wants me alive? Then HTX knows what I know.' }
        ],
        target: [{ who: 'varga', text: 'I’m hit—no, leave me! Get the others out!' }],
        bhalf: [{ who: 'varga', text: 'Into the pumping hall! Seal the doors behind us!' }],
        // the pump houses: one drawn blank, and the one she is in
        searched: [
          { who: 'ops', text: 'Pump house is empty, {commander:rank}. Cold stove, no Varga. She’s in one of the others.' },
          { who: 'ops', text: 'Nothing in there but pumps. Moving on to the next one.' }
        ],
        found: [
          { who: 'ops', if: { flag: 'aim_capture' }, text: 'Target located! Varga’s in that pump house, {commander:rank}. Snatch team, go, and I want her breathing.' },
          { who: 'ops', text: 'Target located! Varga’s in that pump house, {commander:rank}. Close it down.' }
        ],
        guard: [
          { who: 'fighter', text: 'They’ve found her! Protect Varga! Everyone to the pump house!' },
          { who: 'fighter', text: 'Protect Varga! Hold them off the pump house!' }
        ]
      },
      'c4.battle': {
        start: [
          { who: 'teacher', if: { flag: 'pit9_clearing' }, text: 'Please! There are still children in the east wing!' },
          { who: 'fighter', if: { flag: 'pit9_shelled' }, text: 'You shelled a school! Kill every last one of them!' },
          { who: 'fighter', text: 'Pit Nine stands! Shut down HTX! Shut down the shafts!' }
        ],
        kill: [{ who: 'guild', text: 'That was a miner. That was somebody’s father.' }]
      },
      /* The sump: the company goes down after the Front, and finds the hive.
         Nothing is said of bugs until the first counter turns over. */
      'sump.battle': {
        start: [
          { who: 'ops', if: { flag: 'varga_free' }, text: 'Varga came down through here, {commander:rank}. Fresh boot prints, Front paint on the walls. She knows these tunnels and we don’t.' },
          { who: 'ops', text: 'Front markings on the walls. Whoever’s left of them went to ground down here. Lights on, stay together.' },
          { who: 'ops', text: 'Tracks in the dust, heading down. The Front’s holed up somewhere below us. Check every side passage.' }
        ],
        sighted: [
          { who: 'ops', text: 'Contact! That’s—that isn’t the Front. That isn’t anybody. What the hell is that?' },
          { who: 'ops', text: 'Movement! It’s not them, {commander:rank}. It’s not people. Oh God, it’s not people.' }
        ],
        turn3: [
          { who: 'ops', after: 'sighted', text: 'They come out of the walls! Watch the walls!' },
          { who: 'hive', after: 'sighted', text: '[the rock beside you splits, and something with too many legs pours out of it]' }
        ],
        loss: [
          { who: 'ops', after: 'sighted', text: 'Man down! It came straight out of the wall and took him!' },
          { who: 'ops', after: 'sighted', text: 'They’re in the walls! They’re in the walls! Pull back to the light!' }
        ]
      },
      'relief.battle': {
        start: [{ who: 'actual', text: 'Black Lantern assuming control of this sector. Stand down, {name}. You’re relieved.' }],
        loss: [{ who: 'actual', text: 'HTX authorised lethal force. I hope your contract covers widows.' }]
      },
      'retake.battle': {
        start: [{ who: 'fighter', text: 'You want Number Three back? Come and dig us out!' }]
      },
      'revenge.battle': {
        start: [
          { who: 'fighter', if: { flag: 'varga_dead' }, text: 'You killed Varga. Every one of us out here is Varga now.' },
          { who: 'varga', if: { flag: 'varga_free' }, text: 'I told you I’d come back for you, {commander:rank}.' },
          { who: 'fighter', if: { flag: 'parley_betrayed' }, text: 'A white flag means nothing to you. Then nothing means nothing to us.' }
        ],
        ahalf: [{ who: 'varga', if: { flag: 'varga_free' }, text: 'Run home, {name}. Tell HTX the Front is still here.' }]
      },
      'splinter.battle': {
        start: [{ who: 'fighter', text: 'The Front won’t talk for us. We’ll talk for ourselves. With this.' }]
      },
      'redoubt.battle': {
        start: [
          { who: 'varga', if: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }, text: 'This is the last of us, {commander:rank}. You’ll have to come in and get it.' },
          { who: 'fighter', text: 'No surrender! Not one more ton for HTX!' }
        ],
        bhalf: [{ who: 'fighter', text: 'Hold the inner wall! Nobody leaves! Nobody!' }]
      },
      'ceasefire.battle': {
        start: [
          { who: 'varga', if: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }, text: 'I’ll talk. But my people keep their guns until HTX shuts the deep shafts.' },
          { who: 'front', if: { not: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] } }, text: 'We’ll talk. But we keep our guns until HTX shuts the deep shafts.' },
          { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'HTX does not negotiate with terrorists, {commander:rank}. You may listen. You may not agree.' }
        ],
        parley: [
          { who: 'varga', if: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }, text: 'I knew it. I knew you’d never mean it. Front—open fire!' },
          { who: 'fighter', text: 'Treachery! The talks were a trap!' }
        ]
      },
      'holdline.battle': {
        start: [
          { who: 'varga', if: { all: [{ flag: 'truce' }, { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }] }, text: 'We hold this pass together, or the hive takes the whole moon. Don’t make me regret this.' },
          { who: 'front', if: { all: [{ flag: 'truce' }, { not: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] } }] }, text: 'The Front holds the left of the pass. We hold together, or the hive takes the whole moon.' },
          { who: 'ops', if: { not: { flag: 'truce' } }, text: 'All units, the pass is the line. Nothing gets past us.' }
        ],
        wave: [{ who: 'guild', text: 'They’re coming up the old workings—we sealed those twenty years ago!' }]
      },
      'outbreak.battle': {
        start: [{ who: 'guild', text: 'They came up through the school floor. Get the families out—please!' }]
      },
      'shafts.battle': {
        start: [{ who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'HTX to {commander:rank}. Whatever you see down there is covered by your non-disclosure clause.' }]
      },
      'hiveheart.battle': {
        start: [{ who: 'hive', text: '[the whole cavern pulses, slow as breathing. It knows you are here]' }],
        bhalf: [{ who: 'ops', text: 'It’s dying—the whole hive is screaming. Keep going!' }]
      },
      'partner.battle': {
        start: [{ who: 'actual', text: 'We’re on the same side today, {name}. Try not to shoot my people.' }]
      },
      'leak.battle': {
        start: [
          { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'If that uplink transmits, {commander:rank}, your contract is void and your company is finished.' },
          { who: 'actual', text: 'Uplink security, Black Lantern. Nobody touches the dish.' }
        ]
      },
      'convoy.battle': {
        start: [{ who: 'actual', text: 'Black Lantern, all units. Nothing reaches the coast. Light up that convoy.' }]
      },
      'showdown.battle': {
        start: [{ who: 'actual', text: 'Just you and me now, {commander:rank}. HTX doesn’t care who walks out of here.' }],
        target: [{ who: 'actual', text: 'Damn you, {name}. Damn you and your cheap contract.' }]
      },
      'breakout.battle': {
        start: [
          { who: 'liaison', if: { not: { flag: 'htx_cut_off' } }, text: 'Orbital authorisation confirmed. The surface will be sterilised. Make your shuttle, {name}.' },
          { who: 'ops', text: 'Last shuttle off this rock is on the pad. Everybody run.' }
        ],
        wave: [{ who: 'ops', text: 'They’re pouring out of the slag—don’t stop, don’t look back!' }]
      },
      '@side:orerun': {
        start: [{ who: 'fighter', text: 'Every ton on that train is stolen from us! Stop the train!' }]
      },
      '@side:refugees': {
        start: [{ who: 'ops', text: 'Families in the column. Watch your fire.' }]
      },
      '@side:frontmoney': {
        start: [{ who: 'varga', if: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }, text: 'HTX cut you loose, then? Welcome to the Front’s payroll, {commander:rank}.' }]
      }
    },

    /* The talks, where a battle is a Parley (story.js parleyFor; storybattle.js
       parleyOpen): a conversation at the start of the battle, played as a chat.
       Each side's view heard, a compromise looked for, and an agreement or a
       fight. What has happened in the story opens and shuts lines and answers;
       Trust is what an agreement needs, Tension what breaks the talks (at
       `breakAt`). An agreement's `terms` are flags the story keeps. */
    parleys: {
      // The Ceasefire: the truce, with Varga if she is still out there, or with the Front if not
      'ceasefire.battle': {
        them: [{ who: 'varga', if: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] } }, { who: 'front' }],
        breakAt: 5, start: 'open', broke: 'fight',
        steps: {
          open: {
            say: [
              { who: 'varga', if: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] }, text: 'You came. I half thought you’d send HTX’s lawyers instead.' },
              { who: 'varga', if: { flag: 'varga_released' }, text: 'You opened that door when you didn’t have to. That’s the only reason I’m sitting here.' },
              { who: 'front', if: { not: { any: [{ flag: 'varga_free' }, { flag: 'varga_released' }, { flag: 'varga_spared' }] } }, text: 'We’re here because the Front voted to be here. Not because we trust you. Remember that.' },
              { if: { flag: 'pit9_shelled' }, text: 'Before anything else: Pit Nine. You shelled a school, {commander:rank}. Say something about that, or this ends now.' },
              { if: { flag: 'pit9_spared' }, text: 'People in Pit Nine say you held your fire when you could have levelled it. That bought you this table.' }
            ],
            options: [
              { text: 'Pit Nine was my order, and my mistake. I won’t pretend otherwise.', if: { flag: 'pit9_shelled' }, trust: 2, next: 'grievance',
                reply: [{ text: '…Nobody from HTX ever said that much. Go on, then.' }] },
              { text: 'Pit Nine was a war. You were firing from it.', if: { flag: 'pit9_shelled' }, tension: 2, next: 'grievance',
                reply: [{ text: 'There were children in the east wing. Remember that, when you count what this costs.' }] },
              { text: 'Tell me why you rose. All of it, from the start.', trust: 1, next: 'grievance' },
              { text: 'I’m here to stop the shooting. Let’s not make it more than that.', next: 'grievance' },
              { text: 'You’re in no position to make demands.', tension: 2, next: 'grievance',
                reply: [{ text: 'Count the guns on that ridge before you say that again.' }] }
            ]
          },
          grievance: {
            say: [
              { text: 'The deep shafts. Two years ago HTX started sinking past the safety line. Forty dead in Pit Four in one shift, and they called it a seam collapse.' },
              { text: 'When we stopped work to bury them, they cut the pay of everyone who stopped. That’s when the guns came out.' },
              { if: { any: [{ flag: 'hive_known' }, { flag: 'sump_entered' }] }, text: 'And now we know what was waiting down there. HTX knew too. They sent us down anyway.' },
              { if: { flag: 'nightshift_shot' }, text: 'And your people shot the night shift at the refinery. Men with their hands up.' },
              { if: { flag: 'nightshift_freed' }, text: 'You let the night shift go, at the refinery. They talk about you, in the shafts. Not all of it bad.' }
            ],
            options: [
              { text: 'I’ve been down there. I’ve seen what’s below the safety line. You’re right about the shafts.', if: { any: [{ flag: 'hive_known' }, { flag: 'sump_entered' }] }, trust: 2, next: 'view' },
              { text: 'HTX never told me any of that. I believe you.', trust: 1, next: 'view' },
              { text: 'The night shift is on me. I’ll answer for it, at a hearing, if it comes to that.', if: { flag: 'nightshift_shot' }, trust: 2, tension: -1, next: 'view' },
              { text: 'Every company cuts pay. That’s no reason to burn refineries.', tension: 2, next: 'view',
                reply: [{ text: 'Spoken like someone who’s never been down a shaft.' }] },
              { text: 'Your people have killed mine, too. I need you to understand that.', next: 'view',
                reply: [{ text: 'I do. That’s why we’re talking, instead of the other thing.' }] }
            ]
          },
          view: {
            say: [{ text: 'So. What does HTX’s hired gun want out of this?' }],
            options: [
              { text: 'My people home alive. That’s my side of it, all of it.', trust: 1, next: 'terms' },
              { text: 'HTX pays me to keep the ore moving. I’d rather it moved without anyone dying.', next: 'terms' },
              { text: 'I want the thing under this moon dealt with, before it eats both of us.', if: { flag: 'hive_known' }, trust: 1, next: 'terms',
                reply: [{ text: 'On that, at least, we agree.' }] },
              { text: 'I want the Front off the roads and out of the shafts.', tension: 1, next: 'terms' }
            ]
          },
          terms: {
            say: [{ text: 'Then here is what we want. The deep shafts sealed, below the safety line, for good. And no one hanged for picking up a gun.' }],
            options: [
              { text: 'Seal the shafts below the line. I’ll put it to HTX in writing, with my company’s name under it.', need: 2, terms: ['terms_shafts'], next: 'deal' },
              { text: 'I’ll give you the Deep Contract files. Show the whole moon what HTX knew.', if: { all: [{ flag: 'core_recovered' }, { not: { flag: 'core_sold' } }] }, trust: 2, terms: ['terms_files'], next: 'deal' },
              { text: 'HTX pays the families of Pit Four. I’ll see the money moves.', if: { meter: 'htx', gte: 1 }, need: 1, terms: ['terms_compensation'], next: 'counter' },
              { text: 'Amnesty for the rank and file. The ones who gave the orders face a hearing.', need: 1, terms: ['terms_amnesty'], next: 'counter' },
              { text: 'Lay down your guns first. Then we talk about shafts.', tension: 3, next: 'counter' }
            ]
          },
          counter: {
            say: [{ text: 'It’s something. It isn’t enough. Give me something I can take back to them, or I can’t sell this.' }],
            options: [
              { text: 'My company stays between you and HTX until the shafts are shut. Anyone comes for you, they come through us.', need: 3, terms: ['terms_guarantee'], next: 'deal' },
              { text: 'Then the shafts too. Sealed below the line. You have my word.', need: 2, terms: ['terms_shafts'], next: 'deal' },
              { text: 'That’s my best offer. Take it or don’t.', tension: 2, next: 'last' },
              { text: 'Then we’re done here.', tension: 5, next: 'fight' }
            ]
          },
          last: {
            say: [{ text: 'You don’t make it easy.' }],
            options: [
              { text: 'Nobody else has to die this week. That has to be worth something to you.', need: 2, next: 'deal' },
              { text: 'I’m not here to make it easy.', tension: 2, next: 'fight' }
            ]
          },
          deal: {
            say: [
              { text: 'Then that’s the agreement. Nobody on this moon fires on anyone today.' },
              { if: { not: { flag: 'htx_cut_off' } }, who: 'liaison', text: 'HTX recognises no such agreement, {commander:rank}. This is noted.' },
              { text: 'Shake on it, before somebody up on that ridge changes their mind.' }
            ],
            end: 'agreed'
          },
          fight: {
            say: [
              { text: 'Then we’re finished. Back to your lines.' },
              { who: 'fighter', text: '[a shot from the ridge. Nobody will ever know whose]' }
            ],
            end: 'broken'
          }
        }
      },

      // Under a White Flag: the Front's challenge, after Varga
      'revenge.battle': {
        them: [{ who: 'varga', if: { flag: 'varga_free' } }, { who: 'front' }],
        start: 'open', broke: 'fight',
        steps: {
          open: {
            say: [
              { who: 'varga', if: { flag: 'varga_free' }, text: 'I said I’d come back for you, {commander:rank}. I didn’t say how. Today it’s talking.' },
              { who: 'front', if: { flag: 'varga_dead' }, text: 'You killed Ada Varga. Her brother asked us to hear you before we bury you. So: speak.' },
              { who: 'front', if: { flag: 'martyr_displayed' }, text: 'You hung her up for the whole port to see. Choose your words carefully.' }
            ],
            options: [
              { text: 'I’m sorry for how it ended. I mean that.', if: { flag: 'varga_dead' }, trust: 1, next: 'want' },
              { text: 'Taking her down was the job. I won’t apologise for doing it.', if: { flag: 'varga_dead' }, tension: 2, next: 'want' },
              { text: 'You got away from me once. I’d rather not have to try again.', if: { flag: 'varga_free' }, next: 'want' },
              { text: 'Say what you want. I’m listening.', trust: 1, next: 'want' }
            ]
          },
          want: {
            say: [
              { text: 'We want the hill country left to us. Your patrols out of the Pit Four valley, and HTX’s drones with them.' },
              { if: { flag: 'varga_dead' }, text: 'And we want her body. She goes in the ground in Pit Four, with her crew.' }
            ],
            options: [
              { text: 'You’ll have her body. That much is owed.', if: { flag: 'varga_dead' }, trust: 2, terms: ['terms_body'], next: 'offer' },
              { text: 'I can pull my patrols out of the valley. HTX’s drones aren’t mine to give.', trust: 1, next: 'offer' },
              { text: 'The valley is HTX’s ground. My patrols stay.', tension: 2, next: 'offer' }
            ]
          },
          offer: {
            say: [{ text: 'Then what will you give, for nobody dying on this ridge today?' }],
            options: [
              { text: 'My company stays out of the hill country. If HTX sends anyone in, it won’t be us.', need: 2, terms: ['terms_withdraw'], next: 'deal' },
              { text: 'Blood money, for every family that lost someone. From my own pay.', need: 1, terms: ['terms_bloodprice'], next: 'deal' },
              { text: 'Nothing. You walk away, and you live. That’s the offer.', tension: 3, next: 'fight' }
            ]
          },
          deal: { say: [{ text: 'Then we walk away. Both of us. Don’t make me regret it.' }], end: 'agreed' },
          fight: { say: [{ text: 'Then the flag comes down. Back to your guns.' }], end: 'broken' }
        }
      },

      // Last Words: Black Lantern's commander, under a white flag, before the showdown
      'showdown.battle': {
        them: 'actual', start: 'open', broke: 'fight',
        steps: {
          open: {
            say: [
              { text: 'You saved my people at the refinery, {commander:rank}. I don’t forget a debt. So I’m offering you one chance.' },
              { text: 'HTX has paid me to put your company in the ground. I’d rather not earn it.' }
            ],
            options: [
              { text: 'Then don’t. What are you offering?', trust: 1, next: 'offer' },
              { text: 'HTX is paying you to clean up its own mess. You know that.', trust: 1, next: 'offer',
                reply: [{ text: 'Every contract is somebody’s mess. That’s the business we’re both in.' }] },
              { text: 'You’re offering me a chance to run.', tension: 2, next: 'offer' }
            ]
          },
          offer: {
            say: [{ text: 'Walk away. Your company, your kit, on the next hauler out. I report you gone before we arrived. Nobody bleeds.' }],
            options: [
              { text: 'And the miners? The Front? What happens to them when we’re gone?', if: { flag: 'truce' }, trust: 1, next: 'truce' },
              { text: 'We take your offer. We’re done with this moon.', need: 1, terms: ['terms_walkaway'], next: 'deal' },
              { text: 'We came to finish this. We’re not leaving.', tension: 4, next: 'fight' }
            ]
          },
          truce: {
            say: [{ text: 'Not my problem, unless they shoot at me. If they keep the truce, I’ve no orders that say I must break it.' }],
            options: [
              { text: 'Put that in writing, and we go.', need: 2, terms: ['terms_walkaway', 'terms_lantern_truce'], next: 'deal' },
              { text: 'Your word isn’t enough. Not after HTX.', tension: 2, next: 'fight' }
            ]
          },
          deal: { say: [{ text: 'Then we’re square, {commander:rank}. Get off my moon.' }], end: 'agreed' },
          fight: { say: [{ text: 'Shame. I liked you.' }], end: 'broken' }
        }
      }
    }
  };
})(typeof window !== 'undefined' ? window : global);
