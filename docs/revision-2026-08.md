# Revision, augusti 2026

> **Daterat protokoll.** Det här är vad som gällde i augusti 2026 och
> skrivs inte om i efterhand. Sedan dess har driften flyttat till Vercel:
> `infra/` och `deploy/` är borttagna, och `terraform`-raderna nedan gäller
> inte längre. Se [vercel.md](vercel.md) för det som gäller nu.

**Vad som prövades, vad som höll, och vad som inte gjorde det.**

En revision är inte en genomkörning av testerna. Testerna säger bara att
koden gör det koden säger. Revisionen frågar en annan sak: **stämmer det
vi påstår med det som faktiskt finns?** Den frågan har inget testfall,
för ett påstående i ett dokument kompilerar inte.

Metoden var därför: kör hela apparaten för att veta vad som fungerar, och
läs sedan varje påstående i produkten och dokumentationen mot koden.

---

## Fem fynd

### 1. Utvecklarsidan lovade en tjänst som inte svarar

`/api` sa **"Live är körbart idag"** om två operationer. Ingen miljö är
driftsatt — `infra/` är en beställning, inget AWS-konto är kopplat — så
`https://api.clearance.se/v1` svarar inte, och har aldrig gjort det.

En utvecklare som läste sidan hade byggt en integration mot en adress
som inte finns, och fått felsöka sitt eget nät i en halvtimme innan hen
misstänkte oss.

**Rättat.** Sidan säger nu, överst och inte i en fotnot, att ingen miljö
är driftsatt. `live` betyder *implementerad och verifierad mot
databasen*, `beta` betyder *kontrakt-först* — och ingetdera går att
anropa ännu. Samma text står i kontraktets `info.description` och
serveradresserna är märkta `(ej driftsatt)`.

### 2. API:t läste ett huvud som kontraktet inte känner till

Kontraktet deklarerar **en** mekanism: `Authorization: Bearer`. Servern
läste API-nyckeln ur `x-api-key`. En integration byggd på den publicerade
dokumentationen hade fått 401 utan att förstå varför.

**Rättat.** Nyckeln känns igen på sitt prefix (`clr_`, satt av
`create_api_key`); allt annat i samma huvud är en sessionstoken.
Kontraktet har fått ett andra `securityScheme` för sessionen, så båda
mekanismerna är beskrivna.

### 3. Journalens nyckelväg svarade i fel form — och var otestad

`api_journal()` returnerar `jsonb`. Koden skrev `select * from
api_journal(...)` och behandlade returen som en radmängd, så svaret fick
formen `[{ api_journal: {...} }]`. Ingen integration hade kunnat läsa
det.

Felet levde eftersom **ingen kontroll gick den vägen.** Testhjälparen
hade stöd för API-nyckel, men inget testfall använde det.

**Rättat**, och åtta nya kontroller går nu genom nyckelvägen: att svaret
har kontraktets form, att fälten finns, och att okänd nyckel ger exakt
samma svar som ett ärende utan åtkomst — skillnaden hade varit ett sätt
att kartlägga vilka ärenden som existerar.

### 4. Kontraktet saknade autentiseringen helt

`/auth/login`, `/auth/logout`, `/auth/me` och `/health` fanns i koden men
inte i kontraktet. Eftersom `/api` genereras ur kontraktet kunde den som
läste dokumentationen inte se hur man loggar in — i ett API vars
förstasats är "allt som går att göra i gränssnittet ska gå att göra via
API".

**Rättat.** Fyra operationer tillagda, märkta `beta`, med
`security: []` på de två som inte får kräva autentisering.

### 5. VISION.md beskrev ett läge flera ronder gammalt

Fem påståenden var falska — och alla åt samma håll: dokumentet fick
produkten att se **mindre** färdig ut än den är.

| Påstod | Verkligheten |
|---|---|
| "Saknas: inbjudningsflödet, gränssnittet inte" | Byggt, med öppna inbjudningar och återkallning |
| Kunskapsmotor: "Inte påbörjad" | Byggd: `/kunskap`, källhänvisad, 39 kontroller |
| "RLS 240/240" | 253/253 |
| "Saknas: läsbar loggvy" | `/dashboard/handelser` med detaljrader |
| "Exporten saknas" | CSV och JSON ur händelseloggen |

Dessutom stod kunskapsmotorn kvar bland "tre saker som INTE får byggas
innan de avgjorts". Villkoret var att svaren hålls på lagrumsnivå eller
inte byggs alls — och det är precis så den byggdes. Punkten är nu märkt
avgjord, med villkoret kvar för allt som byggs ovanpå.

---

## Vad som prövades och höll

* **Adaptrarnas ytor.** Demoadaptern och den skarpa adaptern uppfyller
  båda `DataPort`, vilket typkontrollen redan garanterar — ingen kan
  glömma en metod i den ena. En separat kontroll för samma sak hade
  varit en svagare kopia av något som redan är bevisat.
* **Sifferpåståendena** i konstitutionen och infrakartan (69, 36, 44,
  22, 253, 9/9) stämmer mot faktiska körningar.
* **Inga TODO, FIXME eller HACK** i egen kod.
* **"Inom kort"-märkningarna** på obyggda integrationer är avsiktlig
  ärlighet, inte kvarglömda löften.
* **`terraform fmt`** går igenom. `terraform validate` är fortfarande
  inte körd — utvecklingsmiljön når inte registret, och det står i
  infrakartan i stället för att antydas bort.

## Mönstret bakom fynden

Fyra av fem fynd är samma sak: **ett påstående som var sant när det
skrevs och blev falskt när något annat ändrades.** Ingen skrev fel; texten
stod stilla medan koden gick vidare.

Det finns inget test som fångar det, och därför är den enda försvarslinjen
att läsa om påståendena med jämna mellanrum. Det är vad den här
revisionen var, och den bör göras om.

Det femte fyndet är av en annan sort och allvarligare: **en kodväg som
ingen kontroll gick genom var trasig.** Ett testfall som *kan* nå en väg
men inte gör det ger falsk trygghet — hjälparen såg komplett ut, och
därför frågade ingen om vägen var prövad.

---

*Kört vid revisionen: lint, `tsc`, 28 enhetssviter, `test:api` 55/55,
253/253 databaskontroller i båda miljöerna, 29 browsersviter,
artefaktsviterna, samt app-, arbetar- och API-byggena.*
