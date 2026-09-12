const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const textmate = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');

const root = path.resolve(__dirname, '..');
const scopeName = 'text.html.markdown.liascript';
const files = {
  [scopeName]: 'syntaxes/liascript.tmLanguage.json',
  'liascript.injection': 'syntaxes/liascript.injection.tmLanguage.json',
  'liascript.markdown-macros.injection': 'syntaxes/liascript.markdown-macros.injection.tmLanguage.json',
  'text.html.markdown': 'syntaxes/fixtures/markdown.tmLanguage.json',
  'source.js': 'syntaxes/fixtures/JavaScript.tmLanguage.json',
  'source.css': 'syntaxes/fixtures/css.tmLanguage.json',
  'text.tex.latex': 'syntaxes/fixtures/LaTeX.tmLanguage.json',
  'text.tex': 'syntaxes/fixtures/TeX.tmLanguage.json',
  'text.html.basic': 'syntaxes/fixtures/html.tmLanguage.json',
  'text.html.derivative': 'syntaxes/fixtures/html-derivative.tmLanguage.json'
};
let registry;
let grammar;
test.before(async () => {
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: sources => new oniguruma.OnigScanner(sources),
      createOnigString: value => new oniguruma.OnigString(value)
    }),
    loadGrammar: async scope => {
      const file = files[scope];
      if (!file) return null;
      const absolute = path.join(root, file);
      return textmate.parseRawGrammar(fs.readFileSync(absolute, 'utf8'), absolute);
    },
    getInjections: scope => scope === scopeName ? ['liascript.injection']
      : scope === 'text.html.markdown' ? ['liascript.markdown-macros.injection'] : []
  });
  grammar = await registry.loadGrammar(scopeName);
});
test.after(() => registry?.dispose());

function tokenize(source, activeGrammar = grammar) {
  let stack = textmate.INITIAL;
  return source.split('\n').map(line => {
    const result = activeGrammar.tokenizeLine(line, stack);
    stack = result.ruleStack;
    return { line, tokens: result.tokens };
  });
}
function scopesAt(rows, line, text, offset = 0) {
  const at = rows[line].line.indexOf(text) + offset;
  assert.ok(at >= 0, 'Test text must occur in the source line');
  const token = rows[line].tokens.find(item => item.startIndex <= at && item.endIndex > at);
  assert.ok(token, 'Token must cover the requested position');
  return token.scopes;
}
function hasScope(rows, line, text, expected, offset = 0) {
  const scopes = scopesAt(rows, line, text, offset);
  assert.ok(scopes.some(scope => scope.startsWith(expected)), JSON.stringify({ line, text, expected, scopes }));
}
function noLiaSyntax(rows, line, text) {
  const scopes = scopesAt(rows, line, text);
  assert.deepEqual(scopes.filter(scope => scope.endsWith('.liascript') && scope !== scopeName), []);
}

test('metadata, scalar definitions, block definitions and macro parameters receive theme-compatible scopes', () => {
  const rows = tokenize([
    '<!--', 'author: Ada', '@short: Hallo @author', '',
    '@Card', '**Titel** und @0', '@end', '-->', '', '@Card(Beispiel)'
  ].join('\n'));
  hasScope(rows, 1, 'author', 'entity.name.tag.metadata');
  hasScope(rows, 1, 'Ada', 'string.unquoted.metadata');
  hasScope(rows, 2, '@short', 'entity.name.tag.metadata');
  hasScope(rows, 4, 'Card', 'entity.name.function.preprocessor');
  hasScope(rows, 5, 'Titel', 'markup.bold');
  hasScope(rows, 5, '@0', 'variable.parameter', 1);
  hasScope(rows, 6, '@end', 'keyword.control.end');
  hasScope(rows, 9, 'Card', 'entity.name.function.macro');
});

test('native quiz families and multiline selections are colored in prose, lists and indented lines', () => {
  const rows = tokenize([
    'Eine Lücke: [[Antwort]] im Satz.', '',
    '- [(X)] Ja', '- [( )] Nein', '',
    '    [[X]] A', '    [[ ]] B', '    [[?]] Hinweis', '',
    '    [[ (A)', '    | B', '    ]]', '',
    '[[!]]', '[->[Ziel]]'
  ].join('\n'));
  hasScope(rows, 0, '[[', 'punctuation.definition.quiz.begin');
  hasScope(rows, 2, 'X', 'constant.language.answer');
  hasScope(rows, 3, '[( )]', 'punctuation.definition.quiz.begin');
  hasScope(rows, 5, 'X', 'constant.language.answer');
  hasScope(rows, 7, '?', 'constant.language.quiz');
  hasScope(rows, 10, '|', 'keyword.operator.selection');
  hasScope(rows, 11, ']]', 'punctuation.definition.quiz.end');
  hasScope(rows, 13, '!', 'constant.language.quiz');
  hasScope(rows, 14, '[->[', 'keyword.operator.quiz');
});

test('animations, narration, inline animation and mathematical formulas have specific scopes', () => {
  const rows = tokenize([
    '    {{2-4}}', 'Text {3}{erscheint später}.', '',
    '    --{{0 German Female}}--', '', 'Eine Formel: $x^2$ und $$y = 2$$.'
  ].join('\n'));
  hasScope(rows, 0, '2', 'constant.numeric.animation');
  hasScope(rows, 0, '-', 'keyword.operator.range');
  hasScope(rows, 1, '3', 'constant.numeric.animation');
  hasScope(rows, 3, 'German Female', 'string.unquoted.voice');
  hasScope(rows, 5, 'x^2', 'markup.math.inline');
  hasScope(rows, 5, 'y = 2', 'markup.math.block');
});

test('Markdown headings, emphasis and links remain highlighted alongside LiaScript', () => {
  const rows = tokenize('# Titel @author\n\n**Fett @author** und [Link](https://example.org).');
  hasScope(rows, 0, 'Titel', 'heading');
  hasScope(rows, 0, 'author', 'entity.name.function.macro');
  hasScope(rows, 2, 'Fett', 'markup.bold');
  hasScope(rows, 2, 'author', 'entity.name.function.macro');
  hasScope(rows, 2, 'https://', 'markup.underline.link');
});

test('inline code, escaped macros and email addresses do not become LiaScript calls', () => {
  const rows = tokenize('Beispiel: \u0060@sample [[X]] {{1}}\u0060, \u0060\u0060@another\u0060\u0060, \\@escaped und mail@example.org.');
  noLiaSyntax(rows, 0, '@sample');
  noLiaSyntax(rows, 0, '[[X]]');
  noLiaSyntax(rows, 0, '@another');
  noLiaSyntax(rows, 0, '@escaped');
  noLiaSyntax(rows, 0, '@example');
});

test('backtick and tilde fences shield Lia-looking content and preserve the JavaScript embedding', () => {
  const rows = tokenize([
    '\u0060\u0060\u0060javascript', 'const sample = "@sample [[X]] {{1}}";', '\u0060\u0060\u0060',
    '', '~~~markdown', '@sample', '[[X]]', '    {{1}}', '~~~', '', '@visible'
  ].join('\n'));
  hasScope(rows, 1, 'const', 'meta.embedded.block.javascript');
  noLiaSyntax(rows, 1, '@sample');
  noLiaSyntax(rows, 5, '@sample');
  noLiaSyntax(rows, 6, '[[X]]');
  noLiaSyntax(rows, 7, '{{1}}');
  hasScope(rows, 10, 'visible', 'entity.name.function.macro');
});

test('ordinary indented code and ordinary HTML comments shield Lia-looking content', () => {
  const rows = tokenize('    const value = "@sample";\n\n<!-- An ordinary @sample comment. -->');
  noLiaSyntax(rows, 0, '@sample');
  noLiaSyntax(rows, 2, '@sample');
});

test('style and onload macro contents retain CSS and JavaScript embedding scopes', () => {
  const rows = tokenize([
    '<!--', '@style', 'h1 { color: red; }', '@end', '',
    '@onload', 'const value = "@notAMacro";', '@end', '-->'
  ].join('\n'));
  hasScope(rows, 2, 'color', 'meta.embedded.block.css');
  hasScope(rows, 6, 'const', 'meta.embedded.block.javascript');
  const scopes = scopesAt(rows, 6, '@notAMacro');
  assert.ok(!scopes.includes('entity.name.function.macro.liascript'));
  hasScope(rows, 7, '@end', 'keyword.control.end');
});

test('ordinary Markdown recognizes macro names without enabling quizzes or animations', async () => {
  const markdown = await registry.loadGrammar('text.html.markdown');
  const rows = tokenize('Hallo @sample [[X]] {{1}}', markdown);
  hasScope(rows, 0, 'sample', 'entity.name.function.macro.liascript');
  noLiaSyntax(rows, 0, '[[X]]');
  noLiaSyntax(rows, 0, '{{1}}');
});

test('Markdown macro names have separate scopes from punctuation and nested or quoted arguments', async () => {
  const markdown = await registry.loadGrammar('text.html.markdown');
  const rows = tokenize('@Bla(blubb)\n@Outer(@Inner(value),\u0060@literal()\u0060)\n# Danach', markdown);
  hasScope(rows, 0, 'Bla', 'entity.name.function.macro.liascript');
  hasScope(rows, 0, '@', 'punctuation.definition.macro.liascript');
  hasScope(rows, 0, '(', 'punctuation.section.arguments.begin.liascript');
  hasScope(rows, 0, ')', 'punctuation.section.arguments.end.liascript');
  for (const text of ['@', '(', 'blubb', ')']) {
    assert.ok(!scopesAt(rows, 0, text).includes('entity.name.function.macro.liascript'), text);
  }
  hasScope(rows, 1, 'Outer', 'entity.name.function.macro.liascript');
  hasScope(rows, 1, 'Inner', 'entity.name.function.macro.liascript');
  hasScope(rows, 1, '@literal', 'string.quoted.backtick.macro-argument.liascript');
  assert.ok(!scopesAt(rows, 1, '@literal').includes('entity.name.function.macro.liascript'));
  hasScope(rows, 2, 'Danach', 'heading');
  assert.ok(!scopesAt(rows, 2, 'Danach').includes('meta.macro-call.liascript'));
});

test('Markdown macro injection shields code, comments, embedded languages, email and escapes', async () => {
  const markdown = await registry.loadGrammar('text.html.markdown');
  const fence = '\u0060'.repeat(3);
  const rows = tokenize([
    '\u0060@inline(value)\u0060', '',
    '    @indented(value)', '',
    fence + 'text', '@fenced(value)', fence, '',
    '<!-- @comment(value) -->', '',
    '<script>', 'const value = "@javascript(value)";', '</script>', '',
    '<style>', '.box { content: "@css(value)"; }', '</style>', '',
    '<span title="@attribute(value)">Text</span>', '',
    'mail@example.org and \\@escaped(value)', '', '@visible(value)'
  ].join('\n'), markdown);
  for (const [line, text] of [[0, '@inline'], [2, '@indented'], [5, '@fenced'],
    [8, '@comment'], [11, '@javascript'], [15, '@css'], [18, '@attribute'],
    [20, '@example'], [20, '@escaped']]) {
    noLiaSyntax(rows, line, text);
  }
  hasScope(rows, 22, 'visible', 'entity.name.function.macro.liascript');
});

test('all contributed snippet bodies have a prefix and useful text', () => {
  const snippets = JSON.parse(fs.readFileSync(path.join(root, 'snippets/liascript.code-snippets'), 'utf8'));
  assert.ok(Object.keys(snippets).length >= 8);
  for (const [name, snippet] of Object.entries(snippets)) {
    assert.match(snippet.prefix, /^lia-/u, name);
    assert.ok(Array.isArray(snippet.body) && snippet.body.length > 0, name);
    assert.ok(snippet.body.every(line => typeof line === 'string'), name);
  }
});

test('single-line metadata and closing markers on metadata lines recover normal Markdown scopes', () => {
  const rows = tokenize([
    '<!-- language: de -->', '# Titel', '',
    '<!--', '@Block', 'Inhalt', '@end', 'author: Ada -->', '',
    'Text @author'
  ].join('\n'));
  hasScope(rows, 0, 'language', 'entity.name.tag.metadata');
  hasScope(rows, 0, '-->', 'punctuation.definition.comment.end');
  hasScope(rows, 1, 'Titel', 'heading');
  hasScope(rows, 7, 'author', 'entity.name.tag.metadata');
  assert.ok(!scopesAt(rows, 9, 'Text').includes('meta.metadata.liascript'));
});

test('embedded HTML, JavaScript and CSS retain their native token scopes and shield macro-looking strings', () => {
  const rows = tokenize([
    '<script>', 'const value = "@sample [[X]]";', '</script>', '',
    '<style>', 'h1 { color: red; }', '</style>', '', '<div class="box">Inhalt</div>'
  ].join('\n'));
  hasScope(rows, 1, 'const', 'storage.type.js');
  hasScope(rows, 1, '@sample', 'string.quoted.double.js');
  noLiaSyntax(rows, 1, '@sample');
  hasScope(rows, 5, 'color', 'support.type.property-name.css');
  hasScope(rows, 8, 'class', 'entity.other.attribute-name');
});

function assertCourseTail(rows, headingLine) {
  hasScope(rows, headingLine, 'Danach', 'heading');
  hasScope(rows, headingLine + 1, '[[', 'punctuation.definition.quiz.begin');
  hasScope(rows, headingLine + 2, 'visible', 'entity.name.function.macro');
  for (const line of [headingLine, headingLine + 1, headingLine + 2]) {
    const scopes = rows[line].tokens.flatMap(token => token.scopes);
    assert.ok(!scopes.some(scope => /^(markup\.(raw|fenced_code)|meta\.macro-call|meta\.macro-arguments|string\.quoted\.backtick)/u.test(scope)), JSON.stringify({ line, scopes }));
  }
}

test('LLMQuiz annotated text fences allow backtick-quoted prompts and close before the next course section', () => {
  const tick = '\u0060';
  const triple = tick.repeat(3);
  for (const quotedPrompt of [tick + 'Frage (mit Klammern), bitte' + tick, triple + 'Frage (mit Klammern), bitte' + triple]) {
    const rows = tokenize([
      triple + 'text @LLMQuiz(0.55;coverage=0.55,' + quotedPrompt + ')',
      'Erwartung: @sample [[X]] {{1}}', triple,
      '# Danach', '[[Antwort]]', '@visible'
    ].join('\n'));
    assertCourseTail(rows, 3);
    hasScope(rows, 0, 'LLMQuiz', 'entity.name.function.macro');
    hasScope(rows, 0, 'Frage', 'string.quoted.backtick.macro-argument');
    hasScope(rows, 1, '@sample', 'markup.fenced_code.block');
    noLiaSyntax(rows, 1, '@sample');
  }
});

test('standalone triple-backtick macro parameters preserve multiline arguments and recover course scopes', () => {
  const triple = '\u0060'.repeat(3);
  for (const lines of [
    ['@llmquiz(' + triple + 'Frage (mit Klammern)', '', 'Weitere Zeile', triple + ')'],
    ['@llmquiz(', triple, 'Frage (mit Klammern)', '', 'Weitere Zeile', triple, ')'],
    ['    @llmquiz(' + triple + 'Frage', 'Weitere Zeile', '    ' + triple + ')']
  ]) {
    const heading = lines.length;
    const rows = tokenize([...lines, '# Danach', '[[Antwort]]', '@visible'].join('\n'));
    assertCourseTail(rows, heading);
    const payloadLine = lines.findIndex(line => line.includes('Frage'));
    hasScope(rows, payloadLine, 'Frage', 'string.quoted.backtick.macro-argument');
    assert.ok(!scopesAt(rows, payloadLine, 'Frage').some(scope => scope.startsWith('markup.raw')));
  }
});

test('macro argument parsing balances nested calls and does not close at parentheses or commas inside quoted arguments', () => {
  const tick = '\u0060';
  const triple = tick.repeat(3);
  const rows = tokenize([
    '@Outer(@Inner(a,(b)), ' + tick + 'Text ), mit Komma' + tick + ', ' + triple + 'mehr',
    'Text (und ,)', triple + ', tail)',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  assertCourseTail(rows, 3);
  hasScope(rows, 0, 'Inner', 'entity.name.function.macro');
  hasScope(rows, 0, 'Text', 'string.quoted.backtick.macro-argument');
  hasScope(rows, 1, 'Text', 'string.quoted.backtick.macro-argument');
  hasScope(rows, 2, 'tail', 'meta.macro-call');
});

test('annotated fences accept a longer matching closer without absorbing later course content', () => {
  for (const delimiter of ['\u0060', '~']) {
    const rows = tokenize([
      delimiter.repeat(3) + 'text @LLMQuiz(0.6,\u0060Frage\u0060)',
      'Antwort', delimiter.repeat(4), '# Danach', '[[Antwort]]', '@visible'
    ].join('\n'));
    assertCourseTail(rows, 3);
  }
});

test('annotated JavaScript fences close even when the embedded code has an unfinished template string or comment', () => {
  const triple = '\u0060'.repeat(3);
  for (const body of ['const value = \u0060unterminated;', '/* unfinished comment']) {
    const rows = tokenize([
      triple + 'js @Run(\u0060Frage\u0060)', body, triple,
      '# Danach', '[[Antwort]]', '@visible'
    ].join('\n'));
    assertCourseTail(rows, 3);
    hasScope(rows, 1, body.startsWith('const') ? 'const' : 'unfinished', body.startsWith('const') ? 'storage.type.js' : 'comment.block.js');
  }
});

test('unquoted fence annotations in other languages retain the built-in Markdown grammar', () => {
  const triple = '\u0060'.repeat(3);
  for (const language of ['java', 'cpp', 'csharp', 'ruby']) {
    const rows = tokenize([triple + language + ' @Run()', 'example', triple, '# Danach', '[[Antwort]]', '@visible'].join('\n'));
    assertCourseTail(rows, 3);
    assert.ok(!scopesAt(rows, 0, '@Run').includes('meta.code-fence.annotation.liascript'));
  }
});

test('quoted arguments and indented annotated fences work with CRLF, blank lines and multiple quoted parameters', () => {
  const triple = '\u0060'.repeat(3);
  const macroLines = [
    '    @llmquiz(', '      ' + triple + 'Erste Frage )',
    '', '      ' + triple + ',',
    '      ' + triple, 'Zweite Frage (mit Komma,)', '      ' + triple, '    )'
  ];
  const macroRows = tokenize([...macroLines, '# Danach', '[[Antwort]]', '@visible'].join('\r\n'));
  assertCourseTail(macroRows, macroLines.length);
  hasScope(macroRows, 1, 'Erste Frage', 'string.quoted.backtick.macro-argument');
  hasScope(macroRows, 5, 'Zweite Frage', 'string.quoted.backtick.macro-argument');

  const fenceRows = tokenize([
    '    ' + triple + 'text @LLMQuiz(0.6,\u0060Frage (A), B\u0060)',
    '    Lösung', '    ' + triple, '# Danach', '[[Antwort]]', '@visible'
  ].join('\r\n'));
  assertCourseTail(fenceRows, 3);
  hasScope(fenceRows, 1, 'Lösung', 'markup.fenced_code.block');
});

test('longer macro quoting preserves shorter Markdown code fences inside the parameter', () => {
  const triple = '\u0060'.repeat(3);
  const longer = '\u0060'.repeat(4);
  const rows = tokenize([
    '@Echo(' + longer + 'Ein Codebeispiel:',
    triple + 'javascript', 'const value = f(a, b);', triple,
    'Weitere Erläuterung', longer + ')', '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  assertCourseTail(rows, 6);
  for (const [line, text] of [[1, 'javascript'], [2, 'const'], [3, triple]]) {
    hasScope(rows, line, text, 'string.quoted.backtick.macro-argument');
    assert.ok(!scopesAt(rows, line, text).some(scope => scope.startsWith('markup.fenced_code')));
  }
});

test('known annotated JavaScript, CSS and JSON fences retain their embedded language scopes', () => {
  const triple = '\u0060'.repeat(3);
  for (const [language, body, text, expected] of [
    ['javascript', 'const value = "@sample";', 'const', 'storage.type.js'],
    ['js', 'const value = "@sample";', 'const', 'storage.type.js'],
    ['css', 'h1 { color: red; }', 'color', 'support.type.property-name.css'],
    ['json', '{"answer": 42}', '"answer"', 'meta.embedded.block.json']
  ]) {
    const rows = tokenize([
      triple + language + ' @Run(\u0060Frage (A), B\u0060)',
      body, triple, '# Danach', '[[Antwort]]', '@visible'
    ].join('\n'));
    assertCourseTail(rows, 3);
    hasScope(rows, 1, text, expected);
  }
});

test('an annotated fence stays open for shorter or differently typed delimiter lines', () => {
  const tick = '\u0060';
  const rows = tokenize([
    tick.repeat(4) + 'text @Run(\u0060Frage\u0060)',
    'Erste Zeile', tick.repeat(3), 'Zweite Zeile', '~~~~',
    'Dritte Zeile', tick.repeat(5), '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  for (const line of [1, 3, 5]) hasScope(rows, line, 'Zeile', 'markup.fenced_code.block');
  assertCourseTail(rows, 7);
});

test('macro arguments and annotated fence examples remain opaque inside ordinary inline and fenced code', () => {
  const tick = '\u0060';
  const triple = tick.repeat(3);
  const rows = tokenize([
    tick + '@llmquiz(x)' + tick, '',
    tick.repeat(4) + 'markdown',
    triple + 'text @LLMQuiz(0.6,' + tick + 'Frage' + tick + ')',
    '@Echo(' + triple + 'Text' + triple + ')',
    triple, tick.repeat(4), '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  noLiaSyntax(rows, 0, '@llmquiz');
  noLiaSyntax(rows, 3, '@LLMQuiz');
  noLiaSyntax(rows, 4, '@Echo');
  assertCourseTail(rows, 7);
});

test('the LLMQuiz example recovers every following heading and the final native JavaScript block', () => {
  const rows = tokenize(fs.readFileSync(path.join(root, 'examples/llmquiz.lia.md'), 'utf8'));
  for (let line = 0; line < rows.length; line++) {
    if (/^#{1,6} /u.test(rows[line].line)) {
      hasScope(rows, line, rows[line].line.replace(/^#+ /u, ''), 'heading');
      assert.ok(!scopesAt(rows, line, '#').some(scope => /^(markup\.fenced_code|meta\.macro-call|string\.quoted\.backtick)/u.test(scope)));
    }
  }
  const argumentLine = rows.findIndex(row => row.line.includes('Dieser Text gehört zum Makroargument.'));
  hasScope(rows, argumentLine, 'Dieser Text', 'string.quoted.backtick.macro-argument');
  const scriptLine = rows.findIndex(row => row.line.includes('const result'));
  hasScope(rows, scriptLine, 'const', 'storage.type.js');
});

test('padded inline formulas from the LiaScript docs and real weekly exercises retain math highlighting', () => {
  const rows = tokenize([
    'Inline: $ \\frac{a}{\\sum{b+i}} $ und $x$.',
    '__$a)\\;\\;$__ $  4x - 3 = \\dfrac{1}{2}x + 9 $ \\',
    'Eine Preisangabe: 5 \\$; ein einzelnes $ beendet diese Zeile.',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows, 0, 'frac', 'markup.math.inline');
  hasScope(rows, 1, '4x', 'markup.math.inline');
  assert.ok(!scopesAt(rows, 2, 'Preisangabe').some(scope => scope.startsWith('meta.math')));
  assertCourseTail(rows, 3);
});

test('SVG foreignObject formulas and quizzes retain LiaScript scopes without coloring HTML attributes as macros', () => {
  const rows = tokenize([
    '<svg viewBox="0 0 480 320">',
    '  <foreignObject x="76" y="122" width="90" height="40">',
    '    $P(A) = $ [[  3/10  ]]',
    '  </foreignObject>',
    '  <foreignObject data-value="@attribute" x="132" y="265" width="60" height="50">',
    '    $P(\\bar{B} \\cap A) \\\\ = $ [[  1/10  ]]',
    '  </foreignObject>',
    '</svg>', '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows, 2, 'P(A)', 'markup.math.inline');
  hasScope(rows, 2, '[[', 'punctuation.definition.quiz.begin');
  hasScope(rows, 5, 'bar', 'markup.math.inline');
  hasScope(rows, 5, '[[', 'punctuation.definition.quiz.begin');
  assert.ok(!scopesAt(rows, 4, '@attribute').some(scope => scope.startsWith('entity.name.function.macro')));
  assertCourseTail(rows, 9);
});

test('literal underscore placeholders from FreezeREADME cannot open Markdown emphasis beyond the quiz', () => {
  const rows = tokenize([
    '[[___]]', '', '@resetter', '',
    '[[___ ___ ___ ___]]', '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows, 0, '___', 'constant.language.placeholder');
  hasScope(rows, 4, '___', 'constant.language.placeholder');
  hasScope(rows, 2, 'resetter', 'entity.name.function.macro');
  assertCourseTail(rows, 6);

  const selection = tokenize('[[ ( **Richtig** )\n| _Falsch_ ]]\n\n# Danach\n[[Antwort]]\n@visible');
  hasScope(selection, 0, 'Richtig', 'markup.bold');
  hasScope(selection, 1, 'Falsch', 'markup.italic');
  assertCourseTail(selection, 3);
});

test('a centered annotated TikZ fence remains code across internal blank lines and ends at its closer', () => {
  const triple = '\u0060'.repeat(3);
  const rows = tokenize([
    '<center>', triple + 'latex  @tikz ',
    '\\begin{tikzpicture}[scale=2]', '', '',
    '  \\draw (0,0) -- (1,1);', '\\end{tikzpicture}',
    triple, '</center>', '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows, 5, 'draw', 'meta.embedded.block.latex');
  assertCourseTail(rows, 10);
});

test('single-line images and line-break elements do not hide the next LiaScript heading', () => {
  for (const html of [
    '<img src="a.svg" width="40%"> <img src="b.svg" width="40%"> \\',
    '<br>', '<hr class="separator">'
  ]) {
    const rows = tokenize([html, '# Danach', '[[Antwort]]', '@visible'].join('\n'));
    hasScope(rows, 0, html.includes('img') ? 'img' : html.includes('<br') ? 'br' : 'hr', 'entity.name.tag.html');
    assertCourseTail(rows, 1);
  }
});

test('bounded HTML layout tags leave script strings, style strings, inline code and autolinks unchanged', () => {
  const rows = tokenize([
    '<script>', 'const html = "<center><img src=\'x\'></center>";', '</script>', '',
    '<style>', '.note::after { content: "<br>"; }', '</style>', '',
    '\u0060<img src="example.svg">\u0060', '', '<https://example.org>', '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows, 1, '<center>', 'string.quoted.double.js');
  hasScope(rows, 5, '<br>', 'string.quoted.double.css');
  hasScope(rows, 8, '<img', 'markup.inline.raw');
  hasScope(rows, 10, 'https://', 'markup.underline.link');
  assertCourseTail(rows, 12);
});

test('indented playback markers keep their spoken Markdown and inline formulas outside code scopes', () => {
  for (const marker of ['{{|>}}', '{{!> Australian Female}}', '{{3 |>}}']) {
    const rows = tokenize([
      '    ' + marker + ' Die *Addition* verwendet $+$, die Gleichheit $=$.',
      '', '# Danach', '[[Antwort]]', '@visible'
    ].join('\n'));
    hasScope(rows, 0, marker.includes('!>') ? '!>' : '|>', 'keyword.control.playback');
    hasScope(rows, 0, 'Addition', 'markup.italic');
    hasScope(rows, 0, '+$', 'markup.math.inline');
    hasScope(rows, 0, '=$', 'markup.math.inline');
    assert.ok(!scopesAt(rows, 0, 'Addition').some(scope => scope.startsWith('markup.raw')));
    assertCourseTail(rows, 2);
  }
});

test('matrix quiz headers preserve formulas in every bracketed column and mixed header delimiters', () => {
  const rows = tokenize([
    '- [[$2$] [$3$] [$4$] [$5$] [$9$]]',
    '- [ [X] [X] [X] [X] [X] ] sind Teiler von $540$',
    '',
    '    [[male (der)] (female [die]) [neuter (das)]]',
    '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  for (const digit of ['2', '3', '4', '5', '9']) hasScope(rows, 0, digit, 'markup.math.inline');
  hasScope(rows, 0, '[[$', 'meta.quiz.matrix');
  hasScope(rows, 3, 'female', 'meta.quiz.matrix.column');
  assertCourseTail(rows, 5);
});

test('absolute-value bars inside table formulas stay inside math instead of splitting into Markdown cells', () => {
  const rows = tokenize([
    '| Ausdruck | Wert |',
    '| --- | --- |',
    '| $a$ | $ |a|-|c| $ |',
    '| $ |a-c| $ | $ |a|+|c| $ |',
    '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows, 2, '|a|', 'markup.math.inline');
  hasScope(rows, 2, '|c|', 'markup.math.inline');
  hasScope(rows, 3, '|a-c|', 'markup.math.inline');
  hasScope(rows, 3, '|a|', 'markup.math.inline');
  assertCourseTail(rows, 5);
});

test('indented whitespace before a standalone SVG formula does not start an ordinary Markdown code block', () => {
  const rows = tokenize([
    '<svg>',
    '  <!-- Pfad-Beschriftung -->',
    '  <foreignObject x="90" y="60" width="120" height="60"',
    '                 transform="rotate(-40 150 80)">',
    '                 ',
    '    $P(A) $ ',
    '  </foreignObject>',
    '</svg>', '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows, 5, 'P(A)', 'markup.math.inline');
  assert.ok(!scopesAt(rows, 5, 'P(A)').some(scope=>scope.startsWith('markup.raw')));
  assertCourseTail(rows, 9);
});

test('standalone indented math recognition keeps existing indented and fenced code states opaque', () => {
  const rows = tokenize([
    '    const sample = 1;',
    '    ',
    '    $x$',
    '',
    '    $value = $other',
    '',
    '\u0060\u0060\u0060text',
    '    ',
    '    $x$',
    '| $ |a|-|c| $ |',
    '\u0060\u0060\u0060', '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  for (const [line,text] of [[2,'$x$'],[4,'$value'],[8,'$x$'],[9,'|a|']]) {
    assert.ok(!scopesAt(rows,line,text).some(scope=>scope.startsWith('meta.math')));
    hasScope(rows,line,text,line<6?'markup.raw.block':'markup.fenced_code.block');
  }
  assertCourseTail(rows,12);
});

test('table formulas with absolute-value bars preserve following macros and quizzes in the same cell', () => {
  const rows = tokenize([
    '| Formel | Ergebnis |', '| --- | --- |',
    '| $ |a| $ @suffix [[Antwort]] | next |', '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows, 2, 'suffix', 'entity.name.function.macro');
  hasScope(rows, 2, '[[Antwort]]', 'punctuation.definition.quiz.begin');
  hasScope(rows, 2, '|a|', 'markup.math.inline');
  assertCourseTail(rows, 4);
});

test('absolute-value table cells retain nested bold, italic, links and quizzes after the formula', () => {
  const rows = tokenize([
    '| Formel | Ergebnis |', '| --- | --- |',
    '| $ |a| $ **@bold(ok)** *@italic(ok)* [Link](https://example.org) **[[Antwort]]** | next |',
    '| $ |b| $ **Weitere Formel $c$** | $ |d| $ @again(ok) |',
    '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  for (const name of ['bold','italic']) hasScope(rows,2,name,'entity.name.function.macro');
  hasScope(rows,2,'bold','markup.bold');
  hasScope(rows,2,'italic','markup.italic');
  hasScope(rows,2,'https://','markup.underline.link');
  hasScope(rows,2,'[[Antwort]]','punctuation.definition.quiz.begin');
  hasScope(rows,3,'c$','markup.math.inline');
  hasScope(rows,3,'again','entity.name.function.macro');
  assertCourseTail(rows,5);
});

test('absolute-value formulas without whitespace after a table delimiter keep math and following LiaScript syntax', () => {
  const rows = tokenize([
    '| Formel | Ergebnis |', '| --- | --- |',
    '|$|a|$ @suffix(ok) [[Antwort]]|next|',
    '',
    '# Danach', '[[Antwort]]', '@visible'
  ].join('\n'));
  hasScope(rows,2,'|a|','markup.math.inline');
  hasScope(rows,2,'suffix','entity.name.function.macro');
  hasScope(rows,2,'[[Antwort]]','punctuation.definition.quiz.begin');
  assertCourseTail(rows,4);
});
