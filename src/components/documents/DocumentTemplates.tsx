import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { CASE_ROLE_LABELS } from "@/lib/caseRoles";
import { TEMPLATES, type GeneratedDocument, type TemplateInput } from "@/lib/documentTemplates";
import { downloadTextFile } from "@/lib/integrations/download";
import type { CaseRecord } from "@/data/types";
import { CheckCircle2, Download, FileSignature, FolderUp, Loader2 } from "lucide-react";

/**
 * Dokumentmallarna på dokumentsidan.
 *
 * Förifyllningen är poängen: bolagsnamn och organisationsnummer kommer ur
 * ärendet, närvarolistan ur deltagarna - det som redan finns i systemet
 * skrivs inte in en gång till. Datum och ort fylls i här, resten är
 * mallens sak.
 *
 * "Spara till ärendet" laddar upp det genererade dokumentet i ärendets
 * dokumentlager. Det gör två saker på en gång: dokumentet följer samma
 * åtkomstregler som allt annat, och uppladdningen hamnar i händelseloggen
 * - protokollet blir en del av den svarta lådan samma stund det skapas.
 */

interface DocumentTemplatesProps {
  caseRecord: CaseRecord;
}

export const DocumentTemplates = ({ caseRecord }: DocumentTemplatesProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [generated, setGenerated] = useState<GeneratedDocument | null>(null);

  const { data: members } = useQuery({
    queryKey: ["case-members", caseRecord.id],
    queryFn: () => data.members.listMembers(caseRecord.id),
  });

  const buildInput = (): TemplateInput => ({
    companyName: caseRecord.companyName ?? "",
    orgNumber: caseRecord.orgNumber,
    place,
    date,
    attendees: (members ?? [])
      .filter((m) => !m.revokedAt && ["owner", "board_member"].includes(m.role))
      .map((m) => ({
        name: m.displayName ?? m.email ?? "",
        role: CASE_ROLE_LABELS[m.role],
      })),
  });

  const save = useMutation({
    mutationFn: async (doc: GeneratedDocument) => {
      const file = new File([doc.body], doc.fileName, { type: "text/plain" });
      await data.documents.upload({
        caseId: caseRecord.id,
        kind: "other",
        file,
        source: "manual",
        note: `Genererad mall: ${doc.title}`,
        userId: user?.id ?? "",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["case-documents", caseRecord.id] });
      queryClient.invalidateQueries({ queryKey: ["audit-events", caseRecord.id] });
    },
  });

  const template = TEMPLATES.find((t) => t.id === selectedId) ?? null;

  return (
    <section aria-labelledby="templates-heading" className="rounded-md border border-border bg-card p-5">
      <h2
        id="templates-heading"
        className="flex items-center gap-2 text-lg font-semibold text-foreground"
      >
        <FileSignature className="h-5 w-5 text-accent" aria-hidden="true" />
        Dokumentmallar
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Styrelseprotokoll och kallelser, förifyllda med bolaget och deltagarna
        ur ärendet. Utkast att granska med rådgivare eller revisor – inte
        färdig juridik, och det står i dokumentet.
      </p>

      <ul className="mt-4 space-y-2">
        {TEMPLATES.map((t) => (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => {
                setSelectedId(selectedId === t.id ? null : t.id);
                setGenerated(null);
                save.reset();
              }}
              aria-expanded={selectedId === t.id}
              className={`w-full rounded-md border p-3 text-left transition-colors ${
                selectedId === t.id ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
              }`}
            >
              <span className="block text-sm font-medium text-foreground">{t.name}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                {t.description}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {template && (
        <div className="mt-4 rounded-md bg-secondary/40 p-4">
          <div className="flex flex-wrap gap-3">
            <label className="text-sm">
              <span className="font-medium text-foreground">Ort</span>
              <Input
                value={place}
                onChange={(e) => setPlace(e.target.value)}
                placeholder="t.ex. Stockholm"
                className="mt-1 w-44 bg-background"
              />
            </label>
            <label className="text-sm">
              <span className="font-medium text-foreground">Datum</span>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-44 bg-background"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => setGenerated(template.build(buildInput()))}
            >
              Skapa dokumentet
            </Button>
          </div>

          {generated && (
            <div className="mt-4">
              <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-foreground">
                {generated.body}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => downloadTextFile(generated.body, generated.fileName, "text/plain;charset=utf-8")}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  Ladda ner
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={save.isPending || save.isSuccess}
                  onClick={() => save.mutate(generated)}
                >
                  {save.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <FolderUp className="h-4 w-4" aria-hidden="true" />
                  )}
                  Spara till ärendets dokument
                </Button>
                {save.isSuccess && (
                  <span className="flex items-center gap-1 text-sm text-success">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    Sparat – syns i listan och i händelseloggen
                  </span>
                )}
              </div>
              {save.isError && (
                <p className="mt-2 text-sm text-destructive" role="alert">
                  Kunde inte spara. Ladda ner i stället, eller försök igen.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
