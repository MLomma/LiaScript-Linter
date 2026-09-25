# Änderungen

## Unveröffentlicht

- LS007 warnt an der beabsichtigten Öffnungszeile vor Backticks in der
  Info-Zeile einer Backtick-Fence und erklärt den möglichen Gliederungsabbruch.
- LiaScript-bewusste Document-Symbol- und Folding-Range-Provider erhalten
  nachfolgende Überschriften für Dokumentgliederung, Faltung und Sticky Scroll.
- Ein automatischer Wechsel auf Tilde-Fences bleibt aus, weil der aktuelle
  LiaScript-Parser diese Fence-Form nicht unterstützt.

## 0.1.5

- Die Projekt-README enthält einen LiaScript-Header mit Autor, Version, Sprache, Sprecherstimme, Beschreibung, Logo/Icon, Repository und den bestehenden Lizenzhinweisen.

## 0.1.4

- Im LiaScript-Modus erhalten auch `div`- und `section`-Container Codeblockgrenzen bei Leerzeilen im Block.
- Codeblöcke mit `@LLMQuiz(...)` und Backticks im Makroargument werden auch im normalen Markdown-Sprachmodus korrekt geschlossen; folgende Abschnitte behalten ihre Syntaxfarben.
- Die Korrektur greift automatisch bei annotierten Codeblöcken; ein manueller Wechsel zum LiaScript-Sprachmodus ist dafür nicht mehr erforderlich.

## 0.1.3

- Das vorhandene Logo `lrLia.png` wird als Erweiterungssymbol in VS Code angezeigt.

## 0.1.2

- Quizplatzhalter mit Unterstrichen lassen die Einfärbung anschließender Inhalte nicht mehr hängen.
- Einzeilige HTML-Bilder und center-Tags erhalten LiaScript-Strukturen und Codeblockgrenzen im folgenden Inhalt.
- Formeln mit Leerraum direkt nach dem Dollarzeichen werden erkannt.
- Formeln und Makros bleiben in Quiz-Matrixköpfen, Tabellen mit Betragsstrichen, eingerückten Vorlesetexten und SVG-Beschriftungen erkennbar.
- Einzelne wörtliche Backticks verdecken im Linter keine Prüfstellen in späteren Absätzen mehr; mehrzeilige Makroargumente bleiben geschützt.
- Vollständiger Korpustest für Aufgabensammlung und Wochenaufgabe mit nachvollziehbarem Bericht und wiederholbaren Prüfskripten.

## 0.1.1

- LiaScript-Codeblöcke erkennen Makroaufrufe mit Backticks in der öffnenden Zeile,
  insbesondere `@LLMQuiz(...)`. Die schließenden Backticks beginnen keinen neuen Block mehr.
- Makroargumente erhalten eigene Grenzen für Klammern und Backtick-Strings,
  einschließlich mehrzeiliger Inhalte.
- Regressionstests prüfen, dass nach dem Makro normale Überschriften, Quizze und
  Codeblöcke wieder korrekt hervorgehoben und geprüft werden.
- Neue Beispieldatei `examples/llmquiz.lia.md`.

## 0.1.0

- LiaScript-Sprachmodus mit Markdown-Grundlage, Syntaxfarben und deutschen Snippets.
- Sechs statische Strukturregeln mit deutschen Diagnosemeldungen.
- Live-Prüfung in LiaScript sowie automatisch erkannten Markdown-Dokumenten.
- Korrekturvorschläge für ausgewählte fehlende Begrenzungen.
- Konfigurierbare Schweregrade und Unterdrückung einzelner Regeln im Dokument.
- Separater Prüfkern und CLI mit JSON-Ausgabe.
- Tests für gültige und fehlerhafte Syntax, Tokenisierung und Editorintegration.
