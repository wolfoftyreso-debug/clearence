/**
 * VAD FILEN FAKTISKT ÄR - inte vad den påstår sig vara.
 *
 * En uppladdning bär tre påståenden från klienten: filnamnet, ändelsen och
 * Content-Type. Alla tre är fritext som avsändaren väljer. Att lita på dem
 * är att låta angriparen bestämma sin egen behörighetsprövning.
 *
 * Den här filen prövar det fjärde: BYTESEN. Ett PDF börjar med "%PDF-",
 * ett PNG med en åtta bytes lång signatur, ett XLSX är en ZIP som börjar
 * med "PK". Signaturen sitter i filen, inte i vad någon skrev om den.
 *
 * TRE SAKER SOM AVVISAS OCH VARFÖR:
 *
 *  1. SVG. Är XML, kan bära <script>, och renderas som ett dokument av
 *     webbläsaren. Ett "bildformat" som kan köra kod är inte en bild.
 *  2. ARKIV OCH KÖRBARA FILER. En zip vi inte packar upp är en zip vi inte
 *     kan bedöma; ELF/PE/Mach-O och skalskript hör inte hemma i en akt.
 *     XLSX är ett undantag med öppna ögon - det ÄR en zip, men en zip med
 *     ett känt innehåll som vi aldrig packar upp själva.
 *  3. POLYGLOTTER. En fil vars bytes säger PDF men vars ändelse säger .html
 *     är byggd för att tolkas olika av olika läsare. Vi kräver att bytesen
 *     och den utlovade typen är ÖVERENS, annars avvisas den.
 *
 * Storleken prövas mot det som FAKTISKT lagrades, inte mot det klienten
 * uppgav - ett tal i en JSON-kropp är inte en mätning.
 */

/** Taket per fil. Driftparameter, inte en siffra utspridd i koden. */
export const MAX_FILSTORLEK = Number(process.env.MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024);

export interface Filtyp {
  /** Kontraktets namn på typen. */
  id: string;
  /** Ändelser som får bära typen. */
  andelser: string[];
  /** Godkända Content-Type-värden. */
  mimetyper: string[];
  /** Signaturen: bytes som måste stå på en viss plats. */
  signaturer: { offset: number; bytes: number[] }[];
}

/**
 * Vad en akt får innehålla. Listan är en TILLÅTELSELISTA med flit: allt som
 * inte står här avvisas, i stället för att vi försöker räkna upp allt
 * farligt. Den listan tar aldrig slut.
 */
export const TILLATNA_TYPER: Filtyp[] = [
  {
    id: "pdf",
    andelser: ["pdf"],
    mimetyper: ["application/pdf"],
    signaturer: [{ offset: 0, bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }], // %PDF-
  },
  {
    id: "png",
    andelser: ["png"],
    mimetyper: ["image/png"],
    signaturer: [{ offset: 0, bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }],
  },
  {
    id: "jpeg",
    andelser: ["jpg", "jpeg"],
    mimetyper: ["image/jpeg"],
    signaturer: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }],
  },
  {
    // XLSX/DOCX är ZIP-behållare. Vi packar ALDRIG upp dem - de lagras och
    // lämnas vidare som de är, så en zip-bomb har inget att spränga hos oss.
    id: "xlsx",
    andelser: ["xlsx"],
    mimetyper: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
    signaturer: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }], // PK..
  },
  {
    id: "docx",
    andelser: ["docx"],
    mimetyper: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
    signaturer: [{ offset: 0, bytes: [0x50, 0x4b, 0x03, 0x04] }],
  },
];

/**
 * Textformat har ingen signatur - de känns igen på att de INTE är något
 * annat. De prövas därför tvärtom: inga styrbytes, giltig UTF-8, och ingen
 * inledning som ser ut som märkspråk (en "csv" som börjar med <html> är
 * inte en csv).
 */
export const TEXTTYPER: { id: string; andelser: string[]; mimetyper: string[] }[] = [
  { id: "csv", andelser: ["csv"], mimetyper: ["text/csv", "application/csv"] },
  { id: "sie", andelser: ["se", "si", "sie"], mimetyper: ["text/plain", "application/octet-stream"] },
  { id: "txt", andelser: ["txt"], mimetyper: ["text/plain"] },
];

export type Utfall =
  | { ok: true; typ: string }
  | { ok: false; skal: string };

const andelseAv = (filnamn: string): string => {
  const i = filnamn.lastIndexOf(".");
  return i > 0 ? filnamn.slice(i + 1).toLowerCase() : "";
};

const matchar = (bytes: Uint8Array, sig: { offset: number; bytes: number[] }): boolean =>
  sig.bytes.every((b, i) => bytes[sig.offset + i] === b);

/** Ser inledningen ut som märkspråk? Då är det inte en textrapport. */
const serUtSomMarksprak = (bytes: Uint8Array): boolean => {
  const inledning = new TextDecoder("utf-8", { fatal: false })
    .decode(bytes.slice(0, 512))
    .trimStart()
    .toLowerCase();
  return (
    inledning.startsWith("<!doctype") ||
    inledning.startsWith("<html") ||
    inledning.startsWith("<?xml") ||
    inledning.startsWith("<svg") ||
    inledning.startsWith("<script")
  );
};

const harStyrbytes = (bytes: Uint8Array): boolean =>
  // Tab, LF och CR är tillåtna; övriga styrtecken och nollbyte betyder binärt.
  bytes.some((b) => b === 0x00 || (b < 0x09) || (b > 0x0d && b < 0x20));

/**
 * Prövar en uppladdning mot vad den FAKTISKT innehåller.
 *
 * `bytes` behöver bara vara filens första kilobyte - signaturen sitter
 * främst. `storlek` ska vara den lagrade filens verkliga storlek.
 */
/**
 * Det som går att bedöma UTAN filen: namn, utlovad typ, uppgiven storlek.
 *
 * Skild från provaFil() med flit. Uppladdningens steg 1 har ännu inga bytes
 * att titta på, och måste ändå kunna säga nej till det som aldrig kan bli
 * godkänt (en .svg, ett skalskript, en orimlig storlek) - annars ber vi om
 * en uppladdning vi tänker slänga. Att i det läget köra provaFil() med en
 * tom byteslista gav "Filen är tom" på ALLT, och sållet blev verkningslöst.
 *
 * Det här är INTE ett skydd. Skyddet är bytesen i steg 2.
 */
export const provaMetadata = (input: {
  filnamn: string;
  mimetyp: string;
  storlek: number;
}): Utfall => {
  const { filnamn, mimetyp, storlek } = input;
  if (!Number.isFinite(storlek) || storlek <= 0) return { ok: false, skal: "Filen är tom." };
  if (storlek > MAX_FILSTORLEK) {
    return { ok: false, skal: `Filen är större än ${Math.floor(MAX_FILSTORLEK / 1024 / 1024)} MB.` };
  }

  const andelse = andelseAv(filnamn);
  if (!andelse) return { ok: false, skal: "Filen saknar ändelse." };
  const mime = (mimetyp || "").split(";")[0].trim().toLowerCase();

  // SVG avvisas uttryckligen, med sitt eget skäl - annars hade den fallit
  // ut som "okänd typ" och den som laddade upp hade inte förstått varför.
  if (andelse === "svg" || mime === "image/svg+xml") {
    return { ok: false, skal: "SVG tas inte emot: formatet kan bära skript." };
  }

  const binart = TILLATNA_TYPER.find((t) => t.andelser.includes(andelse));
  if (binart) {
    if (!binart.mimetyper.includes(mime) && mime !== "application/octet-stream") {
      return { ok: false, skal: "Filens typ och innehållstyp stämmer inte överens." };
    }
    return { ok: true, typ: binart.id };
  }
  const text = TEXTTYPER.find((t) => t.andelser.includes(andelse));
  if (text) return { ok: true, typ: text.id };
  return { ok: false, skal: `Filtypen .${andelse} tas inte emot.` };
};

export const provaFil = (input: {
  filnamn: string;
  mimetyp: string;
  storlek: number;
  bytes: Uint8Array;
}): Utfall => {
  const { filnamn, mimetyp, storlek, bytes } = input;

  // Allt som går att avgöra utan filen avgörs först.
  const metadata = provaMetadata({ filnamn, mimetyp, storlek });
  if (!metadata.ok) return metadata;

  if (bytes.length === 0) return { ok: false, skal: "Filen är tom." };

  const andelse = andelseAv(filnamn);
  const mime = (mimetyp || "").split(";")[0].trim().toLowerCase();
  void mime;

  const binart = TILLATNA_TYPER.find((t) => t.andelser.includes(andelse));
  if (binart) {
    if (!binart.mimetyper.includes(mime) && mime !== "application/octet-stream") {
      return { ok: false, skal: "Filens typ och innehållstyp stämmer inte överens." };
    }
    if (!binart.signaturer.some((s) => matchar(bytes, s))) {
      // Det här är fällan som ändelsen ensam aldrig fångar: en .pdf vars
      // bytes är något helt annat.
      return { ok: false, skal: "Filens innehåll stämmer inte med dess filtyp." };
    }
    return { ok: true, typ: binart.id };
  }

  const text = TEXTTYPER.find((t) => t.andelser.includes(andelse));
  if (text) {
    if (serUtSomMarksprak(bytes)) {
      return { ok: false, skal: "Filen innehåller märkspråk och tas inte emot som text." };
    }
    if (harStyrbytes(bytes)) {
      return { ok: false, skal: "Filens innehåll stämmer inte med dess filtyp." };
    }
    return { ok: true, typ: text.id };
  }

  return { ok: false, skal: `Filtypen .${andelse} tas inte emot.` };
};

/**
 * Sökvägen filen lagras under. Byggs av SERVERN, aldrig av klienten.
 *
 * Ärendets id leder, sedan ett slumpat id, sedan ett sanerat namn. Inget
 * segment kommer från användaren i obehandlat skick, så `../` har ingenstans
 * att ta vägen: snedstreck och punkter faller bort i saneringen.
 *
 * NAMNET LIGGER SIST, i ett eget led. Det är inte kosmetika: Vercel Blob
 * sätter content-disposition ur sökvägens sista led och tar inte emot ett
 * eget filnamn vid signeringen (som S3:s response-content-disposition).
 * Ligger namnet efter ett bindestreck får den som laddar ned en fil som
 * heter "1a2b3c-arsredovisning.pdf". Med ett snedstreck heter den
 * "arsredovisning.pdf" - och slumpid:t gör sökvägen unik precis lika bra.
 */
export const sakerLagringsvag = (caseId: string, filnamn: string, slumpId: string): string => {
  const rent = filnamn
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-.]+/, "")
    .slice(-120);
  return `${caseId}/${slumpId}/${rent || "fil"}`;
};
