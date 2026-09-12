# Validierung

Aktueller Nachtest: [Highlighting-Korrektur 0.1.4](reports/highlighting-0.1.4.md)
mit 113 automatisierten Tests und 11 VS-Code-Integrationstests.

## Bisheriger Gesamtstand 0.1.2

Geprüft am 12. September 2026 unter Windows mit Node.js 24.14.0,
TypeScript 5.9.3 und VS Code 1.137.0
(Commit `645f29cc3176500b4b5762ba887cf2a7f0ffdf2c`).

## Automatisierte Tests

- **45 Prüfkern-Tests bestanden:** Makro- und Kommentargrenzen, lokale Köpfe,
  verschachtelte Codebeispiele, Skripte, HTML-Attribute, native Quizsyntax,
  Regelunterdrückung, Schweregrade, CRLF und UTF-16-Positionen.
- **38 Tokenizer-Tests bestanden:** reale TextMate-/Oniguruma-Token mit den
  originalen Markdown-, HTML-, JavaScript-, CSS- und LaTeX-Grammatiken.
- **12 CLI-Tests bestanden:** rekursive Suche, Dateiauswahl, Ausgabepositionen,
  Fehlercodes, Regeloptionen, JSON und Überspringen von Verzeichnisverknüpfungen.
  Der Verknüpfungstest verwendet das lokale temporäre Dateisystem, weil das
  Netzlaufwerk keine Test-Junctions unterstützt.

- **3 Audit-Tests bestanden:** wörtliche einzelne Backticks, Absatzgrenzen und
  weiterhin geschützte mehrzeilige Makroargumente.

Aufruf: `npm test`. Insgesamt **98 erfolgreiche Tests**, keine ausgelassenen Fälle.

## Integration mit VS Code

`npm run test:integration` startet das installierte VS Code mit einem eigenen
temporären Benutzerprofil und einem eigenen Erweiterungsverzeichnis.

**11 Integrationstests bestanden:**

1. Automatische LiaScript-Erkennung in Markdown und deutsche Diagnose.
2. Korrekturvorschlag über die echte Code-Action-API anwenden.
3. Zwischen LiaScript- und Markdown-Sprachmodus wechseln.
4. Schweregrad und Regeln ohne Neustart ändern.
5. Automatische Prüfung deaktivieren und trotzdem manuell prüfen.
6. Gewöhnliche Markdown-Codebeispiele ausnehmen.
7. Markdown-Prüfung abschalten und den expliziten LiaScript-Modus weiter prüfen.
8. Dokumentgröße begrenzen und Prüfung nach Konfigurationsänderung fortsetzen.
9. Schnelle Änderungen ohne veraltete Diagnosemeldungen verarbeiten.
10. Nach einem LLMQuiz-Codeblock die Diagnose im folgenden Abschnitt erhalten.
11. Diagnosemeldungen beim Schließen aufräumen.

Das Laufprotokoll liegt lokal unter `.test-output/vscode/host.log`.

## Referenzdateien

- `examples/valid.lia.md` und `examples/llmquiz.lia.md`: **keine Befunde**.
- `examples/invalid.lia.md`: die vier beabsichtigten Meldungen
  **LS003**, **LS002**, **LS006** und **LS004**.
- Alle 1.616 Markdown-Dateien aus Aufgabensammlung und Wochenaufgabe: **keine Befunde**.
  Revisionen und Einzelnachweise stehen im [Korpusbericht](reports/corpus-audit.md).

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
