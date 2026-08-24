/**
 * HTTP-klienten mot CLEARANCE eget API.
 *
 * Ingen SDK, ingen genererad klient - `fetch` och trettio rader. Poängen
 * med att äga API:t går förlorad om klientsidan i stället binds till ett
 * annat bibliotek.
 *
 * Sessionstoken bor i localStorage och skickas som `Authorization:
 * Bearer`, precis som kontraktet deklarerar. Den lagras aldrig någon
 * annanstans, och `clearToken()` är det enda som behövs för att logga ut
 * lokalt - serverns `POST /auth/logout` återkallar den på riktigt.
 */

const TOKEN_KEY = "clearance-api-token";

/**
 * API:ET LIGGER PÅ SAMMA URSPRUNG.
 *
 * Här bodde en runtime-konfig: nginx sköt in `window.__CLEARANCE_CONFIG__`
 * i index.html vid start, så att EN byggd avbild kunde peka på olika
 * API:er i olika kluster. Det var rätt lösning på ett problem som inte
 * längre finns - på Vercel byggs och serveras appen och API:t från samma
 * distribution, på samma ursprung.
 *
 * TOM BAS ÄR NORMALLÄGET, inte ett fel. En relativ fetch mot `/v1/...`
 * går till samma ursprung, rewriten i vercel.json skickar den till
 * api/[...path].ts, och ingen CORS behövs. VITE_API_BASE_URL finns kvar
 * för utvecklingsläget, där Vite och API:t kör på olika portar.
 */
export const apiBaseUrl = (): string =>
  ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "").replace(/\/$/, "");

export const getToken = (): string | null => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    // Privat läge eller full lagring. Utan token blir varje anrop 401,
    // vilket är rätt utfall - bättre än att låtsas vara inloggad.
    return null;
  }
};

export const setToken = (token: string): void => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Se ovan.
  }
};

export const clearToken = (): void => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Se ovan.
  }
};

/** Felet som API:t svarar med, i kontraktets form. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** Sant för anrop som får ske utan inloggning (inloggningen själv). */
  anonymous?: boolean;
}

export const apiFetch = async <T>(path: string, opts: RequestOptions = {}): Promise<T> => {
  const base = apiBaseUrl();
  const headers: Record<string, string> = { accept: "application/json" };
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (!opts.anonymous) {
    const token = getToken();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`${base}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch (cause) {
    // Nätverksfel skiljs från API-fel: "kunde inte nå" och "fick nej" är
    // olika besked för den som felsöker.
    throw new ApiRequestError(0, "network_error", `Kunde inte nå API:t: ${String(cause)}`);
  }

  const text = await response.text();
  const payload = text ? (JSON.parse(text) as unknown) : null;

  if (!response.ok) {
    const error = (payload as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiRequestError(
      response.status,
      error?.code ?? "unknown",
      error?.message ?? `API:t svarade ${response.status}.`,
    );
  }
  return payload as T;
};
