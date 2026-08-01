import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  ArrowLeft,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Info,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { YesNoButtons } from "@/components/wizard/YesNoButtons";
import { AmountInput } from "@/components/wizard/AmountInput";
import { DateSelector } from "@/components/wizard/DateSelector";
import { ExpandableSection } from "@/components/wizard/ExpandableSection";
import { formatOrgNumber, validateOrgNumber, lookupCompany, CompanyInfo } from "@/lib/orgNumber";
import { ReportButton } from "@/components/reports/ReportButton";
import { buildCrisisReport } from "@/lib/reports/builders";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { useScrollToTopOnChange } from "@/hooks/useScrollToTop";
import { SaveWithAccountPrompt } from "@/components/SaveWithAccountPrompt";
import { analyseCrisis, formatSwedishDate } from "@/lib/crisisAnalysis";

interface FormData {
  // Step 1 - Company
  orgNumber: string;
  employees: string;
  companyInfo: CompanyInfo | null;
  manualCompanyName: string;
  companyLookupStatus: 'idle' | 'loading' | 'success' | 'error';
  
  // Step 2 - Critical Payments
  canPaySalary: boolean | null;
  salaryAmount: string;
  salaryDay: number;
  
  canPayTax: boolean | null;
  taxAmount: string;
  taxDay: number;
  
  canPayRent: boolean | null;
  rentAmount: string;
  rentDay: number;
  
  canPaySuppliers: boolean | null;
  
  // Step 3 - Debts & Assets
  totalDebt: string;
  quickLiquidationValue: string;
}

const initialFormData: FormData = {
  orgNumber: '',
  employees: '',
  companyInfo: null,
  manualCompanyName: '',
  companyLookupStatus: 'idle',
  
  canPaySalary: null,
  salaryAmount: '',
  salaryDay: 23,
  
  canPayTax: null,
  taxAmount: '',
  taxDay: 12,
  
  canPayRent: null,
  rentAmount: '',
  rentDay: 1,
  
  canPaySuppliers: null,
  
  totalDebt: '',
  quickLiquidationValue: '',
};

const CrisisWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);

  // Varje steg börjar överst. Guiden byter steg i eget tillstånd,
  // inte i adressen, så ScrollToTop i App.tsx når aldrig hit.
  useScrollToTopOnChange(currentStep);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [caseCreated, setCaseCreated] = useState(false);
  const [caseId, setCaseId] = useState<string | null>(null);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { user } = useAuth();

  const totalSteps = 4;

  const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Auto-lookup company when org number is valid.
  // lookupRequestId guards against a slower, stale request overwriting a
  // newer one's result if the user keeps editing while a lookup is in flight.
  const lookupRequestId = useRef(0);
  useEffect(() => {
    const digits = formData.orgNumber.replace(/\D/g, '');
    if (digits.length === 10 && validateOrgNumber(formData.orgNumber)) {
      const requestId = ++lookupRequestId.current;
      updateField('companyLookupStatus', 'loading');
      lookupCompany(formData.orgNumber).then(info => {
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
  }, [formData.orgNumber]);

  const handleOrgNumberChange = (value: string) => {
    const formatted = formatOrgNumber(value);
    updateField('orgNumber', formatted);
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

  // Ten digits entered but the checksum fails. Below ten digits the user is
  // still typing, and shouting at them mid-entry helps nobody.
  const orgNumberInvalid =
    formData.orgNumber.replace(/\D/g, "").length === 10 &&
    !validateOrgNumber(formData.orgNumber);

  const canProceed = (): boolean => {
    switch (currentStep) {
      case 0:
        return validateOrgNumber(formData.orgNumber);
      case 1:
        return formData.canPaySalary !== null && 
               formData.canPayTax !== null && 
               formData.canPayRent !== null &&
               formData.canPaySuppliers !== null;
      case 2:
        return formData.totalDebt.length > 0;
      default:
        return true;
    }
  };

  const parseKr = (value: string): number => parseInt(value.replace(/\s/g, ''), 10) || 0;

  // All triage reasoning lives in src/lib/crisisAnalysis.ts so it can be
  // reviewed and tested apart from this component.
  const analysis = useMemo(
    () =>
      analyseCrisis({
        canPaySalary: formData.canPaySalary,
        canPayTax: formData.canPayTax,
        canPayRent: formData.canPayRent,
        canPaySuppliers: formData.canPaySuppliers,
        salaryAmount: parseKr(formData.salaryAmount),
        salaryDay: formData.salaryDay,
        taxAmount: parseKr(formData.taxAmount),
        taxDay: formData.taxDay,
        rentAmount: parseKr(formData.rentAmount),
        rentDay: formData.rentDay,
        totalDebt: parseKr(formData.totalDebt),
        quickLiquidationValue: parseKr(formData.quickLiquidationValue),
        employees: formData.employees,
      }),
    [formData],
  );

  // Either the register lookup result or, if that failed, what the user typed.
  const effectiveCompanyName = formData.companyInfo?.name || formData.manualCompanyName.trim() || null;

  const persistCase = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);

    try {
      const created = await data.cases.create({
        userId: user.id,
        orgNumber: formData.orgNumber,
        companyName: effectiveCompanyName,
        employees: formData.employees || null,
        canPaySalary: formData.canPaySalary,
        salaryAmount: formData.salaryAmount || null,
        salaryDay: formData.salaryDay,
        canPayTax: formData.canPayTax,
        taxAmount: formData.taxAmount || null,
        taxDay: formData.taxDay,
        canPayRent: formData.canPayRent,
        rentAmount: formData.rentAmount || null,
        rentDay: formData.rentDay,
        canPaySuppliers: formData.canPaySuppliers,
        totalDebt: formData.totalDebt || null,
        quickLiquidationValue: formData.quickLiquidationValue || null,
        recommendationType: analysis.type,
        recommendationTitle: analysis.title,
        recommendationDescription: analysis.description,
        recommendationReasons: analysis.reasons,
        recommendationNextSteps: analysis.nextSteps.map((s) => s.text),
      });
      setSaving(false);
      setCaseId(created.id);
      setCaseCreated(true);
    } catch (err) {
      console.error('Failed to save case:', err);
      setSaving(false);
      setSaveError('Kunde inte spara ärendet just nu. Kontrollera din anslutning och försök igen.');
    }
  };

  const createCase = () => {
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    persistCase();
  };

  // Step 1: Company Identity
  const renderStep1 = () => (
    <div className="space-y-5">
      <WizardCard>
        <WizardCardHeader 
          title="Organisationsnummer" 
          description="Vi hämtar automatiskt företagsuppgifter från offentliga register."
        />
        
        <div className="space-y-4">
          <input
            type="text"
            inputMode="numeric"
            value={formData.orgNumber}
            onChange={(e) => handleOrgNumberChange(e.target.value)}
            placeholder="XXXXXX-XXXX"
            className={`w-full px-4 py-4 rounded-md border bg-background text-foreground text-lg tracking-wider focus:outline-none focus:ring-2 focus:ring-accent transition-colors text-center font-mono ${
              orgNumberInvalid ? "border-destructive" : "border-border focus:border-accent"
            }`}
            maxLength={11}
            aria-invalid={orgNumberInvalid}
            aria-describedby={orgNumberInvalid ? "org-number-error" : undefined}
          />

          {/* Without this the Nästa button is simply dead and the user is
              given no reason. One mistyped digit is the most likely way into
              this state. */}
          {orgNumberInvalid && (
            <p
              id="org-number-error"
              role="alert"
              className="flex items-start gap-2 text-sm text-destructive"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              Numret stämmer inte. Ett svenskt organisationsnummer har tio siffror
              och en kontrollsiffra som inte går ihop här – kolla att du fått med
              alla siffror rätt.
            </p>
          )}
          
          {formData.companyLookupStatus === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-muted-foreground py-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Hämtar företagsinfo...</span>
            </div>
          )}
          
          {formData.companyLookupStatus === 'success' && formData.companyInfo && (
            <div className="p-4 rounded-md bg-success/10 border border-success/30 space-y-2">
              <div className="flex items-center gap-2 text-success mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-sm font-medium">Hämtad företagsinfo</span>
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-foreground">{formData.companyInfo.name}</p>
                <p className="text-sm text-muted-foreground">{formData.companyInfo.legalForm}</p>
              </div>
            </div>
          )}
          
          {formData.companyLookupStatus === 'error' && (
            <div className="space-y-3">
              <div className="p-4 rounded-md bg-warning/10 border border-warning/30">
                <p className="text-sm text-warning">
                  Vi kunde inte hämta företagsuppgifter automatiskt. Du kan
                  skriva in företagsnamnet själv, eller fortsätta utan.
                </p>
              </div>
              <div className="space-y-2">
                <label htmlFor="manual-company-name" className="block text-sm font-medium text-foreground">
                  Företagsnamn (frivilligt)
                </label>
                <input
                  id="manual-company-name"
                  type="text"
                  value={formData.manualCompanyName}
                  onChange={(e) => updateField('manualCompanyName', e.target.value)}
                  placeholder="Ditt företags namn"
                  className="w-full px-4 py-3 rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
                />
              </div>
            </div>
          )}
        </div>
      </WizardCard>

      <WizardCard>
        <WizardCardHeader 
          title="Antal anställda" 
          description="Frivilligt men hjälper oss ge bättre rekommendationer."
        />
        
        <div className="grid grid-cols-3 gap-2">
          {['0', '1-5', '6-10', '11-25', '26-50', '50+'].map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => updateField('employees', option)}
              className={`py-3 px-4 rounded-md border text-sm font-medium transition-colors ${
                formData.employees === option
                  ? 'bg-accent/10 border-accent text-accent'
                  : 'bg-background border-border text-foreground hover:border-accent/50'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </WizardCard>
    </div>
  );

  // Step 2: Critical Payments
  const renderStep2 = () => (
    <div className="space-y-5">
      {/* Salary */}
      <WizardCard>
        <WizardCardHeader 
          title="Lön" 
          description="Lön är ofta den mest tidskritiska utbetalningen i ett bolag."
        />
        
        <div className="space-y-4">
          <p className="font-medium text-foreground">Kan du betala lön i tid?</p>
          <YesNoButtons 
            value={formData.canPaySalary}
            onChange={(v) => updateField('canPaySalary', v)}
          />
          
          <ExpandableSection isOpen={formData.canPaySalary !== null}>
            <div className="space-y-4 border-t border-border pt-4">
              <AmountInput
                label="Belopp lön"
                value={formData.salaryAmount}
                onChange={(v) => updateField('salaryAmount', v)}
                placeholder="0"
              />
              <DateSelector
                label="Lönedatum (dag i månaden)"
                value={formData.salaryDay}
                onChange={(v) => updateField('salaryDay', v)}
                quickOptions={[23, 25, 27]}
              />
            </div>
          </ExpandableSection>
        </div>
      </WizardCard>

      {/* Tax/VAT */}
      <WizardCard>
        <WizardCardHeader 
          title="Nästa skatt / moms" 
          description="Här avser vi nästa förfallodatum för skatt och/eller moms."
        />
        
        <div className="space-y-4">
          <p className="font-medium text-foreground">Kan du betala nästa skatt/moms i tid?</p>
          <YesNoButtons 
            value={formData.canPayTax}
            onChange={(v) => updateField('canPayTax', v)}
          />
          
          <ExpandableSection isOpen={formData.canPayTax !== null}>
            <div className="space-y-4 border-t border-border pt-4">
              <AmountInput
                label="Belopp nästa skatt/moms"
                value={formData.taxAmount}
                onChange={(v) => updateField('taxAmount', v)}
                placeholder="0"
              />
              <DateSelector
                label="Förfallodatum (dag i månaden)"
                value={formData.taxDay}
                onChange={(v) => updateField('taxDay', v)}
                quickOptions={[12, 17, 26]}
                helpText="Januari kan avvika för vissa bolag – justera vid behov."
              />
            </div>
          </ExpandableSection>
        </div>
      </WizardCard>

      {/* Rent */}
      <WizardCard>
        <WizardCardHeader 
          title="Hyra" 
        />
        
        <div className="space-y-4">
          <p className="font-medium text-foreground">Kan du betala hyra i tid?</p>
          <YesNoButtons 
            value={formData.canPayRent}
            onChange={(v) => updateField('canPayRent', v)}
          />
          
          <ExpandableSection isOpen={formData.canPayRent !== null}>
            <div className="space-y-4 border-t border-border pt-4">
              <AmountInput
                label="Hyra"
                value={formData.rentAmount}
                onChange={(v) => updateField('rentAmount', v)}
                placeholder="0"
              />
              <DateSelector
                label="Hyrans förfallodatum (dag i månaden)"
                value={formData.rentDay}
                onChange={(v) => updateField('rentDay', v)}
                quickOptions={[1, 15, 28]}
              />
            </div>
          </ExpandableSection>
        </div>
      </WizardCard>

      {/* Suppliers */}
      <WizardCard>
        <WizardCardHeader 
          title="Viktigaste leverantörerna" 
        />
        
        <div className="space-y-4">
          <p className="font-medium text-foreground">Kan du betala dina viktigaste leverantörer?</p>
          <YesNoButtons 
            value={formData.canPaySuppliers}
            onChange={(v) => updateField('canPaySuppliers', v)}
          />
        </div>
      </WizardCard>
    </div>
  );

  // Step 3: Debts & Assets
  const renderStep3 = () => (
    <div className="space-y-5">
      <WizardCard>
        <WizardCardHeader 
          title="Skulder (totalt)" 
          description="Avser alla typer av skulder: leverantörsskulder, skatt/moms, lån, leasing, hyra, räntor, avbetalningar, kortskulder, borgensåtaganden m.m."
        />
        
        <AmountInput
          label="Total skuld"
          value={formData.totalDebt}
          onChange={(v) => updateField('totalDebt', v)}
          placeholder="0"
        />
      </WizardCard>

      <WizardCard>
        <WizardCardHeader 
          title="Inventarier & varulager" 
          description="Hur mycket bedömer du att snabbt finns tillgängligt för avyttring (t.ex. sälja av lager, maskiner, fordon, utrustning) inom kort tid?"
        />
        
        <AmountInput
          label="Snabbt avyttringsvärde"
          value={formData.quickLiquidationValue}
          onChange={(v) => updateField('quickLiquidationValue', v)}
          placeholder="0"
          helpText="En ungefärlig uppskattning räcker."
        />
      </WizardCard>
    </div>
  );

  // Step 4: Recommendation
  const renderStep4 = () => {
    const recommendation = analysis;
    
    if (caseCreated && caseId) {
      return (
        <div className="space-y-5">
          {/* Case Created Success */}
          <WizardCard className="bg-success/5 border-success/30">
            <div className="text-center py-4">
              <div className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-success" />
              </div>
              <h3 className="text-xl font-display font-semibold text-foreground mb-2">
                Ärende skapat
              </h3>
              <p className="text-muted-foreground mb-2">Ärende-ID: <span className="font-mono font-semibold text-foreground">{caseId}</span></p>
            </div>
          </WizardCard>

          {/* Summary A: Your Data */}
          <WizardCard>
            <WizardCardHeader title="Dina uppgifter" />
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Organisationsnummer</span>
                <span className="font-medium text-foreground">{formData.orgNumber}</span>
              </div>
              {formData.companyInfo && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Företagsnamn</span>
                  <span className="font-medium text-foreground">{formData.companyInfo.name}</span>
                </div>
              )}
              {formData.employees && (
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Antal anställda</span>
                  <span className="font-medium text-foreground">{formData.employees}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Kan betala lön</span>
                <span className={`font-medium ${formData.canPaySalary ? 'text-success' : 'text-destructive'}`}>
                  {formData.canPaySalary ? 'Ja' : 'Nej'} {formData.salaryAmount && `(${formData.salaryAmount} kr)`}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Kan betala skatt/moms</span>
                <span className={`font-medium ${formData.canPayTax ? 'text-success' : 'text-destructive'}`}>
                  {formData.canPayTax ? 'Ja' : 'Nej'} {formData.taxAmount && `(${formData.taxAmount} kr)`}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Kan betala hyra</span>
                <span className={`font-medium ${formData.canPayRent ? 'text-success' : 'text-destructive'}`}>
                  {formData.canPayRent ? 'Ja' : 'Nej'} {formData.rentAmount && `(${formData.rentAmount} kr)`}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Kan betala leverantörer</span>
                <span className={`font-medium ${formData.canPaySuppliers ? 'text-success' : 'text-destructive'}`}>
                  {formData.canPaySuppliers ? 'Ja' : 'Nej'}
                </span>
              </div>
              <div className="flex justify-between py-2 border-b border-border">
                <span className="text-muted-foreground">Total skuld</span>
                <span className="font-medium text-foreground">{formData.totalDebt || '0'} kr</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground">Snabbt avyttringsvärde</span>
                <span className="font-medium text-foreground">{formData.quickLiquidationValue || '0'} kr</span>
              </div>
            </div>
          </WizardCard>

          {/* Summary B: System Summary */}
          <WizardCard>
            <WizardCardHeader title="Sammanfattning" />
            <div className={`p-4 rounded-md mb-4 ${
              recommendation.type === 'bankruptcy' ? 'bg-destructive/10 border border-destructive/30' :
              recommendation.type === 'reconstruction' ? 'bg-warning/10 border border-warning/30' :
              'bg-success/10 border border-success/30'
            }`}>
              <h4 className="font-semibold text-foreground mb-2">{recommendation.title}</h4>
              <p className="text-sm text-foreground/80 leading-relaxed">{recommendation.description}</p>
            </div>
            
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Rekommenderade nästa steg:</p>
              <ul className="space-y-2">
                {recommendation.nextSteps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <span className="text-accent font-semibold">{i + 1}.</span>
                    <span>
                      {step.text}
                      {step.deadline && (
                        <strong className="block text-foreground mt-0.5">{step.deadline}</strong>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </WizardCard>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button variant="accent" size="lg" className="w-full" onClick={() => navigate('/dashboard')}>
              Gå till mitt ärende
              <ArrowRight className="w-5 h-5" />
            </Button>
            <ReportButton
              variant="outline"
              label="Skapa rapport"
              build={() =>
                buildCrisisReport({
                  analysis,
                  companyName: effectiveCompanyName ?? null,
                  orgNumber: formData.orgNumber || null,
                  reference: caseId ?? null,
                  employees: formData.employees || null,
                  totalDebt: parseInt(formData.totalDebt.replace(/\s/g, ""), 10) || 0,
                  quickLiquidationValue:
                    parseInt(formData.quickLiquidationValue.replace(/\s/g, ""), 10) || 0,
                  generatedAt: new Date().toISOString(),
                })
              }
            />
          </div>
        </div>
      );
    }
    
    return (
      <div className="space-y-5">
        {/* Recommendation */}
        <WizardCard className={
          recommendation.type === 'bankruptcy' ? 'bg-destructive/5 border-destructive/30' :
          recommendation.type === 'reconstruction' ? 'bg-warning/5 border-warning/30' :
          'bg-success/5 border-success/30'
        }>
          <div className="flex items-start gap-4 mb-4">
            <div className={`w-12 h-12 rounded-md flex items-center justify-center flex-shrink-0 ${
              recommendation.type === 'bankruptcy' ? 'bg-destructive' :
              recommendation.type === 'reconstruction' ? 'bg-warning' :
              'bg-success'
            }`}>
              {recommendation.type === 'bankruptcy' ? (
                <AlertTriangle className="w-6 h-6 text-destructive-foreground" />
              ) : recommendation.type === 'reconstruction' ? (
                <Info className="w-6 h-6 text-warning-foreground" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-success-foreground" />
              )}
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-1">Vår bedömning baserat på dina uppgifter</p>
              <h3 className="text-xl font-display font-semibold text-foreground">
                {recommendation.title}
              </h3>
            </div>
          </div>
          
          <p className="text-foreground leading-relaxed mb-4">
            {recommendation.description}
          </p>
          
          <div className="p-4 rounded-md bg-background/60 border border-border mb-4">
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-2 h-2 rounded-full ${
                  recommendation.solvency.indication === 'likely_insolvent'
                    ? 'bg-destructive'
                    : recommendation.solvency.indication === 'at_risk'
                    ? 'bg-warning'
                    : 'bg-success'
                }`}
              />
              <p className="text-sm font-medium text-foreground">
                {recommendation.solvency.indication === 'likely_insolvent'
                  ? 'Tecken på obestånd'
                  : recommendation.solvency.indication === 'at_risk'
                  ? 'Risk för obestånd'
                  : 'Inga tydliga tecken på obestånd'}
              </p>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {recommendation.solvency.explanation}
            </p>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Varför denna bedömning:</p>
            <ul className="space-y-1.5">
              {recommendation.reasons.map((reason, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                  <span className="text-accent mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>
        </WizardCard>

        {/* What happens next, with real dates */}
        {recommendation.timeline.length > 0 && (
          <WizardCard>
            <WizardCardHeader
              title="Vad som händer härnäst"
              description="Dina egna förfallodatum, i tur och ordning."
            />
            <ol className="space-y-3">
              {recommendation.timeline.map((event) => (
                <li key={event.label} className="flex gap-4">
                  <div
                    className={`w-16 flex-shrink-0 rounded-lg px-2 py-1.5 text-center ${
                      event.severity === 'critical'
                        ? 'bg-destructive/10 text-destructive'
                        : event.severity === 'warning'
                        ? 'bg-warning/10 text-warning'
                        : 'bg-secondary text-foreground'
                    }`}
                  >
                    <span className="block text-xs font-semibold leading-tight">
                      {formatSwedishDate(event.iso)}
                    </span>
                    <span className="block text-[10px] opacity-80">
                      {event.daysAway === 0 ? 'idag' : `om ${event.daysAway} d`}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="font-medium text-foreground">{event.label}</p>
                      {event.amount !== null && (
                        <span className="text-sm text-muted-foreground tabular-nums">
                          {event.amount.toLocaleString('sv-SE')} kr
                        </span>
                      )}
                    </div>
                    {event.note && (
                      <p className="text-sm text-muted-foreground mt-0.5">{event.note}</p>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </WizardCard>
        )}

        {/* Personal-liability and other risks the user may not know about */}
        {recommendation.riskFlags.length > 0 && (
          <WizardCard>
            <WizardCardHeader
              title="Viktigt att känna till"
              description="Sådant som kan påverka dig personligen, inte bara bolaget."
            />
            <div className="space-y-4">
              {recommendation.riskFlags.map((flag) => (
                <div
                  key={flag.id}
                  className={`p-4 rounded-md border ${
                    flag.severity === 'critical'
                      ? 'bg-destructive/5 border-destructive/30'
                      : 'bg-warning/5 border-warning/30'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                        flag.severity === 'critical' ? 'text-destructive' : 'text-warning'
                      }`}
                    />
                    <div>
                      <h4 className="font-medium text-foreground mb-1">{flag.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed">{flag.body}</p>
                      {flag.legalRef && (
                        <p className="text-xs text-muted-foreground/80 mt-2">{flag.legalRef}</p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </WizardCard>
        )}

        {/* Concrete actions, deadline first */}
        <WizardCard>
          <WizardCardHeader title="Vad du bör göra" />
          <ol className="space-y-3">
            {recommendation.nextSteps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                    step.urgent
                      ? 'bg-destructive text-destructive-foreground'
                      : 'bg-accent/10 text-accent'
                  }`}
                >
                  {i + 1}
                </span>
                <div>
                  <p className="text-sm text-foreground">{step.text}</p>
                  {step.deadline && (
                    <p className="text-sm font-medium text-destructive mt-0.5">{step.deadline}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </WizardCard>

        {/* Comfort Text - Dynamic based on recommendation */}
        <WizardCard>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <div>
              <h4 className="font-medium text-foreground mb-2">
                {recommendation.type === 'stabilize' ? 'Det finns vägar framåt' : 'Du är inte ensam'}
              </h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {recommendation.type === 'stabilize' 
                  ? 'Ett pressat läge behöver inte betyda att bolaget är förlorat, men det avgörs av siffrorna och av hur snabbt du agerar – inte av något vi kan lova här. Likviditetsplanering och tidig dialog med borgenärer är det som brukar ge handlingsutrymme. Vi hjälper dig strukturera nästa steg.'
                  : recommendation.type === 'reconstruction'
                  ? 'Rekonstruktion är ett verktyg för att rädda livskraftiga verksamheter genom att ge tillfälligt skydd mot utmätning medan en plan tas fram tillsammans med borgenärerna.'
                  : 'Konkurs och rekonstruktion är vanligt förekommande, och drabbar även välskötta bolag när timing, konjunktur och likviditet inte går ihop. Det säger inget om dig som person. Fokus nu är att skapa kontroll, struktur och rätt nästa steg.'
                }
              </p>
            </div>
          </div>
        </WizardCard>

        {/* Disclaimer */}
        <div className="p-4 rounded-md bg-secondary/50 border border-border">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Viktig information:</strong> CLEARANCE tillhandahåller administrativt stöd och information, 
            inte juridisk rådgivning. Rekommendationen ovan är baserad på din input och ersätter inte professionell juridisk eller ekonomisk rådgivning.
          </p>
        </div>

        {/* Create Case Button */}
        {showAuthPrompt ? (
          <SaveWithAccountPrompt
            description="Ett konto sparar din utvärdering så du kan återkomma till ärendet senare."
            onAuthenticated={() => {
              setShowAuthPrompt(false);
              persistCase();
            }}
          />
        ) : (
          <div className="space-y-3">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1 w-5 h-5 rounded border-border accent-accent"
                checked={disclaimerAccepted}
                onChange={(e) => setDisclaimerAccepted(e.target.checked)}
                required
              />
              <span className="text-sm text-muted-foreground">
                Jag förstår att detta är informativt stöd och att jag själv ansvarar för beslut baserade på denna information.
              </span>
            </label>

            {saveError && (
              <p className="text-sm text-destructive" role="alert">
                {saveError}
              </p>
            )}

            <Button
              variant="accent"
              size="lg"
              className="w-full"
              onClick={createCase}
              disabled={!disclaimerAccepted || saving}
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Skapa ärende
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    );
  };

  const stepTitles = [
    "Företagsidentitet",
    "Kritiska betalningar", 
    "Skulder & tillgångar",
    "Rekommendation"
  ];

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

      <main className="container px-4 py-6 max-w-lg mx-auto">
        {/* Progress */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-muted-foreground">
              Steg {currentStep + 1} av {totalSteps}
            </p>
            <p className="text-sm font-medium text-foreground">
              {stepTitles[currentStep]}
            </p>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full surface-accent transition-colors duration-300"
              style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="mb-6">
          {currentStep === 0 && renderStep1()}
          {currentStep === 1 && renderStep2()}
          {currentStep === 2 && renderStep3()}
          {currentStep === 3 && renderStep4()}
        </div>

        {/* Navigation */}
        {currentStep < 3 && (
          <div className="flex gap-3 sticky bottom-4">
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
        )}
        
        {/* Not sticky on the final step: it would float on top of the
            disclaimer and the accept-terms checkbox below it. */}
        {currentStep === 3 && !caseCreated && (
          <div className="flex gap-3">
            <Button variant="outline" size="lg" onClick={prevStep} className="flex-1">
              <ArrowLeft className="w-5 h-5" />
              Tillbaka
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default CrisisWizard;
