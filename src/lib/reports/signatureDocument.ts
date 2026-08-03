/**
 * Signeringsintyget.
 *
 * Beviset man kan ta med sig: vem som signerade, vilket innehåll,
 * när, och exakt vad som intygades - plus om innehållet är oförändrat
 * sedan dess.
 *
 * Intyget är MEDVETET rakt om vad signaturen inte är. Ett intyg som
 * antyder BankID-nivå är sämre än inget intyg alls: det som ska göra
 * någon trygg får inte vara det som vilseleder dem.
 */

import type { DocumentSignature } from "@/data/types";
import {
  INTEGRITY_LABEL,
  SIGNATURE_LIMITS,
  checkIntegrity,
  formatFingerprint,
  formatSignedAt,
} from "../signing";
import type { ReportModel, TableRow } from "./types";

export const buildSignatureCertificate = (input: {
  documentName: string;
  documentKind: string;
  signatures: DocumentSignature[];
  currentHash: string | null;
  companyName: string | null;
  orgNumber: string | null;
  generatedAt: string;
}): ReportModel => {
  const rows: TableRow[] = input.signatures.map((s) => {
    const integrity = checkIntegrity(s.contentSha256, input.currentHash);
    return {
      cells: [
        s.signerName,
        s.signerEmail,
        formatSignedAt(s.signedAt),
        INTEGRITY_LABEL[integrity],
      ],
      tone: integrity === "changed" ? "critical" : integrity === "unchanged" ? "good" : "warning",
    };
  });

  const statement = input.signatures[0]?.statementText ?? "";
  const version = input.signatures[0]?.statementVersion ?? "";
  const sealed = input.signatures[0]?.contentSha256 ?? "";

  return {
    meta: {
      documentTitle: "Signeringsintyg",
      companyName: input.companyName,
      orgNumber: input.orgNumber,
      reference: input.documentName,
      generatedAt: input.generatedAt,
    },
    lead: [
      {
        kind: "callout",
        tone: rows.some((r) => r.tone === "critical") ? "critical" : "good",
        title: `${input.signatures.length} signatur${input.signatures.length === 1 ? "" : "er"} på ${input.documentName}`,
        body:
          "Intyget visar vem som signerade handlingen, vid vilken tidpunkt och " +
          "vilket innehåll som förseglades. Kontrollsumman gör att en ändring " +
          "efter signeringen går att upptäcka.",
      },
      {
        kind: "keyValues",
        items: [
          { label: "Handling", value: input.documentName, note: input.documentKind },
          {
            label: "Förseglat innehåll",
            value: formatFingerprint(sealed),
            note: `SHA-256: ${sealed}`,
          },
          {
            label: "Intygets lydelse",
            value: `Version ${version}`,
          },
        ],
      },
    ],
    sections: [
      {
        title: "Signaturer",
        blocks: [
          {
            kind: "table",
            columns: [
              { label: "Namn" },
              { label: "Konto" },
              { label: "Tidpunkt" },
              { label: "Innehållskontroll" },
            ],
            rows,
            emptyText: "Handlingen är inte signerad.",
          },
        ],
      },
      {
        title: "Detta intygades",
        blocks: [{ kind: "paragraph", text: statement }],
      },
      {
        title: "Signaturens räckvidd",
        intro:
          "Enkel elektronisk signatur enligt eIDAS-förordningen artikel 3.10. " +
          "En sådan signatur får inte förvägras rättslig verkan enbart för att " +
          "den är elektronisk (artikel 25.1), och svensk rätt tillämpar fri " +
          "bevisprövning. Bevisvärdet är samtidigt lägre än vid en avancerad " +
          "eller kvalificerad signatur.",
        blocks: [
          {
            kind: "list",
            items: SIGNATURE_LIMITS.map((text) => ({ text })),
          },
        ],
      },
    ],
    disclaimer:
      "Intyget är framställt av CLEARANCE ur ärendets egen journal. Det styrker " +
      "att en inloggad användare har utfört signeringen vid angiven tidpunkt och " +
      "att innehållet då motsvarade den angivna kontrollsumman. Det styrker inte " +
      "undertecknarens identitet på det sätt som en legitimationskontroll gör.",
  };
};
