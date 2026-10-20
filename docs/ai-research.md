# Building a stronger battle AI: research notes

October 2026. Why the computer opponent has stopped improving, what game AI practice and research offer for a game like this one, and a recommended plan. It is written against the code as it stands (`src/engine/ai.js`) and the measurements in `scripts/balance/README.md`.

## 1. Summary

The current AI is a **utility AI**. Each unit, on its own activation, scores a short list of behaviours, then scores the spots it can reach this move, and takes the best. That got us from the book's behaviour table (rolled) to a clearly better opponent: **57.5% → 59.5%** against the table. Covered approaches were the last change that helped.

Since then, every change we tried has measured as "no change" or worse:
- cover-seeking
- cohesion
- crossing open ground together
- covering fire
- keeping objectives

That holds against the old table and against today's AI (`OPP=current`, 50% = no change). This is the usual ceiling of a hand-weighted, one-activation-deep utility AI. Each new consideration is one more weight fighting the others, and nothing in the system can see that a choice pays off two activations later.

What strong AIs for turn-based tactical games do instead is **look ahead**: try the candidate actions on a copy of the battle, let the opponent reply, and judge the result. Our game is unusually well suited to this:
- **One unit acts at a time.** Activations alternate, so a decision is one unit's action. Blood Bowl or Hero Academy move every piece in a turn, which is the problem that makes them hard.
- **Copies are cheap.** The engine already snapshots and restores a battle in about 1 ms (`snapshot()`/`load()`).
- **Average outcomes are already computed.** `R.expectedShot` gives a shot's average hits, casualties, Suppression and damage without rolling, so a lookahead can use averages instead of sampling dice.

**Recommendation, in order:**
1. Fix the measuring first: per-battle seeding, sequential testing, a pool of opponents.
2. Write a **battle evaluation function**: a single number for how well a side is doing. Check it against real outcomes.
3. Add a **shallow search** on top of the utility AI. The utility AI proposes its best few actions; a short expectimax or Monte Carlo lookahead picks between them using the evaluation.
4. **Tune the weights automatically** with an evolution strategy (CMA-ES) in self-play, instead of by hand.
5. Later: learn from the tracked player campaigns, imitating what the player does that wins.

Sections 3–5 explain each step and the evidence for it.

## 2. Where we are

### 2.1 How the AI decides now

| Layer | What it does | Where |
|---|---|---|
| Behaviour | Each activation, a unit chooses assault, offensive, neutral, defensive or flee by weighing its state, shots and threats (`chooseBehaviour`). This replaced the book's D6 table, which the solitaire OpFor still rolls. | `ai.js` |
| Target | The best shot by expected effect, preferring targets already hurt (`bestTarget`, `focusPref`). | `ai.js` |
| Movement | Scores every reachable spot (thinned to a half-inch grid): cover, firepower terrain, route cost to the goal through a 1" exposure grid (covered approaches), chances to shoot and be shot, friends crowding. Moves if the best spot beats staying by 0.6 (`scoreSpot`). | `ai.js` |
| Placement | Deploying and entering, of 24 legal spots, the one whose way forward is least exposed (`aiPlace`). | `ai.js` |
| Charges | Charges when the assault odds are good enough (`chargeEdge`). | `ai.js` |

### 2.2 What the measurements say

| Change | Against | Result |
|---|---|---|
| Choosing instead of rolling | table | 57.5% |
| Covered approaches (kept) | table | 59.5% over 1280 |
| Activation order, hulls roll, regroup, focus variants, half-range positioning, smart deployment | table | within noise or worse |
| Cover-seeking, cohesion | table | 52.7–56.0% |
| Crossing together, covering fire | table | 54.1–56.5% |
| Keeping objectives, cohesion, crossing, covering fire | current AI | 50.5, 50.1, 49.4, 46.4% |

Also from the logs (`aistats.js`) and the tracked campaign (`tracks.js`):
- **Activity, not accuracy.** The AI's edge over the table was activity: no wasted holds and 20% more shots. Shot quality was the same.
- **Units barely move.** About 5 moves in some 32 activations; most units fight from where they deployed.
- **Against the player** (one campaign, 10 battles, all won by the player):
  - The AI stood in cover 5% of the time against the player's 24%.
  - Its units stood 9.9" from their nearest friend, against the player's 5.6".
  - It fired 9.7 shots a battle against 24.1.

### 2.3 Why it has plateaued

1. **Greedy, one activation deep.** Every choice is the best-looking one now. Waiting at the edge of cover only pays if the crossing next turn is safer, and the AI has no way to see "next turn". Every multi-step idea we bolted on looked worse because it pays a cost now for a gain the AI cannot weigh.
2. **Hand weights in tension.** `scoreSpot` adds a dozen terms with hand-picked weights (cover 1.6, firepower terrain 2, goal 0.6 an inch, opportunity 1.6, exposure 0.3...). A new term shifts the balance of all the others, so the honest result of adding one is noise.
3. **Unit by unit.** No unit knows what the others will do this turn. Focus fire works only because targets keep their damage between activations; an advance together, or a screen, cannot be expressed.
4. **A weak yardstick.** The table, and to a lesser degree the AI itself, does not punish what a player punishes: standing alone in the open, spreading out, giving up ground. Changes aimed at those faults cannot show up against an opponent that has the same faults.
5. **Slow, noisy measurement.** 640 battles take 12–20 minutes and resolve ±2 points. Changing one battle shifts the random numbers of every later one (the army and scenario draws carry on from the previous battle's dice), so per-scenario numbers wander.

## 3. What the field does

### 3.1 Hand-authored decision making

- **Finite state machines and behaviour trees.** Most shipped game AI is this: a tree of conditions and actions. It is predictable and designer-friendly but does not discover anything. Halo 2's GDC 2005 talk popularised behaviour trees.
- **Utility AI.** Every option is scored by response curves over considerations, and the best is taken. Dave Mark's *Infinite Axis Utility System* is the best-known form, used for Guild Wars 2: Heart of Thorns and presented at GDC 2013 and 2015. **This is what we have.** It is a good layer for *proposing* actions and a poor one for *planning* them.
- **Candidate-action loops.** Battle for Wesnoth's default AI (the RCA AI, "Register Candidate Action") is the closest shipped relative of our game: turn-based, hex tactics, dice combat. It evaluates every registered candidate action (attack, move to village, retreat, recruit...), runs the highest-scoring one, re-evaluates, and repeats. It is a utility loop with good engineering (pluggable, scriptable), not a planner, and is known among players as beatable for the same reasons ours is.

### 3.1a What shipped tactics games do

- **XCOM: Enemy Unknown** (Firaxis, GDC 2013 AI postmortem) used behaviour-based alien AI with per-type movement and ability use.
  - Julian Gollop, the original X-Com's designer, observed that it relies on the player triggering things, and that predictable patterns soon emerge.
  - His point that a little randomness makes an AI seem cleverer than it is applies to us too.
- **Gears Tactics** (Splash Damage) kept per-archetype logic deliberately simple and put the cleverness in coordination.
  - A Tactical Planner coordinates the enemy turn, with simultaneous actions to keep turns fast.
  - "Tactical clarity" was a design goal: the player can follow what the enemy is doing and why.
  - See *Make It Fast: Simultaneous AI Actions in Gears Tactics*, Unreal Fest 2020.
- **Into the Breach** (Subset Games) made enemy intent fully telegraphed and deterministic, turning each turn into a puzzle.
  - It is the opposite of hidden cleverness: the challenge comes from the board, not from the AI out-thinking you.
  - It is a reminder that "harder" is not the only goal; legibility matters to players.
- **Civilization V** split its AI into four layers: tactical (units), operational (a war front), strategic (the empire) and grand strategy (victory).
  - That is the same hierarchy idea as Killzone 2's, at a different scale.

The common thread in shipped games is **coordination above the unit**: a planner or layer that decides what the force is doing, with simple unit logic underneath. Ours has only the unit layer.

### 3.2 Spatial reasoning

- **Influence maps.** Grids holding threat, control, cover or visibility, combined to answer "where should I be?". See Dave Mark's *Modular Tactical Influence Maps* (Game AI Pro 2, ch. 30) and Matthew Jack's *Tactical Position Selection* (Game AI Pro 360).
- Our exposure grid and route field (covered approaches) are an influence map with a path search over it. That is the change that worked, which says spatial knowledge matters here. The next steps in that direction are:
  - **Friendly support:** how many friends cover a spot.
  - **Threat projection:** where the enemy can be next turn, not only now.
  - **Control:** who owns which ground, as Diplomacy and Go programs use.

### 3.3 Planning

- **GOAP** (goal-oriented action planning, F.E.A.R.) and **HTN** (hierarchical task networks) plan a sequence of actions to reach a goal state.
- Killzone 2's multiplayer bots (Champandard, Verweij and Straatman, 2009) used three layers: strategy, squad, individual. Orders flow down and information flows up, with an HTN planner at the individual level.
- The idea worth taking is the **hierarchy**, not the planner. A side-level "commander" decides each turn what the force is doing (take objective 2, hold objectives 1 and 3, screen the left), and units score their actions against that intent. That is how "cross together" and "fire support" become one plan instead of independent unit rules that each look like a loss.

### 3.4 Search

- **Minimax / expectimax.** Try each action, let the opponent reply, and average over chance (the dice). Classic and exact, but the branching must be small. Ours is: one unit's action, maybe 20–60 sensible candidates once pruned.
- **Monte Carlo Tree Search (MCTS).** Grows a search tree by repeated simulation, spending effort on the promising lines. It is the standard for games with big branching and chance.
  - Total War: Rome II used MCTS for its campaign AI (Champandard 2014, and a talk at ACCU 2018). That was the first AAA use, with heavy pruning and domain knowledge to keep it tractable.
  - Their lesson applies here: MCTS gave good decisions but was slow, and needed domain-specific restriction of what it considered.
- **ISMCTS** (Information Set MCTS; Cowling, Powley and Whitehouse, 2012) extends MCTS to hidden information and chance. Our Close Encounters counters and reserves are hidden information; most of the game is open.
- **Portfolio search.** In microRTS research, instead of searching over every unit's every action, search chooses among a small **portfolio of scripts** (behaviours) for each unit or group. Examples are Portfolio Greedy Search and Puppet Search (Barriga, Stanescu, Buro), with NaiveMCTS refining the units actually in combat. This fits us closely: our behaviours (assault, offensive, neutral, defensive, plus "hold objective", "cross") are the portfolio, and a search picks which each unit uses this turn by simulating the outcomes.
- **Multi-action turns.** In Hero Academy each turn is a sequence of actions. Justesen, Mahlmann and Togelius (2016) found an evolutionary search over the turn's action sequence ("Online Evolution") beat MCTS and greedy search by a large margin. Baier and Cowling's Evolutionary MCTS (2018) improved on it by looking past the end of the turn.
  - Our activations alternate, so we mostly do not need this. It becomes relevant for the AI's multi-activation streaks: Command Unit chains and overwhelming numbers.

### 3.5 Learning

- **Weight tuning.** The cheapest win in the learning column: keep the hand-written structure but let an optimiser set the numbers.
  - CMA-ES (an evolution strategy) is the usual tool for tens of weights.
  - In coevolution or self-play it has learned Othello evaluation functions that beat hand-tuned ones (Co-CMA-ES, IEEE TCIAI 2016).
  - Chess engines tune hundreds of evaluation weights from game outcomes this way.
- **Fitting to outcomes (Texel tuning).** Chess programs tune their evaluation by logistic regression against game results. Take millions of positions from games, label each with the final result, map the evaluation through a sigmoid, and adjust the weights to minimise the error. It goes back to Buro's Othello work (1995), and Texel's method (Österlund, 2014) made it standard. It is exactly the fitting step section 4.2 calls for, and cheap to run on harness battles.
- **Imitation and reinforcement learning.** Blood Bowl's annual AI competition (Bot Bowl, IEEE Conference on Games, from 2019) is the nearest research benchmark: turn-based, dice everywhere, huge branching.
  - Scripted bots won most early years; learned bots have overtaken them more recently.
  - MimicBot (2021) combined imitation learning with reinforcement learning to consistently beat a scripted bot.
  - It is costly: neural networks, GPU training, a Python stack. It is far from a browser game in plain JavaScript, so it is a long-term option only.
- **Learning from players.** Our debug tracking already records where every unit stood each turn in the player's battles. With enough tracked battles, two uses open up:
  - fit the evaluation function's weights to outcomes;
  - train a "what would the player do here" model as a prior for the search.

### 3.6 Measuring

Chess engine development solved our measurement problem long ago:
- **SPRT** (sequential probability ratio test). Play games until the result is statistically decided for or against a set improvement, then stop. Stockfish's Fishtest and tools such as cutechess-cli and OpenBench use it. It needs far fewer games on average than a fixed count, and stops early on clear wins and clear losses.
- **Paired games with independent seeds.** Each game's dice come from its own seed (game index), so a change in one game cannot shift another's. We already pair sides; we should also fix the seeding.
- **An opponent pool.** Measure against several opponents (the table, the current AI, the last released AI, and later a "player-like" bot built from the tracked campaigns), so improvements are not only against one style.

## 4. Fitting it to this game

### 4.1 What makes this game searchable

- **Small decisions.** One unit acts at a time. A Move, Advance, Fire!, Assault or special action, with a destination from about 100–400 reachable spots and a few targets, is tens of sensible options once the utility layer proposes them.
- **Cheap copies.** `snapshot()` is under 1 ms and about 30 KB; `load()` is about 1 ms.
- **Averages without rolling.** `R.expectedShot` and the assault odds give the average outcome of an attack without rolling. A search can use expectations (expectimax) at chance nodes instead of sampling many dice outcomes.
- **Rollouts are expensive.** Playing a battle to the end with the current AI takes about 1.8 s from turn 3. Full playouts per candidate are out of the question in the browser. That rules out naive MCTS with full playouts and points to:
  - short horizons (this activation plus the opponent's reply, or to the end of the turn) closed off by an evaluation function;
  - or a much cheaper rollout policy than the full AI.

### 4.2 The missing piece: an evaluation function

Everything search-based needs a single number: how good is this battle state for side A? Candidate terms, all available from the state:

| Term | Meaning |
|---|---|
| Material | Unit value (tier, models left, hull points) on the table, weighted by its status (ready, suppressed, broken) |
| Suppression | Stress points relative to Morale: how close each unit is to breaking |
| Objectives | Held now, and held-for-time progress (`SC.holdClock`) |
| Threat balance | Expected damage each side can deal next turn (from `expectedShot` over pairs in range and sight) |
| Exposure | The exposure grid summed over units, already built for covered approaches |
| Tempo | Activations remaining this turn for each side, and reserves still to arrive |
| Scenario | Rout thresholds, turns left, and scenario-specific win conditions |

The weights should not be guessed. Generate positions from harness battles, record who won, and fit the weights (logistic regression first, as Texel tuning does in chess; CMA-ES later) so the function predicts the winner. The tracked campaigns supply real positions too. **A function that predicts outcomes well is the foundation; search on a poor evaluation only finds the poor evaluation's mistakes faster.**

### 4.3 A commander layer

A side-level planner each turn:
- **Assign objectives** to units: hold, take, screen, hunt.
- **Choose a posture:** advance, hold, withdraw.
- **Mark crossings:** open ground to cross together, and fire-support duties.

Units then score their options partly by how well they serve their assignment. This is what makes coordinated behaviour coherent instead of a collection of unit rules. It is also where the scenario's win condition lives: Secure and control's same-two-for-three-turns, Demolish's twelve turns.

## 5. Recommended plan

Each phase is measured with SPRT against an opponent pool, and kept only if it wins.

| Phase | Work | Size | Payoff |
|---|---|---|---|
| 0. Measurement | Per-battle seeds from the pair index. An SPRT runner in `scripts/balance/` (stop at a decision, report Elo ± error). Opponent pool: table, current AI, last release. | Small | Every later step measured in minutes, not by eye |
| 1. Evaluation function | `evaluate(state, side)` from section 4.2. A dataset of positions and outcomes from the harness. Fit the weights; report how well it predicts winners (a logistic fit's accuracy at turn 3, turn 5...). | Medium | Prerequisite for search; useful at once for debugging the AI |
| 2. One-ply lookahead | For the acting unit, take the utility layer's top 5–8 actions. Apply each on a copy using expected outcomes, score with the evaluation, optionally let the opponent's most dangerous unit reply. Take the best. Time-capped (for example 100–200 ms per activation; a Web Worker in the browser). | Medium | Likely the biggest single gain: choices judged by results, not by a weighted feature list |
| 3. Turn-horizon search | Portfolio search first: for each unit, which behaviour (from the utility AI's set) to use this turn, chosen by simulating the turn and evaluating the result. Then MCTS or Online-Evolution-style search to the end of the turn over both sides' remaining activations, with the utility AI as the cheap policy and the evaluation at the leaves. Covers multi-activation streaks properly. | Large | The coordinated play (crossings, screens, focus) that unit rules could not express |
| 4. Commander layer | Per-turn assignments and posture (section 4.3), feeding both the utility layer and the search's priors. | Medium | Scenario-aware play; coherent multi-unit tactics |
| 5. Automatic tuning | CMA-ES over the utility and evaluation weights in self-play, run offline in node; the results shipped as constants. | Medium (mostly compute) | Removes the hand-weight tug of war |
| 6. Learning from players | From debug-tracked campaigns: fit the evaluation to real outcomes; model the player's choices as a prior and as a pool opponent. | Later | Strength against people, not just against itself |

### Practical notes

- **Performance budget.**
  - In the browser, search must run in a Web Worker so the screen stays smooth.
  - On the server (online campaigns, AI-vs-AI elsewhere battles) it can run longer.
  - A difficulty setting can simply be the time budget.
- **Determinism.** Search must use its own random numbers, never the game's dice (`Math.random` is the game's), so a replay or an online game is not thrown out of step.
- **Keep the utility AI.** It becomes the move generator, the rollout policy and the fallback when time runs out. Nothing built so far is wasted.
- **Explainability.** Log the top candidates and their evaluated values in the battle log (`ai` lines), as the choices are now. That keeps the AI debuggable and lets players see why it acted.

## 5a. Progress (October 2026)

- **Phase 0 (measurement).** Each battle pair is now seeded independently (`versus.js`). `OPP=current` measures a change against the AI as it is, so 50% means no change.
- **Phase 1 (evaluation).**
  - Fitted on 1,987 battles: `evaldata.js` records the positions, `evalfit.js` fits them, and `planner.js` holds the weights (EVAL).
  - Tested on battles it never saw, it calls the winner 73.5% of the time (80.7% by turns 5–7), against 67.9% for "more worth left wins".
  - Units still in the fight weigh the most, then objectives held and progress to a held win. Stress, broken units and expected losses count against. Firepower in hand counts for little.
- **Phase 2 (one-ply).** The planner judges the utility AI's best spots, and Fire! from where the unit stands, by how far each is expected to move that chance of winning. That is **54.4%** over 1,280 battles against the AI without it, and it is now the default.
  - A bug first hid every gain: the planner's copy of a unit was blocked from sight by the unit itself.
  - Before the evaluation was fitted, judging in hand-chosen currencies (worth, ground) measured only 49–52%.
- **Next.**
  - Refit the evaluation on battles played by the new AI. *Done: it forecasts better (75.2% of winners called) but plays no better (48.2% against the AI as it is); not kept.*
  - Extend the planner to the choices it does not yet see: charges, vehicles (`aiDrive`) and buildings. *Charges and gun hulls tried: no change (48–50%); kept behind `AIEXP=charge` and `AIEXP=drive`. Buildings not yet.*
  - Phase 3 started: a one-reply lookahead (`AIEXP=look`, `engine.js fork`): about 52% against the AI as it is over 4,480 battles (2.7 standard errors), with a control (the same options without the play-out: 43%) showing the play-out carries the choice. Deeper play-outs (4 activations) add nothing; about 25 ms a decision. On by default where the AI plays a person; off in AI-against-AI play.
  - What this says: the one-step judge has taken what it can from better weights and more options. The gain left is in looking further ahead (phase 3), where a choice's worth shows over the enemy's reply and the next turn, not the next shot.
  - Then the turn-horizon search (phase 3).

## 6. Risks

- **Evaluation quality.** If the evaluation misjudges positions, search makes the AI confidently wrong. Phase 1's prediction check is the guard.
- **Speed.** The current AI's own decision (exposure grid, route fields, about 60 ms) is already significant. A lookahead that calls it repeatedly needs caching or a lighter policy. Measure early.
- **Rules coverage.** Special rules, scenarios and campaign hooks all have to work on copies. `snapshot()`/`load()` exist for saving games, but the search must not leave a copy's effects (sounds, cards, log lines) in the real battle.
- **Measuring against itself.** Self-play can learn to beat itself in ways that do not transfer to people. The opponent pool and the tracked player campaigns are the check.

## Sources

- Dave Mark, *Infinite Axis Utility System*, GDC AI Summit 2013 and 2015 ("Building a Better Centaur: AI at Massive Scale", with Mike Lewis): [gameai.com/iaus](https://gameai.com/iaus.php), [Utility system (Wikipedia)](https://en.wikipedia.org/wiki/Utility_system)
- Dave Mark, *Modular Tactical Influence Maps*, Game AI Pro 2, ch. 30: [PDF](https://www.gameaipro.com/GameAIPro2/GameAIPro2_Chapter30_Modular_Tactical_Influence_Maps.pdf); Game AI Pro (free chapters): [gameaipro.com](https://gameaipro.com/)
- Battle for Wesnoth, RCA AI: [wiki.wesnoth.org/RCA_AI](https://wiki.wesnoth.org/RCA_AI), [Candidate actions](https://wiki.wesnoth.org/Candidate_action)
- Champandard, Verweij, Straatman, *Killzone 2 multiplayer bots* (Game AI Conference, Paris, 2009): [slides](https://www.slideshare.net/guerrillagames/killzone-2-multiplayer-bots)
- Champandard, *Monte-Carlo Tree Search in TOTAL WAR: ROME II's Campaign AI* (2014): [reference](https://stafforini.com/works/champandard-2014-monte-carlo-tree/); Cakmak and Davidson, *Total War: How AI Can Deliver Entertainment* (ACCU 2018): [video](https://www.accu.org/video/spring-2018-day-4/cakmak-davidson); *The AI of Total War* series: [Game Developer](https://www.gamedeveloper.com/design/revolutionary-warfare-the-ai-of-total-war-part-3-)
- Cowling, Powley, Whitehouse, *Information Set Monte Carlo Tree Search*, IEEE TCIAIG 2012: [White Rose eprints](https://eprints.whiterose.ac.uk/75048/); survey: *Monte Carlo Tree Search: A Review of Recent Modifications and Applications*: [arXiv 2103.04931](https://arxiv.org/pdf/2103.04931)
- Justesen, Mahlmann, Togelius, *Online Evolution for Multi-Action Adversarial Games* (2016): [ITU](https://pure.itu.dk/en/publications/online-evolution-for-multi-action-adversarial-games/); Baier, Cowling, *Evolutionary MCTS with Flexible Search Horizon* (AIIDE 2018): [AAAI](https://ojs.aaai.org/index.php/AIIDE/article/view/13023)
- *Blood Bowl: The Next Board Game Challenge for AI* (Bot Bowl): [ITU](https://pure.itu.dk/en/publications/blood-bowl-the-next-board-game-challenge-for-ai/); *MimicBot: Combining Imitation and Reinforcement Learning to win in Bot Bowl* (2021): [arXiv 2108.09478](https://arxiv.org/pdf/2108.09478); overview: [Wargamer](https://www.wargamer.com/blood-bowl-3/ai-challenge)
- CMA-ES and self-play weight tuning: Co-CMA-ES for Othello evaluation (IEEE TCIAI 2016): [Poznań](https://sin.put.poznan.pl/publications/details/n44051); CMA-ES weight tuning loop (Sparrow Mahjong): [arXiv 2508.07522](https://arxiv.org/pdf/2508.07522)
- SPRT in engine testing: [Chess Programming Wiki](https://chessprogramming.org/Sequential_Probability_Ratio_Test), [Fishtest FAQ](https://github.com/official-stockfish/fishtest/wiki/Fishtest-faq)
- Behaviour trees and utility in practice (lecture notes): [UT Austin CS354R](https://www.cs.utexas.edu/~theshark/courses/cs354r/lectures/cs354r-18.pdf)
- XCOM: Enemy Unknown AI: [GDC 2013 write-up (Japanese)](https://www.gamebusiness.jp/article/2013/04/01/7776.html); Julian Gollop on the AI: [GameWatcher](https://www.gamewatcher.com/2014-24-03-ai-should-be-a-lot-better-now-says-xcom-creator-but-i-am-not-convinced)
- Gears Tactics: [How AI helps achieve tactical clarity (Game Developer)](https://gamedeveloper.com/design/how-ai-helps-achieve-tactical-clarity-in-gears-tactics); [Make It Fast: Simultaneous AI Actions, Unreal Fest 2020](https://forums.unrealengine.com/t/talks-and-demos-make-it-fast-simultaneous-ai-actions-in-gears-tactics-unreal-fest-online-2020/610548)
- Into the Breach's telegraphed enemies: [Thinky Games](https://thinkygames.com/games/into-the-breach), [Road to the IGF (Game Developer)](https://gamedeveloper.com/game-platforms/road-to-the-igf-subset-games-i-into-the-breach-i-)
- Civilization V's four-level AI: [Wikipedia](https://en.wikipedia.org/wiki/Civilization_V)
- Portfolio and Puppet Search with NaiveMCTS (microRTS): [Combining Strategic Learning and Tactical Search in RTS Games, arXiv 1709.03480](https://arxiv.org/pdf/1709.03480); [Portfolio Search and Optimization for General Strategy Game-Playing, arXiv 2104.10429](https://arxiv.org/pdf/2104.10429); [microRTS AIs](https://github.com/Farama-Foundation/MicroRTS/wiki/Artificial-Intelligence)
- Texel's tuning method: [Chess Programming Wiki](https://www.chessprogramming.org/Texel%27s_Tuning_Method)
