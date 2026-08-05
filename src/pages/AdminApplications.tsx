import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { data } from "@/data";
import type { ApplicationForReview, ApplicationStatus } from "@/data/types";
import {
  BadgeCheck,
  ExternalLink,
  Loader2,
  ShieldOff,
  UserCheck,
  XCircle,
} from "lucide-react";

/**
 * Granskning av rådgivaransökningar.
 *
 * Fram tills den här sidan fanns var ansökningsflödet en återvändsgränd:
 * rådgivaren såg "vi hör av oss" och sedan fanns inget ställe att höra av
 * sig ifrån. Varje godkännande krävde en direktändring i databasen.
 *
 * Sidan gör granskningen konkret: behörighetsuppgiften - det granskningen
 * består i att kontrollera - står överst med en länk till rätt register.
 * Godkännandet publicerar i katalogen och märker ansökan i EN
 * databashändelse, och komplettering/avslag kräver en motivering, eftersom
 * den sökande ska veta sitt nästa steg och driften sitt skäl.
 */

const CATEGORY_LABEL: Record<string, string> = {
  konkursforvaltare: "Konkursförvaltare",
  rekonstruktor: "Rekonstruktör",
  revisor: "Revisor",
  affarsjurist: "Affärsjurist",
  kreditbolag: "Kreditbolag",
};

/**
 * Var behörigheten kontrolleras. Länken går till registrets söksida, inte
 * till ett förifyllt resultat - granskaren ska själv göra sökningen, det är
 * det som är kontrollen.
 */
const VERIFY_AT: Record<string, { label: string; href: string }> = {
  konkursforvaltare: {
    label: "Kronofogdens förvaltarförteckning",
    href: "https://www.kronofogden.se",
  },
  rekonstruktor: { label: "berörd tingsrätt", href: "https://www.domstol.se" },
  revisor: {
    label: "Revisorsinspektionens register",
    href: "https://www.revisorsinspektionen.se",
  },
  affarsjurist: {
    label: "Advokatsamfundets matrikel",
    href: "https://www.advokatsamfundet.se",
  },
  kreditbolag: {
    label: "Finansinspektionens företagsregister",
    href: "https://www.fi.se",
  },
};

const STATUS_LABEL: Record<ApplicationStatus, { text: string; tone: string }> = {
  pending: { text: "Väntar på granskning", tone: "text-warning" },
  needs_info: { text: "Komplettering begärd", tone: "text-warning" },
  approved: { text: "Godkänd och publicerad", tone: "text-success" },
  rejected: { text: "Avslagen", tone: "text-destructive" },
};

const swedishDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

const ApplicationCard = ({ application }: { application: ApplicationForReview }) => {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["applications-review"] });
    queryClient.invalidateQueries({ queryKey: ["professionals"] });
    queryClient.invalidateQueries({ queryKey: ["my-application"] });
  };

  const approve = useMutation({
    mutationFn: () => data.applications.approve(application.id),
    onSuccess: refresh,
    onError: (e) => setError(e instanceof Error ? e.message : "Kunde inte godkänna."),
  });

  const review = useMutation({
    mutationFn: (status: "needs_info" | "rejected") =>
      data.applications.review(application.id, status, note.trim()),
    onSuccess: () => {
      setNote("");
      refresh();
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Kunde inte spara beslutet."),
  });

  const verify = VERIFY_AT[application.category];
  const status = STATUS_LABEL[application.status];
  const open = application.status === "pending" || application.status === "needs_info";
  const noteOk = note.trim().length >= 10;

  return (
    <li className="rounded-md border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-foreground">
            {application.contactName}
            {application.company && (
              <span className="font-normal text-muted-foreground"> · {application.company}</span>
            )}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {CATEGORY_LABEL[application.category] ?? application.category}
            {application.location && <> · {application.location}</>}
            {" · inskickad "}
            {swedishDate(application.createdAt)}
          </p>
        </div>
        <span className={`flex-shrink-0 text-sm font-medium ${status.tone}`}>{status.text}</span>
      </div>

      {/* Behörigheten först. Det är den granskningen består i att
          kontrollera - resten av ansökan är presentation. */}
      <div className="mt-4 rounded-md border border-accent/30 bg-accent/5 p-4">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <UserCheck className="h-4 w-4 text-accent" aria-hidden="true" />
          Behörighet att kontrollera
        </p>
        <dl className="mt-2 space-y-1 text-sm">
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Uppgiven referens:</dt>
            <dd className="font-medium text-foreground">
              {application.credentialReference || "— saknas"}
            </dd>
          </div>
          {application.credentialNote && (
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">Övrigt:</dt>
              <dd className="break-words text-foreground">{application.credentialNote}</dd>
            </div>
          )}
        </dl>
        {verify && (
          <a
            href={verify.href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Kontrollera mot {verify.label}
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="sr-only">(öppnas i nytt fönster)</span>
          </a>
        )}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="flex flex-wrap gap-x-2">
          <dt className="text-muted-foreground">E-post:</dt>
          <dd className="break-all text-foreground">{application.email}</dd>
        </div>
        {application.phone && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Telefon:</dt>
            <dd className="text-foreground">{application.phone}</dd>
          </div>
        )}
        {application.orgNumber && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Org.nr:</dt>
            <dd className="tabular-nums text-foreground">{application.orgNumber}</dd>
          </div>
        )}
        {application.website && (
          <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">Webb:</dt>
            <dd className="break-all text-foreground">{application.website}</dd>
          </div>
        )}
      </dl>

      {application.description && (
        <p className="mt-3 whitespace-pre-wrap break-words border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
          {application.description}
        </p>
      )}

      {application.reviewNote && !open && (
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Besked till den sökande:</span>{" "}
          {application.reviewNote}
        </p>
      )}

      {open && (
        <div className="mt-4 space-y-3 rounded-md bg-secondary/40 p-4">
          <div className="space-y-2">
            <label
              htmlFor={`review-note-${application.id}`}
              className="block text-sm font-medium text-foreground"
            >
              Motivering vid komplettering eller avslag
            </label>
            <Textarea
              id={`review-note-${application.id}`}
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Vad saknas, eller varför blev det nej? Texten visas för den sökande."
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              variant="accent"
              size="sm"
              disabled={approve.isPending}
              onClick={() => {
                setError(null);
                approve.mutate();
              }}
            >
              {approve.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              )}
              Godkänn och publicera
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!noteOk || review.isPending}
              onClick={() => {
                setError(null);
                review.mutate("needs_info");
              }}
            >
              Begär komplettering
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-destructive"
              disabled={!noteOk || review.isPending}
              onClick={() => {
                setError(null);
                review.mutate("rejected");
              }}
            >
              <XCircle className="h-4 w-4" aria-hidden="true" />
              Avslå
            </Button>
          </div>
          {!noteOk && (
            <p className="text-xs text-muted-foreground">
              Komplettering och avslag kräver en motivering på minst tio tecken –
              den sökande ska veta sitt nästa steg.
            </p>
          )}
        </div>
      )}
    </li>
  );
};

const AdminApplications = () => {
  const { data: isAdmin, isLoading: checking } = useQuery({
    queryKey: ["am-i-admin"],
    queryFn: () => data.contact.amIAdmin(),
  });

  const { data: applications, isLoading } = useQuery({
    queryKey: ["applications-review"],
    queryFn: () => data.applications.listAll(),
    enabled: isAdmin === true,
  });

  const openCount = (applications ?? []).filter(
    (a) => a.status === "pending" || a.status === "needs_info",
  ).length;

  return (
    <DashboardShell title="Ansökningar">
      <div data-guide="ansokningarna">
      {checking ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        </div>
      ) : !isAdmin ? (
        <div className="max-w-xl rounded-md border border-border bg-card p-6">
          <ShieldOff className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl text-foreground">Kräver driftbehörighet</h2>
          <p className="mt-2 leading-relaxed text-muted-foreground">
            Behörighet tilldelas direkt i databasen. Det finns med flit ingen väg
            att begära den härifrån.
          </p>
          <Button variant="outline" className="mt-6" asChild>
            <Link to="/dashboard">Till översikten</Link>
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        </div>
      ) : (
        <div className="max-w-3xl">
          <p className="text-muted-foreground">
            Katalogen används av företag som ska anförtro någon sin konkurs eller
            rekonstruktion – ingen publiceras utan att behörigheten kontrollerats.
            {openCount > 0 && (
              <>
                {" "}
                <span className="font-medium text-foreground">
                  {openCount} {openCount === 1 ? "ansökan väntar" : "ansökningar väntar"}
                </span>
                .
              </>
            )}
          </p>
          {(applications ?? []).length === 0 ? (
            <p className="mt-8 rounded-md border border-border bg-secondary/40 p-8 text-center text-muted-foreground">
              Inga ansökningar än.
            </p>
          ) : (
            <ul className="mt-6 space-y-4">
              {(applications ?? []).map((application) => (
                <ApplicationCard key={application.id} application={application} />
              ))}
            </ul>
          )}
        </div>
      )}
      </div>
    </DashboardShell>
  );
};

export default AdminApplications;
