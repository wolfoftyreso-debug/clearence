# Clearance – produktspecifikation

Underlag för ett byggteam. Status per 2026-08-01.

**Så här läser du dokumentet.** `FINNS` = byggt och testat i repot idag. `DELVIS` = grund finns, saknar väsentliga delar. `NYTT` = inte påbörjat. Allt som är juridiskt osäkert är märkt **ANTAGANDE** och ska bekräftas av jurist innan det kodas som regel.

**En regel som gäller hela systemet:** Clearance producerar *underlag*. Rekonstruktören, förvaltaren och rätten fattar besluten. Systemet får aldrig presentera en beräkning som ett avgörande — inte i röstresultat, inte i obeståndsbedömning, inte i fordringsprövning. Det här är inte en juridisk brasklapp, det är en arkitekturregel: den avgör var vi lägger `status`-fält och vem som får sätta dem.

---

## 0. Vad som redan finns

| Område | Status | Var i koden |
|---|---|---|
| Triage/krisanalys med lagrum och frister | FINNS | `src/lib/crisisAnalysis.ts` |
| Likviditetsprojektion, 90 dagar | FINNS | `src/lib/liquidityPlan.ts` |
| Likviditetsguide, 7 steg | FINNS | `src/pages/LiquidityPlanner.tsx` |
| Kontoutdragsimport (CSV, 5 banker, återkommande poster) | FINNS | `src/lib/bankStatement.ts` |
| Kontrollbalansräkning – beräkning | FINNS | `src/pages/KBRModule.tsx` |
| Rapportmotor (ReportModel → utskrift/PDF) | FINNS | `src/lib/reports/` |
| Dokumentlagring per ärende, RLS + signerade URL:er | FINNS | `case_documents`, `src/data/supabase/adapter.ts` |
| Rådgivarkatalog, ansökan, förmedlingsdebitering | FINNS | `professionals`, `referrals` |
| Backend-oberoende datalager | FINNS | `src/data/ports.ts` |
| Aktuella belopp och lagrum på ett ställe | FINNS | `src/lib/officialFigures.ts` |
| Ekonomimodell + insiktsmotor (leverantörsoberoende) | FINNS | `src/lib/financial/` |
| Adaptrar mot Fortnox/Visma m.fl. | NYTT | port finns, adapter saknas |
| Fordringsregister, borgenärer | NYTT | – |
| Parter och intressentkarta | NYTT | – |
| Kommunikation och utskick | NYTT | – |
| Möten, kallelser, omröstning | NYTT | – |
| Uppgifter och deadlines | DELVIS | frister beräknas, men ägs inte av någon |
| Fleranvändare, roller, behörigheter | FINNS | `case_members` + 9 roller, 44 RLS-tester körda mot Postgres |
| Revisionsspår | FINNS | `audit_events`, append-only via trigger, triggrar på 6 tabeller |
| Versionshantering av dokument | NYTT | dokument är oföränderliga filer utan versionskedja |

**Den luckan är stängd.** Ärendet ägs nu av `case_members` med nio roller, och samtliga policyer är omskrivna mot medlemskap. Migrationen ligger i `supabase/migrations/20260801100000_multi_tenant_and_audit.sql`.

**Och nu testas det.** `npm run test:rls` reser en Postgres-instans, applicerar alla migrationer och kör 44 assertions om isolering — borgenärsisolering, revisorns läsrätt utan skrivrätt, återkallad åtkomst, och att revisionsloggen inte går att ändra ens av tabellägaren. Det var tidigare den enskilt största otestade risken i projektet.

---

## 1. Processinventering: dag 1 till avslut

Faserna nedan är den administrativa verkligheten, inte lagens disposition. Lagrum anges där de styr en frist eller ett dokumentkrav.

### Fas 0 – Innan ansökan (vecka −4 till 0)

| Moment | Vem | Administrativ smärta idag |
|---|---|---|
| Inse att läget är kritiskt | Bolaget | Sker för sent. Ingen mäter runway. |
| Bedöma obestånd | Bolaget, jurist | KonkL (1987:672) 1 kap. 2 §. Görs på magkänsla. |
| Kontrollbalansräkning | Styrelse, revisor | ABL (2005:551) 25 kap. 13 §. Missas ofta helt. |
| Bevaka företrädaransvar | Företrädare | SFL (2011:1244) 59 kap. 12–13 §. Fristen är skattens förfallodag. Den missas. |
| Ta fram likviditetsbudget | Bolaget, ekonom | Byggs i Excel, tre gånger, av tre personer. |
| Sammanställa skulder | Bolaget | Utdrag från fem system, klistras ihop för hand. |
| Välja rekonstruktör | Bolaget | Ringer runt. Ingen prisbild. |

### Fas 1 – Ansökan och beslut (dag 0 till ~1 vecka)

| Moment | Vem | Not |
|---|---|---|
| Ansökan till tingsrätten | Bolaget/ombud | Kräver borgenärsförteckning och likviditetsbudget |
| Rätten förordnar rekonstruktör | Tingsrätten | |
| Beslut om företagsrekonstruktion | Tingsrätten | Startar alla frister |
| Underrättelse till borgenärer | Rekonstruktören | Massutskick. Ren administration. |
| Betalningsförbud träder in | – | Äldre fordringar fryses |

### Fas 2 – Löpande rekonstruktion (månad 1 till 3, förlängningsbart)

**Tidsramar (verifierade).** Rekonstruktionen pågår som huvudregel tre månader från beslutet. Rätten kan förlänga med tre månader i taget. Totalt högst tolv månader — men om rätten beslutat om planförhandling dessförinnan får den pågå längst femton månader från beslutet.

| Moment | Vem | Frekvens |
|---|---|---|
| Borgenärssammanträde | Rekonstruktören, tingsrätten | Tidigt |
| Fordringsanmälningar in | Borgenärer | Löpande, kaotiskt |
| Avstämning av fordringar | Rekonstruktören, bolaget | Löpande |
| Månadsrapport till rekonstruktören | Bolaget | Månadsvis |
| Likviditetsuppföljning plan mot utfall | Bolaget | Veckovis eller månadsvis |
| Ansökan om förlängning | Rekonstruktören | Var tredje månad |
| Lönegarantibeslut och utbetalning | Rekonstruktören, Länsstyrelsen | Vid behov |
| Löpande borgenärsfrågor | Bolaget | Dagligen. **Detta är den största dolda kostnaden.** |

### Fas 3 – Rekonstruktionsplan och omröstning

**Verifierat.** Rekonstruktören hjälper bolaget upprätta en rekonstruktionsplan. Berörda parter delas in i grupper efter intressegemenskap. Rätten prövar indelningen. Plansammanträde hålls tidigast tre och senast fem veckor efter beslutet om planförhandling. Huvudregeln är att samtliga berörda grupper ska anta planen, med **2/3 majoritet**. Rätten fastställer planen.

> **ANTAGANDE — måste bekräftas av jurist före kodning.** Exakt hur majoriteten beräknas (huvudtal, belopp eller båda), hur grupper får bildas, vilka som är "berörda parter", och under vilka förutsättningar gruppöverskridande fastställande (cram-down) får ske. **Bygg ingen av dessa som hårdkodad regel.** Se §9.3.

### Fas 4 – Avslut

Utfall: fastställd plan och genomförande · rekonstruktionen upphör utan plan · konkurs · frivillig likvidation · bolaget tar sig ur situationen.

Varje utfall har sin egen slutdokumentation, sitt eget arkivbehov och sin egen slutrapport.

---

## 2. Modulspecifikation

### 2.1 Case Dashboard

**Syfte.** Svara på tre frågor inom fem sekunder: *Vad måste jag göra nu? Vad väntar jag på? Hur lång tid har jag kvar?*

**Huvudfunktioner**
- Nästa åtgärd, en enda, med deadline och ansvarig
- Fristpanel: nästa lagstadgade eller avtalade datum, sorterat på hur ont det gör
- Runway i dagar, från likviditetsmodulen
- Blockerare: uppgifter som väntar på annan part, med vem och sedan när
- Fasindikator med förlängningsdatum
- Aktivitetsflöde, senaste 20 händelserna ur revisionsspåret

**Skärmar.** Översikt · Tidslinje (hela ärendet) · Fas- och fristvy

**Dataobjekt.** `case`, `case_phase`, `deadline`, `task`, `activity_event`

**Automation.** Frister härleds ur fasbeslut och inmatade datum. Runway beräknas om vid varje ändring i likviditetsplanen. Blockerare identifieras av uppgifter med `assignee_party_id` ≠ inloggad part och `status = waiting`.

**Risker.** Att visa en frist som "säker" när underlaget är ofullständigt. Varje frist måste bära sin källa (lagrum, domstolsbeslut eller manuellt satt) och sin osäkerhet.

---

### 2.2 Parties & Stakeholders

**Syfte.** Ett register över alla som har med ärendet att göra. Idag ligger det i någons telefon och en Excel-fil.

**Huvudfunktioner**
- Partsregister: fysisk person eller organisation, roll, kontaktvägar, relation till ärendet
- Rolltilldelning per ärende (samma person kan vara borgenär i ett och rådgivare i ett annat)
- Kontaktkanalspreferens och verifierad e-post
- Kommunikationshistorik per part, samlad från Communication Center
- Intressentkarta: visuell översikt grupperad på roll och beloppsexponering
- Fullmakts- och behörighetsnoteringar (vem får företräda vem)
- GDPR: laglig grund, gallringsdatum, exportera/radera per part

**Skärmar.** Partslista med filter · Partskort · Intressentkarta · Bjud in part

**Dataobjekt.** `party`, `party_role` (case_id, party_id, role, from, to), `contact_point`, `party_note`

**Automation.** Borgenärer skapas automatiskt ur fordringsregistret. Dubblettförslag på org.nr och e-post. Kontaktuppgifter kan hämtas från offentligt register — **men aldrig hittas på** (se `companyLookup`-kontraktet i `src/data/ports.ts`, som redan tvingar `null` när svar saknas).

**Risker.** Personuppgifter om fysiska personer i ekonomisk knipa. Kräver laglig grund, gallring och strikt behörighet. En borgenär får aldrig se andra borgenärers uppgifter.

---

### 2.3 Cash Flow & Liquidity — DELVIS

**Syfte.** En likviditetsplan som håller för att visas för rekonstruktör, bank och rätten, och som följs upp mot utfall.

**Finns idag.** 7-stegsguide, 90-dagarsprojektion med dag-för-dag-saldo, arbetsgivaravgift 31,42 %, kontoutdragsimport med detektering av återkommande poster, rapport.

**Att bygga**
- **Plan mot utfall.** Låst planversion per period, utfall importeras från kontoutdrag, avvikelse per post. *Detta är månadsrapporteringen — idag byggs den om från grunden varje månad.*
- Rullande 12-månadersprognos utöver dagens 90 dagar
- Scenarier sida vid sida: fortsatt drift, ackordsutfall, avveckling, kapitaltillskott
- Känslighetsanalys: vad händer om största kunden betalar 30 dagar sent
- Periodisering av moms och arbetsgivaravgifter mot faktiska deklarationsdatum
- Runway-larm med tröskel som användaren sätter
- Versionering: varje plan som lämnats till rekonstruktören ska vara oföränderlig och återfinningsbar

**Skärmar.** Guide (finns) · Planvy · Plan mot utfall · Scenariojämförelse · Månadsuppföljning

**Dataobjekt.** `liquidity_plan` (versionerad), `plan_line`, `actual_line`, `variance`, `scenario`

**Automation.** Utfall matchas mot planposter via samma normalisering som `bankStatement.ts` redan använder för återkommande poster. Avvikelse över tröskel skapar uppgift. Månadsrapport genereras och skickas enligt schema.

**Risker.** Automatisk matchning som gissar fel gör rapporten osann. Varje matchning ska vara synlig och gå att bryta. Bygg vidare på principen som redan gäller i importen: inget är förkryssat.

---

### 2.4 Claims & Creditors — NYTT

**Syfte.** Ett fordringsregister som är sanningen för både bolaget och rekonstruktören. Idag: tre listor som inte stämmer överens.

**Huvudfunktioner**
- Fordringsregister med belopp, förfallodag, grund, säkerhet, bestridande
- Klassificering: prioriterad/oprioriterad, säkerhet, kvittningsrätt, massafordran
- Import från leverantörsreskontra, CSV och kontoutdrag
- Borgenärsportal: borgenären anmäler och styrker sin fordran själv
- Avstämning: bolagets uppgift mot borgenärens anmälan, differens synlig
- Bestridandehantering med skäl och beslutsstatus
- Skuldsammanställning per grupp, med totaler
- Underlag för gruppindelning inför planförhandling

**Skärmar.** Fordringslista · Fordringskort · Avstämningsvy (bolagets siffra mot borgenärens, sida vid sida) · Gruppindelning · Borgenärsportal (extern)

**Dataobjekt.** `claim`, `claim_version`, `claim_evidence`, `claim_dispute`, `creditor_group`, `security_interest`

**Automation.** Import och dubblettförslag. Automatisk summering per klass. Påminnelse till borgenärer som inte anmält. **Klassificeringen föreslås men fastställs alltid manuellt** — prioritetsordning är juridik, inte uträkning.

**Risker.** Systemets höga insats. En felaktig prioritetsordning eller ett missat bestridande får direkta ekonomiska konsekvenser. Kräver fullt revisionsspår per fordran och per statusändring.

**Beroenden.** Parties (borgenär = part). Documents (bevis). Meetings & Voting (grupp och röstvärde).

---

### 2.5 Communication Center — NYTT

**Syfte.** Ersätta det som idag är hundratals mejl, telefonsamtal och brev. **Detta är den enskilt största tidstjuven i en rekonstruktion.**

**Huvudfunktioner**
- Massutskick till borgenärsurval, med mallar och sammanfogade fält
- Kanaler: portal (primärt), e-post, SMS för tidskritiskt, brev via tjänsteleverantör
- Kvittens: skickat, levererat, öppnat, läst i portal, bekräftat av mottagare
- Trådad konversation per part, kopplad till ärendet
- Mallbibliotek med versionshantering och godkännandesteg
- Standardsvar på återkommande borgenärsfrågor
- Utskickslogg som kan exporteras som bevis på att underrättelse skett

**Skärmar.** Inkorg · Nytt utskick (mottagarurval → mall → granska → skicka) · Utskickslogg · Mallbibliotek · Partstråd

**Dataobjekt.** `message`, `message_recipient` (per mottagare: status, tidsstämplar), `template`, `template_version`, `delivery_receipt`

**Automation.** Helautomatiskt: påminnelser, fristvarningar, mottagningsbekräftelser, statusuppdateringar. Kräver granskning: allt som går till alla borgenärer. Kräver juridisk bekräftelse: formella underrättelser och kallelser.

**Risker.** Ett felaktigt massutskick går inte att ta tillbaka. Kräver förhandsgranskning med verklig mottagarlista, testutskick till sig själv, och tvåstegsbekräftelse. Leveransbevis måste hålla som bevisning — tidsstämpel, mottagaradress, exakt innehåll som skickades, i oföränderlig form.

---

### 2.6 Meetings & Voting — NYTT

**Syfte.** Kallelser, genomförande, protokoll och omröstning utan att någon sitter med papperslistor.

**Huvudfunktioner**
- Möteskalender: borgenärssammanträde, plansammanträde, styrelsemöten, kontrollstämma
- Kallelse med korrekt varsel per mötestyp, utskick och kvittens
- Dagordning och underlagspaket
- Närvaroregistrering, fysisk och digital, med fullmakter
- Röstningsflöde: röstlängd, röstvärde per berörd part, gruppindelning
- Resultatsammanställning per grupp
- Protokoll med justering och signering

**Skärmar.** Mötesöversikt · Skapa möte · Kallelselista med kvittensstatus · Röstlängd · Röstningsvy (deltagare) · Resultat · Protokoll

**Dataobjekt.** `meeting`, `meeting_notice`, `attendance`, `proxy`, `vote_register`, `vote`, `vote_result`, `minutes`, `minutes_signature`

**Automation.** Kallelseutskick och påminnelser. Röstlängd byggs ur fordringsregistret. Resultat summeras per grupp automatiskt.

**Risker — läs detta noga.**

Huvudregeln är att varje berörd grupp antar planen med **2/3 majoritet**, och plansammanträde hålls tidigast tre och senast fem veckor efter beslutet om planförhandling.

**ANTAGANDE:** hur majoriteten beräknas i detalj, hur grupper får bildas, vilka som räknas som berörda parter, och förutsättningarna för gruppöverskridande fastställande.

**Bygg därför så här:**
1. Trösklar och beräkningssätt ligger i konfiguration per ärende, aldrig i kod.
2. Systemet redovisar *räkneunderlag* — antal, belopp, andelar per grupp. Det utfärdar inte ett juridiskt utfall.
3. Rekonstruktören sätter `outcome` manuellt, med signatur och tidsstämpel.
4. Rösträkningen ska gå att räkna om från rådata i efterhand, och rådata ska aldrig kunna ändras.

En felräknad omröstning som systemet presenterat som ett avgörande är den värsta enskilda risken i hela produkten.

---

### 2.7 Documents & Evidence — DELVIS

**Syfte.** Alla handlingar på ett ställe, med version, kvittens och beviskedja.

**Finns idag.** Uppladdning per ärende, nio dokumenttyper, privat lagring med RLS på både rad och objekt, nedladdning via 60-sekunders signerade URL:er, 25 MB-gräns.

**Att bygga**
- **Versionskedja.** Idag är varje fil fristående. Behövs: `document` med `document_version[]`, aktuell version, diff av metadata, spårbar ersättningshistorik.
- **Diarieföring.** Löpnummer per ärende, oföränderligt, som kan citeras i skrift.
- **Signering.** BankID för svenska parter. Signeringsordning för flerpartsdokument.
- **Kvittens.** Vem har tagit del av vad, och när.
- Delningsregler per part och per roll
- Checksumma per version, för att kunna visa att en fil inte ändrats
- Fulltextsökning
- Exportpaket: hela ärendet som strukturerat arkiv med manifest

**Skärmar.** Dokumentlista med diarienummer · Dokumentkort med versionshistorik · Signeringsflöde · Delningsinställningar · Exportpaket

**Dataobjekt.** `document`, `document_version`, `document_access`, `signature_request`, `signature`, `acknowledgement`, `checksum`

**Automation.** Automatisk diarieföring. Typklassificering föreslås ur filnamn och innehåll, bekräftas manuellt. Påminnelse om osignerat.

**Risker.** En version som skrivs över utan spår förstör beviskedjan. Regel: dokumentversioner raderas aldrig, de markeras som ersatta.

---

### 2.8 Tasks & Deadlines — DELVIS

**Syfte.** Att inget faller mellan stolarna, och att det alltid syns vem som sitter med bollen.

**Finns idag.** `crisisAnalysis.ts` beräknar frister och nästa steg med deadlines. De har ingen ägare, ingen status och ingen påminnelse.

**Att bygga**
- Uppgifter med ansvarig part, förfallodatum, status, beroenden
- Automatiskt genererade uppgifter ur fas- och fristregler
- Återkommande uppgifter (månadsrapport, avstämning)
- Eskalering vid utebliven åtgärd
- Fristmotor med källa per frist: lagrum, domstolsbeslut, avtal eller manuell
- Checklistor per fas

**Skärmar.** Min lista · Ärendets lista · Kalendervy · Fristöversikt

**Dataobjekt.** `task`, `task_dependency`, `deadline`, `deadline_source`, `checklist_template`

**Automation.** Uppgifter skapas ur fasövergångar. Påminnelser eskalerar. Uppgifter som är beroende av annan part markeras som blockerare på dashboarden.

**Risker.** En automatiskt beräknad lagfrist som är fel är värre än ingen frist alls. Varje sådan frist måste visa sin källa och gå att justera manuellt, med spår.

---

### 2.9 Roles & Permissions — NYTT

**Syfte.** Flera parter i samma ärende, som var och en ser exakt det de ska.

**Roller**

| Roll | Ser | Får ändra |
|---|---|---|
| Bolaget (företrädare) | Allt i eget ärende | Egna uppgifter, planer, dokument |
| Bolagets ekonomifunktion | Ekonomi, dokument | Likviditet, fordringar |
| Rekonstruktör | Allt i ärendet | Fordringsstatus, faser, protokoll, omröstningsutfall |
| Konkursförvaltare | Allt i ärendet efter konkursbeslut | Motsvarande |
| Revisor | Ekonomi, dokument | Granskningsnoteringar |
| Juridisk rådgivare | Konfigurerbart per ärende | Egna noteringar och dokument |
| Borgenär | **Bara sin egen fordran och sina egna utskick** | Egen anmälan, egna bevis, egen röst |
| Anställdrepresentant | Lönerelaterat | – |
| Styrelseledamot | Beslutsunderlag, protokoll | Signering |
| Tillsyn/myndighet | Läsåtkomst enligt beslut | – |

**Kritisk regel.** Borgenärsisolering. En borgenär får aldrig se en annan borgenärs fordran, uppgifter eller röst. Detta är den behörighetsregel som måste testas hårdast — den är hela portalens förutsättning.

**Att bygga.** Ärendemedlemskap (`case_member`), rollbaserad åtkomst per modul och objekt, inbjudningsflöde med verifiering, tidsbegränsad åtkomst, delegering med spår.

**Risker och beroende.** Detta bryter dagens datamodell. `cases.user_id` + `auth.uid()` räcker inte. **`src/data/ports.ts` bär redan varningen:** förlorar man radscopingen så *fails open* — anropen fortsätter fungera och börjar returnera andra bolags insolvensdata. Migreringen till fleranvändarmodell måste göras med policytester som körs i CI.

---

### 2.10 Audit Trail & Compliance — NYTT

**Syfte.** Att i efterhand kunna visa vem som gjorde vad, när, och vad de såg då.

**Ska loggas, undantagslöst**
- Alla statusändringar på fordringar, uppgifter, faser, dokument
- Alla utskick: mottagare, kanal, innehållsversion, leveransstatus
- All åtkomst till personuppgifter och till andra parters data
- Alla in- och utloggningar, alla behörighetsändringar
- Alla röster och all rösträkning
- Alla signeringar
- Alla exporter

**Egenskaper.** Append-only. Tidsstämpel från server, aldrig från klient. Aktörsidentitet plus vilken roll de agerade i. Före- och efterbild vid ändring. Loggen ska gå att exportera och läsa utan systemet.

**Dataobjekt.** `audit_event` (id, case_id, actor_party_id, actor_role, action, object_type, object_id, before, after, occurred_at, ip, user_agent)

**Risker.** Loggen innehåller personuppgifter och är i sig känslig. Den måste omfattas av samma gallring och samma åtkomstkontroll som allt annat — men får inte kunna ändras i efterhand.

---

### 2.11 Reports & Exports — DELVIS

**Finns idag.** Rapportmotor med `ReportModel` → renderare → utskrift/PDF eller fil. Fyra rapporter: krisanalys, KBR, likviditetsplan, ärendesammanfattning. Ren logik, 33 tester, escapning verifierad.

**Att bygga.** Månadsrapport till rekonstruktören · Skuldsammanställning per grupp · Fordringsavstämning · Rösträkningsunderlag · Utskickslogg som bevis · Slutredovisning · Fullständigt ärendearkiv med manifest och checksummor.

**Automation.** Schemalagd generering och distribution. Rapportversioner sparas som dokument och diarieförs automatiskt.

---

### 2.12 Accounting Integration Hub — GRUND BYGGD

**Syfte.** Om bolaget har sin bokföring i Fortnox eller Visma ska ingen uppgift matas in en gång till. Clearance blir ett lager ovanpå ekonomisystemen, inte ett parallellt register.

**Byggt idag.**

| Del | Fil |
|---|---|
| Leverantörsoberoende ekonomimodell | `src/lib/financial/model.ts` |
| Adapterport + leverantörsregister med kapabiliteter | `src/lib/financial/ports.ts` |
| Deterministisk insiktsmotor | `src/lib/financial/insights.ts` |
| Insiktsvy | `src/components/financial/InsightList.tsx` |
| Port i datalagret | `FinancialPort` i `src/data/ports.ts` |
| 46 tester | `tests/financial.ts` |

**Tre designbeslut som styr allt annat**

**1. Varje siffra bär sitt ursprung.** `Provenance` är obligatorisk på allt: vilken leverantör, vilken endpoint, vilken tidpunkt, vilket käll-id. En siffra i en insolvensbedömning är bara värd svaret på "varifrån kom den, och när?". Utan det håller den inte i ett dokument som går till rekonstruktör eller domstol.

**2. Saknad data och noll är olika saker.** `FinancialCapabilities` säger vad varje leverantör faktiskt kan lämna, och `FinancialSnapshot.gaps` säger vad som försöktes och misslyckades. En tom lista och en otillgänglig datamängd ser likadana ut på skärmen och betyder motsatta saker — "du är skyldig ingen" mot "vi vet inte vad du är skyldig". I den här produkten är den skillnaden hela bedömningen. Systemet visar därför alltid vad det inte kunde se.

**3. Huvudbok och bank är inte samma sak.** En leverantörsfaktura i bokföringen är vad som ska betalas; en bankdebitering är vad som har betalats. Slår man ihop dem naivt dubbelräknas posterna och prognosen blir fel. Källorna förblir märkta hela vägen genom modellen.

**Vad som kan hämtas — ANTAGANDE i sin helhet**

`PROVIDER_REGISTRY` innehåller en planeringsbaseline för Fortnox, Visma, Björn Lundén, Bokio, PE Accounting och Business Central. **Ingen rad är verifierad mot leverantörens dokumentation.** Flera kräver partneravtal innan den verkliga API-ytan ens är synlig. Varje rad ska bekräftas när dess adapter skrivs. Gränssnittet påverkas inte av att de är fel idag — onboardingtexten gör det.

**Ett undantag är däremot inte ett antagande: skattekontot.** Det finns inget generellt tredjepartsgränssnitt mot Skatteverkets skattekonto. Vad ekonomisystemet har är vad bolaget själv bokfört, vilket rutinmässigt avviker från myndighetens saldo. Ingen leverantör i registret deklarerar `taxAccount`, och alla bär en not om varför. **Att presentera bokfört saldo som Skatteverkets vore direkt farligt** — företrädaransvar hänger på faktiska förfallodagar och faktiskt saldo.

**Var adaptrarna körs.** Inte i webbläsaren. Samtliga leverantörer använder OAuth2 med konfidentiell klient; klienthemlighet och refresh-tokens kan inte ligga i en publik SPA. Adaptrarna körs serversidigt och returnerar en `FinancialSnapshot`.

**Automationsmöjligheter.** Schemalagd hämtning · snapshot-diff mellan två hämtningar · automatisk matchning av utfall mot planposter · borgenärsregister som fylls ur leverantörsreskontran.

**Risker.** Utgången token som tyst returnerar tomt är det farligaste felet — ett bolag som ser 0 kr i leverantörsskuld drar exakt fel slutsats. `ConnectionStatus.error` finns för att göra det omöjligt: en trasig koppling får aldrig rapporteras som frånvaro av data.

---

### 2.12b Rekonstruktionsassistenten — BYGGD

**Vad den gör.** Läser en snapshot och säger vad som är värt att veta:

- Kassan räcker inte till det som förfaller den närmaste månaden, med underskottet i kronor
- Så här få leverantörer står för så här stor del av skulden
- Så här stora kundfordringar är försenade
- Så här mycket är över 90 dagar förfallet
- Den här kostnaden avviker från kontots egen historik
- Det här kunde vi inte hämta

**Att den inte är en språkmodell är ett designbeslut, inte en begränsning.**

Varje punkt ovan är aritmetik: en projektion, en sorterad kumulativ summa, ett filter, en datumjämförelse, en mängddifferens. Att köra dem genom en språkmodell skulle göra dem långsammare, icke-reproducerbara, omöjliga att enhetstesta — och kapabla att ange en siffra som inte finns i underlaget. I en produkt som talar om för någon huruvida bolaget är på obestånd är en hallucinerad siffra det värsta felet som finns.

Därför: rena funktioner, varje insikt bär de tal den härletts ur (`evidence`, visad bredvid påståendet, inte gömd bakom en utfällning), och varje insikt täcks av test.

Språkmodellen har ändå en plats — men i resten: formulera ett följebrev, sammanfatta månadens avvikelser i prosa, utkast till borgenärssvar. Alltid märkt som utkast, aldrig sättande status eller belopp.

**Avvikaredetektering.** `costOutliers` använder median och median absolute deviation, inte medelvärde och standardavvikelse. En enskild enorm månad drar upp ett medelvärde och gömmer sig själv — vilket är precis den månad som är värd att hitta. Med mindre än fyra perioders historik säger funktionen ingenting hellre än gissar.

**Betalningsprioritering.** `prioritisePayments` ordnar efter konsekvens, inte belopp: obetald skatt på förfallodagen kan göra företrädaren personligen betalningsskyldig, och den konsekvensen skalar inte med beloppet. En skatteinbetalning på 40 000 kr rankas före en leverantörsfaktura på 400 000 kr. `PRIORITY_WARNING` följer med varje visning — selektiva betalningar före obestånd kan återvinnas och öka det personliga ansvaret, så det här är en planeringsordning och inte ett råd om vem som ska betalas.

---

### 2.13 Integration Layer — NYTT

Prioritetsordning. Bygg inget här förrän arbetsflödet fungerar manuellt.

| Integration | Värde | Insats | När |
|---|---|---|---|
| Bank: kontoutdrag som CSV | Högt | **Klart** | Finns |
| Fortnox / Visma (reskontror, saldon) | Högt | Hög — serversidig OAuth2 | v2. Porten är definierad i `src/data/accounting.ts` |
| BankID-signering | Högt | Medel | v2 |
| E-post och SMS med leveranskvittens | Högt | Låg | MVP |
| Bolagsverket, företagsuppgifter | Medel | Medel | v2 |
| Bank via PSD2 | Medel | Hög | v3 |
| Brevutskick via tjänsteleverantör | Medel | Låg | v3 |

**Regel.** Ingen integration får skriva direkt in i systemet. Allt importerat landar som förslag som en människa godkänner — samma princip som kontoutdragsimporten redan följer.

---

### 2.14 Case Closure / Exit — NYTT

**Syfte.** Ett avslut som går att försvara flera år senare.

**Huvudfunktioner.** Avslutsväg (fastställd plan · upphörd utan plan · konkurs · likvidation · återhämtning) · Slutrapport per väg · Slutlig fordringsavräkning · Arkivpaket med manifest och checksummor · Överlämning till konkursförvaltare vid konkurs · Gallringsschema som startar vid avslut · Uppföljning av planens genomförande.

**Risker.** Gallring får inte radera det som måste sparas av bokförings- eller preskriptionsskäl. Gallringsregler ska konfigureras per dokumenttyp och bekräftas juridiskt.

---

## 3. MVP, v2, v3

Urvalskriterium för MVP: *tar det bort administrativ tid från dag ett, eller är det bara struktur?*

### MVP — 12 till 16 veckor

| # | Funktion | Varför först |
|---|---|---|
| 1 | **Fleranvändarmodell, ärendemedlemskap, roller** | Allt annat förutsätter det. Går inte att lägga på i efterhand. |
| 2 | **Fordringsregister med import och avstämning** | Ersätter tre olämpliga Excelfiler. Omedelbar nytta. |
| 3 | **Borgenärsportal, minimal** | Borgenären anmäler själv. Tar bort mest inkommande mejl av allt. |
| 4 | **Communication Center: mallar, massutskick, kvittens** | Störst tidsbesparing per krona. |
| 5 | **Uppgifter och frister med ägare** | Fristmotorn finns; ge den ägare, status och påminnelser. |
| 6 | **Dokumentversioner, diarieföring, kvittens** | Beviskedjan måste finnas från första dagen, inte läggas till sedan. |
| 7 | **Revisionsspår** | Samma sak. Kan inte rekonstrueras i efterhand. |
| 8 | **Plan mot utfall, månadsuppföljning** | Bygger på det som redan finns. Ersätter månadens Excel-omtag. |
| 9 | **Case Dashboard mot verklig data** | Kittet. |

Utanför MVP: omröstning, signering, integrationer, avancerade scenarier.

### v2 — nästa 12 veckor

Möten och kallelser med kvittens · Omröstningsflöde med konfigurerbara trösklar · BankID-signering · Fortnox/Visma · Scenariojämförelse · Intressentkarta · Rapportpaket för rekonstruktör · Exportarkiv.

### v3

Avslutsmodul med arkiv och gallring · Tillsyns- och myndighetsvy · PSD2 · Brevutskick · AI-stöd enligt §7 · Flerärendevy för rekonstruktörsbyråer (**detta blir sannolikt den kommersiellt viktigaste vyn — se §10**).

---

## 4. Informationsarkitektur

```
/                          Publik startsida
/logga-in

/arenden                   Ärendelista (för den som har flera)
/arende/:id
  /oversikt                Nästa åtgärd, frister, runway, blockerare
  /tidslinje               Hela ärendet kronologiskt
  /parter                  Register + intressentkarta
    /parter/:partyId
  /ekonomi
    /likviditet            Plan (finns)
    /uppfoljning           Plan mot utfall
    /scenarier
    /balans
  /fordringar              Register
    /fordringar/:claimId
    /avstamning
    /grupper
  /kommunikation
    /inkorg
    /utskick
    /utskick/nytt
    /mallar
  /moten
    /moten/:meetingId
    /moten/:meetingId/rostning
    /moten/:meetingId/protokoll
  /dokument
    /dokument/:docId       Med versionshistorik
    /signering
  /uppgifter
  /rapporter
  /historik                Revisionsspår
  /installningar
    /behorigheter
    /avslut

/portal/:token             Borgenärsvy. Egen layout, egen navigation,
                           ser aldrig ärendets interna struktur.
```

**Navigationsprinciper.** Dashboarden är alltid ett klick bort. Aldrig fler än två nivåer till en handling. Borgenärsportalen är en *separat applikation* med samma kodbas — den delar inget navigationsskal med ärendevyn, så en behörighetsmiss inte kan exponera intern struktur.

**Kognitiv belastning.** Användaren är i kris. Varje skärm ska ha ett primärt syfte och en primär knapp. Guidad väg genom allt som har fler än tre steg — mönstret från `LiquidityPlanner` (7 steg, en fråga i taget, hjälptext på varje) är rätt och ska återanvändas för fordringsimport, utskick och gruppindelning.

---

## 5. Roller, behörigheter och arbetsflöden

### 5.1 Behörighetsmatris (utdrag)

| Objekt | Bolaget | Rekonstruktör | Revisor | Borgenär | Styrelse |
|---|---|---|---|---|---|
| Egen fordran | Läs alla | Läs/skriv alla | Läs alla | **Bara sin egen** | Läs alla |
| Likviditetsplan | Skriv | Läs | Läs | – | Läs |
| Fordringsstatus | Föreslå | **Fastställ** | – | Bestrid egen | – |
| Massutskick | Föreslå | **Godkänn/skicka** | – | – | – |
| Röst | – | Administrera | – | **Avlägg egen** | – |
| Röstutfall | Läs | **Fastställ** | – | Läs eget | Läs |
| Protokoll | Läs | Upprätta | Läs | Läs relevanta | **Justera** |
| Revisionsspår | Läs eget ärende | Läs eget ärende | Läs | – | Läs |

### 5.2 Arbetsflöden

**Fordran från anmälan till fastställd**
```
Borgenär anmäler i portal
  → systemet matchar mot bolagets reskontra
  → differens? → uppgift till bolaget "stäm av fordran X"
  → bolaget bekräftar eller bestrider, med skäl
  → rekonstruktören prövar
  → status fastställd | bestridd | delvis medgiven
  → borgenären underrättas automatiskt
  → varje steg i revisionsspåret
```

**Massutskick**
```
Välj mottagare (sparat urval eller filter)
  → välj mall, sammanfoga fält
  → förhandsgranska mot tre verkliga mottagare
  → testutskick till sig själv
  → godkännandesteg (rekonstruktören för formella utskick)
  → skicka
  → leveransstatus per mottagare
  → påminnelse till dem som inte kvitterat efter X dagar
  → utskickslogg arkiveras som dokument
```

**Månadsuppföljning**
```
Period stängs (schemalagt)
  → importera kontoutdrag
  → matcha utfall mot planposter
  → avvikelser över tröskel → uppgift till bolaget
  → bolaget kommenterar avvikelser
  → rapport genereras
  → skickas till rekonstruktören
  → kvittens
  → arkiveras och diarieförs
```

---

## 6. Dokument, rapporter, utskick och beslutshändelser

### 6.1 Dokumenttyper

**Från bolaget.** Ansökan · Borgenärsförteckning · Likviditetsbudget · Balans- och resultaträkning · Årsredovisning · Skattekontoutdrag · Kontoutdrag · Avtalsförteckning · Anställningsförteckning · Kontrollbalansräkning · Styrelseprotokoll

**Från rekonstruktören.** Förordnande · Underrättelse till borgenärer · Rekonstruktionsplan · Redogörelse till rätten · Ansökan om förlängning · Kallelser · Protokoll · Rösträkningsunderlag · Slutredovisning

**Från rätten.** Beslut om rekonstruktion · Beslut om planförhandling · Beslut om fastställelse · Beslut om upphörande · Konkursbeslut

**Från borgenärer.** Fordringsanmälan · Underlag (faktura, avtal, dom) · Bestridande · Fullmakt · Röstsedel

**Övriga.** Lönegarantibeslut · Revisorsgranskning · Värderingar

### 6.2 Utskickstyper

| Utskick | Kanal | Kvittens | Automation |
|---|---|---|---|
| Underrättelse om rekonstruktion | Portal + e-post + brev | Krävs | Halvautomatisk, kräver godkännande |
| Kallelse till sammanträde | Portal + e-post | **Krävs** | Halvautomatisk |
| Uppmaning att anmäla fordran | Portal + e-post | Krävs | Automatisk efter godkänd mall |
| Påminnelse, ej anmäld fordran | E-post + SMS | Nej | **Helautomatisk** |
| Avstämningsförfrågan | Portal | Ja | **Helautomatisk** |
| Besked om fordringsstatus | Portal + e-post | Ja | Automatisk efter fastställelse |
| Månadsrapport | Portal | Ja | **Helautomatisk** |
| Fristvarning internt | Portal + e-post + SMS | Nej | **Helautomatisk** |

### 6.3 Beslutshändelser som måste registreras

Ansökan inlämnad · Rekonstruktion beslutad · Rekonstruktör förordnad · Borgenärssammanträde hållet · Fordran fastställd/bestridd · Förlängning beviljad · Planförhandling beslutad · Plansammanträde hållet · Omröstning genomförd · Plan fastställd/avslagen · Rekonstruktion upphörd · Konkurs beslutad · Ärende avslutat.

Varje händelse bär: datum, beslutsfattare, källdokument, effekt på frister, och vilka uppgifter den utlöser.

---

## 7. Automatiseringar och AI-stöd

### 7.1 Helt automatiserbart — ingen granskning

Fristberäkning ur registrerade beslutsdatum · Påminnelser och eskalering · Leveransstatus och kvittensuppföljning · Summeringar och totaler · Likviditetsprojektion · Runway-larm · Månadsrapportgenerering · Diarienummer · Revisionsloggning · Arkivpaketering med checksummor.

### 7.2 Automatiskt förslag, kräver mänsklig granskning

| Uppgift | Metod | Varför granskning |
|---|---|---|
| Klassificera kontoutdragsposter | Regler + mönster (**finns**) | Felmatchning ger osann rapport |
| Matcha utfall mot planpost | Normaliserad textmatchning | Samma |
| Föreslå fordringsklass | Regler | Prioritet är juridik |
| Dubblettförslag på parter | Org.nr, e-post, namnlikhet | Sammanslagning är destruktiv |
| Extrahera belopp ur uppladdad faktura | OCR + extraktion | Fel belopp i fordringsregister |
| Utkast till borgenärssvar | Språkmodell över ärendedata | Kan bli fel i sak |
| Sammanfatta månadens avvikelser | Språkmodell över siffror | Kan missa det väsentliga |

**Regel för språkmodeller i produkten.** De får skriva utkast och sammanfatta. De får aldrig sätta status, aldrig fastställa belopp, aldrig avgöra en fordran och aldrig formulera ett juridiskt råd som presenteras som slutgiltigt. Varje AI-genererat innehåll ska vara märkt som utkast tills en människa godkänt det, och godkännandet ska ligga i revisionsspåret.

### 7.3 Kräver juridisk bekräftelse — automatisera aldrig

Fordringsprövning · Prioritetsordning · Gruppindelning inför planförhandling · Röstutfall · Bedömning av livskraft · Obeståndsbedömning · Innehållet i formella underrättelser och kallelser · Beslut om att inleda konkurs.

Systemet får förbereda, räkna och presentera underlag för samtliga. Det får inte avgöra någon av dem.

---

## 8. Risk och compliance

### 8.1 Måste loggas

Se §2.10. Kortfattat: varje statusändring, varje utskick, varje åtkomst till annan parts data, varje röst, varje signering, varje export.

### 8.2 Måste versionshanteras

Dokument (aldrig överskrivning) · Likviditetsplaner som lämnats ut · Fordringar vid varje statusändring · Utskicksmallar · Rekonstruktionsplanens utkast · Behörighetstilldelningar.

### 8.3 Måste bekräftas av mottagare

Formella underrättelser · Kallelser · Besked om fordringsstatus · Delgivning av plan.

Kvittens sparas med tidsstämpel, kanal, mottagaridentitet och exakt vilket innehåll som mottogs.

### 8.4 Dataskydd

Personuppgifter om företrädare, anställda och enskilda borgenärer. Kräver: laglig grund per kategori, gallringsschema per dokumenttyp, registerutdrag och radering per part, biträdesavtal med varje underleverantör, dataresidens inom EU/EES, kryptering i vila och i transit.

**Öppen fråga (ANTAGANDE):** i vilken utsträckning uppgifter i ett avslutat rekonstruktionsärende måste bevaras trots begäran om radering, och hur länge. Detta måste utredas juridiskt innan gallringsfunktionen byggs — inte efter.

### 8.5 Systemets fem värsta fel, i ordning

1. **Behörighetsläcka mellan borgenärer.** Portalen förlorar all trovärdighet och blir en incident.
2. **Felaktig rösträkning som presenteras som utfall.** Kan ogiltigförklara en plan.
3. **Missad frist som systemet visade som bevakad.** Direkt ekonomisk skada, sannolikt skadeståndsansvar.
4. **Massutskick till fel mottagarkrets.** Går inte att ta tillbaka.
5. **Bruten beviskedja i dokument.** Underlaget håller inte i efterhand.

Bygg tester för var och en av dessa fem. Prioritera dem över funktionstäckning. Behörighetsreglerna ska ha policytester som körs i CI vid varje ändring.

---

## 9. Processkarta

```
FAS 0  FÖRBEREDELSE
       Triage → KBR → likviditetsplan → skuldsammanställning → val av rekonstruktör
       [FINNS till stor del]
                    │
                    ▼
FAS 1  ANSÖKAN OCH BESLUT                          Frister startar
       Ansökan → förordnande → beslut → underrättelse till borgenärer
                    │
                    ▼
FAS 2  LÖPANDE (3 mån, förlängning i steg om 3 mån)
       ┌───────────────────────────────────────┐
       │ Fordringsanmälningar → avstämning     │
       │ Månadsrapportering plan mot utfall    │  ← störst automationsvinst
       │ Borgenärskommunikation                │  ← störst tidstjuv
       │ Förlängningsansökan var tredje månad  │
       └───────────────────────────────────────┘
                    │
                    ▼
FAS 3  PLAN OCH OMRÖSTNING
       Planutkast → beslut om planförhandling → gruppindelning prövas av rätten
       → plansammanträde (3–5 v efter beslutet) → omröstning (2/3 per grupp, huvudregel)
       → rätten fastställer
                    │
       ┌────────────┼────────────┬──────────────┐
       ▼            ▼            ▼              ▼
FAS 4  Plan       Upphör      Konkurs      Återhämtning
       fastställd  utan plan
       → genomförande, slutredovisning, arkiv, gallringsklocka startar

Yttre gräns: högst 12 månader totalt.
Har rätten beslutat om planförhandling: högst 15 månader från beslutet.
```

---

## 10. Rekommenderad produktstrategi

### 10.1 Bygg detta först — och bara detta

**Fordringsregister + borgenärsportal + kommunikationsmotor.**

Skälet är att den administrativa kostnaden i en rekonstruktion inte ligger i analysen. Den ligger i att hundra borgenärer hör av sig, att ingen lista stämmer, och att någon manuellt svarar på samma fråga hundra gånger. Löser man det försvinner mätbar tid och mätbara arvodeskronor från första ärendet.

Allt annat — scenarier, integrationer, AI — är förbättringar av något som redan fungerar. Detta är skillnaden mellan att fungera och att inte fungera.

### 10.2 Sälj till rekonstruktörsbyrån, inte till bolaget

Bolaget i kris har varken pengar eller uppmärksamhet att köpa mjukvara. Rekonstruktören har båda, hanterar många ärenden parallellt, och tjänar direkt på minskad administration.

Det betyder att **flerärendevyn för byrån** flyttar fram i prioritet — den är en säljförutsättning, inte en v3-funktion. Bolagets vy förblir gratis och är det som får rekonstruktören att vilja ha verktyget: kunden kommer förberedd.

Detta rimmar med intäktsmodellen som redan är byggd: fast avgift per förmedlat ärende, fakturerad i efterskott, ingen betalväxel. Se `referrals` och `referral_billing_basis`.

### 10.3 Sekvens

| Steg | Innehåll | Utfall |
|---|---|---|
| 1 (4 v) | Fleranvändarmodell, roller, revisionsspår | Fundamentet. Inget syns utåt. |
| 2 (4 v) | Fordringsregister + import + avstämning | Första verkliga nyttan |
| 3 (3 v) | Borgenärsportal, minimal | Inkommande mejl minskar |
| 4 (3 v) | Kommunikationsmotor med kvittens | Utgående administration minskar |
| 5 (2 v) | Uppgifter, frister, dashboard mot verklig data | Kittet |
| **Pilot** | **Ett verkligt ärende med en verklig rekonstruktör** | **Enda validering som räknas** |
| 6+ | v2 enligt §3 | |

### 10.4 Innan en enda rad produktionskod skrivs

1. **Juridisk granskning av det som finns idag.** Krisanalysen ger frister om personligt betalningsansvar. Under den här sessionens genomgång hittades en påhittad sexveckorsfrist för kontrollstämma i KBR-modulen. Den typen av fel måste hittas av en jurist, inte av tur.
2. **Migrationerna körda mot en riktig databas.** De fyra migrationerna i `supabase/migrations/` har aldrig applicerats. RLS-policyerna är otestade mot verklig auth.
3. **Beslut om backend.** AWS-riktningen finns men adaptern är inte skriven. Fleranvändarmodellen ska designas mot rätt backend, inte migreras dit.
4. **En rekonstruktör som pilotpartner, inskriven i planen.** Utan någon som säger "så här går det faktiskt till" byggs fel sak väldigt effektivt.

### 10.5 Vad som gör att detta misslyckas

Att bygga alla tretton moduler tunt istället för fyra ordentligt. Att sälja till bolaget istället för till byrån. Att låta systemet uttala sig i juridiska frågor. Att skjuta upp revisionsspår och behörigheter till "senare" — båda är omöjliga att retroaktivt införa på ett trovärdigt sätt.

---

## Källor för verifierade uppgifter

- [Lag (2022:964) om företagsrekonstruktion](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-2022964-om-foretagsrekonstruktion_sfs-2022-964/)
- [Sveriges Domstolar – Detta händer vid en företagsrekonstruktion](https://www.domstol.se/amnen/skulder-konkurs-och-foretagsrekonstruktion/foretagsrekonstruktion/detta-hander-vid-en-foretagsrekonstruktion/)
- [Konkurslag (1987:672)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/konkurslag-1987672_sfs-1987-672/)
- [Lönegarantilag (1992:497)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lonegarantilag-1992497_sfs-1992-497/)
- Belopp och lagrum som används i produkten: `src/lib/officialFigures.ts`, senast kontrollerade 2026-07-31
