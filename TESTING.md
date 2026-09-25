# Validierung

Aktueller Nachtest am 25. September 2026: **120 automatisierte Tests**
und **13 VS-Code-Integrationstests** bestanden.

## Bisheriger Gesamtstand 0.1.2

Geprüft am 12. September 2026 unter Windows mit Node.js 24.14.0,
TypeScript 5.9.3 und VS Code 1.137.0
(Commit `645f29cc3176500b4b5762ba887cf2a7f0ffdf2c`).

## Automatisierte Tests

- **50 Prüfkern-Tests bestanden:** Makro- und Kommentargrenzen, lokale Köpfe,
  verschachtelte Codebeispiele, Skripte, HTML-Attribute, native Quizsyntax,
  LS007 samt LiaScript-bewusster Gliederung, Regelunterdrückung, Schweregrade,
  CRLF und UTF-16-Positionen.
- **55 Tokenizer-Tests bestanden:** reale TextMate-/Oniguruma-Token mit den
  originalen Markdown-, HTML-, JavaScript-, CSS- und LaTeX-Grammatiken.
- **12 CLI-Tests bestanden:** rekursive Suche, Dateiauswahl, Ausgabepositionen,
  Fehlercodes, Regeloptionen, JSON und Überspringen von Verzeichnisverknüpfungen.
  Der Verknüpfungstest verwendet das lokale temporäre Dateisystem, weil das
  Netzlaufwerk keine Test-Junctions unterstützt.

- **3 Audit-Tests bestanden:** wörtliche einzelne Backticks, Absatzgrenzen und
  weiterhin geschützte mehrzeilige Makroargumente.

Aufruf: `npm test`. Insgesamt **120 erfolgreiche Tests**, keine ausgelassenen Fälle.

## Integration mit VS Code

`npm run test:integration` startet das installierte VS Code mit einem eigenen
temporären Benutzerprofil und einem eigenen Erweiterungsverzeichnis.

**13 Integrationstests bestanden:**

1. Document Symbols und Folding Ranges für `Wurzelfach` und `Aufgabe 3`
   trotz der CommonMark-inkompatiblen LLMQuiz-Öffnungszeile bereitstellen.
2. Syntaxfarben ohne Projekteinstellungen als VS-Code-Vorgabe laden.
3. Automatische LiaScript-Erkennung in Markdown und deutsche Diagnose.
4. Korrekturvorschlag über die echte Code-Action-API anwenden.
5. Zwischen LiaScript- und Markdown-Sprachmodus wechseln.
6. Schweregrad und Regeln ohne Neustart ändern.
7. Automatische Prüfung deaktivieren und trotzdem manuell prüfen.
8. Gewöhnliche Markdown-Codebeispiele ausnehmen.
9. Markdown-Prüfung abschalten und den expliziten LiaScript-Modus weiter prüfen.
10. Dokumentgröße begrenzen und Prüfung nach Konfigurationsänderung fortsetzen.
11. Schnelle Änderungen ohne veraltete Diagnosemeldungen verarbeiten.
12. Nach einem LLMQuiz-Codeblock LS007 und die Diagnose im folgenden Abschnitt erhalten.
13. Diagnosemeldungen beim Schließen aufräumen.

Das Laufprotokoll liegt lokal unter `.test-output/vscode/host.log`.

## Referenzdateien

- `examples/valid.lia.md`: **keine Befunde**.
- `examples/llmquiz.lia.md`: LS007 dokumentiert bewusst die
  CommonMark-Inkompatibilität der vorhandenen LLMQuiz-Startzeilen.
- `examples/invalid.lia.md`: die vier beabsichtigten Meldungen
  **LS003**, **LS002**, **LS006** und **LS004**.
- Der historische Sechs-Regeln- und Highlighting-Stand für 1.616 Markdown-Dateien
  steht im [Korpusbericht](reports/corpus-audit.md). LS007 ist eine neue,
  beabsichtigte Warnung für dort vorhandene CommonMark-inkompatible Startzeilen.

Die Kursreferenzen werden nicht mit dem Projekt verteilt. Die Tests enthalten
kleine gezielte Syntaxfälle, die unabhängig von diesem lokalen Korpus ausführbar sind.

## Regression LLMQuiz und Backtick-Argumente

Vor der Korrektur schlugen die neuen Tokenizer-Tests für den folgenden Kursabschnitt
fehl. Nach der Korrektur bestehen sie für einfache und dreifache Backticks in
Codeblock-Startzeilen sowie für direkte mehrzeilige Makroargumente mit Klammern,
Kommas und verschachtelten Aufrufen. Weitere Tests schützen längere
Abschlussbegrenzungen und die Rückkehr aus unvollständigem eingebettetem JavaScript.

Unabhängig wurden die acht Originalaufgaben
`02_Geometrie/07_Kongruenz/Aufgabe_0021.md` bis `Aufgabe_0028.md`
aus MINT-the-GAP/Aufgabensammlung geprüft:
[Originalstand 10ad35b](https://github.com/MINT-the-GAP/Aufgabensammlung/tree/10ad35b87de13f852c1f09adee62ee7bd0570d0d/02_Geometrie/07_Kongruenz).
Alle acht Aufgaben erhalten nach dem LLMQuiz-Codeblock wieder die erwarteten
Makro-, Überschriften- und Quiz-Token und erzeugen keine Lintermeldungen.

Ein zusätzlicher Vergleich mit den tatsächlich installierten VS-Code-Grammatiken
bestätigt native JavaScript-/Python-Farben bei Backticks im Makrotitel und
unveränderte Java-/C++-/C#-/Ruby-Farben bei gewöhnlichen Makrotiteln.

Die neue Provider-Regression ruft
`vscode.executeDocumentSymbolProvider` und
`vscode.executeFoldingRangeProvider` mit dem Minimalbeispiel auf. Sie weist
`Wurzelfach`, `Aufgabe 3: Geometrie im Koordinatensystem` und den
Faltbereich nach der vermeintlichen Abschluss-Fence nach. Der gebaute Kern wurde
zusätzlich read-only gegen
`9/Mathematik/Lia9_01.md` aus Wochenaufgabe-Revision
`6f1bd72a951a1739e5fc93f13406e4e2c281073d` geprüft: LS007 liegt in
Zeile 583, die Gliederung enthält die Zeilen 616 und 626.

## Vollständiger Highlighting-Korpustest

**1.616 Dateien / 428.682 Zeilen / 117.708 Syntax-Prüfpunkte** wurden mit den
installierten VS-Code-Grammatiken tokenisiert. Abschließend bleiben keine
Zustandsabrisse bis zum Dateiende und keine Tokenizer-Zeitabbrüche.
16 eingeordnete Hinweise betreffen Formeln innerhalb von Markdown-Bildbeschreibungen;
die weitere Darstellung ist davon nicht betroffen.

Alle **245 vollständigen Codeblöcke mit Sprachangabe**, darunter 84 mit Backticks
im Makrotitel, bestehen die Prüfung ihrer Inhaltsgrenzen und der unmittelbar
folgenden Überschrift. In 45 Blöcken mit nativer Spracheinbettung wurden
31.143 Tokenpositionen verglichen; keine vorhandene Spracheinfärbung geht verloren.

Die neuen Regressionen schützen Quizplatzhalter, HTML-Tags, Formeln mit Leerraum,
Vorlesemarker, Quiz-Matrixköpfe, Betragsformeln in Tabellen und eingerückte
SVG-Beschriftungen. Ein zusätzlicher Linterfehler nach einem wörtlichen Backtick
wurde zuerst reproduziert und anschließend korrigiert.

[Fundstellen, Dateihashes, Methoden und Einschränkungen](reports/corpus-audit.md).

## Grenzen

Die Prüfungen decken die sechs dokumentierten Regeln ab. Ein dokumentierter Kurs ohne
Befunde belegt die Verträglichkeit mit diesen Beispielen, keine vollständige
Übereinstimmung mit dem LiaScript-Interpreter. Template-Importe werden nicht aufgelöst,
Makros nicht expandiert und Skripte nicht ausgeführt.

Die VS-Code-Integration wurde auf der oben genannten Windows-Version getestet.
Andere Betriebssysteme und ältere unterstützte VS-Code-Versionen wurden hier
nicht praktisch getestet. Der Quellcode verwendet die API-Typen von VS Code 1.96.
