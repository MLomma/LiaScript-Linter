'use strict';
const assert = require('node:assert/strict');
const vscode = require('vscode');

function ours(document) {
  return vscode.languages.getDiagnostics(document.uri).filter(item => item.source === 'LiaScript');
}
async function waitFor(predicate, label) {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  throw new Error('Zeitüberschreitung: ' + label);
}
async function replace(document, content) {
  const edit = new vscode.WorkspaceEdit();
  edit.replace(document.uri, new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length)), content);
  assert.equal(await vscode.workspace.applyEdit(edit), true);
}
async function open(content, language = 'markdown') {
  const document = await vscode.workspace.openTextDocument({ language, content });
  await vscode.window.showTextDocument(document);
  return document;
}
const broken = '<!--\nlanguage: de\n@demo\nHallo\n-->\n# Kurs\n';
const valid = '<!--\nlanguage: de\n@demo\nHallo\n@end\n-->\n# Kurs\n';

exports.run = async function run() {
  const extension = vscode.extensions.getExtension('liascript-local.liascript-linter');
  assert.ok(extension, 'Erweiterung gefunden');
  await extension.activate();
  const config = vscode.workspace.getConfiguration('liascript.lint');
  async function setting(key, value) {
    await config.update(key, value, vscode.ConfigurationTarget.Workspace);
  }
  for (const key of ['enabled', 'markdown', 'rules', 'delay', 'maxFileSize']) await setting(key, undefined);
  await setting('delay', 40);
  let passed = 0;
  async function check(name, fn) {
    await fn();
    passed++;
    console.log('PASS ' + name);
  }
  try {
    let document;
    await check('Syntaxfarben sind ohne Projekteinstellungen als VS-Code-Vorgabe geladen', async () => {
      const colors = vscode.workspace.getConfiguration('editor').get('tokenColorCustomizations');
      const rules = colors?.textMateRules ?? [];
      assert.ok(rules.some(rule => rule.scope === 'entity.name.function.macro.liascript'
        && rule.settings?.foreground === '#20C9B0'), JSON.stringify(colors));
      assert.ok(rules.some(rule => rule.settings?.foreground === '#E53935'), JSON.stringify(colors));
    });
    await check('Automatische Markdown-Erkennung und deutsche Diagnose', async () => {
      document = await open(broken);
      await waitFor(() => ours(document).some(d => d.code === 'LS002'), 'LS002 erscheint');
      const diagnostic = ours(document).find(d => d.code === 'LS002');
      assert.equal(diagnostic.severity, vscode.DiagnosticSeverity.Error);
      assert.match(diagnostic.message, /@end/);
      assert.equal(document.getText(diagnostic.range), '@demo');
    });
    await check('Quick Fix über echte VS-Code-API anwenden', async () => {
      const diagnostic = ours(document).find(d => d.code === 'LS002');
      let action;
      await waitFor(async () => {
        const actions = await vscode.commands.executeCommand('vscode.executeCodeActionProvider', document.uri, diagnostic.range, 'quickfix');
        action = actions.find(item => item.title.includes('@end') && item.edit);
        return !!action;
      }, 'Korrekturvorschlag vorhanden');
      assert.equal(await vscode.workspace.applyEdit(action.edit), true);
      await waitFor(() => ours(document).length === 0, 'Fehler nach Fix entfernt');
      assert.equal(document.getText(), valid);
    });
    await check('Sprachmodus wechseln und Markdown wiederherstellen', async () => {
      await vscode.commands.executeCommand('liascript.enableLanguage');
      document = vscode.window.activeTextEditor.document;
      assert.equal(document.languageId, 'liascript');
      await vscode.commands.executeCommand('liascript.useMarkdown');
      document = vscode.window.activeTextEditor.document;
      assert.equal(document.languageId, 'markdown');
    });
    await check('Regeln und Schweregrad ohne Neuladen ändern', async () => {
      await replace(document, broken);
      await waitFor(() => ours(document).some(d => d.code === 'LS002'), 'Fehler erneut sichtbar');
      await setting('rules', { LS002: 'information' });
      await waitFor(() => ours(document).some(d => d.code === 'LS002' && d.severity === vscode.DiagnosticSeverity.Information), 'Schweregrad aktualisiert');
      await setting('rules', { LS002: 'off' });
      await waitFor(() => ours(document).length === 0, 'Regel deaktiviert');
      await setting('rules', {});
      await waitFor(() => ours(document).some(d => d.code === 'LS002'), 'Regel reaktiviert');
    });
    await check('Live-Prüfung abschalten; manuelle Einzelprüfung möglich', async () => {
      await setting('enabled', false);
      await waitFor(() => ours(document).length === 0, 'Diagnosen beim Deaktivieren entfernt');
      await vscode.commands.executeCommand('liascript.lintDocument');
      assert.ok(ours(document).some(d => d.code === 'LS002'));
      await replace(document, valid);
      await waitFor(() => ours(document).length === 0, 'Keine veraltete manuelle Diagnose');
      await setting('enabled', true);
    });
    await check('Gewöhnliche Markdown-Codebeispiele bleiben unbehelligt', async () => {
      const normal = await open('# Markdown\n\n`<!--`\n\n```markdown\n<!--\n@demo\n```\n');
      await new Promise(resolve => setTimeout(resolve, 120));
      assert.deepEqual(ours(normal), []);
      const malformed = await open('<!-- Noch unvollständig');
      await new Promise(resolve => setTimeout(resolve, 100));
      assert.deepEqual(ours(malformed), []);
      await vscode.commands.executeCommand('liascript.lintDocument');
      assert.ok(ours(malformed).some(d => d.code === 'LS001'));
    });
    await check('Markdown-Einstellung never lässt expliziten LiaScript-Modus zu', async () => {
      await setting('markdown', 'never');
      const other = await open(broken);
      await new Promise(resolve => setTimeout(resolve, 120));
      assert.deepEqual(ours(other), []);
      await vscode.commands.executeCommand('liascript.enableLanguage');
      document = vscode.window.activeTextEditor.document;
      await waitFor(() => ours(document).some(d => d.code === 'LS002'), 'LiaScript trotzdem geprüft');
      await setting('markdown', 'auto');
    });
    await check('Dateigrößenlimit und Wiederaufnahme', async () => {
      await setting('maxFileSize', 1000);
      await replace(document, broken + 'x'.repeat(2000));
      await new Promise(resolve => setTimeout(resolve, 120));
      assert.deepEqual(ours(document), []);
      await setting('maxFileSize', 2000000);
      await waitFor(() => ours(document).some(d => d.code === 'LS002'), 'Größere Datei nach Konfiguration geprüft');
    });
    await check('Schnelle Änderungen hinterlassen keine alten Diagnosen', async () => {
      await setting('delay', 250);
      await replace(document, broken + '\nEine Änderung');
      await replace(document, valid);
      await new Promise(resolve => setTimeout(resolve, 400));
      assert.deepEqual(ours(document), []);
      await setting('delay', 40);
    });
    await check('LLMQuiz-Begrenzungen erhalten die Diagnose im folgenden Abschnitt', async () => {
      const source = [
        '<!--', 'language: de', '-->', '# LLMQuiz', '[[Antwort]]',
        '```text @LLMQuiz(0.66,`Was bedeutet 2 * (3 + 4)?`)',
        'Zuerst wird die Klammer berechnet.', '```',
        '', '# Danach', '<!--', '@demo', 'Hallo', '-->',
      ].join('\n');
      await replace(document, source);
      await waitFor(() => ours(document).some(d => d.code === 'LS002'), 'Folgende Makrodiagnose bleibt sichtbar');
      assert.ok(!ours(document).some(d => d.code === 'LS004'), 'Kein falscher offener Codeblock');
      await replace(document, valid);
      await waitFor(() => ours(document).length === 0, 'Dokument wieder fehlerfrei');
    });
    await check('Geschlossene Dokumente räumen Diagnosemeldungen auf', async () => {
      await replace(document, broken);
      await waitFor(() => ours(document).some(d => d.code === 'LS002'), 'Fehler vor Schließen');
      const uri = document.uri;
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
      await waitFor(() => vscode.languages.getDiagnostics(uri).filter(d => d.source === 'LiaScript').length === 0, 'Meldungen nach Schließen entfernt');
    });
    console.log('VS Code: ' + passed + ' Integrationstests bestanden.');
  } finally {
    for (const key of ['enabled', 'markdown', 'rules', 'delay', 'maxFileSize']) await setting(key, undefined);
  }
};
