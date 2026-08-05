# Designsystem: spacing och kortkomposition

**Version 1.0 · Excellence-kraven 6–7. Lintad av tests/spacing.ts -
en regel som inte testas är en åsikt.**

## Spacing-skalan

Fastställd utifrån produktens faktiska rytm - inte en idealskala som
ingen följer. Alla nya ytor använder stegen nedan; frihandsvärden
(`p-[18px]`, `mt-[13px]`) är förbjudna.

**Komponentsteg** (inuti kort, rader och formulär):

| px | Tailwind | Används till |
|---|---|---|
| 4 | `*-1` | tätaste luft: chip-innermått, ikonavstånd |
| 8 | `*-2` | radluft i listor, knappgap |
| 12 | `*-3` | fältluft i formulär |
| 16 | `*-4` | standardluft mellan block i ett kort |
| 20 | `*-5` | kortets standardpadding (`p-5`) och sektionsrytmen i det (`space-y-5`) |
| 24 | `*-6` | luft mellan kort på en sida |
| 32 | `*-8` | luft mellan sidans huvuddelar |

**Sektionssteg** (mellan ytor på publika sidor): 48/64/80 px
(`*-12`, `*-16`, `*-20`).

**Tillåtet undantag**, med ett skäl som inte är smak:

* `src/components/ui/` - vendorerade primitiver (shadcn) granskas
  inte; de bär bibliotekets egna mått.

**Förbjudna steg:** 7, 9, 10, 11, 14 (28/36/40/44/56 px) och alla
frihandsvärden. De låg utspridda i produkten (px-7-piller, gap-10,
py-10-spinnrar) och är normaliserade till skalan. (14 var tidigare
tillåtet som frizon under startsidans bottennavigering - naven är
borttagen, så undantaget är det också.)

## Kortkompositionen: två korttyper, aldrig fler per sida

1. **Ytkortet** - `rounded-md border border-border bg-card`
   (+ `shadow-soft` där kortet är sidans primära yta, `p-5`).
   Sidans sektioner: analysen, planen, rapporten, samtalsytan.
2. **Radkortet** - `rounded-md border` med tonkant
   (`border-l-4` + lägesfärg) eller sekundär bakgrund, `p-3`/`p-3.5`.
   Rader i en lista: frister, uppgifter, insikter, panelrader.

Allt annat är någon av dessa två i annan klädsel - inte en tredje
typ. Hörnradien är `rounded-md` överallt utom pillerknappar och
avatarer (`rounded-full`) och statuschips (`rounded-sm`);
`rounded-lg`/`rounded-xl` utanför ui-biblioteket är städade och
återinförs inte.

## Förbered användaren

Ingen ny vy ska någonsin kännas oväntad. Målgruppen är människor mitt i
en ekonomisk kris, och för dem är **förutsägbarhet viktigare än
hastighet**. Fyra frågor får aldrig lämnas obesvarade när något ändras
på skärmen:

> Varför händer det här? · Vem ska se informationen? ·
> Vad kommer att hända nu? · Hur lång tid tar nästa steg?

Varje gång användaren lämnar ett steg visas därför ett kort
övergångsmeddelande med fyra delar, alltid i den här ordningen:

1. **Det här är klart** - bekräfta vad som just slutfördes.
2. **Nu händer detta** - nästa steg, i en mening.
3. **Därför frågar vi** - syftet, så uppgiften inte känns godtycklig.
4. **Så lång tid tar det** - "cirka två minuter", "fyra frågor kvar".

En femte del, **Vem ser uppgifterna**, tas med när svaret delas med
någon annan än användaren själv - och utelämnas annars. En rad som
säger "ingen annan ser detta" på varje steg blir brus, och brus läses
inte alls.

Delarna 1 och 3 är det som skiljer principen från en vanlig
förloppsindikator. Den som vet *vad* som blev klart och *varför* nästa
fråga ställs upplever att systemet leder - inte att processen händer
med hen.

### Fyra bindande regler

1. Ingen ny fråga utan en kort introduktion om ämnet.
2. Ingen ny sektion utan ett övergångsmeddelande.
3. Ingen extern kontroll eller datainsamling utan att användaren får
   veta vad som sker.
4. Ingen väntetid utan att användaren får veta vad systemet arbetar med.

Regel 3 och 4 gäller väntetexterna. Ett besked som bara säger att något
hämtas svarar inte på någon av de fyra frågorna: det ska stå **vad** som
hämtas, **varifrån** och ungefär **hur länge** - särskilt när uppgiften
lämnar produkten, för då är det inte längre bara väntan utan en extern
kontroll användaren har rätt att känna till.

### Formen

Övergångsrutan är **läsning, inte handling**: sekundär bakgrund, ingen
ram som liknar de klickbara korten, ingen accentkulör som konkurrerar
med knappen som faktiskt för användaren vidare. Samma regel som
lägesbilden på översikten. Den står **före** knappen som byter steg -
en förklaring som kommer när vyn redan har ändrats är ingen
förberedelse, då har överraskningen redan hänt.

Byter vyn av sig själv ska pausen räcka för att läsa hela rutan, och det
ska finnas en knapp för den som redan har läst.

### Var reglerna bor

Texterna och kontrollerna: `src/lib/advisor/prepare.ts`.
Rutan: `src/components/advisor/TransitionNotice.tsx`.
Vakten: `tests/prepare.ts` (`npm run test:prepare`) - den kräver att
varje övergång har alla fyra delar, en konkret tidsangivelse och ett
syfte som inte bara upprepar nästa steg, att varje övergång faktiskt är
inkopplad någonstans, och att inget naket väntebesked skrivs utanför
`prepare.ts`.

## Notisklockan

Siffran på klockan räknar **olästa saker som kräver något av användaren**.
Två villkor, och båda behövs:

* **Kräver något.** Klockan sa tidigare *"3 meddelanden väntar på ditt
  svar"* om en lista där en av raderna själv skrev *"inget kräver åtgärd i
  dag"*. En siffra som räknar sådant lär användaren att siffran inte
  betyder något - och då är den värdelös just den dag den betyder allt.
  Varje notis bär därför `demandsAction`. Raderna som inte räknas **visas
  fortfarande**; att veta att nästa frist ligger om åtta dagar är
  värdefullt, det är bara inte ett krav.
* **Oläst.** Ett klick kvitterar raden. Utan det stod siffran kvar i
  evighet, och en räknare som inte går att beta av är en dekoration.

Tre regler som håller kvitteringen ärlig:

1. **Kvitteringen hänger på radens fingeravtryck, inte på dess id.** En
   frist som går från *"om tre dagar"* till *"förfaller idag"* har samma
   id men är ny information, och blir oläst igen. Att kvittera en notis
   en gång ska inte tysta hela dess upptrappning.
2. **Ingenting döljs.** En läst rad ligger kvar i listan, nedtonad.
   Klockan får aldrig bli en plats där en frist går att gömma genom att
   klicka bort den.
3. **Ingen tyst avhuggning.** Listan visade tidigare åtta rader medan
   siffran räknade alla - den som hade tolv fick aldrig veta att fyra
   fanns. Listan rullar i stället.

Minnet är per enhet, som resten av notisvalen, och går att släppa under
Inställningar. Ett val som inte går att ta tillbaka är en fälla, särskilt
när det man kvitterade bort kan vara en frist.

Reglerna: `src/lib/notificationsRead.ts`. Vakterna: `tests/notifications.ts`
och `tests/browser/verify-notisklick.mjs`.

## Visa, berätta inte

**Användaren ska aldrig behöva leta efter en funktion som CLEARANCE
känner till.** Nämner CLEARANCE en funktion ska den samtidigt kunna visa
exakt var den finns, förklara varför den används, visa vad som sparats
där, och hur användaren själv administrerar den sedan.

Motsatsen – "du hittar rapporterna under Rapporter" – lägger arbetet på
användaren och lär inte ut någonting. Guiden öppnar i stället menyn,
ringar in valet, byter vy, rullar fram, markerar målet och förklarar.
Man lär sig av att se något hända.

### Kontraktet

Varje funktion CLEARANCE får nämna står i `src/lib/guide/catalogue.ts`
med fyra svar och en adress:

| Fält | Svarar på |
| --- | --- |
| `route` + `anchor` | Var det finns |
| `why` | Varför funktionen används |
| `saves` | Vad som sparas där |
| `manage` | Hur användaren ändrar det sedan |
| `roles` | Vilka roller funktionen finns för |

`tests/guide.ts` fäller om adressen inte finns i `App.tsx`, om ankaret
inte finns som `data-guide` i källträdet, eller om något av svaren
saknas. Konsekvensen är avsiktlig och obekväm: den som lägger till en vy
och vill att CLEARANCE ska kunna prata om den måste kunna svara på
varför den finns och hur användaren sköter den. Kan man inte det är
funktionen inte färdig.

### Rollen styr vad guiden får visa

En företagare som frågar efter "mina klienter" ska inte ledas till
juristens ärendelista och landa på en tom sida. Att peka någon mot en yta
hen inte har är precis det principen finns för att förhindra – guiden ska
ta bort letandet, inte flytta det.

`navAnchor` är därför per roll, inte ett värde. Menyerna skiljer sig åt:
en jurist når likviditeten och handlingarna genom det aktiva ärendet men
har inga egna menyval för dem, och ett menyval som ringas in för någon
som inte har det pekar på ingenting. Saknas rollen går guiden rakt till
vyn i stället.

### Ankare, inte selektorer

Mål pekas ut med `data-guide="namn"`, aldrig med en CSS-klass eller en
position. En klass byter namn vid nästa designrond utan att någon märker
att guiden slutat peka; ett ankare som försvinner fäller testet.

### Fyra saker guiden aldrig får göra

1. **Låsa skärmen.** Overlayen har `pointer-events: none` och Esc
   avbryter. En rundtur man inte kan gå ifrån är en dialogruta med extra
   steg, och målgruppen har bråttom.
2. **Klicka åt användaren.** I guidat arbetsläge markerar guiden nästa
   knapp och VÄNTAR. Den som utför momentet själv minns det.
3. **Gissa.** Träffar "visa mig" inget entydigt säger guiden det och
   erbjuder alternativ. En guide som ibland pekar fel lär ut fel väg med
   auktoritet.
4. **Undervisa när det brinner.** Mikrolektionerna är avstängda när
   analysen säger `immediate`. Den som inte kan betala lönerna på fredag
   ska inte få veta vad ett kontrollområde heter.

### Mikroutbildning

Små återkommande förklaringar slår en genomgång vid första inloggningen,
som hamnar precis när användaren har minst nytta av den. En lektion visas
en gång, och en påminnelse kommer långt senare och knyter an till något
nytt: "Kommer du ihåg kontrolläget? Det är också där framtida varningar
dyker upp." Se `src/lib/guide/microLessons.ts`.

## Regeln bakom reglerna

Skalan finns för att en sida ska kännas komponerad, inte staplad.
När ett nytt kort behöver ett mått som inte finns i skalan är det
nästan alltid kompositionen som är fel, inte skalan.
