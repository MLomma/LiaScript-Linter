'use strict';
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '..');
const cliPath = path.join(projectRoot, 'dist', 'cli.js');
const outputRoot = path.join(projectRoot, '.test-output');
fs.mkdirSync(outputRoot, { recursive: true });

function fixture(t, base = outputRoot) {
  const baseDirectory = path.resolve(base);
  const directory = fs.mkdtempSync(path.join(baseDirectory, 'cli-'));
  t.after(() => {
    // Only remove this test's own, verified temporary directory.
    const resolved = path.resolve(directory);
    assert.equal(path.dirname(resolved), baseDirectory);
    assert.ok(path.basename(resolved).startsWith('cli-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  return {
    directory,
    write(name, text) {
      const file = path.join(directory, name);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, text, 'utf8');
      return file;
    },
  };
}

function run(args, cwd = projectRoot) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd, encoding: 'utf8', timeout: 20_000, windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

function report(result) {
  return JSON.parse(result.stdout);
}

const valid = '# Kurs\n\n[( )] Nein\n[(X)] Ja\n';
const unclosedComment = '# Kurs\n\n<!--\nauthor: Ada\n';
const unclosedFence = '# Kurs\n\n```javascript\nconst answer = 42;\n';

test('CLI help, version and missing path are explicit', () => {
  const help = run(['--help']);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /--warnings-as-errors/);
  assert.match(help.stdout, /LS001/);
  const version = run(['--version']);
  assert.equal(version.status, 0);
  assert.equal(version.stdout.trim(), require('../package.json').version);
  const missing = run([]);
  assert.equal(missing.status, 2);
  assert.match(missing.stderr, /mindestens eine Datei/);
});

test('CLI lints explicit Markdown without requiring an intact LiaScript header', (t) => {
  const files = fixture(t);
  const file = files.write('schlichter Kurs.md', unclosedComment);
  const result = run(['--json', file]);
  assert.equal(result.status, 1);
  const json = report(result);
  assert.equal(json.files[0].path, file);
  assert.ok(json.files[0].diagnostics.some((issue) => issue.code === 'LS001'));
  assert.equal(json.summary.errors, 1);
  assert.deepEqual(json.failures, []);
});

test('CLI JSON locations preserve Unicode UTF-16 offsets and CRLF lines', (t) => {
  const files = fixture(t);
  const text = '# Grüße 😀\r\n😀 <!--\r\n';
  const file = files.write('Übung mit Leerzeichen.liascript', text);
  const result = run(['--json', file]);
  assert.equal(result.status, 1);
  const issue = report(result).files[0].diagnostics.find((item) => item.code === 'LS001');
  assert.ok(issue);
  assert.equal(issue.start, text.indexOf('<!--'));
  assert.equal(issue.line, 2);
  assert.equal(issue.column, 4);
  assert.ok(issue.end >= issue.start);
  assert.ok(issue.endLine >= issue.line);
  assert.ok(issue.endColumn >= 1);
});

test('CLI warnings succeed by default and fail with --warnings-as-errors', (t) => {
  const files = fixture(t);
  const file = files.write('fence.md', unclosedFence);
  const normal = run(['--json', file]);
  assert.equal(normal.status, 0);
  assert.equal(report(normal).summary.warnings, 1);
  const strict = run(['--json', '--warnings-as-errors', file]);
  assert.equal(strict.status, 1);
  assert.equal(report(strict).files[0].diagnostics[0].severity, 'warning');
});

test('CLI repeated rule overrides apply in order and information does not fail', (t) => {
  const files = fixture(t);
  const file = files.write('fence.md', unclosedFence);
  const disabled = run(['--json', '--rule', 'LS004=off', file]);
  assert.equal(disabled.status, 0);
  assert.deepEqual(report(disabled).files[0].diagnostics, []);
  const error = run(['--json', '--rule', 'LS004=off', '--rule=LS004=error', file]);
  assert.equal(error.status, 1);
  assert.equal(report(error).summary.errors, 1);
  const information = run(['--json', '--warnings-as-errors', '--rule', 'LS004=information', file]);
  assert.equal(information.status, 0);
  assert.equal(report(information).summary.information, 1);
});

test('CLI rejects unknown options and malformed rule assignments', () => {
  for (const args of [
    ['--wat'], ['--rule'], ['--rule', 'LS999=off', '.'],
    ['--rule', 'LS004=fatal', '.'], ['--rule', 'ls004=off', '.'],
    ['--rule=LS004=off=extra', '.'], ['--rule', '--json', '.'],
  ]) {
    const result = run(args);
    assert.equal(result.status, 2, JSON.stringify(args));
    assert.notEqual(result.stderr.trim(), '', JSON.stringify(args));
    assert.equal(result.stdout, '', JSON.stringify(args));
  }
});

test('CLI directory traversal sorts and deduplicates files and excludes generated directories', (t) => {
  const files = fixture(t);
  const z = files.write('z.md', valid);
  const a = files.write('nested/a.liascript', valid);
  files.write('other.txt', unclosedComment);
  for (const directory of ['node_modules', '.git', 'dist', 'artifacts', '.test-output', '.vscode']) {
    files.write(`${directory}/broken.md`, unclosedComment);
  }
  const result = run(['--json', z, files.directory, a, z]);
  assert.equal(result.status, 0, result.stderr);
  const json = report(result);
  assert.deepEqual(json.files.map((file) => file.path), [a, z].sort());
  assert.deepEqual(json.summary, { files: 2, errors: 0, warnings: 0, information: 0 });
});

test('CLI reports missing paths while retaining diagnostics for readable files', (t) => {
  const files = fixture(t);
  const existing = files.write('valid.md', valid);
  const missing = path.join(files.directory, 'missing.md');
  const result = run(['--json', missing, existing]);
  assert.equal(result.status, 2);
  const json = report(result);
  assert.equal(json.summary.files, 1);
  assert.equal(json.files[0].path, existing);
  assert.equal(json.failures.length, 1);
  assert.equal(json.failures[0].path, missing);
  assert.match(result.stderr, /missing\.md/);
});

test('CLI rejects explicitly supplied unsupported files', (t) => {
  const files = fixture(t);
  const file = files.write('ordinary.txt', unclosedComment);
  const result = run(['--json', file]);
  assert.equal(result.status, 2);
  assert.equal(report(result).failures.length, 1);
});

test('CLI accepts filenames beginning with a dash after --', (t) => {
  const files = fixture(t);
  files.write('-kurs.md', valid);
  const result = run(['--json', '--', '-kurs.md'], files.directory);
  assert.equal(result.status, 0);
  assert.equal(report(result).summary.files, 1);
});

test('CLI human output identifies file, location, rule and summary', (t) => {
  const files = fixture(t);
  const file = files.write('broken.md', unclosedComment);
  const result = run([file]);
  assert.equal(result.status, 1);
  assert.ok(result.stdout.includes(`${file}:3:1 error LS001`));
  assert.match(result.stdout, /1 Datei\(en\) geprüft: 1 Fehler/);
});

test('CLI skips directory symlinks and junctions instead of following hidden content', (t) => {
  // Network drives may reject junctions; exercise this behavior on the local temp filesystem.
  const files = fixture(t, require('node:os').tmpdir());
  files.write('good.md', valid);
  const hidden = files.write('node_modules/hidden/bad.md', unclosedComment);
  try {
    fs.symlinkSync(path.dirname(hidden), path.join(files.directory, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (['EPERM', 'EACCES', 'ENOSYS', 'EINVAL', 'ENOTSUP', 'UNKNOWN'].includes(error.code)) {
      t.skip(`Dateisystem unterstützt keine Test-Symlinks: ${error.code}`);
      return;
    }
    throw error;
  }
  const result = run(['--json', files.directory]);
  assert.equal(result.status, 0);
  assert.equal(report(result).summary.files, 1);
});