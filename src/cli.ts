#!/usr/bin/env node
import { lstat, readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { lint, RULES } from './core';

type RuleSetting = 'off' | 'error' | 'warning' | 'information';
interface Options {
  paths: string[];
  json: boolean;
  warningsAsErrors: boolean;
  rules: Record<string, RuleSetting>;
  help: boolean;
  version: boolean;
}
interface Failure { path: string; message: string }
interface Position { line: number; column: number }
type Diagnostic = ReturnType<typeof lint>[number] & Position & {
  endLine: number;
  endColumn: number;
};
interface Report {
  files: { path: string; diagnostics: Diagnostic[] }[];
  summary: { files: number; errors: number; warnings: number; information: number };
  failures: Failure[];
}

const excludedDirectories = new Set([
  'node_modules', '.git', 'dist', 'artifacts', '.test-output', '.vscode',
]);
const acceptedExtensions = new Set(['.md', '.liascript']);
const settings = new Set<string>(['off', 'error', 'warning', 'information']);
const ruleCodes = new Set<string>(RULES.map((rule) => rule.code));

function parseArguments(args: string[]): Options {
  const options: Options = {
    paths: [], json: false, warningsAsErrors: false, rules: {}, help: false, version: false,
  };
  let positionalOnly = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index]!;
    if (positionalOnly) {
      options.paths.push(argument);
    } else if (argument === '--') {
      positionalOnly = true;
    } else if (argument === '--json') {
      options.json = true;
    } else if (argument === '--warnings-as-errors') {
      options.warningsAsErrors = true;
    } else if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--version') {
      options.version = true;
    } else if (argument === '--rule' || argument.startsWith('--rule=')) {
      const value = argument === '--rule' ? args[++index] : argument.slice('--rule='.length);
      const match = value?.match(/^(LS\d{3})=(off|error|warning|information)$/);
      if (!match || !ruleCodes.has(match[1]!) || !settings.has(match[2]!)) {
        throw new Error('Ungültige Regel. Beispiel: --rule LS004=off. Erlaubte Regeln: ' + [...ruleCodes].join(', '));
      }
      options.rules[match[1]!] = match[2] as RuleSetting;
    } else if (argument.startsWith('-')) {
      throw new Error(`Unbekannte Option: ${argument}. Dateinamen mit Bindestrich nach -- angeben.`);
    } else {
      options.paths.push(argument);
    }
  }
  if (!options.help && !options.version && options.paths.length === 0) {
    throw new Error('Bitte mindestens eine Datei oder ein Verzeichnis angeben. Hilfe: --help');
  }
  return options;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function fileKey(filePath: string): string {
  return process.platform === 'win32' ? filePath.toLowerCase() : filePath;
}

async function collectFiles(inputs: string[], failures: Failure[]): Promise<string[]> {
  const files = new Map<string, string>();
  const visitedDirectories = new Set<string>();
  const visit = async (input: string, explicit: boolean): Promise<void> => {
    const absolute = path.resolve(input);
    try {
      const info = await lstat(absolute);
      if (info.isSymbolicLink()) return;
      if (info.isDirectory()) {
        if (!explicit && excludedDirectories.has(path.basename(absolute).toLowerCase())) return;
        const key = fileKey(absolute);
        if (visitedDirectories.has(key)) return;
        visitedDirectories.add(key);
        const entries = await readdir(absolute);
        entries.sort();
        for (const entry of entries) await visit(path.join(absolute, entry), false);
      } else if (info.isFile() && acceptedExtensions.has(path.extname(absolute).toLowerCase())) {
        const key = fileKey(absolute);
        if (!files.has(key)) files.set(key, absolute);
      } else if (explicit) {
        failures.push({ path: absolute, message: 'Erwartet wird eine .md- oder .liascript-Datei oder ein Verzeichnis.' });
      }
    } catch (error) {
      failures.push({ path: absolute, message: errorMessage(error) });
    }
  };
  for (const input of inputs) await visit(input, true);
  return [...files.values()].sort();
}

function lineStarts(text: string): number[] {
  const starts = [0];
  const newline = /\r\n|\r|\n/g;
  for (const match of text.matchAll(newline)) starts.push(match.index + match[0].length);
  return starts;
}

function positionAt(starts: number[], offset: number): Position {
  let low = 0;
  let high = starts.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle]! <= offset) low = middle;
    else high = middle;
  }
  return { line: low + 1, column: offset - starts[low]! + 1 };
}

async function createReport(options: Options): Promise<Report> {
  const report: Report = {
    files: [], summary: { files: 0, errors: 0, warnings: 0, information: 0 }, failures: [],
  };
  const files = await collectFiles(options.paths, report.failures);
  for (const filePath of files) {
    try {
      const text = await readFile(filePath, 'utf8');
      const starts = lineStarts(text);
      const issues = lint(text, { rules: options.rules });
      const diagnostics = issues.map((issue): Diagnostic => {
        const start = positionAt(starts, issue.start);
        const end = positionAt(starts, issue.end);
        if (issue.severity === 'error') report.summary.errors++;
        else if (issue.severity === 'warning') report.summary.warnings++;
        else report.summary.information++;
        return { ...issue, ...start, endLine: end.line, endColumn: end.column };
      }).sort((a, b) => a.start - b.start || a.code.localeCompare(b.code));
      report.files.push({ path: filePath, diagnostics });
      report.summary.files++;
    } catch (error) {
      report.failures.push({ path: filePath, message: errorMessage(error) });
    }
  }
  report.failures.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  return report;
}

function printHelp(): void {
  process.stdout.write([
    'LiaScript Linter',
    '',
    'Aufruf: liascript-lint [Optionen] <Datei oder Verzeichnis> ...',
    '        node dist/cli.js [Optionen] <Datei oder Verzeichnis> ...',
    '',
    '  --json                 Ergebnisse als JSON ausgeben',
    '  --warnings-as-errors   Auch bei Warnungen Exitcode 1 zurückgeben',
    '  --rule LS004=off       Regel überschreiben (mehrfach möglich)',
    '                         Werte: off, error, warning, information',
    '  --help, -h             Diese Hilfe anzeigen',
    '  --version              Version anzeigen',
    '  --                     Ende der Optionen (für Namen mit Bindestrich)',
    '',
    'Verzeichnisse werden rekursiv nach .md und .liascript durchsucht.',
    'Übersprungen: node_modules, .git, dist, artifacts, .test-output, .vscode und Symlinks.',
    'Explizit angegebene Dateien werden immer geprüft; keine LiaScript-Erkennung nötig.',
    'JSON-Positionen: Zeile/Spalte ab 1, UTF-16; start/end sind UTF-16-Offsets ab 0.',
    'Exitcodes: 0 = ohne Fehler, 1 = Prüffehler, 2 = Aufruf- oder Lesefehler.',
    '',
    'Regeln:',
    ...RULES.map((rule) => `  ${rule.code} (${rule.defaultSeverity}): ${rule.description}`),
    '',
  ].join('\n'));
}

async function main(args: string[]): Promise<number> {
  let options: Options;
  try {
    options = parseArguments(args);
  } catch (error) {
    process.stderr.write(`LiaScript Linter: ${errorMessage(error)}\n`);
    return 2;
  }
  if (options.help) {
    printHelp();
    return 0;
  }
  if (options.version) {
    const packageInfo: { version: string } = JSON.parse(await readFile(path.join(__dirname, '..', 'package.json'), 'utf8'));
    process.stdout.write(`${packageInfo.version}\n`);
    return 0;
  }
  const report = await createReport(options);
  if (options.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } else {
    for (const file of report.files) {
      for (const diagnostic of file.diagnostics) {
        process.stdout.write(`${file.path}:${diagnostic.line}:${diagnostic.column} ${diagnostic.severity} ${diagnostic.code} ${diagnostic.message}\n`);
      }
    }
    const { files, errors, warnings, information } = report.summary;
    process.stdout.write(`${files} Datei(en) geprüft: ${errors} Fehler, ${warnings} Warnungen, ${information} Hinweise.\n`);
  }
  for (const failure of report.failures) {
    process.stderr.write(`${failure.path}: ${failure.message}\n`);
  }
  if (report.failures.length > 0) return 2;
  if (report.summary.errors > 0 || (options.warningsAsErrors && report.summary.warnings > 0)) return 1;
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error: unknown) => {
    process.stderr.write(`LiaScript Linter: ${errorMessage(error)}\n`);
    process.exitCode = 2;
  });
}