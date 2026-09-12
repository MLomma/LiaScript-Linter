<!--
language: de
version: 0.1.0
comment: Technische Beispieldatei für den LiaScript-Linter.

@hello: Hallo, @0!

@box
<div class="example-box">@0</div>
@end

@style
.example-box { border: 1px solid currentColor; padding: 1em; }
@media (max-width: 600px) {
  .example-box { padding: 0.5em; }
}
@end
-->

# LiaScript ausprobieren

Diese Datei zeigt Syntaxfarben und gültige Strukturen. Im LiaScript-Sprachmodus
stehen außerdem Vorlagen zur Verfügung: `lia-` tippen und Strg+Leertaste drücken.

@hello(Welt)

## Quiz

Welche Zahl ist gerade?

    [( )] 3
    [(X)] 4

Welche Zahlen sind Primzahlen?

    [[X]] 2
    [[X]] 3
    [[ ]] 4

Ergänze das Wort: Die Hauptstadt von Frankreich ist …

    [[Paris]]

## Makros und Animationen

@box(Dieser Text steht in einer Box.)

    {{1}}
Dieser Absatz erscheint im ersten Animationsschritt.

    --{{1}}--
Dieser Text gehört zur Sprachausgabe.

## Formeln und Code

Inline: $a^2 + b^2 = c^2$.

$$
\\sum_{k=1}^{n} k = \\frac{n(n+1)}{2}
$$

Die folgenden Zeichen sind ein Codebeispiel und sollen keine Lintermeldung auslösen:

````markdown
<!--
@absichtlichUnvollstaendig
```
````

`<!--` und `@end` im Fließtext sind ebenfalls Codebeispiele.

<script>
const message = "<!-- kein Dokumentkopf, sondern ein JavaScript-String";
message.length
</script>
