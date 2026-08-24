/**
 * Tester för CLEARANCE-samtalets modell-rör (server/anthropic.ts).
 *
 * Utan nät: en inskjuten fetch spelar Anthropic. Det som prövas är det som
 * MÅSTE hålla oavsett vad modellen råkar svara - konstitutionen i
 * systemprompten, att nyckeln aldrig läcker i ett fel, och att de tre
 * utfallen (svar / ingen-kalla / fel) hålls isär.
 */

import {
  anthropicConfigured,
  clearanceReply,
  CLEARANCE_SYSTEM_PROMPT,
  type AdvisorMessage,
} from "../server/anthropic";
import { readFileSync } from "node:fs";
import { join } from "node:path";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/* --- systemprompten ÄR konstitutionen ------------------------------------ */

const P = CLEARANCE_SYSTEM_PROMPT;
check("systemprompten namnger CLEARANCE", P.includes("CLEARANCE"));
check('systemprompten sätter pronomenet "den"', /omtalas som "den"/.test(P));
check("systemprompten förbjuder ordet AI om sig själv", /Kalla dig ALDRIG "AI"/.test(P));
check("systemprompten kräver en fråga i taget", /EN \(1\) fråga i taget/.test(P));
check("systemprompten sätter taket på tre rekommendationer", /HÖGST tre rekommendationer/.test(P));
check("systemprompten förbjuder påhittade fakta", /Hitta ALDRIG på siffror/.test(P));
check("systemprompten håller rådgivningsgränsen", /inte juridisk eller finansiell rådgivning/.test(P));
check("systemprompten eskalerar höga insatser", /HÖGA INSATSER/.test(P) && /säkert juridiskt besked/i.test(P));
check("systemprompten pekar ut personligt betalningsansvar", /personligt betalningsansvar/i.test(P));
check("systemprompten kräver mänsklig bekräftelse på det tunga", /bekräftas av en revisor, jurist eller rekonstrukt/i.test(P));
// Regelaktualitet: lagar ändras och modellens kunskap har en gräns. Den får
// aldrig påstå en specifik frist/regel som säkert gällande - den ska säga att
// lydelsen ska verifieras mot primärkälla eller av en människa.
check("systemprompten flaggar regelaktualitet", /REGELAKTUALITET/.test(P) && /din kunskap har en/i.test(P));
check(
  "systemprompten förbjuder att påstå frister/regler som säkert gällande",
  /ALDRIG en specifik frist/i.test(P) && /aldrig att en regel är ny,\s+ändrad eller borttagen/i.test(P),
);
check(
  "systemprompten kräver verifiering mot primärkälla",
  /verifieras mot primärkälla/i.test(P) && /f(ö|o)retagsrekonstruktion \(2022:964\)/i.test(P),
);
check("systemprompten svarar på svenska", /på svenska/.test(P));

// Dataskydd: samtalsinnehållet loggas ALDRIG server-sidan. Ett känsligt
// krissamtal i en loggrad är precis det som inte får hända.
const anthropicKod = readFileSync(join(process.cwd(), "server/anthropic.ts"), "utf8");
check("röret loggar aldrig samtalsinnehållet", !/console\.(log|error|info|warn)/.test(anthropicKod));
check("dataminimeringen är utskriven", /DATAMINIMERING/.test(anthropicKod));

/* --- fail-closed: ingen nyckel, inget anrop ------------------------------ */

const SAMTAL: AdvisorMessage[] = [
  { role: "user", content: "Vi kan inte betala momsen på torsdag. Kunden har inte betalat oss." },
];

const gammalNyckel = process.env.ANTHROPIC_API_KEY;
delete process.env.ANTHROPIC_API_KEY;
check("utan nyckel är motorn inte konfigurerad", anthropicConfigured() === false);
{
  let rördeNätet = false;
  const spionfetch = (async () => {
    rördeNätet = true;
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const r = await clearanceReply(SAMTAL, spionfetch);
  check("utan nyckel: status ingen-kalla", r.status === "ingen-kalla", r);
  check("utan nyckel: inget nätanrop gjordes", rördeNätet === false);
}

/* --- med nyckel ---------------------------------------------------------- */

const HEMLIG = "sk-ant-TESTHEMLIGHET-abc123";
process.env.ANTHROPIC_API_KEY = HEMLIG;
check("med nyckel är motorn konfigurerad", anthropicConfigured() === true);

/** En fetch som fångar begäran och svarar som Anthropic gör. */
const gorFetch = (svar: Response) => {
  const fanget: { url?: string; init?: RequestInit } = {};
  const f = (async (url: string, init: RequestInit) => {
    fanget.url = url;
    fanget.init = init;
    return svar;
  }) as unknown as typeof fetch;
  return { f, fanget };
};

{
  const ok = new Response(
    JSON.stringify({
      content: [{ type: "text", text: "Jag förstår att det är pressat. Vi tar det steg för steg." }],
      model: "claude-sonnet-5",
    }),
    { status: 200 },
  );
  const { f, fanget } = gorFetch(ok);
  const r = await clearanceReply(SAMTAL, f);
  check("med nyckel: status svar", r.status === "svar", r);
  check("svaret bär modellens text", r.status === "svar" && r.reply.startsWith("Jag förstår"));
  check("svaret bär modellnamnet", r.status === "svar" && r.model === "claude-sonnet-5");

  // Begäran: rätt endpoint, nyckel i x-api-key, version, konstitution som system.
  const headers = (fanget.init?.headers ?? {}) as Record<string, string>;
  const body = JSON.parse(String(fanget.init?.body ?? "{}"));
  check("anropet går till Anthropic messages", fanget.url === "https://api.anthropic.com/v1/messages");
  check("nyckeln sitter i x-api-key", headers["x-api-key"] === HEMLIG);
  check("anthropic-version är satt", typeof headers["anthropic-version"] === "string");
  check("systemprompten skickas som system", body.system === CLEARANCE_SYSTEM_PROMPT);
  check("meddelandena skickas med", Array.isArray(body.messages) && body.messages.length === 1);
  // Dataminimering (GDPR): inget user_id/metadata följer med begäran, och
  // begäran bär bara de fält som behövs - inget extra som identifierar någon.
  check("ingen metadata/user_id skickas med", !("metadata" in body));
  check(
    "begäran bär bara de nödvändiga fälten",
    Object.keys(body).sort().join(",") === "max_tokens,messages,model,system",
    Object.keys(body),
  );
  check("ett tak på max_tokens finns", typeof body.max_tokens === "number" && body.max_tokens > 0);
}

/* --- felvägar, och att nyckeln ALDRIG läcker ----------------------------- */

{
  // 401 med nyckeln speglad i kroppen: reason får inte bära den vidare.
  const fel = new Response(`{"error":"invalid key ${HEMLIG}"}`, { status: 401 });
  const { f } = gorFetch(fel);
  const r = await clearanceReply(SAMTAL, f);
  check("icke-ok svar: status fel", r.status === "fel", r);
  check("felet nämner statuskoden", r.status === "fel" && r.reason.includes("401"));
  check("felet läcker ALDRIG nyckeln", r.status === "fel" && !r.reason.includes(HEMLIG));
}

{
  // Tomt innehåll är inte ett svar.
  const tomt = new Response(JSON.stringify({ content: [] }), { status: 200 });
  const { f } = gorFetch(tomt);
  const r = await clearanceReply(SAMTAL, f);
  check("tomt innehåll: status fel", r.status === "fel", r);
}

{
  // Ett samtal som inte slutar med användaren avvisas före nätet.
  let rördeNätet = false;
  const spion = (async () => {
    rördeNätet = true;
    return new Response("{}", { status: 200 });
  }) as unknown as typeof fetch;
  const r = await clearanceReply(
    [
      { role: "user", content: "Hej" },
      { role: "assistant", content: "Hej, hur kan jag hjälpa?" },
    ],
    spion,
  );
  check("samtal som slutar på assistant: status fel", r.status === "fel", r);
  check("och inget nätanrop gjordes", rördeNätet === false);
}

// Städa upp miljön.
if (gammalNyckel === undefined) delete process.env.ANTHROPIC_API_KEY;
else process.env.ANTHROPIC_API_KEY = gammalNyckel;

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
