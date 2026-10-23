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
        bhalf: [{ who: 'varga', text: 'Into the pumping hall! Seal the doors behind us!' }]
      },
      'c4.battle': {
        start: [
          { who: 'teacher', if: { flag: 'pit9_clearing' }, text: 'Please! There are still children in the east wing!' },
          { who: 'fighter', if: { flag: 'pit9_shelled' }, text: 'You shelled a school! Kill every last one of them!' },
          { who: 'fighter', text: 'Pit Nine stands! Shut down HTX! Shut down the shafts!' }
        ],
        kill: [{ who: 'guild', text: 'That was a miner. That was somebody’s father.' }]
      },
      'sump.battle': {
        start: [
          { who: 'ops', text: 'Lights on. Stay together. Whatever HTX was digging for, it’s still down here.' },
          { who: 'hive', text: '[deep in the rock, something turns over in its sleep]' }
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
    }
  };
})(typeof window !== 'undefined' ? window : global);
