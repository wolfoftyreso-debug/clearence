# Aviseringstjänsten

SMS är den första betalda kanalen. Men SMS är inte funktionen - funktionen
är en **aviseringstjänst med utbytbara kanaler**, och SMS är den första som
kostar pengar att leverera.

Skillnaden är avgörande för hur det är byggt: reglerna för *om* något ska
skickas känner inte till någon leverantör, och kanalerna känner inte till
några regler.

## Varför notiscentret inte räckte

`src/lib/notifications.ts` **härleder** klockans innehåll ur nuläget vid
varje rendering. Det är rätt för en klocka: klockan ska visa det som gäller
nu, och nuläget är sanningen.

Men det går inte att skicka på. Ett SMS är oåterkalleligt. En härledning som
körs var femte minut skickar samma besked var femte minut, och en produkt
som tjatar mitt i en kris blir avstängd - varpå kanalen är förbrukad när det
verkligen gäller.

En **avisering** är därför något annat än en notis: den har en identitet, och
identiteten är det som gör att den skickas exakt en gång.

```
dedupeKey = kind : userId : caseId : subjectId : threshold
```

Nyckeln byggs av *vad händelsen gäller*, aldrig av *när den upptäcktes*.
Databasen har ett unikt index på den; en andra insättning gör ingenting och
returnerar null. Null är inte ett fel - det är hela poängen.

Fristpåminnelsen är undantaget som bekräftar regeln: tröskeln (14, 7, 1
dagar) är en del av nyckeln, för "sju dagar kvar" är ett annat besked än "en
dag kvar". Tre besked, inte ett per dag.

## Kanalerna

| Kanal | Ingår i | I drift |
|---|---|---|
| I appen | alla nivåer, alltid | ja |
| E-post | Standard och uppåt | ja |
| **SMS** | **Business och Enterprise** | ja |
| Push | – | **nej**, mobilappen är inte släppt |

Klockan i appen är aldrig betald. Att ta betalt för att få veta att ens eget
ärende ändrats vore att ta betalt för produkten två gånger.

Push står med i registret men är märkt `live: false` och går inte att välja.
Att visa ett val som inte gör något är att ljuga tyst.

> **Nivåerna heter Start, Standard, Business, Enterprise** - det finns ingen
> Professional-nivå. SMS ligger i Business och uppåt, samma plats som
> ekonomisystemskopplingen.

Nivån lagras i `account_billing.plan_id`. Innan den här ronden fanns nivåerna
bara i gränssnittet, vilket gjorde varje påstående om vad som "ingår" till ett
påstående utan täckning.

## Användarens val

Tre nivåer, inte sju kryssrutor per händelsetyp:

1. **Alla viktiga händelser** - även när något gått framåt av sig självt.
2. **Bara när något krävs av dig** *(förval)* - frister, åtgärder,
   granskningsbeslut, kommentarer.
3. **Bara det tidskritiska** - endast frister som närmar sig.

Fler val hade gett mer kontroll på pappret och mindre i praktiken. Den som är
mitt i en kris orkar inte konfigurera, och en inställningssida ingen orkar
fylla i blir kvar på förvalet. Förvalet är därför nivå 2 och inte nivå 1: den
som är i kris ska inte behöva stänga av oss för att stå ut med oss.

### Tyst tid

Förval 21:00–07:00. Ett besked under tyst tid **skjuts upp** till morgonen -
det slängs inte, för ett besked som kommer 07:00 är fortfarande användbart.
Uppskjutningen kostar inget försök; annars hade fem nätters tystnad ätit upp
taket och kastat beskedet.

**Undantaget:** en tidskritisk händelse bryter tystnaden. Alternativet är att
användaren sover genom det enda vi finns till för att förhindra. Undantaget
står utskrivet i inställningarna - att tyst göra undantag hade varit att bryta
ett löfte.

Timmen räknas i `Europe/Stockholm`. Det är ett **antagande**, inte en sanning:
den som driver ett svenskt bolag från Spanien får svensk klocka. Dagen vi
säljer utanför Sverige behöver `notification_prefs` en tidszonskolumn.

## Vad ett SMS får innehålla

Två regler, båda ur vad produkten handlar om:

**1. Det står aldrig vad som är fel.** Ett SMS landar på en låst skärm.
*"Ditt bolag riskerar konkurs"* kan läsas av vem som helst som råkar titta ner
på bordet under ett möte - en kund, en anställd, en långivare. Aviseringen
säger **att** något behöver uppmärksamhet och **var** det finns, aldrig
**vad** det är.

**2. Inga belopp, inga bolagsnamn, inga personnamn.** Ärendets referens räcker
för den som har flera ärenden.

```
CLEARANCE: en tidsfrist i ditt ärende (A-241) löper ut i morgon. Logga in för detaljer.
```

Testet håller det: `tests/notificationService.ts` avvisar orden *konkurs,
obestånd, insolvens, rekonstruktion, kontrollbalans, skuld, likvid, kris,
personligt ansvar* i varje SMS-text, och kräver att den ryms i ett segment
(160 tecken - längre delas och kostar mer utan att säga mer).

## Numret

Ett nummer som skrivits fel skickar besked om en kris till en främling.
Numret måste därför både se rätt ut och **bevisas**:

1. Numret normaliseras till E.164 (`normalisePhone`). Fasta nummer avvisas -
   ett SMS dit kommer aldrig fram, och ett tyst misslyckande är värre än ett
   nej.
2. En sexsiffrig kod genereras **i klienten**, hashas med SHA-256, och bara
   hashen når databasen. Klartexten går till telefonen. Ingen lagring ser
   båda. Samma regel som för API-nycklar och sessionspoletter.
3. Fem felgissningar bränner koden. Koden lever i tio minuter.
4. Ett byte av nummer nollställer verifieringen - annars kunde man verifiera
   sitt eget nummer och sedan byta till någon annans.

Numret visas alltid maskerat (`+46 701 •• •• 67`). En skärmdump av
inställningarna ska inte lämna ut mobilnumret.

`user_profiles.phone` finns kvar och används **inte** för utskick: den är en
kontaktuppgift, fritext som ingen prövat.

## Var reglerna bor

```
src/lib/notifications/events.ts      kanaler, händelser, nivåer, plangräns,
                                     tyst tid - och decideDelivery()
src/lib/notifications/messages.ts    texterna och dedupeKey()
src/lib/notifications/phone.ts       numret, koden, maskeringen
src/components/settings/AlertChannels.tsx   inställningsytan
db/worker/notification-worker.ts     arbetaren
db/worker/sms/                       leverantören - och ingenting annat
supabase/migrations/20260818100000_notification_service.sql
```

**`decideDelivery()` är den enda platsen där beslutet fattas.** Både
arbetaren och gränssnittet använder den. Två uppsättningar villkor - en i SQL
och en i TypeScript - hinner glida isär, och då får den som frågar "varför
fick jag inget SMS" två olika svar.

Frågan har ett svar: varje leverans som inte gick fram bär sitt skäl
(`suppressed_reason`), och skälen visas för användaren under
*Senaste aviseringarna*.

## Leverantören

46elks, svensk och med svensk datalagring. Uppgifterna i ett aviserings-SMS är
sparsamma med flit, men **numret i sig** säger att någon har ett ärende hos
CLEARANCE - och det är i sammanhanget en uppgift värd att hålla inom EU.

Namnet får bara förekomma i `db/worker/sms/`. Arbetaren frågar
`providerFromSecret()` efter "den konfigurerade leverantören" och vet inte vem
det är. `tests/notificationService.ts` faller om namnet dyker upp någon
annanstans: ligger leverantören i tjugo filer blir ett byte ett projekt, i en
blir det en eftermiddag.

Nyckeln lagras i `integration_secrets` under `46elks`, som
`användarnamn:lösenord` (leverantörens API använder HTTP Basic).

Saknas nyckeln returneras en leverantör som **kastar med skälet utskrivet** -
inte en som tyst låtsas skicka. En kö som ser tom och lyckad ut fast
ingenting kommit fram är det enda felet ingen upptäcker.

## Drift

```
node db/dist/notification-worker.cjs     var 5:e minut
```

Miljö: `DATABASE_URL` (aldrig superanvändare), `SES_REGION`, `MAIL_FROM`.

Arbetaren tar först verifieringskön (utskick till **overifierade** nummer -
det enda som får gå dit), sedan aviseringskön.

`claim_notification_deliveries()` är enda vägen in i kön. Den låser med
`for update skip locked`, så två arbetare aldrig skickar samma rad, och
returnerar hela beslutsunderlaget i ett svar - en läsning som spänner över
flera anrop kan hinna se två olika sanningar.

Resultatet skrivs alltid tillbaka, även vid krasch. En rad utan resultat
plockas om, och då får mottagaren samma SMS två gånger.

## Vad som återstår

* **Ingen producerar händelser än.** Tjänsten tar emot, beslutar och
  levererar; `enqueue_notification()` är oanropad från produktionskod. Nästa
  steg är att koppla den till fristbevakningen, dokumentgranskningen och
  meddelandena.

  Den här punkten är inte längre bara en anteckning. `AVISERINGAR_HAR_PRODUCENT`
  i `src/lib/notifications/status.ts` säger samma sak i kod, och avsnitt 11 i
  `tests/notificationService.ts` läser produktionskoden — utan kommentarer, för
  både porten och arbetaren *nämner* funktionen — och kräver att flaggan stämmer.
  Så länge den är false måste kanalvalet och uppgraderingsrutan skriva ut
  förbehållet: valen sparas, men ingenting skickas än. Den dag någon kopplar in
  en producent blir provet rött tills flaggan och texterna följer med. Att ta
  betalt för en SMS-kanal utan att säga det vore att sälja en tystnad.
* Push, när mobilappen finns.
* Tidszon per användare, när vi säljer utanför Sverige.
* En takgräns per mottagare och dygn. Engångsgarantin skyddar mot att *samma*
  besked upprepas, inte mot att tjugo olika kommer samtidigt.
