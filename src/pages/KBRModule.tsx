import { useEffect, useState, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Info,
  Scale,
  Target,
  FileText,
  Users,
  TrendingDown,
  Shield,
  Loader2,
  Save
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { AmountInput } from "@/components/wizard/AmountInput";
import { ReportButton } from "@/components/reports/ReportButton";
import { buildKbrReport } from "@/lib/reports/builders";
import {
  MIN_SHARE_CAPITAL,
  MIN_SHARE_CAPITAL_PRE_2020,
} from "@/lib/officialFigures";
import { formatOrgNumber, validateOrgNumber, lookupCompany, CompanyInfo } from "@/lib/orgNumber";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { useScrollToTopOnChange } from "@/hooks/useScrollToTop";
import { SiePrefill } from "@/components/documents/SiePrefill";
import { useAutosavedState } from "@/hooks/useAutosavedState";
import { ResumeNotice } from "@/components/wizard/ResumeNotice";
import { SaveWithAccountPrompt } from "@/components/SaveWithAccountPrompt";
import { WAITS, waitText } from "@/lib/advisor/prepare";

// KBR Status types
type KBRStatus = 'not_required' | 'warning' | 'required' | 'critical';
type AmbitionLevel = 'quick_liquidation' | 'stabilize' | 'investigate_liability' | 'prepare_reconstruction' | 'full_analysis';

interface KBRFormData {
  orgNumber: string;
  companyInfo: CompanyInfo | null;
  companyLookupStatus: 'idle' | 'loading' | 'success' | 'error';
  
  // Balance sheet data
  shareCapital: string;        // Aktiekapital
  totalAssets: string;         // Totala tillgångar
  totalLiabilities: string;    // Totala skulder
  
  // Structure
  hasRelatedCompanies: boolean | null;
  isPartOfLargerStructure: boolean | null;
  
  // Ambition
  ambitionLevel: AmbitionLevel | null;
}

const initialFormData: KBRFormData = {
  orgNumber: '',
  companyInfo: null,
  companyLookupStatus: 'idle',
  shareCapital: '',
  totalAssets: '',
  totalLiabilities: '',
  hasRelatedCompanies: null,
  isPartOfLargerStructure: null,
  ambitionLevel: null,
};

const ambitionOptions: { value: AmbitionLevel; title: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'quick_liquidation',
    title: 'Snabb avveckling',
    description: 'För vilande eller mindre bolag utan komplicerade förhållanden',
    icon: <FileText className="w-5 h-5" />
  },
  {
    value: 'stabilize',
    title: 'Ordna upp och fortsätta',
    description: 'Mål att stabilisera situationen och driva verksamheten vidare',
    icon: <TrendingDown className="w-5 h-5" />
  },
  {
    value: 'investigate_liability',
    title: 'Utreda ansvar och risk',
    description: 'Kartlägga personligt ansvar och framtida riskexponering',
    icon: <Shield className="w-5 h-5" />
  },
  {
    value: 'prepare_reconstruction',
    title: 'Förbereda rekonstruktion',
    description: 'Samla underlag för formell företagsrekonstruktion',
    icon: <Scale className="w-5 h-5" />
  },
  {
    value: 'full_analysis',
    title: 'Full analys',
    description: 'Komplett underlag för extern part att fatta beslut',
    icon: <Target className="w-5 h-5" />
  }
];

const KBRModule = () => {
  const navigate = useNavigate();
  // Sparas lokalt medan man fyller i - en siduppdatering ska inte radera
  // balansposterna. Se useAutosavedState.
  const draft = useAutosavedState(
    "clearance-kbr-draft",
    { step: 0, form: initialFormData },
    1,
  );
  const [resumeDismissed, setResumeDismissed] = useState(false);
  const currentStep = draft.value.step;
  const formData = draft.value.form;
  const setCurrentStep = (next: number | ((prev: number) => number)) =>
    draft.setValue((prev) => ({
      ...prev,
      step: typeof next === "function" ? next(prev.step) : next,
    }));
  const setFormData = (next: KBRFormData | ((prev: KBRFormData) => KBRFormData)) =>
    draft.setValue((prev) => ({
      ...prev,
      form: typeof next === "function" ? next(prev.form) : next,
    }));
  const resetDraft = () => {
    draft.clear();
    draft.setValue({ step: 0, form: initialFormData });
    setResumeDismissed(true);
  };

  // Varje steg börjar överst. Guiden byter steg i eget tillstånd,
  // inte i adressen, så ScrollToTop i App.tsx når aldrig hit.
  useScrollToTopOnChange(currentStep);
  const { user } = useAuth();

  /**
   * Vägvalet ska inte vara en gissning. Utvärderingen har redan svarat på
   * frågan "vilken väg passar min situation" - så har den gjorts föreslås
   * motsvarande alternativ här, förvalt men fritt att ändra. Har den inte
   * gjorts pekas man dit FÖRST, i stället för att lämnas ensam med fem
   * rubriker som alla låter rimliga.
   */
  const { data: latestCase } = useQuery({
    queryKey: ["latest-case", user?.id],
    queryFn: () => data.cases.getLatest(),
    enabled: !!user,
  });

  const suggestedAmbition: AmbitionLevel | null =
    latestCase?.recommendationType === "stabilize"
      ? "stabilize"
      : latestCase?.recommendationType === "reconstruction"
        ? "prepare_reconstruction"
        : latestCase?.recommendationType === "bankruptcy"
          // Vid konkursläge är styrelsens personliga ansvar den brännande
          // KBR-frågan - inte avvecklingslogistiken.
          ? "investigate_liability"
          : null;

  // Förvalet sätts bara när användaren inte redan valt själv (t.ex. i ett
  // återupptaget utkast).
  useEffect(() => {
    if (suggestedAmbition && formData.ambitionLevel === null) {
      setFormData((prev) =>
        prev.ambitionLevel === null ? { ...prev, ambitionLevel: suggestedAmbition } : prev,
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [suggestedAmbition]);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const totalSteps = 4;

  const updateField = <K extends keyof KBRFormData>(field: K, value: KBRFormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // lookupRequestId guards against a slower, stale request overwriting a
  // newer one's result if the user keeps editing while a lookup is in flight.
  const lookupRequestId = useRef(0);

  const handleOrgNumberChange = (value: string) => {
    const formatted = formatOrgNumber(value);
    updateField('orgNumber', formatted);

    const digits = formatted.replace(/\D/g, '');
    if (digits.length === 10 && validateOrgNumber(formatted)) {
      const requestId = ++lookupRequestId.current;
      updateField('companyLookupStatus', 'loading');
      lookupCompany(formatted).then(info => {
        if (lookupRequestId.current !== requestId) return;
        if (info) {
          updateField('companyInfo', info);
          updateField('companyLookupStatus', 'success');
        } else {
          updateField('companyLookupStatus', 'error');
        }
      });
    } else if (digits.length < 10) {
      lookupRequestId.current++;
      updateField('companyInfo', null);
      updateField('companyLookupStatus', 'idle');
    }
  };

  const parseAmount = (value: string): number => {
    return parseInt(value.replace(/\s/g, ''), 10) || 0;
  };

  // Calculate KBR status based on Swedish law
  // KBR required when equity < 50% of share capital
  const kbrAnalysis = useMemo(() => {
    const shareCapital = parseAmount(formData.shareCapital);
    const totalAssets = parseAmount(formData.totalAssets);
    const totalLiabilities = parseAmount(formData.totalLiabilities);
    
    if (!shareCapital || !totalAssets) {
      return { status: 'not_required' as KBRStatus, equity: 0, threshold: 0, ratio: 0, message: '' };
    }
    
    const equity = totalAssets - totalLiabilities;
    const threshold = shareCapital / 2; // 50% of share capital
    const ratio = shareCapital > 0 ? (equity / shareCapital) * 100 : 0;
    
    let status: KBRStatus;
    let message: string;
    
    if (equity >= shareCapital) {
      status = 'not_required';
      message = 'Eget kapital överstiger aktiekapitalet. Ingen KBR krävs.';
    } else if (equity >= threshold) {
      status = 'warning';
      message = 'Eget kapital närmar sig kritisk nivå. Överväg åtgärder.';
    } else if (equity > 0) {
      status = 'required';
      message = 'Eget kapital understiger hälften av aktiekapitalet. Kontrollbalansräkning krävs enligt aktiebolagslagen 25 kap. 13 §.';
    } else {
      status = 'critical';
      message = 'Eget kapital är negativt. Omedelbar KBR och åtgärder krävs.';
    }
    
    return { status, equity, threshold, ratio, message, shareCapital, totalAssets, totalLiabilities };
  }, [formData.shareCapital, formData.totalAssets, formData.totalLiabilities]);

  const persistAssessment = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);

    try {
      await data.kbr.create({
        userId: user.id,
        orgNumber: formData.orgNumber || null,
        companyName: formData.companyInfo?.name ?? null,
        ambitionLevel: formData.ambitionLevel,
        hasRelatedCompanies: formData.hasRelatedCompanies,
        isPartOfLargerStructure: formData.isPartOfLargerStructure,
        shareCapital: parseAmount(formData.shareCapital),
        totalAssets: parseAmount(formData.totalAssets),
        totalLiabilities: parseAmount(formData.totalLiabilities),
        status: kbrAnalysis.status,
      });
      setSaving(false);
      setSaved(true);
      draft.clear();
    } catch (err) {
      console.error('Failed to save KBR assessment:', err);
      setSaving(false);
      setSaveError('Kunde inte spara analysen just nu. Försök igen.');
    }
  };

  const saveAssessment = () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    persistAssessment();
  };

  const nextStep = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return formData.ambitionLevel !== null;
      case 1:
        return formData.orgNumber.replace(/\D/g, '').length === 10;
      case 2:
        return !!formData.shareCapital && !!formData.totalAssets && !!formData.totalLiabilities;
      case 3:
        return true;
      default:
        return false;
    }
  };

  // Step 0: Ambition Level Selection
  const renderStep0 = () => (
    <div className="space-y-5">
      {suggestedAmbition ? (
        <div className="rounded-md border border-accent/40 bg-accent/5 p-4">
          <p className="flex items-start gap-2 text-sm leading-relaxed text-foreground">
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
            <span>
              <span className="font-semibold">Förvalt utifrån din utvärdering:</span>{" "}
              {ambitionOptions.find((o) => o.value === suggestedAmbition)?.title}.
              {latestCase?.recommendationTitle && (
                <> Bedömningen var "{latestCase.recommendationTitle}".</>
              )}{" "}
              Stämmer det inte längre kan du välja fritt nedan.
            </span>
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-warning/40 bg-warning/10 p-4">
          <p className="text-sm font-semibold text-foreground">
            Osäker på vilket alternativ som passar? Det är normalt.{" "}
            <Link to="/kunskap/kontrollbalansrakning" className="font-medium text-accent underline underline-offset-4">
              Läs vad kontrollbalansräkningen innebär
            </Link>
            .
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Valet här förutsätter att du redan vet bolagets vägval – avveckla,
            stabilisera eller rekonstruera. Det är precis den frågan
            utvärderingen besvarar, på fem till tio minuter. Gör den först, så
            är rätt alternativ förvalt när du kommer tillbaka hit.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <Button variant="accent" size="sm" onClick={() => navigate("/wizard")}>
              Gör utvärderingen först
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                document.getElementById("ambition-list")?.scrollIntoView({ block: "start" })
              }
            >
              Jag vet redan mitt vägval
            </Button>
          </div>
        </div>
      )}

      <WizardCard>
        <WizardCardHeader 
          title="Vad är målet med denna analys?" 
          description="Ditt val avgör djupet på analysen och vilka moduler som aktiveras"
        />
        
        <div className="space-y-3" id="ambition-list">
          {ambitionOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => updateField('ambitionLevel', option.value)}
              className={`w-full p-4 rounded-md border text-left transition-colors ${
                formData.ambitionLevel === option.value
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-accent/50 bg-card'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${
                  formData.ambitionLevel === option.value
                    ? 'bg-accent text-accent-foreground'
                    : 'bg-secondary text-muted-foreground'
                }`}>
                  {option.icon}
                </div>
                <div>
                  <h4 className="font-medium text-foreground">
                    {option.title}
                    {option.value === suggestedAmbition && (
                      <span className="ml-2 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                        Föreslås för dig
                      </span>
                    )}
                  </h4>
                  <p className="text-sm text-muted-foreground mt-0.5">{option.description}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </WizardCard>

      {/* Structure question */}
      <WizardCard>
        <WizardCardHeader 
          title="Äger du eller närstående fler bolag?" 
        />
        <div className="flex gap-3">
          {[
            { value: false, label: 'Nej' },
            { value: true, label: 'Ja' }
          ].map((option) => (
            <button
              key={String(option.value)}
              onClick={() => updateField('hasRelatedCompanies', option.value)}
              className={`flex-1 py-3 px-4 rounded-md border font-medium transition-colors ${
                formData.hasRelatedCompanies === option.value
                  ? 'border-accent bg-accent/5 text-foreground'
                  : 'border-border bg-card text-muted-foreground hover:border-accent/50'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
        
        {formData.hasRelatedCompanies === true && (
          <div className="mt-4 p-4 rounded-md bg-warning/10 border border-warning/30">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-foreground font-medium mb-2">
                  Är detta bolag en mindre del av en större struktur?
                </p>
                <div className="flex gap-2">
                  {[
                    { value: false, label: 'Nej, fristående' },
                    { value: true, label: 'Ja, del av struktur' }
                  ].map((option) => (
                    <button
                      key={String(option.value)}
                      onClick={() => updateField('isPartOfLargerStructure', option.value)}
                      className={`py-2 px-3 rounded-md border text-sm font-medium transition-colors ${
                        formData.isPartOfLargerStructure === option.value
                          ? 'border-warning bg-warning/20 text-foreground'
                          : 'border-border bg-card text-muted-foreground hover:border-warning/50'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                {formData.isPartOfLargerStructure === true && (
                  <p className="text-xs text-warning mt-2">
                    ⚠️ Strukturella ärenden kräver ofta analys av koncernförhållanden och eventuell ansvarsgenombrott.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </WizardCard>
    </div>
  );

  // Step 1: Company Identification
  const renderStep1 = () => (
    <div className="space-y-5">
      <WizardCard>
        <WizardCardHeader 
          title="Organisationsnummer" 
          description="Vi hämtar bolagsuppgifter automatiskt"
        />
        <input
          type="text"
          value={formData.orgNumber}
          onChange={(e) => handleOrgNumberChange(e.target.value)}
          placeholder="XXXXXX-XXXX"
          className="w-full px-4 py-3 rounded-md border border-border bg-background text-foreground text-lg font-mono focus:outline-none focus:ring-2 focus:ring-accent/50"
          maxLength={11}
        />
        
        {formData.companyLookupStatus === 'loading' && (
          <div className="mt-3 flex items-center gap-2 text-muted-foreground">
            <div className="w-4 h-4 border border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">{waitText(WAITS.companyLookup)}</span>
          </div>
        )}
        
        {formData.companyLookupStatus === 'success' && formData.companyInfo && (
          <div className="mt-4 p-4 rounded-md bg-success/5 border border-success/30">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground">{formData.companyInfo.name}</h4>
                <p className="text-sm text-muted-foreground">{formData.companyInfo.legalForm}</p>
              </div>
            </div>
          </div>
        )}
      </WizardCard>
    </div>
  );

  // Step 2: Balance Sheet Data
  const renderStep2 = () => (
    <div className="space-y-5">
      {/* Bokföringen har redan siffrorna - erbjud dem som förslag, med
          kontona redovisade. Manuell inmatning fungerar precis som förut. */}
      <SiePrefill
        onApply={(values) =>
          setFormData((prev) => ({
            ...prev,
            shareCapital: String(values.shareCapital),
            totalAssets: String(values.totalAssets),
            totalLiabilities: String(values.totalLiabilities),
          }))
        }
      />
      <WizardCard>
        <WizardCardHeader 
          title="Aktiekapital" 
          description="Registrerat aktiekapital enligt bolagsordningen"
        />
        <AmountInput
          value={formData.shareCapital}
          onChange={(v) => updateField('shareCapital', v)}
          placeholder="t.ex. 25 000"
        />
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Använd ditt eget registrerade aktiekapital – det står i bolagsordningen
          och i registreringsbeviset från Bolagsverket. Hela bedömningen bygger på
          den siffran. Minimikravet är {MIN_SHARE_CAPITAL.toLocaleString("sv-SE")} kr
          för bolag bildade från 1 januari 2020, och{" "}
          {MIN_SHARE_CAPITAL_PRE_2020.toLocaleString("sv-SE")} kr för bolag som
          bildades dessförinnan – men många bolag har mer än så.
        </p>
      </WizardCard>

      <WizardCard>
        <WizardCardHeader 
          title="Totala tillgångar" 
          description="Summa av alla tillgångar i balansräkningen"
        />
        <AmountInput
          value={formData.totalAssets}
          onChange={(v) => updateField('totalAssets', v)}
          placeholder="t.ex. 500 000"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Inkludera: kassa, kundfordringar, lager, inventarier, fastigheter
        </p>
      </WizardCard>

      <WizardCard>
        <WizardCardHeader 
          title="Totala skulder" 
          description="Summa av alla skulder i balansräkningen"
        />
        <AmountInput
          value={formData.totalLiabilities}
          onChange={(v) => updateField('totalLiabilities', v)}
          placeholder="t.ex. 450 000"
        />
        <p className="text-xs text-muted-foreground mt-2">
          Inkludera: leverantörsskulder, banklån, skatteskulder, övriga skulder
        </p>
      </WizardCard>

      {/* Live KBR indicator */}
      {formData.shareCapital && formData.totalAssets && formData.totalLiabilities && (
        <WizardCard className={`${
          kbrAnalysis.status === 'not_required' ? 'bg-success/5 border-success/30' :
          kbrAnalysis.status === 'warning' ? 'bg-warning/5 border-warning/30' :
          kbrAnalysis.status === 'required' ? 'bg-destructive/5 border-destructive/30' :
          'bg-destructive/10 border-destructive/50'
        }`}>
          <div className="flex items-start gap-3">
            <div className={`w-10 h-10 rounded-md flex items-center justify-center flex-shrink-0 ${
              kbrAnalysis.status === 'not_required' ? 'bg-success' :
              kbrAnalysis.status === 'warning' ? 'bg-warning' :
              'bg-destructive'
            }`}>
              {kbrAnalysis.status === 'not_required' ? (
                <CheckCircle2 className="w-5 h-5 text-success-foreground" />
              ) : kbrAnalysis.status === 'warning' ? (
                <Info className="w-5 h-5 text-warning-foreground" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-destructive-foreground" />
              )}
            </div>
            <div>
              <h4 className="font-semibold text-foreground">
                {kbrAnalysis.status === 'not_required' ? 'KBR ej nödvändig' :
                 kbrAnalysis.status === 'warning' ? 'Bevaka situationen' :
                 kbrAnalysis.status === 'required' ? 'KBR krävs' :
                 'Kritiskt läge'}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">{kbrAnalysis.message}</p>
              
              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div className="p-2 rounded-md bg-background/50">
                  <span className="text-muted-foreground">Eget kapital</span>
                  <p className="font-semibold text-foreground">
                    {kbrAnalysis.equity.toLocaleString('sv-SE')} kr
                  </p>
                </div>
                <div className="p-2 rounded-md bg-background/50">
                  <span className="text-muted-foreground">Kapitalandel</span>
                  <p className={`font-semibold ${
                    kbrAnalysis.ratio >= 100 ? 'text-success' :
                    kbrAnalysis.ratio >= 50 ? 'text-warning' :
                    'text-destructive'
                  }`}>
                    {kbrAnalysis.ratio.toFixed(0)}% av aktiekapital
                  </p>
                </div>
              </div>
            </div>
          </div>
        </WizardCard>
      )}
    </div>
  );

  // Step 3: KBR Result & Next Steps
  const renderStep3 = () => {
    const getNextSteps = () => {
      if (kbrAnalysis.status === 'not_required') {
        return [
          'Fortsätt bevaka bolagets ekonomiska ställning',
          'Genomför regelbundna likviditetsprognoser',
          'Dokumentera styrelsebeslut om ekonomisk uppföljning'
        ];
      } else if (kbrAnalysis.status === 'warning') {
        return [
          'Överväg att upprätta frivillig kontrollbalansräkning',
          'Identifiera åtgärder för att stärka eget kapital',
          'Förbered handlingsplan om situationen försämras',
          'Dokumentera styrelsens riskbedömning'
        ];
      } else if (kbrAnalysis.status === 'required') {
        return [
          'Upprätta kontrollbalansräkning genast och låt revisorn granska den (ABL 25:13)',
          'Kalla till första kontrollstämma, som prövar om bolaget ska gå i likvidation (ABL 25:15)',
          'Beslutar stämman inte om likvidation ska en andra kontrollstämma hållas inom åtta månader (ABL 25:16)',
          'Dokumentera styrelsens åtgärder och beslut',
          'Överväg kapitaltillskott eller rekonstruktion',
          'Konsultera juridisk expert för ansvarsfrågor'
        ];
      } else {
        return [
          'Upprätta kontrollbalansräkning omedelbart',
          'Överväg ansökan om konkurs eller rekonstruktion',
          'Kontakta juridisk rådgivare omgående',
          'Dokumentera samtliga styrelsebeslut noggrant',
          'Undvik nya förpliktelser som kan öka personligt ansvar'
        ];
      }
    };

    return (
      <div className="space-y-5">
        {/* KBR Status Card */}
        <WizardCard className={`${
          kbrAnalysis.status === 'not_required' ? 'bg-success/5 border-success/30' :
          kbrAnalysis.status === 'warning' ? 'bg-warning/5 border-warning/30' :
          kbrAnalysis.status === 'required' ? 'bg-destructive/5 border-destructive/30' :
          'bg-destructive/10 border-destructive/50'
        }`}>
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${
              kbrAnalysis.status === 'not_required' ? 'bg-success' :
              kbrAnalysis.status === 'warning' ? 'bg-warning' :
              'bg-destructive'
            }`}>
              {kbrAnalysis.status === 'not_required' ? (
                <CheckCircle2 className="w-6 h-6 text-success-foreground" />
              ) : kbrAnalysis.status === 'warning' ? (
                <Info className="w-6 h-6 text-warning-foreground" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-destructive-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">KBR-status</p>
              <h3 className="text-xl font-display font-semibold text-foreground">
                {kbrAnalysis.status === 'not_required' ? 'Kontrollbalansräkning krävs ej' :
                 kbrAnalysis.status === 'warning' ? 'Bevakningsstatus' :
                 kbrAnalysis.status === 'required' ? 'Kontrollbalansräkning krävs' :
                 'Kritiskt – omedelbar åtgärd krävs'}
              </h3>
            </div>
          </div>
          
          <p className="text-foreground leading-relaxed mb-4">
            {kbrAnalysis.message}
          </p>

          {/* Be explicit that this is an assessment, not the document itself.
              Believing the KBR is done when it is not leaves the board in
              breach of ABL 25:13 and exposed under 25:18. */}
          {(kbrAnalysis.status === 'required' || kbrAnalysis.status === 'critical') && (
            <div className="p-4 rounded-md bg-background/60 border border-border mb-4">
              <p className="text-sm text-foreground font-medium mb-1">
                Det här är en bedömning – inte själva kontrollbalansräkningen
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Beräkningen visar att styrelsen sannolikt är skyldig att upprätta en
                kontrollbalansräkning. Dokumentet ska upprättas enligt särskilda
                värderingsregler, skrivas under av hela styrelsen och granskas av
                revisorn om bolaget har en. Det gör du tillsammans med din revisor
                eller redovisningskonsult – inte här.
              </p>
              <p className="text-xs text-muted-foreground/80 mt-2">
                Aktiebolagslagen (2005:551) 25 kap. 13–14 §§
              </p>
            </div>
          )}

          {/* Key figures */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="p-3 rounded-md bg-background/50 text-center">
              <span className="text-xs text-muted-foreground block">Aktiekapital</span>
              <p className="font-semibold text-foreground">
                {parseAmount(formData.shareCapital).toLocaleString('sv-SE')} kr
              </p>
            </div>
            <div className="p-3 rounded-md bg-background/50 text-center">
              <span className="text-xs text-muted-foreground block">Eget kapital</span>
              <p className={`font-semibold ${
                kbrAnalysis.equity >= kbrAnalysis.threshold ? 'text-success' : 'text-destructive'
              }`}>
                {kbrAnalysis.equity.toLocaleString('sv-SE')} kr
              </p>
            </div>
            <div className="p-3 rounded-md bg-background/50 text-center">
              <span className="text-xs text-muted-foreground block">KBR-gräns (50%)</span>
              <p className="font-semibold text-foreground">
                {kbrAnalysis.threshold.toLocaleString('sv-SE')} kr
              </p>
            </div>
          </div>
        </WizardCard>

        {/* Next Steps */}
        <WizardCard>
          <WizardCardHeader title="Rekommenderade nästa steg" />
          <ul className="space-y-2">
            {getNextSteps().map((step, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="w-6 h-6 rounded-full bg-accent/10 text-accent flex items-center justify-center flex-shrink-0 text-xs font-semibold">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{step}</span>
              </li>
            ))}
          </ul>
        </WizardCard>

        {/* Ambition-specific guidance */}
        {formData.ambitionLevel && (
          <WizardCard>
            <WizardCardHeader 
              title={`Anpassad vägledning: ${ambitionOptions.find(o => o.value === formData.ambitionLevel)?.title}`} 
            />
            <p className="text-sm text-muted-foreground leading-relaxed">
              {formData.ambitionLevel === 'quick_liquidation' && 
                'För en avveckling: frivillig likvidation beslutas av bolagsstämman och sköts av en likvidator, medan konkurs beslutas av tingsrätten som också utser förvaltaren. Vilken väg som passar beror på om tillgångarna räcker till skulderna – ta hjälp av en jurist för att avgöra det.'}
              {formData.ambitionLevel === 'stabilize' && 
                'För att stabilisera situationen, fokusera på kassaflödesoptimering, förhandling med borgenärer och eventuellt kapitaltillskott från ägare.'}
              {formData.ambitionLevel === 'investigate_liability' && 
                'Vid ansvarsfrågor är det kritiskt att dokumentera alla styrelsebeslut noggrant och konsultera juridisk expert för att bedöma personligt betalningsansvar enligt ABL 25:18.'}
              {formData.ambitionLevel === 'prepare_reconstruction' && 
                'Företagsrekonstruktion kräver formell ansökan till tingsrätten. Förbered likviditetsbudget, borgenärsförteckning och rekonstruktionsplan.'}
              {formData.ambitionLevel === 'full_analysis' && 
                'Full analys innebär komplett underlag inklusive historisk utveckling, orsaksanalys, tillgångsvärdering och prognos – lämpligt för externa parter som banker eller investerare.'}
            </p>
          </WizardCard>
        )}

        {/* Structure warning */}
        {formData.isPartOfLargerStructure && (
          <WizardCard className="bg-warning/5 border-warning/30">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-medium text-foreground mb-1">Koncernförhållande identifierat</h4>
                <p className="text-sm text-muted-foreground">
                  När bolaget är del av en större struktur kan det finnas koncernbidragsregler, 
                  ansvarsgenombrott och andra faktorer som påverkar bedömningen. 
                  Rekommenderar juridisk genomgång av hela strukturen.
                </p>
              </div>
            </div>
          </WizardCard>
        )}

        {/* Disclaimer */}
        <div className="p-4 rounded-md bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Viktig information:</strong> CLEARANCE tillhandahåller administrativt stöd och information baserat på ABL 25 kap. 
            Detta ersätter inte professionell juridisk eller ekonomisk rådgivning. Kontrollbalansräkning ska upprättas av behörig person.
          </p>
        </div>

        {/* Save */}
        {showAuthPrompt ? (
          <SaveWithAccountPrompt
            title="Skapa konto för att spara analysen"
            description="Ett konto sparar din KBR-analys så du kan återkomma till den senare."
            onAuthenticated={() => {
              setShowAuthPrompt(false);
              persistAssessment();
            }}
          />
        ) : (
          <WizardCard>
            {saved ? (
              <div className="flex items-center gap-3 text-success">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <p className="text-sm font-medium">Analysen är sparad.</p>
              </div>
            ) : (
              <>
                {saveError && (
                  <p className="text-sm text-destructive mb-3" role="alert">
                    {saveError}
                  </p>
                )}
                <Button variant="outline" size="lg" className="w-full" onClick={saveAssessment} disabled={saving}>
                  {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                  Spara analysen
                </Button>
              </>
            )}
          </WizardCard>
        )}

        <WizardCard>
          <h3 className="font-semibold text-foreground">Ta med underlaget</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            En sammanställning av siffrorna, bedömningen och de åtgärder som följer –
            att ha med till revisorn eller styrelsemötet.
          </p>
          <ReportButton
            className="mt-4"
            variant="outline"
            label="Skapa rapport"
            build={() =>
              buildKbrReport({
                status: kbrAnalysis.status,
                message: kbrAnalysis.message,
                shareCapital: parseAmount(formData.shareCapital),
                totalAssets: parseAmount(formData.totalAssets),
                totalLiabilities: parseAmount(formData.totalLiabilities),
                equity: kbrAnalysis.equity,
                threshold: kbrAnalysis.threshold,
                companyName: formData.companyInfo?.name ?? null,
                orgNumber: formData.orgNumber || null,
                reference: null,
                actions: getNextSteps(),
                generatedAt: new Date().toISOString(),
              })
            }
          />
        </WizardCard>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button variant="accent" size="lg" className="w-full" onClick={() => navigate('/wizard')}>
            Fortsätt till krisanalys
            <ArrowRight className="w-5 h-5" />
          </Button>
          <Button variant="outline" size="lg" className="w-full" onClick={() => navigate('/marketplace')}>
            <Users className="w-5 h-5" />
            Hitta rådgivare
          </Button>
        </div>
      </div>
    );
  };

  const stepTitles = [
    "Mål & struktur",
    "Företagsidentitet",
    "Balansräkning",
    "KBR-status"
  ];

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 0: return renderStep0();
      case 1: return renderStep1();
      case 2: return renderStep2();
      case 3: return renderStep3();
      default: return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="container px-4 py-3">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate("/")}
              className="flex items-center gap-2"
            >
              <div className="w-8 h-8 rounded-md surface-accent flex items-center justify-center">
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
        <div className="container px-4 py-4">
          <div className="flex items-center justify-between mb-3">
            <h1 className="font-display text-lg font-semibold text-foreground">
              Kontrollbalansräkning
            </h1>
            <span className="text-sm text-muted-foreground">
              Steg {currentStep + 1} av {totalSteps}
            </span>
          </div>
          
          {/* Progress bar */}
          <div className="flex gap-1.5">
            {stepTitles.map((title, index) => (
              <div key={index} className="flex-1">
                <div 
                  className={`h-1.5 rounded-full transition-colors ${
                    index <= currentStep ? 'bg-accent' : 'bg-border'
                  }`}
                />
                <p className={`text-xs mt-1.5 ${
                  index === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'
                }`}>
                  {title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="container px-4 py-6 pb-32">
        {draft.restored && !resumeDismissed && !saved && (
          <ResumeNotice onReset={resetDraft} />
        )}
        {renderCurrentStep()}
      </main>

      {/* Navigation */}
      {currentStep < totalSteps - 1 && (
        <div
          className="fixed left-0 right-0 bg-card border-t border-border p-4"
          style={{ bottom: "var(--app-bottom-inset, 0px)" }}
        >
          <div className="container flex gap-3">
            {currentStep > 0 && (
              <Button variant="outline" size="lg" onClick={prevStep} className="flex-1">
                <ArrowLeft className="w-5 h-5" />
                Tillbaka
              </Button>
            )}
            <Button 
              variant="accent" 
              size="lg" 
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex-1"
            >
              Nästa
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default KBRModule;
