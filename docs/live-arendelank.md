# Live ärendelänk

**Version 1.0 · Byggd. Länken ÄR ärendet - alltid aktuell.**

## Visionen

Varje ärende kan få unika, säkra live-länkar. En länk representerar
ärendet och visar dess NULÄGE varje gång den öppnas - det finns ingen
rapport som måste skapas manuellt, för rapporten är alltid aktuell.
En källa till sanningen för kretsen: revisor, jurist, styrelse, bank,
försäkringsbolag, leasingbolag, finansiär.

## Delningsnivåer

* **Översiktsvy** - lägesbedömning, lägesbild och bevakade datum.
  Inga dokument.
* **Fullständig vy** - även handlingarna med granskningsstatus.

Varje länk är:

* **tidsbegränsad** (30 dagar i betan),
* **återkallbar** när som helst - nästa öppning möts av samma tystnad
  som en okänd länk,
* **åtkomstloggad** - varje öppning lämnar spår som ägaren ser,
* lika **tyst** för okända, utgångna och återkallade länkar, så att
  länkar inte kan användas för att sondera vilka ärenden som finns.

Live-länken är delning och ligger därför bakom samma betalvägg som
inbjudningarna (aktiveras efter första betalningen).

## Säkerhetsmodellen, medvetet tudelad

En **inbjudan** ger medlemskap - adressen är nyckeln, länken är det
aldrig. En **live-länk** ger scopad LÄSNING av ett utsnitt - där är
länken bäraren, och skyddet ligger i tidsgränsen, återkallbarheten
och loggningen. Två olika verktyg för två olika behov; ingen av dem
lånar den andras regler.

## Maskinläsbart format

Samma ärende, samma datamodell, som JSON - direkt från mottagarvyn
("Hämta som JSON"). Externa system kan importera arbetsloggen, koppla
informationen till egna processer och automatisera sin handläggning.
PDF (rapporten), HTML (vyn), JSON (länken + aktexporten) och ICS
(fristerna) bygger alla på samma underliggande modell.

## Gränsen: data, aldrig bedömningar

CLEARANCE levererar en strukturerad, spårbar och väldokumenterad
ärendedatamodell - **inte** automatiska bedömningar av mottagarens
frågor. Ett försäkringsbolag kan låta sitt eget system analysera
underlaget enligt sina interna regler; en bank prövar kreditfrågan
med sin egen modell. Det är mottagarens system som avgör hur
informationen används. Det står i mottagarvyns fot, ordagrant:
"Slutsatser dras av mottagaren."

## Framtida ekosystem

Modellen öppnar för aktörer som bygger egna lösningar ovanpå
ärendedatan - utan att plattformen blir beroende av någon enskild
aktörs arbetsflöde. Nästa steg när behovet bevisats: API-nycklar per
mottagare, lösenordsskydd per länk, webhooks vid ärendehändelser och
fler vyer (styrelsevy, tillverkar-/partnervy).
