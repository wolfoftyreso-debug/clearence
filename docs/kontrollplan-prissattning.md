# CONTROL PLAN – CLEARANCE V1.0

## Kartläggning av tjänsten innan prissättning

**Roller:** Product Architect · Service Designer · CFO
**Mål:** Kartlägga hela plattformen så att en framtida prismodell kan byggas på fakta.
**Inte mål:** Att sätta ett pris.

**Metodnot som skiljer det här dokumentet från en skrivbordsprodukt:** allt nedan är
kartlagt mot den **byggda och testade plattformen** (databas, motorer, vyer,
fakturering), inte mot en tänkt produkt. Där något är förberett men inte aktivt
står det. Där något inte finns står det. En prismodell byggd på det här dokumentet
bygger på det som faktiskt levereras.

---

## DEL 1 · Kundresan

| # | Steg | Mål | Användarens känsla | Systemfunktioner (byggda) | Externa system | Personer |
|---|------|-----|--------------------|---------------------------|----------------|----------|
| 1 | Problemet uppstår | Inse att läget kräver handling | Oro, skam, "jag hoppas att jag gör rätt" | – (sker utanför systemet) | – | Företagaren, ofta ensam |
| 2 | Hittar CLEARANCE | Snabbt begripa vad tjänsten gör | Skepsis + hopp | Startsida i myndighetsuppställning, sök, kunskapsbank (källhänvisad, publik) | Sökmotorer | Företagaren |
| 3 | Gratis nulägesanalys | Få en ärlig lägesbild utan motprestation | Lättnad: "någon strukturerar detta" | Utvärderingsguiden (5–10 min, ingen inloggning), krisanalysmotorn, rapport som PDF | – | Företagaren |
| 4 | Registrering | Spara läget och aktivera ärendet | Beslut: "jag tar tag i det" | Konto, ärende skapas, autospar, gratisvecka startar | E-post (SES) | Företagaren |
| 5 | Identifiering | Veta vem som företräder bolaget | Trygghet | I dag: e-post + roller i ärendet. Förberett: BankID (nyckelplats i driftpanelen, avtal krävs) | BankID *(förberett)* | Företagaren |
| 6 | Import av data | Slippa skriva in det som redan finns | "Det gick fortare än jag trodde" | SIE-import → KBR-förifyllnad, dokumentuppladdning, skattekontoexport (manuell) | Fortnox/Visma *(förberedda)*, Skatteverket *(manuellt utdrag)* | Företagaren, ev. redovisningskonsult |
| 7 | Riskanalys | Veta exakt var bolaget står | "Nu förstår jag läget" | Systemanalysen (deterministisk, rollanpassad, 4 språknivåer, 3 visningsformer), KBR-bedömning, likviditetsprognos, täckningsgrad | Creditsafe *(daglig bevakning, nyckel krävs)* | Företagaren, styrelsen |
| 8 | Prioritering | Veta vad som är först | Kontroll ersätter panik | Frister med nedräkning + NÄRMAST-markering, notiscentret (aggregerar allt), handlingsplanens horisonter | – | Företagaren |
| 9 | Handlingsplan | Veta *hur*, inte bara *vad* | "Jag vet exakt vad som behöver göras" | Intelligenta uppgifter med spelböcker (varför/underlag/konsekvens/steg), autoslutförande, rådgivarmatchning med motivering | – | Företagaren, styrelsen |
| 10 | Genomförande | Utföra och dokumentera besluten | Handlingskraft | KBR-modulen, dokumentmallar (protokoll, kallelser) som riktiga PDF:er, dokumentlager, meddelanden med uppfattat-kvittens, deltagarroller, kontaktförfrågan till rådgivare (samtycke → förhandsvisning → upplåsning) | E-post | Styrelse, revisor, rekonstruktör/jurist |
| 11 | Löpande uppföljning | Inget får falla mellan stolarna | Vaksam ro | Notiscentret (frister, läge, KBR, taggar, deltagarsvar), kreditbevakning, händelselogg (append-only) med systemsammanfattning | Creditsafe | Alla i ärendet |
| 12 | Exit | Avsluta ordnat – åt endera hållet | Stolthet eller ordnad sorti | Aktexport (hela ärendet), fristkalender (ICS), fakturahistorik, GDPR-radering | – | Företagaren, ev. förvaltare |

**Observation för prissättning:** steg 3 är gratis med avsikt (förtroendebygget), steg 4 startar
gratisveckan (byggd), och de dyraste ögonblicken för kunden (7–10) är också de mest värdeskapande.

---

## DEL 2 · Funktionskarta

Skala: frekvens (dagligen/veckovis/per händelse/engång), kritikalitet och värde (låg/medel/hög/kritisk).

### Analys och kontroll

| Funktion | Vad den gör | Problem den löser | Frekvens | Kritikalitet | Värde |
|---|---|---|---|---|---|
| Gratis nulägesanalys | Strukturerad utvärdering → rekommendation + tidslinje | "Var står vi egentligen?" | Engång/vid förändring | Hög | Kritisk (förvärv + förtroende) |
| Systemanalysen | Deterministisk ledningsrapport ur ärendets alla data; rollanpassad; 4 språknivåer; text/punktlista/tidslinje/kort | Ingen helhetsbild; juridiska texter obegripliga | Dagligen | Kritisk | Kritisk |
| KBR-modulen | Kontrollbalansbedömning steg för steg, SIE-förifylld | Missad KBR = personligt ansvar | Per händelse | Kritisk | Kritisk |
| Likviditetsplan/tidslinje | Prognos dag för dag, arbetsgivaravgifter inräknade | "Räcker pengarna till lönen?" | Veckovis | Hög | Hög |
| Kreditunderlag | Bank-/finansiärsunderlag ur ärendet + 3 fält | Veckor av sammanställande | Per händelse | Medel | Hög |
| Kreditbevakning | Daglig Creditsafe-slagning per bolag | Överraskande försämringar | Dagligen (systemet) | Medel | Medel |
| Portföljanalys (praktiker) | Prioritetsrankning över alla ärenden + tidsskattning | Vilket ärende brinner? | Dagligen | Hög (för byrå) | Hög |

### Process och juridik

| Funktion | Vad den gör | Problem den löser | Frekvens | Kritikalitet | Värde |
|---|---|---|---|---|---|
| Frister med nedräkning | Lagstadgade datum, färgkodad brådska, NÄRMAST | Missade frister = stängda dörrar/ansvar | Dagligen | Kritisk | Kritisk |
| Intelligenta uppgifter | Spelböcker: varför, lagstöd, konsekvens, steg, autoslutförande | "Vad innebär det att *göra* detta?" | Veckovis | Hög | Hög |
| Dokumentmallar | Protokoll/kallelser, förifyllda, riktiga PDF:er, sparas i akten | Formaliafel i kritiska dokument | Per händelse | Hög | Hög |
| Händelselogg | Append-only svart låda med detaljrader + sammanfattning | "Kan styrelsen visa vad den gjorde när?" | Kontinuerlig | Kritisk | Kritisk (juridisk trygghet) |
| Rapporter/PDF-motor | Alla dokument som äkta, deterministiska PDF:er | Underlag som inte går att ta med | Per händelse | Hög | Medel |
| Kunskapsbanken | Källhänvisade artiklar, klickbara begrepp, rådgivningsgräns | Juridisk analfabetism i kris | Vid behov | Medel | Medel (förvärv) |

### Samarbete

| Funktion | Vad den gör | Problem den löser | Frekvens | Kritikalitet | Värde |
|---|---|---|---|---|---|
| Deltagare och roller | Inbjudningar, rollstyrd åtkomst (borgenär ser aldrig helheten) | Mejltrådar utan kontroll | Per händelse | Hög | Hög |
| Meddelanden 2.0 | Direkt/grupp, bilagor, sammanslagning, uppfattat-kvittens, taggning | "Har revisorn sett detta?" | Dagligen | Hög | Hög |
| Notiscentret | Aggregerar frister, läge, KBR, taggar, deltagarsvar, driftlarm; klickbara mål | Tystnad misstas för lugn | Dagligen | Kritisk | Hög |
| Delningsinsyn | Vem ser vad, med samtyckesstämpel | "Vad har jag egentligen delat?" | Per händelse | Hög | Medel |

### Marknadsplats (tvåsidig)

| Funktion | Vad den gör | Problem den löser | Frekvens | Kritikalitet | Värde |
|---|---|---|---|---|---|
| Rådgivarkatalog | Verifierade profiler, fasta priser, omdömen | Hitta rätt kompetens under tidspress | Per händelse | Hög | Kritisk |
| Verifiering + profilanspråk | Granskad ansökan eller "Är detta din profil?" med manuell KYC | Register ≠ ryktesbibliotek | Per händelse | Hög | Hög |
| Kontaktförfrågan → upplåsning | Samtycke → avidentifierad förhandsvisning → byrån låser upp mot villkor; avgift registreras | Byrån slipper köpa gris i säck; bolaget delar inget utan samtycke | Per händelse | Hög | **Kritisk – plattformens värdehändelse** |
| Byråprofil | Innehavaren håller tjänstefälten aktuella; identitet låst till driften | Förfallna profiler | Månadsvis | Medel | Medel |
| Fakturacentral (byrå) | Löpande debiteringsöversikt + samlingsfaktura med klickbar specifikation | Många småfakturor; otydliga avgifter | Månadsvis | Hög (för intäkt) | Hög |

### Drift och tillgänglighet

| Funktion | Vad den gör | Frekvens | Kritikalitet |
|---|---|---|---|
| Driftpanel: nycklar, kunder, utkorg med omskick, ansökningar, anspråk, prisplaner, kreditspärr | Plattformens styrning | Dagligen | Kritisk internt |
| Fakturamotor: obruten nummerserie, öre-exakt moms, påminnelser, kontostängning, återöppning vid betalning | Intäkterna | Månadsvis | Kritisk internt |
| Adaptivt språk (4 nivåer) + presentationsformer + ordlista | Tillgänglighet utan innebördsglidning | Dagligen | Hög (differentierande) |

---

## DEL 3 · Integrationspunkter

| Integration | Används till | Frekvens | Vikt | **Faktisk status** |
|---|---|---|---|---|
| SIE-filer (alla bokföringssystem) | Import → KBR-förifyllnad, analys | Per ärende | Hög | **Byggd** |
| AWS SES (e-post) | Fakturor, påminnelser, inbjudningar, besked | Dagligen | Kritisk | **Byggd** (arbetare + utkorg med omskick) |
| AWS RDS/S3 | Databas, dokumentlager | Kontinuerlig | Kritisk | **Byggd** (självhostat spår, RLS-testat) |
| Creditsafe | Daglig kreditbevakning | Dagligen/bolag | Hög | **Byggd** – väntar nyckel/avtal |
| Kalender (ICS-export) | Frister till användarens kalender | Per ärende | Medel | **Byggd** |
| BankID | Identifiering, signering av protokoll | Per händelse | Hög | Förberedd (nyckelplats, flöde ej aktivt) – avtal krävs |
| Fortnox / Visma eEkonomi | Bokföringsdata direkt i stället för SIE | Per ärende | Hög | Förberedd ("Inom kort") – avtal krävs |
| Bolagsverket | Företagsuppgifter vid utvärdering | Per ärende | Medel | Förberedd – avtal krävs |
| Skatteverket (skattekonto) | Skattekontoläge | Veckovis | Hög | Manuellt utdrag i dag; API-antagande dokumenterat |
| Kronofogden | Mål/utmätningsläge | Per händelse | Medel | **Inget offentligt API – arkitekturen pluggbar (dokumenterat antagande)** |
| Byråsystem (aktexport) | Praktikerns befintliga ärendesystem | Per ärende | Medel | **Byggd** (strukturerad export); direkta API:er framtida |
| Open Banking, UC, SMS, OCR | Kontosaldon, alternativ kreditdata, aviseringar, dokumenttolkning | – | Medel/Låg | **Ej byggda** – kandidater, ska inte antas i prismodellen |

---

## DEL 4 · "AI-motorn" – ärlig deklaration

**Central arkitekturfakta med direkt prispåverkan:** all analys är **deterministiska,
sido-effektfria motorer i egen kod** – ingen extern LLM, ingen ärendedata lämnar
servern, samma indata ger alltid samma rapport, och varje mening är testad.
Det är därför produkten säger *Systemanalys*, aldrig "AI".

| Motor | Gör | Testad |
|---|---|---|
| Krisanalys | Läge, allvar, täckningsgrad, tidslinje, rekommendation | ✅ |
| Systemanalys/lägesrapport | Rollanpassad ledningsrapport (bolag/praktiker) | ✅ |
| Portföljanalys | Rankning + tidsskattning över ärenden | ✅ |
| Uppgiftsintelligens | Spelböcker, konsekvens, stegspårning, rådgivarmatchning m. motivering | ✅ |
| Notisaggregator | Allt som väntar, rangordnat, filtrerbart | ✅ |
| Händelsesammanfattning | Detaljrader + milstolpar ur loggen | ✅ |
| Ärendesammanfattning (leads) | Avidentifierad förhandsvisning + full summering; läckagetestad | ✅ |
| Språkmotor | 4 nivåer, begreppsförklaring, meningsdelning; siffror orörda tecken för tecken | ✅ |
| Presentationstransformer | Text/punktlista/tidslinje/kort utan innehållsförlust | ✅ |
| PDF-sättning | Deterministisk A4-sättning, egen skrivare | ✅ |

**Finns inte (och ska inte antas i kalkyler):** prediktion, confidence-score,
fritext-dokumenttolkning/OCR, generativ rådgivning, agentflöden. Införs sådant är
det ett *arkitekturbeslut* (extern LLM eller egna modeller) som skapar en ny
kostnadsdrivare som i dag är **noll**.

---

## DEL 5 · Användartyper

| Roll | Gör i systemet | Inloggning | Viktigaste funktioner | Viktigast av allt |
|---|---|---|---|---|
| VD/ägare (mikro–små) | Hela resan; beslutar | Dagligen i akut fas, veckovis annars | Systemanalys, frister, handlingsplan, mallar | "Vet exakt var vi står och vad som är nästa steg" |
| Styrelseledamot | Läser läget, protokollför, kvitterar | Per händelse | Systemanalys, KBR, protokoll, händelselogg | Skydd mot personligt ansvar |
| Ekonomiansvarig/konsult | Importerar, håller siffror aktuella | Veckovis | SIE, likviditetsplan, dokument | Slippa dubbelarbete |
| Revisor | Granskar underlag | Per händelse | KBR, dokument, logg | Spårbarhet |
| Rekonstruktör/förvaltare | Driver flera ärenden | Dagligen | Portföljanalys, praktikerrapporter, massexport, förfrågningar/upplåsning | Rätt ärende först; färre timmar per intag |
| Jurist/affärsjurist | Rådgör i ärendet | Veckovis | Juridisk vy av systemanalysen, meddelanden, mallar | Underlag i stället för mejlarkeologi |
| Borgenär | **Ser endast sin egen fordran** | Sällan | – | (Medvetet avgränsad – ingen borgenärsvy) |
| Bank/finansiär | Tar emot kreditunderlag | Utanför systemet | Kreditunderlags-PDF | Beslutsunderlag med källor |
| Drift (Landvex) | Granskar, prissätter, fakturerar | Dagligen | Driftpanelen | Inget försvinner tyst |

---

## DEL 6 · Värdedrivare, prioriterade efter ekonomiskt värde

| # | Värdedrivare | Bärs av | Ekonomisk storlek för kunden |
|---|---|---|---|
| 1 | **Undvika personligt betalningsansvar** | KBR-modul + frister + protokoll + händelselogg | Kan vara ägarens hela privata ekonomi |
| 2 | **Undvika onödig konkurs** | Tidig analys + rekonstruktionsspår + rätt expert i tid | Hela bolagsvärdet + arbetstillfällen |
| 3 | **Juridisk trygghet i efterhand** | Append-only-loggen, samtyckesspår, protokoll i akten | Skillnaden i en ansvarsprocess |
| 4 | **Rätt expert, snabbt, med underlag** | Katalog + kontaktförfrågan + upplåsning | Veckor av söktid; bättre matchning |
| 5 | **Kontroll och minskad stress** | Sambandscentralen som helhet, notiser, klarspråk | Svårmätbart, styr betalningsvilja |
| 6 | **Automatiserad administration** | Mallar, PDF:er, SIE, aktexport | Konsulttimmar |
| 7 | **För byrån: kvalificerade ärenden** | Avidentifierad förhandsvisning → upplåsning med komplett underlag | Intagskostnad ↓, debiterbar tid ↑ – **byråns betalningsvilja är rationell och kalkylerbar** |

---

## DEL 7 · Kostnadsdrivare

| Drivare | Typ | Ungefärlig nivå | Kommentar |
|---|---|---|---|
| LLM/extern AI | – | **0 kr** | Deterministiska motorer. Största strukturella kostnadsfördelen – analyser kan vara obegränsade utan marginalkostnad |
| Infrastruktur (RDS, S3, SES, beräkning) | Fast + svagt rörlig | Enstaka kr/bolag/mån vid låg volym; faller med skala | Byggd för självhostning, ingen Supabase-licens |
| Creditsafe-slagningar | Rörlig per bolag/dag | Avtalsfråga – **största rörliga posten**; systemet begränsar redan till 1 slagning/bolag/dygn | Behöver avtalspris innan modellen låses |
| BankID | Rörlig per identifiering | ~kr-nivå per användning, avtal krävs | Slås på per händelse |
| E-post | Rörlig | Öresnivå (SES) | Försumbar |
| PDF/dokument | – | 0 kr rörligt | Egen skrivare |
| Manuell granskning (ansökningar, profilanspråk/KYC, support) | Mänsklig, rörlig per händelse | **Största mänskliga posten**; minuter–timmar per granskning | Bör bäras av byråsidan i modellen |
| Fakturering/reskontra | Mänsklig, låg | Automatiserad (arbetare + påminnelser + stängning) | Redan byggd bort |
| Jurister/experter i tjänsten | – | 0 kr | Experter är *kunder på byråsidan*, inte kostnad – de betalar för ärenden |

---

## DEL 8 · Mätbara användningsmått

| Mått | Mäts redan i systemet? | Lämplig debiteringsgrund? |
|---|---|---|
| Upplåsta ärenden (byrå) | ✅ `usage_charges`, per styck, fakturarad med bolag/orgnr | **Ja – redan implementerad** |
| Förmedlade förfrågningar (byrå) | ✅ stämplad avgift, månadsfaktura | **Ja – redan implementerad** |
| Abonnemangsmånader (byrå) | ✅ idempotenta månadsrader | **Ja – redan implementerad** |
| Aktiva bolag/ärenden per konto | ✅ | Ja – naturlig bas för företagssidan |
| Användare per ärende | ✅ (medlemmar) | Möjlig – men straffar samarbete, tveksam |
| Månader av användning | ✅ (gratisvecka → faktura byggd) | Ja |
| Antal analyser/rapporter/PDF:er | ✅ (händelseloggen) | **Nej – marginalkostnad 0 och straffar kontrollbeteendet vi vill uppmuntra** |
| Dokumentlagring (GB) | ✅ | Endast som skälighetstak |
| Kreditbevakade bolag | ✅ | Ja – speglar faktisk rörlig kostnad (Creditsafe) |
| BankID-signeringar | Förberedd | Ja, som händelseavgift till självkostnad+marginal |
| Omsättning/balansomslutning | Delvis (utvärderingens fält) | Möjlig proxys för segmentspris – kräver verifierbar källa (Bolagsverket) |

**Princip ur kartan:** mät aldrig det som är gratis att producera och kritiskt att
använda (analyser, frister, dokumentation). Mät händelser med verklig kostnad eller
verkligt levererat värde.

---

## DEL 9 · Segmentering

### Företagssidan

| Segment | Omsättning | Komplexitet | Typiska behov | Risknivå | Användningsmönster |
|---|---|---|---|---|---|
| Mikrobolag (1–2 pers) | <2 mkr | Låg | Klarspråk, "vad gör jag nu?", mallar | Hög (ingen stab) | Intensivt kort; språknivåerna viktiga |
| Småbolag (3–20) | 2–30 mkr | Medel | Likviditet, löner, KBR, styrelsearbete | Hög | Kärnsegmentet; hela resan |
| Medelstora (20–100) | 30–300 mkr | Hög | Samarbete många roller, revisor, bank | Medel | Fleranvändare, praktiker inne |
| Koncern/holding | >300 mkr | Mycket hög | Flera ärenden, portfölj | Medel | Kräver flera-bolag-hantering (delvis byggd via flera ärenden) |
| Situationssegment: stabilisering / KBR-läge / rekonstruktion / konkursnära | – | – | Olika spelböcker (byggda) | Stigande | Intensitet följer allvaret, inte storleken |

### Byråsidan

| Segment | Behov | Betalningslogik |
|---|---|---|
| Enskild jurist/rekonstruktör | Förfrågningar med underlag | Per upplåst ärende |
| Mindre byrå (2–10) | Flöde av kvalificerade ärenden + portföljvy | Abonnemang eller per ärende |
| Större byrå/revisionsbyrå | Volym, integration mot byråsystem, samlingsfaktura | Företagslicens |

---

## DEL 10 · Möjliga prismodeller (inga priser)

| Modell | Fördelar | Nackdelar | Passar när | Passar inte när |
|---|---|---|---|---|
| Fast abonnemang (företag) | Förutsägbart, lätt att godkänna för pressad kassa | Fångar inte värdetoppar | Som **låg grundavgift** | Som enda intäkt – undervärderar krisvärdet |
| Per användare | Enkel | **Straffar samarbete** – motverkar produktens kärna (styrelse+revisor+rådgivare in) | Sällan | Nästan alltid fel här |
| Per bolag/ärende | Speglar strukturen | Koncernkänsligt | Fleraktörssegment | Mikrobolag |
| Per AI-analys | – | Marginalkostnad 0; straffar kontrollbeteende; "Systemanalys"-löftet urholkas | Aldrig i denna arkitektur | Alltid |
| **Per värdehändelse (byråsidan): upplåst ärende, förmedling** | Intäkt följer levererat värde; betalaren har kalkylerbar nytta; **redan byggd med samlingsfaktura** | Volymberoende | Kärnan i byråintäkten | Om katalogen är tunn (hönan-ägget) |
| Abonnemang/licens (byråsidan) | Förutsägbart för storbyrå | Kräver volymhistorik för rätt nivå | Större byråer | Före volymbevis |
| Success fee (företag) | Maximal upplevd rättvisa | **Juridisk gråzon vid obestånd** (avgift villkorad av utfall när borgenärer står före), svårmätt "success", incitamentsrisk | Ev. avgränsat (t.ex. genomförd rekonstruktion) **efter juridisk prövning** | Konkursnära lägen |
| Omsättnings-/balansbaserad (företag) | Skalar med bärkraft, upplevs rättvis | Kräver verifierbar källa; tröskeleffekter | Segmentera grundavgiften i 2–3 band | Som exakt formel |
| Kredit-/riskbaserad | – | Att prissätta efter hur illa kunden ligger till är fel signal för ett kontrollvarumärke | – | Alltid (varumärkesskäl) |
| Transaktionsbaserad (BankID, bevakning) | Speglar verklig rörlig kostnad | Nickel-and-diming-risk | Självkostnadsnära påslag, bakas i grundavgift upp till tak | Som synlig micro-debitering |
| **Hybrid: låg fast företagsavgift + värdehändelser på byråsidan + licens för storbyrå** | Pressat bolag möter låg tröskel; intäkten följer värdet; båda sidor rationella | Kräver stark byråsida | **Detta är vad plattformen redan implementerar som parametrar** | – |

### Bedömning av hypotesen "låg fast avgift + intäkt vid värdehändelser"

Kartan stödjer den – med en viktig precisering: **de mest monetiserbara
värdehändelserna ligger på byråsidan, inte hos det pressade bolaget.** När bolaget
"undviker en kritisk risk" är det juridiskt och varumärkesmässigt känsligt att ta
betalt för just det ögonblicket (obeståndsnära avgifter konkurrerar med borgenärer
och kan klandras). Men samma ögonblick *skapar* en händelse byrån gärna betalar
för: ett kvalificerat, underbyggt ärende. Plattformen fakturerar redan exakt de
händelserna (upplåsning, förmedling, abonnemang) med samlingsfaktura och
specifikation – och företagssidans grundavgift (gratisvecka → månadsfaktura) är
också byggd. **Hybridmodellen är alltså inte en framtida ombyggnad utan en
parametersättning.**

---

## Vad som saknas innan en prismodell kan konstrueras

| # | Lucka | Typ | Blockerar |
|---|---|---|---|
| 1 | Bankgiro + bekräftad momsregistrering/F-skatt (Landvex) | Administrativ | **All fakturering, båda sidor** |
| 2 | Creditsafe-avtal med styckpris | Avtal | Rörlig kostnadskalkyl + bevakning som mervärde |
| 3 | BankID-avtal med styckpris | Avtal | Identifieringens händelseavgift |
| 4 | Fortnox/Visma/Bolagsverket-avtal | Avtal | Importvärdet i företagsavgiften |
| 5 | Betalningsviljedata: 10–15 intervjuer per sida (företagare i kris, byråer) | Marknad | Nivåsättning av grundavgift och upplåsningsavgift |
| 6 | Volymantaganden: förfrågningar/ärende, upplåsningsgrad, byråtäthet | Marknad | Byråsidans intäktsprognos |
| 7 | **Insolvensrättslig prövning av avgiftsmodeller mot bolag i obestånd** (förmånsrätt, återvinning, skälighet) | Juridik | Success fee och allt utöver låg fast avgift på företagssidan |
| 8 | Beslut: extern LLM eller fortsatt deterministiskt | Arkitektur | Kostnadsbasens enda stora okända |
| 9 | Namnfrågan (Clearance/Clarence) + varumärke | Juridik | Publik lansering av prissida |

---

*Dokumentet beskriver plattformen per 2026-08-02, commit-serie t.o.m. `e3ecc34`.
Underlag: den körande produkten, dess databas-schema, motorer och testsviter –
inte antaganden. Luckorna ovan är medvetet listade i stället för gissade.*
