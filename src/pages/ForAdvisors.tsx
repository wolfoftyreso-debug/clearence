import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { SaveWithAccountPrompt } from "@/components/SaveWithAccountPrompt";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import type { ProfessionalCategory } from "@/data/types";
import {
  BadgeCheck,
  ClipboardCheck,
  Clock,
  Loader2,
  Plus,
  Trash2,
  Users,
  Wallet,
  XCircle,
} from "lucide-react";

type Category = ProfessionalCategory;

const categoryLabels: Record<Category, string> = {
  konkursforvaltare: "Konkursförvaltare",
  rekonstruktor: "Rekonstruktör",
  revisor: "Revisor",
  affarsjurist: "Affärsjurist",
  kreditbolag: "Kreditbolag",
};

/**
 * What we ask for depends on who regulates the category. Collecting a
 * checkable reference is the whole point - without it the listing can't
 * honestly carry a verification badge.
 */
const credentialHints: Record<Category, { authority: string; hint: string }> = {
  konkursforvaltare: {
    authority: "Tingsrätt / Kronofogdens förvaltarförteckning",
    hint: "Ange vilken tingsrätt du är förordnad vid, eller att du finns upptagen i förvaltarförteckningen.",
  },
  rekonstruktor: {
    authority: "Tingsrätt",
    hint: "Ange vid vilken tingsrätt du har förordnats som rekonstruktör.",
  },
  revisor: {
    authority: "Revisorsinspektionen",
    hint: "Ange ditt auktorisations- eller godkännandenummer hos Revisorsinspektionen.",
  },
  affarsjurist: {
    authority: "Sveriges advokatsamfund",
    hint: "Är du advokat, ange ditt ledamotskap. Är du jurist utan advokattitel, beskriv din behörighet.",
  },
  kreditbolag: {
    authority: "Finansinspektionen",
    hint: "Ange institutnummer eller tillstånd hos FI om verksamheten är tillståndspliktig.",
  },
};

// Index signature so this is directly assignable to the jsonb column's
// generated Json type without casting through unknown.
interface PriceRow {
  service: string;
  price: number;
  [key: string]: string | number;
}

const ForAdvisors = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const { data: application, isLoading } = useQuery({
    queryKey: ["my-application", user?.id],
    queryFn: () => data.applications.getMine(),
    enabled: !!user,
  });

  // Form state
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [orgNumber, setOrgNumber] = useState("");
  const [category, setCategory] = useState<Category>("konkursforvaltare");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [specializations, setSpecializations] = useState("");
  const [credentialReference, setCredentialReference] = useState("");
  const [credentialNote, setCredentialNote] = useState("");
  const [prices, setPrices] = useState<PriceRow[]>([]);
  const [priceService, setPriceService] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Inte inloggad");
      await data.applications.create({
        userId: user.id,
        contactName: contactName.trim(),
        email: email.trim() || user.email || "",
        phone: phone.trim() || null,
        company: company.trim() || null,
        orgNumber: orgNumber.trim() || null,
        category,
        location: location.trim() || null,
        description: description.trim() || null,
        website: website.trim() || null,
        specializations: specializations.split(",").map((s) => s.trim()).filter(Boolean),
        fixedPrices: prices,
        credentialAuthority: credentialHints[category].authority,
        credentialReference: credentialReference.trim() || null,
        credentialNote: credentialNote.trim() || null,
        termsAcceptedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["my-application", user?.id] }),
  });

  const addPrice = () => {
    const amount = parseInt(priceAmount.replace(/\s/g, ""), 10);
    if (!priceService.trim() || Number.isNaN(amount)) return;
    setPrices((p) => [...p, { service: priceService.trim(), price: amount }]);
    setPriceService("");
    setPriceAmount("");
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setShowAuthPrompt(true);
      return;
    }
    submit.mutate();
  };

  const statusView = () => {
    if (!application) return null;
    const map = {
      pending: {
        icon: Clock,
        tone: "bg-warning/10 border-warning/30",
        title: "Din ansökan är inskickad",
        body: "Vi kontrollerar uppgifterna mot den behörighet du angett innan profilen publiceras. Granskningen görs manuellt – vi hör av oss när den är klar.",
      },
      needs_info: {
        icon: ClipboardCheck,
        tone: "bg-warning/10 border-warning/30",
        title: "Vi behöver komplettering",
        body: application.reviewNote || "Vi behöver ytterligare uppgifter innan vi kan gå vidare.",
      },
      approved: {
        icon: BadgeCheck,
        tone: "bg-success/10 border-success/30",
        title: "Din profil är godkänd",
        body: "Du är publicerad i katalogen och syns för företag som söker rådgivare.",
      },
      rejected: {
        icon: XCircle,
        tone: "bg-destructive/10 border-destructive/30",
        title: "Ansökan gick inte vidare",
        body: application.reviewNote || "Vi kunde inte verifiera uppgifterna. Hör av dig om du vill komplettera.",
      },
    } as const;
    const s = map[application.status];
    const Icon = s.icon;

    return (
      <WizardCard className={s.tone}>
        <div className="flex items-start gap-4">
          <Icon className="w-6 h-6 flex-shrink-0 mt-0.5 text-foreground" />
          <div>
            <h3 className="font-semibold text-foreground mb-1">{s.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
            <p className="text-xs text-muted-foreground/80 mt-3">
              Inskickad {new Date(application.createdAt).toLocaleDateString("sv-SE")} ·{" "}
              {categoryLabels[application.category]}
            </p>
          </div>
        </div>
        {application.status === "approved" && (
          <div className="flex flex-col sm:flex-row gap-3 mt-4">
            <Button variant="accent" className="flex-1" onClick={() => navigate("/mina-forfragningar")}>
              Mina förfrågningar
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate("/marketplace")}>
              Se katalogen
            </Button>
          </div>
        )}
      </WizardCard>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <section className="container px-4 mb-12">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl text-foreground sm:text-4xl">
              Anslut dig som rådgivare
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Företag som använder CLEARANCE har redan gått igenom en strukturerad
              genomgång av sin situation innan de söker hjälp. Du möter dem med
              underlaget färdigt.
            </p>
          </div>
        </section>

        <section className="container px-4 mb-12">
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-md border border-border bg-border md:grid-cols-3">
            {[
              {
                icon: Users,
                title: "Företag som vet sitt läge",
                body: "De har svarat på frågor om betalningsförmåga, skulder och tillgångar innan de kontaktar dig.",
              },
              {
                icon: Wallet,
                title: "Priset syns i förväg",
                body: "Du anger vad tjänsterna kostar. Det tar bort en av de vanligaste trösklarna för att höra av sig.",
              },
              {
                icon: BadgeCheck,
                title: "Kontrollerad katalog",
                body: "Vi verifierar behörighet innan publicering, så listan är värd något för den som väljer.",
              },
            ].map((b) => {
              const Icon = b.icon;
              return (
                <div key={b.title} className="bg-card p-6">
                  <Icon className="h-5 w-5 text-accent" aria-hidden="true" />
                  <h3 className="mt-4 font-medium text-foreground">{b.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{b.body}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="container px-4"><div className="max-w-2xl space-y-5">
          {isLoading && user ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-accent" />
            </div>
          ) : application ? (
            statusView()
          ) : showAuthPrompt && !user ? (
            <SaveWithAccountPrompt
              title="Skapa konto för att ansöka"
              description="Kontot låter dig följa din ansökan och uppdatera dina uppgifter."
              onAuthenticated={() => setShowAuthPrompt(false)}
            />
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <WizardCard>
                <WizardCardHeader title="Kontaktuppgifter" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label htmlFor="adv-name" className="block text-sm font-medium text-foreground">Namn</label>
                    <Input id="adv-name" required value={contactName} onChange={(e) => setContactName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-email" className="block text-sm font-medium text-foreground">E-post</label>
                    <Input id="adv-email" type="email" required value={email || user?.email || ""} onChange={(e) => setEmail(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-phone" className="block text-sm font-medium text-foreground">Telefon</label>
                    <Input id="adv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-company" className="block text-sm font-medium text-foreground">Byrå/företag</label>
                    <Input id="adv-company" value={company} onChange={(e) => setCompany(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-org" className="block text-sm font-medium text-foreground">Organisationsnummer</label>
                    <Input id="adv-org" value={orgNumber} onChange={(e) => setOrgNumber(e.target.value)} placeholder="XXXXXX-XXXX" />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-location" className="block text-sm font-medium text-foreground">Ort</label>
                    <Input id="adv-location" value={location} onChange={(e) => setLocation(e.target.value)} />
                  </div>
                </div>
              </WizardCard>

              <WizardCard>
                <WizardCardHeader title="Din roll" />
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="adv-category" className="block text-sm font-medium text-foreground">Kategori</label>
                    <select
                      id="adv-category"
                      value={category}
                      onChange={(e) => setCategory(e.target.value as Category)}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      {(Object.keys(categoryLabels) as Category[]).map((c) => (
                        <option key={c} value={c}>{categoryLabels[c]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-desc" className="block text-sm font-medium text-foreground">Beskrivning</label>
                    <Textarea
                      id="adv-desc"
                      rows={4}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Vad du arbetar med och vilken typ av ärenden du tar."
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-spec" className="block text-sm font-medium text-foreground">
                      Specialiseringar
                    </label>
                    <Input
                      id="adv-spec"
                      value={specializations}
                      onChange={(e) => setSpecializations(e.target.value)}
                      placeholder="Aktiebolag, Tjänsteföretag, Obeståndsfrågor"
                    />
                    <p className="text-xs text-muted-foreground">Separera med kommatecken.</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-web" className="block text-sm font-medium text-foreground">Webbplats</label>
                    <Input id="adv-web" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" />
                  </div>
                </div>
              </WizardCard>

              <WizardCard>
                <WizardCardHeader
                  title="Behörighet"
                  description="Vi publicerar ingen profil utan att först kunna kontrollera den här uppgiften."
                />
                <div className="space-y-4">
                  <div className="p-4 rounded-md bg-secondary/50">
                    <p className="text-sm font-medium text-foreground mb-1">
                      {credentialHints[category].authority}
                    </p>
                    <p className="text-sm text-muted-foreground">{credentialHints[category].hint}</p>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-cred" className="block text-sm font-medium text-foreground">
                      Referens eller nummer
                    </label>
                    <Input id="adv-cred" value={credentialReference} onChange={(e) => setCredentialReference(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="adv-crednote" className="block text-sm font-medium text-foreground">
                      Övrigt om din behörighet
                    </label>
                    <Textarea id="adv-crednote" rows={3} value={credentialNote} onChange={(e) => setCredentialNote(e.target.value)} />
                  </div>
                </div>
              </WizardCard>

              <WizardCard>
                <WizardCardHeader
                  title="Fasta priser"
                  description="Frivilligt, men profiler med tydliga priser får fler förfrågningar."
                />
                {prices.length > 0 && (
                  <ul className="divide-y divide-border rounded-md border border-border mb-4">
                    {prices.map((p, i) => (
                      <li key={i} className="flex items-center gap-3 p-3">
                        <span className="flex-1 text-foreground">{p.service}</span>
                        <span className="font-medium tabular-nums text-foreground">
                          {p.price.toLocaleString("sv-SE")} kr
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setPrices((prev) => prev.filter((_, idx) => idx !== i))}
                          aria-label={`Ta bort ${p.service}`}
                        >
                          <Trash2 className="w-4 h-4 text-muted-foreground" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-col sm:flex-row gap-3">
                  <Input
                    value={priceService}
                    onChange={(e) => setPriceService(e.target.value)}
                    placeholder="T.ex. Inledande rådgivning"
                    aria-label="Tjänst"
                  />
                  <Input
                    value={priceAmount}
                    onChange={(e) => setPriceAmount(e.target.value)}
                    placeholder="Pris i kr"
                    inputMode="numeric"
                    aria-label="Pris"
                    className="sm:w-40"
                  />
                  <Button type="button" variant="outline" onClick={addPrice}>
                    <Plus className="w-4 h-4" />
                    Lägg till
                  </Button>
                </div>
              </WizardCard>

              <WizardCard>
                <WizardCardHeader
                  title="Avgifter och fakturering"
                  description="Du betalar bara för ärenden du faktiskt tagit emot. Inget för att synas."
                />
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  <li className="flex gap-2">
                    <span className="text-accent" aria-hidden="true">•</span>
                    <span>
                      Att ansöka och att finnas i katalogen kostar ingenting. Det finns
                      ingen månadsavgift och ingen bindningstid.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent" aria-hidden="true">•</span>
                    <span>
                      Avgiften per förmedlat ärende avtalas skriftligt med dig innan din
                      profil publiceras. Den är fast och påverkas inte av hur stort
                      uppdraget sedan blir.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent" aria-hidden="true">•</span>
                    <span>
                      Avgiften utgår först när du själv har bekräftat att du tar emot
                      ärendet. Visningar av profilen och förfrågningar du tackar nej
                      till kostar ingenting.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-accent" aria-hidden="true">•</span>
                    <span>
                      Fakturering sker månadsvis i efterskott. Underlaget – vilka ärenden
                      fakturan avser – finns i din inloggning och går att stämma av
                      innan fakturan kommer.
                    </span>
                  </li>
                </ul>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-5 h-5 rounded border-border accent-accent"
                  />
                  <span className="text-sm text-muted-foreground">
                    Jag har läst villkoren ovan och godtar att avgiften per förmedlat
                    ärende avtalas skriftligt innan min profil publiceras. Ansökan i sig
                    binder mig inte till någon kostnad.
                  </span>
                </label>
              </WizardCard>

              {submit.isError && (
                <p className="text-sm text-destructive" role="alert">
                  Kunde inte skicka ansökan just nu. Försök igen.
                </p>
              )}

              <Button
                type="submit"
                variant="accent"
                size="lg"
                className="w-full"
                disabled={submit.isPending || !termsAccepted}
              >
                {submit.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Skicka ansökan
              </Button>

              <p className="text-xs leading-relaxed text-muted-foreground">
                Ansökan publiceras inte automatiskt. Vi kontrollerar behörigheten
                först, eftersom katalogen används av företag som ska välja någon
                att anförtro sin konkurs eller rekonstruktion.
              </p>
            </form>
          )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default ForAdvisors;
