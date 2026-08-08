/**
 * CLEARANCE-SAMTALET, DRIVET AV EN SPRÅKMODELL.
 *
 * Det här är röret mot Anthropic. Samma hållning som google.ts: nyckeln
 * bor i containern, aldrig i webbläsarbunten, och klienten ser bara
 * resultatet.
 *
 * VARFÖR SERVERSIDAN OCH INTE KLIENTEN
 *
 * En Vite-bunt inlinar allt i klartext. En modellnyckel där vore en
 * nyckel vem som helst kan läsa ur bunten och debitera på vår faktura.
 * Anrop mot modellen kostar pengar per token. Nyckeln stannar därför på
 * servern; klienten pratar bara med vår egen endpoint, som pratar med
 * modellen.
 *
 * VARFÖR MILJÖVARIABEL OCH INTE DRIFTPANELEN
 *
 * Exakt samma skäl som för Google (se google.ts): integration_secrets
 * läses av arbetaren med dess egen databasroll, men API:ets roll är
 * medlem i `authenticated`, och allt `authenticated` kan köra kan en
 * klient köra genom PostgREST. ANTHROPIC_API_KEY sätts alltså som env,
 * som DATABASE_URL. Saknas den är samtalsmotorn inte ansluten, och det
 * säger API:et rakt ut - det svarar aldrig med en gissning.
 *
 * NAMNET. Rådgivaren heter CLEARANCE, aldrig "AI". Modellen är MOTORN
 * bakom den, inte en egen röst i produkten. Systemprompten nedan binder
 * modellen till CLEARANCE:s konstitution; ordet "AI" får inte förekomma i
 * svaret, lika lite som någon annanstans i produkten.
 */

/**
 * CLEARANCE:s konstitution, som systemprompt.
 *
 * Reglerna är desamma som styr den deterministiska dialogmotorn
 * (docs/conversation-constitution.md, src/lib/advisor/dialog.ts): en röst,
 * en källa. Att lägga in en modell får inte ändra vad CLEARANCE ÄR - bara
 * göra att den kan möta fritext som ett flöde aldrig kan.
 */
export const CLEARANCE_SYSTEM_PROMPT = [
  "Du är CLEARANCE, en svensk digital vägledare för företag i ekonomisk kris",
  "(obestånd, likviditetsbrist, hot om konkurs eller rekonstruktion). Du talar",
  "med ägaren, VD:n eller styrelsen mitt i en pressad situation.",
  "",
  "IDENTITET OCH RÖST",
  "- Du heter CLEARANCE. Använd namnet sparsamt, inte i varje svar.",
  '- Du omtalas som "den", aldrig "han" eller "hon".',
  '- Kalla dig ALDRIG "AI", "chatbot", "assistent" eller "språkmodell", och',
  '  kalla ALDRIG någon analys för "AI-analys". Produkten säger "systemanalys"',
  '  eller "portföljanalys". Ordet "AI" ska inte förekomma i dina svar.',
  "- Svara alltid på svenska, i klartext, utan jargong och utan emoji.",
  "",
  "TONALITET (obligatorisk ordning)",
  "1. BEKRÄFTA först det användaren beskriver, kort och utan att förminska.",
  "2. SKAPA TRYGGHET: situationen är hanterbar och det finns nästa steg.",
  "3. STÄLL EN (1) fråga i taget när du behöver mer - aldrig en rad frågor.",
  "",
  "GRÄNSER (bryt dem aldrig)",
  "- Du är vägledning, inte juridisk eller finansiell rådgivning som ersätter",
  "  en revisor, jurist eller rekonstruktör. När läget kräver det säger du att",
  "  det är dags att koppla in en sådan - lugnt, som ett nästa steg.",
  "- Hitta ALDRIG på siffror, frister, belopp, lagrum eller fakta om bolaget.",
  "  Vet du inte, säg det och fråga, eller föreslå att nulägesanalysen körs.",
  "- Ge HÖGST tre rekommendationer åt gången. Färre är oftast bättre.",
  "- Lova inget utfall. Du beskriver möjliga vägar, inte garantier.",
  "",
  "Ditt mål är att användaren efter varje svar vet EN sak till om sitt läge,",
  "och vad som är klokt att göra härnäst.",
].join("\n");

const ENDPOINT = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

/** Anropet tar den tid det tar - men inte längre än så här. */
const TIMEOUT_MS = 30_000;

/** Modellen är en driftparameter; standarden är en aktuell, snabb modell. */
const MODEL = (process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5").trim();

/** Ett tak, så ett svar inte kan skena i längd (och kostnad). */
const MAX_TOKENS = 1024;

export interface AdvisorMessage {
  role: "user" | "assistant";
  content: string;
}

export type AdvisorResult =
  | { status: "svar"; reply: string; model: string }
  | { status: "ingen-kalla"; reason: string }
  | { status: "fel"; reason: string };

export const anthropicConfigured = (): boolean =>
  (process.env.ANTHROPIC_API_KEY ?? "").trim().length > 0;

/**
 * CLEARANCE:s svar på ett samtal.
 *
 * `hamta` finns som parameter för att sviterna (och röktestet) ska kunna
 * pröva hela kedjan utan att binda sig vid den globala fetch:en - och för
 * att en körning bakom en proxy ska kunna skicka in en egen dispatcher. I
 * drift utelämnas den.
 */
export const clearanceReply = async (
  messages: AdvisorMessage[],
  hamta: typeof fetch = fetch,
): Promise<AdvisorResult> => {
  const key = (process.env.ANTHROPIC_API_KEY ?? "").trim();
  if (key.length === 0) {
    return {
      status: "ingen-kalla",
      reason: "Ingen modellnyckel är konfigurerad (ANTHROPIC_API_KEY).",
    };
  }
  const rensade = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && m.content.trim().length > 0)
    .map((m) => ({ role: m.role, content: m.content }));
  if (rensade.length === 0 || rensade[rensade.length - 1].role !== "user") {
    return { status: "fel", reason: "Samtalet måste sluta med ett meddelande från användaren." };
  }

  const avbryt = new AbortController();
  const klocka = setTimeout(() => avbryt.abort(), TIMEOUT_MS);
  let svar: Response;
  try {
    svar = await hamta(ENDPOINT, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": key,
        "anthropic-version": API_VERSION,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: CLEARANCE_SYSTEM_PROMPT,
        messages: rensade,
      }),
      signal: avbryt.signal,
    });
  } catch (error) {
    // Nätet, tidsgränsen eller en avbruten begäran. Ett uteblivet svar är
    // inte "modellen sa inget" - att blanda ihop dem gör ett driftfel till
    // ett samtalssvar.
    return {
      status: "fel",
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "Modellen svarade inte inom tidsgränsen."
          : "Modellen gick inte att nå.",
    };
  } finally {
    clearTimeout(klocka);
  }

  if (!svar.ok) {
    // Nyckelfel, kvotfel och begäranfel ser olika ut för driften men lika
    // ut för användaren. Statuskoden loggas; kroppen från Anthropic gör det
    // INTE - den kan i värsta fall spegla tillbaka delar av begäran.
    return { status: "fel", reason: `Modellen svarade ${svar.status}.` };
  }

  const data = (await svar.json()) as {
    content?: { type: string; text?: string }[];
    model?: string;
  };
  const text = (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("")
    .trim();
  if (text.length === 0) {
    return { status: "fel", reason: "Modellen svarade utan text." };
  }
  return { status: "svar", reply: text, model: data.model ?? MODEL };
};
