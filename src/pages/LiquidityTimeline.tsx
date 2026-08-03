import { useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AmountInput } from "@/components/wizard/AmountInput";
import {
  LayoutDashboard,
  TrendingDown,
  FileText,
  Users,
  ArrowDownLeft,
  ArrowUpRight,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Wallet,
  CreditCard,
  RefreshCw,
  XCircle,
  Receipt,
  Plus,
  Loader2,
  ArrowRight,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format, addDays, isBefore, startOfDay } from "date-fns";
import { sv } from "date-fns/locale";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import type {
  CaseRecord,
  InvoiceDirection,
  InvoiceStatus,
  NewPayment,
  PaymentCategory,
  PaymentStatus,
} from "@/data/types";

type Scenario = 'baseline' | 'credit' | 'reconstruction' | 'bankruptcy';

interface CashflowDay {
  date: string;
  baseline: number;
  credit: number;
  reconstruction: number;
  bankruptcy: number;
  hasPayment: boolean;
}

const categoryLabels: Record<PaymentCategory, string> = {
  salary: 'Löner',
  tax: 'Skatt/Moms',
  rent: 'Hyra',
  supplier: 'Leverantörer',
  loan: 'Lån',
  other: 'Övrigt',
};

const categoryIcons: Record<PaymentCategory, React.ElementType> = {
  salary: Users,
  tax: FileText,
  rent: LayoutDashboard,
  supplier: TrendingDown,
  loan: CreditCard,
  other: Wallet,
};

const scenarioConfig: Record<Scenario, { label: string; color: string; description: string }> = {
  baseline: {
    label: 'Fortsatt drift',
    color: 'hsl(var(--accent))',
    description: 'Alla betalningar enligt plan'
  },
  credit: {
    label: 'Kreditinjektion',
    color: 'hsl(142, 76%, 36%)',
    description: 'Tillskott dag 1 – du anger beloppet'
  },
  reconstruction: {
    label: 'Rekonstruktion',
    color: 'hsl(48, 96%, 53%)',
    description: 'Betalningsstopp för skulder'
  },
  bankruptcy: {
    label: 'Konkurs',
    color: 'hsl(0, 84%, 60%)',
    description: 'Avveckling av verksamhet'
  },
};

/** Days the projection covers. Written out in the copy, so keep them in step. */
const HORIZON_DAYS = 45;

const parseAmount = (value: string): number => parseInt(value.replace(/\s/g, ''), 10) || 0;

// Derives a case's first payment schedule from what the crisis wizard actually
// collected (salary/tax/rent day + amount), rather than inventing demo rows.
const deriveStarterPayments = (
  caseId: string,
  userId: string,
  caseRow: CaseRecord,
): Array<NewPayment & { userId: string }> => {
  const today = startOfDay(new Date());
  const nextOccurrence = (day: number) => {
    const candidate = new Date(today.getFullYear(), today.getMonth(), day);
    if (candidate < today) candidate.setMonth(candidate.getMonth() + 1);
    return candidate;
  };

  const rows: Array<NewPayment & { userId: string }> = [];
  const push = (
    day: number | null,
    amount: string | null,
    label: string,
    category: PaymentCategory,
    canPay: boolean | null,
  ) => {
    if (!day || !amount) return;
    rows.push({
      caseId,
      userId,
      label,
      amount: parseAmount(amount),
      category,
      status: canPay === false ? 'critical' : 'pending',
      dueDate: format(nextOccurrence(day), 'yyyy-MM-dd'),
      recurring: true,
    });
  };

  push(caseRow.salaryDay, caseRow.salaryAmount, 'Lön', 'salary', caseRow.canPaySalary);
  push(caseRow.taxDay, caseRow.taxAmount, 'Skatt/moms', 'tax', caseRow.canPayTax);
  push(caseRow.rentDay, caseRow.rentAmount, 'Hyra', 'rent', caseRow.canPayRent);
  return rows;
};

const LiquidityTimeline = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeScenario, setActiveScenario] = useState<Scenario>('baseline');
  const [invoiceTab, setInvoiceTab] = useState<InvoiceDirection>('in');
  const [startingBalance, setStartingBalance] = useState(0);
  // The credit scenario used to assume a flat 200 000 kr that the user could
  // not change, and then told them it "improved the situation considerably".
  // For a company burning half a million a month that claim is simply false,
  // so the amount is theirs to set.
  const [creditInjection, setCreditInjection] = useState(200000);
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);

  const { data: latestCase } = useQuery({
    queryKey: ['latest-case', user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });

  const caseId = latestCase?.id ?? null;

  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ['payments', caseId],
    queryFn: async () => {
      if (!caseId || !user) return [];
      const existing = await data.payments.listByCase(caseId);

      // First visit for this case: seed a real schedule from the wizard's
      // own salary/tax/rent fields instead of showing an empty list.
      if (existing.length === 0 && latestCase) {
        const starters = deriveStarterPayments(caseId, user.id, latestCase);
        if (starters.length > 0) return data.payments.createMany(starters);
      }
      return existing;
    },
    enabled: !!caseId && !!user,
  });

  const { data: invoices = [], isLoading: invoicesLoading } = useQuery({
    queryKey: ['invoices', caseId],
    queryFn: () => (caseId ? data.invoices.listByCase(caseId) : Promise.resolve([])),
    enabled: !!caseId,
  });

  const updatePaymentStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: PaymentStatus }) =>
      data.payments.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments', caseId] }),
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InvoiceStatus }) =>
      data.invoices.updateStatus(id, status),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invoices', caseId] }),
  });

  const addPayment = useMutation({
    mutationFn: async (payload: { label: string; amount: number; category: PaymentCategory; dueDate: string }) => {
      if (!caseId || !user) throw new Error('Inget ärende att koppla betalningen till');
      await data.payments.createMany([{
        caseId,
        userId: user.id,
        label: payload.label,
        amount: payload.amount,
        category: payload.category,
        dueDate: payload.dueDate,
        status: 'pending',
        recurring: false,
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments', caseId] });
      setShowAddPayment(false);
    },
  });

  const addInvoice = useMutation({
    mutationFn: async (payload: { label: string; amount: number; direction: InvoiceDirection; dueDate: string; counterpart: string }) => {
      if (!caseId || !user) throw new Error('Inget ärende att koppla fakturan till');
      await data.invoices.createMany([{
        caseId,
        userId: user.id,
        label: payload.label,
        amount: payload.amount,
        direction: payload.direction,
        dueDate: payload.dueDate,
        issueDate: format(new Date(), 'yyyy-MM-dd'),
        counterpart: payload.counterpart || null,
        status: 'unpaid',
      }]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoices', caseId] });
      setShowAddInvoice(false);
    },
  });


  // Calculate cashflow data for chart
  const cashflowData = useMemo((): CashflowDay[] => {
    const today = startOfDay(new Date());
    const days: CashflowDay[] = [];

    let baselineBalance = startingBalance;
    let creditBalance = startingBalance + creditInjection;
    let reconstructionBalance = startingBalance;
    let bankruptcyBalance = startingBalance;

    for (let i = 0; i <= HORIZON_DAYS; i++) {
      const currentDate = addDays(today, i);
      const dayPayments = payments.filter(p =>
        p.dueDate === format(currentDate, 'yyyy-MM-dd') &&
        p.status !== 'paid'
      );

      dayPayments.forEach(payment => {
        if (payment.status !== 'postponed') {
          baselineBalance -= payment.amount;
          creditBalance -= payment.amount;
        }
        if (payment.category === 'salary' || payment.category === 'rent') {
          reconstructionBalance -= payment.amount;
        }
        if (payment.category === 'salary' && payment.status === 'critical') {
          bankruptcyBalance -= payment.amount * 0.3;
        }
      });

      days.push({
        date: format(currentDate, 'd MMM', { locale: sv }),
        baseline: Math.round(baselineBalance),
        credit: Math.round(creditBalance),
        reconstruction: Math.round(reconstructionBalance),
        bankruptcy: Math.round(bankruptcyBalance),
        hasPayment: dayPayments.length > 0,
      });
    }

    return days;
  }, [payments, startingBalance, creditInjection]);

  const invoiceStats = useMemo(() => {
    const incomingInvoices = invoices.filter(inv => inv.direction === 'in');
    const outgoingInvoices = invoices.filter(inv => inv.direction === 'out');

    const incomingUnpaid = incomingInvoices.filter(inv => inv.status !== 'paid');
    const outgoingUnpaid = outgoingInvoices.filter(inv => inv.status !== 'paid');

    const incomingOverdue = incomingInvoices.filter(inv => inv.status === 'overdue');
    const outgoingOverdue = outgoingInvoices.filter(inv => inv.status === 'overdue');

    return {
      incomingTotal: incomingUnpaid.reduce((sum, inv) => sum + inv.amount, 0),
      outgoingTotal: outgoingUnpaid.reduce((sum, inv) => sum + inv.amount, 0),
      incomingCount: incomingUnpaid.length,
      outgoingCount: outgoingUnpaid.length,
      incomingOverdueTotal: incomingOverdue.reduce((sum, inv) => sum + inv.amount, 0),
      outgoingOverdueTotal: outgoingOverdue.reduce((sum, inv) => sum + inv.amount, 0),
    };
  }, [invoices]);

  const stats = useMemo(() => {
    const pendingPayments = payments.filter(p => p.status === 'pending' || p.status === 'critical');
    const totalPending = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    const finalBalance = cashflowData[cashflowData.length - 1];
    const daysToNegative = cashflowData.findIndex(d => d[activeScenario] < 0);

    return {
      totalPending,
      finalBalance: finalBalance?.[activeScenario] || 0,
      daysToNegative: daysToNegative === -1 ? null : daysToNegative,
      runway: daysToNegative === -1 ? `${HORIZON_DAYS}+ dagar` : `${daysToNegative} dagar`,
    };
  }, [payments, cashflowData, activeScenario]);

  const getStatusBadge = (status: PaymentStatus) => {
    const config = {
      pending: { label: 'Väntande', variant: 'secondary' as const, icon: Clock },
      paid: { label: 'Betald', variant: 'default' as const, icon: CheckCircle2 },
      postponed: { label: 'Uppskjuten', variant: 'outline' as const, icon: Pause },
      critical: { label: 'Kritisk', variant: 'destructive' as const, icon: AlertTriangle },
    };
    const { label, variant, icon: Icon } = config[status];
    return (
      <Badge variant={variant} className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </Badge>
    );
  };

  const isDataLoading = paymentsLoading || invoicesLoading;

  return (
    <DashboardShell title="Likviditet">
      <div className="mx-auto max-w-5xl space-y-6">
          {!latestCase ? (
            <div className="text-center py-16 px-4 rounded-md bg-card border border-border shadow-soft">
              <h2 className="text-xl font-display font-semibold text-foreground mb-2">Ingen plan ännu</h2>
              <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                Bygg en likviditetsplan steg för steg – vi frågar efter en sak i taget, du
                behöver inte kunna bokföring.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button variant="accent" size="lg" onClick={() => navigate("/likviditetsplan")}>
                  Skapa likviditetsplan
                  <ArrowRight className="w-5 h-5" />
                </Button>
                <Button variant="outline" size="lg" onClick={() => navigate("/wizard")}>
                  Gör krisutvärdering
                </Button>
              </div>
            </div>
          ) : isDataLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : (
          <>
          {/* Scenario selector */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-accent" />
                Välj scenario
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {(Object.keys(scenarioConfig) as Scenario[]).map((scenario) => {
                  const config = scenarioConfig[scenario];
                  const Icon = scenario === 'baseline' ? Play :
                               scenario === 'credit' ? CreditCard :
                               scenario === 'reconstruction' ? RefreshCw : XCircle;
                  return (
                    <button
                      key={scenario}
                      onClick={() => setActiveScenario(scenario)}
                      className={`p-4 rounded-md border transition-colors text-left ${
                        activeScenario === scenario
                          ? 'border-accent bg-accent/10'
                          : 'border-border hover:border-accent/50 bg-card'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className="w-5 h-5" style={{ color: config.color }} />
                        <span className="font-medium text-sm text-foreground">{config.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{config.description}</p>
                    </button>
                  );
                })}
              </div>

              {activeScenario === 'credit' && (
                <div className="mt-4 rounded-md border border-border p-4">
                  <label
                    htmlFor="credit-injection"
                    className="block text-sm font-medium text-foreground"
                  >
                    Hur stort tillskott räknar du med?
                  </label>
                  <div className="mt-2 flex items-center gap-2">
                    <input
                      id="credit-injection"
                      type="number"
                      min={0}
                      step={10000}
                      value={creditInjection}
                      onChange={(e) => setCreditInjection(Math.max(0, Number(e.target.value) || 0))}
                      className="h-10 w-48 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    />
                    <span className="text-sm text-muted-foreground">kr</span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    Ett lån, ägartillskott eller en nyemission. Beloppet läggs till dag 1.
                    Kom ihåg att ett lån ska betalas tillbaka – amortering och ränta
                    syns inte i den här kurvan.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-border">
              <CardContent className="p-4">
                <label htmlFor="starting-balance" className="text-xs text-muted-foreground mb-1 block">
                  Aktuell kassa
                </label>
                <div className="flex items-center gap-1">
                  <Input
                    id="starting-balance"
                    type="number"
                    value={startingBalance}
                    onChange={(e) => setStartingBalance(parseInt(e.target.value, 10) || 0)}
                    className="text-xl font-display font-semibold h-9 px-2 border-0 bg-transparent focus-visible:ring-1"
                  />
                  <span className="text-sm text-muted-foreground">kr</span>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Väntande betalningar</p>
                <p className="text-2xl font-display font-semibold text-foreground">
                  {stats.totalPending.toLocaleString('sv-SE')} kr
                </p>
              </CardContent>
            </Card>
            <Card className={`border-border ${stats.finalBalance < 0 ? 'bg-destructive/5' : ''}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Prognos {HORIZON_DAYS} dagar</p>
                <p className={`text-2xl font-display font-semibold ${
                  stats.finalBalance < 0 ? 'text-destructive' : 'text-foreground'
                }`}>
                  {stats.finalBalance.toLocaleString('sv-SE')} kr
                </p>
              </CardContent>
            </Card>
            <Card className={`border-border ${stats.daysToNegative !== null ? 'bg-warning/5' : 'bg-emerald-500/5'}`}>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-1">Runway</p>
                <p className={`text-2xl font-display font-semibold ${
                  stats.daysToNegative !== null ? 'text-warning' : 'text-emerald-600'
                }`}>
                  {stats.runway}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Chart */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium">Kassaflöde över tid</CardTitle>
            </CardHeader>
            <CardContent>
              {/* The chart has a floor below which its axes stop being
                  readable. Below that it scrolls inside its own box rather
                  than making the whole page scroll sideways, which is what
                  cut the left edge off the dashboard on a phone. */}
              <div className="overflow-x-auto">
                <div className="h-[300px] min-w-[340px] md:h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashflowData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorCashflow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={scenarioConfig[activeScenario].color} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={scenarioConfig[activeScenario].color} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis
                      tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                      tickLine={false}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip
                      formatter={(value: number) => [`${value.toLocaleString('sv-SE')} kr`, scenarioConfig[activeScenario].label]}
                      labelStyle={{ color: 'hsl(var(--foreground))' }}
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
                    <Area
                      type="monotone"
                      dataKey={activeScenario}
                      stroke={scenarioConfig[activeScenario].color}
                      strokeWidth={2}
                      fill="url(#colorCashflow)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
                </div>
              </div>

              {/* Scenario comparison legend */}
              <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-border">
                {(Object.keys(scenarioConfig) as Scenario[]).map((scenario) => {
                  const config = scenarioConfig[scenario];
                  const endValue = cashflowData[cashflowData.length - 1]?.[scenario] || 0;
                  return (
                    <button
                      key={scenario}
                      onClick={() => setActiveScenario(scenario)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors ${
                        activeScenario === scenario ? 'bg-secondary' : 'hover:bg-secondary/50'
                      }`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                      <span className="text-sm text-foreground">{config.label}</span>
                      <span className={`text-sm font-medium ${endValue < 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {endValue.toLocaleString('sv-SE')} kr
                      </span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Payments list */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-accent" />
                  Kommande betalningar
                </CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{payments.filter(p => p.status !== 'paid').length} aktiva</Badge>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddPayment(v => !v)}>
                    <Plus className="w-4 h-4" />
                    Lägg till
                  </Button>
                </div>
              </div>
            </CardHeader>
            {showAddPayment && (
              <CardContent className="pt-0 pb-4 border-b border-border">
                <AddPaymentForm
                  submitting={addPayment.isPending}
                  onCancel={() => setShowAddPayment(false)}
                  onSubmit={(payload) => addPayment.mutate(payload)}
                />
                {addPayment.isError && (
                  <p className="text-sm text-destructive mt-2">Kunde inte spara betalningen. Försök igen.</p>
                )}
              </CardContent>
            )}
            <CardContent className="p-0">
              {payments.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Calendar className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="mb-4">Inga betalningar registrerade än.</p>
                  <Button variant="outline" size="sm" onClick={() => navigate("/likviditetsplan")}>
                    Bygg en plan steg för steg
                  </Button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {[...payments]
                    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                    .map((payment) => {
                      const Icon = categoryIcons[payment.category];
                      const dueDate = new Date(payment.dueDate);
                      const isPast = isBefore(dueDate, startOfDay(new Date()));
                      return (
                        <div
                          key={payment.id}
                          className={`p-3 sm:p-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-4 hover:bg-secondary/30 transition-colors ${
                            payment.status === 'paid' ? 'opacity-50' : ''
                          }`}
                        >
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-md flex items-center justify-center ${
                            payment.status === 'critical' ? 'bg-destructive/10 text-destructive' :
                            payment.status === 'postponed' ? 'bg-muted text-muted-foreground' :
                            'bg-secondary text-foreground'
                          }`}>
                            <Icon className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1 basis-40">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground truncate">{payment.label}</p>
                              {payment.recurring && (
                                <RefreshCw className="w-3 h-3 text-muted-foreground" />
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                              <span>{format(dueDate, 'd MMMM', { locale: sv })}</span>
                              <span>•</span>
                              <span>{categoryLabels[payment.category]}</span>
                              {isPast && payment.status !== 'paid' && (
                                <span className="text-destructive font-medium">• Försenad</span>
                              )}
                            </div>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <p className="font-semibold text-foreground mb-1">
                              -{payment.amount.toLocaleString('sv-SE')} kr
                            </p>
                            {getStatusBadge(payment.status)}
                          </div>

                          {payment.status !== 'paid' && (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => updatePaymentStatus.mutate({ id: payment.id, status: 'paid' })}
                                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                aria-label={`Markera "${payment.label}" som betald`}
                              >
                                <CheckCircle2 className="w-4 h-4" />
                              </Button>
                              {payment.status !== 'postponed' ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updatePaymentStatus.mutate({ id: payment.id, status: 'postponed' })}
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label={`Skjut upp "${payment.label}"`}
                                >
                                  <Pause className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updatePaymentStatus.mutate({ id: payment.id, status: 'pending' })}
                                  className="text-muted-foreground hover:text-foreground"
                                  aria-label={`Återuppta "${payment.label}"`}
                                >
                                  <Play className="w-4 h-4" />
                                </Button>
                              )}
                              {payment.status !== 'critical' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => updatePaymentStatus.mutate({ id: payment.id, status: 'critical' })}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                  aria-label={`Markera "${payment.label}" som kritisk`}
                                >
                                  <AlertTriangle className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Invoices section */}
          <Card className="border-border">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-accent" />
                  Fakturor
                </CardTitle>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="hidden sm:flex items-center gap-2 text-sm">
                    <ArrowDownLeft className="w-4 h-4 text-emerald-600" />
                    <span className="text-muted-foreground">In:</span>
                    <span className="font-medium text-foreground">{invoiceStats.incomingTotal.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <div className="hidden sm:flex items-center gap-2 text-sm">
                    <ArrowUpRight className="w-4 h-4 text-destructive" />
                    <span className="text-muted-foreground">Ut:</span>
                    <span className="font-medium text-foreground">{invoiceStats.outgoingTotal.toLocaleString('sv-SE')} kr</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setShowAddInvoice(v => !v)}>
                    <Plus className="w-4 h-4" />
                    Lägg till
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {showAddInvoice && (
                <div className="mb-4 pb-4 border-b border-border">
                  <AddInvoiceForm
                    defaultDirection={invoiceTab}
                    submitting={addInvoice.isPending}
                    onCancel={() => setShowAddInvoice(false)}
                    onSubmit={(payload) => addInvoice.mutate(payload)}
                  />
                  {addInvoice.isError && (
                    <p className="text-sm text-destructive mt-2">Kunde inte spara fakturan. Försök igen.</p>
                  )}
                </div>
              )}

              <Tabs value={invoiceTab} onValueChange={(v) => setInvoiceTab(v as InvoiceDirection)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="in" className="flex items-center gap-2">
                    <ArrowDownLeft className="w-4 h-4" />
                    Fakturor in
                    <Badge variant="secondary" className="ml-1">{invoiceStats.incomingCount}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="out" className="flex items-center gap-2">
                    <ArrowUpRight className="w-4 h-4" />
                    Fakturor ut
                    <Badge variant="secondary" className="ml-1">{invoiceStats.outgoingCount}</Badge>
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="in" className="mt-0">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-emerald-500/10 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Väntar betalning</p>
                      <p className="text-lg font-semibold text-emerald-600">+{invoiceStats.incomingTotal.toLocaleString('sv-SE')} kr</p>
                    </div>
                    <div className="p-3 bg-destructive/10 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Förfallna</p>
                      <p className="text-lg font-semibold text-destructive">{invoiceStats.incomingOverdueTotal.toLocaleString('sv-SE')} kr</p>
                    </div>
                  </div>

                  <div className="divide-y divide-border rounded-md border border-border">
                    {invoices
                      .filter(inv => inv.direction === 'in' && inv.status !== 'paid')
                      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                      .map((invoice) => (
                        <div key={invoice.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-4 hover:bg-secondary/30 transition-colors">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-md flex items-center justify-center ${
                            invoice.status === 'overdue' ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'
                          }`}>
                            <ArrowDownLeft className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1 basis-40">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground truncate">{invoice.label}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                              <span className="max-w-full truncate">{invoice.counterpart}</span>
                              <span>•</span>
                              <span>Förfaller {format(new Date(invoice.dueDate), 'd MMM', { locale: sv })}</span>
                            </div>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <p className="font-semibold text-emerald-600 mb-1">
                              +{invoice.amount.toLocaleString('sv-SE')} kr
                            </p>
                            <Badge variant={invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                              {invoice.status === 'overdue' ? 'Förfallen' : 'Obetald'}
                            </Badge>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateInvoiceStatus.mutate({ id: invoice.id, status: 'paid' })}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            aria-label={`Markera "${invoice.label}" som betald`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    {invoices.filter(inv => inv.direction === 'in' && inv.status !== 'paid').length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Inga obetalda kundfordringar</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="out" className="mt-0">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="p-3 bg-secondary rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Att betala</p>
                      <p className="text-lg font-semibold text-foreground">-{invoiceStats.outgoingTotal.toLocaleString('sv-SE')} kr</p>
                    </div>
                    <div className="p-3 bg-destructive/10 rounded-md">
                      <p className="text-xs text-muted-foreground mb-1">Förfallna</p>
                      <p className="text-lg font-semibold text-destructive">{invoiceStats.outgoingOverdueTotal.toLocaleString('sv-SE')} kr</p>
                    </div>
                  </div>

                  <div className="divide-y divide-border rounded-md border border-border">
                    {invoices
                      .filter(inv => inv.direction === 'out' && inv.status !== 'paid')
                      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                      .map((invoice) => (
                        <div key={invoice.id} className="p-3 sm:p-4 flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-4 hover:bg-secondary/30 transition-colors">
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 rounded-md flex items-center justify-center ${
                            invoice.status === 'overdue' ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-foreground'
                          }`}>
                            <ArrowUpRight className="w-5 h-5" />
                          </div>

                          <div className="min-w-0 flex-1 basis-40">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-foreground truncate">{invoice.label}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
                              <span className="max-w-full truncate">{invoice.counterpart}</span>
                              <span>•</span>
                              <span>Förfaller {format(new Date(invoice.dueDate), 'd MMM', { locale: sv })}</span>
                            </div>
                          </div>

                          <div className="flex-shrink-0 text-right">
                            <p className="font-semibold text-foreground mb-1">
                              -{invoice.amount.toLocaleString('sv-SE')} kr
                            </p>
                            <Badge variant={invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                              {invoice.status === 'overdue' ? 'Förfallen' : 'Obetald'}
                            </Badge>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => updateInvoiceStatus.mutate({ id: invoice.id, status: 'paid' })}
                            className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                            aria-label={`Markera "${invoice.label}" som betald`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    {invoices.filter(inv => inv.direction === 'out' && inv.status !== 'paid').length === 0 && (
                      <div className="p-8 text-center text-muted-foreground">
                        <Receipt className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p>Inga obetalda leverantörsskulder</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Guidance message */}
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-md bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <TrendingDown className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <p className="font-medium text-foreground mb-1">Baserat på din data</p>
                  <p className="text-sm text-muted-foreground">
                    {activeScenario === 'baseline' && stats.daysToNegative !== null && (
                      <>Med nuvarande betalningsplan når kassan noll om {stats.daysToNegative} dagar.
                      Överväg att skjuta upp leverantörsskulder eller söka kreditförstärkning.</>
                    )}
                    {activeScenario === 'baseline' && stats.daysToNegative === null && (
                      <>Kassan håller i minst {HORIZON_DAYS} dagar med nuvarande plan. Fortsätt bevaka kritiska betalningar.</>
                    )}
                    {activeScenario === 'credit' && (
                      <>Med ett tillskott på {creditInjection.toLocaleString('sv-SE')} kr dag 1
                      blir saldot efter {HORIZON_DAYS} dagar {stats.finalBalance.toLocaleString('sv-SE')} kr.
                      {stats.daysToNegative !== null
                        ? ` Kassan tar ändå slut om ${stats.daysToNegative} dagar – tillskottet skjuter upp problemet snarare än löser det.`
                        : ' Ett lån måste också betalas tillbaka, så räkna med amortering och ränta i planen framåt.'}</>
                    )}
                    {activeScenario === 'reconstruction' && (
                      <>Vid rekonstruktion pausas leverantörsskulder. Löner och hyra prioriteras.
                      Detta ger andrum för att omförhandla villkor.</>
                    )}
                    {activeScenario === 'bankruptcy' && (
                      <>Vid konkurs avvecklas verksamheten. Endast kritiska kostnader för nedstängning betalas.</>
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          </>
          )}
      </div>
    </DashboardShell>
  );
};

interface AddPaymentFormProps {
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: { label: string; amount: number; category: PaymentCategory; dueDate: string }) => void;
}

const AddPaymentForm = ({ submitting, onCancel, onSubmit }: AddPaymentFormProps) => {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<PaymentCategory>('other');
  const [dueDate, setDueDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!label || !amount || !dueDate) return;
    onSubmit({ label, amount: parseAmount(amount), category, dueDate });
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4">
      <Input placeholder="Beskrivning" value={label} onChange={(e) => setLabel(e.target.value)} required />
      <AmountInput value={amount} onChange={setAmount} placeholder="Belopp" />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value as PaymentCategory)}
        className="h-10 px-3 rounded-md border border-input bg-background text-sm"
      >
        {(Object.keys(categoryLabels) as PaymentCategory[]).map((c) => (
          <option key={c} value={c}>{categoryLabels[c]}</option>
        ))}
      </select>
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
      <div className="sm:col-span-2 flex gap-2">
        <Button type="submit" variant="accent" size="sm" disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Lägg till betalning
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Avbryt</Button>
      </div>
    </form>
  );
};

interface AddInvoiceFormProps {
  defaultDirection: InvoiceDirection;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (payload: { label: string; amount: number; direction: InvoiceDirection; dueDate: string; counterpart: string }) => void;
}

const AddInvoiceForm = ({ defaultDirection, submitting, onCancel, onSubmit }: AddInvoiceFormProps) => {
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<InvoiceDirection>(defaultDirection);
  const [counterpart, setCounterpart] = useState('');
  const [dueDate, setDueDate] = useState(format(addDays(new Date(), 14), 'yyyy-MM-dd'));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!label || !amount || !dueDate) return;
    onSubmit({ label, amount: parseAmount(amount), direction, dueDate, counterpart });
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <Input placeholder="Fakturanummer / beskrivning" value={label} onChange={(e) => setLabel(e.target.value)} required />
      <AmountInput value={amount} onChange={setAmount} placeholder="Belopp" />
      <select
        value={direction}
        onChange={(e) => setDirection(e.target.value as InvoiceDirection)}
        className="h-10 px-3 rounded-md border border-input bg-background text-sm"
      >
        <option value="in">Kundfaktura (in)</option>
        <option value="out">Leverantörsfaktura (ut)</option>
      </select>
      <Input
        placeholder={direction === 'in' ? 'Kund' : 'Leverantör'}
        value={counterpart}
        onChange={(e) => setCounterpart(e.target.value)}
      />
      <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
      <div className="sm:col-span-2 flex gap-2">
        <Button type="submit" variant="accent" size="sm" disabled={submitting}>
          {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
          Lägg till faktura
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Avbryt</Button>
      </div>
    </form>
  );
};

export default LiquidityTimeline;
