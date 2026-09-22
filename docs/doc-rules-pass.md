# Firefight — Markerlights, Inspiring Presence, and the campaign screens

*A pass over two special rules that were only half there, and a set of campaign
screens that were hiding what the player needed in order to decide anything.*

---

## 1. Markerlights (p. 58) — one action doing the work of two

The book gives a Markerlight unit **two distinct special actions**, and they are not
interchangeable:

| | Designate target | Mark the target |
|---|---|---|
| calls up | a unit **with** Indirect Fire | a unit **without** it |
| which then | shoots without needing line of sight | shoots with the target in sight |
| and gets | nothing extra | the **+2 half-range bonus**, whatever the real distance |

The game had **one** action that did both at once, and three things followed from that.

**The mark leaked.** `t.marked` was set on the target and left there for the rest of the
turn, and every modifier in the engine read it. So one designation gave *every* friendly
Indirect Fire unit a line-of-sight-free shot at that target, and *every* other friendly
unit +2 against it, for the whole turn — where the book grants it to the one or two units
the marker actually calls up, and then it is over.

**The pools were mixed.** The chain of responders was "anyone with Indirect Fire, or
anyone who can see it" — so a designation could be answered by a rifle team and a mark by
a mortar, neither of which the book allows.

**The responders were not bound to the target.** A unit activated out of sequence by the
marker could do anything it liked, including shoot something else.

### What it does now

`state.mark` is the live call — `{side, kind, targets}` — and it exists only while the
chain it opened is running. `R.markCall(state, shooter, target)` is the single place that
answers "is this shooter answering this call, and what is it worth": `'designate'` buys
sight, `'mark'` buys the +2, and `null` is everybody else. `canShoot` and `shotMods` both
read it, so the board's odds and the roll cannot disagree. When the last called gun has
fired, the call is cleared and the marks come off.

Two actions now appear on the bar, each offered only when somebody could answer it. The
rest of the rule came with them:

- **Move and mark, or stand still and call two.** The marker is shown ground within its
  Movement as well as targets; walk it first and it brings **one** gun down, stand still
  and it brings **two**.
- **Two different targets.** Standing still, the first tap marks one enemy and the second
  either taps the same one again (one target, two guns) or a second enemy (two targets,
  one gun each) — the book's two stationary options, without a third button.
- **The responder shoots what was marked**, and nothing else.
- **Smoke Markers (p. 94)** are now the cut-down version they are printed as: designation
  only, 12" rather than 24", and always two guns *even if the marker moved*. They were
  getting the full Markerlight treatment, +2 included.
- A **dug-in gun** (Dig in!, p. 94) cannot answer a designation: it traded indirect fire
  for its sights, so it has to see what it hits.

---

## 2. Inspiring Presence (p. 58) — and the sentence on p. 28

The radius, the two exclusions and the re-roll were all correct. What was missing was the
general rule that governs every aura in the game:

> Both suppressed and broken unit cannot use their passive skills which grants bonuses to
> another units, such like Inspire presence, Field medics, Pheromone markers ets. Please
> note that this applies to bonuses only, but not for penalties (the life is unfair, I
> know...)! — p. 28

Only half of it was applied: the four aura functions checked for **broken** and let a
**suppressed** unit go on inspiring, healing and shielding. A commander pinned down under
fire was still steadying the line.

There is now one gate, `projects(u)` — alive, on the table, and steady — and it is used by
**Inspiring Presence**, **Field Medics**, **Counter-jamming** and the rebels' *"…but
they'll never take our freedom!"*. **Jammers** deliberately does not use it: it is a
penalty on the enemy, so it keeps working from a unit that is suppressed or broken, which
is what the parenthesis on p. 28 is there to say. It had been switched off for broken
jammers, in the enemy's favour.

The gate also covers **riding inside a vehicle**: a commander in the back of a truck
inspires nobody. A **Command Vehicle** is the exception the book already provides — it
carries its passenger's rules on the hull, so it goes on inspiring from there.

One reading recorded: a unit that has Inspiring Presence never benefits from it, including
from its own. The book excludes "other units with this rule"; treating the unit itself as
inspired by itself would make the exclusion pointless.

---

## 3. Company promotion, with the road to it shown

Promotion worked, but the dossier showed a single disabled button and the first fault as a
line of text. A force could sit a long way short of one condition without knowing which.

`C.promotionProgress(co)` now returns the conditions of pp. 83–84 as a list — money
banked, a legal army at every Tier up to the next, and, before Tier IV, a Tier III army at
Priority Level 2 — each with what it wants, what the force has, and what is short. The
dossier draws it as a checklist with a progress bar: *3 of 5*, ticks against what is done,
and under each unmet line the actual shortfall (*"Needs 2 more Tier III units."*). The
button goes live the moment the last one is met.

Getting the shortfall out needed `canFieldArmy` to show its working, so it is now a thin
wrapper over `fieldReport`, which builds the same army and says which Tier's minimum it
could not fill, or which rule the finished list broke.

---

## 4. Picking a unit for a battle: what it is carrying

The contract screen listed each unit's name, profile and experience. The thing that
actually decides whether to take a unit into another fight — **how close it is to its next
Battle Trauma** — was not shown anywhere.

Each unit on the list now carries its EXP, its **Trauma Points against the threshold**
(`7/10 TP`, or `/15` under *Mental Training*), and counts of the Battle Honours and Battle
Traumas it already has. A unit within two points of a Trauma is picked out in amber.

---

## 5. Battle Honours: the player picks the three

p. 88: *"The player selects three Battle Honours which the unit hasn't gained yet and
chooses one of them randomly."*

The game was doing the second half and not the first — it drew three at random and then
drew one of those. Both halves are the player's decision and the dice's in turn, and the
choosing is the interesting one.

The honour screen now lays out **every** honour the unit has not earned, the player taps
three to put them forward, and only then does the Draw button come alive. After the draw,
the three are all that is left on the screen with the winner marked.

---

## 6. The aftermath, itemised

Experience and trauma were each printed as a single run-on line. Both are now a proper
ledger: every circumstance the book lists, what it was worth, the total, and where it
leaves the unit — *"7 of 10 — a Battle Trauma at 10"*, with a bar.

Units that sat the battle out get the same treatment rather than a one-line aside: the
D3+1 they rolled for **rest and recovery** (p. 85), what came off, and what is left. They
are shown whether or not they had anything to shed, and a machine still in the workshop
after salvage says so.

That rule was checked and was already right — the recovery happens, it is capped at zero,
and a salvaged machine ticks off its spell at the same time. It was simply invisible.

---

## 7. Demolishing the scenario objective

p. 54: *"In this scenario, all units can make the Demolish special action targetting the
objective, but only Sappers can target other objects."* p. 49 says the same: *"ALL
attacking infantry units are allowed to demolish it."*

The rules engine knew this — `chargeBonus` already gave Sappers +4 and everyone else +2
against the objective. But the **action was never offered**: the Breach button was pushed
onto the bar only for units with the Sappers rule, so in a Demolish scenario a rifle team
could not touch the thing it was there to destroy. The attacker could win only if the list
happened to include engineers.

`R.canCharge(u, r)` now decides it: Sappers against anything destructible, any infantry
against the scenario objective, and nobody with a Cumbersome Weapon or a hull, because
neither assaults. The button appears for every infantry unit in range of the objective,
labelled **Demolish!** rather than Breach when the unit is not a Sapper, and the hint says
it goes in at +2 where Sappers would get +4.

---

## 8. Honours and traumas on the table

A campaign unit's history was in the dossier and nowhere else. During a battle it now
wears it: a **★ for each Battle Honour**, a **♥ for each Battle Trauma** and a **⚙ for
each vehicle Upgrade**, beside the name in the roster list and on the stat strip, with the
names spelled out as chips under the stats and on hover. A one-off battle shows nothing,
because nobody in it has a history.

---

## 9. Coverage

| harness | checks | what was added |
|---|---|---|
| `markerlight.js` | 17 (new) | the two actions played through the interface: who answers each, what it is worth, that the responder is bound to the target, that the call dies with the guns, move-and-mark, and Smoke Markers |
| `specialrules.js` | 65 → 85 | the mark's scope six ways; Inspiring Presence at 12", for itself, suppressed, broken, in a transport, in a Command Vehicle, and what the re-roll is worth; Jammers from a broken unit; Counter-jamming from a suppressed one |
| `terrain.js` | 32 → 40 | every infantry unit may charge the objective, only Sappers anything else, and a Sapper brings it down more often |
| `camp.js` | 189 → 213 | the promotion checklist, the Tier IV gate, `fieldReport`'s shortfall, and rest and recovery for units that sat out |
| `campflow.js` | +12 | the promotion panel end to end, Trauma Points on the picker, and the honour screen: the pool, the three, the held-back draw |

---

# Part two — moving is now a proposal, not a commitment

*"When moving or advancing. Show ghost unit position, show terrain it ends in, show
weapon range/LoS. If advancing show potential targets. Then requires confirmation to
finish the move."*

## 10. What was wrong with tapping the ground

A move happened the instant a square was tapped. On a phone that is one mis-tap between a
unit in cover and a unit standing in the open with its activation spent and nothing to
show for it — and there is no undo, because the activation is gone.

It was also asking the player to hold the whole board in their head. Whether a square is
worth walking to depends on what it gives you (cover, height), what you would be able to
see from it, what you could shoot from it, and who could shoot back. All of that was
knowable from the engine and none of it was on the screen until after the move.

## 11. The preview

Tapping reachable ground now **proposes** the move rather than making it.

**On the table** a half-weight ghost of the unit stands on the spot, with a dashed line
along the route it would walk and a soft pool under its feet. The sight aura and the two
range rings — full Range and half Range — are redrawn **from the ghost's position**
rather than the unit's, because that is the question being asked. Enemies the move would
bring into reach are ringed in green; enemies that would have the unit in their sights are
ringed in red.

**On the card**, the distance and the ground it would end in, with what that ground is
actually worth — *"ends up in ruins — +2 Defence, costs 1" a square to cross, blocks line
of sight"* — and three counts:

| | |
|---|---|
| **Sees** | the enemies in line of sight from there |
| **Can shoot** | Advance only: the enemies it could legally fire on once it arrives |
| **Exposed to** | the enemy guns that would have it in range and in sight |

Each lists the unit codes, so it is a decision rather than a number.

**Confirming** is a second tap on the same ground, or the **Move here** / **Advance here**
button. Tapping different ground moves the proposal; **Pick another spot**, or a tap
outside the shaded area, drops it. Until then the unit has not moved and has not spent its
activation — a property the harness checks explicitly.

The three counts are computed by asking the engine the same questions it will be asked
once the unit is really there: `hasLoS` and `canShoot` against a ghost copy of the unit at
the destination. The preview cannot drift from the resolution, because it is the same
code.

## 12. Coverage

`movepreview.js` is new, 21 checks: that a tap proposes rather than moves, that the unit
stays put with its activation unspent, that the card names the ground and its value, that
"Sees" and "Can shoot" agree with what the engine says about a unit standing there, that
tapping elsewhere moves the proposal and cancelling drops it, that a second tap commits,
and that a confirmed Advance moves and then offers the shot.

`touch.js` and `smoke.js` now tap twice, which is what a player does; `demolition.js`
confirms through the button.
