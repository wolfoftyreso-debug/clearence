# Clearance Beta – prismodell

**Version 1.0 · Beslutad. Beloppet är en driftparameter (app_settings:
company_plan) - det står ingenstans i koden.**

## Planen

**Clearance Beta: 985 kr/månad exklusive moms.** Mot aktiebolag anges
priset alltid exklusive moms.

* Månadsvis faktura.
* Ingen bindningstid.
* Uppsägning när som helst.
* Tillgång till tjänsten under den betalda perioden.
* **Alla data sparas även om abonnemanget pausas.** Frysningslöftet
  gäller: stängt betyder utestängd, aldrig raderad.

## Rättviseprincipen

Målgruppen är pressad. Modellen får därför aldrig kännas som en
inlåsning: allt skapande är öppet från början, arbetet finns alltid
kvar, och uppgraderingen är naturlig - inte ett gisslanläge. Priset
placerar produkten som ett professionellt affärsverktyg: lågt mot
värdet av ETT undviket misstag eller några sparade timmar per månad.

## Före första betalningen (provläget)

**Öppet:** full onboarding, samtalet med rådgivaren, grundläggande
analys, skapa dokument, testa integrationer, se handlingsplanen.

**Väntar på första betalningen:** export av dokument och
ärendehistorik, delning med externa rådgivare, fristkalendern till
eget kalenderprogram, signeringsflöden, versionshistorik, avancerade
rapporter.

I kod: `firstPaymentDone()` i src/lib/pricing.ts är hela frågan, och
`LockedFeature` är betalväggens enda utseende - samma ord överallt,
med priset ur driftparametern.

## Nivåerna (beslutade; Business/Enterprise lanseras stegvis)

* **Clearance Start – Gratis.** Kallas ALDRIG provversion (en
  provversion förväntas vara gratis eller hårt begränsad - Start ÄR
  gratis, för att uppleva produkten). Samtal, grundläggande analys,
  dokument. Ingen export, ingen delning, ingen ekonomisystemskoppling.
* **Clearance Standard – 985 kr/mån + moms.** Små och medelstora
  företag: obegränsad dialog, dokumentgenerering och arkiv,
  ärendehistorik, export, delning, e-post till rådgivare. Ingen
  ekonomisystemskoppling.
* **Clearance Business – 2 780 kr/mån + moms.** Större komplexitet:
  flera användare och bolag, ekonomisystemskoppling (Fortnox/Visma
  när avtalen är på plats), behörighetsstyrning, styrelseportal,
  avancerade arbetsflöden, utökade integrationer, prioriterad support.
* **Clearance Enterprise – 4 500 kr/mån + moms, eller offert.**
  Ekonomisystemskoppling, anpassade integrationer, API, fler roller,
  avancerad loggning, dedikerad onboarding, anpassad support.

Ekonomisystemskopplingen ligger ENDAST i Business och Enterprise
(uttrycklig begäran, vaktad av tests/pricingModel.ts).

**Nivåerna knyts till funktioner, användare och integrationsbehov -
aldrig till omsättning.** Två bolag med samma omsättning kan ha helt
olika behov. Alla belopp är driftparametrar i app_settings.

Rådgivaren hanterar även faktureringen i samtalet: "Visa min faktura"
ger fakturakortet (nummer, belopp, förfallodatum, status) direkt i
dialogen, och allt finns alltid också under Inställningar - resultatet
hamnar på rätt plats utan att användaren sorterar. Byråsidans planer
(Advisor-spåret) finns redan som driftparametrar per byrå.

## Dokumentarkivet och godkännandena (nästa byggen)

Projektrum, inte filsystem: varje dokument bär senast ändrat, av vem,
status (Utkast / För granskning / Godkänt), delat med och version.
Delning per person med behörighet (läs / kommentera / redigera /
godkänna), och godkännandeflödet där rådgivaren meddelar: "Björn har
godkänt prognosen - jag föreslår att vi går vidare med nästa steg."
Aktivitetsloggen finns redan (händelseloggen) och är ryggraden.
