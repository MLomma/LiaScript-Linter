/** Static LiaScript checks. No imports are fetched and no course code is executed. */
export type Severity = 'error' | 'warning' | 'information';
export interface LintOptions { rules?: Record<string, Severity | 'off'> }
export interface LintEdit { start: number; end: number; newText: string }
export interface LintIssue {
  code: string;
  severity: Severity;
  message: string;
  /** UTF-16 offsets, end exclusive (compatible with VS Code's positionAt). */
  start: number;
  end: number;
  fix?: { title: string; edits: LintEdit[] };
}
export const RULES: ReadonlyArray<{ code: string; description: string; defaultSeverity: Severity }> = [
  { code: 'LS001', description: 'HTML-Kommentar oder Dokumentkopf nicht geschlossen', defaultSeverity: 'error' },
  { code: 'LS002', description: 'Blockmakro ohne abschließendes @end', defaultSeverity: 'error' },
  { code: 'LS003', description: '@end ohne geöffnetes Blockmakro im Dokumentkopf', defaultSeverity: 'error' },
  { code: 'LS004', description: 'Codeblock ohne schließende Fence', defaultSeverity: 'warning' },
  { code: 'LS005', description: 'Script-Tag ohne schließendes </script>', defaultSeverity: 'error' },
  { code: 'LS006', description: 'Statisches Single-Choice-Quiz ohne markierte richtige Antwort', defaultSeverity: 'warning' },
];

interface Line { text: string; start: number; end: number; next: number; visible: string; section: number }
interface Directive { offset: number; action: 'disable' | 'enable' | 'disable-next-line'; codes: string[] }
interface ScanResult { issues: LintIssue[]; lines: Line[]; directives: Directive[]; detected: boolean }
interface Macro { name: string; start: number; end: number }

function splitLines(text: string): Line[] {
  const lines: Line[] = [];
  const breaks = /\r\n|\r|\n/g;
  let start = 0;
  let match: RegExpExecArray | null;
  while ((match = breaks.exec(text))) {
    const value = text.slice(start, match.index);
    lines.push({ text: value, visible: value, start, end: match.index, next: breaks.lastIndex, section: 0 });
    start = breaks.lastIndex;
  }
  const value = text.slice(start);
  lines.push({ text: value, visible: value, start, end: text.length, next: text.length, section: 0 });
  return lines;
}

/** Remove Markdown container prefixes, but retain indentation: LiaScript quizzes may be indented. */
function contentOffset(line: string): number {
  const quote = /^(?:[ \t]*>[ \t]?)+/.exec(line)?.[0].length ?? 0;
  const list = /^[ \t]*(?:[-+*]|\d+[.)])[ \t]+/.exec(line.slice(quote))?.[0].length ?? 0;
  return quote + list;
}

function findBacktickEnd(text: string, start: number, size: number, limit = text.length): number {
  const run = '`'.repeat(size);
  let cursor = start + size;
  while ((cursor = text.indexOf(run, cursor)) !== -1 && cursor + size <= limit) {
    if (text[cursor - 1] !== '`' && text[cursor + size] !== '`') return cursor + size;
    cursor += size;
  }
  return -1;
}

/** Macro arguments use backticks as string delimiters, including across lines.
 * Parentheses inside these strings never terminate the enclosing macro call.
 * Recover at a new section if a call remains unfinished after its last string.
 */
function findMacroCallEnd(text: string, afterOpening: number): number {
  let depth = 1;
  let lastQuotedEnd = -1;
  for (let cursor = afterOpening; cursor < text.length; cursor++) {
    if (text[cursor] === '\\') { cursor++; continue; }
    if (text[cursor] === '`') {
      const size = /^`+/.exec(text.slice(cursor))![0].length;
      const end = findBacktickEnd(text, cursor, size);
      // An unfinished quoted argument remains opaque up to EOF. It is not a
      // Markdown fence, so LS004 must not report a fictitious code block here.
      if (end === -1) return text.length;
      lastQuotedEnd = end;
      cursor = end - 1;
      continue;
    }
    if (text[cursor] === '(') depth++;
    else if (text[cursor] === ')' && --depth === 0) return cursor + 1;
    if ((text[cursor] === '\n' || text[cursor] === '\r') && /^[\r\n]*[ \t]*#{1,6}\s/.test(text.slice(cursor))) return lastQuotedEnd;
  }
  return lastQuotedEnd;
}

/** Backticks are permitted inside a LiaScript fence's macro annotation. */
function validFenceInfo(info: string): boolean {
  if (!info.includes('`')) return true;
  let cursor = 0;
  const macros = /@'?[\w][\w.:-]*\(/g;
  let match: RegExpExecArray | null;
  while ((match = macros.exec(info))) {
    if (info.slice(cursor, match.index).includes('`')) return false;
    const end = findMacroCallEnd(info, macros.lastIndex);
    if (end === -1) return false;
    cursor = end;
    macros.lastIndex = end;
  }
  return !info.slice(cursor).includes('`');
}
function scan(text: string): ScanResult {
  const lines = splitLines(text);
  const issues: LintIssue[] = [];
  const directives: Directive[] = [];
  const dynamicSections = new Set<number>();
  let detected = false;
  let section = 0;
  let headerAllowed = true;
  let opaqueUntil = 0;
  let fence: { char: string; size: number; start: number } | undefined;
  const add = (code: string, message: string, start: number, end: number, fix?: LintIssue['fix']): void => {
    const severity = RULES.find(rule => rule.code === code)?.defaultSeverity ?? 'warning';
    const issue: LintIssue = { code, message, start, end, severity };
    if (fix) issue.fix = fix;
    issues.push(issue);
  };

  function readComment(start: number, firstLine: number, header: boolean): number {
    let macro: Macro | undefined;
    let nested = 0;
    let continuationIndent: number | undefined;
    // Triple-dash comments deliberately disable their contents in LiaScript.
    if (text[start + 4] === '-') header = false;
    for (let index = firstLine; index < lines.length; index++) {
      const line = lines[index]!;
      const from = index === firstLine ? start + 4 : line.start + contentOffset(line.text);
      const raw = text.slice(from, line.end);
      const indent = /^[ \t]*/.exec(raw)?.[0].length ?? 0;
      const trimmed = raw.trim();
      const beforeClose = raw.split('-->')[0]!.trim();
      if (header) {
        if (macro) {
          if (/^@end(?:[ \t]*-->)?[ \t]*$/.test(trimmed)) {
            macro = undefined;
            nested = 0;
            continuationIndent = undefined;
          }
        } else {
          const continued = continuationIndent !== undefined && indent > continuationIndent;
          if (trimmed && !continued) {
            continuationIndent = undefined;
            const definition = /^(@(?:@@)?[\w][\w.:-]*?)[ \t]*$/.exec(beforeClose);
            if (beforeClose === '@end') {
              const token = from + raw.indexOf('@end');
              add('LS003', 'Dieses @end hat kein geöffnetes Blockmakro im Dokumentkopf.', token, token + 4,
                { title: 'Überflüssiges @end entfernen', edits: [{ start: token, end: token + 4, newText: '' }] });
            } else if (definition && !definition[1]!.endsWith(':')) {
              const name = definition[1]!;
              const token = from + raw.indexOf(name);
              macro = { name, start: token, end: token + name.length };
              detected = true;
            } else if (/^@?[\w][\w.-]*\s*:/.test(beforeClose) || /^@@[\w][\w.-]*\s*:/.test(beforeClose)) {
              continuationIndent = indent;
              if (/^@(?!@)/.test(beforeClose) || /^(?:narrator|language|import|mode|liascript)\s*:/i.test(beforeClose)) detected = true;
            }
          }
        }
      }
      const tokens = /<!--|-->/g;
      let token: RegExpExecArray | null;
      while ((token = tokens.exec(raw))) {
        if (macro && token[0] === '<!--') { nested++; continue; }
        if (token[0] !== '-->') continue;
        if (macro && nested > 0) { nested--; continue; }
        const close = from + token.index;
        if (macro) {
          const newline = text.includes('\r\n') ? '\r\n' : '\n';
          const needsLineBreak = text.slice(line.start, close).trim().length > 0;
          add('LS002', `Das Blockmakro ${macro.name} benötigt ein abschließendes @end vor dem Ende des Dokumentkopfs.`, macro.start, macro.end,
            { title: `@end für ${macro.name} einfügen`, edits: [{ start: close, end: close, newText: `${needsLineBreak ? newline : ''}@end${newline}` }] });
        }
        const body = text.slice(start + 4, close).trim();
        const directive = /^liascript-lint-(disable-next-line|disable|enable)(?:\s+([\s\S]*))?$/.exec(body);
        if (directive) {
          const codes = (directive[2] ?? '').split(/[\s,]+/).filter(Boolean);
          directives.push({ offset: start, action: directive[1] as Directive['action'], codes });
        }
        if (/^liascript(?:\s*:\s*true)?$/i.test(body)) detected = true;
        return close + 3;
      }
    }
    if (macro) add('LS002', `Das Blockmakro ${macro.name} benötigt ein abschließendes @end.`, macro.start, macro.end);
    add('LS001', header ? 'Dieser LiaScript-Dokumentkopf ist nicht mit --> geschlossen.' : 'Dieser HTML-Kommentar ist nicht mit --> geschlossen.', start, start + 4);
    return text.length;
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!;
    line.section = section;
    if (fence) {
      const value = line.text.slice(contentOffset(line.text)).trim();
      const run = new RegExp(`^${fence.char === '`' ? '`' : '~'}{${fence.size},}(.*)$`).exec(value);
      if (run && /^\s*$/.test(run[1]!)) fence = undefined;
      line.visible = ' '.repeat(line.text.length);
      continue;
    }
    let cursor = Math.max(line.start, Math.min(opaqueUntil, line.end));
    if (cursor > line.start) line.visible = ' '.repeat(cursor - line.start) + line.visible.slice(cursor - line.start);
    if (opaqueUntil > line.end) continue;
    const prefix = contentOffset(line.text);
    const bare = line.text.slice(prefix);
    if (cursor === line.start) {
      const opening = /^[ \t]*(`{3,}|~{3,})(.*)$/.exec(bare);
      if (opening && !(opening[1]![0] === '`' && !validFenceInfo(opening[2]!))) {
        const token = line.start + prefix + bare.indexOf(opening[1]!);
        fence = { char: opening[1]![0]!, size: opening[1]!.length, start: token };
        line.visible = ' '.repeat(line.text.length);
        headerAllowed = false;
        continue;
      }
    }
    while (cursor < line.end) {
      const local = cursor - line.start;
      if (text[cursor] === '\\') { cursor += 2; continue; }
      if (text[cursor] === '@') {
        const call = /^@'?[\w][\w.:-]*\(/.exec(text.slice(cursor));
        if (call) {
          const end = findMacroCallEnd(text, cursor + call[0].length);
          dynamicSections.add(section);
          headerAllowed = false;
          if (end !== -1) {
            line.visible = line.visible.slice(0, local) + ' '.repeat(Math.min(end, line.end) - cursor) + line.visible.slice(Math.min(end, line.end) - line.start);
            opaqueUntil = end;
            cursor = end;
            continue;
          }
        }
      }
      if (text.startsWith('<!--', cursor)) {
        const end = readComment(cursor, index, headerAllowed && !line.text.slice(prefix, local).trim());
        line.visible = line.visible.slice(0, local) + ' '.repeat(Math.min(end, line.end) - cursor) + line.visible.slice(Math.min(end, line.end) - line.start);
        opaqueUntil = end;
        cursor = end;
        continue;
      }
      if (text[cursor] === '`') {
        const run = /^`+/.exec(text.slice(cursor))![0];
        // Ordinary inline code cannot cross a paragraph boundary. Quoted macro
        // arguments use findMacroCallEnd and retain their multiline semantics.
        const blankLine = /(?:\r\n|\n|\r(?!\n))[ \t]*(?:\r\n|\n|\r(?!\n))/.exec(text.slice(cursor + run.length));
        const limit = blankLine ? cursor + run.length + blankLine.index : text.length;
        const end = findBacktickEnd(text, cursor, run.length, limit);
        if (end !== -1) {
          line.visible = line.visible.slice(0, local) + ' '.repeat(Math.min(end, line.end) - cursor) + line.visible.slice(Math.min(end, line.end) - line.start);
          opaqueUntil = end;
          cursor = end;
          continue;
        }
        cursor += run.length;
        continue;
      }
      if (text[cursor] === '<') {
        const opening = /^<script\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(text.slice(cursor));
        const rawElement = opening ?? /^<(?:style|pre|code|textarea)\b(?:[^>"']|"[^"]*"|'[^']*')*>/i.exec(text.slice(cursor));
        if (rawElement) {
          const tag = /^<([a-z]+)/i.exec(rawElement[0])![1]!;
          const closing = new RegExp(`</${tag}\\s*>`, 'gi');
          closing.lastIndex = cursor + rawElement[0].length;
          const match = closing.exec(text);
          const end = match ? closing.lastIndex : text.length;
          if (opening) {
            dynamicSections.add(section);
            if (!match) add('LS005', 'Dieses Script-Tag ist nicht mit </script> geschlossen.', cursor, cursor + rawElement[0].length);
          }
          line.visible = line.visible.slice(0, local) + ' '.repeat(Math.min(end, line.end) - cursor) + line.visible.slice(Math.min(end, line.end) - line.start);
          opaqueUntil = end;
          cursor = end;
          continue;
        }
        // Tag attributes are source strings, not embedded LiaScript. Preserve
        // ordinary element contents while skipping complete quoted attributes.
        const htmlTag = /^<\/?[a-z][a-z0-9:-]*(?:\s(?:[^>"']|"[^"]*"|'[^']*')*)?\s*\/?>/i.exec(text.slice(cursor));
        if (htmlTag) {
          const end = cursor + htmlTag[0].length;
          line.visible = line.visible.slice(0, local) + ' '.repeat(Math.min(end, line.end) - cursor) + line.visible.slice(Math.min(end, line.end) - line.start);
          opaqueUntil = end;
          cursor = end;
          continue;
        }
      }
      cursor++;
    }
    const visible = line.visible.slice(contentOffset(line.visible));
    if (/^[ \t]*#{1,6}\s/.test(visible)) {
      section++;
      line.section = section;
      headerAllowed = true;
    } else if (visible.trim()) headerAllowed = false;
    if (/(?:^|[^\\])@[\w]/.test(visible)) dynamicSections.add(section);
    if (/^[ \t]*(?:\[\([Xx ]\)\]|\[\[[Xx?! ]\]\])/.test(visible)
      || /^[ \t]*(?:--)?\{\{\d+(?:[-,]\d+)*\}\}(?:--)?[ \t]*$/.test(visible)
      || /https?:\/\/liascript\.github\.io\/(?:course|LiveEditor)\//i.test(visible)) detected = true;
  }
  if (fence && fence.char === '`') add('LS004', 'Dieser Codeblock hat keine passende schließende Backtick-Fence.', fence.start, fence.start + fence.size);

  // Restrict this authoring warning to adjacent, static vector rows. Multiple X
  // alternatives are valid. Any visible macro or script in a section can change
  // quiz semantics, so suppress this check for that entire section.
  let group: { first: Line; last: Line; count: number; marked: boolean; prefix: string } | undefined;
  function finishGroup(): void {
    if (group && group.count >= 2 && !group.marked && !dynamicSections.has(group.first.section)) {
      const firstOffset = group.first.visible.indexOf('[(');
      add('LS006', 'Dieses statische Single-Choice-Quiz hat keine mit (X) oder (x) markierte richtige Antwort.', group.first.start + firstOffset, group.last.end);
    }
    group = undefined;
  }
  for (const line of lines) {
    const offset = contentOffset(line.visible);
    const match = /^[ \t]*\[\(([Xx ])\)\](?:[ \t]+.*)?$/.exec(line.visible.slice(offset));
    const prefix = line.visible.slice(0, offset).replace(/[ \t]/g, '');
    if (!match) { finishGroup(); continue; }
    if (group && (group.first.section !== line.section || group.prefix !== prefix)) finishGroup();
    if (!group) group = { first: line, last: line, count: 0, marked: false, prefix };
    group.last = line;
    group.count++;
    group.marked ||= match[1] !== ' ';
  }
  finishGroup();
  return { issues, lines, directives, detected };
}

function lineAt(lines: Line[], offset: number): number {
  let low = 0;
  let high = lines.length - 1;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (lines[middle]!.start <= offset) low = middle;
    else high = middle - 1;
  }
  return low;
}

export function lint(text: string, options: LintOptions = {}): LintIssue[] {
  const result = scan(text);
  const all = RULES.map(rule => rule.code);
  return result.issues.filter(issue => {
    const setting = options.rules?.[issue.code];
    if (setting === 'off') return false;
    if (setting) issue.severity = setting;
    const disabled = new Set<string>();
    let nextLineDisabled = false;
    const issueLine = lineAt(result.lines, issue.start);
    for (const directive of result.directives) {
      const directiveLine = lineAt(result.lines, directive.offset);
      const codes = directive.codes.length ? directive.codes : all;
      if (directive.action === 'disable-next-line') {
        if (directiveLine + 1 === issueLine && codes.includes(issue.code)) nextLineDisabled = true;
      } else if (directive.offset <= issue.start) {
        for (const code of codes) {
          if (directive.action === 'disable') disabled.add(code);
          else disabled.delete(code);
        }
      }
    }
    return !nextLineDisabled && !disabled.has(issue.code);
  }).sort((a, b) => a.start - b.start || a.code.localeCompare(b.code));
}

/** Conservative evidence for checking Markdown automatically; explicit mode accepts any document. */
export function isLiaScriptDocument(text: string): boolean { return scan(text).detected; }