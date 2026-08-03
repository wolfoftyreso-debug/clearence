# PILOTPROGRAM – CLEARANCE V1.0

**Landvex AB** · Arbetsdokument, internt
**Plats i ordningen:** Control Plan → Revenue Architecture → Economic Model → Intervjuguider → **PILOT** → Prissättning v1.0

---

## 0 · Vad piloten är till för

Piloten har ETT jobb: **ersätta antaganden med mätdata.** Economic Model
§8 listar exakt vilka. Allt annat - referenskunder, berättelser,
produktpolering - är bieffekter, välkomna men inte målet.

Piloten är inte en lansering. Den är den sista kontrollerade miljön där
fel är billiga. Därför hålls den liten, tidsbegränsad och mätbar, och
därför avslutas den med ett beslutsdokument, inte med en glidning in i
drift.

**Inga avgiftsnivåer står i det här dokumentet.** Nivåerna under piloten
sätts av driften ur betalningsviljestudiens intervall (beslutsreglerna i
intervjuguidernas §5) och läggs in som parametrar i systemet - aldrig i
kod, aldrig i det här dokumentet.

---

## 1 · Förutsättningar före start (blockerare)

| # | Förutsättning | Status | Ägare |
|---|---|---|---|
| F1 | Momsregistrering och F-skatt för Landvex AB | ⬜ Blockerar ALL fakturering | Ägaren |
| F2 | Bankgiro (plusgiro finns) | ⬜ Fakturors betalväg | Ägaren |
| F3 | Insolvensrättslig prövning av produktens texter och gränser | ⬜ Före första skarpa ärendet | Extern jurist |
| F4 | Pilotavtal (bilaga A) och personuppgiftsbiträdesavtal granskade | ⬜ | Extern jurist |
| F5 | Betalningsviljestudien genomförd, intervallen dokumenterade | ⬜ Guider klara | Driften |
| F6 | Creditsafe-avtal (pilotvolym räcker: 1 slagning/bolag/dygn) | ⬜ Största rörliga posten | Driften |
| F7 | Självhostad miljö driftsatt och RLS-sviten grön mot den | ✅ Båda miljöerna testas löpande | Byggt |

Utan F1–F4 startar ingen pilot med betalande part. En pilot **utan
debitering** (se 3.2, spår A) kan starta på F3–F5 och köra medan F1–F2
ordnas - fakturering aktiveras mitt i piloten när gaten öppnats.

---

## 2 · Urval och rekrytering

**Företag: 10–15 stycken.** Källor: betalningsviljestudiens respondenter
(fråga 22), revisorers och rekonstruktörers egna klientstockar (byråerna
i piloten rekryterar), samt direktkontakt i register över bolag med
betalningsanmärkningar (etiskt: erbjudande om hjälp, aldrig skrämsel -
"Vi säljer inte rädsla. Vi säljer kontroll").

Segmentmix som i intervjuurvalet: akut kris, nyligen ur kris, riskzon.
Minst tre ägarledda 5–15-anställda - kärnsegmentet.

**Byråer: 3–5 stycken.** Minst en rekonstruktör, en obeståndsjurist och
en revisorsbyrå. Hellre tre engagerade än fem passiva; varje byrå får en
namngiven kontakt hos driften.

**Diskvalificerande:** bolag där konkurs redan är oundviklig och nära
förestående (piloten får inte bli en sista utväg som fördröjer
nödvändiga beslut), samt byråer som kräver exklusivitet.

---

## 3 · Erbjudandet under piloten

### 3.1 Vad deltagarna får

- Full produkt, alla roller: företagsvyn, klientverktygen, byråteamet.
- Namngiven kontakt och prioriterad felrättning.
- Skriftlig sammanfattning av pilotens resultat för egen del.
- Pilotpris efter piloten: den som bär pilotens friktion ska inte mötas
  av full prislista dagen efter. Formen (rabatt eller bunden period till
  pilotvillkor) beslutas av driften före start och skrivs in i
  pilotavtalet - inte här.

### 3.2 Två debiteringsspår

**Spår A – mätpilot (utan debitering).** Företagssidan kostnadsfri hela
piloten. Byråernas upplåsningar registreras som vanligt i
`usage_charges` men faktureras inte ("skuggdebitering"): varje händelse
prissätts med pilotparametrarna och visas för byrån i
debiteringsöversikten, så att betalningsviljan prövas mot en synlig
siffra - utan att F1–F2 blockerar starten.

**Spår B – skarp pilot.** När F1–F2 är klara aktiveras fakturering med
pilotparametrarna: samlingsfaktura månadsvis med full specifikation,
faktura först, kreditlagret fortsatt vilande. Skuggdebiterade händelser
från spår A efterfaktureras INTE - de var mätdata, och det står i
avtalet.

**G6 gäller även i pilot:** ingen debitering utlöses av att en kund
misslyckas. Avgifter pausas i vilande ärenden och upphör vid konkurs.

### 3.3 Motprestationer (skrivs in i pilotavtalet)

1. Startintervju och slutintervju (guiderna, förkortade).
2. Samtycke till att användningsdata analyseras aggregerat.
3. Exitorsak registreras vid varje ärendeavslut - det är North
   Star-mätningen, och den är obligatorisk i piloten.
4. Fel rapporteras i produkten eller till kontakten, inte i efterhand.

---

## 4 · Mätplanen: antagande → mätpunkt

Allt nedan finns redan byggt om inte annat anges.

| EM-antagande | Mäts genom | Mätpunkt |
|---|---|---|
| V (värdehändelser/ärende) | Upplåsningar, dokument, rapporter per ärende | `usage_charges`, händelseloggen |
| f (andel förfrågningar → upplåsning) | Kontaktförfrågans tratt | `contact_requests` status |
| Tid till upplåsning | Tidsstämplar i samma tratt | `contact_requests` |
| L_kris (ärendets livslängd) | Skapad → avslutad med orsak | `cases` + exitorsak |
| Andel lyckade utfall, k (hälsonivån) | Exitorsaker + hälsoläge | `north_star_counts()` |
| A-/U-nivåernas acceptans | Skuggdebitering + faktisk betalning + slutintervju | `usage_charges`, reskontran, intervju |
| Persontid per granskning | Manuell loggning per händelse | Driftens anteckning (räcker för pilot) |
| c_cs (Creditsafe) | Avtalsfakturor under piloten | Leverantörsfakturor |

**Veckorytm:** driften läser Statistik + North Star-raden varje måndag
och för pilotlogg (avvikelser, citat, incidenter). Ingen ny
instrumentering byggs för detta - finns talet inte i driftpanelen är det
ett byggärende, inte ett kalkylblad.

---

## 5 · Framgångskriterier: gaten till Prissättning v1.0

Piloten är lyckad när ALLA fyra är sanna:

1. **Trattdata:** minst 20 kontaktförfrågningar totalt och minst 10
   upplåsningar, så att f och tid-till-upplåsning har substans.
2. **Utfallsdata:** minst 5 ärenden avslutade med registrerad exitorsak,
   varav minst 1 North Star-utfall (stabiliserad eller genomförd
   rekonstruktion).
3. **Betalningsdata:** i spår B minst en full faktureringscykel där
   samtliga byråfakturor betalats utan tvist - eller i spår A dokumenterad
   acceptans av skuggbeloppen i slutintervjuerna.
4. **Inga röda flaggor:** ingen av intervjuguidernas tre stoppflaggor
   (utnyttjandekänsla, dold provision, datamisstro) har uppstått olöst.

Uppfylls kriterierna skrivs **Prissättning v1.0** med pilotens siffror
i stället för Economic Models antaganden. Uppfylls de inte förlängs
piloten EN gång (max halva ursprungstiden) med åtgärdslista - eller
avbryts med en ärlig skrivning om varför.

---

## 6 · Tidsplan

| Vecka | Fas |
|---|---|
| −4 – 0 | F1–F6 stängs; betalningsviljestudien; pilotparametrar sätts |
| 0 | Start spår A: onboarding av byråer, första företagen |
| 1–4 | Full drift; veckorytm; F1–F2 klara → spår B aktiveras |
| 5–10 | Full drift med debitering; minst en hel faktureringscykel |
| 11–12 | Slutintervjuer; pilotlogg stängs; kriterierna prövas |
| 13 | Beslutsdokument: Prissättning v1.0 påbörjas, förlängs eller avbryts |

Tolv veckor är ett tak, inte ett mål - kriterierna kan stängas tidigare.

---

## 7 · Risker specifika för piloten

| Risk | Hantering |
|---|---|
| Ett pilotbolag går i konkurs under piloten | Väntat i segmentet. Exitorsaken ÄR mätdata; G6 gör att ingen skuld jagas. Mänskligt: avslutssamtal, akten exporteras åt dem |
| Byrå behandlar piloten som gratis leadkanal utan återkoppling | Motprestationerna i avtalet; en varning, sedan ersätts byrån |
| För få förfrågningar för trattdata | Rekryteringskällorna breddas v.4 om <5 förfrågningar; kriterium 1 hellre försenat än urvattnat |
| Skuggbelopp uppfattas som lurendrejeri | Sägs rakt ut vid onboarding: "detta hade kostat X - vi mäter, ni betalar inget i spår A" |
| Incident med skarp ärendedata | Incidentrutin före start: driften kan inte läsa ärenden (RLS), men mejl/nycklar kan fela - loggvyn och utkorgen är första blicken |

---

## 8 · Efter piloten

- Pilotdeltagare behåller sina konton och sin data oavsett utfall -
  akten är deras, exporten finns, ingenting raderas.
- Övergång till ordinarie villkor sker med skriftligt besked och minst
  30 dagars varsel; pilotpriset enligt 3.1 gäller från dag ett av
  ordinarie drift.
- Beslutsdokumentet efter §5 blir underlaget till Prissättning v1.0 -
  sista steget i prioriteringsordningen, och först där sätts publika
  nivåer.

---

*Arbetsunderlag för Landvex AB. Bilaga A (pilotavtal) och B
(personuppgiftsbiträdesavtal) tas fram med extern jurist enligt F3–F4
och ingår inte i detta dokument.*
