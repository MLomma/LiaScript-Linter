'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkpoints } = require('../scripts/audit-corpus.cjs');
const tick = String.fromCharCode(96);
function candidates(source) {
  return [...checkpoints(source, source.split('\n')).candidates.entries()]
    .flatMap(([index, values]) => values.map(value => ({ line: index + 1, ...value })));
}

test('audit guard keeps stray typographic backticks within their paragraph', () => {
  const source = `Die Frage lautet: "${tick}Welche Zahl ergibt 64?"'.\n\n## Danach\n\n@Flaeche(${tick}id;[[0;0];[3;0]];#80f580${tick})\n@KoordText(${tick}id;[1;2];$a$${tick})\n\n[(X)] Sichtbare Antwort\n\n$a$`;
  const actual = candidates(source);
  assert.deepEqual(actual.map(({line,kind})=>({line,kind})), [
    {line:3,kind:'heading'}, {line:5,kind:'macro'}, {line:6,kind:'macro'},
    {line:8,kind:'quiz'}, {line:10,kind:'math'},
  ]);
  assert.equal(actual.find(item=>item.line===5).column, 1);
  assert.equal(actual.filter(item=>item.kind==='quiz').length, 1);
});

test('audit guard treats unmatched inline backticks as text through EOF', () => {
  const source = `Text ${tick}ohne Abschluss $x$ und [[Antwort]]`;
  const actual = candidates(source);
  assert.deepEqual(actual.map(item=>item.kind), ['math','quiz']);
  assert.equal(actual[0].column,source.indexOf('$'));
  assert.equal(actual[1].column,source.indexOf('[['));
  assert.deepEqual(candidates(`Text ${tick}code [[kein Quiz]]${tick}`), []);
});

test('audit guard keeps legitimate multiline macro strings opaque across paragraphs', () => {
  const fence=tick.repeat(3);
  const source=`@M(${fence}\n## Kein Titel\n\n[[Kein Quiz]]\n$x$ und ))\n${fence},@N(${tick}(( literal${tick}))\n\n## Danach\n\n[(X)] Sichtbar\n\n$a$`;
  const actual=candidates(source);
  assert.deepEqual(actual.map(({line,kind})=>({line,kind})), [
    {line:1,kind:'macro'}, {line:8,kind:'heading'}, {line:10,kind:'quiz'}, {line:12,kind:'math'},
  ]);
  assert.deepEqual(candidates(`Text ${tick}mehrzeilig\n[[nur Code]]${tick}`), []);
});