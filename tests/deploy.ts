/**
 * EGENHOSTAD DRIFT: det som måste hålla för att en avbild ska fungera i alla
 * miljöer, och för att migreringen ska köras exakt som den bevisade vägen.
 *
 *  1. RUNTIME-KONFIGEN vinner över byggvärdet, och tom bas betyder samma
 *     origin (nginx proxar /v1). Utan det binds varje avbild till en miljö.
 *  2. FRONTEND-SERVERN proxar /v1 och injicerar konfigen i index.html.
 *  3. MIGRATIONS-AVBILDEN kör exakt scripts/migrera.sh mot rätt sökvägar.
 */

import { apiBaseUrl } from "../src/data/aws/client";
import { resolveMailConfig } from "../db/worker/mail";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name} ${extra}`);
  }
};
const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/* --- 1. Runtime-konfigens företräde -------------------------------------- */

const g = globalThis as { __CLEARANCE_CONFIG__?: { apiBaseUrl?: string } };

delete g.__CLEARANCE_CONFIG__;
// Byggvärdet sätts av esbuild --define (se package.json: test:deploy).
check("byggvärdet gäller utan runtime-konfig", apiBaseUrl() === "https://byggd.example", apiBaseUrl());

g.__CLEARANCE_CONFIG__ = { apiBaseUrl: "https://runtime.example/" };
check("runtime-konfigen vinner över bygget", apiBaseUrl() === "https://runtime.example", apiBaseUrl());

g.__CLEARANCE_CONFIG__ = { apiBaseUrl: "" };
check("tom runtime-bas = samma origin (tom sträng)", apiBaseUrl() === "", apiBaseUrl());

delete g.__CLEARANCE_CONFIG__;

/* --- 2. Frontend-servern (nginx) ----------------------------------------- */

const nginx = read("deploy/frontend/nginx.conf.template");
check("nginx proxar API:t på samma origin", /location\s+\/v1\//.test(nginx) && /proxy_pass\s+\$\{API_UPSTREAM\}/.test(nginx));
check("nginx faller tillbaka till SPA:n", /try_files\s+\$uri\s+\/index\.html/.test(nginx));
check("index.html cachas aldrig", /location = \/index\.html/.test(nginx) && /no-store/.test(nginx));
check("nginx lyssnar på 8080 (ickeroot)", /listen\s+8080/.test(nginx));

const entry = read("deploy/frontend/40-clearance-runtime-config.sh");
check("entrypointen injicerar runtime-konfigen", /__CLEARANCE_CONFIG__/.test(entry) && /CLEARANCE_RUNTIME_CONFIG/.test(entry));
check("entrypointen sparar originalet (idempotent)", /index\.html\.orig/.test(entry));

const indexHtml = read("index.html");
check("index.html bär platshållaren nginx byter ut", /<!--CLEARANCE_RUNTIME_CONFIG-->/.test(indexHtml));

const feDocker = read("deploy/frontend/Dockerfile");
check("frontend-avbilden kör ickeroot nginx", /nginx-unprivileged/.test(feDocker) && /USER 101/.test(feDocker));
check("frontend-avbilden bygger egen adapter, inte demo", /VITE_DATA_ADAPTER=aws/.test(feDocker) && /VITE_DEMO_MODE=false/.test(feDocker));

/* --- 3. Migrations-avbilden ---------------------------------------------- */

const migDocker = read("deploy/migrate/Dockerfile");
check("migrations-avbilden kör den bevisade migrera.sh", /scripts\/migrera\.sh/.test(migDocker));
check("och tar med bootstrap + migrationerna", /COPY db /.test(migDocker) && /supabase\/migrations/.test(migDocker));
check("och kör som ickeroot", /USER postgres/.test(migDocker));

// Klienten skickar Bearer-token, inte cookies - samma origin ändrar inte det.
const client = read("src/data/aws/client.ts");
check("klienten väljer runtime-konfig före byggvärde", /__CLEARANCE_CONFIG__/.test(client));
check("och tillåter tom bas bara när servern satt den", /runtimeBaseConfigured/.test(client));

/* --- 4. Mejltransporten: SES eller SMTP, valt av miljön ------------------ */

const ses = resolveMailConfig({ MAIL_FROM: "a@b.se" } as NodeJS.ProcessEnv);
check("standard är SES", ses.kind === "ses");
check("SES bär avsändare och region", ses.kind === "ses" && ses.from === "a@b.se" && ses.region === "eu-north-1");

const smtp = resolveMailConfig({ MAIL_FROM: "a@b.se", MAIL_TRANSPORT: "smtp", SMTP_HOST: "mail.internt", SMTP_USER: "u", SMTP_PASS: "p" } as NodeJS.ProcessEnv);
check("smtp väljs av MAIL_TRANSPORT", smtp.kind === "smtp");
check("smtp default-port 587, STARTTLS", smtp.kind === "smtp" && smtp.port === 587 && smtp.secure === false);
check("smtp bär auth när user satts", smtp.kind === "smtp" && smtp.user === "u" && smtp.pass === "p");

const smtp465 = resolveMailConfig({ MAIL_FROM: "a@b.se", MAIL_TRANSPORT: "smtp", SMTP_HOST: "m", SMTP_PORT: "465" } as NodeJS.ProcessEnv);
check("port 465 ger implicit TLS", smtp465.kind === "smtp" && smtp465.secure === true);

let threw = false;
try {
  resolveMailConfig({ MAIL_FROM: "a@b.se", MAIL_TRANSPORT: "smtp" } as NodeJS.ProcessEnv);
} catch {
  threw = true;
}
check("smtp utan SMTP_HOST är ett fel, inte en tyst SES-fallback", threw);

// Arbetaren använder transporten, inte en hårdkodad SES-klient.
const worker = read("db/worker/email-worker.ts");
check("arbetaren väljer transport ur miljön", /makeMailSender/.test(worker) && /resolveMailConfig/.test(worker));
check("arbetaren har ingen hårdkodad SES-klient kvar", !/new SESClient/.test(worker));

// Aviseringsarbetaren använder samma transport - inte en egen SES-klient.
const notif = read("db/worker/notification-worker.ts");
check("aviseringsarbetaren använder mejltransporten", /makeMailSender/.test(notif) && /resolveMailConfig/.test(notif));
check("aviseringsarbetaren har ingen hårdkodad SES-klient", !/new SESClient/.test(notif));
check("aviseringsarbetaren har en egen avbild", read("deploy/notification/Dockerfile").includes("notification-worker.ts"));

/* --- 4. Varje svit ska vara KÖRD eller MEDVETET undantagen -------------- */

/*
 * DET SOM INTE STÅR I KEDJAN KÖRS INTE, OCH DÅ RUTTNAR DET.
 *
 * `npm test` kör 51 sviter. Sex ligger utanför - de kräver ett
 * Postgres-kluster, en webbläsare eller en server, och skulle göra en
 * sekundlång körning till en flerminuterskörning. Det är ett rimligt val.
 *
 * Priset betalades i tysthet: när de utanförliggande sviterna till slut
 * kördes var NIO webbläsarsviter röda, de flesta sedan länge, och den
 * levande API-sviten var röd av en dagsfärsk ändring. De letade efter
 * knappar och fält som bytts ut - och ett prov som letar efter något som
 * inte finns prövar ingenting alls.
 *
 * Kontrollen nedan gör orphan-status till ett BESLUT: varje test:*-skript
 * ska antingen stå i kedjan eller i listan här, med ett skäl. Den som
 * lägger till en svit måste ta ställning; den som glömmer får rött.
 *
 * Jämförelsen görs på HELA skriptnamnet. Ett delsträngstest hade sagt att
 * test:api körs, eftersom test:apispec står i kedjan - och då hade den här
 * vakten haft exakt det fel den finns för att hitta.
 */
const KORS_SEPARAT: Record<string, string> = {
  "test:api": "Reser en databas och kör API:t över HTTP. Kräver Postgres.",
  "test:rls": "Radskyddet mot Supabase-skalet. Kräver Postgres.",
  "test:selfhosted": "Radskyddet och rollerna självhostat. Kräver Postgres.",
  "test:webblasare": "Alla webbläsarprov. Kräver bygge, server och webbläsare.",
  "test:mobile": "Ingår i test:webblasare; kvar som genväg till enbart mobilsvepet.",
  "test:external": "Ingår i test:webblasare; kvar som genväg till enbart nätkontrollen.",
};

{
  const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
  const kedjan = pkg.scripts.test ?? "";
  const kordaIKedjan = new Set(
    [...kedjan.matchAll(/npm run (test:[A-Za-z0-9:_-]+)/g)].map((m) => m[1]),
  );
  const alla = Object.keys(pkg.scripts).filter((k) => k.startsWith("test:"));

  /*
   * JÄMFÖRELSEN SJÄLV, PRÖVAD.
   *
   * Kollisionen finns på riktigt i repot: test:api är en strikt förkortning
   * av test:apispec, som DÅ står i kedjan. Skrivs jämförelsen om till ett
   * delsträngstest ser test:api körd ut, och vakten intygar att en svit
   * körs som inte körs - det fel den finns för att hitta, i den själv.
   *
   * Den här raden är därför inte en dubblett av kontrollen nedan: den
   * prövar MEKANISMEN, inte innehållet.
   */
  /*
   * EN ENDA PREDIKATFUNKTION, som både självprovet och kontrollen nedan
   * använder. Skrevs de var för sig kunde självprovet pröva en mekanism
   * och kontrollen använda en annan - och då bevisar självprovet ingenting
   * om det som faktiskt körs. Det var precis vad som hände i första
   * utkastet av den här vakten.
   */
  const korsAvKedjan = (namn: string): boolean => kordaIKedjan.has(namn);

  check(
    "kedjan läses på hela namn: test:apispec gör inte test:api körd",
    korsAvKedjan("test:apispec") && !korsAvKedjan("test:api"),
    alla.filter((k) => k.startsWith("test:api") && korsAvKedjan(k)).join(", "),
  );

  const foraldralosa = alla.filter((k) => !korsAvKedjan(k) && !(k in KORS_SEPARAT));
  check(
    "varje test:*-skript körs av npm test eller står som medvetet undantag",
    foraldralosa.length === 0,
    foraldralosa.join(", "),
  );

  // Och åt andra hållet: en post i undantagslistan som INTE finns kvar som
  // skript är en kvarlämnad ursäkt för en svit som inte längre existerar.
  const spoken = Object.keys(KORS_SEPARAT).filter((k) => !alla.includes(k));
  check("undantagslistan innehåller inga spöken", spoken.length === 0, spoken.join(", "));

  // Ett undantag utan skäl är ingen förklaring.
  const utanSkal = Object.entries(KORS_SEPARAT).filter(([, skal]) => skal.trim().length < 20);
  check("varje undantag bär ett skäl", utanSkal.length === 0, utanSkal.map(([k]) => k).join(", "));

  // De separata sviterna ska stå skrivna där någon letar efter dem.
  const readme = read("README.md");
  check(
    "README namnger kommandot som kör webbläsarproven",
    /npm run test:webblasare/.test(readme),
  );
  const checklista = read("docs/deploy-compliance.md");
  check(
    "deploy-checklistan räknar upp de tre lagren",
    /npm run test:webblasare/.test(checklista) && /db\/tests\/run\.sh/.test(checklista),
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
