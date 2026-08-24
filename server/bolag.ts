/**
 * BOLAGSUPPSLAGET: organisationsnummer in, registerfakta ut.
 *
 * Låg som en Supabase Edge Function (supabase/functions/lookup-company i
 * repots historik).
 * Den var den sista biten körbar infrastruktur utanför den här servern och
 * band produkten till en plattform vi lämnar. Koden är densamma i sak;
 * det som ändrats är var den kör och vad som prövas innan den kör.
 *
 * TRE REGLER SOM INTE FANNS I EDGE-FUNKTIONEN:
 *
 *  1. Numret måste vara EXAKT tio siffror. Det prövas i rutten, före det
 *     här anropet. Utan det är funktionen en öppen proxy: den som styr
 *     `orgNumber` styr vilken adress vi hämtar.
 *  2. Anropet har en TIDSGRÄNS. En källa som aldrig svarar ska inte hålla
 *     en serverlös funktion vid liv tills plattformen dödar den.
 *  3. Svaret har ett TAK. Ett svar på hundra megabyte ska inte läsas in i
 *     minnet för att vi vill åt en rubrik.
 *
 * ETT NULL ÄR ETT GILTIGT SVAR. Registret har inte alla bolag, och sidan
 * ändrar utseende utan förvarning. Formuläret ska då låta användaren
 * skriva själv - inte visa ett rött fel om något som inte är fel.
 */

export interface Bolagsfakta {
  name: string;
  legalForm: string;
  address: string;
  sniCode: string;
  sniDescription: string;
}

const TIDSGRANS_MS = 8_000;
/** Sidan är några hundra kilobyte. En megabyte är gott om marginal. */
const TAK_BYTES = 1_000_000;

const KALLA = (process.env.COMPANY_LOOKUP_BASE ?? "https://www.allabolag.se").replace(/\/$/, "");

/** Injicerbar så sviten kan pröva tolkningen utan att röra nätet. */
export type Hamtare = (url: string) => Promise<{ ok: boolean; slutUrl: string; html: string } | null>;

const standardHamtare: Hamtare = async (url) => {
  const avbrytare = new AbortController();
  const klocka = setTimeout(() => avbrytare.abort(), TIDSGRANS_MS);
  try {
    const svar = await fetch(url, {
      redirect: "follow",
      signal: avbrytare.signal,
      headers: {
        "user-agent": "CLEARANCE/1.0 (+https://clearance.se)",
        accept: "text/html,application/xhtml+xml",
        "accept-language": "sv-SE,sv;q=0.9",
      },
    });
    if (!svar.ok) return null;

    // Läser i bitar med ett tak i stället för svar.text(): ett oväntat
    // stort svar ska inte kunna fylla funktionens minne.
    const lasare = svar.body?.getReader();
    if (!lasare) return null;
    const bitar: Uint8Array[] = [];
    let samlat = 0;
    for (;;) {
      const { done, value } = await lasare.read();
      if (done) break;
      if (!value) continue;
      bitar.push(value);
      samlat += value.length;
      if (samlat >= TAK_BYTES) {
        await lasare.cancel().catch(() => undefined);
        break;
      }
    }
    const buf = new Uint8Array(samlat);
    let i = 0;
    for (const b of bitar) {
      buf.set(b.subarray(0, Math.min(b.length, buf.length - i)), i);
      i += b.length;
      if (i >= buf.length) break;
    }
    return { ok: true, slutUrl: svar.url, html: new TextDecoder("utf-8").decode(buf) };
  } catch {
    // Tidsgräns, DNS, TLS - allt blir samma sak för anroparen: inget svar.
    return null;
  } finally {
    clearTimeout(klocka);
  }
};

/**
 * TOLKNINGEN, utbruten och prövbar.
 *
 * Den är avsiktligt konservativ: hellre ett tomt fält än ett gissat. Ett
 * tomt registerfält som fylls med "" eller "Aktiebolag" blir en uppgift
 * användaren tror är kontrollerad, och den tron är värre än luckan.
 */
export const tolkaBolagssida = (html: string, slutUrl: string): Bolagsfakta | null => {
  let namn = "";
  const ogTitel = /<meta[^>]*property="og:title"[^>]*content="([^"]+)"/i.exec(html);
  if (ogTitel) namn = ogTitel[1].split(" - ")[0].trim();
  if (!namn) {
    const titel = /<title>([^<]+)<\/title>/i.exec(html);
    if (titel) namn = titel[1].split(" - ")[0].split("|")[0].trim();
  }

  // Omdirigering till söksidan betyder att bolaget inte finns.
  if (!namn || /\/sok|search/i.test(slutUrl) || /sök/i.test(namn)) return null;

  let adress = "";
  const jsonLd = /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd[1]) as { address?: Record<string, unknown> };
      const a = data.address;
      if (a && typeof a === "object") {
        const delar = [a.streetAddress, a.postalCode, a.addressLocality]
          .filter((d): d is string => typeof d === "string" && d.length > 0);
        if (delar.length > 0) adress = delar.join(", ");
      }
    } catch {
      /* strukturerad data saknas eller är trasig - inte ett fel */
    }
  }
  if (!adress) {
    const m = /(?:Besöksadress|Postadress|Adress)[^<]*<[^>]*>([^<]{10,100})</i.exec(html);
    // Ett organisationsnummer är inte en adress.
    if (m && !/^\d{6}-?\d{4}$/.test(m[1].trim())) adress = m[1].trim();
  }

  let bolagsform = "";
  for (const monster of [
    /Bolagsform[:\s]*<[^>]*>([^<]+)/i,
    /Företagsform[:\s]*<[^>]*>([^<]+)/i,
    /"legalForm"[:\s]*"([^"]+)"/i,
  ]) {
    const m = monster.exec(html);
    if (m?.[1]?.trim()) {
      bolagsform = m[1].trim();
      break;
    }
  }

  let sniKod = "";
  let sniText = "";
  const sni = /SNI[:\s-]*(\d{2}\.?\d{0,3})[^<]*([A-Za-zÀ-ÖØ-öø-ÿ\s,]+)/i.exec(html);
  if (sni) {
    sniKod = sni[1];
    const text = sni[2]?.trim();
    // `{{...}}` är en mall som inte renderats. Den är inte en bransch.
    if (text && !text.includes("{{") && text.length > 3) sniText = text;
  }
  if (!sniText) {
    const m = /(?:Bransch|Verksamhet|Huvudbransch)[:\s]*<[^>]*>([^<]{5,100})</i.exec(html);
    const text = m?.[1]?.trim();
    if (text && !text.includes("{{") && !text.includes("groupId")) sniText = text;
  }

  const kapa = (s: string, max: number) => s.replace(/\s+/g, " ").trim().slice(0, max);
  return {
    name: kapa(namn, 200),
    legalForm: kapa(bolagsform, 100),
    address: kapa(adress, 300),
    sniCode: kapa(sniKod, 20),
    sniDescription: kapa(sniText, 200),
  };
};

export const slaUppBolag = async (
  orgNumber: string,
  hamta: Hamtare = standardHamtare,
): Promise<Bolagsfakta | null> => {
  if (!/^\d{10}$/.test(orgNumber)) return null;
  const svar = await hamta(`${KALLA}/${orgNumber}`);
  if (!svar?.ok) return null;
  return tolkaBolagssida(svar.html, svar.slutUrl);
};
