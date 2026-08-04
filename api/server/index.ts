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

const toCase = (row: Record<string, unknown>) => ({
  id: row.id,
  orgNumber: row.org_number,
  companyName: row.company_name,
  createdAt: iso(row.created_at),
  updatedAt: iso(row.updated_at),
  closedAt: iso(row.closed_at),
  healthMode: row.health_mode,
  recommendationType: row.recommendation_type,
  recommendationTitle: row.recommendation_title,
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

const toEvent = (row: Record<string, unknown>) => ({
  id: String(row.id),
  action: row.action,
  objectType: row.object_type,
  objectId: row.object_id,
  actorRole: row.actor_role ?? null,
  occurredAt: iso(row.occurred_at),
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

router.get("/v1/health", async () => ({
  status: 200,
  body: { status: "ok", version: "1.0" },
}));

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
      `select id, org_number, company_name, created_at, updated_at, closed_at,
              health_mode, recommendation_type, recommendation_title
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
      `select id, org_number, company_name, created_at, updated_at, closed_at,
              health_mode, recommendation_type, recommendation_title
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
  const apiKey = req.headers["x-api-key"];

  if (typeof apiKey === "string" && apiKey.length > 0) {
    const events = await withAnon(async (tx) => {
      const { rows } = await tx.query("select * from public.api_journal($1, $2)", [apiKey, caseId]);
      return rows;
    });
    return { status: 200, body: { events } };
  }

  const caller = await authenticate(req);
  const events = await withUser(caller.userId, async (tx) => {
    const { rows } = await tx.query(
      `select id, action, object_type, object_id, occurred_at, actor_role
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
