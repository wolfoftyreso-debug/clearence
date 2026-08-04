import { useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import type { DocumentKind, DocumentRecord } from "@/data/types";
import { format } from "date-fns";
import { sv } from "date-fns/locale";
import { openFileUrl } from "@/lib/integrations/download";
import { DocumentSigning } from "./DocumentSigning";
import { WAITS, waitText } from "@/lib/advisor/prepare";
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";

interface CaseDocumentsProps {
  caseId: string;
  userId: string;
}

/**
 * Document kinds in the order a case is normally assembled, so the select
 * reads as a checklist of what is worth attaching.
 */
const KIND_OPTIONS: { value: DocumentKind; label: string }[] = [
  { value: "bank_statement", label: "Kontoutdrag" },
  { value: "balance_sheet", label: "Balansräkning" },
  { value: "income_statement", label: "Resultaträkning" },
  { value: "annual_report", label: "Årsredovisning" },
  { value: "tax_account", label: "Utdrag från skattekontot" },
  { value: "debt_overview", label: "Skuldsammanställning" },
  { value: "agreement", label: "Avtal" },
  { value: "correspondence", label: "Brev och korrespondens" },
  { value: "other", label: "Övrigt" },
];

const KIND_LABEL = Object.fromEntries(
  KIND_OPTIONS.map((option) => [option.value, option.label]),
) as Record<DocumentKind, string>;

/**
 * Kept in step with the bucket's allowed_mime_types in the migration. A file
 * rejected here gets a readable message instead of a storage error.
 */
const ACCEPTED = ".pdf,.csv,.txt,.xls,.xlsx,.png,.jpg,.jpeg";
const MAX_BYTES = 25 * 1024 * 1024;

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const CaseDocuments = ({ caseId, userId }: CaseDocumentsProps) => {
  const queryClient = useQueryClient();
  // Namnet på signaturen föreslås ur profilen, men skrivs alltid av
  // användaren själv - ett förifyllt fält som ingen rör är ett klick.
  const { data: signerProfile } = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => data.profile.getMine(),
    retry: false,
  });
  const { data: signingCase } = useQuery({
    queryKey: ["latest-case-for-signing", caseId],
    queryFn: () => data.cases.getLatest(),
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const kindId = useId();

  const [kind, setKind] = useState<DocumentKind>("bank_statement");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Deleting a document is not recoverable, so the button asks once first.
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const { data: documents, isLoading } = useQuery({
    queryKey: ["case-documents", caseId],
    queryFn: () => data.documents.listByCase(caseId),
  });

  const upload = useMutation({
    mutationFn: (file: File) =>
      data.documents.upload({ caseId, userId, kind, file, source: "manual", note: null }),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] });
    },
    onError: () => {
      setError("Filen kunde inte laddas upp. Försök igen, eller kontrollera filtypen.");
    },
    onSettled: () => {
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  const review = useMutation({
    mutationFn: ({ id, action }: { id: string; action: "request" | "approve" | "reset" }) =>
      data.documents.setReview(id, action),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] });
    },
    // Rollfelen visas som de är: "endast en rådgivarroll kan godkänna"
    // är information, inte ett tekniskt fel.
    onError: (e) => {
      setError(e instanceof Error ? e.message : "Statusen kunde inte uppdateras.");
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => data.documents.remove(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["case-documents", caseId] });
    },
    onError: () => {
      setError("Filen kunde inte tas bort.");
    },
    onSettled: () => {
      setConfirmingId(null);
    },
  });

  const handleSelect = (file: File) => {
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("Filen är större än 25 MB. Dela upp den eller komprimera den först.");
      if (inputRef.current) inputRef.current.value = "";
      return;
    }
    upload.mutate(file);
  };

  const handleDownload = async (document_: DocumentRecord) => {
    setError(null);
    setBusyId(document_.id);
    try {
      // Sixty seconds is enough to start the download and short enough that a
      // copied link is worthless.
      const url = await data.documents.getDownloadUrl(document_.id, 60);
      if (!url) {
        setError("Kunde inte skapa en nedladdningslänk. Försök igen.");
        return;
      }
      openFileUrl(url);
    } catch {
      setError("Kunde inte skapa en nedladdningslänk. Försök igen.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card shadow-soft">
      <div className="border-b border-border p-5">
        <h2 className="font-semibold text-foreground">Handlingar</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Samla kontoutdrag, balans- och resultaträkning och annat underlag på ett
          ställe, så slipper du leta när du ska prata med en rådgivare. Filerna är
          knutna till ditt konto och delas inte med någon annan.
        </p>
      </div>

      <div className="border-b border-border p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={kindId} className="block text-sm font-medium text-foreground">
              Typ av handling
            </label>
            <select
              id={kindId}
              value={kind}
              onChange={(e) => setKind(e.target.value as DocumentKind)}
              className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              {KIND_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED}
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleSelect(file);
            }}
          />
          <Button
            type="button"
            variant="accent"
            disabled={upload.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden="true" />
            )}
            Ladda upp
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          PDF, CSV, Excel, PNG eller JPG. Max 25 MB per fil.
        </p>

        {error && (
          <p
            className="mt-3 flex items-start gap-2 text-sm text-destructive"
            role="alert"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}
      </div>

      {isLoading ? (
        <p className="p-5 text-sm text-muted-foreground">{waitText(WAITS.documents)}</p>
      ) : !documents || documents.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">
          Inga handlingar uppladdade än. Ett kontoutdrag och den senaste
          balansräkningen är oftast det första en rådgivare frågar efter.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {documents.map((document_) => (
            <li key={document_.id} className="flex items-start gap-3 p-4">
              <FileText
                className="mt-0.5 h-5 w-5 flex-shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {document_.fileName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {KIND_LABEL[document_.kind]} · {formatSize(document_.fileSize)} ·{" "}
                  {format(new Date(document_.createdAt), "d MMM yyyy", { locale: sv })}
                </p>
                {/* Granskningsflödet: statusen är dokumentets, stämpeln är
                    rådgivarens. Företrädaren begär; rådgivarrollen godkänner. */}
                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                      document_.reviewStatus === "approved"
                        ? "border-success/40 bg-success/10 text-foreground"
                        : document_.reviewStatus === "in_review"
                          ? "border-warning/50 bg-warning/10 text-foreground"
                          : "border-border bg-secondary/40 text-muted-foreground"
                    }`}
                  >
                    {document_.reviewStatus === "approved"
                      ? "Godkänt"
                      : document_.reviewStatus === "in_review"
                        ? "För granskning"
                        : "Utkast"}
                  </span>
                  {document_.reviewStatus === "draft" && (
                    <button
                      type="button"
                      onClick={() => review.mutate({ id: document_.id, action: "request" })}
                      disabled={review.isPending}
                      className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                    >
                      Skicka för granskning
                    </button>
                  )}
                  {document_.reviewStatus === "in_review" && (
                    <button
                      type="button"
                      onClick={() => review.mutate({ id: document_.id, action: "approve" })}
                      disabled={review.isPending}
                      className="text-xs font-medium text-accent underline-offset-4 hover:underline"
                    >
                      Godkänn (rådgivarroll)
                    </button>
                  )}
                  {document_.reviewStatus === "approved" && (
                    <button
                      type="button"
                      onClick={() => review.mutate({ id: document_.id, action: "reset" })}
                      disabled={review.isPending}
                      className="text-xs font-medium text-muted-foreground underline-offset-4 hover:underline"
                    >
                      Återställ till utkast
                    </button>
                  )}
                </div>
                {/* Signeringen: rådgivarens stämpel är en kvalitetskontroll,
                    signaturen är undertecknarens egen viljehandling. De är
                    med flit två olika saker och grindar inte varandra. */}
                <DocumentSigning
                  document_={document_}
                  defaultName={signerProfile?.displayName ?? ""}
                  companyName={signingCase?.companyName ?? null}
                  orgNumber={signingCase?.orgNumber ?? null}
                />
              </div>
              <div className="flex flex-shrink-0 gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busyId === document_.id}
                  onClick={() => void handleDownload(document_)}
                  aria-label={`Ladda ner ${document_.fileName}`}
                >
                  {busyId === document_.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Download className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
                {confirmingId === document_.id ? (
                  <>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(document_.id)}
                    >
                      {remove.isPending && (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      )}
                      Ta bort
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingId(null)}
                    >
                      Avbryt
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setConfirmingId(document_.id)}
                    aria-label={`Ta bort ${document_.fileName}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" aria-hidden="true" />
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
