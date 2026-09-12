const test = require('node:test');
const assert = require('node:assert/strict');
const { lint, RULES, isLiaScriptDocument } = require('../dist/core/index.js');
const codes = text => lint(text).map(issue => issue.code);
const tick = '`';
const fence = tick.repeat(3);

function applyFix(text, issue) {
  assert.ok(issue.fix, 'expected a code action');
  for (const edit of [...issue.fix.edits].sort((a, b) => b.start - a.start)) {
    text = text.slice(0, edit.start) + edit.newText + text.slice(edit.end);
  }
  return text;
}

test('all six rules have unique IDs and valid default severities', () => {
  assert.deepEqual(RULES.map(rule => rule.code), ['LS001', 'LS002', 'LS003', 'LS004', 'LS005', 'LS006']);
  assert.equal(new Set(RULES.map(rule => rule.code)).size, RULES.length);
  assert.ok(RULES.every(rule => ['error', 'warning', 'information'].includes(rule.defaultSeverity)));
});

test('optional metadata are not required and ordinary Markdown stays quiet', () => {
  for (const text of ['', '# Hallo\n\nNormaler Text.', '<!-- -->\n# Kurs', '# Titel\n\n- [ ] Aufgabe\n- [x] Erledigt', 'Eine E-Mail an person@example.org']) {
    assert.deepEqual(lint(text), [], text);
  }
});

test('native LiaScript features and local metadata are valid together', () => {
  const text = `<!--
language: de
import: https://example.org/first.md
import: https://example.org/second.md
script: https://example.org/one.js
script: https://example.org/two.js
@Single.line: Mehrzeilig
  @macroCall

  Weiterer Text.
@block
<div>
<!-- class="box" -->
@OtherMacro
[( )] Generated answer
<script>const marker = "<!--";</script>
</div>
@end
@style
@keyframes zoomIn {
  from { opacity: 0; }
}
@end
@@disabled: text
@@@notes
A disabled block with arbitrary content
@end
-->
# Kurs

{{1}}

    [(X)] Antwort eins
    [( )] Ablenkung
    [(x)] Antwort zwei

[[ ]] Nichts ausgewählt
[[ ]] Das ist bei Multiple Choice erlaubt

[[ Lösung ]]
[[?]] Hinweis

## Lokal
<!--
narrator: Deutsch Female
@local: Hallo
-->

@local
`;
  assert.deepEqual(lint(text), []);
  assert.equal(isLiaScriptDocument(text), true);
});

test('LS001 points at the unclosed comment opener, including local headers', () => {
  for (const text of ['<!--\nlanguage: de', '# Kurs\n\n## Lokal\n<!--\nlanguage: de', 'Text\n<!-- hidden']) {
    const [issue] = lint(text);
    assert.equal(issue.code, 'LS001');
    assert.equal(text.slice(issue.start, issue.end), '<!--');
  }
});

test('LS002 identifies the macro and provides a repair before the header closes', () => {
  const text = '<!--\n@quiz\n[[ @0 ]]\n-->\n# Kurs';
  const [issue] = lint(text);
  assert.equal(issue.code, 'LS002');
  assert.equal(text.slice(issue.start, issue.end), '@quiz');
  assert.deepEqual(lint(applyFix(text, issue)), []);
});

test('missing header and macro terminators are both reported at their openings', () => {
  assert.deepEqual(codes('<!--\n@block\nInhalt'), ['LS001', 'LS002']);
});

test('LS003 removes only the stray terminator inside a header', () => {
  const text = '<!--\nlanguage: de\n@end\n-->\n# Titel';
  const [issue] = lint(text);
  assert.equal(issue.code, 'LS003');
  assert.deepEqual(lint(applyFix(text, issue)), []);
  assert.ok(applyFix(text, issue).includes('language: de'));
});

test('macro invocations in prose and non-header comments are not definitions', () => {
  assert.deepEqual(lint('# Kurs\n\nText.\n@Macro\n@end\n\n<!--\n@notes\n@end\n-->'), []);
});

test('local block macros are checked and distinct from global definitions', () => {
  assert.deepEqual(codes('<!--\n@global\n@end\n-->\n# Kurs\n\n## Abschnitt\n<!--\n@local\n-->'), ['LS002']);
});

test('single-line macro continuation preserves embedded @calls even across blanks', () => {
  assert.deepEqual(lint('<!--\n@one: first\n  @call\n\n  @second\n@two: rest\n-->'), []);
});

test('disabled @@@ blocks still require a terminator; @@ line comments do not', () => {
  assert.deepEqual(codes('<!--\n@@@notes\ntext\n-->'), ['LS002']);
  assert.deepEqual(lint('<!--\n@@notes: text\n@@ free comment\n-->'), []);
});

test('triple-dash comments ignore definitions and quiz examples', () => {
  assert.deepEqual(lint('<!---\n@notAMacro\n[( )] One\n[( )] Two\n--->'), []);
  assert.equal(isLiaScriptDocument('<!---\nlanguage: de\n@notAMacro\n--->'), false);
});

test('macro bodies preserve nested comments and do not lint generated fragments', () => {
  const text = '<!--\n@box\n<!-- class="box" -->\n<script>\n[( )] one\n[( )] two\n@end\n-->\n# Kurs';
  assert.deepEqual(lint(text), []);
});

test('LS004 reports an unfinished backtick fence as an authoring warning', () => {
  const text = `# Kurs\n\n${fence}js\nconst answer = 42;`;
  const [issue] = lint(text);
  assert.equal(issue.code, 'LS004');
  assert.equal(issue.severity, 'warning');
  assert.equal(text.slice(issue.start, issue.end), fence);
});

test('longer outer fences protect shorter example fences and embedded broken syntax', () => {
  const outer = tick.repeat(4);
  const text = `${outer}markdown\n${fence}js\n<!--\n@block\n<script>\n${fence}\n${outer}\n# Ende`;
  assert.deepEqual(lint(text), []);
  assert.equal(isLiaScriptDocument(text), false);
});

test('fence closers must match the marker and be at least as long', () => {
  assert.deepEqual(codes(`${tick.repeat(4)}md\n${fence}`), ['LS004']);
  assert.deepEqual(codes(`${fence}md\n~~~`), ['LS004']);
  assert.deepEqual(lint(`${fence}md\ntext\n${tick.repeat(5)}`), []);
});

test('quoted and list-nested fenced examples stay opaque', () => {
  const text = `> ${fence}md\n> <!--\n> <script>\n> [( )] A\n> [( )] B\n> ${fence}\n\n- ${fence}md\n  @example\n  ${fence}`;
  assert.deepEqual(lint(text), []);
  assert.equal(isLiaScriptDocument(text), false);
});

test('standard Markdown tilde examples are conservatively shielded', () => {
  assert.deepEqual(lint('~~~md\n<!--\n<script>\n~~~'), []);
});

test('multiline macro arguments with backticks are opaque', () => {
  const text = `# Kurs\n\n@highlight_green(${fence}\n<!--\n<script>\n[( )] one\n[( )] two\n${fence})`;
  assert.deepEqual(lint(text), []);
});

test('inline code supports variable backticks and multiline spans', () => {
  const text = `Text ${tick}${'<script>'}${tick}.\n${tick.repeat(2)}<!-- ${tick} @block\n<script>${tick.repeat(2)}\n\n${tick}[(X)] example${tick}`;
  assert.deepEqual(lint(text), []);
  assert.equal(isLiaScriptDocument(text), false);
});

test('escaped markers stay literal', () => {
  assert.deepEqual(lint('\\<!--\n\\<script>\n\\`code\n\\[( )] eins\n\\[( )] zwei'), []);
  assert.equal(isLiaScriptDocument('\\[(X)] example'), false);
});

test('LS005 finds a missing script closer and shields embedded source syntax', () => {
  const text = '# Kurs\n<script output="result">\nconst s = "<!--";\n[( )] A\n[( )] B';
  const [issue] = lint(text);
  assert.equal(issue.code, 'LS005');
  assert.equal(text.slice(issue.start, issue.end), '<script output="result">');
});

test('script content, HTML code elements, and quoted tag attributes are opaque', () => {
  const text = `<SCRIPT data-label=">">const source = ${tick}<!--\n@foo\n[( )] A\n[( )] B${tick};</SCRIPT>\n<pre><code><!--\n<script>\n</code></pre>\n<style>/* <!-- */</style>\n<textarea><!--</textarea>`;
  assert.deepEqual(lint(text), []);
  assert.equal(isLiaScriptDocument(text), false);
});

test('LS006 reports two static unmarked single-choice rows', () => {
  for (const prefix of ['', '    ', '- ', '> ', '> - ']) {
    const text = `# Kurs\n\n${prefix}[( )] Eins\n${prefix}[( )] Zwei`;
    assert.deepEqual(codes(text), ['LS006'], prefix);
  }
});

test('single-choice accepts one or several uppercase/lowercase correct alternatives', () => {
  assert.deepEqual(lint('[(X)] Eins\n[( )] Zwei\n[(x)] Drei'), []);
  assert.deepEqual(lint('[( )] Eins\n[(x)] Zwei'), []);
});

test('no-answer warning excludes multiple-choice, matrix, selection, survey and text syntax', () => {
  for (const text of [
    '[[ ]] Eins\n[[ ]] Zwei',
    '- [[male] [female]]\n- [ [ ] [ ] ] Person\n- [ ( ) ( ) ] Person',
    '[[ first |\n(second) |\n(third) ]]',
    '[(1)] One\n[(2)] Two',
    '[[ Antwort ]]\n[[?]] Hinweis',
    '[( )] Only one static row',
    '[( )] Ein Quiz\n\n[( )] Anderes Quiz',
  ]) assert.deepEqual(lint(text), [], text);
});

test('dynamic sections suppress static quiz assumptions without executing code', () => {
  for (const dynamic of ['<script>throw new Error("MUST NOT RUN")</script>', '@CustomValidator', 'Text mit @answer']) {
    assert.deepEqual(lint(`[( )] A\n[( )] B\n\n${dynamic}`), []);
  }
  assert.deepEqual(codes('[( )] A\n[( )] B\n\n## Andere Seite\n<script>true</script>'), ['LS006']);
});

test('settings disable rules and change severity without changing ranges', () => {
  const text = '<!--\n@block\n-->';
  assert.deepEqual(lint(text, { rules: { LS002: 'off' } }), []);
  assert.equal(lint(text, { rules: { LS002: 'information' } })[0].severity, 'information');
  assert.equal(lint('[( )] A\n[( )] B', { rules: { LS006: 'error' } })[0].severity, 'error');
});

test('inline disable/enable and comma-separated IDs scope diagnostics', () => {
  const text = '<!-- liascript-lint-disable LS006, LS005 -->\n[( )] A\n[( )] B\n\n<!-- liascript-lint-enable LS006 -->\n[( )] C\n[( )] D';
  const issues = lint(text);
  assert.equal(issues.length, 1);
  assert.equal(text.slice(issues[0].start, issues[0].end), '[( )] C\n[( )] D');
});

test('disable-next-line only suppresses the immediate following diagnostic origin', () => {
  assert.deepEqual(lint('<!-- liascript-lint-disable-next-line LS006 -->\n[( )] A\n[( )] B'), []);
  assert.deepEqual(codes('<!-- liascript-lint-disable-next-line LS006 -->\n\n[( )] A\n[( )] B'), ['LS006']);
});

test('disable-all can be selectively re-enabled and directives in code are inert', () => {
  assert.deepEqual(lint('<!-- liascript-lint-disable -->\n<script>'), []);
  assert.deepEqual(codes('<!-- liascript-lint-disable -->\n<!-- liascript-lint-enable LS005 -->\n<script>'), ['LS005']);
  assert.deepEqual(codes(`${fence}md\n<!-- liascript-lint-disable -->\n${fence}\n<script>`), ['LS005']);
});

test('CRLF, BOM and astral Unicode use UTF-16 offsets and preserve repair newlines', () => {
  const text = '\uFEFF<!--\r\nlanguage: de\r\n@box\r\n😀 Größer\r\n-->\r\n# Ende';
  const [issue] = lint(text);
  assert.equal(issue.code, 'LS002');
  assert.equal(issue.start, text.indexOf('@box'));
  assert.equal(issue.end - issue.start, '@box'.length);
  assert.ok(issue.fix.edits[0].newText.endsWith('\r\n'));
  assert.deepEqual(lint(applyFix(text, issue)), []);
  const source = '😀\r\n<script>';
  assert.equal(lint(source)[0].start, 4);
});

test('all reported ranges and edits remain inside their document', () => {
  const samples = ['<!--', '<!--\n@a', '<!--\n@end\n-->', `${fence}js`, '<script>', '[( )] A\r\n[( )] B'];
  for (const text of samples) for (const issue of lint(text)) {
    assert.ok(issue.start >= 0 && issue.end > issue.start && issue.end <= text.length);
    for (const edit of issue.fix?.edits ?? []) assert.ok(edit.start >= 0 && edit.start <= edit.end && edit.end <= text.length);
  }
});

test('automatic Markdown detection uses live LiaScript evidence', () => {
  for (const text of ['<!-- language: de -->\n# Kurs', '# Kurs\n<!--\n@foo: test\n-->', '# Kurs\n\n[(X)] Ja\n[( )] Nein', '[[!]]', '{{2}}', '<!-- liascript -->']) {
    assert.equal(isLiaScriptDocument(text), true, text);
  }
  for (const text of ['# README\n\nPlain Markdown.', '[[Wiki page]]', `${fence}md\n<!-- language: de -->\n[(X)] Yes\n${fence}`, '<!-- arbitrary text -->', '<!-- author: Someone -->']) {
    assert.equal(isLiaScriptDocument(text), false, text);
  }
});
test('same-line macro backtick arguments close inline without hiding following source', () => {
  const text = `@foo(${fence}hello${fence})\n\n## Weiter\n[( )] A\n[( )] B`;
  assert.deepEqual(codes(text), ['LS006']);
  assert.deepEqual(lint(`@foo(${fence}<script><!--${fence})`), []);
});

test('generic HTML attributes shield comment/script literals but preserve element bodies', () => {
  const text = '<div data-example="<!-- <script>" title=\'a > b\'>\n[( )] A\n[( )] B\n</div>';
  assert.deepEqual(codes(text), ['LS006']);
  assert.deepEqual(lint('<a\n title="<!-- <script>">Link</a>\n\n<script>true</script>'), []);
  assert.equal(isLiaScriptDocument('<div title="[(X)] example">Text</div>'), false);
});
test('macro quick fixes put @end on its own line when the header closes after content', () => {
  for (const text of ['<!--\n@box\nText -->', '<!--\n@box -->']) {
    const [issue] = lint(text);
    assert.equal(issue.code, 'LS002');
    assert.deepEqual(lint(applyFix(text, issue)), []);
  }
});
test('LLMQuiz code fences allow single/triple quoted macro arguments in the info string', () => {
  for (const quote of [tick, fence]) {
    const source = `${fence}text @LLMQuiz(0.55;coverage=0.55,${quote}Aufgabenwortlaut (mit Klammern und ))${quote})\n<!--\n<script>\n[( )] Modellantwort\n[( )] Weiterer Text\n${fence}\n\n## Danach\n[( )] A\n[( )] B`;
    const issues = lint(source);
    assert.deepEqual(issues.map(issue => issue.code), ['LS006']);
    assert.equal(source.slice(issues[0].start, issues[0].end), '[( )] A\n[( )] B');
  }
});

test('annotated code fences still report a genuinely missing code-block closer at the opener', () => {
  const source = `${fence}text @LLMQuiz(0.55,${tick}Aufgabe (mit Klammern)${tick})\nMusterantwort`;
  const [issue] = lint(source);
  assert.equal(issue.code, 'LS004');
  assert.equal(issue.start, 0);
});

test('macro argument quotes can open and close on separate lines from the call parentheses', () => {
  for (const before of ['', '\n', '\r\n']) for (const after of ['', '\n', '\r\n']) {
    const source = `@llmquiz(${before}${fence}\nText mit ) und (( sowie <!-- und <script>\n${fence}${after})\n\n## Danach\n[( )] A\n[( )] B`;
    assert.deepEqual(codes(source), ['LS006'], JSON.stringify({before, after}));
  }
});

test('multiple multiline quoted arguments and nested macro calls resume at the actual call end', () => {
  const source = `@llmquiz(\n${fence}\nErstes Argument mit )\n${fence},\n@other(${tick}unmatched (( literal${tick}),\n${fence}\nZweites Argument mit (((\n${fence}\n)<script>\nconst x = true;`;
  const issues = lint(source);
  assert.deepEqual(issues.map(issue => issue.code), ['LS005']);
  assert.equal(source.slice(issues[0].start, issues[0].end), '<script>');
});

test('quoted macro arguments are not Markdown fences even when unfinished', () => {
  assert.deepEqual(lint(`@llmquiz(\n${fence}\nText mit <script>`), []);
  const source = `@llmquiz(${fence}quoted${fence}\n\n## Danach\n<script>`;
  assert.deepEqual(codes(source), ['LS005']);
});

test('ordinary Markdown inline triple backticks retain their inline interpretation', () => {
  assert.deepEqual(lint(`${fence}inline example${fence}\n\n<script>true</script>`), []);
});
test('a stray typographic backtick cannot hide static quizzes in later paragraphs', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    const source = [
      `Die Frage lautet: "${tick}Welche Zahl?"'.`, '', '## Aufgabe',
      '[( )] A', '[( )] B', '', '## Zeichnung',
      `@Flaeche(${tick}[[0;0];[1;1]]${tick})`,
    ].join(newline);
    const issues = lint(source);
    assert.deepEqual(issues.map(issue=>issue.code), ['LS006']);
    assert.equal(source.slice(issues[0].start,issues[0].end), `[( )] A${newline}[( )] B`);
  }
});

test('ordinary inline code spans a single line break but not a blank line', () => {
  for (const newline of ['\n', '\r\n', '\r']) {
    assert.deepEqual(lint(`Text ${tick}code${newline}<script>${tick}`), []);
    const source = `Text ${tick}unmatched${newline} \t${newline}<script>${tick}later`;
    assert.deepEqual(codes(source), ['LS005']);
  }
  assert.deepEqual(codes(`Text ${tick}ohne Abschluss <script>`), ['LS005']);
});