#!/usr/bin/env node
/* The Monte Carlo walk over a story (docs/story-mode-plan.md, section 6):
   the story checked, then walked many times with random choices and random
   grades, and no battle played. It prints how often each ending, one-off and
   finale comes up, each meter's range and what moved it, how often each
   meter's thresholds are crossed, and anything nobody reaches.

     node scripts/story-sim.js [story-file] [-n walks]

   With no file it walks every story under src/story/ that registers one. */
'use strict';
const fs = require('fs');
const path = require('path');
const { R, SC } = require('../server/rules.js');
const S = require('../src/story/story.js');
const V = require('../src/story/validate.js');

const args = process.argv.slice(2);
let walks = 10000;
const files = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '-n') walks = +args[++i];
  else files.push(path.resolve(args[i]));
}
const ENGINE = ['story.js', 'validate.js', 'levers.js', 'scenarios-story.js'];
const WORDS = /-(text|maps)\.js$/;     // a story's words and maps, loaded by the story itself
if (!files.length) {
  const dir = path.join(__dirname, '..', 'src', 'story');
  fs.readdirSync(dir).filter((f) => f.endsWith('.js') && ENGINE.indexOf(f) < 0 && !WORDS.test(f)).forEach((f) => files.push(path.join(dir, f)));
}
files.forEach((f) => require(f));
const stories = S.list();
if (!stories.length) { console.log('No story to walk.'); process.exit(0); }
let bad = 0;
stories.forEach((def) => {
  console.log('\n=== ' + def.name + ' (' + def.id + ')');
  const res = V.check(def, { profile: R.profile, scenarios: SC.SCENARIOS });
  res.errors.forEach((e) => console.log('  ✗ ' + e));
  res.warnings.forEach((e) => console.log('  ! ' + e));
  if (!res.ok) { bad++; return; }
  console.log(V.describe(def, V.walk(def, { walks })));
});
process.exit(bad ? 1 : 0);
