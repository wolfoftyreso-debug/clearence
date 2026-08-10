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
 * RUNTIME-KONFIG. Vite bakar in `import.meta.env` vid BYGGET, vilket binder
 * en byggd avbild till en enda miljö. I ett kluster vill vi ha EN avbild
 * som fungerar överallt. Därför läser klienten först en runtime-konfig som
 * servern (nginx) skjuter in i sidan vid start - `window.__CLEARANCE_CONFIG__`
 * - och faller tillbaka på byggvärdet bara när den saknas.
 *
 * Sätter servern basen till tom sträng betyder det SAMMA ORIGIN: nginx
 * proxar `/v1` till API:t, så en relativ fetch räcker och ingen CORS behövs.
 */
interface RuntimeConfig {
  apiBaseUrl?: string;
}
const runtimeConfig = (): RuntimeConfig | undefined =>
  (globalThis as { __CLEARANCE_CONFIG__?: RuntimeConfig }).__CLEARANCE_CONFIG__;

/** Sant när servern uttryckligen konfigurerat basen (även till tom = samma origin). */
const runtimeBaseConfigured = (): boolean => {
  const rt = runtimeConfig();
  return !!rt && typeof rt.apiBaseUrl === "string";
};

export const apiBaseUrl = (): string => {
  const rt = runtimeConfig();
  const raw =
    rt && typeof rt.apiBaseUrl === "string"
      ? rt.apiBaseUrl
      : ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "");
  return raw.replace(/\/$/, "");
};

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
  // Tom bas är ett fel BARA om ingen konfig satt den. Har servern satt den
  // till tom sträng är det ett medvetet val: samma origin, relativ fetch.
  if (!base && !runtimeBaseConfigured()) {
    throw new ApiRequestError(
      0,
      "no_api_base_url",
      "Ingen API-bas är konfigurerad - varken runtime-konfig eller VITE_API_BASE_URL.",
    );
  }
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
