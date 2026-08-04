import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import type { DocumentRecord } from "@/data/types";
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
} from "@/lib/signing";
import { buildSignatureCertificate } from "@/lib/reports/signatureDocument";
import { useInlineReport } from "@/components/reports/useInlineReport";
import { FileCheck2, PenLine, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { WAITS, waitText } from "@/lib/advisor/prepare";

/**
 * Signeringen av en handling.
 *
 * Tre saker som gör det här till en signatur och inte en knapp:
 *
 *  1. Kontrollsumman räknas fram ur de bytes vi FAKTISKT visar för
 *     användaren, i webbläsaren, precis innan signeringen. Det som
 *     förseglas är handlingen - inte en rad i en tabell.
 *  2. Användaren skriver sitt namn. Att skriva sitt namn är den
 *     viljehandling som skiljer ett godkännande från ett klick.
 *  3. Intygstexten står framme, hel, före signeringen. Ingen ska kunna
 *     säga att de inte visste vad de intygade.
 *
 * Begränsningarna står lika tydligt som styrkorna. Användarna har
 * juridiskt ansvar; att låta dem tro att det här är BankID vore värre
 * än att inte erbjuda signering alls.
 */

const INTEGRITY_ICON = {
  unchanged: ShieldCheck,
  changed: ShieldAlert,
  unverifiable: ShieldQuestion,
} as const;

const INTEGRITY_TONE = {
  unchanged: "text-success",
  changed: "text-destructive",
  unverifiable: "text-muted-foreground",
} as const;

export const DocumentSigning = ({
  document_,
  defaultName,
  companyName,
  orgNumber,
}: {
  document_: DocumentRecord;
  defaultName: string;
  companyName: string | null;
  orgNumber: string | null;
}) => {
  const queryClient = useQueryClient();
  const { open: openInline, viewer } = useInlineReport();
  const [panelOpen, setPanelOpen] = useState(false);
  // Fältet är TOMT med flit. Ett förifyllt namn som ingen rör gör
  // signeringen till ett klick igen - och då försvann hela poängen.
  const [name, setName] = useState("");
  const [currentHash, setCurrentHash] = useState<string | null>(null);
  const [hashState, setHashState] = useState<"idle" | "working" | "done" | "failed">("idle");
  const [error, setError] = useState<string | null>(null);

  const { data: signatures } = useQuery({
    queryKey: ["document-signatures", document_.id],
    queryFn: () => data.documents.listSignatures(document_.id),
  });

  /**
   * Hämtar handlingens bytes och räknar fram kontrollsumman. Görs när
   * panelen öppnas ELLER när det finns signaturer att kontrollera - det
   * är samma siffra som används för båda, och den ska aldrig komma från
   * två olika håll.
   */
  // Vakten bor i en ref, inte i tillståndet. Ligger hashState i
  // beroendelistan startar setHashState("working") om effekten, vars
  // städning avbryter den beräkning som just påbörjats - och då blir
  // förseglingen aldrig klar.
  const startedRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    const needed = panelOpen || (signatures ?? []).length > 0;
    if (!needed || startedRef.current) return;
    startedRef.current = true;
    setHashState("working");
    void (async () => {
      try {
        const url = await data.documents.getDownloadUrl(document_.id, 60);
        if (!url) throw new Error("Innehållet kunde inte hämtas");
        const bytes = await (await fetch(url)).arrayBuffer();
        const hash = await sha256Hex(bytes);
        if (!mountedRef.current) return;
        setCurrentHash(hash);
        setHashState("done");
      } catch {
        if (mountedRef.current) setHashState("failed");
      }
    })();
  }, [panelOpen, signatures, document_.id]);

  const sign = useMutation({
    mutationFn: () => {
      if (!currentHash) throw new Error("Innehållet kunde inte förseglas");
      return data.documents.sign({
        documentId: document_.id,
        signerName: name,
        contentSha256: currentHash,
        statementVersion: SIGNATURE_STATEMENT.version,
        statementText: SIGNATURE_STATEMENT.text,
      });
    },
    onSuccess: () => {
      setPanelOpen(false);
      setError(null);
      queryClient.invalidateQueries({ queryKey: ["document-signatures", document_.id] });
      queryClient.invalidateQueries({ queryKey: ["case-audit"] });
    },
    onError: (e: Error) => setError(e.message),
  });

  const list = signatures ?? [];
  const canSign = document_.reviewStatus !== "draft";

  return (
    <div className="mt-2">
      {list.length > 0 && (
        <ul className="space-y-1">
          {list.map((s) => {
            const integrity = checkIntegrity(s.contentSha256, currentHash);
            const Icon = INTEGRITY_ICON[integrity];
            return (
              <li key={s.id} className="flex items-start gap-2 text-xs">
                <Icon
                  className={`mt-0.5 h-3.5 w-3.5 flex-shrink-0 ${INTEGRITY_TONE[integrity]}`}
                  aria-hidden="true"
                />
                <span className="min-w-0">
                  <span className="font-medium text-foreground">
                    Signerad av {s.signerName}
                  </span>
                  <span className="text-muted-foreground"> · {formatSignedAt(s.signedAt)}</span>
                  <span className="block text-muted-foreground">
                    {INTEGRITY_LABEL[integrity]} · försegling {formatFingerprint(s.contentSha256)}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        {canSign && !panelOpen && (
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent underline-offset-4 hover:underline"
          >
            <PenLine className="h-3.5 w-3.5" aria-hidden="true" />
            Signera
          </button>
        )}
        {list.length > 0 && (
          <button
            type="button"
            onClick={() =>
              openInline(
                buildSignatureCertificate({
                  documentName: document_.fileName,
                  documentKind: document_.kind,
                  signatures: list,
                  currentHash,
                  companyName,
                  orgNumber,
                  generatedAt: new Date().toISOString(),
                }),
              )
            }
            className="inline-flex items-center gap-1.5 text-xs font-medium text-accent underline-offset-4 hover:underline"
          >
            <FileCheck2 className="h-3.5 w-3.5" aria-hidden="true" />
            Signeringsintyg
          </button>
        )}
      </div>

      {panelOpen && (
        <div className="panel-reveal mt-2 rounded-md border border-accent/30 bg-accent/5 p-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-accent">
            Innan du signerar
          </h4>
          <p className="mt-2 text-sm leading-relaxed text-foreground">
            {SIGNATURE_STATEMENT.text}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-foreground">Det här bevisar signaturen</p>
              <ul className="mt-1 space-y-0.5">
                {SIGNATURE_STRENGTHS.map((t) => (
                  <li key={t} className="text-xs leading-relaxed text-muted-foreground">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Det här gör den inte</p>
              <ul className="mt-1 space-y-0.5">
                {SIGNATURE_LIMITS.map((t) => (
                  <li key={t} className="text-xs leading-relaxed text-muted-foreground">
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-3 text-xs text-muted-foreground">
            {hashState === "done" && currentHash ? (
              <>Innehållet förseglas som <span className="font-medium text-foreground">{formatFingerprint(currentHash)}</span>.</>
            ) : hashState === "failed" ? (
              "Handlingens innehåll kan inte läsas i den här sessionen, så det går inte att försegla."
            ) : (
              waitText(WAITS.documentHash)
            )}
          </p>

          <div className="mt-3">
            <label
              htmlFor={`signer-${document_.id}`}
              className="block text-xs font-semibold text-foreground"
            >
              Skriv ditt namn för att signera
            </label>
            <Input
              id={`signer-${document_.id}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={defaultName || "För- och efternamn"}
              autoComplete="name"
              className="mt-1 max-w-sm"
            />
          </div>

          {error && (
            <p className="mt-2 text-xs text-destructive" role="alert">
              {error}
            </p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={!isValidSignerName(name) || hashState !== "done" || sign.isPending}
              onClick={() => sign.mutate()}
            >
              <PenLine className="h-4 w-4" aria-hidden="true" />
              Signera handlingen
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setPanelOpen(false)}>
              Avbryt
            </Button>
          </div>
        </div>
      )}
      {viewer}
    </div>
  );
};
