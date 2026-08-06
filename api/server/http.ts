/**
 * HTTP-lagret: en router, ett felformat, inga ramverk.
 *
 * Varför inget ramverk: produktens arkitekturpoäng är att inte sitta fast
 * i någon annans beslut. Ett API med ett (1) beroende - databasdrivrutinen
 * - går att flytta, granska och förstå i sin helhet. Routern nedan är
 * sextio rader; ett ramverk hade varit hundratusen rader vi inte läser.
 */

import type { IncomingMessage, ServerResponse } from "node:http";

export interface ApiRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: URLSearchParams;
  headers: IncomingMessage["headers"];
  body: unknown;
}

export type Handler = (req: ApiRequest) => Promise<ApiResult>;

export interface ApiResult {
  status: number;
  body: unknown;
}

/**
 * Fel i kontraktets form (components/schemas/Error), alltid.
 *
 * `message` är på svenska och skriven för en människa som läser en logg
 * klockan tre på natten: vad gick fel och vad gör man åt det.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (message: string) => new ApiError(400, "bad_request", message);
export const unauthorized = (message = "Autentisering krävs.") =>
  new ApiError(401, "unauthorized", message);
export const forbidden = (message = "Behörighet saknas för resursen.") =>
  new ApiError(403, "forbidden", message);
export const notFound = (message = "Resursen finns inte.") =>
  new ApiError(404, "not_found", message);

interface Route {
  method: string;
  /** Segment; ":namn" fångar en parameter. */
  segments: string[];
  handler: Handler;
}

export class Router {
  private routes: Route[] = [];

  add(method: string, pattern: string, handler: Handler): this {
    this.routes.push({
      method,
      segments: pattern.split("/").filter(Boolean),
      handler,
    });
    return this;
  }

  get = (p: string, h: Handler) => this.add("GET", p, h);
  post = (p: string, h: Handler) => this.add("POST", p, h);
  /*
   * PATCH och DELETE finns för att kontraktet redan lovar dem - t.ex.
   * DELETE /share-links/{linkId}. Att i stället bygga en POST-variant
   * hade betytt att servern och kontraktet sa olika saker om samma
   * resurs, och det är precis den glidning tests/apiSpec.ts numera vaktar.
   */
  patch = (p: string, h: Handler) => this.add("PATCH", p, h);
  del = (p: string, h: Handler) => this.add("DELETE", p, h);

  match(method: string, path: string): { handler: Handler; params: Record<string, string> } | null {
    const parts = path.split("/").filter(Boolean);
    // Sökvägen matchas före metoden, så en känd sökväg med fel metod ger
    // 405 och inte 404: skillnaden är hela skillnaden när man felsöker.
    let pathMatched = false;
    for (const route of this.routes) {
      if (route.segments.length !== parts.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let i = 0; i < parts.length; i++) {
        const seg = route.segments[i];
        if (seg.startsWith(":")) params[seg.slice(1)] = decodeURIComponent(parts[i]);
        else if (seg !== parts[i]) { ok = false; break; }
      }
      if (!ok) continue;
      pathMatched = true;
      if (route.method === method) return { handler: route.handler, params };
    }
    if (pathMatched) throw new ApiError(405, "method_not_allowed", "Metoden stöds inte för resursen.");
    return null;
  }
}

/** Max 1 MiB in. En kropp som växer obegränsat är en gratis minnesattack. */
const MAX_BODY = 1024 * 1024;

export const readBody = async (req: IncomingMessage): Promise<unknown> => {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw badRequest("Förfrågan är för stor.");
    chunks.push(chunk as Buffer);
  }
  if (!chunks.length) return undefined;
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw badRequest("Kroppen är inte giltig JSON.");
  }
};

export const sendJson = (res: ServerResponse, status: number, body: unknown): void => {
  const payload = JSON.stringify(body ?? null);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(payload),
    // Ärendedata ska aldrig cachas av ett mellanled.
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  });
  res.end(payload);
};
