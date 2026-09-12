'use strict';
// Whole-corpus tokenization audit. Reads course text; never evaluates course code.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { performance } = require('node:perf_hooks');
const textmate = require('vscode-textmate');
const oniguruma = require('vscode-oniguruma');
const root = path.resolve(__dirname, '..');
const scopeName = 'text.html.markdown.liascript';
const tick = String.fromCharCode(96);
function options(argv) {
  const result = {};
  for (let i = 0; i < argv.length; i++) {
    if (!['--corpus', '--vscode-extensions', '--output', '--grammar-root'].includes(argv[i]) || !argv[i + 1]) throw new Error('Expected --corpus PATH --vscode-extensions PATH --output FILE [--grammar-root PATH]');
    result[argv[i].slice(2)] = path.resolve(argv[++i]);
  }
  for (const key of ['corpus', 'vscode-extensions', 'output']) if (!result[key]) throw new Error('Missing --' + key);
  return result;
}
function sha(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function markdownFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || entry.name === '.git') continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...markdownFiles(file));
    else if (/\.md$/i.test(entry.name)) result.push(file);
  }
  return result.sort();
}
function quoteEnd(text, start, length, limit = text.length) {
  const delimiter = tick.repeat(length);
  for (let cursor = start + length; (cursor = text.indexOf(delimiter, cursor)) >= 0 && cursor + length <= limit; cursor += length) {
    if (text[cursor - 1] !== tick && text[cursor + length] !== tick) return cursor + length;
  }
  return -1;
}
function inlineQuoteEnd(text, start, length) {
  // Inline code belongs to one paragraph. A stray typographic backtick must not
  // pair with the opening delimiter of a macro argument many paragraphs later.
  const blankLine = /\n[ \t]*\n/.exec(text.slice(start + length));
  const limit = blankLine ? start + length + blankLine.index : text.length;
  return quoteEnd(text, start, length, limit);
}
function macroEnd(text, cursor) {
  let depth = 1;
  while (cursor < text.length) {
    if (text[cursor] === '\\') { cursor += 2; continue; }
    if (text[cursor] === tick) {
      let end = cursor;
      while (text[end] === tick) end++;
      cursor = quoteEnd(text, cursor, end - cursor);
      if (cursor === -1) return text.length;
      continue;
    }
    if (text[cursor] === '(') depth++;
    if (text[cursor] === ')' && --depth === 0) return cursor + 1;
    cursor++;
  }
  return cursor;
}
function commentEnd(text, start) {
  let depth = 1;
  const delimiters = /<!--|-->/g;
  delimiters.lastIndex = start + 4;
  let match;
  while ((match = delimiters.exec(text))) {
    if (match[0] === '<!--') depth++;
    else if (--depth === 0) return delimiters.lastIndex;
  }
  return text.length;
}
// Independent, deliberately conservative lexical guard for obvious authored
// headings/quiz/macros. These are audit candidates, not a LiaScript parser.
function checkpoints(text, lines) {
  const candidates = new Map();
  function add(index, value) {
    const values = candidates.get(index) || [];
    if (!values.some(item => item.kind === value.kind && item.column === value.column)) values.push(value);
    candidates.set(index, values);
  }
  let start = 0;
  let opaqueUntil = 0;
  let fence;
  const ignored = { fence: 0, quotedOrComment: 0 };
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const end = start + line.length;
    const prefix = /^(?:[ \t]*>[ \t]?)*(?:[ \t]*(?:[-+*]|\d+[.)])[ \t]+)?/.exec(line)[0].length;
    const body = line.slice(prefix);
    if (fence) {
      const value = body.trim();
      const run = /^([~\x60]+)[ \t]*$/.exec(value);
      if (run && run[1].length >= fence.length && [...run[1]].every(char => char === fence.char)) fence = undefined;
      ignored.fence++;
      start = end + 1;
      continue;
    }
    if (opaqueUntil > start) ignored.quotedOrComment++;
    if (opaqueUntil <= start) {
      const open = /^[ \t]*([\x60]{3,}|~{3,})(.*)$/.exec(body);
      if (open && (!open[2].includes(tick) || /@[\w.-]+\(/.test(open[2]))) {
        fence = { char: open[1][0], length: open[1].length };
        start = end + 1;
        continue;
      }
      const heading = /^[ \t]{0,3}#{1,6}[ \t]+(\S)/.exec(body);
      const choice = /^[ \t]*\[(?:\([ Xx]\)|\[[ Xx?!]\])\]/.exec(body);
      const quiz = /^[ \t]*\[\[(?!\[)\S/.exec(body);
      const macro = /^[ \t]*(@[\w][\w.-]*)/.exec(body);
      if (heading) add(index, { kind: 'heading', column: prefix + heading[0].length - 1 });
      else if (choice || quiz) add(index, { kind: 'quiz', column: line.indexOf('[', prefix) });
      else if (macro) add(index, { kind: macro[1] === '@end' ? 'macro-end' : 'macro', column: line.indexOf('@', prefix) + 1 });
    }
    let cursor = Math.max(start, opaqueUntil);
    while (cursor < end) {
      if (text[cursor] === '\\') { cursor += 2; continue; }
      if (text.startsWith('<!--', cursor)) { cursor = commentEnd(text, cursor); opaqueUntil = cursor; continue; }
      const raw = /^<(script|style|pre|code|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(text.slice(cursor));
      if (raw) {
        const close = new RegExp('</' + raw[1] + '\\s*>', 'ig');
        close.lastIndex = cursor + raw[0].length;
        const found = close.exec(text);
        cursor = found ? close.lastIndex : text.length;
        opaqueUntil = cursor;
        continue;
      }
      const html = /^<\/?[a-z][a-z0-9:-]*(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/i.exec(text.slice(cursor));
      if (html) { cursor += html[0].length; opaqueUntil = cursor; continue; }
      if (text[cursor] === '$') {
        const delimiter = text.startsWith('$$', cursor) ? '$$' : '$';
        let close = text.indexOf(delimiter, cursor + delimiter.length);
        while (close >= 0 && text[close - 1] === '\\') close = text.indexOf(delimiter, close + delimiter.length);
        if (close >= 0 && (delimiter === '$$' || close < end)) {
          add(index, { kind: 'math', column: cursor - start });
          cursor = close + delimiter.length;
          opaqueUntil = cursor;
          continue;
        }
      }
      if (text.startsWith('[[', cursor) || /^\[\([ Xx]\)\]/.test(text.slice(cursor))) {
        add(index, { kind: 'quiz', column: cursor - start });
      }
      if (/^(?:--)?\{\{[0-9]+(?:-[0-9]+)?\}\}(?:--)?/.test(text.slice(cursor))) {
        add(index, { kind: 'animation', column: cursor - start });
      }
      if (text[cursor] === tick) {
        let endQuote = cursor;
        while (text[endQuote] === tick) endQuote++;
        const close = inlineQuoteEnd(text, cursor, endQuote - cursor);
        if (close === -1) { cursor = endQuote; continue; }
        cursor = close;
        opaqueUntil = cursor;
        continue;
      }
      if (text[cursor] === '@' && !/[\w@\\]/.test(text[cursor - 1] || '')) {
        const name = /^@([\w][\w.-]*)/.exec(text.slice(cursor));
        if (name) add(index, { kind: name[1] === 'end' ? 'macro-end' : 'macro', column: cursor - start + 1 });
        const call = /^@[\w][\w.-]*[ \t]*\(/.exec(text.slice(cursor));
        if (call) { cursor = macroEnd(text, cursor + call[0].length); opaqueUntil = cursor; continue; }
      }
      cursor++;
    }
    start = end + 1;
  }
  return { candidates, ignored };
}
function matches(kind, scopes) {
  if (kind === 'math') return scopes.some(scope => scope.startsWith('meta.math.liascript'));
  if (kind === 'animation') return scopes.some(scope => /animation/.test(scope) && scope.endsWith('.liascript'));
  if (kind === 'heading') return scopes.some(scope => /(?:^|\.)heading(?:\.|$)/.test(scope));
  if (kind === 'quiz') return scopes.some(scope => /(?:quiz|choice)\./.test(scope) && scope.endsWith('.liascript'));
  if (kind === 'macro-end') return scopes.includes('keyword.control.end.liascript');
  return scopes.some(scope => /^(entity.name.function|variable.parameter)\./.test(scope) && scope.endsWith('.liascript'));
}
function scopesAt(tokens, column) {
  return tokens.find(token => token.startIndex <= column && token.endIndex > column)?.scopes || [];
}
function activeScopes(stack) {
  return stack.contentNameScopesList?.getScopeNames?.() || [];
}
async function main() {
  const args = options(process.argv.slice(2));
  const grammarRoot = args['grammar-root'] || root;
  const grammarPaths = {};
  for (const entry of fs.readdirSync(args['vscode-extensions'])) {
    const manifest = path.join(args['vscode-extensions'], entry, 'package.json');
    if (!fs.existsSync(manifest)) continue;
    for (const grammar of JSON.parse(fs.readFileSync(manifest, 'utf8')).contributes?.grammars || []) {
      if (grammar.path) grammarPaths[grammar.scopeName] = path.resolve(path.dirname(manifest), grammar.path);
    }
  }
  grammarPaths[scopeName] = path.join(grammarRoot, 'syntaxes/liascript.tmLanguage.json');
  grammarPaths['liascript.injection'] = path.join(grammarRoot, 'syntaxes/liascript.injection.tmLanguage.json');
  const missingGrammars = new Set();
  const wasm = fs.readFileSync(require.resolve('vscode-oniguruma/release/onig.wasm'));
  await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const registry = new textmate.Registry({
    onigLib: Promise.resolve({
      createOnigScanner: sources => new oniguruma.OnigScanner(sources),
      createOnigString: text => new oniguruma.OnigString(text),
    }),
    loadGrammar: async scope => {
      if (!grammarPaths[scope]) { missingGrammars.add(scope); return null; }
      return textmate.parseRawGrammar(fs.readFileSync(grammarPaths[scope], 'utf8'), grammarPaths[scope]);
    },
    getInjections: scope => scope === scopeName ? ['liascript.injection'] : [],
  });
  const grammar = await registry.loadGrammar(scopeName);
  const names = ['ghrepo-mint-the-gap-aufgabensammlung-5f878df9ed', 'ghrepo-mint-the-gap-wochenaufgabe-66366d21e5'];
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    workingPackageVersion: require('../package.json').version,
    grammarRoot,
    grammarSha256: sha(fs.readFileSync(grammarPaths[scopeName])),
    injectionSha256: sha(fs.readFileSync(grammarPaths['liascript.injection'])),
    method: 'All files/all lines tokenized using vscode-textmate and installed VS Code grammars; independent guarded heading/inline-quiz/macro/math/animation checkpoints, end-of-document continuation probes, tokenizer early-stop checks. Findings require manual classification.',
    sources: [], files: [], errors: [], summary: {},
  };
  const started = performance.now();
  for (const name of names) {
    const sourceDir = path.join(args.corpus, 'sources', name);
    const metadata = JSON.parse(fs.readFileSync(path.join(sourceDir, 'source.json'), 'utf8'));
    const filesRoot = path.join(sourceDir, 'files');
    const paths = markdownFiles(filesRoot);
    report.sources.push({ sourceId: metadata.source_id, repo: metadata.repo, revision: metadata.revision_sha, files: paths.length });
    let processed = 0;
    for (const absolute of paths) {
      const relative = path.relative(filesRoot, absolute).split(path.sep).join('/');
      const file = { sourceId: metadata.source_id, path: relative, sha256: '', lines: 0, tokens: 0, checkpoints: 0, missing: [], eofFailures: [], earlyStops: [], elapsedMs: 0 };
      const fileStarted = performance.now();
      try {
        const buffer = fs.readFileSync(absolute);
        file.sha256 = sha(buffer);
        const source = buffer.toString('utf8').replace(/\r\n|\r/g, '\n').replace(/^\uFEFF/, '');
        const lines = source.split('\n');
        file.lines = lines.length;
        const guard = checkpoints(source, lines);
        file.checkpoints = [...guard.candidates.values()].reduce((sum, items) => sum + items.length, 0);
        file.guardIgnoredLines = guard.ignored;
        let stack = textmate.INITIAL;
        let previousScopes = [];
        let origins = [];
        for (let index = 0; index < lines.length; index++) {
          const result = grammar.tokenizeLine(lines[index], stack, 200);
          stack = result.ruleStack;
          file.tokens += result.tokens.length;
          if (result.stoppedEarly) file.earlyStops.push(index + 1);
          const current = activeScopes(stack);
          let common = 0;
          while (common < current.length && current[common] === previousScopes[common]) common++;
          origins = origins.slice(0, common);
          for (let i = common; i < current.length; i++) origins.push(index + 1);
          previousScopes = current;
          for (const checkpoint of guard.candidates.get(index) || []) {
            const scopes = scopesAt(result.tokens, checkpoint.column);
            if (!matches(checkpoint.kind, scopes)) {
              file.missing.push({
                line: index + 1, kind: checkpoint.kind, column: checkpoint.column + 1,
                text: lines[index].slice(0, 240), scopes,
                openRegions: current.map((scope, i) => ({ scope, fromLine: origins[i] })).filter(item => /(?:fenced|raw|metadata|macro|quiz|bold|italic|math|comment|string|source\.|embedded)/.test(item.scope)),
              });
            }
          }
        }
        file.eofState = activeScopes(stack);
        const probeLines = ['', '', '# LiaScriptAuditEnd_7f42', '', '[(X)] LiaScriptAuditAnswer_7f42', '', '@LiaScriptAuditMacro_7f42(ok)', ''];
        const expectations = new Map([[2, { kind: 'heading', column: 2 }], [4, { kind: 'quiz', column: 0 }], [6, { kind: 'macro', column: 1 }]]);
        for (let index = 0; index < probeLines.length; index++) {
          const result = grammar.tokenizeLine(probeLines[index], stack, 200);
          stack = result.ruleStack;
          const expected = expectations.get(index);
          if (result.stoppedEarly) file.earlyStops.push('probe:' + index);
          if (expected) {
            const scopes = scopesAt(result.tokens, expected.column);
            if (!matches(expected.kind, scopes)) file.eofFailures.push({ kind: expected.kind, scopes });
          }
        }
      } catch (error) {
        report.errors.push({ sourceId: metadata.source_id, path: relative, message: error.stack || String(error) });
      }
      file.elapsedMs = Math.round((performance.now() - fileStarted) * 100) / 100;
      report.files.push(file);
      processed++;
      if (processed % 100 === 0) console.log(metadata.repo + ': ' + processed + '/' + paths.length + ' files');
    }
    const finalMeta = JSON.parse(fs.readFileSync(path.join(sourceDir, 'source.json'), 'utf8'));
    if (finalMeta.revision_sha !== metadata.revision_sha) report.errors.push({ sourceId: metadata.source_id, message: 'Snapshot revision changed during audit.' });
  }
  report.grammarChangedDuringAudit = report.grammarSha256 !== sha(fs.readFileSync(grammarPaths[scopeName])) || report.injectionSha256 !== sha(fs.readFileSync(grammarPaths['liascript.injection']));
  report.missingGrammarScopes = [...missingGrammars].sort();
  report.summary = {
    files: report.files.length,
    lines: report.files.reduce((sum, file) => sum + file.lines, 0),
    tokens: report.files.reduce((sum, file) => sum + file.tokens, 0),
    checkpoints: report.files.reduce((sum, file) => sum + file.checkpoints, 0),
    filesWithMissingCheckpoints: report.files.filter(file => file.missing.length).length,
    missingCheckpoints: report.files.reduce((sum, file) => sum + file.missing.length, 0),
    filesWithEofFailures: report.files.filter(file => file.eofFailures.length).length,
    filesWithEarlyStops: report.files.filter(file => file.earlyStops.length).length,
    errors: report.errors.length,
    elapsedMs: Math.round(performance.now() - started),
  };
  fs.mkdirSync(path.dirname(args.output), { recursive: true });
  fs.writeFileSync(args.output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report.summary, null, 2));
  console.log('Report: ' + args.output);
  registry.dispose();
  if (report.errors.length || report.summary.filesWithEarlyStops || report.grammarChangedDuringAudit) process.exitCode = 2;
}
module.exports = { checkpoints };
if (require.main === module) {
  main().catch(error => { console.error(error.stack || error); process.exitCode = 2; });
}
