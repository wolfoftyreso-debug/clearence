# ECONOMIC MODEL – CLEARANCE V1.0

**Vad ekonomin måste klara – innan någon sätter en krona.**

Dokumentet besvarar de sex frågorna: cost-to-serve, break-even, ärendets
livslängd, värdehändelser per företag, återkommandegrad och bruttomarginal per
ström. Metoden är en **parametriserad modell**: varje tal är märkt
**[FAKTA]** (mätt/känt), **[ANTAGANDE]** (ersätts av pilot/avtal) eller
**[RÄKNEEXEMPEL]** (illustrerar formeln – *inte* ett pris eller en prognos).
Prissättning görs i ett senare dokument; här definieras ramarna den måste
uppfylla.

Underlag: CONTROL PLAN V1.0, Revenue Architecture v1.0 (grundsatserna G1–G6,
RLV) samt plattformen per commit `a23b7fc`.

---

## 1 · Cost-to-serve: vad kostar en genomsnittlig kund att drifta?

### 1.1 Fasta kostnader (oberoende av kundantal, per månad)

| Post | Nivå | Märkning |
|---|---|---|
| Infrastruktur bas (RDS liten instans, S3, SES, beräkning, backup, miljöer) | ~2 000–4 000 kr/mån vid pilotskala | [ANTAGANDE] – AWS-prislista, låg volym |
| Drift/granskning (ansökningar, profilanspråk/KYC, support, fakturafrågor) | Grundarens tid i pilot; 0,25–0,5 heltid vid ~50 aktiva ärenden | [ANTAGANDE] |
| Redovisning, försäkring, domän, övrigt | ~1 500–3 000 kr/mån | [ANTAGANDE] |
| **Fast bas F** | **~5 000–10 000 kr/mån + persontid** i pilot | |

Programvarulicenser: **0 kr** [FAKTA] – ingen Supabase-licens (självhostat),
ingen LLM, egen PDF-motor, inga tredjepartsbibliotek med avgift.

### 1.2 Rörlig kostnad per aktivt företagsärende och månad

| Post | Formel | Nivå | Märkning |
|---|---|---|---|
| Beräkning/lagring/e-post | marginell | < 5 kr | [ANTAGANDE, konservativt] |
| Kreditbevakning | c_cs × 30 slagningar (max 1/dygn [FAKTA – byggd spärr]) | c_cs = avtalsfråga; 2–10 kr/slagning ger 60–300 kr/mån | [ANTAGANDE → ersätts av avtal] |
| Analyser, rapporter, PDF:er, notiser | 0 × obegränsad användning | **0 kr** | [FAKTA – deterministiska motorer] |
| Signering | Egen, ingen styckkostnad | 0 kr/händelse | **Byggd** (docs/signering.md) |
| **Rörlig kostnad V_f** | | **< 5 kr utan bevakning; 65–305 kr med daglig bevakning** | |

**Slutsats 1:** kreditbevakningen är hela den rörliga kostnadsbilden på
företagssidan. Den ska därför vara (a) premiumtillval eller (b) inkluderad med
frekvensstyrning (t.ex. veckovis i grundnivån, daglig i hälsonivån/premium) –
ett produktbeslut modellen flaggar, inte avgör.

### 1.3 Rörlig kostnad per värdehändelse (byråsidan)

| Post | Nivå | Märkning |
|---|---|---|
| Upplåsning/förmedling: systemkostnad | ~0 kr (rader + samlingsfaktura, allt automatiserat [FAKTA]) | [FAKTA] |
| Verifiering av ny byrå (engång): manuell KYC | 0,5–2 h persontid | [ANTAGANDE] |
| Tvister/kreditförluster på byråfakturor | 1–3 % av fakturerat | [ANTAGANDE] |

---

## 2 · Ärendets förväntade livslängd

| Situationssegment | Aktiv krisfas | Grund | Märkning |
|---|---|---|---|
| Stabilisering (utan formellt förfarande) | 2–4 mån | Erfarenhetsantagande | [ANTAGANDE] |
| KBR-läge (kontrollbalansprocessen) | 3–8 mån | Lagens spår: KBR → stämma 1 → åtta månaders läkningsfrist → stämma 2 [FAKTA om fristerna] | Blandad |
| Företagsrekonstruktion | 3–12 mån | Lagens hållpunkter: 3 mån + förlängningar upp till 12 [FAKTA] | Blandad |
| Konkursnära → konkurs | 1–2 mån aktiv för bolaget (därefter förvaltarens ärende) | [ANTAGANDE] | |
| **Viktad förväntad krisfas L_kris** | **~4–6 månader** | Mixantagande: 40/30/20/10 % | [ANTAGANDE] |
| Hälsofas efter krisen L_hälsa | 12–24+ mån för de som konverterar | [ANTAGANDE] | |

**G6-koppling [FAKTA om strukturen]:** rekonstruktion (3–12 mån, många
värdehändelser, hälsofas efteråt) ger strukturellt längre intäktsliv än konkurs
(1–2 mån, inga efterföljande termer). Modellen tjänar mer när kunden lyckas –
utan att någon parameter behöver trimmas för det.

---

## 3 · Värdehändelser per företagsärende

| Parameter | Beskrivning | Intervall | Märkning |
|---|---|---|---|
| V = förfrågningar per ärende | Företaget kontaktar rådgivare via katalogen | 1–3 | [ANTAGANDE → KPI finns byggd] |
| f = upplåsningsgrad | Andel förfrågningar byrån låser upp | 40–70 % | [ANTAGANDE → mäts i `contact_requests.status`] |
| **V × f = fakturerbara värdehändelser per ärende** | | **0,4–2,1** | |
| Premiumhändelser per ärende (signeringar m.m.) | | 0–5 | [ANTAGANDE] |

Konservativ modellpunkt: **1,0 värdehändelse per företagsärende**.

---

## 4 · Återkommandegrad efter krisen (hälsonivån)

| Parameter | Intervall | Märkning |
|---|---|---|
| k = andel stabiliserade bolag som konverterar till hälsonivån | 20–40 % av *lyckade* utfall | [ANTAGANDE – branschriktvärde för "grateful cohort", valideras i pilot] |
| Andel lyckade utfall av alla ärenden | 40–60 % | [ANTAGANDE – beror på hur tidigt bolagen kommer in; tidig ankomst är hela produktens tes] |

Kräver att **exitorsak registreras** (bygglucka, beslutspunkt 7 i RA) och att
**hälsonivån byggs** (medveten produktlucka). Utan hälsonivån är k = 0 och RLV
tappar sin fjärde term – det är den ekonomiska motiveringen för att bygga den.

---

## 5 · Bruttomarginal per intäktsström

| Ström | Intäktsbas | Direkta kostnader | Bruttomarginal | Märkning |
|---|---|---|---|---|
| A · Företagsabonnemang | A × L_kris | < 5 kr/mån utan bevakning | **~90–97 %** | [FAKTA om kostnadssidan] |
| B · Värdehändelser byrå | U per upplåsning | ~0 rörligt; KYC engång; 1–3 % kreditförlust | **~85–95 %** | Blandad |
| C · Premiumhändelser | självkostnad + marginal | tredjepartspris dominerar | **~30–60 %** (designval) | [ANTAGANDE → avtal] |
| D · Enterprise/licens | licens | support/SLA-tid | **~80–90 %** vid volym | [ANTAGANDE] |

**Slutsats 2:** strömmarna A och B är strukturella höjdare tack vare
nollmarginalkostnaden på analyser [FAKTA]. Ström C ska aldrig jaga marginal –
dess uppgift är att täcka sina kostnader och göra A/B värdefullare (G-satsernas
anda: transparent självkostnad + skälig marginal).

---

## 6 · Break-even: formel och räkneexempel

**Formeln (den bestående leveransen – exemplen är utbytbara):**

```
Täckningsbidrag per aktivt företagsärende och månad:
  TB = A − V_f                              (ström A)
     + (V × f × U) / L_kris                 (ström B, utslagen per månad)
     + C_netto + D_andel                    (försiktigt: sätts till 0 i pilotmodellen)

Break-even (antal samtidiga aktiva ärenden):
  N* = F / TB
```

**[RÄKNEEXEMPEL – illustrerar formeln, är inte priser eller prognoser]**
Med F = 8 000 kr/mån, V_f ≈ 0 (bevakning som premium), L_kris = 5 mån,
V × f = 1,0 per ärende:

| Scenario | A (kr/mån) | U (kr/upplåsning) | TB/ärende/mån | N* samtidiga ärenden |
|---|---|---|---|---|
| Försiktigt | 300 | 500 | 300 + 100 = 400 | **20** |
| Bas | 500 | 1 000 | 500 + 200 = 700 | **~12** |
| Ambitiöst | 800 | 1 500 | 800 + 300 = 1 100 | **~8** |

Läsningen är inte talen utan **storleksordningen**: break-even vid pilotskala
ligger på *tiotals samtidiga ärenden, inte hundratals* – tack vare noll
marginalkostnad på analyser och automatiserad fakturering. Persontiden
(granskning/support) är den verkliga begränsningen och skalar med byråsidans
tillväxt, där intäkten också finns.

**RLV i samma exempel-bas:** 500×5 + 1 000×1 + 0 + (H=200 × 18 mån × k=0,3)
≈ **4 580 kr per företagsresa** – varav en fjärdedel efter krisen. Det är G6 i
siffror: hälsonivån är inte en bisyssla, den är fjärdedelen.

---

## 7 · Känslighetsanalys: vad flyttar modellen mest?

| Parameter | Effekt på ekonomin | Var den avgörs |
|---|---|---|
| **f (upplåsningsgrad)** | Störst hävstång på ström B; dubblad f ≈ dubblad B-intäkt utan ny kostnad | Förhandsvisningens kvalitet [byggd] + byråtäthet → pilot |
| **U (upplåsningsavgift)** | Direkt B-hävstång; sätts per byrå [byggd parameter] | Betalningsviljeintervjuer |
| L_kris | Längre ärende = mer A-intäkt men långsammare B-omsättning | Mäts från dag 1 [byggd data] |
| k (hälsokonvertering) | Hela RLV-term 4 | Kräver hälsonivån byggd |
| c_cs (Creditsafe) | Enda kostnadsposten som kan störa A-marginalen | Avtal |
| Persontid per KYC/granskning | Skalgräns för byråsidans tillväxt | Processdesign och fler granskare |

---

## 8 · Vad piloten ska ersätta

| Antagande i detta dokument | Ersätts av | Finns mätpunkten? |
|---|---|---|
| V, f, tid-till-upplåsning | Pilotens `contact_requests` | ✅ byggd |
| L_kris per segment | Ärendens faktiska livslängd | ✅ byggd (skapad→exit; exitorsak saknas) |
| Andel lyckade utfall, k | Exitorsak + hälsonivå | ⬜ två byggluckor |
| c_cs, c_id | Avtal | ⬜ förhandling |
| A- och U-nivåernas acceptans | Betalningsviljeintervjuer + pilot | Guider kan tas fram nu |
| Persontid per granskning | Driftens tidsloggning under pilot | Manuell notering räcker |

---

## 9 · Slutsatser

1. **Ekonomin bär vid liten skala.** Break-even mäts i tiotals samtidiga
   ärenden [RÄKNEEXEMPEL-nivå], eftersom marginalkostnaden på kärnvärdet är
   noll [FAKTA] och faktureringen är automatiserad [FAKTA].
2. **Byråsidan är hävstången, företagssidan är golvet.** A-strömmen täcker
   basen; B-strömmens f och U avgör lönsamheten. Det bekräftar Revenue
   Architecture-tyngdpunkten.
3. **G6 håller strukturellt.** Rekonstruktion slår konkurs i varje term utan
   parametertrim; hälsonivån är den enskilt största outnyttjade RLV-termen och
   bör därför byggas före Prissättning v1.0.
4. **Tre saker stör kalkylen om de ignoreras:** Creditsafe-avtalet
   (A-marginalen), KYC-persontiden (B-skalningen), avsaknad exitorsak
   (G6 går inte att bevisa).

*Nästa steg enligt prioriteringen: betalningsviljeintervjuer (guiderna kan
skrivas ur värdedrivarna i CONTROL PLAN DEL 6) → pilot → Prissättning v1.0.*
