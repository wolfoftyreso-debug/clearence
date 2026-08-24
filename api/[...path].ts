/**
 * HELA API:ET, EN ENDA VERCEL-FUNKTION.
 *
 * Vercel gör varje fil under api/ till en egen endpoint. Serverkoden bor
 * därför i server/ (utanför api/) och den här filen är det enda som
 * plattformen ser: en catch-all som tar emot allt under /api och lämnar
 * över till samma router som den egna servern använder.
 *
 * EN funktion, inte 112. Skälen är tre, och de är inte estetiska:
 *
 *  1. En delad instans betyder en delad pool. 112 funktioner hade blivit
 *     112 pooler mot samma databas, var och en med sitt eget tak.
 *  2. Kallstarten betalas en gång per instans, inte en gång per resurs.
 *  3. Routern är redan skriven och prövad. Att dela upp den i filer hade
 *     varit att skriva den en gång till, med plattformens filnamn som
 *     enda specifikation.
 *
 * handle() är transportlöst med flit (server/index.ts) - det var
 * förberedelsen för exakt det här.
 */

import { handle, provaHastighet } from "../server/index";
import { SVARSRUBRIKER } from "../server/http";

/*
 * Formerna, inte @vercel/node.
 *
 * Paketet finns bara för typerna och hade blivit ett beroende till som
 * ska hållas aktuellt. `pg` är fortfarande den enda körtidsberoendet
 * servern har, och det ska den förbli.
 */
interface VercelRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
  socket?: { remoteAddress?: string };
}

interface VercelResponse {
  setHeader(namn: string, varde: string): void;
  status(kod: number): VercelResponse;
  json(kropp: unknown): void;
}

/**
 * Samma rubriker som den egna servern sätter - särskilt no-store.
 *
 * res.json() sätter bara content-type. Utan det här kunde en akt hamna i
 * en cache utanför vår kontroll, och radskyddet i databasen hjälper inte
 * mot ett svar som redan lämnat den.
 */
const svara = (res: VercelResponse, status: number, kropp: unknown): void => {
  for (const [namn, varde] of Object.entries(SVARSRUBRIKER)) res.setHeader(namn, varde);
  res.status(status).json(kropp);
};

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  const vard = String(req.headers.host ?? "clearance.se");
  const url = new URL(req.url ?? "/", `https://${vard}`);

  /*
   * /api-prefixet bort.
   *
   * Vercel routar hit på /api/**, men routern i server/index.ts känner
   * bara till /v1/**. Rewriten i vercel.json skickar /v1/x hit som
   * /api/v1/x; det som når routern ska vara /v1/x.
   *
   * (?=\/|$) så att en resurs som råkar heta /apixyz inte kapas.
   */
  const path = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";

  const avvisat = await provaHastighet(
    path,
    req.headers,
    req.socket?.remoteAddress ?? "okand",
  );
  if (avvisat) {
    for (const [namn, varde] of Object.entries(avvisat.headers)) res.setHeader(namn, varde);
    svara(res, avvisat.status, avvisat.body);
    return;
  }

  /*
   * Vercel har redan läst kroppen. En tom sträng är inte "{}" utan
   * "ingen kropp" - handle() skiljer på dem, och en POST utan kropp ska
   * få ett fel om resursen kräver en, inte tolkas som ett tomt objekt.
   */
  const body = req.body === undefined || req.body === "" ? null : req.body;

  const svar = await handle(req.method ?? "GET", path, req.headers, body, url.searchParams);
  svara(res, svar.status, svar.body);
}
