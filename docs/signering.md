# Signering

**Version 1.0 · Byggd. BankID är bortvalt.**

## Beslutet

BankID kräver avtal via bank eller återförsäljare, kostar per signering
och skulle ha hållit signeringsfunktionen låst tills någon annan sa ja.
En produkt vars kärnfunktion väntar på en tredje part är inte en produkt.

Så vi byggde det själva — och frågade först vad BankID egentligen köper
oss. Svaret är **en koppling mellan en person, ett exakt innehåll och en
exakt tidpunkt, som går att kontrollera i efterhand.** Den kopplingen går
att bygga utan leverantör. Det som INTE går att bygga själv är
legitimationskontrollen, och det säger vi rakt ut i stället för att
antyda motsatsen.

## Vad en signatur består av

Fyra delar. Var för sig svaga, tillsammans ett användbart bevis.

| Del | Hur | Varför just så |
|---|---|---|
| **Vem** | Kontot (adressen verifierad vid inloggning) plus namnet personen skriver in | Namnfältet är **tomt** med flit. Ett förifyllt namn som ingen rör gör signeringen till ett klick igen |
| **Vad** | SHA-256 av innehållet, uträknad i webbläsaren ur de bytes vi faktiskt visar | Det som förseglas är handlingen, inte en rad i en tabell |
| **När** | Serverns tid | En tidsstämpel klienten kan sätta är inte bevis på någonting |
| **Vad man intygade** | Den exakta texten, kopierad in i raden och versionerad | "Jag godkände något" är värdelöst om ingen kan visa vad som stod |

## Det som gör hashen värd besväret

Efterhandskontrollen. När signaturen visas räknas kontrollsumman om ur
det innehåll som ligger där **nu** och jämförs med det som förseglades:

* **Innehållet är oförändrat sedan signeringen** — det vanliga fallet.
* **Innehållet har ändrats efter signeringen** — signaturen blir inte
  ogiltig. Den betyder att någon signerade något annat än det som ligger
  där nu, och det är en helt annan sak att berätta för användaren.
* **Kan inte kontrolleras i den här sessionen** — bytes saknas. Vi
  gissar inte.

## Räckvidden, ordagrant

Enkel elektronisk signatur enligt **eIDAS artikel 3.10**. Den får inte
förvägras rättslig verkan enbart för att den är elektronisk (artikel
25.1), och svensk rätt tillämpar fri bevisprövning. Bevisvärdet är
samtidigt lägre än vid en avancerad eller kvalificerad signatur.

Tre begränsningar står i gränssnittet **före** signeringen och på
intyget:

1. Identiteten bygger på inloggningen till kontot, inte på legitimation.
2. Detta är en enkel elektronisk signatur — inte BankID, och inte en
   avancerad eller kvalificerad signatur.
3. Där lag kräver en viss form, som vid bevittnad namnteckning, räcker
   den inte.

**Ärligheten är funktionen.** Produkten används av människor med
juridiskt ansvar. Att låta dem tro att det här är BankID vore värre än
att inte erbjuda signering alls.

## Reglerna i databasen

* Signering går **enbart** genom `sign_document()`. Ingen insert-policy
  finns: en klient som får välja hash själv utan behörighetsprövning kan
  försegla vad som helst i någon annans namn.
* Bara kretsens roller kan signera. **En borgenär kan aldrig signera
  bolagets handlingar.**
* **Ett utkast kan inte signeras.**
* En person signerar ett dokument **en gång**. Annars vore "senaste
  signaturen" ett sätt att skriva om historien.
* Raden är **oföränderlig och raderas aldrig** — skyddet är dubbelt: RLS
  har varken update- eller delete-policy, och en trigger stoppar den som
  ändå tar sig förbi.
* Varje signering **journalförs**. En signatur som inte syns på
  tidslinjen har inte hänt, ur användarens synvinkel.

## Signaturen och granskningsstämpeln är olika saker

De grindar med flit inte varandra:

* **Granskningen** (Utkast → För granskning → Godkänt) är rådgivarens
  kvalitetskontroll.
* **Signaturen** är undertecknarens egen viljehandling.

Att kräva rådgivarens stämpel före signaturen vore att låta rådgivaren
grinda styrelsens egna beslut — tvärtemot löftet om att viktiga
affärsbeslut alltid är användarens.

## Signeringsintyget

Beviset man kan ta med sig, som PDF ur samma dokumentmotor som övriga
rapporter: handlingen, den förseglade kontrollsumman, varje
undertecknare med tidpunkt och innehållskontroll, intygstexten
ordagrant, och räckvidden. Foten säger rakt ut att intyget **inte**
styrker undertecknarens identitet på det sätt en legitimationskontroll
gör.

## Om kravet på mer skulle komma

En avancerad eller kvalificerad signatur blir då ett eget beslut med egen
kostnad — inte något plattformen väntar på för att kunna leverera
signering alls. Datamodellen tål det: `statement_version` finns redan,
och en starkare signaturmetod blir en ny version, inte en ombyggnad.

---

*Efterlevnad i kod: `src/lib/signing.ts` (intygstext, hash, kontroll),
`supabase/migrations/20260816100000_document_signatures.sql` (reglerna),
`tests/signing.ts` (35 kontroller, inklusive att vi aldrig påstår
BankID-nivå), `tests/browser/verify-signering.mjs` (20 kontroller genom
hela flödet) och 10 RLS-tester i båda miljöerna. En regel som inte testas
är en åsikt.*
