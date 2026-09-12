# Highlighting-Korrektur 0.1.4

Geprueft am 12. September 2026.

## Ursache und Korrektur

Der Screenshot-Ausschnitt wurde als Regression rekonstruiert. In der bisherigen
Standard-Markdown-Grammatik wird die Startzeile mit Backticks im LLMQuiz-Argument
als Inline-Code gelesen. Die eigentlich schliessende Codeblockzeile startet dann
einen neuen Block und verdeckt die Einfaerbung des folgenden Abschnitts.
Im LiaScript-Sprachmodus bestand der genaue Ausschnitt bereits vor der Korrektur.

Eine eigene, in package.json fuer text.html.markdown registrierte Injection nutzt
nun die vorhandenen LiaScript-Regeln fuer Makroargumente und Codeblockgrenzen.
Sie greift bei Backticks in Makroannotationen und hoechstens drei fuehrenden
Leerzeichen. Vollstaendig eingerueckte Markdown-Codebeispiele bleiben literal.
Der Sprachmodus wird nicht umgestellt.

Zusaetzlich werden vollstaendige einzeilige div- und section-Tags im
LiaScript-Modus begrenzt behandelt. Dadurch beendet eine Leerzeile im folgenden
Codeblock nicht mehr versehentlich einen uebergeordneten HTML-Zustand.

## Nachweise

- `npm test`: 113 von 113 Tests bestanden, keine ausgelassenen Tests.
- Darin 53 TextMate-/Oniguruma-Grammatiktests, davon 15 neue Regressionen.
- `npm run test:integration`: 11 von 11 Tests im isolierten VS-Code-Profil bestanden.
- Screenshot-Ausschnitt in Markdown und LiaScript mit LF und CRLF geprueft.
- Folge-HTML, Ueberschriften, Animationen und Quizze erhalten ihre erwarteten
  Token entsprechend dem jeweiligen Sprachmodus.
- Einfache und dreifache Backtick-Argumente, laengere Backtick-/Tilde-Abschluesse,
  JavaScript und offene JavaScript-Kommentare bzw. Template-Strings geprueft.
- Acht negative Markdown-Beispiele haben mit und ohne Injection identische Token:
  normale Formatierung, laengere aeussere Codebloecke, Inline-Code, eingerueckter
  Code, Script, Style, HTML-Kommentar und bereits offener Text-Codeblock.
- Zusaetzlicher unabhaengiger Test mit den installierten VS-Code-Grammatiken
  unter `645f29cc31/resources/app/extensions` bestaetigt die Screenshot-Korrektur
  und unveraenderte Markdown-Codebeispiele.

Der fruehere Gesamtkorpustest in corpus-audit.md dokumentiert Version 0.1.2;
er wurde fuer diesen gezielten Nachtest nicht wiederholt. Eine Sichtpruefung
im konkreten geoeffneten Kurs des Nutzers ist nicht Teil dieses Nachweises.
