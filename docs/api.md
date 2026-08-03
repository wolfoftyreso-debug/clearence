# Öppet API

**Version 1.1 · Kontraktet finns i api/openapi.json, renderas publikt på /api och vaktas av
tester. Status per resurs: `live` (körbar idag) eller `beta`
(kontrakt-först, implementeras bakom samma kontrakt).**

## API-first

CLEARANCE är inte en sluten app - det är en plattform som kopplas in i
befintliga arbetsflöden. Principen: **allt som går att göra i
gränssnittet ska gå att göra via API.** Externa system ska kunna
skapa, läsa, uppdatera och avsluta ärenden utan att öppna appen.

Grunden är redan byggd: hela produkten går genom EN portyta
(DataPort i src/data/ports.ts) - gränssnittet har inga egna bakvägar
till datat. REST-API:et är samma kontrakt exponerat utåt, och
live-ärendelänken (`GET /v1/shared/{token}`) är den första publika,
maskinläsbara resursen i drift.

## Integrationsexempel

Ett öppet, väldokumenterat REST-API (kompletterbart med andra mönster
vid behov) för integration med exempelvis:

* Byråernas ärendesystem (rekonstruktörer, förvaltare, revisorer)
* Ekonomisystem (Fortnox, Visma - SIE-import finns redan)
* CRM- och DMS-system
* Tidredovisning och fakturering
* Försäkringsbolag och skaderegleringssystem
* Banker och kreditsystem (kreditunderlaget som strukturerad data)
* Domstols- och myndighetsförberedelser via mottagarens egna system

## Resurser (v1-kontraktet)

Byggda på de fyra objekten + ärendet:

* **Ärenden** - skapa, hämta, uppdatera, avsluta (med orsak), arkivera.
* **Journal/arbetslogg** - läsa, filtrera (typ, tidsintervall), exportera.
  Läsningen är **live idag** (api_journal): autentiseras med API-nyckel,
  okänd/återkallad nyckel och ärenden utan åtkomst får samma tystnad,
  varje verifierat anrop stämplar nyckelns last_used_at, och raderna
  levereras utan before/after-ögonblicksbilder.
* **Dokument** - ladda upp, hämta, granskningsstatus
  (utkast/för granskning/godkänt), versionering (planerad).
* **Beslut** - läsa, protokollföra med premiss, ompröva (aldrig ändra).
* **Uppgifter** - läsa, uppdatera, bocka av.
* **Rapporter** - generera, hämta (JSON/PDF ur samma datamodell).
* **Delningslänkar** - skapa, lista, återkalla; mottagarens läsning
  är `GET /v1/shared/{token}` - live idag.

## Realtid

Plattformen ska kunna skicka händelser (webhooks) i stället för att
tvinga mottagare att fråga kontinuerligt, exempelvis när:

* ett dokument laddas upp eller godkänns,
* ett ärende ändrar status eller avslutas,
* ett beslut protokollförs eller omprövas,
* en rapport färdigställs,
* en uppgift bockas av.

Händelserna är deklarerade i kontraktets `webhooks`-avsnitt.
Journalens append-only-modell är källan - varje händelse finns redan
som journalrad, webhooken är bara leveransen.

## Utvecklarupplevelse

* OpenAPI-dokumentation (api/openapi.json - kontraktet ÄR specen).
* Exempelanrop i dokumentationen.
* Testmiljö (sandbox) - demoadapterns datamodell är grunden.
* Versionshantering: /v1-prefix; brytande ändringar kräver ny version.
* Tydliga felkoder: strukturerade fel `{ code, message }` med
  dokumenterad koduppsättning.
* Stabil bakåtkompatibilitet inom en version - fält läggs till,
  aldrig bort.

## Behörighet och gränser

* API-nycklar per organisation, hanterade i driftens valv (samma
  regler som övriga nycklar: aldrig läsbara i efterhand, bara utbytbara).
* Samma radskydd som appen: API:t ser exakt det kontots roller ser -
  borgenärsisoleringen, teamgränserna och betalväggen gäller även här.
* Samma datagräns som live-länken: API:t levererar strukturerad,
  spårbar ärendedata - **aldrig automatiska bedömningar**. Mottagarens
  system drar sina egna slutsatser.

## Plattform, inte bara app

Den långsiktiga visionen: CLEARANCE är den gemensamma
dokumentations- och samordningsmotorn vid företagskris. Appen är ett
av gränssnitten. Byråer, banker, försäkringsbolag och myndighetsnära
system ska kunna starta ärenden, läsa status, hämta journal, ta emot
rapporter och följa ärenden i realtid - utan att ändra sina
kärnsystem. Det är en arkitekturprincip från version ett, inte ett
tillägg.
