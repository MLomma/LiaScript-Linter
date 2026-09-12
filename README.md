<!--
version:  0.1.5
language: de
narrator: German Female
comment:  VS-Code-Erweiterung für LiaScript mit Syntaxfarben, deutschen
          Fehlermeldungen, Korrekturvorschlägen und einem unabhängigen Prüfkern
          für die Kommandozeile.
logo:     ./assets/lrLia.png
icon:     ./assets/lrLia.png
repository: https://github.com/MLomma/LiaScript-Linter

edit:     true

author:  Martin Lommatzsch

attribute: Für den eigenen Projektcode ist noch keine Veröffentlichungslizenz
           festgelegt (UNLICENSED). Die VS-Code-/TextMate-Testfixtures behalten
           ihre ursprünglichen Lizenzhinweise.
-->

# LiaScript Linter

VS-Code-Erweiterung für LiaScript mit **Syntaxfarben**, **deutschen Fehlermeldungen**,
**Korrekturvorschlägen** und einem unabhängigen Prüfkern für die Kommandozeile.

Version 0.1.5 ist eine lokale Entwicklungsfassung. Die Prüfung arbeitet statisch;
sie führt keine Kursskripte aus und lädt keine Template-Importe herunter.

## In VS Code verwenden

Nach dem Klonen des Repositories das lokale VSIX-Paket mit **Node.js 22 oder neuer**
erstellen:

```powershell
npm ci
npm run package
```

Danach in VS Code installieren:

1. Die Datei `artifacts/liascript-linter-0.1.5.vsix` über
   **Erweiterungen → … → Aus VSIX installieren…** installieren.
2. Eine LiaScript-Markdown-Datei öffnen.
3. **Strg+Umschalt+P → LiaScript: Syntaxfarben aktivieren** ausführen.
4. Meldungen erscheinen als Unterstreichungen und unter **Ansicht → Probleme**.
   Für verfügbare Korrekturen auf die Glühbirne klicken oder **Strg+.** drücken.

`examples/valid.lia.md` enthält gültige Beispiele,
`examples/invalid.lia.md` absichtlich eingebaute Fehler.
Dateien mit der Endung `.lia.md` oder `.liascript` verwenden den Sprachmodus automatisch.
Vorhandene `.md`-Dateien können ihren Namen behalten.
`examples/llmquiz.lia.md` zeigt Codeblöcke mit `@LLMQuiz(...)`
in der öffnenden Zeile sowie einzelne und dreifache Backticks in Makroargumenten.

Eine manuelle Sprachumschaltung gilt für das geöffnete Dokument. Für eine dauerhafte
Zuordnung in einem reinen LiaScript-Projekt kann man in dessen `.vscode/settings.json`
setzen:

```json
{
  "files.associations": {
    "*.md": "liascript"
  }
}
```

In gemischten Projekten einen engeren Dateinamen oder ein passendes Pfadmuster wählen.

### Markdown und Vorschau

Auch im normalen Markdown-Sprachmodus prüft der Linter standardmäßig Dateien,
in denen er LiaScript-Strukturen erkennt. **LiaScript: Aktuelle Datei prüfen** erzwingt
eine Prüfung für das geöffnete Markdown-Dokument; damit lassen sich auch Dateien prüfen,
deren LiaScript-Struktur noch unvollständig ist. Diese manuelle Auswahl gilt bis zum
Schließen des Dokuments. Der Befehl führt auch bei abgeschalteter automatischer Prüfung
eine einzelne Prüfung aus.

Codeblöcke mit LiaScript-Makros in der Startzeile, etwa `@LLMQuiz(...)`,
werden auch im normalen Markdown-Sprachmodus korrekt begrenzt. Backticks im
Makroargument lassen die Einfärbung des folgenden Abschnitts nicht mehr abbrechen.
Dafür ist kein manueller Sprachwechsel nötig; Markdown-Vorschau und Snippets
bleiben im Markdown-Modus verfügbar.

Die vollständigen LiaScript-Syntaxfarben für Quizze, Makros und Animationen
sind weiterhin an den Sprachmodus **LiaScript** gebunden.
**LiaScript: Zum Markdown-Sprachmodus wechseln** stellt den ursprünglichen Modus wieder her.

Die bestehende Erweiterung **LiaScript Preview** kann daneben genutzt werden.
Bei der lokal geprüften Version 1.1.10 öffnet sich die Vorschau auch im LiaScript-Modus;
ihre Navigation per Strg+Klick ist aber nur für Markdown registriert. Auch die externe
Erweiterung **LiaScript Snippets** 1.9.1 registriert ihre Vorlagen nur für Markdown.
Diese Erweiterung liefert deshalb eigene grundlegende Snippets für LiaScript.
Weitere Markdown-Erweiterungen können ebenfalls auf den Markdown-Sprachmodus beschränkt sein.

### Farben und Vorlagen

Die Grammatik hebt Dokumentköpfe, Metadaten, Makros, Quizmarker und Animationen hervor.
Markdown und eingebettete Codeblöcke behalten ihre sprachabhängige Darstellung.
Die konkreten Farben bestimmt das VS-Code-Theme.

Makroargumente in einfachen oder dreifachen Backticks schützen enthaltene Kommas
und Klammern vor einer falschen Trennung. Das gilt auch für `@LLMQuiz(...)`
in der Startzeile eines Codeblocks. Nach der schließenden Begrenzung wird der
folgende Kurs wieder normal eingefärbt. Direkte Makroaufrufe können mehrzeilige
Backtick-Argumente verwenden; Makroaufrufe in Codeblock-Startzeilen werden einzeilig behandelt.

Für Codeblock-Startzeilen mit Backtick-Makroargumenten sind JavaScript, TypeScript,
JSON, CSS, HTML, Python, Shell, YAML, SQL und LaTeX eingebunden. Bei weiteren Sprachen
mit Backticks in der Startzeile wird der Inhalt zunächst als einfacher Codeblock
eingefärbt. Gewöhnliche Codeblöcke verwenden weiterhin die Markdown-Sprachregeln.

Im LiaScript-Modus `lia-` tippen und **Strg+Leertaste** drücken, um Vorlagen auszuwählen.
Die Snippets ergänzen grundlegende Strukturen; sie sind kein vollständiger Template-Katalog.

## Prüfregeln

| Regel | Standard | Prüfung |
| --- | --- | --- |
| LS001 | Fehler | Nicht geschlossener HTML-Kommentar oder Dokumentkopf |
| LS002 | Fehler | Blockmakro im Dokumentkopf ohne `@end` |
| LS003 | Fehler | `@end` im Dokumentkopf ohne geöffnetes Blockmakro |
| LS004 | Warnung | Nicht geschlossener Codeblock |
| LS005 | Fehler | Nicht geschlossener `<script>`-Block außerhalb von Makrodefinitionen und Codebeispielen |
| LS006 | Warnung | Statische Single-Choice-Aufgabe ohne markierte Antwort |

LS004 ist eine Hilfe beim Schreiben: Ein offener Codeblock am Dateiende ist nach
Markdown nicht zwangsläufig ungültig. LS006 prüft nur zusammenhängende statische
Antwortblöcke mit mindestens zwei Antwortzeilen. Mehrere akzeptierte Single-Choice-Antworten sind in LiaScript zulässig.

Metadaten wie `author`, `tags` und `version` werden nicht zur technischen Pflicht erklärt.
Unbekannte Makros werden nicht als Fehler gemeldet, weil sie aus Templates stammen können.
Dynamische Quizlösungen und durch Skripte erzeugte Inhalte werden nicht ausgewertet.
Die Regeln sind keine vollständige Nachbildung des LiaScript-Interpreters.

### Einstellungen

```json
{
  "liascript.lint.enabled": true,
  "liascript.lint.markdown": "auto",
  "liascript.lint.delay": 300,
  "liascript.lint.maxFileSize": 2000000,
  "liascript.lint.rules": {
    "LS004": "off",
    "LS006": "information"
  }
}
```

- `markdown`: `auto`, `always` oder `never`.
- `delay`: Wartezeit nach der letzten Eingabe in Millisekunden.
- `maxFileSize`: Grenze der Live-Prüfung in UTF-16-Zeichen. Größere Dokumente werden mit
  einem Hinweis in der Statusleiste übersprungen; die CLI hat diese Grenze nicht.
- `rules`: Je Regel `off`, `error`, `warning` oder `information`.

**LiaScript: Prüfregeln anzeigen** zeigt die Regeln und ihre aktuell eingestellten Schweregrade.

Einzelne Stellen können auch im Dokument ausgenommen werden:

```markdown
<!-- liascript-lint-disable-next-line LS006 -->
[( )] Noch keine Lösung festgelegt
[( )] Zweite Antwort noch offen
```

Für längere Abschnitte:

```markdown
<!-- liascript-lint-disable LS004 -->
... bewusst unvollständiges Beispiel ...
<!-- liascript-lint-enable LS004 -->
```

Die Direktiven selbst müssen außerhalb von Codebeispielen stehen.
Ein Kommentar zum erneuten Aktivieren innerhalb eines bereits geöffneten Codeblocks
ist Teil des Codes und beendet eine Unterdrückung nicht.

## Kommandozeile

Voraussetzung für die Entwicklung und CLI: **Node.js 22 oder neuer**.

```powershell
npm ci
npm run build
node dist/cli.js examples/valid.lia.md
node dist/cli.js mein-kurs.md --json
node dist/cli.js kurse --warnings-as-errors --rule LS004=off
```

Dateien werden explizit geprüft. Bei Verzeichnissen werden Markdown- und LiaScript-Dateien
rekursiv gesammelt; generierte Verzeichnisse und symbolische Links werden übersprungen.
Pfade mit Leerzeichen in Anführungszeichen setzen. Mit `--` können Dateinamen übergeben
werden, die mit einem Bindestrich anfangen.

Die Exitcodes sind **0** für keine Fehler, **1** für Befunde mit Fehler-Schweregrad
(oder Warnungen mit `--warnings-as-errors`) und **2** für Aufruf- oder Lesefehler.

`--json` gibt ein Objekt mit `files`, `summary` und `failures` aus. Jede Diagnose enthält
Regel, Schweregrad, Nachricht, absolute Zeichenpositionen sowie 1-basierte Zeilen und
Spalten. Spalten und Offsets zählen UTF-16-Codeeinheiten wie VS Code.
`node dist/cli.js --help` zeigt alle Optionen.

## Entwickeln und testen

```powershell
npm ci
npm test
npm run test:integration
npm run package
```

**F5** startet mit der mitgelieferten Debug-Konfiguration ein separates VS-Code-Fenster
für die Erweiterung und öffnet den Beispielordner.

`npm test` prüft den Kern, die CLI und die tatsächlichen TextMate-Token.
`npm run test:integration` verwendet eine lokale VS-Code-Installation und ein isoliertes
Testprofil im lokalen temporären Verzeichnis. Das Protokoll liegt unter
`.test-output/vscode/host.log`. Falls VS Code nicht automatisch gefunden wird,
`VSCODE_EXECUTABLE` auf die ausführbare VS-Code-Datei setzen.
Das Testprofil verändert weder die installierten Erweiterungen noch die Einstellungen
des normalen Benutzerprofils.

`npm run package` erzeugt das lokale VSIX-Paket unter `artifacts`.
Eine Veröffentlichung im Marketplace ist nicht Teil dieses Projektschritts.
Der Publisher `liascript-local` bezeichnet diese lokale Entwicklungsfassung.

## Gesamttest der Kurssammlungen

Der Projektbericht `reports/corpus-audit.md` vom 12. September 2026 dokumentiert
alle **1.616 Markdown-Dateien** aus Aufgabensammlung und Wochenaufgabe,
einschließlich Archiven und Importbeispielen. Er enthält die behobenen
Highlighting-Fehler, die genauen Repository-Stände und die Grenzen der Prüfung.

Die Tests lassen sich mit einem lokalen SchulLia-Korpus und den installierten
VS-Code-Grammatiken wiederholen:

```powershell
npm run audit:corpus -- --corpus "PFAD/ZUM/corpus" --vscode-extensions "PFAD/ZU/VSCode/resources/app/extensions" --output ".test-output/highlight-corpus.json"
node scripts/audit-fences.cjs --corpus "PFAD/ZUM/corpus" --vscode-extensions "PFAD/ZU/VSCode/resources/app/extensions" --output ".test-output/fence-corpus.json"
```

Das erste Skript tokenisiert jede Zeile und meldet fehlende erwartete Syntaxbereiche
als Prüfkandidaten. Diese Hinweise müssen im Kontext bewertet werden. Das zweite
vergleicht Codeblöcke mit den nativen Sprachregeln und prüft die Fortsetzung danach.
Beide Skripte lesen Kursdateien, ohne enthaltenen Code auszuführen.

## Projektaufbau

- `src/core/`: Scanner, Regeln und editorunabhängige Ergebnisse
- `src/extension.ts`: VS-Code-Diagnosen, Befehle und Korrekturvorschläge
- `src/cli.ts`: Dateiprüfung und Ausgabe für Terminal/CI
- `syntaxes/`: LiaScript-Grammatiken
- `snippets/`: Vorlagen für den Editor
- `tests/`: Regressionstests und Integrationstests
- `examples/`: gültige und absichtlich fehlerhafte Beispieldateien

## Syntaxgrundlage

Die Regeln wurden gegen gezielte Stellen der offiziellen
[LiaScript-Dokumentation](https://github.com/LiaScript/docs/blob/268a01bafc48fc4f1b07a5d78817f3c9212a49dd/README.md)
entwickelt: Makros ab Zeile 9768, Quizformen ab Zeile 3495 und Codeblöcke um Zeile 1990.
Verwendeter lokaler Dokumentationsstand: Commit
`268a01bafc48fc4f1b07a5d78817f3c9212a49dd`, synchronisiert am 8. September 2026.

VS-Code-Grundlagen:
[Syntax Highlight Guide](https://code.visualstudio.com/api/language-extensions/syntax-highlight-guide),
[Programmatic Language Features](https://code.visualstudio.com/api/language-extensions/programmatic-language-features).

Die VS-Code-/TextMate-Testfixtures behalten ihre ursprünglichen Lizenzhinweise.
Für den eigenen Projektcode ist noch keine Veröffentlichungslizenz festgelegt
(`UNLICENSED`).
