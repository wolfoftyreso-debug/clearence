import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { data } from "@/data";
import { parseAmount } from "@/lib/caseAnalysis";
import type { CaseRecord } from "@/data/types";
import { ArrowRight, CheckCircle2, ShieldCheck, TriangleAlert } from "lucide-react";

/**
 * Kontrolläget: panelen som svarar på "håller systemet uppsikt åt mig?".
 *
 * Grundtanken i hela produkten, uttryckt på en yta: det största hotet är
 * sällan den ekonomiska situationen i sig - det är att fatta fel beslut
 * eller att inte agera i tid. Panelen visar tre saker, sakligt och utan
 * domedagsretorik:
 *
 *  1. VAD SOM BEVAKAS: fristerna och närmaste datum. Användaren ska veta
 *     att klockorna går även när hon inte tittar.
 *  2. DETTA SAKNAS: de steg som borde vara gjorda men inte är det -
 *     kontrollbalansbedömningen, protokollet, revisorn i ärendet. Varje
 *     rad länkar dit saken åtgärdas.
 *  3. DOKUMENTATIONSSPÅRET: händelseloggen som visar att man agerat
 *     korrekt. Att KUNNA visa det är halva tryggheten.
 *
 * Formuleringarna följer kommunikationsprincipen: "kan få långtgående
 * konsekvenser", "ofta avgörande", "kan få stor betydelse" - aldrig
 * "kommer att", aldrig automatiskt personligt ansvar.
 */

interface MissingStep {
  key: string;
  label: string;
  why: string;
  href: string;
}

interface ControlStatusProps {
  caseRecord: CaseRecord;
}

export const ControlStatus = ({ caseRecord }: ControlStatusProps) => {
  const { data: kbr } = useQuery({
    queryKey: ["kbr-latest", caseRecord.id],
    queryFn: () => data.kbr.getLatestByCase(caseRecord.id),
    retry: false,
  });
  const { data: documents } = useQuery({
    queryKey: ["case-documents", caseRecord.id],
    queryFn: () => data.documents.listByCase(caseRecord.id),
    retry: false,
  });
  const { data: members } = useQuery({
    queryKey: ["case-members", caseRecord.id],
    queryFn: () => data.members.listMembers(caseRecord.id),
    retry: false,
  });
  const { data: invitations } = useQuery({
    queryKey: ["case-invitations", caseRecord.id],
    queryFn: () => data.members.listInvitations(caseRecord.id),
    retry: false,
  });

  // Ekonomiraden bor här sedan rond 2: kontrolläget ÄR lägesbilden, och
  // tre fristående nyckeltalskort var en yta till som sa samma sak.
  const totalDebt = parseAmount(caseRecord.totalDebt);
  const liquidationValue = parseAmount(caseRecord.quickLiquidationValue);
  const coverageRatio = totalDebt > 0 ? Math.round((liquidationValue / totalDebt) * 100) : null;

  const missing: MissingStep[] = [];

  // KBR: vid rekommendation om rekonstruktion/konkurs, eller när ingen
  // bedömning finns alls, är kontrollbalansfrågan öppen.
  const seriousRecommendation =
    caseRecord.recommendationType === "reconstruction" ||
    caseRecord.recommendationType === "bankruptcy";
  if (!kbr && seriousRecommendation) {
    missing.push({
      key: "kbr",
      label: "Kontrollbalansbedömningen är inte gjord",
      why: "Skyldigheten inträder redan vid skäl att anta kapitalbrist – att agera i tid är ofta avgörande.",
      href: "/kbr",
    });
  }

  const hasMinutes = (documents ?? []).some((d) => d.note?.startsWith("Genererad mall"));
  if (!hasMinutes) {
    missing.push({
      key: "protokoll",
      label: "Styrelsens beslut är inte protokollförda",
      why: "Rätt dokumentation kan få stor betydelse om agerandet senare prövas.",
      href: "/dashboard/dokument",
    });
  }

  const activeMembers = (members ?? []).filter((m) => !m.revokedAt);
  const openInvitations = (invitations ?? []).filter((i) => !i.acceptedAt && !i.revokedAt);
  if (activeMembers.length <= 1 && openInvitations.length === 0) {
    missing.push({
      key: "deltagare",
      label: "Ingen revisor eller rådgivare är med i ärendet",
      why: "Vissa misstag kan få långtgående juridiska konsekvenser – rätt kompetens tidigt minskar risken.",
      href: "/dashboard/deltagare",
    });
  }

  return (
    <section className="mb-6 rounded-md border border-border bg-card p-5 shadow-soft">
      <h2 className="flex items-center gap-2 font-semibold text-foreground">
        <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
        Kontrolläge
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Det största hotet är sällan siffrorna i sig – det är att fatta fel
        beslut eller att inte agera i tid. Det här bevakas åt dig:
      </p>

      {/* Fristerna bor i handlingsplanen ("Datum som räknas ned") och INGEN
          annanstans - samma regel som fällde "Kommande deadlines" i rond 1.
          Cellen som sammanfattade dem här var en dubblett. */}
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-secondary/40 p-3 sm:col-span-2">
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ekonomiskt läge
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            Skulder{" "}
            <span className="font-medium tabular-nums">{totalDebt.toLocaleString("sv-SE")} kr</span>
            {" · "}snabbt avyttringsvärde{" "}
            <span className="font-medium tabular-nums">{liquidationValue.toLocaleString("sv-SE")} kr</span>
            {" · "}täckningsgrad{" "}
            <span className={`font-medium tabular-nums ${coverageRatio !== null && coverageRatio < 30 ? "text-destructive" : ""}`}>
              {coverageRatio !== null ? `${coverageRatio} %` : "–"}
            </span>
          </dd>
        </div>
        <div className="rounded-md bg-secondary/40 p-3">
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Ditt dokumentationsspår
          </dt>
          <dd className="mt-1 text-sm text-foreground">
            Händelseloggen visar vad som gjorts och när –{" "}
            <Link to="/dashboard/handelser" className="font-medium text-accent underline underline-offset-4">
              underlaget som visar att du agerat
            </Link>
            .
          </dd>
        </div>
      </dl>

      {missing.length > 0 ? (
        <div className="mt-4">
          <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <TriangleAlert className="h-3.5 w-3.5 text-warning" aria-hidden="true" />
            Detta saknas
          </h3>
          <ul className="mt-2 space-y-2">
            {missing.map((step) => (
              <li key={step.key}>
                <Link
                  to={step.href}
                  className="group flex items-start gap-3 rounded-md border border-warning/40 bg-warning/5 p-3 transition-colors hover:border-warning"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground">
                      {step.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                      {step.why}
                    </span>
                  </span>
                  <ArrowRight
                    className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="mt-4 flex items-center gap-2 rounded-md border border-success/40 bg-success/10 p-3 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-success" aria-hidden="true" />
          Inga viktiga steg saknas just nu. Fortsätt med handlingsplanen nedan.
        </p>
      )}
    </section>
  );
};
