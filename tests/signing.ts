/**
 * Signeringen: bevisdelarna, kontrollen och ärligheten.
 *
 * Den viktigaste regeln som testas här är den om vad vi INTE påstår.
 * Produkten används av människor med juridiskt ansvar - en text som
 * antyder BankID-nivå är ett fel som kostar mer än en trasig knapp.
 */

import {
  INTEGRITY_LABEL,
  SIGNATURE_LIMITS,
  SIGNATURE_STATEMENT,
  SIGNATURE_STRENGTHS,
  checkIntegrity,
  formatFingerprint,
  formatSignedAt,
  isValidSignerName,
  sha256Hex,
} from "../src/lib/signing";
import { buildSignatureCertificate } from "../src/lib/reports/signatureDocument";
import { renderReport } from "../src/lib/reports/render";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, extra?: unknown) => {
  if (ok) passed += 1;
  else {
    failed += 1;
    console.log(`FAIL ${name}${extra === undefined ? "" : `\n     ${JSON.stringify(extra)}`}`);
  }
};

/* --- intygstexten --------------------------------------------------- */

check("intyget är versionerat", SIGNATURE_STATEMENT.version === "1.0");
check(
  "intyget säger vad man läst, att uppgifterna är riktiga och att det förseglas",
  /läst handlingen i sin helhet/.test(SIGNATURE_STATEMENT.text) &&
    /uppgifterna\s+i den är riktiga/.test(SIGNATURE_STATEMENT.text) &&
    /förseglas/.test(SIGNATURE_STATEMENT.text),
);

/* --- ärligheten ----------------------------------------------------- */

check("begränsningarna nämner BankID uttryckligen", SIGNATURE_LIMITS.some((t) => /BankID/.test(t)));
check(
  "begränsningarna säger enkel, inte avancerad eller kvalificerad",
  SIGNATURE_LIMITS.some((t) => /enkel elektronisk signatur/i.test(t)) &&
    SIGNATURE_LIMITS.some((t) => /avancerad eller kvalificerad/i.test(t)),
);
check(
  "begränsningarna säger att identiteten bygger på inloggningen",
  SIGNATURE_LIMITS.some((t) => /inloggningen/i.test(t) && /inte på legitimation/i.test(t)),
);
check(
  "begränsningarna nämner formkravet",
  SIGNATURE_LIMITS.some((t) => /bevittnad namnteckning/i.test(t)),
);
check("styrkorna täcker vem, vad, när", SIGNATURE_STRENGTHS.length === 4);
check(
  "styrkorna lovar aldrig identitetskontroll",
  !SIGNATURE_STRENGTHS.some((t) => /legitim|identitetskontroll|BankID/i.test(t)),
);

/* --- namnet --------------------------------------------------------- */

check("ett riktigt namn godtas", isValidSignerName("Erik Lindqvist"));
check("blanksteg är inget namn", !isValidSignerName("   "));
check("ett tecken är inget namn", !isValidSignerName("E"));
check("siffror ensamma är inget namn", !isValidSignerName("12345"));
check("för långt namn avvisas", !isValidSignerName("a".repeat(121)));
check("namn med diakriter godtas", isValidSignerName("Åsa Öberg"));

/* --- kontrollsumman ------------------------------------------------- */

const encoder = new TextEncoder();
const hashOf = (text: string) => sha256Hex(encoder.encode(text).buffer as ArrayBuffer);

const run = async () => {
  const a = await hashOf("Styrelseprotokoll 2026-03-01");
  const b = await hashOf("Styrelseprotokoll 2026-03-01");
  const c = await hashOf("Styrelseprotokoll 2026-03-02");

  check("samma innehåll ger samma kontrollsumma", a === b);
  check("en ändrad tecken ger en annan kontrollsumma", a !== c);
  check("kontrollsumman är 64 hex-tecken", /^[0-9a-f]{64}$/.test(a), a);

  check("fingeravtrycket är fyra läsbara block", formatFingerprint(a).split(" ").length === 4);
  check("fingeravtrycket är versaler", formatFingerprint(a) === formatFingerprint(a).toUpperCase());

  /* --- efterhandskontrollen ---------------------------------------- */

  check("oförändrat innehåll rapporteras som oförändrat", checkIntegrity(a, b) === "unchanged");
  check("ändrat innehåll rapporteras som ändrat", checkIntegrity(a, c) === "changed");
  check("utan nuvarande innehåll går det inte att avgöra", checkIntegrity(a, null) === "unverifiable");
  check("versaler och gemener jämförs lika", checkIntegrity(a.toUpperCase(), a) === "unchanged");
  check(
    "en ändring beskrivs som ändring, inte som ogiltig signatur",
    /ändrats efter signeringen/.test(INTEGRITY_LABEL.changed) &&
      !/ogiltig/i.test(INTEGRITY_LABEL.changed),
  );

  /* --- intyget som dokument ---------------------------------------- */

  const signature = {
    id: "s1",
    documentId: "d1",
    signerUserId: "u1",
    signerName: "Erik Lindqvist",
    signerEmail: "erik@demobolaget.se",
    statementVersion: SIGNATURE_STATEMENT.version,
    statementText: SIGNATURE_STATEMENT.text,
    contentSha256: a,
    signedAt: "2026-03-01T13:07:00.000Z",
  };

  const certificate = buildSignatureCertificate({
    documentName: "styrelseprotokoll.pdf",
    documentKind: "Protokoll",
    signatures: [signature],
    currentHash: a,
    companyName: "Demobolaget AB",
    orgNumber: "556000-0001",
    generatedAt: "2026-03-02T08:00:00.000Z",
  });

  check("intyget heter Signeringsintyg", certificate.meta.documentTitle === "Signeringsintyg");
  check("intyget refererar handlingen", certificate.meta.reference === "styrelseprotokoll.pdf");
  check("intyget har en signaturtabell", certificate.sections[0].blocks[0].kind === "table");

  const html = renderReport(certificate);
  check("intyget visar undertecknarens namn", html.includes("Erik Lindqvist"));
  check("intyget visar hela kontrollsumman", html.includes(a));
  check("intyget återger intygstexten ordagrant", html.includes(SIGNATURE_STATEMENT.text.slice(0, 60)));
  check("intyget anger eIDAS-grunden", /3\.10/.test(html) && /25\.1/.test(html));
  check(
    "intyget säger rakt ut att det inte styrker identiteten",
    /styrker inte\s*undertecknarens identitet/.test(html.replace(/\s+/g, " ")),
  );
  check("intyget påstår aldrig BankID-nivå", !/med BankID|via BankID/i.test(html));

  const changed = buildSignatureCertificate({
    documentName: "styrelseprotokoll.pdf",
    documentKind: "Protokoll",
    signatures: [signature],
    currentHash: c,
    companyName: null,
    orgNumber: null,
    generatedAt: "2026-03-02T08:00:00.000Z",
  });
  check(
    "ett ändrat innehåll syns i intyget",
    renderReport(changed).includes(INTEGRITY_LABEL.changed),
  );

  /* --- tidpunkten --------------------------------------------------- */

  check("tidpunkten skrivs på svenska", /1 mars 2026 kl\. \d{2}:\d{2}/.test(formatSignedAt(signature.signedAt)), formatSignedAt(signature.signedAt));

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
};

void run();
