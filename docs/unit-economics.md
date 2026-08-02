# UNIT ECONOMICS – CLEARANCE V1.0

**Kundresans ekonomi, händelse för händelse.**

Economic Model v1.0 beskriver affären på makronivå. Det här dokumentet följer
**en enskild resa** genom systemet och visar var pengar tjänas, var de förloras,
var payback inträffar och vilka funktioner som ger högst avkastning per byggd
krona. Samma märkningsdisciplin: **[FAKTA]**, **[ANTAGANDE]**,
**[RÄKNEEXEMPEL]**.

**Två enheter, inte en.** Ekosystemet har två återkommande atomer:
*företagsresan* (transient, från krissignal till exit) och *byrårelationen*
(varaktig, från verifiering genom många ärenden). Unit economics utan
byråenheten hade missat halva affären.

**Exempel-basen** (identisk med Economic Model §6, [RÄKNEEXEMPEL] – inte
priser): A = 500 kr/mån företagsabonnemang · U = 1 000 kr/upplåsning ·
H = 200 kr/mån hälsonivå · CAC_a = 50 kr per genomförd gratisanalys
[ANTAGANDE – innehållsdriven anskaffning, ingen betald annonsering antagen] ·
rörlig systemkostnad < 5 kr/mån [FAKTA-nära] · support ~10 kr/aktiv månad
[ANTAGANDE].

---

## 1 · Resa 0: Tittaren (gratis analys, inget konto)

| Händelse | Kostnad | Intäkt | Ackumulerat |
|---|--:|--:|--:|
| Hittar CLEARANCE, läser kunskapsbank | ~0 | 0 | 0 |
| Genomför gratis nulägesanalys | CAC_a 50 + drift ~0 [FAKTA: motorn kostar 0] | 0 | **−50** |
| Lämnar utan konto | 0 | 0 | **−50** |

**Läsning:** tittaren är den enda strukturellt förlustbringande resan – och
förlusten är liten och medveten (förtroendebygget). Med konvertering
analys→konto = q bär varje betalande resa 1/q tittare. Vid q = 20 %
[ANTAGANDE → KPI byggd] belastas varje riktig resa med 4 × 50 = 200 kr
anskaffning. **Steg 3→4-konverteringen är därför den enda punkt där
"förlorade pengar" uppstår – och den optimeras med produkt (autospar,
rapportens kvalitet), inte med rabatter.**

---

## 2 · Resa 1: Snabb stabilisering (kort, lyckad)

L_kris = 3 mån · 1 förfrågan, 1 upplåsning · ingen hälsokonvertering.

| # | Händelse | Kostnad | Intäkt | Ackumulerat |
|---|---|--:|--:|--:|
| 1 | Anskaffning (inkl. tittarandel, q=20 %) | 250 | 0 | −250 |
| 2 | Gratisvecka + konto | ~5 | 0 | −255 |
| 3 | Månad 1 | 15 | 500 (A) | **+230 ← payback** |
| 4 | Rådgivarkontakt → byrån låser upp | ~0 [FAKTA: automatiserat] | 1 000 (U, byråsidan) | +1 230 |
| 5 | Månad 2–3 | 30 | 1 000 | +2 200 |
| 6 | Exit: stabiliserad, aktexport | ~0 | 0 | **+2 200** |

**Payback under månad 1.** Ingen kredittung anskaffning, inget säljled –
produkten säljer sig genom gratisanalysen.

---

## 3 · Resa 2: Lyckad rekonstruktion + hälsonivå (G6-vinnaren)

L_kris = 8 mån · 2 upplåsningar (rekonstruktör + revisor) · 2 premiumhändelser
(netto +10 kr/st efter tredjepartskostnad [ANTAGANDE]) · hälsonivå 18 mån.

| # | Händelse | Kostnad | Intäkt | Ackumulerat |
|---|---|--:|--:|--:|
| 1 | Anskaffning | 250 | 0 | −250 |
| 2 | Månad 1 (KBR-läge konstateras) | 15 | 500 | +235 |
| 3 | Upplåsning: rekonstruktör | ~0 | 1 000 | +1 235 |
| 4 | Månad 2–4 (ansökan, förhandling) | 45 | 1 500 | +2 690 |
| 5 | Upplåsning: revisor | ~0 | 1 000 | +3 690 |
| 6 | 2 BankID-signeringar (netto) | – | +20 | +3 710 |
| 7 | Månad 5–8 (plan fastställs, genomförs) | 60 | 2 000 | +5 650 |
| 8 | Exit ur krisen → **konvertering till hälsonivån** | ~0 | 0 | +5 650 |
| 9 | Hälsonivå 18 mån (bevakning veckovis inbakad [designval EM §1.2]) | ~180 | 3 600 (H) | **+9 070** |

**Total resa ≈ 9 100 kr** [RÄKNEEXEMPEL] – varav 38 % efter krisen.

---

## 4 · Resa 3: Konkurs (misslyckandet)

L_kris = 2 mån · 1 upplåsning (förvaltarkontakt) · ingen hälsofas ·
månadsavgift månad 2 efterskänkt vid konkursbeslut [designfråga A1, antagen ja].

| # | Händelse | Kostnad | Intäkt | Ackumulerat |
|---|---|--:|--:|--:|
| 1 | Anskaffning | 250 | 0 | −250 |
| 2 | Månad 1 | 15 | 500 | +235 |
| 3 | Upplåsning: förvaltare | ~0 | 1 000 | +1 235 |
| 4 | Månad 2 (konkursbeslut; avgift 0) | 15 | 0 | +1 220 |
| 5 | Exit: akten exporteras till förvaltaren | ~0 | 0 | **+1 220** |

**G6 bevisad på enhetsnivå [RÄKNEEXEMPEL på FAKTA-struktur]:**

| Utfall | Total marginal | Relation |
|---|--:|---|
| Lyckad rekonstruktion + hälsa | ≈ 9 100 kr | **7,5× konkursen** |
| Snabb stabilisering | ≈ 2 200 kr | 1,8× |
| Konkurs | ≈ 1 220 kr | 1× (och ändå inte förlust) |

Ingen resa är förlustbringande, men framgång är strukturellt mångfalt mer värd
– utan att någon avgift höjts för att kunden mår dåligt (G3 intakt).

---

## 5 · Enheten byrårelationen

| # | Händelse | Kostnad | Intäkt | Ackumulerat |
|---|---|--:|--:|--:|
| 1 | Ansökan/anspråk + manuell KYC-granskning | ~1 000 (1–2 h persontid [ANTAGANDE]) | 0 | −1 000 |
| 2 | Profil verifierad, byråprofil aktiv | ~0 | 0 | −1 000 |
| 3 | Första upplåsningen | ~0 | 1 000 | **0 ← payback vid första värdehändelsen** |
| 4 | Löpande: n upplåsningar/år, samlingsfaktura | ~1–3 % kreditförlust | n × 1 000 | växer linjärt |
| 5 | År 2+: abonnemang eller licens | support | månadsavgift | – |

**Läsning:** byråenheten har engångskostnad (KYC) och därefter ~95 % marginal
per händelse [EM §5]. Vid n = 6 upplåsningar/år är relationen värd ~6 000 kr/år
mot ~1 000 kr i totala kostnader. **KYC-persontiden är den enda
skalbegränsningen** – därav BankID-automation som framtida investering med
direkt enhetsavkastning.

---

## 6 · Var tjänas, var förloras, vad optimeras

| Fråga | Svar ur journalerna |
|---|---|
| **Var förloras pengar?** | Endast i tittarledet (−50 kr/analys som inte konverterar) och byråers KYC före första upplåsning. Båda är medvetna investeringar med känd payback-mekanism. |
| **Var tjänas de?** | Månad 1 på företagssidan (payback direkt), varje upplåsning (ren marginal), och – störst per resa – hälsonivån. |
| **Vilka steg måste optimeras?** | (1) Analys→konto-konverteringen q: enda hävstången mot anskaffningsförlusten. (2) Upplåsningsgraden f: varje procentenhet är ren marginal. (3) Kris→hälsa-konverteringen k: 38 % av G6-vinnarresans värde. |
| **Vilka funktioner ger högst avkastning per byggd krona?** | 1. **Förhandsvisningen** (byggd, testad) – driver f. 2. **Hälsonivån** (obyggd) – störst obelånad RLV-term; nu även enhetsbevisad. 3. **Gratisanalysens rapportkvalitet** (byggd) – driver q. 4. **BankID-automation av KYC** (avtal) – löser den enda skalgränsen. |
| **Payback-punkter** | Företagsresan: månad 1. Byrårelationen: första upplåsningen. Ingen enhet kräver månader av tålamod – ovanligt för plattformsaffärer och en direkt följd av noll marginalkostnad [FAKTA]. |

---

## 7 · Vad piloten ska mäta på enhetsnivå

| Parameter | Journalpunkt | Mätpunkt finns? |
|---|---|---|
| q (analys→konto) | Resa 0→1 | ✅ |
| Faktisk CAC_a | Resa 0 | ⬜ kräver kanalmätning |
| f, upplåsningar/resa | Steg 4 | ✅ |
| Månader till exit + exitorsak | Sista raden | ⬜ exitorsak (bygglucka) |
| k (kris→hälsa) | Resa 2 steg 8 | ⬜ kräver hälsonivån |
| KYC-timmar/byrå | Byråenhet steg 1 | Manuell loggning i pilot |

---

*Underlag: Economic Model v1.0 (parametrar och märkningar), Revenue
Architecture v1.0 (G3/G6, RLV), plattformen per commit `11525d2`. Alla
journaler är räkneexempel på byggd struktur – piloten byter siffrorna,
strukturen består.*
