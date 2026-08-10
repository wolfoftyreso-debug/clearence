/**
 * FILKONTROLLEN, prövad som en angripare prövar den.
 *
 * Sviten skickar in det en angripare faktiskt skickar in: körbara filer med
 * .pdf-ändelse, SVG med skript, polyglotter, dubbla ändelser, sökvägar som
 * försöker klättra, och filer som ljuger om sin Content-Type. Varje sådan
 * ska AVVISAS - och de fem riktiga formaten ska fortfarande gå igenom, för
 * ett skydd som stoppar allt är samma sak som en trasig uppladdning.
 */

import { provaFil, sakerLagringsvag, MAX_FILSTORLEK, TILLATNA_TYPER } from "../api/server/filtyper";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed++;
  else {
    failed++;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

const b = (...n: number[]) => new Uint8Array(n);
const text = (s: string) => new TextEncoder().encode(s);
const PDF = b(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37); // %PDF-1.7
const PNG = b(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01);
const JPEG = b(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10);
const ZIP = b(0x50, 0x4b, 0x03, 0x04, 0x14, 0x00);
const ELF = b(0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01); // Linux-binär
const PE = b(0x4d, 0x5a, 0x90, 0x00); // Windows .exe

const prova = (filnamn: string, mimetyp: string, bytes: Uint8Array, storlek = bytes.length) =>
  provaFil({ filnamn, mimetyp, storlek, bytes });

/* --- 1. De riktiga filerna ska gå igenom -------------------------------- */

check("ett PDF tas emot", prova("arsredovisning.pdf", "application/pdf", PDF).ok === true);
check("ett PNG tas emot", prova("kvitto.png", "image/png", PNG).ok === true);
check("ett JPEG tas emot", prova("foto.jpg", "image/jpeg", JPEG).ok === true);
check("ett JPEG med .jpeg tas emot", prova("foto.jpeg", "image/jpeg", JPEG).ok === true);
check(
  "ett XLSX tas emot",
  prova("balans.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", ZIP).ok === true,
);
check("en CSV tas emot", prova("poster.csv", "text/csv", text("datum;belopp\n2026-01-01;100")).ok === true);
check("en SIE-fil tas emot", prova("bokforing.se", "text/plain", text("#FLAGGA 0\n#PROGRAM \"Fortnox\"")).ok === true);
check(
  "octet-stream godtas när bytesen stämmer (många klienter skickar det)",
  prova("arsredovisning.pdf", "application/octet-stream", PDF).ok === true,
);

/* --- 2. Angreppen ------------------------------------------------------- */

// Det klassiska: körbar fil med ofarlig ändelse.
{
  const r = prova("rapport.pdf", "application/pdf", ELF);
  check("en Linux-binär med .pdf-ändelse AVVISAS", r.ok === false, r);
  check("och skälet pekar på innehållet, inte på ändelsen", r.ok === false && /innehåll/i.test(r.skal), r);
}
check("en Windows-exe med .pdf-ändelse AVVISAS", prova("faktura.pdf", "application/pdf", PE).ok === false);
check("en exe med .exe-ändelse AVVISAS", prova("virus.exe", "application/octet-stream", PE).ok === false);
check("ett skalskript AVVISAS", prova("run.sh", "text/plain", text("#!/bin/sh\nrm -rf /")).ok === false);

// SVG: ett "bildformat" som kan köra kod.
{
  const svg = text('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>');
  const r = prova("logo.svg", "image/svg+xml", svg);
  check("SVG AVVISAS", r.ok === false, r);
  check("och skälet säger varför (skript)", r.ok === false && /skript/i.test(r.skal), r);
  check("SVG avvisas även med påhittad mimetyp", prova("logo.svg", "image/png", svg).ok === false);
  check("SVG avvisas även med .png-ändelse (bytesen räknas)", prova("logo.png", "image/png", svg).ok === false);
}

// Polyglott: bytesen säger PDF, ändelsen säger html.
check(
  "en polyglott (PDF-bytes, .html-ändelse) AVVISAS",
  prova("sida.html", "text/html", PDF).ok === false,
);
check("HTML AVVISAS rakt av", prova("sida.html", "text/html", text("<!doctype html><h1>hej")).ok === false);

// Dubbla ändelser - den SISTA är den operativsystemet läser.
check(
  "dubbel ändelse: rapport.pdf.exe AVVISAS",
  prova("rapport.pdf.exe", "application/pdf", PE).ok === false,
);
check(
  "dubbel ändelse: rapport.exe.pdf med exe-bytes AVVISAS",
  prova("rapport.exe.pdf", "application/pdf", PE).ok === false,
);

// En "csv" som i själva verket är märkspråk eller binärt.
check(
  "en csv som börjar med <html> AVVISAS",
  prova("data.csv", "text/csv", text("<html><body>hej</body></html>")).ok === false,
);
check(
  "en csv med nollbytes (binärt) AVVISAS",
  prova("data.csv", "text/csv", b(0x64, 0x00, 0x61, 0x74, 0x61)).ok === false,
);
check(
  "en csv med XML-inledning AVVISAS",
  prova("data.csv", "text/csv", text('<?xml version="1.0"?><rot/>')).ok === false,
);

// Arkiv vi inte kan bedöma.
check("en lös .zip AVVISAS", prova("akt.zip", "application/zip", ZIP).ok === false);
check("en .tar.gz AVVISAS", prova("akt.tar.gz", "application/gzip", b(0x1f, 0x8b, 0x08)).ok === false);

// Typen och innehållstypen måste vara överens.
check(
  "PDF-bytes med image/png som innehållstyp AVVISAS",
  prova("fil.pdf", "image/png", PDF).ok === false,
);

// Storlek: prövas mot det som FAKTISKT lagrades.
check("en tom fil AVVISAS", prova("tom.pdf", "application/pdf", PDF, 0).ok === false);
check("negativ storlek AVVISAS", prova("fil.pdf", "application/pdf", PDF, -5).ok === false);
{
  const r = prova("stor.pdf", "application/pdf", PDF, MAX_FILSTORLEK + 1);
  check("en fil över taket AVVISAS", r.ok === false, r);
  check("och skälet nämner gränsen i MB", r.ok === false && /MB/.test(r.skal), r);
}
check("precis på taket tas emot", prova("stor.pdf", "application/pdf", PDF, MAX_FILSTORLEK).ok === true);

// Utan ändelse går det inte att bedöma.
check("en fil utan ändelse AVVISAS", prova("filnamn", "application/pdf", PDF).ok === false);
check("en okänd ändelse AVVISAS", prova("fil.xyz", "application/octet-stream", PDF).ok === false);

/* --- 3. Lagringssökvägen bygger servern, inte klienten ------------------ */

const CASE = "aaaaaaaa-0000-0000-0000-00000000000a";
const ID = "11112222";

{
  const v = sakerLagringsvag(CASE, "../../../etc/passwd", ID);
  check("sökvägsklättring försvinner", !v.includes(".."), v);
  check("och sökvägen leder med ärendets id", v.startsWith(`${CASE}/`), v);
}
check(
  "absolut sökväg klättrar inte ut",
  !sakerLagringsvag(CASE, "/etc/shadow", ID).includes("/etc/"),
  sakerLagringsvag(CASE, "/etc/shadow", ID),
);
check(
  "backslash-klättring försvinner",
  !sakerLagringsvag(CASE, "..\\..\\windows\\system32", ID).includes(".."),
  sakerLagringsvag(CASE, "..\\..\\windows\\system32", ID),
);
{
  const v = sakerLagringsvag(CASE, "årsredovisning 2026.pdf", ID);
  check("svenska tecken saneras men namnet överlever", /arsredovisning-2026\.pdf$/.test(v), v);
}
check(
  "ett tomt namn ger ändå en giltig sökväg",
  sakerLagringsvag(CASE, "", ID) === `${CASE}/${ID}-fil`,
  sakerLagringsvag(CASE, "", ID),
);
{
  const v = sakerLagringsvag(CASE, "a".repeat(500) + ".pdf", ID);
  check("ett absurt långt namn kapas", v.length < 200, v.length);
}
check(
  "två uppladdningar av samma namn krockar inte",
  sakerLagringsvag(CASE, "rapport.pdf", "aaa") !== sakerLagringsvag(CASE, "rapport.pdf", "bbb"),
);

/* --- 4. Listan är en tillåtelselista ------------------------------------ */

check("varje tillåten typ har minst en signatur", TILLATNA_TYPER.every((t) => t.signaturer.length > 0));
check("ingen tillåten typ är svg", !TILLATNA_TYPER.some((t) => t.andelser.includes("svg")));
check("taket är satt och rimligt", MAX_FILSTORLEK > 0 && MAX_FILSTORLEK <= 100 * 1024 * 1024);

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
