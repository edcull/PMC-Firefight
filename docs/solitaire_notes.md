# Solitaire and co-op mode — what was built (game v63-64)

- `solitaire.js`: commando table (p. 147), OpFor table (p. 148), checkCommando / rollCommando / rollOpFor, and the six scenarios (Crushing the Resistance, Protecting the VIP, Decapitation, Evacuation, Sabotage, Ambush!) registered into `PMCScen.SCENARIOS` with `solo: true`.
- Turn: Beginning (scenario reveals, VIP OpFor steadied, civilians change hands) → Reserve (LZ nomination, entry points, civilians, corners) → Action (players; co-op alternates activations per player) → OpFor phase (enemy units furthest from players first, behaviour table + scenario modifier; Cumbersome 4-7 neutral) → Rally → End.
- Hidden OpFor: counters on the table; revealed units come from the pool. VIP/Evac: destroyed OpFor return to the pool.
- Co-op: side A units carry `owner` 1/2, player 2 painted in a third colour (`PALETTE.C`); game PL = chosen PL + 1 for OpFor/scenario counts.
- Interpretations: commandos take no Command Units or insertion platforms (those rules are not used, p. 149); counters placed by the game evenly; Ambush shifts are towards/away from the road.
- Tests: `solitairetest.js` (in npm test), `soloplay.js` (browser harness, COOP=1 for co-op).
