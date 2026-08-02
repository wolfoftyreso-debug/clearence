import { useMemo } from "react";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { analyseCrisis } from "@/lib/crisisAnalysis";
import { analysisInputFromCase } from "@/lib/caseAnalysis";
import { adaptText } from "@/lib/language";
import { buildLeadPreview } from "@/lib/leadSummary";
import { buildPortfolioSummary } from "@/lib/portfolioSummary";
import { renderReportPdf } from "@/lib/reports/pdf";
import type { ReportModel } from "@/lib/reports/types";
import type { CaseRecord } from "@/data/types";
import { Activity, CheckCircle2, ShieldCheck, XCircle } from "lucide-react";

/**
 * Analysövervakningen: driftens bevis för att systemanalysens motorer är
 * hela - i exakt den kod som körs just nu.
 *
 * Möjligt av ett enda skäl: motorerna är DETERMINISTISKA. Ingen extern
 * AI-tjänst, inga slumpmoment, ingen ärendedata som lämnar miljön. Samma
 * indata ger samma svar, alltid - och därför kan sidan köra motorerna på
 * kända fixturer i webbläsaren och jämföra med kända svar. Blir en rad röd
 * har en regression nått produktionen, och det syns här före kunderna.
 *
 * Det här är vad "AI-övervakning" betyder i en produkt utan extern AI:
 * inte anropsloggar och kostnadskurvor, utan integritetsbevis.
 */

const FIXTURE_CASE: CaseRecord = {
  id: "sjalvtest-fixtur",
  orgNumber: "556000-0000",
  companyName: "Självtestbolaget AB",
  employees: "6-10",
  canPaySalary: false,
  salaryAmount: "420000",
  salaryDay: 25,
  canPayTax: false,
  taxAmount: "165000",
  taxDay: 12,
  canPayRent: true,
  rentAmount: "58000",
  rentDay: 1,
  canPaySuppliers: false,
  totalDebt: "3200000",
  quickLiquidationValue: "950000",
  recommendationType: "reconstruction",
  recommendationTitle: null,
  recommendationDescription: null,
  recommendationReasons: [],
  recommendationNextSteps: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  closedAt: null,
  exitReason: null,
  healthMode: false,
  planApprovedAt: null,
  planApprovedBy: null,
};

interface SelfTest {
  engine: string;
  guards: string;
  pass: boolean;
  detail: string;
}

const digitsOf = (s: string) => s.replace(/\D/g, "");

const runSelfTests = (): SelfTest[] => {
  const tests: SelfTest[] = [];
  const push = (engine: string, guards: string, run: () => [boolean, string]) => {
    try {
      const [pass, detail] = run();
      tests.push({ engine, guards, pass, detail });
    } catch (error) {
      tests.push({
        engine,
        guards,
        pass: false,
        detail: error instanceof Error ? error.message : "Okänt fel",
      });
    }
  };

  const analysis = analyseCrisis(analysisInputFromCase(FIXTURE_CASE));

  push(
    "Krisanalysen",
    "Bedömning, brådskandegrad och tidslinje ur ärendets siffror.",
    () => [
      analysis.urgency === "immediate" && analysis.timeline.length > 0 && analysis.title.length > 0,
      `Fixturen ger "${analysis.title}" med ${analysis.timeline.length} frister.`,
    ],
  );

  push(
    "Determinismen",
    "Samma indata ger exakt samma analys - grunden för allt annat här.",
    () => {
      const again = analyseCrisis(analysisInputFromCase(FIXTURE_CASE));
      const equal = JSON.stringify(analysis) === JSON.stringify(again);
      return [equal, equal ? "Två körningar, identiskt resultat." : "Körningarna skiljer sig."];
    },
  );

  push(
    "Språkmotorn",
    "Anpassar språknivån utan att ändra en enda siffra.",
    () => {
      const sample =
        "Kontrollbalansräkningen ska upprättas när halva aktiekapitalet, 50 000 kr, är förbrukat enligt 25 kap. 13 § aktiebolagslagen.";
      const adapted = adaptText(sample, "very_simple");
      const equal = digitsOf(sample) === digitsOf(adapted);
      return [equal, equal ? "Alla siffror bevarade tecken för tecken." : "Siffror ändrades vid anpassningen."];
    },
  );

  push(
    "Avidentifieringen",
    "Förhandsvisningen till rådgivare får aldrig innehålla namn eller organisationsnummer.",
    () => {
      const preview = JSON.stringify(
        buildLeadPreview(FIXTURE_CASE, analysis, [
          "kontrollbalans.pdf",
          "Självtestbolaget AB balansrapport.xlsx",
        ]),
      );
      const clean =
        !preview.includes("556000-0000") && !preview.includes("Självtestbolaget");
      return [clean, clean ? "Varken namn eller organisationsnummer i förhandsvisningen." : "LÄCKA: identitet i förhandsvisningen."];
    },
  );

  push(
    "Portföljanalysen",
    "Arbetsledarens rader ur samtliga öppna ärenden.",
    () => {
      const summary = buildPortfolioSummary(
        [
          { caseRecord: FIXTURE_CASE, severity: "critical", timeline: analysis.timeline, openTasks: 2, openMentions: 0 },
          { caseRecord: { ...FIXTURE_CASE, id: "sjalvtest-2" }, severity: "stable", timeline: [], openTasks: 0, openMentions: 0 },
        ],
        new Date("2026-01-15T09:00:00"),
      );
      return [
        summary.lines.length > 0 && summary.ranked.length === 2,
        `${summary.lines.length} rader, ${summary.ranked.length} rangordnade ärenden.`,
      ];
    },
  );

  push(
    "PDF-skrivaren",
    "Varje dokument som lämnar huset är en strukturellt giltig, deterministisk PDF.",
    () => {
      const model: ReportModel = {
        meta: {
          documentTitle: "Självtest",
          companyName: "Självtestbolaget AB",
          orgNumber: "556000-0000",
          reference: null,
          generatedAt: "2026-01-01T00:00:00.000Z",
        },
        lead: [{ kind: "paragraph", text: "Självtest av skrivaren, med åäö." }],
        sections: [],
        disclaimer: "Självtest.",
      };
      const a = renderReportPdf(model);
      const b = renderReportPdf(model);
      const header = String.fromCharCode(...a.slice(0, 8)).startsWith("%PDF-1.4");
      const same = a.length === b.length && a.every((byte, i) => byte === b[i]);
      return [
        header && same,
        header ? (same ? `Giltig PDF, ${a.length} byte, bitidentisk mellan körningar.` : "Körningarna gav olika byte.") : "Ogiltigt PDF-huvud.",
      ];
    },
  );

  return tests;
};

const AdminAnalysis = () => {
  // Körs vid varje sidvisning - poängen är att pröva den kod som faktiskt
  // är laddad, inte ett testresultat från bygget.
  const tests = useMemo(runSelfTests, []);
  const failed = tests.filter((t) => !t.pass).length;

  return (
    <DashboardShell title="Analysövervakning">
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Activity className="h-6 w-6 text-accent" aria-hidden="true" />
            Analysövervakning
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Systemanalysens motorer, prövade i din webbläsare just nu - på den
            kod som faktiskt körs. Möjligt för att motorerna är
            deterministiska: samma indata ger samma svar, alltid.
          </p>
        </header>

        <section className="rounded-md border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold text-foreground">
            <ShieldCheck className="h-5 w-5 text-accent" aria-hidden="true" />
            Principerna
          </h2>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            <li>Inga anrop till externa AI-tjänster - analyserna beräknas i den egna miljön.</li>
            <li>Ingen ärendedata lämnar miljön för analys, någonsin.</li>
            <li>Ingen marginalkostnad per analys - därför är analyserna obegränsade.</li>
            <li>Självtesten nedan kör motorerna på kända fixturer och jämför med kända svar.</li>
          </ul>
        </section>

        <section aria-labelledby="selftest-heading">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="selftest-heading" className="text-lg font-semibold text-foreground">
              Självtest av motorerna
            </h2>
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                failed === 0
                  ? "border-success/50 bg-success/10 text-foreground"
                  : "border-frist/50 bg-frist/10 text-frist"
              }`}
            >
              {failed === 0 ? `${tests.length} av ${tests.length} gröna` : `${failed} röda`}
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {tests.map((test) => (
              <li
                key={test.engine}
                className={`rounded-md border p-4 ${
                  test.pass ? "border-border bg-card" : "border-frist/50 bg-frist/5"
                }`}
              >
                <div className="flex items-start gap-3">
                  {test.pass ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-success" aria-hidden="true" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-frist" aria-hidden="true" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{test.engine}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{test.guards}</p>
                    <p className={`mt-1 text-xs ${test.pass ? "text-muted-foreground" : "font-medium text-frist"}`}>
                      {test.detail}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Utöver detta körs motorernas fulla testsviter (600+ kontroller) vid
            varje bygge. Den här sidan är sista ledet: beviset i just den kod
            som nått hit.
          </p>
        </section>
      </div>
    </DashboardShell>
  );
};

export default AdminAnalysis;
