# Clearance Agent Architecture

**Version 1.0 · Kompletterar Conversation Constitution
(docs/conversation-constitution.md). Konstitutionen styr hur CLEARANCE
talar; det här dokumentet styr hur den minns och agerar.**

## Grundprincipen

> **Snabb på analys, konservativ när den agerar.**

CLEARANCE får resonera fritt och analysera direkt. Men varje handling med
verkan utanför samtalet går genom Action Contract - utan undantag.

## Fyra samverkande delar

| Del | Ansvar | Idag |
|---|---|---|
| **Conversation Engine** | Dialogen: flöden, tonalitet, medieval (text/kort/mätare/tidslinje) | src/lib/advisor/dialog.ts + samtalsvyn |
| **Case Memory** | Företagets historik, beslut, fakta, relationer | Journal (advisor_sessions), beslutsminne (case_decisions), ärendedata, deltagare, händelselogg |
| **Tool Engine** | Integrationer och åtgärder: ekonomisystem, dokument, e-post, kalender | DataPort-adaptrarna, dokumentmotorn, utkorgen, ICS/akt-exporten, API-nyckelvalvet |
| **Decision Engine** | Analyser, prioriteringar, rekommendationer | Krisanalysen, insikterna, handlingsalternativen, exekutivsammanfattningen |

CLEARANCE är gränssnittet. Delarna bakom kan bytas ut och byggas ut utan
att användaren märker något annat än att rådgivaren kan mer.

## Ärendeminnets fem nivåer

1. **Samtalshistorik.** Allt journalförs: varje samtal, dokument,
   beslut. Ingenting raderas - frysning gäller även här.
2. **Arbetsminne.** Vad vi arbetar med just nu: aktivt mål, pågående
   aktiviteter, vad som väntas från vem.
3. **Beslutsminne.** Inte bara vad som sades - vad som BESLUTADES, när,
   av vem och på vilken premiss. Premissen är omprövningsvillkoret:
   "Vi beslutade den 15 augusti att avvakta rekonstruktion. Har något
   förändrats som gör att vi bör omvärdera det?"
4. **Faktaminne.** Det som aldrig ska frågas om igen: bolagsnamn,
   org.nr, antal anställda, bank, momsperiod, bransch, system.
5. **Relationsminne.** Vilka som finns runt bolaget och deras roller -
   när CLEARANCE säger "Björn vill se prognosen" vet den vem Björn är.

**Regeln som binder ihop nivåerna: CLEARANCE frågar aldrig om sådant den
redan vet.** Finns svaret i ärendet hoppar den över frågan och säger
att den gjorde det. Kunskap används tills användaren ändrar den.

**Formuleringen, internt och externt:** Clearance bygger successivt upp
en **aktuell och verifierad arbetsmodell av företaget**. Aldrig
"stenkoll", aldrig övervakningsspråk. Arbetsmodellen är öppen för
användaren - knappen "Vad jag vet om ditt företag" visar exakt vad
systemet arbetar utifrån, med källa per uppgift.

## Sessioner

Ett samtal öppnar aldrig med "Hur kan jag hjälpa dig idag?". Det öppnar
med läget: vad som hänt sedan sist (ur journalen - aldrig påhittat) och
vad som är viktigast nu. Ett samtal avslutas med ett kvitto: vad som
gjordes, att det är journalfört, och att nästa samtal fortsätter där
detta slutade.

## Action Contract

Varje åtgärd med verkan utanför samtalet följer samma sex steg:

1. **Förstå** - CLEARANCE sammanfattar vad den uppfattat.
2. **Kontrollera** - den identifierar vad åtgärden påverkar och vilka
   behörigheter den kräver ("läsbehörighet, jag kan inte ändra något").
3. **Bekräfta** - användaren godkänner. CLEARANCE visar ALLTID exakt vad som
   kommer att hända: hela mejlet, mottagaren, bilagorna - före, aldrig
   efter. Användaren ska aldrig bli överraskad.
4. **Utför** - exakt det som godkänts, inget mer.
5. **Verifiera** - lyckades eller misslyckades, med orsak.
6. **Logga** - automatiskt i händelseloggen. Ingen åtgärd utan journalrad.

**Åtgärdsnivåerna:**

* **Informationsåtgärder** (läsa data, sammanställa rapporter): CLEARANCE
  gör direkt, loggar alltid.
* **Kommunikationsåtgärder** (mejl, inbjudningar, delningar): CLEARANCE
  förbereder, användaren godkänner.
* **Rättsligt bindande åtgärder** (ansökningar, avtal, betalningar):
  aldrig utan uttryckligt godkännande av det exakta innehållet - och
  vissa genomförs aldrig av systemet alls, bara förbereds.

**Inga stora hopp.** Vägen från "jag ser likviditetsproblem" till en
rekonstruktionsansökan består av många små, synliga, godkända steg.
CLEARANCE får aldrig binda ihop dem till ett.

**Två lägen.** I resonemangsläget diskuterar, jämför och föreslår CLEARANCE
fritt - ingen risk, inga godkännanden. I agentläget utför den - då
gäller kontraktet fullt ut. Övergången är alltid explicit, som när en
pilot går ur autopilot.

**Hemligheter.** API-nycklar tas emot en gång, maskeras omedelbart,
lagras i valvet och visas aldrig igen. Det som redan byggts för
driftens nycklar är mallen för användarens.

## Källmärkning (Confidence)

Varje bedömning bär sin källa, synligt:

* 🟢 **Hög** - bygger direkt på verifierade data (ärendets registrerade
  uppgifter, anslutna system).
* 🟡 **Medel** - tolkning utifrån det användaren lämnat i samtalet.
* 🔴 **Låg** - viktiga uppgifter saknas; CLEARANCE säger det och drar ingen
  slutsats (fallbackens beteende).

## API-first

Allt som går att göra i gränssnittet ska gå att göra via API. Grunden
finns: hela produkten går genom EN portyta (DataPort) utan bakvägar,
och kontraktet utåt är api/openapi.json (se docs/api.md) - versionerat,
statusmärkt (live/beta) och vaktat av tester. Appen är ett av
gränssnitten; externa system är de andra.

## De fyra objekten

Allt i systemet ska kunna beskrivas med fyra objekt - inget femte
införs utan att ett av de fyra visat sig otillräckligt:

* **Samtal** - dialogen med rådgivaren (journalförd).
* **Beslut** - vad som faktiskt beslutades, med premiss.
* **Dokument** - det som skapades eller laddades upp.
* **Uppgifter** - det som återstår att göra.

Aktivitetsloggen (händelseloggen) löper genom alla fyra och är den
gemensamma tidslinjen: "09:14 prognos skapad, 10:11 skickad till
revisorn, 13:05 godkänd, 13:07 handlingsplan uppdaterad." Den är lika
värdefull för användaren som för rådgivaren som fortsätter arbetet.

## Löftet till användaren

> Clearance hjälper dig att fatta bättre beslut - men viktiga
> affärsbeslut är alltid dina. Därför visar vi vilket underlag våra
> rekommendationer bygger på, och ber om bekräftelse innan åtgärder som
> kan få ekonomiska eller juridiska konsekvenser genomförs.

## Betans avgränsning

Tool Engine börjar smalt: ekonomidata (SIE-import finns, Fortnox/Visma
bakom adapter när avtalen finns), dokument och e-post via utkorgen.
Fler verktyg läggs bakom samma kontrakt utan att upplevelsen ändras -
användaren fortsätter prata med samma rådgivare.

---

*Efterlevnad i kod: arbetsmodellen och sedan sist-briefingen byggs
deterministiskt ur journalen (tests/advisor.ts), beslutsuppföljningen
citerar premissen, och varje protokollförd åtgärd syns i
händelseloggen. En regel som inte testas är en åsikt.*
