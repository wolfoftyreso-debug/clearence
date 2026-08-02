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

## Framtida nivåer (planerade, byggs inte i betan)

* **Clearance Standard** - dagens plan.
* **Clearance Pro** - fler integrationer, fler användare, avancerade
  funktioner.
* **Clearance Advisor** - för jurister, revisorer och rekonstruktörer
  med flera klientföretag (byråsidans planer finns redan som
  driftparametrar per byrå).

För betalanseringen kommuniceras EN plan. Enkelt att förstå, enkelt
att lita på.

## Dokumentarkivet och godkännandena (nästa byggen)

Projektrum, inte filsystem: varje dokument bär senast ändrat, av vem,
status (Utkast / För granskning / Godkänt), delat med och version.
Delning per person med behörighet (läs / kommentera / redigera /
godkänna), och godkännandeflödet där rådgivaren meddelar: "Björn har
godkänt prognosen - jag föreslår att vi går vidare med nästa steg."
Aktivitetsloggen finns redan (händelseloggen) och är ryggraden.
