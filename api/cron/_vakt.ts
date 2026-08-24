/**
 * VEM SOM HELST KAN NÅ EN VERCEL-FUNKTION.
 *
 * Cron-endpointerna under api/cron/ är HTTP-adresser som vilka som helst.
 * Vercels schemaläggare anropar dem - men så kan också vem som helst som
 * gissar sökvägen, och då körs faktureringen, stängningen av konton och
 * gallringen på begäran av en främling.
 *
 * Skyddet är en delad hemlighet i Authorization-rubriken, som Vercel
 * skickar när den kör ett cron-jobb (CRON_SECRET).
 *
 * VI FAILAR STÄNGT. Är CRON_SECRET osatt svarar vi 503 - inte "släpp
 * igenom eftersom ingen hemlighet är konfigurerad". Det senare hade gjort
 * en glömd miljövariabel till en öppen dörr, vilket är exakt den sortens
 * fel som aldrig syns.
 *
 * Filnamnet börjar med _ så att Vercel inte gör den till en endpoint.
 */

import { timingSafeEqual } from "node:crypto";

/** Kortare än så är inte en hemlighet, det är ett lösenord som gissas. */
const MINSTA_LANGD = 16;

export interface Svar {
  setHeader(namn: string, varde: string): void;
  status(kod: number): Svar;
  json(kropp: unknown): void;
}

export interface Fraga {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * Jämför utan att läcka hur långt en gissning kom.
 *
 * `===` på strängar avbryter vid första olika tecknet, och skillnaden går
 * att mäta över nätet. timingSafeEqual kräver lika längd, så längden
 * jämförs först - att längden läcker är oundvikligt och ofarligt.
 */
const likaHemligheter = (a: string, b: string): boolean => {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
};

/**
 * Släpper in Vercels schemaläggare och ingen annan.
 *
 * Returnerar true när jobbet får köras. Vid false har svaret redan
 * skickats - anroparen ska bara returnera.
 */
export const slappIn = (req: Fraga, res: Svar): boolean => {
  const hemlighet = process.env.CRON_SECRET ?? "";
  if (hemlighet.length < MINSTA_LANGD) {
    console.error(
      `CRON_SECRET saknas eller är kortare än ${MINSTA_LANGD} tecken - cron-jobben är avstängda.`,
    );
    res.status(503).json({
      error: {
        code: "cron_ej_konfigurerad",
        message: "Schemalagda jobb är inte konfigurerade.",
      },
    });
    return false;
  }

  const rubrik = req.headers.authorization;
  const angiven = Array.isArray(rubrik) ? rubrik[0] : rubrik;
  if (!angiven || !likaHemligheter(angiven, `Bearer ${hemlighet}`)) {
    res.status(401).json({ error: { code: "obehorig", message: "Obehörig." } });
    return false;
  }
  return true;
};

/**
 * Rapporterar utfallet.
 *
 * ETT FEL GER 500, inte 200 med en felrad i kroppen. Vercel märker en
 * cron-körning som misslyckad på statuskoden; svarar vi 200 på ett jobb
 * som kastade blir en trasig fakturering en tyst rad i en logg ingen
 * läser.
 */
export const rapportera = (
  res: Svar,
  jobb: string,
  utfall: { namn: string; fel: unknown }[],
): void => {
  const trasiga = utfall.filter((u) => u.fel !== null);
  for (const u of trasiga) console.error(`${jobb}/${u.namn}:`, u.fel);
  res.status(trasiga.length > 0 ? 500 : 200).json({
    jobb,
    kort: utfall.map((u) => ({
      steg: u.namn,
      ok: u.fel === null,
      fel: u.fel === null ? null : u.fel instanceof Error ? u.fel.message : String(u.fel),
    })),
  });
};

/**
 * Kör stegen i ordning och låter ETT fel inte stoppa resten.
 *
 * Nattjobbet gör flera saker som inte beror på varandra: gallring,
 * radering, kreditkontroller, fakturering. Kastar gallringen ska
 * faktureringen ändå köras - annars blir en enda trasig del ett stopp för
 * hela natten, och felet upptäcks först vid nästa månadsskifte.
 */
export const kor = async (
  steg: { namn: string; gor: () => Promise<void> }[],
): Promise<{ namn: string; fel: unknown }[]> => {
  const utfall: { namn: string; fel: unknown }[] = [];
  for (const s of steg) {
    try {
      await s.gor();
      utfall.push({ namn: s.namn, fel: null });
    } catch (fel) {
      utfall.push({ namn: s.namn, fel });
    }
  }
  return utfall;
};

/**
 * Öppnar, kör, stänger och rapporterar - med anslutningen INNANFÖR
 * felhanteringen.
 *
 * Handlarna gjorde `await anslut()` före sin try, och då blev en trasig
 * DATABASE_URL ett ofångat kast: Vercel svarar visserligen 500, men utan
 * kropp - alltså utan att säga VAD som gick fel, i ett jobb som ingen
 * tittar på förrän någon undrar var fakturorna tog vägen.
 *
 * Nu blir anslutningen ett steg som alla andra, med sitt eget namn i
 * rapporten.
 */
export const utforJobb = async (
  res: Svar,
  jobb: string,
  oppna: () => Promise<void>,
  stang: () => Promise<void>,
  steg: { namn: string; gor: () => Promise<void> }[],
): Promise<void> => {
  try {
    await oppna();
  } catch (fel) {
    rapportera(res, jobb, [{ namn: "anslutning", fel }]);
    return;
  }
  try {
    rapportera(res, jobb, await kor(steg));
  } finally {
    // Stängningen får inte dölja utfallet: svaret är redan skickat.
    await stang().catch((fel: unknown) => console.error(`${jobb}/nedkoppling:`, fel));
  }
};
