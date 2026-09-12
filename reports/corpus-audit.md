# Korpusprüfung: LiaScript Linter 0.1.2

Am 12. September 2026 wurden alle **1.616 Markdown-Dateien mit 428.682 Zeilen** aus beiden Sammlungen geprüft. Zwei echte Highlighting-Abrisse bis zum Dateiende und weitere lokale Farblücken wurden in der Erweiterung korrigiert. Im abschließenden automatisierten Durchlauf bleiben **keine Abrisse bis zum Dateiende, keine Tokenizer-Zeitabbrüche und keine ungeklärten Prüfkandidaten**.

## Umfang und Stand

| Repository | Dateien | Commit |
| --- | ---: | --- |
| Aufgabensammlung | 1316 | [10ad35b87de1](https://github.com/MINT-the-GAP/Aufgabensammlung/tree/10ad35b87de13f852c1f09adee62ee7bd0570d0d) |
| Wochenaufgabe | 300 | [248cf01ce362](https://github.com/MINT-the-GAP/Wochenaufgabe/tree/248cf01ce3629b4981e8cd1d8cdc1fb6d928c0f6) |

Der lokale Wissenskorpus wurde vor der Prüfung aktualisiert. Alle `.md`-Dateien wurden einbezogen, auch Archive, Import-READMEs und Erklärungen. Pfade und SHA-256-Werte stimmen für jede Datei mit den Repository-Manifesten überein. Zwischen Vorher- und Nachherlauf sowie Linterprüfung wurden keine Kursdateien verändert.

## Ergebnisse

| Prüfung | Ergebnis |
| --- | --- |
| Tokenisierung jeder Zeile | 1616 Dateien / 428682 Zeilen |
| Unabhängige Syntax-Prüfpunkte | 117708 |
| Dateien mit Abriss bis zum Dateiende | 2 vorher / 0 nachher |
| Wieder erkannte Prüfpunkte | 5024 in 408 Dateien |
| Verbleibende eingeordnete Hinweise | 16 Formeln in Markdown-Bildbeschreibungen |
| Tokenizer-Zeitabbrüche / Lesefehler | 0 / 0 |
| Linter LS001 bis LS006 | 1616 Dateien / 0 Diagnosen |
| Probeweise angehängter Linterfehler | 1616 von 1616 am erwarteten Offset erkannt |
| Codeblockgrenzen und unmittelbare Fortsetzung | 245 Blöcke / 0 Fehler |
| Davon Makrotitel mit Backticks | 84 Blöcke / 0 Fehler |
| Vergleich nativer Sprachfarben | 45 Blöcke / 31143 Tokenpositionen / 0 Verluste |

Die Vorhermessung verwendet die unveränderten Grammatiken aus dem vorhandenen VSIX 0.1.1. Vorher- und Nachhermessung verwenden dieselbe verbesserte Prüfheuristik. Rohhinweise sind nicht mit unabhängigen Fehlerursachen gleichzusetzen: Ein einzelner falscher Zustand kann viele nachfolgende Prüfpunkte betreffen.

## Bestätigte Fundstellen und Korrekturen

### Quizplatzhalter

[Aufgabensammlung/imports/FreezeREADME.md:359](https://github.com/MINT-the-GAP/Aufgabensammlung/blob/10ad35b87de13f852c1f09adee62ee7bd0570d0d/imports/FreezeREADME.md#L359)

Unterstriche in `[[___ ___ ___ ___]]` öffneten verschachtelte Markdown-Fettschrift. Dadurch blieben folgende Makros und Überschriften bis zum Dateiende im Quizzustand. Platzhalter erhalten jetzt eine eigene Regel.

### Codeblock in HTML

[Wochenaufgabe/Alt/ProbeLKPhysik.md:331](https://github.com/MINT-the-GAP/Wochenaufgabe/blob/248cf01ce3629b4981e8cd1d8cdc1fb6d928c0f6/Alt/ProbeLKPhysik.md#L331)

Eine Leerzeile innerhalb des TikZ-Blocks beendete den umgebenden Markdown-HTML-Zustand. Die Abschluss-Backticks in Zeile 393 begannen dadurch einen neuen Block bis zum Dateiende. Einzeilige center-Tags verschlucken den Codeblock jetzt nicht mehr.

### Überschrift nach Bildern

[Aufgabensammlung/Folgen/Aufgabe_0001.md:57](https://github.com/MINT-the-GAP/Aufgabensammlung/blob/10ad35b87de13f852c1f09adee62ee7bd0570d0d/Folgen/Aufgabe_0001.md#L57)

Die Überschrift in Zeile 58 unmittelbar nach zwei img-Tags blieb ungefärbt. Begrenzte einzeilige HTML-Tags lassen die folgende Überschrift wieder erkennen.

### Formeln mit Leerraum

[Wochenaufgabe/8/Mathematik/Lia8_012.md:211](https://github.com/MINT-the-GAP/Wochenaufgabe/blob/248cf01ce3629b4981e8cd1d8cdc1fb6d928c0f6/8/Mathematik/Lia8_012.md#L211)

Formeln mit Leerraum direkt nach dem öffnenden Dollarzeichen wurden teilweise als Fließtext interpretiert. Sie erhalten jetzt die mathematischen Syntaxbereiche.

### Eingerückter Vorlesetext

[Aufgabensammlung/Repetitorium/Erklaerungen/01_01_01_Addition.md:94](https://github.com/MINT-the-GAP/Aufgabensammlung/blob/10ad35b87de13f852c1f09adee62ee7bd0570d0d/Repetitorium/Erklaerungen/01_01_01_Addition.md#L94)

Eingerücktes `{{|>}}` wurde als gewöhnlicher Code behandelt. Der Vorlesemarker und die anschließenden Formeln werden jetzt als LiaScript erkannt.

### Quiz-Matrixkopf

[Wochenaufgabe/6/Mathematik/Lia6_03.md:1437](https://github.com/MINT-the-GAP/Wochenaufgabe/blob/248cf01ce3629b4981e8cd1d8cdc1fb6d928c0f6/6/Mathematik/Lia6_03.md#L1437)

Benachbarte Matrixspalten mit Formeln wurden als Markdown-Links interpretiert. Die Matrixspalten erhalten eigene Grenzen.

### Beträge in Tabellen

[Aufgabensammlung/01_Algebraische_Grundlagen/06_Parameter/Aufgabe_0009.md:74](https://github.com/MINT-the-GAP/Aufgabensammlung/blob/10ad35b87de13f852c1f09adee62ee7bd0570d0d/01_Algebraische_Grundlagen/06_Parameter/Aufgabe_0009.md#L74)

Die senkrechten Betragsstriche einer Formel wurden als Tabellengrenzen interpretiert. Vollständige Formeln werden innerhalb der Zelle geschützt.

### Eingerückte SVG-Beschriftungen

[Aufgabensammlung/Repetitorium/Erklaerungen/07_02_01_Baumdiagramme.md:330](https://github.com/MINT-the-GAP/Aufgabensammlung/blob/10ad35b87de13f852c1f09adee62ee7bd0570d0d/Repetitorium/Erklaerungen/07_02_01_Baumdiagramme.md#L330)

Eine eingerückte Leerzeile begann vor einer Formel in foreignObject einen Markdown-Codeblock. Leere Zeilen beginnen diesen Zustand jetzt nicht mehr; vollständige alleinstehende Formeln werden erkannt.

### Linter nach wörtlichem Backtick

[Aufgabensammlung/Repetitorium/Erklaerungen/01_07_01_Potenzen.md:152](https://github.com/MINT-the-GAP/Aufgabensammlung/blob/10ad35b87de13f852c1f09adee62ee7bd0570d0d/Repetitorium/Erklaerungen/01_07_01_Potenzen.md#L152)

Ein einzelner typografisch verwendeter Backtick konnte sich im Scanner mit einem späteren Makroargument paaren. Gewöhnlicher Inline-Code wird jetzt an Absatzgrenzen begrenzt. Die verdeckte LS006-Diagnose wurde an einer gezielten Abwandlung reproduziert und korrigiert; die Originaldatei selbst erzeugt keine Diagnose.

## Verbleibende begrenzte Darstellung

Die 16 verbleibenden Prüfhinweise betreffen Dollarformeln innerhalb von Markdown-Bildbeschreibungen in `Repetitorium/Erklaerungen/00_00_01_Mengen.md`. Diese Texte behalten den Markdown-Beschreibungsbereich; separate TeX-Farben innerhalb dieser Beschreibungen werden derzeit nicht angeboten. Die Einfärbung der folgenden Inhalte wird davon nicht beeinflusst. Alle Positionen stehen im [JSON-Bericht](corpus-audit.json).

## Prüfmethode und Aussagegrenzen

Verwendet wurden vscode-textmate 9.3.2, vscode-oniguruma 2.0.1 und die originalen Sprachgrammatiken der installierten VS-Code-Version 1.137.0 (Commit 645f29cc3176500b4b5762ba887cf2a7f0ffdf2c). Jede Zeile wurde mit fortlaufendem Tokenizerzustand verarbeitet. Ein unabhängiger Scanner setzt Prüfpunkte an erkennbaren Überschriften, Quizmarkern, Makros, Formeln und Animationen; Kommentare, Makrostrings und Codeblöcke werden dabei abgeschirmt. Am Dateiende wird nach Leerzeilen die Erkennung neuer Überschriften, Quizze und Makros geprüft.

Der zusätzliche Codeblocktest untersucht alle vollständigen physisch gefundenen Blöcke mit Sprachangabe, auch in dokumentierten Beispielen. Er prüft jeden nichtleeren Inhaltstoken und eine Überschrift unmittelbar nach dem Abschluss. Native Sprachfarben werden gegen die VS-Code-Markdown-Grammatik verglichen. Bei Backticks im Makrotitel wird nur für diesen Vergleich die Makroannotation aus der Baseline entfernt; die LiaScript-Seite erhält den Originaltitel. Alle 84 solchen Blöcke verwenden `text`, besitzen also keine zusätzliche native Sprachgrammatik. Auch ASCII, ABC und Maxima haben in dieser VS-Code-Installation keine native Einbettung.

Die Markdown-Grammatik referenziert auch optionale Erweiterungssprachen, die hier nicht installiert sind. Ihre Scope-Namen sind im JSON-Bericht aufgeführt; der Vergleich nativer Farben gilt für die tatsächlich vorhandenen Einbettungen.

Die Prüfung kontrolliert Syntaxbereiche im Editor und gezielte Strukturregeln. Sie ist kein Screenshotvergleich aller Themes und keine Browserprüfung gerenderter Kurse. Externe Importe werden nicht aufgelöst, Makros nicht expandiert und Kursskripte nicht ausgeführt. Automatische Prüfpunkte sind eine Heuristik; ein grüner Lauf belegt die geprüften Eigenschaften am angegebenen Stand und keine vollständige LiaScript-Implementierung.

## Nachvollziehen und wiederholen

- [Maschinenlesbarer Bericht mit allen 1616 Dateipfaden und Hashes](corpus-audit.json)
- [Einzelergebnisse aller 245 Codeblockprüfungen](fence-audit.json)
- [Wiederholbare Auditaufrufe](../README.md#gesamttest-der-kurssammlungen)
- [Unit- und VS-Code-Integrationstests](../TESTING.md)
