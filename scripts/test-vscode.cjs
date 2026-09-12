'use strict';
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const candidates = [
  process.env.VSCODE_EXECUTABLE,
  process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Microsoft VS Code', 'Code.exe'),
  process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft VS Code', 'Code.exe'),
  '/usr/share/code/code',
  '/usr/bin/code',
  '/Applications/Visual Studio Code.app/Contents/MacOS/Electron',
].filter(Boolean);
const executable = candidates.find(candidate => fs.existsSync(candidate));
if (!executable) {
  process.stderr.write('VS Code nicht gefunden. VSCODE_EXECUTABLE auf die ausführbare Datei setzen.\n');
  process.exitCode = 2;
} else {
  const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'liascript-linter-vscode-'));
  const logRoot = path.join(root, '.test-output', 'vscode');
  fs.mkdirSync(logRoot, { recursive: true });
  const workspace = path.join(testRoot, 'workspace');
  const userData = path.join(testRoot, 'user-data');
  const extensions = path.join(testRoot, 'extensions');
  for (const dir of [workspace, userData, extensions]) fs.mkdirSync(dir, { recursive: true });
  const userSettingsDir = path.join(userData, 'User');
  fs.mkdirSync(userSettingsDir, { recursive: true });
  fs.writeFileSync(path.join(userSettingsDir, 'settings.json'), JSON.stringify({
    'chat.disableAIFeatures': true,
    'telemetry.telemetryLevel': 'off',
    'update.mode': 'none',
    'extensions.autoUpdate': false,
    'extensions.autoCheckUpdates': false,
    'workbench.enableExperiments': false,
    'security.workspace.trust.enabled': false,
    'files.watcherExclude': { '**/node_modules/**': true },
  }, null, 2));
  const args = [
    '--new-window', '--disable-extensions', '--disable-gpu',
    '--skip-welcome', '--skip-release-notes', '--disable-workspace-trust',
    '--skip-add-to-recently-opened',
    '--user-data-dir=' + userData,
    '--extensions-dir=' + extensions,
    '--extensionDevelopmentPath=' + root,
    '--extensionTestsPath=' + path.join(root, 'tests', 'extension-host.cjs'),
    workspace,
  ];
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  process.stdout.write('VS-Code-Integrationstest mit isoliertem Profil wird gestartet.\n');
  const child = spawn(executable, args, { env, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const log = fs.createWriteStream(path.join(logRoot, 'host.log'));
  log.write('Testprofil: ' + testRoot + '\n');
  child.stdout.on('data', chunk => {
    log.write(chunk);
    const lines = chunk.toString().split(/\r?\n/).filter(line => /PASS |Integrationstest|AssertionError|berschreitung/.test(line));
    if (lines.length) process.stdout.write(lines.join('\n') + '\n');
  });
  child.stderr.on('data', chunk => { log.write(chunk); });
  const timeout = setTimeout(() => {
    process.stderr.write('VS-Code-Test nach 120 Sekunden abgebrochen.\n');
    child.kill();
    process.exitCode = 2;
  }, 120_000);
  child.once('error', error => {
    clearTimeout(timeout);
    process.stderr.write(error.message + '\n');
    log.end();
    process.exitCode = 2;
  });
  child.once('exit', code => {
    clearTimeout(timeout);
    log.end();
    process.exitCode = process.exitCode || (code === 0 ? 0 : 1);
    process.stdout.write('VS-Code-Prozess beendet: ' + code + '. Log: ' + path.join(logRoot, 'host.log') + '\n');
  });
}
