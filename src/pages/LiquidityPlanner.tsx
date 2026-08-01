import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { WizardCard } from "@/components/wizard/WizardCard";
import { AmountInput } from "@/components/wizard/AmountInput";
import { LineItemEditor, type LineItemDraft, type LineItemRow } from "@/components/liquidity/LineItemEditor";
import {
  BankStatementImport,
  type StatementImportSelection,
} from "@/components/documents/BankStatementImport";
import type { SuggestedCategory } from "@/lib/bankStatement";
import { ReportButton } from "@/components/reports/ReportButton";
import { buildLiquidityReport } from "@/lib/reports/builders";
import { SaveWithAccountPrompt } from "@/components/SaveWithAccountPrompt";
import { useAuth } from "@/hooks/useAuth";
import { useScrollToTopOnChange } from "@/hooks/useScrollToTop";
import { useAutosavedState } from "@/hooks/useAutosavedState";
import { ResumeNotice } from "@/components/wizard/ResumeNotice";
import { data } from "@/data";
import {
  employerContribution,
  projectLiquidity,
  type LiquidityPlan,
  type PaymentCategory,
} from "@/lib/liquidityPlan";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  Wallet,
  TrendingUp,
  Users,
  Landmark,
  Building2,
  Truck,
  LineChart as LineChartIcon,
  AlertTriangle,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format } from "date-fns";
import { sv } from "date-fns/locale";

type Bucket = "income" | "salary" | "tax" | "fixed" | "supplier";

const bucketCategory: Record<Exclude<Bucket, "income">, PaymentCategory> = {
  salary: "salary",
  tax: "tax",
  fixed: "rent",
  supplier: "supplier",
};

/** Where each detected statement category lands in the wizard. */
const suggestionBucket: Record<SuggestedCategory, Bucket> = {
  income: "income",
  salary: "salary",
  tax: "tax",
  rent: "fixed",
  loan: "supplier",
  supplier: "supplier",
  other: "supplier",
};

let idCounter = 0;
const nextId = () => `item-${++idCounter}`;

interface StepDef {
  key: string;
  title: string;
  icon: typeof Wallet;
  lead: string;
  help: string;
}

const steps: StepDef[] = [
  {
    key: "balance",
    title: "Pengar på kontot idag",
    icon: Wallet,
    lead: "Vi börjar med det du faktiskt har just nu.",
    help: "Titta i din internetbank och skriv in saldot på företagskontot. Är det flera konton, lägg ihop dem. Har du en outnyttjad checkkredit räknar vi inte med den här – vi vill se hur långt de riktiga pengarna räcker.",
  },
  {
    key: "income",
    title: "Pengar in",
    icon: TrendingUp,
    lead: "Vad kommer in, och ungefär när?",
    help: "Ta med fakturor du har skickat men ännu inte fått betalt för, och intäkter du med rimlig säkerhet vet kommer. Gissa hellre lågt än högt – en plan som är för optimistisk hjälper dig inte.",
  },
  {
    key: "salary",
    title: "Löner",
    icon: Users,
    lead: "Löner till dig och eventuell personal.",
    help: "Skriv bruttolön (före skatt) så lägger vi automatiskt till arbetsgivaravgift på 31,42 %, som är den normala avgiften. Har du inga anställda och tar ut lön själv räknas det också här.",
  },
  {
    key: "tax",
    title: "Skatt och moms",
    icon: Landmark,
    lead: "Det som ska till Skatteverket.",
    help: "Moms redovisas oftast var tredje månad för mindre bolag, arbetsgivaravgifter och personalskatt varje månad. Osäker på datum? Logga in på Skatteverket och titta på ditt skattekonto.",
  },
  {
    key: "fixed",
    title: "Lokal och fasta kostnader",
    icon: Building2,
    lead: "Sådant som dras varje månad oavsett hur mycket ni säljer.",
    help: "Gå igenom kontoutdraget för senaste månaden och plocka ut det som återkommer. Det är lätt att glömma småposter – de blir stora tillsammans.",
  },
  {
    key: "supplier",
    title: "Leverantörer och lån",
    icon: Truck,
    lead: "Fakturor att betala och amorteringar.",
    help: "Ta med obetalda leverantörsfakturor med sitt förfallodatum, samt lån och leasing. Det är ofta här utrymmet finns att förhandla om du behöver tid.",
  },
  {
    key: "result",
    title: "Din likviditetsplan",
    icon: LineChartIcon,
    lead: "Så här ser de närmaste 90 dagarna ut.",
    help: "",
  },
];

const LiquidityPlanner = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Hela planen sparas lokalt medan den byggs. Det här är guiden med flest
  // inmatade rader - att tappa den på en siduppdatering är att be användaren
  // skriva om sin ekonomi från minnet. Se useAutosavedState.
  const emptyItems: Record<Bucket, LineItemRow[]> = {
    income: [],
    salary: [],
    tax: [],
    fixed: [],
    supplier: [],
  };
  const draft = useAutosavedState(
    "clearance-liquidity-draft",
    { step: 0, openingBalance: "", items: emptyItems, addEmployerFee: true },
    1,
  );
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const { step, openingBalance, items, addEmployerFee } = draft.value;
  const setStep = (next: number | ((prev: number) => number)) =>
    draft.setValue((prev) => ({
      ...prev,
      step: typeof next === "function" ? next(prev.step) : next,
    }));
  const setOpeningBalance = (next: string) =>
    draft.setValue((prev) => ({ ...prev, openingBalance: next }));
  const setItems = (
    next:
      | Record<Bucket, LineItemRow[]>
      | ((prev: Record<Bucket, LineItemRow[]>) => Record<Bucket, LineItemRow[]>),
  ) =>
    draft.setValue((prev) => ({
      ...prev,
      items: typeof next === "function" ? next(prev.items) : next,
    }));
  const setAddEmployerFee = (next: boolean) =>
    draft.setValue((prev) => ({ ...prev, addEmployerFee: next }));
  const resetDraft = () => {
    draft.clear();
    draft.setValue({ step: 0, openingBalance: "", items: emptyItems, addEmployerFee: true });
    setResumeDismissed(true);
  };

  // Varje steg börjar överst. Guiden byter steg i eget tillstånd,
  // inte i adressen, så ScrollToTop i App.tsx når aldrig hit.
  useScrollToTopOnChange(step);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const addItem = (bucket: Bucket) => (draft: LineItemDraft) => {
    setItems((prev) => ({ ...prev, [bucket]: [...prev[bucket], { ...draft, id: nextId() }] }));
  };
  const removeItem = (bucket: Bucket) => (id: string) => {
    setItems((prev) => ({ ...prev, [bucket]: prev[bucket].filter((i) => i.id !== id) }));
  };

  /**
   * Drops what was read out of a bank statement into the right steps. The
   * suggestions land as ordinary rows the user can edit or delete - an import
   * should give someone a head start, not a plan they cannot argue with.
   */
  const applyStatement = (selection: StatementImportSelection) => {
    if (selection.balance !== null) {
      setOpeningBalance(String(Math.round(selection.balance)));
    }

    if (selection.items.length === 0) return;

    const today = format(new Date(), "yyyy-MM-dd");

    setItems((prev) => {
      const next: Record<Bucket, LineItemRow[]> = { ...prev };
      for (const suggestion of selection.items) {
        const bucket = suggestionBucket[suggestion.category];
        next[bucket] = [
          ...next[bucket],
          {
            id: nextId(),
            label: suggestion.label,
            amount: suggestion.amount,
            recurring: true,
            dayOfMonth: suggestion.dayOfMonth,
            date: today,
            fromStatement: true,
          },
        ];
      }
      return next;
    });
  };

  const plan: LiquidityPlan = useMemo(() => {
    const outflows = (["salary", "tax", "fixed", "supplier"] as const).flatMap((bucket) =>
      items[bucket].map((item) => ({
        id: item.id,
        label: item.label,
        amount:
          bucket === "salary" && addEmployerFee && !item.fromStatement
            ? item.amount + employerContribution(item.amount)
            : item.amount,
        category: bucketCategory[bucket],
        dayOfMonth: item.dayOfMonth,
        date: item.date,
        recurring: item.recurring,
      })),
    );

    return {
      openingBalance: parseInt(openingBalance.replace(/\s/g, ""), 10) || 0,
      inflows: items.income.map((item) => ({
        id: item.id,
        label: item.label,
        amount: item.amount,
        counterpart: "",
        dayOfMonth: item.dayOfMonth,
        date: item.date,
        recurring: item.recurring,
      })),
      outflows,
    };
  }, [items, openingBalance, addEmployerFee]);

  const projection = useMemo(() => projectLiquidity(plan, 90), [plan]);

  // Only hand-entered gross salaries get the uplift, so only those count
  // towards the figure shown next to the checkbox.
  const salaryGross = items.salary
    .filter((i) => !i.fromStatement)
    .reduce((sum, i) => sum + i.amount, 0);

  const importedSalaryCount = items.salary.filter((i) => i.fromStatement).length;

  const persistPlan = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);

    try {
      // Attach to the user's most recent case, or create a lightweight one so
      // the plan has somewhere to live if they came straight here.
      const existing = await data.cases.getLatest();
      const target = existing ?? (await data.cases.createMinimal(user.id));

      await data.payments.createMany(
        plan.outflows.map((item) => ({
          caseId: target.id,
          userId: user.id,
          label: item.label,
          amount: item.amount,
          category: item.category,
          status: "pending" as const,
          dueDate: item.recurring
            ? format(
                new Date(new Date().getFullYear(), new Date().getMonth(), Math.min(item.dayOfMonth, 28)),
                "yyyy-MM-dd",
              )
            : item.date,
          recurring: item.recurring,
        })),
      );

      await data.invoices.createMany(
        plan.inflows.map((item) => ({
          caseId: target.id,
          userId: user.id,
          label: item.label,
          amount: item.amount,
          direction: "in" as const,
          status: "unpaid" as const,
          issueDate: format(new Date(), "yyyy-MM-dd"),
          dueDate: item.recurring
            ? format(
                new Date(new Date().getFullYear(), new Date().getMonth(), Math.min(item.dayOfMonth, 28)),
                "yyyy-MM-dd",
              )
            : item.date,
          counterpart: null,
        })),
      );

      setSaving(false);
      setSaved(true);
      draft.clear();
    } catch (err) {
      console.error("Failed to save plan:", err);
      setSaving(false);
      setSaveError("Kunde inte spara planen just nu. Försök igen.");
    }
  };

  const handleSave = () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    persistPlan();
  };

  const current = steps[step];
  const isResult = current.key === "result";
  const canGoNext = step === 0 ? openingBalance.trim().length > 0 : true;

  const renderStepBody = () => {
    switch (current.key) {
      case "balance":
        return (
          <div className="space-y-6">
            <BankStatementImport onImport={applyStatement} />
            <AmountInput
              label="Saldo på företagskontot"
              value={openingBalance}
              onChange={setOpeningBalance}
              placeholder="0"
              helpText="Ungefärlig siffra räcker – du kan ändra den senare."
            />
          </div>
        );
      case "income":
        return (
          <LineItemEditor
            items={items.income}
            onAdd={addItem("income")}
            onRemove={removeItem("income")}
            labelPlaceholder="T.ex. Faktura 2043, Kund AB"
            suggestions={["Kundfaktura", "Månadsabonnemang", "Försäljning butik"]}
            emptyHint="Inga inbetalningar tillagda än. Har du inget på väg in kan du hoppa vidare – men då blir planen tuff läsning."
            direction="in"
            defaultRecurring={false}
          />
        );
      case "salary":
        return (
          <div className="space-y-4">
            <LineItemEditor
              items={items.salary}
              onAdd={addItem("salary")}
              onRemove={removeItem("salary")}
              labelPlaceholder="T.ex. Lön Anna"
              suggestions={["Egen lön", "Lön personal"]}
              emptyHint="Inga löner tillagda. Har ni inga anställda och tar du inte ut lön – hoppa vidare."
              direction="out"
              defaultDay={25}
            />
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-md bg-secondary/50">
              <input
                type="checkbox"
                checked={addEmployerFee}
                onChange={(e) => setAddEmployerFee(e.target.checked)}
                className="mt-1 w-5 h-5 rounded border-border accent-accent"
              />
              <span className="text-sm text-muted-foreground">
                Lägg automatiskt till arbetsgivaravgift (31,42 %) ovanpå bruttolönerna.
                {salaryGross > 0 && (
                  <strong className="mt-1 block text-foreground">
                    + {employerContribution(salaryGross).toLocaleString("sv-SE")} kr per månad
                  </strong>
                )}
                <span className="mt-2 block">
                  Vi räknar med den normala avgiften på alla löner. Har du anställda
                  som är 18–22 år eller har fyllt 67 är den lägre, och då blir din
                  faktiska kostnad mindre än planen visar. Att överskatta är den
                  säkrare riktningen, men det är värt att veta.
                </span>
              </span>
            </label>
            {importedSalaryCount > 0 && (
              <p className="rounded-md border border-border p-4 text-sm text-muted-foreground">
                {importedSalaryCount === 1 ? "En post" : `${importedSalaryCount} poster`} kommer
                från ditt kontoutdrag. På {importedSalaryCount === 1 ? "den" : "dem"} läggs
                ingen arbetsgivaravgift till – beloppet är vad som faktiskt lämnade kontot,
                och avgiften betalades separat till Skatteverket.
              </p>
            )}
          </div>
        );
      case "tax":
        return (
          <LineItemEditor
            items={items.tax}
            onAdd={addItem("tax")}
            onRemove={removeItem("tax")}
            labelPlaceholder="T.ex. Moms kvartal 1"
            suggestions={["Moms", "Arbetsgivaravgift", "Preliminärskatt", "Skatteskuld"]}
            emptyHint="Inget tillagt än. Nästan alla bolag har något som ska till Skatteverket – dubbelkolla innan du hoppar vidare."
            direction="out"
            defaultDay={12}
          />
        );
      case "fixed":
        return (
          <LineItemEditor
            items={items.fixed}
            onAdd={addItem("fixed")}
            onRemove={removeItem("fixed")}
            labelPlaceholder="T.ex. Kontorshyra"
            suggestions={["Hyra", "Försäkring", "El", "Telefoni & internet", "Bokföringsprogram", "Redovisningskonsult"]}
            emptyHint="Inget tillagt än. Ta kontoutdraget för förra månaden till hjälp."
            direction="out"
            defaultDay={1}
          />
        );
      case "supplier":
        return (
          <LineItemEditor
            items={items.supplier}
            onAdd={addItem("supplier")}
            onRemove={removeItem("supplier")}
            labelPlaceholder="T.ex. Leverantörsfaktura 8834"
            suggestions={["Leverantörsfaktura", "Amortering lån", "Leasing bil", "Räntekostnad"]}
            emptyHint="Inget tillagt än."
            direction="out"
            defaultRecurring={false}
          />
        );
      case "result":
        return (
          <div className="space-y-5">
            <ResultView projection={projection} />
            <div className="rounded-md border border-border bg-card p-5">
              <h3 className="font-semibold text-foreground">Ta med planen</h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Alla poster, summorna och dag-för-dag-utvecklingen i ett dokument. Det
                här är underlaget en rådgivare, bank eller rekonstruktör frågar efter.
              </p>
              <ReportButton
                className="mt-4"
                label="Skapa rapport"
                build={() =>
                  buildLiquidityReport({
                    plan,
                    projection,
                    horizonDays: 90,
                    companyName: null,
                    orgNumber: null,
                    reference: null,
                    employerFeeApplied: addEmployerFee && items.salary.length > 0,
                    generatedAt: new Date().toISOString(),
                  })
                }
              />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const StepIcon = current.icon;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container px-4 py-3">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg surface-accent flex items-center justify-center">
                <span className="text-accent-foreground font-bold text-sm">C</span>
              </div>
              <span className="font-display text-lg text-foreground">CLEARANCE</span>
            </button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
              Avbryt
            </Button>
          </div>
        </div>
      </header>

      {/* Progress */}
      <div className="bg-card border-b border-border">
        <div className="container px-4 py-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display text-lg font-semibold text-foreground">Likviditetsplanering</h1>
            <span className="text-sm text-muted-foreground">
              Steg {step + 1} av {steps.length}
            </span>
          </div>
          <div className="flex gap-1.5">
            {steps.map((s, i) => (
              <div key={s.key} className="flex-1">
                <div
                  className={`h-1.5 rounded-full transition-colors ${
                    i <= step ? "bg-accent" : "bg-border"
                  }`}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="container px-4 py-6 max-w-2xl mx-auto space-y-5 pb-32">
        {draft.restored && !resumeDismissed && !saved && (
          <ResumeNotice onReset={resetDraft} />
        )}
        <WizardCard>
          <div className="flex items-start gap-4 mb-5">
            <div className="w-12 h-12 rounded-md bg-accent/10 flex items-center justify-center flex-shrink-0">
              <StepIcon className="w-6 h-6 text-accent" />
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold text-foreground">{current.title}</h2>
              <p className="text-muted-foreground">{current.lead}</p>
            </div>
          </div>

          {current.help && (
            <p className="text-sm text-muted-foreground leading-relaxed mb-5 p-4 rounded-md bg-secondary/50">
              {current.help}
            </p>
          )}

          {renderStepBody()}
        </WizardCard>

        {/* Running snapshot, from step 2 onward */}
        {!isResult && step > 0 && (
          <div className="flex items-center justify-between p-4 rounded-md bg-card border border-border">
            <span className="text-sm text-muted-foreground">Pengarna räcker preliminärt</span>
            <span
              className={`font-semibold ${
                projection.daysUntilNegative === null ? "text-success" : "text-warning"
              }`}
            >
              {projection.daysUntilNegative === null
                ? "90+ dagar"
                : `${projection.daysUntilNegative} dagar`}
            </span>
          </div>
        )}

        {isResult && (
          <>
            {showAuthPrompt ? (
              <SaveWithAccountPrompt
                title="Skapa konto för att spara planen"
                description="Ett konto sparar din likviditetsplan så du kan följa upp och justera den."
                onAuthenticated={() => {
                  setShowAuthPrompt(false);
                  persistPlan();
                }}
              />
            ) : saved ? (
              <WizardCard className="bg-success/5 border-success/30">
                <div className="flex items-center gap-3 text-success mb-4">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="font-medium">Planen är sparad.</p>
                </div>
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full"
                  onClick={() => navigate("/dashboard/liquidity")}
                >
                  Öppna likviditetstidslinjen
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </WizardCard>
            ) : (
              <WizardCard>
                {saveError && (
                  <p className="text-sm text-destructive mb-3" role="alert">
                    {saveError}
                  </p>
                )}
                <Button
                  variant="accent"
                  size="lg"
                  className="w-full"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  Spara planen
                </Button>
                <p className="text-xs text-muted-foreground mt-3 text-center">
                  Du kan justera alla poster efteråt.
                </p>
              </WizardCard>
            )}

            <div className="p-4 rounded-md bg-secondary/50 border border-border">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <strong className="text-foreground">Viktig information:</strong> Planen bygger på de
                uppgifter du själv fyllt i och är en uppskattning, inte en prognos med garanti.
                CLEARANCE tillhandahåller administrativt stöd och information, inte juridisk eller
                ekonomisk rådgivning.
              </p>
            </div>
          </>
        )}
      </main>

      {/* Navigation */}
      {!isResult && (
        <div
          className="fixed left-0 right-0 bg-card border-t border-border p-4"
          style={{ bottom: "var(--app-bottom-inset, 0px)" }}
        >
          <div className="container max-w-2xl mx-auto flex gap-3">
            {step > 0 && (
              <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} className="flex-1">
                <ArrowLeft className="w-5 h-5" />
                Tillbaka
              </Button>
            )}
            <Button
              variant="accent"
              size="lg"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canGoNext}
              className="flex-1"
            >
              {step === 0 ? "Nästa" : "Nästa"}
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
      {isResult && (
        <div
          className="fixed left-0 right-0 bg-card border-t border-border p-4"
          style={{ bottom: "var(--app-bottom-inset, 0px)" }}
        >
          <div className="container max-w-2xl mx-auto">
            <Button variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} className="w-full">
              <ArrowLeft className="w-5 h-5" />
              Tillbaka och justera
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

const ResultView = ({ projection }: { projection: ReturnType<typeof projectLiquidity> }) => {
  const shortfall = projection.daysUntilNegative;
  const shortfallDate = projection.dateOfShortfall
    ? format(new Date(projection.dateOfShortfall), "d MMMM", { locale: sv })
    : null;

  return (
    <div className="space-y-5">
      {/* Headline verdict in plain language */}
      <div
        className={`p-5 rounded-md border ${
          shortfall === null
            ? "bg-success/10 border-success/30"
            : shortfall <= 30
            ? "bg-destructive/10 border-destructive/30"
            : "bg-warning/10 border-warning/30"
        }`}
      >
        <div className="flex items-start gap-3">
          {shortfall === null ? (
            <CheckCircle2 className="w-6 h-6 text-success flex-shrink-0 mt-0.5" />
          ) : (
            <AlertTriangle className="w-6 h-6 text-warning flex-shrink-0 mt-0.5" />
          )}
          <div>
            <h3 className="font-semibold text-foreground mb-1">
              {shortfall === null
                ? "Pengarna räcker i minst 90 dagar"
                : `Pengarna tar slut om ${shortfall} dagar`}
            </h3>
            <p className="text-sm text-muted-foreground">
              {shortfall === null
                ? "Med de uppgifter du fyllt i går kassan inte under noll under de närmaste tre månaderna. Fortsätt följa upp – planen är bara så bra som siffrorna i den."
                : `Runt den ${shortfallDate} går kassan under noll enligt din plan. Det är den dagen du behöver ha en lösning på plats – genom att få in pengar tidigare, skjuta på utbetalningar, eller söka finansiering.`}
            </p>
          </div>
        </div>
      </div>

      {/* Key figures */}
      <div className="grid grid-cols-3 gap-3">
        <div className="p-3 rounded-lg bg-secondary/50 text-center">
          <span className="text-xs text-muted-foreground block">In totalt</span>
          <p className="font-semibold text-emerald-600 tabular-nums">
            {projection.totalInflow.toLocaleString("sv-SE")}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50 text-center">
          <span className="text-xs text-muted-foreground block">Ut totalt</span>
          <p className="font-semibold text-foreground tabular-nums">
            {projection.totalOutflow.toLocaleString("sv-SE")}
          </p>
        </div>
        <div className="p-3 rounded-lg bg-secondary/50 text-center">
          <span className="text-xs text-muted-foreground block">Lägsta saldo</span>
          <p
            className={`font-semibold tabular-nums ${
              projection.lowestBalance < 0 ? "text-destructive" : "text-foreground"
            }`}
          >
            {projection.lowestBalance.toLocaleString("sv-SE")}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={projection.days} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="planGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              interval={13}
            />
            <YAxis
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={false}
              tickFormatter={(v) => `${Math.round(v / 1000)}k`}
            />
            <Tooltip
              formatter={(value: number) => [`${value.toLocaleString("sv-SE")} kr`, "Saldo"]}
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
            <Area
              type="monotone"
              dataKey="balance"
              stroke="hsl(var(--accent))"
              strokeWidth={2}
              fill="url(#planGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default LiquidityPlanner;
