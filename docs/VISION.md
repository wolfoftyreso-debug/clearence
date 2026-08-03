# Vision: sambandscentralen för företag i ekonomisk kris

**Positioneringsbeslut 2026-08-02 (grundaren):** Clearance ska inte
uppfattas som en juridisk informationssajt eller "kunskapsmotor" utan som
**företagets sambandscentral** — ett operativt ledningssystem under den
mest kritiska perioden i bolagets liv. När ett bolag hamnar i problem
löper juridik, ekonomi, skatt, bokföring, banker, leverantörer, personal,
myndigheter, styrelseansvar, frister och dokumentation parallellt.
Problemet är sällan att information saknas — problemet är att ingen längre
har full kontroll. Clearance återtar kontrollen. Vi säljer inte juridik:
vi säljer kontroll, struktur, trygghet och handlingskraft. Målet är inte
bara att ta bolag genom rekonstruktion eller konkurs, utan att hjälpa
ledningen fatta bättre beslut.

**Flödet:** gratis nulägesanalys först (beskriv situationen, svara på
frågor, ladda upp material, få riskbild och alternativ — utan kostnad, så
att tröskeln att söka hjälp tidigt är noll). När bolaget väljer Clearance
som operativt system startas ärendet och plattformen aktiveras:
handlingsplan, tidslinje, dokument, deltagare, uppgifter, kommunikation
och uppföljning. Avgiften faktureras bolaget som en normal administrativ
kostnad för att leda processen korrekt.

**Affärsmodell — att utreda, priset är en parameter:** fast startavgift,
månadsabonnemang, processavgift, rekonstruktionspaket, konkurspaket,
rådgivarpaket. Inget belopp skrivs in i visionen — det valideras mot
marknaden och styrs i driftpanelen. Systemet fakturerar automatiskt och
håller reda på betalningsstatus innan nästa steg aktiveras (byggt:
fakturaserie, utkorg, påminnelser, kontostängning, återöppning vid
betalning).

*Grundarens formulering, 2026-08-01:*

> Clearance hjälper aktiebolag att ta kontroll över en företagskris genom att
> samla juridik, ekonomi, kommunikation, dokumentation och samverkan på en
> enda plattform med full spårbarhet. Målet är att om ett svenskt aktiebolag
> hamnar i ekonomiska svårigheter ska den naturliga första åtgärden vara att
> öppna Clearance.

Det här dokumentet är visionen mappad mot verkligt läge. Kolumnen *Status*
uppdateras när något byggs — ett visionsdokument som inte vet vad som är
sant blir marknadsföring, och det här ska vara ett arbetsdokument.

**OBS NAMNET:** grundaren har omväxlande skrivit *Clearance* och *Clarence*
(inkl. "clarence.se"). Kodbasen, artefakten och bolagstexterna säger
Clearance. Vilket som gäller är ett obekräftat beslut — ändra ingenting
förrän det är avgjort, ett namnbyte rör varumärke, domän och juridiska
texter samtidigt.

## De tio kärnområdena, mot verkligt läge

| # | Område | Status | Vad som finns / saknas |
|---|---|---|---|
| 1 | **Ärendehantering** | Embryo, bärande delar klara | `cases`, `case_members` (9 roller, borgenärer isolerade), dokument, meddelanden, append-only revisionslogg — allt RLS-testat i två miljöer. Saknas: uppgifter med ansvarig och deadline, beslutslogg, tidslinjevy (nästa bygge). |
| 2 | **Juridisk motor** | Delvis | Krisanalysen täcker obestånd (KonkL 1:2), KBR-plikt (ABL 25 kap.), företrädaransvar (SFL 59 kap.), lönegaranti, rekonstruktionens tidsfönster. Saknas: likvidation, företagsinteckningar, säkerheter, borgensåtaganden. **Ingen juridisk granskning är gjord — krav före skarp drift.** |
| 3 | **Kommunikationscentral** | Grunden klar | Ärendemeddelanden med oföränderlighetstrigger. Saknas: inbjudningsflödet (databasmodellen finns, gränssnittet inte). Realism: Skatteverket och Kronofogden kommer inte logga in — deras roll är att korrespondensen *med* dem arkiveras i ärendet, inte att de arbetar i det. |
| 4 | **Dokumentmotor** | Motor klar, mallar få | `ReportModel` renderar redan sex dokumenttyper (analys, KBR, likviditetsplan, rapport, faktura, kvitto). Styrelseprotokoll, borgenärsbrev, fullmakter och ansökningar är *mallar på samma motor* — billiga att lägga till. Saknas: versionskedjor. |
| 5 | **Beslutsstöd** | Klar i sin kärna | Deterministisk insiktsmotor (median/MAD, koncentration, betalningsprioritering), likviditetsprognos med dag-kassan-tar-slut, KBR-utlösare. Medveten princip: **ingen LLM i beslutsvägen** — varje slutsats ska gå att räkna efter för hand. "Leverantörer som riskerar säga upp avtal" kräver avtalsdata vi inte har. |
| 6 | **Integrationsplattform** | Kontrakt klara, noll live | `FinancialPort` + `PROVIDER_REGISTRY` är byggda som kontrakt; kontoutdrags-CSV fungerar. Bolagsverket har API. Bankdata via PSD2 kräver AISP-tillstånd eller licensierad aggregator — **går emot principen om inga yttre beroenden och måste beslutas som undantag**. Skatteverket/KFM saknar öppna ärende-API:er: realistisk nivå är filimport av skattekontoutdrag. Teams/Slack: lågt värde mot samma princip. |
| 7 | **Kreditmarknad** | Inte påbörjad — se risknot | Kreditunderlaget är en naturlig produkt av data vi redan har plus rapportmotorn. Utskicket till flera finansiärer passar den beslutade modellen (förmedling faktureras mottagaren). **Risknot nedan måste avgöras först.** |
| 8 | **Kunskapsmotor** | Inte påbörjad — se risknot | Situationsmedvetna svar går att bygga deterministiskt: kurerad frågemängd där varje svar är en funktion av ärendets fakta + lagrum, samma mönster som insiktsmotorn. **Gränsen mot juridisk rådgivning måste avgöras först.** |
| 9 | **Compliance** | I stort klar | Append-only-revisionslogg via trigger (överlever t.o.m. raderat ärende), RLS 240/240 i två miljöer, oföränderliga meddelanden, obruten fakturaserie. Saknas: läsbar loggvy, beslutade gallringsregler (öppen juridisk fråga, noterad på `audit_events`). |
| 10 | **Svarta lådan** | Fundamentet finns | Är i praktiken: revisionslogg + dokument + meddelanden + **dataexport**. Exporten saknas och är det som gör lådan trovärdig — en svart låda ägaren inte kan öppna är ett löfte, inte en funktion. |

## Tre saker som INTE får byggas innan de avgjorts

1. **Kreditförmedlingen (7).** Att skicka kreditunderlag för ett bolag nära
   obestånd till finansiärer rör sig i terräng där både tillståndsfrågor
   (FI) och medverkansansvar behöver bedömas av jurist — ny skuld till ett
   insolvent bolag kan skada borgenärerna, och plattformen får aldrig
   *rekommendera* kredit, bara producera underlag. Insiktsmotorn säger redan
   idag att ett tillskott "skjuter upp problemet snarare än löser det" när
   det är sant. Den ärligheten är ett varumärke; kreditmodulen får inte
   undergräva den.
2. **Kunskapsmotorn (8).** Ett situationsmedvetet svar på "hur påverkas
   mitt personliga ansvar?" är juridisk rådgivning i allt utom namnet.
   Antingen hålls svaren på lagrumsnivå med ärendets fakta insatta (och
   granskas juridiskt som mallarna), eller så byggs den inte. En LLM som
   improviserar juridik åt ett bolag i kris är den enskilt farligaste
   funktionen som går att lägga till i den här produkten.
3. **Namnet.** Se ovan.

## Byggordning (bekräftar den redan påbörjade)

1. Handlingsplan med nedräkning mot lagstadgade frister på översikten —
   ärendehanteringens hjärta (1, 5)
2. Inbjudningsflöde till ärendet — låser upp samverkan (3)
3. Dokumentmallar på rapportmotorn: styrelseprotokoll, borgenärsbrev,
   fullmakt (4)
4. Dataexport — gör svarta lådan verklig, uppfyller GDPR art. 20 (10, 9)
5. Rådgivarnas månadsfakturering av förmedlingar — stänger intäktsloopen
6. Bolagsverket-integration (6), därefter Fortnox/Visma-adaptrar
7. Kreditunderlag som *dokument* (utan förmedling) — värdet utan risknoten
8. Framtida moduler (styrelseportal, DD, tvister) först när 1–7 bär sig
