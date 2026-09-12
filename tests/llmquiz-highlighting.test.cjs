const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const textmate = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const root = path.resolve(__dirname, '..');
const scopeName = 'text.html.markdown.liascript';
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const files = {
  ...Object.fromEntries(manifest.contributes.grammars.map(item => [item.scopeName, item.path])),
  'text.html.markdown': 'syntaxes/fixtures/markdown.tmLanguage.json',
  'source.js': 'syntaxes/fixtures/JavaScript.tmLanguage.json',
  'source.css': 'syntaxes/fixtures/css.tmLanguage.json',
  'text.tex.latex': 'syntaxes/fixtures/LaTeX.tmLanguage.json',
  'text.tex': 'syntaxes/fixtures/TeX.tmLanguage.json',
  'text.html.basic': 'syntaxes/fixtures/html.tmLanguage.json',
  'text.html.derivative': 'syntaxes/fixtures/html-derivative.tmLanguage.json'
};
const fence = '\u0060'.repeat(3);
const annotation = 'text @LLMQuiz(0.55;coverage=0.60;solution=1;feedback=1;assessmentengine=quality;Rechtschreibung=1;Satzbau=1,\u0060Beschreibe die Seitenlängen und die Innenwinkel eines Quadrats.\u0060)';
let registry;
let plainRegistry;
let grammar;
let markdown;
let plainMarkdown;

test.before(async () => {
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const config = {
    onigLib: Promise.resolve({
      createOnigScanner: sources => new oniguruma.OnigScanner(sources),
      createOnigString: value => new oniguruma.OnigString(value)
    }),
    loadGrammar: async scope => {
      if (!files[scope]) return null;
      const file = path.join(root, files[scope]);
      return textmate.parseRawGrammar(fs.readFileSync(file, 'utf8'), file);
    },
    getInjections: scope => manifest.contributes.grammars.filter(item => item.injectTo?.includes(scope)).map(item => item.scopeName)
  };
  registry = new textmate.Registry(config);
  plainRegistry = new textmate.Registry({ ...config, getInjections: () => [] });
  grammar = await registry.loadGrammar(scopeName);
  markdown = await registry.loadGrammar('text.html.markdown');
  plainMarkdown = await plainRegistry.loadGrammar('text.html.markdown');
});

test.after(() => { registry?.dispose(); plainRegistry?.dispose(); });

function tokenize(lines, newline = '\n', activeGrammar = grammar) {
  let stack = textmate.INITIAL;
  return lines.join(newline).split('\n').map(line => {
    const result = activeGrammar.tokenizeLine(line, stack);
    stack = result.ruleStack;
    return { line, tokens: result.tokens };
  });
}

function scopesAt(rows, lineText, text) {
  const row = rows.find(item => item.line.replace(/\r$/u, '') === lineText);
  assert.ok(row, 'Source line must exist: ' + lineText);
  const at = row.line.indexOf(text);
  assert.ok(at >= 0, 'Test text must exist: ' + text);
  const token = row.tokens.find(item => item.startIndex <= at && item.endIndex > at);
  assert.ok(token, 'Token must cover: ' + text);
  return token.scopes;
}

function hasScope(rows, line, text, expected) {
  const scopes = scopesAt(rows, line, text);
  assert.ok(scopes.some(scope => scope.startsWith(expected)), JSON.stringify({ line, text, expected, scopes }));
}

function assertCourseTail(rows) {
  hasScope(rows, '{{3}}', '3', 'constant.numeric.animation');
  hasScope(rows, '> <h3>Das integrierte dynamische Geometriesystem</h3>', 'h3', 'entity.name.tag');
  hasScope(rows, '# Danach', 'Danach', 'heading');
  hasScope(rows, '[[Weitere Antwort]]', '[[', 'punctuation.definition.quiz.begin');
  hasScope(rows, '@visible', 'visible', 'entity.name.function.macro');
  for (const line of ['{{3}}', '> <h3>Das integrierte dynamische Geometriesystem</h3>', '# Danach']) {
    const scopes = scopesAt(rows, line, line);
    assert.ok(!scopes.some(scope => /^(markup\.(raw|inline\.raw|fenced_code)|meta\.macro-call|string\.quoted\.backtick)/u.test(scope)), JSON.stringify({ line, scopes }));
  }
}

const tail = [
  '', '*******************', '', '</div>', '</section>', '',
  '{{3}}', '*******************', '',
  '> <h3>Das integrierte dynamische Geometriesystem</h3>', '',
  '*******************', '', '# Danach', '[[Weitere Antwort]]', '@visible'
];

function screenshotSource() {
  return [
    '<section>', '<div>', '', '{{2}}', '*******************', '',
    '> <h3>Mit einem im Browsercache integrierten Large Language Model</h3>', '',
    '**Aufgabe 1:** **Beschreibe** die Seitenlängen und die Innenwinkel eines Quadrats.', '',
    '<!-- data-solution-button="off" data-llm-textarea="3" -->',
    '[[Antwort]]', '[[?]] Denke an die Längen aller vier Seiten und an die Größe der Winkel.',
    fence + annotation,
    '<!-- lia-llm:criterion -->', 'Alle vier Seiten eines Quadrats sind gleich lang.',
    '<!-- lia-llm:criterion -->', 'Alle vier Innenwinkel eines Quadrats sind jeweils 90 Grad groß.',
    '<!-- lia-llm:solution -->', 'Ein Quadrat hat vier gleich lange Seiten. Alle vier Innenwinkel sind rechte Winkel, also jeweils 90 Grad groß.',
    fence, ...tail
  ];
}

for (const newline of ['\n', '\r\n']) {
  test('screenshot LLMQuiz immediately after a hint preserves following animation and HTML scopes (' + JSON.stringify(newline) + ')', () => {
    const rows = tokenize(screenshotSource(), newline);
    assertCourseTail(rows);
    hasScope(rows, fence + annotation, 'LLMQuiz', 'entity.name.function.macro');
    hasScope(rows, fence + annotation, 'Beschreibe', 'string.quoted.backtick.macro-argument');
    hasScope(rows, 'Alle vier Seiten eines Quadrats sind gleich lang.', 'Alle', 'markup.fenced_code.block');
  });
}

for (const preceding of [
  ['Ein Hinweis ohne Leerzeile.'],
  ['[[Antwort]]', '[[?]] Ein Hinweis ohne Leerzeile.'],
  ['<div>', 'Ein Hinweis ohne Leerzeile.'],
  ['<section>', '<div class="quiz">', 'Ein Hinweis ohne Leerzeile.']
]) {
  test('annotated text fence interrupts preceding ' + JSON.stringify(preceding) + ' and survives internal blank lines', () => {
    const rows = tokenize([
      ...preceding, fence + annotation,
      'Erstes Kriterium', '', '@inside [[X]] {{9}}', fence, ...tail
    ]);
    assertCourseTail(rows);
    hasScope(rows, '@inside [[X]] {{9}}', '@inside', 'markup.fenced_code.block');
    const scopes = scopesAt(rows, '@inside [[X]] {{9}}', '@inside');
    assert.ok(!scopes.some(scope => scope === 'entity.name.function.macro.liascript'));
  });
}


for (const newline of ['\n', '\r\n']) {
  test('manifest-registered Markdown injection recognizes the screenshot fence and recovers subsequent HTML and headings (' + JSON.stringify(newline) + ')', () => {
    const rows = tokenize(screenshotSource(), newline, markdown);
    hasScope(rows, fence + annotation, 'LLMQuiz', 'entity.name.function.macro');
    hasScope(rows, fence + annotation, 'Beschreibe', 'string.quoted.backtick.macro-argument');
    hasScope(rows, 'Alle vier Seiten eines Quadrats sind gleich lang.', 'Alle', 'markup.fenced_code.block');
    hasScope(rows, '> <h3>Das integrierte dynamische Geometriesystem</h3>', 'h3', 'entity.name.tag');
    hasScope(rows, '# Danach', 'Danach', 'heading');
    for (const line of ['{{3}}', '> <h3>Das integrierte dynamische Geometriesystem</h3>', '# Danach']) {
      const scopes = scopesAt(rows, line, line);
      assert.ok(!scopes.some(scope => /^(markup\.(raw|inline\.raw|fenced_code)|meta\.macro-call|string\.quoted\.backtick)/u.test(scope)), JSON.stringify({ line, scopes }));
    }
  });
}

test('Markdown injections leave prose without macro calls and quoted fence examples identical to built-in Markdown', () => {
  const examples = [
    ['# Titel', '', '**Fett** und *kursiv*, [Link](https://example.org).', '', 'Text [[Antwort]] {{3}}', '', fence + 'js', 'const example = "@LLMQuiz()";', fence],
    [fence.repeat(2) + 'markdown', fence + annotation, 'Kriterium', fence, fence.repeat(2), '', '# Danach'],
    ['Ein Beispiel: ' + '\u0060'.repeat(4) + ' ' + fence + annotation + ' ' + '\u0060'.repeat(4) + ' im Text.', '', '# Danach'],
    ['    ' + fence + annotation, '    Ein eingerücktes Codebeispiel.', '', '# Danach'],
    ['<script>', 'const text = "\u0060\u0060\u0060text @LLMQuiz(0.6,\u0060Frage\u0060)";', '</script>', '', '# Danach'],
    ['<style>', '/*', fence + annotation, '*/', '</style>', '', '# Danach'],
    ['<!-- Kommentar', fence + annotation, '-->', '', '# Danach'],
    [fence + 'text', fence + annotation, fence, '', '# Danach']
  ];
  for (const source of examples) {
    assert.deepEqual(tokenize(source, '\n', markdown), tokenize(source, '\n', plainMarkdown), source.join('\n'));
  }
});


for (const example of [
  { name: 'triple-backtick prompt', delimiter: '\u0060', promptLength: 3, closeLength: 3, language: 'text', body: 'Erwartung @inside [[X]]' },
  { name: 'longer backtick closer', delimiter: '\u0060', promptLength: 1, closeLength: 4, language: 'text', body: 'Erwartung @inside [[X]]' },
  { name: 'longer tilde closer', delimiter: '~', promptLength: 1, closeLength: 4, language: 'text', body: 'Erwartung @inside [[X]]' },
  { name: 'embedded JavaScript', delimiter: '\u0060', promptLength: 1, closeLength: 3, language: 'js', body: 'const example = "@inside [[X]]";', marker: 'const', expected: 'storage.type.js' },
  { name: 'unfinished JavaScript comment', delimiter: '\u0060', promptLength: 1, closeLength: 3, language: 'javascript', body: '/* Ein offener Kommentar @inside [[X]]', marker: 'Kommentar', expected: 'comment.block.js' },
  { name: 'unfinished JavaScript template string', delimiter: '\u0060', promptLength: 1, closeLength: 3, language: 'js', body: 'const example = \u0060@inside [[X]];', marker: '@inside', expected: 'string.template.js' }
]) {
  test('Markdown quoted annotations preserve ' + example.name + ' and recover following course text', () => {
    const quoted = '\u0060'.repeat(example.promptLength);
    const opener = example.delimiter.repeat(3) + example.language + ' @LLMQuiz(0.6,' + quoted + 'Frage (A), B' + quoted + ')';
    const rows = tokenize([
      'Ein Hinweis ohne Leerzeile.', opener, example.body,
      example.delimiter.repeat(example.closeLength),
      '# Danach', '', '> <h3>Weiter</h3>', '', '**Fett** und @outside'
    ], '\n', markdown);
    hasScope(rows, opener, 'Frage', 'string.quoted.backtick.macro-argument');
    hasScope(rows, example.body, example.marker ?? 'Erwartung', example.expected ?? 'markup.fenced_code.block');
    assert.ok(!scopesAt(rows, example.body, '@inside').some(scope => scope === 'entity.name.function.macro.liascript'));
    hasScope(rows, '# Danach', 'Danach', 'heading');
    hasScope(rows, '> <h3>Weiter</h3>', 'h3', 'entity.name.tag');
    hasScope(rows, '**Fett** und @outside', 'Fett', 'markup.bold');
    for (const line of ['# Danach', '> <h3>Weiter</h3>', '**Fett** und @outside']) {
      const scopes = scopesAt(rows, line, line);
      assert.ok(!scopes.some(scope => /^(markup\.(raw|inline\.raw|fenced_code)|meta\.macro-call|string\.quoted\.backtick)/u.test(scope)), JSON.stringify({ line, scopes }));
    }
  });
}

