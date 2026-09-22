/* Where every top-level function in game.js begins and ends.

   Shared by the split tools. The only thing that needs care is the comment
   above a function: it explains the rule the function implements and must
   travel with it, and these comments run over several lines without leading
   asterisks — so the lines are classified by an actual scan rather than by
   what each one happens to start with. */
'use strict';

/* Which lines are wholly comment or blank. A line is "comment" if, after any
   code on it, nothing but a comment is left — which for this file means the
   whole line, since nothing here trails a comment after code. */
function classify(lines) {
  const kind = new Array(lines.length).fill('code');
  let inBlock = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (inBlock) {
      kind[i] = 'comment';
      if (/\*\//.test(line)) {
        inBlock = false;
        // something after the close is code
        const after = line.slice(line.lastIndexOf('*/') + 2).trim();
        if (after) kind[i] = 'code';
      }
      continue;
    }
    if (!trimmed) { kind[i] = 'blank'; continue; }
    if (trimmed.startsWith('//')) { kind[i] = 'comment'; continue; }
    if (trimmed.startsWith('/*')) {
      const close = line.indexOf('*/', line.indexOf('/*') + 2);
      if (close < 0) { inBlock = true; kind[i] = 'comment'; continue; }
      kind[i] = line.slice(close + 2).trim() ? 'code' : 'comment';
      continue;
    }
    // a line that opens a block comment after some code leaves us inside it
    const open = line.indexOf('/*');
    if (open >= 0 && line.indexOf('*/', open + 2) < 0) inBlock = true;
  }
  return kind;
}

function index(source) {
  const lines = source.split('\n');
  const kind = classify(lines);
  const fns = new Map();
  for (let i = 0; i < lines.length; i++) {
    if (kind[i] !== 'code') continue;
    const m = /^  function ([A-Za-z0-9_$]+)\s*\(/.exec(lines[i]);
    if (!m) continue;
    let end = i;
    if (!/^  function .*\}\s*$/.test(lines[i])) {
      for (let j = i + 1; j < lines.length; j++) {
        if (kind[j] === 'code' && /^  \}\s*$/.test(lines[j])) { end = j; break; }
      }
    }
    // the comment block sitting directly above, with no blank line between
    let top = i;
    for (let k = i - 1; k >= 0 && kind[k] === 'comment'; k--) top = k;
    if (!fns.has(m[1])) fns.set(m[1], { name: m[1], line: i, top: top, end: end });
  }
  return { lines, kind, fns };
}

module.exports = { index: index, classify: classify };
