<!--
language: de
version: 0.1.1
comment: Technische Beispiele zur Einfärbung von Makroargumenten und LLMQuiz-Codeblöcken.
import: https://raw.githubusercontent.com/MINT-the-GAP/lia-llm/76c1ab5c9361f166b1563c1c796699ea26361645/README.md

@Echo: @0
-->

# Backticks und Makroklammern

Diese Datei zeigt die Grenzen zwischen Makroargumenten und Codeblöcken.
Der Linter prüft ausschließlich den Quelltext und startet keine LLM-Auswertung.

## Ein Backtick im Aufgabenwortlaut

Erkläre, warum bei 2 * (3 + 4) die Klammer zuerst berechnet wird.

<!-- data-solution-button="off" data-llm-textarea="5" -->
[[Antwort]]
```text @LLMQuiz(0.66;solution=1;feedback=1,`Erkläre die Reihenfolge bei 2 * (3 + 4), und nenne das Ergebnis.`)
Die Klammer legt fest, dass zuerst 3 + 4 = 7 berechnet wird.
Danach ergibt 2 * 7 den Wert 14.
```

## Drei Backticks im Aufgabenwortlaut

Erkläre die Reihenfolge bei 3 * (2 + 5).

<!-- data-solution-button="off" data-llm-textarea="5" -->
[[Antwort]]
```text @LLMQuiz(0.66;solution=1;feedback=1,```Erkläre die Reihenfolge bei 3 * (2 + 5), und nenne das Ergebnis.```)
Zuerst wird die Klammer 2 + 5 = 7 berechnet.
Danach ergibt 3 * 7 den Wert 21.
```

## Mehrzeiliges Makroargument

@Echo(```Dieser Text gehört zum Makroargument.

Eine Klammer ) und ein Komma, beenden das Argument nicht.
Auch `einzelne Backticks` dürfen darin vorkommen.
```)

## Nach dem Makro

**Diese Überschrift und dieser Text sollen wieder normal hervorgehoben sein.**

Welche Zahl ergibt 3 * (2 + 5)?

[( )] 11
[(X)] 21

```javascript
const result = 3 * (2 + 5);
```
