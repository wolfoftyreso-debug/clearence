/**
 * CLEARANCE API v1 - egen server mot egen Postgres.
 *
 * Det här är delen infrakartan har stått och pekat på: klienten pratar
 * PostgREST via Supabase-klienten, och så länge den gör det är "inte
 * Supabase" en avsikt och inte ett faktum. DataPort är hela kontraktet,
 * och det här är serversidan av det.
 *
 * Vad som är byggt i den här omgången: identitetslagret (som är det som
 * inte får bli fel), sessionerna, och den första lodräta skivan av
 * kontraktet - ärenden, journalen och beslutsminnet inklusive
 * omprövningsbevakningen. Resten av DataPort är samma mönster igen; det
 * som var osäkert är avklarat.
 *
 * Kör: DATABASE_URL=... node api/dist/server.cjs (se main.ts)
 */

import { createServer } from "node:http";
import {
  ApiError,
  Router,
  badRequest,
  forbidden,
  notFound,
  readBody,
  sendJson,
  unauthorized,
  type ApiRequest,
} from "./http";
import { ALLMAN, klientNyckel, LOGIN, provaGrans, type Utfall } from "./rateLimit";
import { googleConfigured, lookupCompany } from "./google";
import { anthropicConfigured, clearanceReply, type AdvisorMessage } from "./anthropic";
import { deriveAuditDetail } from "../../src/lib/auditDetail";
import { withAnon, withUser } from "./db";
import { hashPassword, issueToken, sessionTtlHours, sha256, verifyPassword } from "./auth";

/* --- Identiteten bakom en request ----------------------------------------- */

interface Caller {
  userId: string;
  sessionId: string;
}

const bearer = (req: ApiRequest): string | null => {
  const header = req.headers.authorization;
  if (typeof header !== "string") return null;
  const [scheme, ...rest] = header.split(" ");
  if (scheme.toLowerCase() !== "bearer" || rest.length === 0) return null;
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
};

/**
 * Slår upp sessionen. Kör som anslutningens roll och INTE som någon
 * användare: identiteten är det vi håller på att ta reda på, och att
 * sätta den innan den är känd är hur man bygger en behörighetsbugg.
 */
const authenticate = async (req: ApiRequest): Promise<Caller> => {
  const token = bearer(req);
  if (!token) throw unauthorized();
  const hash = sha256(token);
  const row = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      `select s.id, s.user_id
         from auth.sessions s
         join auth.users u on u.id = s.user_id
        where s.token_hash = $1
          and s.revoked_at is null
          and s.expires_at > now()
          and u.disabled_at is null`,
      [hash],
    );
    return rows[0] ?? null;
  });
  // Samma svar för "finns inte", "återkallad" och "utgången". Skillnaden
  // hjälper bara den som gissar.
  if (!row) throw unauthorized("Sessionen är ogiltig eller har gått ut.");
  return { userId: row.user_id, sessionId: row.id };
};

/* --- Serialisering: kontraktets namn, aldrig kolumnnamnen ----------------- */

/**
 * Tidsstämplar som ISO-strängar, alltid.
 *
 * `pg` ger tillbaka JS-Date för timestamptz. JSON.stringify hade råkat
 * göra rätt på vägen ut, men då hade handlerns returvärde inte varit
 * samma sak som det klienten ser - och kontraktet säger `date-time`, en
 * sträng. Det som är sant på tråden ska vara sant i koden också.
 */
const iso = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
};

/**
 * Ärendet, HELT.
 *
 * Den här funktionen returnerade tidigare nio fält av trettio. Adaptern
 * castar svaret rakt till CaseRecord, så ett utelämnat fält blir inte ett
 * saknat värde utan ett LÖFTE SOM INTE HÅLLS: resten av produkten läser
 * recommendationReasons[0] och canPayTax som om de fanns. Översikten
 * kraschade på första raden i systemanalysen.
 *
 * Regeln som följer: den som lägger till ett fält i CaseRecord måste
 * lägga till det här. tests/apiSpec.ts jämför de två listorna och faller
 * annars - ett kontrakt som bara hålls av vaksamhet hålls inte.
 */
const asStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];

const toCase = (row: Record<string, unknown>) => ({
  id: row.id,
  orgNumber: row.org_number,
  companyName: row.company_name,
  employees: row.employees ?? null,
  canPaySalary: row.can_pay_salary ?? null,
  salaryAmount: row.salary_amount ?? null,
  salaryDay: row.salary_day ?? null,
  canPayTax: row.can_pay_tax ?? null,
  taxAmount: row.tax_amount ?? null,
  taxDay: row.tax_day ?? null,
  canPayRent: row.can_pay_rent ?? null,
  rentAmount: row.rent_amount ?? null,
  rentDay: row.rent_day ?? null,
  canPaySuppliers: row.can_pay_suppliers ?? null,
  totalDebt: row.total_debt ?? null,
  quickLiquidationValue: row.quick_liquidation_value ?? null,
  recommendationType: row.recommendation_type ?? null,
  recommendationTitle: row.recommendation_title ?? null,
  recommendationDescription: row.recommendation_description ?? null,
  // Listorna får ALDRIG vara undefined: läsaren gör [0] på dem.
  recommendationReasons: asStringArray(row.recommendation_reasons),
  recommendationNextSteps: asStringArray(row.recommendation_next_steps),
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  closedAt: iso(row.closed_at),
  exitReason: row.exit_reason ?? null,
  healthMode: row.health_mode ?? false,
  planApprovedAt: iso(row.plan_approved_at),
  planApprovedBy: row.plan_approved_by ?? null,
});

const toDecision = (row: Record<string, unknown>) => ({
  id: row.id,
  title: row.title,
  rationale: row.rationale,
  premise: row.premise,
  decidedAt: iso(row.decided_at),
  status: row.status,
  reconsideredAt: iso(row.reconsidered_at),
  reconsiderNote: row.reconsider_note,
  watch:
    row.watch_signal && row.watch_comparator
      ? {
          signal: row.watch_signal,
          comparator: row.watch_comparator,
          threshold: row.watch_threshold === null ? null : Number(row.watch_threshold),
        }
      : null,
  watchAckObservation: row.watch_ack_observation ?? null,
  watchAckAt: iso(row.watch_ack_at),
});

/**
 * En journalpost, HELT.
 *
 * Den här returnerade sex av tio fält, och `audit.listByCase` är en
 * MIGRERAD port som castar svaret rakt till AuditEventRecord. Följden var
 * samma sort som toCase varnar för några rader upp: caseId, actorUserId
 * och framför allt `detail` saknades - "vad händelsen gällde, läsbart".
 *
 * Utan detail blir hela händelseloggen "update, update, insert" för den
 * som kör mot eget API, medan samma logg via den gamla adaptern säger
 * "\"Ring revisorn\" bockades av". Det är inte ett saknat fält, det är en
 * borttappad funktion - och den syns bara för den som jämför två
 * adaptrar.
 *
 * Texten härleds med samma rena funktion som den gamla adaptern använder,
 * så att de två inte kan glida isär.
 */
const toEvent = (row: Record<string, unknown>) => ({
  id: Number(row.id),
  caseId: row.case_id ?? null,
  actorUserId: row.actor_user_id ?? null,
  actorRole: row.actor_role ?? null,
  action: row.action,
  objectType: row.object_type,
  objectId: row.object_id ?? null,
  detail: deriveAuditDetail(
    String(row.object_type),
    String(row.action),
    (row.before ?? null) as Record<string, unknown> | null,
    (row.after ?? null) as Record<string, unknown> | null,
  ),
  occurredAt: iso(row.occurred_at),
});

const toTask = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  label: row.label,
  dueDate: iso(row.due_date),
  doneAt: iso(row.done_at),
  doneBy: row.done_by,
  source: row.source,
  createdAt: iso(row.created_at),
  assignedTo: row.assigned_to,
});

const toDocument = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  kind: row.kind,
  fileName: row.file_name,
  fileSize: Number(row.file_size),
  mimeType: row.mime_type,
  source: row.source,
  reviewStatus: row.review_status,
  createdAt: iso(row.created_at),
  // storage_path lämnas AVSIKTLIGT ute: den är nyckeln till hinken, och
  // vägen till innehållet går genom en signerad URL efter
  // app.may_read_document() - aldrig genom att klienten får sökvägen.
});

const toPayment = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  label: row.label,
  amount: Number(row.amount),
  category: row.category,
  status: row.status,
  dueDate: iso(row.due_date),
  recurring: row.recurring,
});

const toMessage = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  conversationId: row.conversation_id,
  body: row.body,
  authorUserId: row.author_user_id,
  createdAt: iso(row.created_at),
});

/* --- Läshjälp -------------------------------------------------------------- */

const str = (body: unknown, field: string, opts: { max?: number; required?: boolean } = {}): string => {
  const value = (body as Record<string, unknown> | undefined)?.[field];
  if (value === undefined || value === null || value === "") {
    if (opts.required === false) return "";
    throw badRequest(`Fältet "${field}" saknas.`);
  }
  if (typeof value !== "string") throw badRequest(`Fältet "${field}" ska vara text.`);
  const trimmed = value.trim();
  if (opts.max && trimmed.length > opts.max) {
    throw badRequest(`Fältet "${field}" är längre än ${opts.max} tecken.`);
  }
  return trimmed;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidParam = (req: ApiRequest, name: string): string => {
  const value = req.params[name];
  // Prövas här och inte i databasen: ett trasigt id ska ge 400 med ett
  // begripligt besked, inte ett kastat typfel ur drivrutinen.
  if (!UUID.test(value)) throw badRequest(`"${name}" är inte ett giltigt id.`);
  return value;
};

/* --- Rutterna -------------------------------------------------------------- */

export const router = new Router();

/*
 * Hälsan säger också vilka YTTRE källor den här driften har.
 *
 * En källa som är ansluten i utvecklarens container och inte i
 * produktion ger en analys som tyst blir tunnare - utan att någon sagt
 * det. `sources` gör skillnaden avläsbar utifrån. Bara namn och ja/nej;
 * aldrig en nyckel eller ens dess längd.
 */
router.get("/v1/health", async () => ({
  status: 200,
  body: {
    status: "ok",
    version: "1.0",
    sources: { google: googleConfigured() },
    advisor: anthropicConfigured(),
  },
}));

/**
 * Uppslag av bolaget hos Google.
 *
 * KRÄVER INLOGGNING, trots att uppgifterna är offentliga. Skälet är inte
 * sekretess utan pengar: Places debiteras per anrop, och en öppen rutt är
 * någon annans gratis Google-konto på vår faktura. Den allmänna
 * hastighetsgränsen gäller dessutom före den här handlern.
 *
 * Svaret bär ALLTID ett status-fält som skiljer på "hittade inget",
 * "källan är inte ansluten" och "det gick fel". Panelen visar olika saker
 * för de tre, och att slå ihop dem till ett tomt resultat är precis den
 * sortens tystnad produkten är byggd för att undvika.
 */
router.post("/v1/sources/google", async (req) => {
  await authenticate(req);
  const body = (req.body ?? {}) as { companyName?: unknown; ort?: unknown };
  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  if (companyName.length === 0) throw badRequest("companyName krävs.");
  const ort = typeof body.ort === "string" ? body.ort.trim() : undefined;
  return { status: 200, body: await lookupCompany(companyName, ort) };
});

/**
 * CLEARANCE-samtalet, drivet av modellen.
 *
 * KRÄVER INLOGGNING, av samma skäl som Google-uppslaget: varje anrop
 * kostar pengar per token, och en öppen rutt vore någon annans gratis
 * körning på vår faktura. Den allmänna hastighetsgränsen gäller dessutom
 * före den här handlern.
 *
 * Klienten skickar hela det synliga samtalet (user/assistant), aldrig en
 * systemprompt - konstitutionen bor på servern (anthropic.ts) och kan inte
 * skrivas om från en webbläsare. Svaret bär ett status-fält som skiljer
 * "svar", "källan inte ansluten" och "det gick fel", precis som Google.
 */
router.post("/v1/advisor/reply", async (req) => {
  await authenticate(req);
  const body = (req.body ?? {}) as { messages?: unknown };
  if (!Array.isArray(body.messages)) throw badRequest("messages (en lista) krävs.");
  const messages: AdvisorMessage[] = [];
  for (const rad of body.messages) {
    const m = rad as { role?: unknown; content?: unknown };
    const role = m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null;
    if (role === null) throw badRequest('varje meddelande måste ha role "user" eller "assistant".');
    if (typeof m.content !== "string") throw badRequest("varje meddelande måste ha content som text.");
    messages.push({ role, content: m.content });
  }
  if (messages.length === 0) throw badRequest("messages får inte vara tom.");
  // Ett tak även på antalet: ett helt samtal, inte en oändlig historik.
  if (messages.length > 100) throw badRequest("samtalet är för långt (max 100 meddelanden).");
  return { status: 200, body: await clearanceReply(messages) };
});

/**
 * Inloggning.
 *
 * Fel lösenord och okänd adress ger SAMMA svar, och båda kostar samma tid:
 * en verifiering körs även när användaren inte finns, mot en attrapphash.
 * Utan det talar svarstiden om vilka adresser som har konton.
 */
const DUMMY_HASH_PROMISE = hashPassword("ingen-anvandare-har-det-har-losenordet");

router.post("/v1/auth/login", async (req) => {
  const email = str(req.body, "email", { max: 320 }).toLowerCase();
  const password = str(req.body, "password", { max: 400 });

  const user = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      "select id, password_hash from auth.users where email = $1 and disabled_at is null",
      [email],
    );
    return rows[0] ?? null;
  });

  const stored = user?.password_hash ?? (await DUMMY_HASH_PROMISE);
  const ok = await verifyPassword(password, stored);
  if (!user || !ok) throw unauthorized("Fel e-postadress eller lösenord.");

  const { token, hash } = issueToken();
  const session = await withAnon(async (tx) => {
    const { rows } = await tx.query(
      `insert into auth.sessions (user_id, token_hash, expires_at, user_agent)
       values ($1, $2, now() + make_interval(hours => $3), $4)
       returning id, expires_at`,
      [user.id, hash, sessionTtlHours(), String(req.headers["user-agent"] ?? "").slice(0, 300)],
    );
    return rows[0];
  });

  return {
    status: 200,
    // Token visas EN gång. Den lagras aldrig i klartext någonstans.
    body: { token, expiresAt: iso(session.expires_at), userId: user.id },
  };
});

router.post("/v1/auth/logout", async (req) => {
  const caller = await authenticate(req);
  await withAnon(async (tx) => {
    await tx.query("update auth.sessions set revoked_at = now() where id = $1 and revoked_at is null", [
      caller.sessionId,
    ]);
  });
  return { status: 200, body: { revoked: true } };
});

router.get("/v1/auth/me", async (req) => {
  const caller = await authenticate(req);
  const profile = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select user_id, role, display_name, phone from public.user_profiles where user_id = $1",
      [caller.userId],
    );
    return rows[0] ?? null;
  });
  return {
    status: 200,
    body: {
      userId: caller.userId,
      role: profile?.role ?? null,
      displayName: profile?.display_name ?? null,
      phone: profile?.phone ?? null,
    },
  };
});

router.get("/v1/cases", async (req) => {
  const caller = await authenticate(req);
  // Ingen where-sats på användaren: radskyddet gör urvalet. Skulle vi
  // filtrera här också dolde vi ett trasigt radskydd bakom applikationen.
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, org_number, company_name, employees,
              can_pay_salary, salary_amount, salary_day,
              can_pay_tax, tax_amount, tax_day,
              can_pay_rent, rent_amount, rent_day,
              can_pay_suppliers, total_debt, quick_liquidation_value,
              recommendation_type, recommendation_title, recommendation_description,
              recommendation_reasons, recommendation_next_steps,
              created_at, updated_at, closed_at, exit_reason,
              health_mode, plan_approved_at, plan_approved_by
         from public.cases order by created_at desc limit 100`,
    );
    return rows;
  });
  return { status: 200, body: { cases: rows.map(toCase) } };
});

router.get("/v1/cases/:caseId", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, org_number, company_name, employees,
              can_pay_salary, salary_amount, salary_day,
              can_pay_tax, tax_amount, tax_day,
              can_pay_rent, rent_amount, rent_day,
              can_pay_suppliers, total_debt, quick_liquidation_value,
              recommendation_type, recommendation_title, recommendation_description,
              recommendation_reasons, recommendation_next_steps,
              created_at, updated_at, closed_at, exit_reason,
              health_mode, plan_approved_at, plan_approved_by
         from public.cases where id = $1`,
      [caseId],
    );
    return rows[0] ?? null;
  });
  // Radskyddet filtrerar tyst: noll rader betyder "finns inte, för dig".
  // Vi skiljer inte på "finns inte" och "får inte se" - annars blir
  // svaret ett sätt att kartlägga vilka ärenden som existerar.
  if (!row) throw notFound("Ärendet finns inte, eller är inte ditt.");
  return { status: 200, body: toCase(row) };
});

/**
 * Journalen. Läses antingen med session ELLER med API-nyckel.
 *
 * Nyckelvägen går genom `api_journal()`, som gör sin egen prövning och
 * loggar användningen. Den vägen sätter aldrig någon användaridentitet:
 * nyckeln ÄR behörigheten.
 */
router.get("/v1/cases/:caseId/journal", async (req) => {
  const caseId = uuidParam(req, "caseId");

  // Kontraktet deklarerar EN säkerhetsmekanism: Authorization: Bearer.
  // Servern läste tidigare nyckeln ur x-api-key, alltså ett huvud som
  // inte stod någonstans i det publicerade kontraktet - en integration
  // byggd på dokumentationen hade fått 401 utan att förstå varför.
  // Nyckeln känns igen på sitt prefix (clr_, satt av create_api_key);
  // allt annat är en sessionstoken.
  const credential = bearer(req);
  if (credential?.startsWith("clr_")) {
    // api_journal returnerar JSONB, inte en radmängd. Den här raden löd
    // tidigare `select * from ...` och gav klienten ett svar i formen
    // [{ api_journal: {...} }] - alltså fel form på hela nyckelvägen.
    // Ingen märkte det, eftersom ingen kontroll gick den vägen. Nu gör
    // två av dem det.
    const payload = await withAnon(async (tx) => {
      const { rows } = await tx.query<{ journal: unknown }>(
        "select public.api_journal($1, $2) as journal",
        [credential, caseId],
      );
      return rows[0]?.journal ?? null;
    });
    // Funktionen svarar med null både för okänd nyckel och för ärende
    // utan åtkomst - samma tystnad, med flit: skillnaden hjälper bara
    // den som gissar. HTTP-lagret får inte återinföra skillnaden.
    if (payload === null) throw notFound("Ärendet finns inte, eller så ger nyckeln ingen åtkomst.");
    return { status: 200, body: payload };
  }

  const caller = await authenticate(req);
  const events = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, case_id, actor_user_id, actor_role, action, object_type, object_id,
              before, after, occurred_at
         from public.audit_events where case_id = $1
        order by occurred_at desc limit 500`,
      [caseId],
    );
    return rows.map(toEvent);
  });
  return { status: 200, body: { events } };
});

router.get("/v1/cases/:caseId/decisions", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "select * from public.case_decisions where case_id = $1 order by decided_at desc",
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { decisions: rows.map(toDecision) } };
});

const SIGNALS = ["loner", "skatt", "skuldtackning", "passerade_frister", "hyra", "leverantorer", "skuld"];
const COMPARATORS = ["minst", "hogst", "sant", "falskt"];

router.post("/v1/cases/:caseId/decisions", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const title = str(req.body, "title", { max: 200 });
  const rationale = str(req.body, "rationale", { max: 4000 });
  const premise = str(req.body, "premise", { max: 2000, required: false }) || null;

  // Villkoret prövas här OCH i databasen. Dubbelt med flit: kontrollen
  // här ger ett begripligt fel, kontrollen där gör regeln sann även för
  // den som inte går genom det här API:t.
  const raw = (req.body as Record<string, unknown> | undefined)?.watch;
  let watch: { signal: string; comparator: string; threshold: number | null } | null = null;
  if (raw !== undefined && raw !== null) {
    if (typeof raw !== "object") throw badRequest('Fältet "watch" ska vara ett objekt.');
    const w = raw as Record<string, unknown>;
    if (typeof w.signal !== "string" || !SIGNALS.includes(w.signal)) {
      throw badRequest(`"watch.signal" ska vara en av: ${SIGNALS.join(", ")}.`);
    }
    if (typeof w.comparator !== "string" || !COMPARATORS.includes(w.comparator)) {
      throw badRequest(`"watch.comparator" ska vara en av: ${COMPARATORS.join(", ")}.`);
    }
    const numeric = w.comparator === "minst" || w.comparator === "hogst";
    const threshold = w.threshold;
    if (numeric && typeof threshold !== "number") {
      throw badRequest('"watch.threshold" krävs för villkoret minst/högst.');
    }
    if (!numeric && threshold !== undefined && threshold !== null) {
      throw badRequest('"watch.threshold" hör inte till ett ja/nej-villkor.');
    }
    watch = { signal: w.signal, comparator: w.comparator, threshold: numeric ? (threshold as number) : null };
  }

  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.case_decisions
         (case_id, decided_by, title, rationale, premise, watch_signal, watch_comparator, watch_threshold)
       values ($1, $2, $3, $4, $5, $6, $7, $8)
       returning *`,
      [caseId, caller.userId, title, rationale, premise, watch?.signal ?? null, watch?.comparator ?? null, watch?.threshold ?? null],
    );
    return rows[0];
  });
  return { status: 201, body: toDecision(row) };
});

router.post("/v1/decisions/:decisionId/reconsider", async (req) => {
  const caller = await authenticate(req);
  const decisionId = uuidParam(req, "decisionId");
  const note = str(req.body, "note", { max: 2000 });
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `update public.case_decisions
          set status = 'reconsidered', reconsidered_at = now(), reconsider_note = $2
        where id = $1 returning *`,
      [decisionId, note],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Beslutet finns inte, eller är inte ditt.");
  return { status: 200, body: toDecision(row) };
});

router.post("/v1/decisions/:decisionId/acknowledge-premise", async (req) => {
  const caller = await authenticate(req);
  const decisionId = uuidParam(req, "decisionId");
  const observation = str(req.body, "observation", { max: 500 });
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.acknowledge_premise($1, $2)", [decisionId, observation]);
  });
  return { status: 200, body: { acknowledged: true } };
});

/* --- Översiktens data ------------------------------------------------------
 *
 * Ingen av frågorna nedan filtrerar på användare. Radskyddet gör urvalet,
 * och att lägga en where-sats här ovanpå hade dolt ett trasigt radskydd
 * bakom applikationen - felet hade slutat synas utan att sluta finnas.
 * Ett ärende man inte når ger därför en tom lista, inte ett fel: samma
 * tystnad som resten av produkten.
 */

const caseScoped = (
  path: string,
  query: string,
  map: (row: Record<string, unknown>) => unknown,
  key: string,
) =>
  router.get(path, async (req) => {
    const caller = await authenticate(req);
    const caseId = uuidParam(req, "caseId");
    const rows = await withUser(caller.userId, async (tx) => {
      const { rows } = await tx.query(query, [caseId]);
      return rows;
    });
    return { status: 200, body: { [key]: rows.map(map) } };
  });

caseScoped(
  "/v1/cases/:caseId/tasks",
  "select * from public.case_tasks where case_id = $1 order by created_at asc",
  toTask,
  "tasks",
);
caseScoped(
  "/v1/cases/:caseId/documents",
  `select id, case_id, kind, file_name, file_size, mime_type, source, review_status, created_at
     from public.case_documents where case_id = $1 order by created_at desc`,
  toDocument,
  "documents",
);
caseScoped(
  "/v1/cases/:caseId/payments",
  "select * from public.payments where case_id = $1 order by due_date asc",
  toPayment,
  "payments",
);
caseScoped(
  // Grundtråden: meddelanden utan tråd-id. Trådade hämtas per tråd, och
  // synligheten avgörs av radskyddet - inte av filtret här.
  "/v1/cases/:caseId/messages",
  `select id, case_id, conversation_id, body, author_user_id, created_at
     from public.case_messages where case_id = $1 and conversation_id is null
    order by created_at asc`,
  toMessage,
  "messages",
);

router.get("/v1/cases/:caseId/kbr", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select status, created_at from public.kbr_assessments
        where case_id = $1 order by created_at desc limit 1`,
      [caseId],
    );
    return rows[0] ?? null;
  });
  // Null och inte 404: "ingen bedömning gjord" är ett giltigt svar om
  // ärendet, inte ett fel. 404 hade blandat ihop de två.
  return {
    status: 200,
    body: row ? { status: row.status, createdAt: iso(row.created_at) } : null,
  };
});

/* --- Skrivvägarna ----------------------------------------------------------
 *
 * Samma princip som läsningarna: ingen where-sats på användaren.
 * Radskyddets INSERT- och UPDATE-policyer avgör om skrivningen får ske,
 * och en skrivning som inte får ske träffar noll rader. Därför prövas
 * utfallet - "ändrades något?" - och inte vilket lager som sa nej.
 */

router.post("/v1/cases/:caseId/tasks", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const label = str(req.body, "label", { max: 300 });
  const dueDateRaw = (req.body as Record<string, unknown> | undefined)?.dueDate;
  if (dueDateRaw !== undefined && dueDateRaw !== null && typeof dueDateRaw !== "string") {
    throw badRequest('Fältet "dueDate" ska vara ett datum som text, eller utelämnas.');
  }
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.case_tasks (case_id, label, due_date, source)
       values ($1, $2, $3, 'manual') returning *`,
      [caseId, label, (dueDateRaw as string | undefined) ?? null],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Uppgiften kunde inte läggas till i det här ärendet.");
  return { status: 201, body: toTask(row) };
});

router.post("/v1/tasks/:taskId/done", async (req) => {
  const caller = await authenticate(req);
  const taskId = uuidParam(req, "taskId");
  const doneRaw = (req.body as Record<string, unknown> | undefined)?.done;
  if (typeof doneRaw !== "boolean") throw badRequest('Fältet "done" ska vara true eller false.');
  const row = await withUser(caller.userId, async (tx) => {
    // Tidpunkten sätts av SERVERN, aldrig av klienten: en tidsstämpel som
    // den som bockar av får välja är inte bevis på när något gjordes.
    // Vem OCH när sätts tillsammans - ett halvt svar på "vem gjorde vad
    // när" är inget svar (samma regel som tabellens check-villkor).
    const { rows } = await tx.query(
      doneRaw
        ? `update public.case_tasks set done_at = now(), done_by = $2 where id = $1 returning *`
        : `update public.case_tasks set done_at = null, done_by = null where id = $1 returning *`,
      doneRaw ? [taskId, caller.userId] : [taskId],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Uppgiften finns inte, eller är inte din.");
  return { status: 200, body: toTask(row) };
});

router.post("/v1/tasks/:taskId/assign", async (req) => {
  const caller = await authenticate(req);
  const taskId = uuidParam(req, "taskId");
  const raw = (req.body as Record<string, unknown> | undefined)?.userId;
  if (raw !== null && typeof raw !== "string") {
    throw badRequest('Fältet "userId" ska vara ett id, eller null för att ta bort tilldelningen.');
  }
  if (typeof raw === "string" && !UUID.test(raw)) throw badRequest('"userId" är inte ett giltigt id.');
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "update public.case_tasks set assigned_to = $2 where id = $1 returning *",
      [taskId, raw],
    );
    return rows[0] ?? null;
  });
  if (!row) throw notFound("Uppgiften finns inte, eller är inte din.");
  return { status: 200, body: toTask(row) };
});

router.post("/v1/cases/:caseId/messages", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const body = str(req.body, "body", { max: 8000 });
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.case_messages (case_id, author_user_id, body)
       values ($1, $2, $3)
       returning id, case_id, conversation_id, body, author_user_id, created_at`,
      [caseId, caller.userId, body],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Meddelandet kunde inte skickas i det här ärendet.");
  return { status: 201, body: toMessage(row) };
});

router.post("/v1/documents/:documentId/review", async (req) => {
  const caller = await authenticate(req);
  const documentId = uuidParam(req, "documentId");
  const action = str(req.body, "action", { max: 20 });
  if (!["request", "approve", "reset"].includes(action)) {
    throw badRequest('Fältet "action" ska vara request, approve eller reset.');
  }
  // Genom funktionen: rollprövningen (godkännande kräver rådgivarroll)
  // bor där, inte här. Ett API som gör sin egen bedömning vid sidan om
  // blir en andra sanning som glider isär från den första.
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_document_review($1, $2)", [documentId, action]);
  });
  return { status: 200, body: { reviewed: true } };
});

/* --- Servern --------------------------------------------------------------- */

/**
 * Databasfel som ska bli ett vettigt HTTP-svar.
 *
 * Allt annat blir 500 med ett anonymt besked - ett databasmeddelande som
 * läcker ut i ett svar berättar för fel person hur schemat ser ut.
 */
const asHttpError = (error: unknown): ApiError => {
  if (error instanceof ApiError) return error;
  const err = error as { code?: string; message?: string };
  // Radskyddet nekade skrivningen.
  if (err.code === "42501") return forbidden("Behörighet saknas för åtgärden.");
  // Check-villkor, unikhet, främmande nyckel: klientens data, inte vårt fel.
  if (err.code === "23514" || err.code === "23505" || err.code === "23503") {
    return badRequest("Uppgifterna bryter mot en regel i ärendemodellen.");
  }
  // Våra egna raise exception i funktionerna.
  if (err.code === "P0001") return new ApiError(409, "conflict", err.message ?? "Åtgärden gick inte att utföra.");
  return new ApiError(500, "internal_error", "Något gick fel. Försök igen.");
};

/* --- Profilen -------------------------------------------------------------- */

/*
 * Profilen är det första varje inloggad vy frågar efter: rollen avgör
 * vilken startsida användaren möter. Den låg kvar hos den gamla adaptern
 * och gjorde därmed att ingen inloggning kunde köras helt mot eget API.
 */
const toProfile = (row: Record<string, unknown>) => ({
  userId: row.user_id,
  role: row.role,
  displayName: row.display_name ?? null,
  phone: row.phone ?? null,
});

router.get("/v1/profile", async (req) => {
  const caller = await authenticate(req);
  const row = await withUser(caller.userId, async (tx) => {
    // Ingen where-sats på användaren: radskyddet gör urvalet. Se
    // resonemanget vid översiktens frågor.
    const { rows } = await tx.query("select * from public.user_profiles limit 1");
    return rows[0] ?? null;
  });
  // Ingen profil är ett giltigt läge - den skapas vid första inloggningen.
  // 404 hade fått klienten att tro att något gått sönder.
  return { status: 200, body: { profile: row ? toProfile(row) : null } };
});

router.post("/v1/profile", async (req) => {
  const caller = await authenticate(req);
  const role = str(req.body, "role", { max: 40 });
  /*
   * ROLLEN VÄLJS EN GÅNG. En företagare som vill bli rådgivare ska gå
   * genom ansökan, inte genom att posta om sin profil - därför skapar den
   * här rutten bara, och uppdateringen nedan rör aldrig role.
   */
  if (!["company", "advisor", "admin"].includes(role)) {
    throw badRequest('Fältet "role" ska vara company, advisor eller admin.');
  }
  const displayName = str(req.body, "displayName", { max: 120, required: false });
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.user_profiles (user_id, role, display_name)
       values ($1, $2, $3)
       on conflict (user_id) do nothing
       returning *`,
      [caller.userId, role, displayName || null],
    );
    if (rows[0]) return rows[0];
    const { rows: befintlig } = await tx.query("select * from public.user_profiles limit 1");
    return befintlig[0] ?? null;
  });
  if (!row) throw forbidden("Profilen kunde inte skapas.");
  return { status: 201, body: toProfile(row) };
});

router.patch("/v1/profile", async (req) => {
  const caller = await authenticate(req);
  const displayName = str(req.body, "displayName", { max: 120, required: false });
  const phone = str(req.body, "phone", { max: 40, required: false });
  await withUser(caller.userId, async (tx) => {
    await tx.query(
      "update public.user_profiles set display_name = $1, phone = $2",
      [displayName || null, phone || null],
    );
  });
  return { status: 200, body: { updated: true } };
});

/* --- Ärendets livscykel ---------------------------------------------------- */

const EXIT_REASONS = ["stabilized", "reconstruction_completed", "bankruptcy", "liquidated", "other"];

router.post("/v1/cases/:caseId/close", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const reason = str(req.body, "reason", { max: 40 });
  if (!EXIT_REASONS.includes(reason)) {
    throw badRequest(`Fältet "reason" ska vara en av: ${EXIT_REASONS.join(", ")}.`);
  }
  const note = str(req.body, "note", { max: 2000, required: false });
  const enterHealth = (req.body as Record<string, unknown> | undefined)?.enterHealth === true;
  // Genom funktionen: den skriver händelseloggen och sätter hälsoläget i
  // samma transaktion. Att göra delarna här hade gett ett avslut utan
  // spår om något gick fel mitt i.
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.close_case($1, $2, $3, $4)", [
      caseId,
      reason,
      note || null,
      enterHealth,
    ]);
  });
  return { status: 200, body: { closed: true } };
});

router.post("/v1/cases/:caseId/reopen", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.reopen_case($1)", [caseId]);
  });
  return { status: 200, body: { reopened: true } };
});

router.post("/v1/cases/:caseId/plan-approval", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const approved = (req.body as Record<string, unknown> | undefined)?.approved;
  if (typeof approved !== "boolean") {
    throw badRequest('Fältet "approved" ska vara true eller false.');
  }
  // Att bara en rådgivarroll i ärendet får stämpla prövas i funktionen.
  await withUser(caller.userId, async (tx) => {
    await tx.query("select public.set_plan_approval($1, $2)", [caseId, approved]);
  });
  return { status: 200, body: { approved } };
});

/* --- Live ärendelänkar ----------------------------------------------------- */

const toShareLink = (row: Record<string, unknown>) => ({
  id: row.id,
  caseId: row.case_id,
  scope: row.scope === "full" ? "full" : "overview",
  label: row.label ?? null,
  createdAt: iso(row.created_at),
  expiresAt: iso(row.expires_at),
  revokedAt: iso(row.revoked_at),
  accessCount: Number(row.access_count ?? 0),
});

router.get("/v1/cases/:caseId/share-links", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const rows = await withUser(caller.userId, async (tx) => {
    // Öppningarna räknas i frågan i stället för i två anrop. Den gamla
    // vägen hämtade länkarna, sedan alla åtkomstrader, och räknade i
    // klienten - vilket blir fel så fort någon läser mellan de två.
    const { rows } = await tx.query(
      `select l.*, (select count(*) from public.share_link_access a where a.link_id = l.id) as access_count
         from public.case_share_links l
        where l.case_id = $1
        order by l.created_at desc`,
      [caseId],
    );
    return rows;
  });
  return { status: 200, body: { shareLinks: rows.map(toShareLink) } };
});

router.post("/v1/cases/:caseId/share-links", async (req) => {
  const caller = await authenticate(req);
  const caseId = uuidParam(req, "caseId");
  const scope = str(req.body, "scope", { max: 20 });
  if (!["overview", "full"].includes(scope)) {
    throw badRequest('Fältet "scope" ska vara overview eller full.');
  }
  const label = str(req.body, "label", { max: 120, required: false });
  const rawDays = (req.body as Record<string, unknown> | undefined)?.validDays;
  if (typeof rawDays !== "number" || !Number.isFinite(rawDays)) {
    throw badRequest('Fältet "validDays" ska vara ett tal.');
  }
  /*
   * Giltighetstiden KLÄMS, den avvisas inte. En länk utan bortre gräns är
   * en läcka som ingen minns, och samma klämning finns i den gamla
   * adaptern - att de två räknade olika hade gett länkar med olika
   * livslängd beroende på vilken väg in klienten råkade ta.
   */
  const days = Math.min(Math.max(Math.round(rawDays), 1), 365);
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `insert into public.case_share_links (case_id, scope, label, expires_at)
       values ($1, $2, $3, now() + make_interval(days => $4))
       returning *`,
      [caseId, scope, label || null, days],
    );
    return rows[0] ?? null;
  });
  if (!row) throw forbidden("Länken kunde inte skapas i det här ärendet.");
  return { status: 201, body: toShareLink({ ...row, access_count: 0 }) };
});

router.del("/v1/share-links/:linkId", async (req) => {
  const caller = await authenticate(req);
  const linkId = uuidParam(req, "linkId");
  // Återkallas, raderas inte: en borttagen rad tar med sig åtkomstloggen,
  // och då går det inte längre att svara på vem som läst vad.
  const row = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      "update public.case_share_links set revoked_at = now() where id = $1 and revoked_at is null returning id",
      [linkId],
    );
    return rows[0] ?? null;
  });
  // Redan återkallad ska inte bli ett fel: den som trycker två gånger har
  // fått det den ville ha.
  return { status: 200, body: { revoked: true, alreadyRevoked: !row } };
});

/**
 * Live-länkens läsning. ANONYM, precis som kontraktet säger.
 *
 * Funktionen prövar token, giltighetstid och återkallelse, loggar
 * öppningen och returnerar bara det som ryms i länkens scope. Ingen
 * autentisering här är alltså inte en glömd kontroll - det är hela
 * poängen med en delningslänk, och prövningen ligger där den inte går
 * att kringgå.
 */
router.get("/v1/shared/:token", async (req) => {
  const token = uuidParam(req, "token");
  const payload = await withAnon(async (tx) => {
    const { rows } = await tx.query("select public.fetch_shared_case($1) as data", [token]);
    return (rows[0]?.data ?? null) as Record<string, unknown> | null;
  });
  // Ogiltig, utgången och återkallad ger SAMMA svar. Skillnaden hjälper
  // bara den som gissar tokens.
  if (!payload) throw notFound("Länken är ogiltig, har gått ut eller är återkallad.");
  return {
    status: 200,
    body: {
      scope: payload.scope,
      expiresAt: iso(payload.expires_at),
      companyName: payload.company_name ?? null,
      orgNumber: payload.org_number,
      recommendationType: payload.recommendation_type ?? null,
      recommendationTitle: payload.recommendation_title ?? null,
      totalDebt: payload.total_debt ?? null,
      quickLiquidationValue: payload.quick_liquidation_value ?? null,
      canPaySalary: payload.can_pay_salary ?? null,
      canPayTax: payload.can_pay_tax ?? null,
      canPayRent: payload.can_pay_rent ?? null,
      canPaySuppliers: payload.can_pay_suppliers ?? null,
      salaryAmount: payload.salary_amount ?? null,
      salaryDay: payload.salary_day ?? null,
      taxAmount: payload.tax_amount ?? null,
      taxDay: payload.tax_day ?? null,
      rentAmount: payload.rent_amount ?? null,
      rentDay: payload.rent_day ?? null,
      closedAt: iso(payload.closed_at),
      healthMode: payload.health_mode === true,
      updatedAt: iso(payload.updated_at),
      documents: Array.isArray(payload.documents)
        ? (payload.documents as Record<string, unknown>[]).map((d) => ({
            fileName: d.file_name,
            kind: d.kind,
            reviewStatus: d.review_status,
            createdAt: iso(d.created_at),
          }))
        : null,
    },
  };
});

export const handle = async (
  method: string,
  path: string,
  headers: ApiRequest["headers"],
  body: unknown,
  query: URLSearchParams,
): Promise<{ status: number; body: unknown }> => {
  try {
    const matched = router.match(method, path);
    if (!matched) throw notFound("Okänd resurs.");
    return await matched.handler({ method, path, params: matched.params, query, headers, body });
  } catch (error) {
    const api = asHttpError(error);
    if (api.status >= 500) console.error("api error", error);
    return { status: api.status, body: { error: { code: api.code, message: api.message } } };
  }
};

export const createApiServer = () =>
  createServer((req, res) => {
    void (async () => {
      const url = new URL(req.url ?? "/", "http://localhost");

      /*
       * Hastighetsbegränsningen ligger FÖRE kroppsläsningen.
       *
       * Ordningen är inte likgiltig: läser vi kroppen först har vi redan
       * lagt tid och minne på ett anrop vi tänker avvisa, och en
       * forcering blir billigare för angriparen än för oss.
       *
       * Inloggningen har eget, hårdare tak - den är den enda ytan där
       * ett gissat värde ger åtkomst.
       */
      const inloggning = url.pathname === "/v1/auth/login";
      const nyckel = klientNyckel(req.headers, req.socket.remoteAddress ?? "okand");
      let grans: Utfall;
      try {
        grans = await provaGrans(
          `${inloggning ? "login" : "allman"}:${nyckel}`,
          inloggning ? LOGIN : ALLMAN,
        );
      } catch (error) {
        /*
         * VI STÄNGER VID FEL.
         *
         * Räkningen ligger i databasen sedan 20260811100000. Går den inte
         * att göra vet vi inte om anropet ryms - och att släppa igenom det
         * ändå gör en databasstörning till ett öppet fönster för
         * forcering av inloggningen.
         *
         * Att stänga kostar ingenting utöver det som ändå är förlorat:
         * API:et kan inte svara på någonting utan databasen. 503 och inte
         * 500, eftersom det är ett läge som går över.
         */
        console.error("hastighetsgränsen kunde inte prövas", error);
        res.setHeader("retry-after", "5");
        sendJson(res, 503, {
          error: {
            code: "tjansten_ar_upptagen",
            message: "Tjänsten kan inte ta emot anropet just nu. Försök igen om en stund.",
          },
        });
        return;
      }
      if (!grans.tillaten) {
        res.setHeader("retry-after", String(grans.retryAfter));
        sendJson(res, 429, {
          error: {
            code: "for_manga_forsok",
            message: `För många försök. Försök igen om ${grans.retryAfter} sekunder.`,
          },
        });
        return;
      }

      let body: unknown;
      try {
        body = await readBody(req);
      } catch (error) {
        const api = error instanceof ApiError ? error : badRequest("Kroppen gick inte att läsa.");
        sendJson(res, api.status, { error: { code: api.code, message: api.message } });
        return;
      }
      const result = await handle(req.method ?? "GET", url.pathname, req.headers, body, url.searchParams);
      sendJson(res, result.status, result.body);
    })();
  });
