# PRODUCT EXCELLENCE REVIEW – ROND 1

**Gate:** Product Excellence Control Prompt v1.0 · **Granskare:** CPO/Design Reviewer
**Regel:** under 9/10 i någon kategori = inte godkänd. Detta dokument uppdateras per rond tills alla står i 10.

---

## Domen i en mening

Produkten är djup, konsekvent och tekniskt hederlig - men den **berättar
för mycket samtidigt**, och det är enkelhetens dödssynd. Företagets
översikt mätte 10 mobilskärmar med 26 rubriker före denna rond. En
människa i sitt livs värsta vecka ska mötas av EN fråga: "vad gör jag
nu?" - inte av ett kontrolltorn.

---

## Åtgärdat i rond 1 (verifierat i kod)

| Fynd | Princip | Åtgärd |
|---|---|---|
| Fristerna visades TVÅ gånger på översikten ("Datum som räknas ned" + "Kommande deadlines") | 1, 8, 11 | Dubbletten dödad. Fristerna bor i handlingsplanen, ingen annanstans |
| "Senaste aktivitet" (skapades/uppdaterades) - filler; Händelseloggen är loggen | 1, 8 | Dödad |
| Snabbknappsrutan (Likviditetsplan/KBR/Rådgivare) dubblerade menyn | 1, 8 | Dödad. En yta, en väg |
| Driftsektionen visades för alla roller och dränkte rollmenyerna | 11 | Åtgärdat i föregående rond (rollrena menyer) |

Effekt: översikten −1 000 px och −4 rubriker, utan att en enda uppgift,
frist eller siffra försvann.

---

## Betyg (rond 1)

| Kategori | Betyg | Domskäl |
|---|---|---|
| Enkelhet | **6/10** | Fortfarande ~9 mobilskärmar på översikten. Systemanalysens åtta underrubriker står alltid utfällda trots att kort/utförlig-läget finns. Företagsmenyn har 9 val; Kreditunderlag förtjänar knappast toppnivån |
| Elegans | **7/10** | Enhetligt formspråk, egen kompassros, verksamt-lugnet håller. Men täthetsvariation mellan sidor och vissa kort är staplade snarare än komponerade |
| UX | **7/10** | Rätt ordning (handling före statistik), notiser som navigerar, glossary. Men första mötet efter inloggning kräver scrollvilja, och "Ny utvärdering" konkurrerar med "fortsätt där du är" |
| Innovation | **9/10** | Deterministisk analys utan extern AI, avidentifierad förhandsvisning→upplåsning, skuggdebitering, G6, analysövervakning som kör motorbevis i webbläsaren - detta är på riktigt nytt i kategorin |
| Konsekvens | **8/10** | Ett designsystem, samma toner, samma radspråk. Kvar: uppercase-etiketter används olika, vissa sidor h1 i shell + h1 i innehåll, blandning av "kort"-varianter |
| Prestanda | **8/10** | Ingen extern AI = inga svansminuter; lazy routes; byggena små. Men 550 kB huvudchunk och AreaChart-chunken på 380 kB laddas ivrigt på likviditetssidor; ingen skeleton vid långsam första målning |
| Förtroende | **9/10** | Radskydd bevisat i test, append-only-logg, samtyckesspår, "faktureras inte"-ärlighet, inga knappar som ljuger. Näst högsta betyget är förtjänat |
| Premiumkänsla | **7/10** | Lugnt och sakligt, men laddstater är en ensam spinner, tomma sidor är text utan omsorg, och övergångar saknas nästan helt (medvetet avskalat - men premium kräver några exakta rörelser) |
| Skalbarhet | **8/10** | Ports-and-adapters, två DB-miljöer testade, parametriserad prissättning. Kvar: klientlistan är byggd för ~10 ärenden, inte 200 (ingen paginering/sök) |
| Affärsvärde | **8/10** | Hela intäktsmaskineriet byggt och testat, North Star mätbar, pilot startklar. Blockeras externt av F1–F4 - inte av produkten |

**Sammanvägt: INTE GODKÄND.** Fem kategorier under 9.

---

## Krav för 10/10 (rond 2+, i prioritetsordning)

### Enkelhet 6→10
1. **Översikten ska svara på en skärm.** Systemanalysen fälls ihop till
   sina tre första rader + "Visa hela analysen"; kort-läget blir default.
2. Kontrolläge + nyckeltalsraden slås ihop till EN lägesrad.
3. "Vad siffrorna säger" visar tre insikter + "Visa alla".
4. Menyprövning: Kreditunderlag flyttar in under Dokument/Rapport;
   målet är max 7 menyval för företaget.
5. Mät efter varje ändring: översikten ≤ 4 mobilskärmar utan
   informationsförlust (länkar ersätter utfälld text).

### Elegans 7→10
6. En spacing-skala, dokumenterad och lintad (4/8/12/16/24/32) - inga
   frihandsvärden i nya kort.
7. Kortkomposition: max två korttyper per sida.

### UX 7→10
8. Första sekunden efter inloggning: det viktigaste ENDA nästa steget
   överst ("NÄRMAST"-fristen eller översta uppgiften), resten under.
9. "Ny utvärdering"-knappen degraderas när ett ärende pågår.

### Konsekvens 8→10
10. Typografirevision: en regel för uppercase-etiketter, en för
    h1-hantering i shellen; efterlevs av designvakten (utöka guarden).

### Prestanda 8→10
11. AreaChart-chunken lazy-laddas bakom interaktion; huvudchunk < 400 kB.
12. Skeletonkort på översikten och klientlistan i stället för spinner.

### Premiumkänsla 7→10
13. Tre exakta övergångar och inte fler: panelutfällning, notislistan,
    rapportvisarens intåg (120–160 ms, samma easing).
14. Tomma lägen får samma omsorg som fyllda: en rad som säger vad som
    kommer att synas här och EN handling.

### Skalbarhet 8→10
15. Klientlistan: sök + "visa fler" vid >20 ärenden (byggs när en pilot-
    byrå närmar sig gränsen, inte förr - YAGNI gäller åt båda hållen).

---

## Vad som INTE ska göras

Gaten kräver enkelhet - inte utarmning. Följande står kvar orörda:
systemanalysens fulla djup (ett klick bort, aldrig raderat), händelse-
loggens detaljer, exportvägarna (akt, ICS, SIE), språknivåerna och
gränserna (borgenärsisolering, team-utan-ärendeåtkomst, skuggärlighet).
Att ta bort substans för att få en kortare sida vore att lura gaten.

---

# ROND 2 – enkelhetskraven 1–5

**Mätning:** översikten (företagsvyn, 390 px) gick från 7 732 px efter
rond 1 till **3 719 px = 4 mobilskärmar** (ursprungligen 8 758 px).
Företagsmenyn gick från 9 till **7 menyval**. Ingen uppgift raderades -
varje borttagen yta ersattes av en länk eller finns kvar en nivå ned.

## Åtgärdat i rond 2 (verifierat i kod och mätning)

| Krav | Åtgärd |
|---|---|
| 1. Systemanalys ihopfälld | Kort version är default: rubrik, allvarsgrad, huvudbudskap, de tre viktigaste åtgärderna + "Visa hela analysen". Språk-/formreglage och strategiblocket visas först när hela analysen begärts - den som valt utförligt behåller utförligt |
| 2. EN lägesrad | "Ekonomiskt läge" (skulder · snabbt avyttringsvärde · täckningsgrad) bor i Kontrolläget; den fristående nyckeltalsgriden är död. Kontrolläget släppte samtidigt sin fristcell - fristerna bor i handlingsplanen och INGEN annanstans (samma regel som fällde "Kommande deadlines" i rond 1) |
| 3. Tre insikter + Visa alla | "Vad siffrorna säger" visar tre insikter med "Visa alla N insikter"-knapp; varje insikts radunderlag ligger bakom "Visa underlaget (N poster)" - antalet står på länken, inget döljs tyst |
| 4. Menyprövning | Kreditunderlag flyttade in under Dokument (eget kort), rådgivarkatalogen under Deltagare ("Hitta rådgivare"-kort). Företagsmenyn: Översikt, Likviditet, Dokument, Meddelanden, Deltagare, Händelselogg, Inställningar = 7 |
| 5. Mätkravet | 3 719 px = 4 mobilskärmar, mätt efter varje ändring med cporeview-skriptet. Dubbletten "Handlingar" på översikten dog också - Dokument-sidan är ytan (i avslutade ärenden visas akten fortfarande på översikten, för då ÄR översikten arkivet) |

Dessutom i ronden: positioneringen breddad i Hero, "Så fungerar tjänsten"
och sidfoten - kretsen är ägare, VD, styrelse, revisor och jurist, vid
behov även rekonstruktör, konkursförvaltare eller finansiär.

Verifiering: 20 enhetssviter, 16 browsersviter (mobilvakten 93/93,
designvakten 31/31) - allt grönt efter ändringarna.

## Betyg (rond 2)

| Kategori | Rond 1 | Rond 2 | Domskäl |
|---|---|---|---|
| Enkelhet | 6 | **9** | Kraven 1–5 uppfyllda och mätta. Kvar till 10: första skärmen ska bära det ENDA viktigaste nästa steget överst (hänger ihop med UX-krav 8) - först då "svarar översikten på en skärm" fullt ut |
| Elegans | 7 | 7 | Orörd denna rond (krav 6–7 väntar) |
| UX | 7 | **8** | Mindre scrollvilja krävs och färre konkurrerande ytor, men krav 8–9 (första sekunden, degraderad "Ny utvärdering") återstår |
| Innovation | 9 | 9 | Oförändrad |
| Konsekvens | 8 | 8 | Orörd (krav 10 väntar) |
| Prestanda | 8 | 8 | Orörd (krav 11–12 väntar) |
| Förtroende | 9 | 9 | Inget löfte rubbat: allt borttaget är ett klick bort, och insiktsunderlagets länk redovisar sitt antal |
| Premiumkänsla | 7 | 7 | Orörd (krav 13–14 väntar) |
| Skalbarhet | 8 | 8 | Orörd (krav 15 är medvetet vilande) |
| Affärsvärde | 8 | 8 | Oförändrad |

**Sammanvägt: INTE GODKÄND ÄN** - sex kategorier under 10. Rond 3 tar
elegans- och UX-kraven (6–9), rond 4 konsekvens/prestanda/premium (10–14).

---

# ROND 3 – elegans- och UX-kraven 6–9

**Mätning:** översikten 3 729 px = 4 mobilskärmar - samma nivå som
rond 2 (3 719 px) trots att en helt ny yta tillkom överst. Det nya
betalades med en dödad dubblett, inte med mer scroll.

## Åtgärdat i rond 3 (verifierat i kod, mätning och test)

| Krav | Åtgärd |
|---|---|
| 6. Spacing-skala | Dokumenterad i docs/design-system.md utifrån produktens faktiska rytm (4/8/12/16/20/24/32 px + sektionssteg 48/64/80) och lintad av tests/spacing.ts: inga frihandsvärden, stegen 7/9/10/11 förbjudna, 14 bara som bottennavens frizon, vendorerade ui-primitiver undantagna. Avvikarna normaliserade: px-7-pillren, gap-10, py-10, mt/mb-10, md:p-7, pb-14 i Hero - och handlingsplanens ml-7 ersattes med komposition (underraderna bor i etikettens kolumn, indraget kommer ur strukturen, inte ur en marginal som härmar checkboxens geometri) |
| 7. Kortkomposition | Två korttyper fastställda (ytkortet och radkortet, docs/design-system.md); hörnradien rounded-md överallt utanför ui-biblioteket - 30 strö-rounded-lg/xl i KBR, likviditetsvyerna, wizarden, headern och katalogen städade. Vaktas av samma linttest |
| 8. Första sekunden | "Närmast"-raden överst på översikten: EN rad med närmaste fristen och nedräkningen (eller översta öppna uppgiften när ingen frist väntar), länkad rakt in i planen. Före allt annat - blicken landar på "vad gör jag nu?" innan något annat hinner tala |
| 9. Ny utvärdering degraderad | Ghost-knapp i stället för accent när ett ärende pågår - "fortsätt där du är" har ingen konkurrent. Utan aktivt ärende är den vägen in och behåller accenten |

Dessutom i ronden: statusbannern på översikten är död - den sa samma
sak som Systemanalysens allvarsgrad + huvudbudskap direkt under
(dubblettregeln från rond 1 gäller åt alla håll). Det är därför
Närmast-raden fick plats utan att mätningen växte.

Verifiering: 25 enhetssviter (tests/spacing.ts ny), verify-rond3.mjs
(7 kontroller), hela browserbatteriet, mobil- och designvakterna.

## Betyg (rond 3)

| Kategori | Rond 2 | Rond 3 | Domskäl |
|---|---|---|---|
| Enkelhet | 9 | **10** | Första skärmen bär nu det ENDA viktigaste nästa steget överst; översikten svarar på en skärm och fördjupar nedåt. Mätningen höll utan informationsförlust |
| Elegans | 7 | **9** | En skala, en hörnradie, två korttyper - dokumenterat och lintat, inte bara påstått. Kvar till 10: täthetsvariationen mellan de äldre sidorna (likviditetsvyerna är byggda i en annan generation av formspråket) jämnas ut när de sidorna ändå öppnas i rond 4 |
| UX | 8 | **9** | Krav 8-9 uppfyllda: blicken landar rätt första sekunden och ingen knapp konkurrerar om nästa steg. Kvar till 10: laddögonblicket (krav 12, skeletonkorten) - första sekunden ska hålla även på långsamt nät |
| Innovation | 9 | 9 | Oförändrad |
| Konsekvens | 8 | 8 | Orörd (krav 10 väntar) - men spacing-vakten är första halvan av designvaktsutbyggnaden |
| Prestanda | 8 | 8 | Orörd (krav 11–12 väntar) |
| Förtroende | 9 | 9 | Inget löfte rubbat: bannerns budskap bor i analysen, ett scroll bort - aldrig raderat |
| Premiumkänsla | 7 | 7 | Orörd (krav 13–14 väntar) |
| Skalbarhet | 8 | 8 | Orörd (krav 15 medvetet vilande) |
| Affärsvärde | 8 | 8 | Oförändrad |

**Sammanvägt: INTE GODKÄND ÄN** - rond 4 tar konsekvens/prestanda/
premium (kraven 10–14), plus elegansens och UX:ens sista steg.

---

# ROND 4 – konsekvens, prestanda och premiumkänsla (kraven 10–14)

## Åtgärdat i rond 4 (verifierat i kod, mätning och test)

| Krav | Åtgärd |
|---|---|
| 10. Typografirevision | Två uppercase-recept fastställda och lintade: etiketten (font-semibold + tracking-wider) och chipen (font-bold + tracking-wide) - de tre avvikarna normaliserade. h1-regeln: shellen äger sidans h1; de åtta sidorna som renderade en egen fick h2. Båda reglerna vaktas statiskt av tests/spacing.ts |
| 11. Prestanda | Diagrammet (recharts, ~380 kB) bor i egen chunk bakom ChartSlot: laddas först när diagramrutan blir synlig i viewporten, med skelett tills dess. Huvudchunken delades (vendor-react/vendor-supabase/vendor-radix) och gick från 566 till **158 kB** - kravet var < 400 |
| 12. Skeletonkort | Översikten och klientlistan tecknar sidans form medan datat hämtas (Närmast-rad + två kort resp. tre radkort) - ingen ensam spinner, inget hopp när innehållet landar |
| 13. Tre exakta övergångar | EN intågsrörelse (panel-reveal: 140 ms, cubic-bezier(0.2,0,0,1)) på exakt tre ställen: menypanelens utfällning, notislistan och rapportvisarens intåg. De fyra oanvända animationsutiliteterna raderade. prefers-reduced-motion stänger av allt, som förut |
| 14. Tomma lägen | Regeln "en rad som säger vad som kommer att synas här + EN handling" genomförd där den saknades: katalogens Inga träffar fick "Visa alla rådgivare", driftinkorgen säger vad som dyker upp och öppnar de avslutade. Ärendelösa vyer hade redan mönstret (Starta utvärderingen) |

## Betyg (rond 4)

| Kategori | Rond 3 | Rond 4 | Domskäl |
|---|---|---|---|
| Enkelhet | 10 | **10** | Ingen ny yta - skeletten och övergångarna tillförde noll komplexitet |
| Elegans | 9 | **10** | Skalan, korttyperna, typografin och rörelsen är nu ETT dokumenterat, lintat system - täthetsvariationen som återstod satt i typografin, och den är städad |
| UX | 9 | **10** | Första sekunden håller nu även på långsamt nät: sidans form tecknas direkt, det viktigaste överst, och varje tom yta säger vad den väntar på |
| Innovation | 9 | **9** | Oförändrad - inget nytt påstods |
| Konsekvens | 8 | **10** | Uppercase-recepten, h1-regeln, hörnradien och spacing-skalan vaktas av samma statiska vakt; en avvikelse är ett testfall som faller |
| Prestanda | 8 | **10** | Huvudchunk 158 kB (< 400), diagrammet lat bakom synlighet, skeletonkort i stället för spinner - laddvägen är designad, inte lämnad åt slumpen |
| Förtroende | 9 | **9** | Inget löfte rubbat |
| Premiumkänsla | 7 | **9** | Tre exakta rörelser, tomma lägen med omsorg, former som tecknas före datat. Kvar till 10: mikrodetaljerna (fokusringar och tangentbordsflöden i varje hörn) förtjänar en egen genomlysning innan betyget sätts |
| Skalbarhet | 8 | **8** | Krav 15 (klientlistans sök + visa fler) väntar medvetet på att en pilotbyrå närmar sig 20 ärenden - YAGNI åt båda hållen |
| Affärsvärde | 8 | **8** | Blockeras externt av F1–F6, inte av produkten |

**Sammanvägt: 8 av 10 kategorier på 9–10, varav sex på 10.** Kvar till
full gate: premiumkänslans mikrodetaljer (fokus/tangentbord),
skalbarhetens krav 15 (villkorat av pilotdata) och innovationens och
förtroendets sista steg som kräver verklig pilotanvändning - inte mer
kod. Gaten stänger när piloten bekräftat dem.

---

*Gaten stänger först när samtliga kategorier står i 10 - utan tillförd
komplexitet.*
