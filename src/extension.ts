import * as vscode from 'vscode';
import { isLiaScriptDocument, lint, RULES } from './core';

type Issue = ReturnType<typeof lint>[number];
type RuleLevel = 'off' | 'error' | 'warning' | 'information';
interface Result {
  version: number;
  issues: Issue[];
  skipped?: string;
}
const source = 'LiaScript';
const selectors: vscode.DocumentSelector = [
  { language: 'liascript' },
  { language: 'markdown' },
];

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection(source);
  const status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 45);
  status.name = 'LiaScript-Prüfung';
  status.command = 'liascript.lintDocument';
  const pending = new Map<string, ReturnType<typeof setTimeout>>();
  const results = new Map<string, Result>();
  const manualDocuments = new Set<string>();
  const visibleDocuments = new Set<string>();
  let disposed = false;

  function supported(document: vscode.TextDocument): boolean {
    return document.languageId === 'liascript' || document.languageId === 'markdown';
  }

  function settings(document: vscode.TextDocument) {
    return vscode.workspace.getConfiguration('liascript.lint', document.uri);
  }

  function candidate(document: vscode.TextDocument, force = false): boolean {
    if (!supported(document) || document.isClosed) return false;
    if (force) return true;
    const config = settings(document);
    if (!config.get<boolean>('enabled', true)) return false;
    if (document.languageId === 'liascript' || manualDocuments.has(document.uri.toString())) return true;
    const mode = config.get<string>('markdown', 'auto');
    return mode === 'always' || mode === 'auto';
  }

  function updateStatus(): void {
    const document = vscode.window.activeTextEditor?.document;
    if (!document || !supported(document) || document.isClosed) {
      status.hide();
      return;
    }
    const key = document.uri.toString();
    const result = results.get(key);
    if (!result && !(pending.has(key) && visibleDocuments.has(key))) {
      status.hide();
      return;
    }
    if (result?.skipped) {
      status.text = '$(circle-slash) LiaScript';
      status.tooltip = result.skipped;
    } else if (pending.has(document.uri.toString()) || !result) {
      status.text = '$(clock) LiaScript';
      status.tooltip = 'LiaScript-Prüfung wartet auf die letzte Eingabe.';
    } else {
      const errors = result.issues.filter(issue => issue.severity === 'error').length;
      const warnings = result.issues.filter(issue => issue.severity === 'warning').length;
      const hints = result.issues.filter(issue => issue.severity === 'information').length;
      status.text = errors ? `$(error) LiaScript ${errors}`
        : warnings ? `$(warning) LiaScript ${warnings}` : '$(check) LiaScript';
      status.tooltip = `LiaScript: ${errors} Fehler, ${warnings} Warnungen, ${hints} Hinweise. Klicken zum erneuten Prüfen.`;
    }
    status.show();
  }

  function cancel(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    const timer = pending.get(key);
    if (timer !== undefined) clearTimeout(timer);
    pending.delete(key);
  }

  function clear(document: vscode.TextDocument): void {
    cancel(document);
    diagnostics.delete(document.uri);
    results.delete(document.uri.toString());
    visibleDocuments.delete(document.uri.toString());
  }

  function range(document: vscode.TextDocument, issue: { start: number; end: number }): vscode.Range {
    return new vscode.Range(document.positionAt(issue.start), document.positionAt(issue.end));
  }

  function validate(document: vscode.TextDocument, force = false): void {
    if (disposed) return;
    cancel(document);
    if (!candidate(document, force)) {
      clear(document);
      updateStatus();
      return;
    }
    const config = settings(document);
    const text = document.getText();
    const maxSize = config.get<number>('maxFileSize', 2_000_000);
    if (text.length > maxSize) {
      visibleDocuments.add(document.uri.toString());
      diagnostics.delete(document.uri);
      results.set(document.uri.toString(), {
        version: document.version,
        issues: [],
        skipped: `Live-Prüfung pausiert: ${text.length.toLocaleString('de-DE')} Zeichen überschreiten die eingestellte Grenze von ${maxSize.toLocaleString('de-DE')}. Nutze die CLI oder erhöhe liascript.lint.maxFileSize.`,
      });
      updateStatus();
      return;
    }
    if (!force && document.languageId === 'markdown' && !manualDocuments.has(document.uri.toString())
      && config.get<string>('markdown', 'auto') === 'auto' && !isLiaScriptDocument(text)) {
      clear(document);
      updateStatus();
      return;
    }
    visibleDocuments.add(document.uri.toString());
    const rules = config.get<Record<string, RuleLevel>>('rules', {});
    const issues = lint(text, { rules });
    const severity = {
      error: vscode.DiagnosticSeverity.Error,
      warning: vscode.DiagnosticSeverity.Warning,
      information: vscode.DiagnosticSeverity.Information,
    };
    results.set(document.uri.toString(), { version: document.version, issues });
    diagnostics.set(document.uri, issues.map(issue => {
      const diagnostic = new vscode.Diagnostic(range(document, issue), issue.message, severity[issue.severity]);
      diagnostic.source = source;
      diagnostic.code = issue.code;
      return diagnostic;
    }));
    updateStatus();
  }

  function schedule(document: vscode.TextDocument): void {
    if (!supported(document)) return;
    cancel(document);
    if (!candidate(document)) {
      clear(document);
      updateStatus();
      return;
    }
    // Do not offer fixes or leave obsolete squiggles visible while a new result is pending.
    diagnostics.delete(document.uri);
    results.delete(document.uri.toString());
    const delay = Math.max(0, Math.min(5000, settings(document).get<number>('delay', 300)));
    pending.set(document.uri.toString(), setTimeout(() => validate(document), delay));
    updateStatus();
  }

  const fixes = vscode.languages.registerCodeActionsProvider(selectors, {
    provideCodeActions(document, _range, actionContext) {
      const result = results.get(document.uri.toString());
      if (!result || result.version !== document.version) return [];
      const actions: vscode.CodeAction[] = [];
      for (const diagnostic of actionContext.diagnostics) {
        if (diagnostic.source !== source) continue;
        const code = typeof diagnostic.code === 'object' ? diagnostic.code.value : diagnostic.code;
        for (const issue of result.issues) {
          if (!issue.fix || issue.code !== code || !range(document, issue).isEqual(diagnostic.range)) continue;
          const action = new vscode.CodeAction(issue.fix.title, vscode.CodeActionKind.QuickFix);
          action.diagnostics = [diagnostic];
          action.isPreferred = true;
          const edit = new vscode.WorkspaceEdit();
          for (const replacement of issue.fix.edits) {
            edit.replace(document.uri, range(document, replacement), replacement.newText);
          }
          action.edit = edit;
          actions.push(action);
        }
      }
      return actions;
    },
  }, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] });

  context.subscriptions.push(
    diagnostics, status, fixes,
    { dispose() { disposed = true; for (const timer of pending.values()) clearTimeout(timer); pending.clear(); results.clear(); manualDocuments.clear(); visibleDocuments.clear(); } },
    vscode.workspace.onDidOpenTextDocument(document => validate(document)),
    vscode.workspace.onDidChangeTextDocument(event => { if (event.contentChanges.length) schedule(event.document); }),
    vscode.workspace.onDidSaveTextDocument(document => validate(document)),
    vscode.workspace.onDidCloseTextDocument(document => { clear(document); manualDocuments.delete(document.uri.toString()); updateStatus(); }),
    vscode.window.onDidChangeActiveTextEditor(() => updateStatus()),
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('liascript.lint')) {
        for (const document of vscode.workspace.textDocuments) validate(document);
      }
    }),
    vscode.commands.registerCommand('liascript.lintDocument', () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document || !supported(document)) {
        void vscode.window.showInformationMessage('Öffne eine Markdown- oder LiaScript-Datei, um sie zu prüfen.');
        return;
      }
      manualDocuments.add(document.uri.toString());
      validate(document, true);
    }),
    vscode.commands.registerCommand('liascript.enableLanguage', async () => {
      const document = vscode.window.activeTextEditor?.document;
      if (!document || !supported(document)) {
        void vscode.window.showInformationMessage('Öffne eine Markdown-Datei, um LiaScript-Syntaxfarben zu aktivieren.');
        return;
      }
      const updated = await vscode.languages.setTextDocumentLanguage(document, 'liascript');
      validate(updated);
    }),
    vscode.commands.registerCommand('liascript.useMarkdown', async () => {
      const document = vscode.window.activeTextEditor?.document;
      if (document?.languageId === 'liascript') {
        const updated = await vscode.languages.setTextDocumentLanguage(document, 'markdown');
        validate(updated);
      }
    }),
    vscode.commands.registerCommand('liascript.showRules', async () => {
      const document = vscode.window.activeTextEditor?.document;
      const config = vscode.workspace.getConfiguration('liascript.lint', document?.uri);
      const overrides = config.get<Record<string, RuleLevel>>('rules', {});
      await vscode.window.showQuickPick(RULES.map(rule => ({
        label: rule.code,
        description: overrides[rule.code] ?? rule.defaultSeverity,
        detail: rule.description,
      })), { title: 'LiaScript-Prüfregeln', placeHolder: 'Schweregrade unter Einstellungen → LiaScript → Lint: Rules ändern.' });
    }),
  );
  for (const document of vscode.workspace.textDocuments) validate(document);
}

export function deactivate(): void {
  // VS Code disposes the subscriptions, including pending timers.
}
