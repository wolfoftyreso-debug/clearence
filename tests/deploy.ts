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

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
