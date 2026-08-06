import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import { COMPANY, formatAddress, legalIdentityIsComplete } from "@/lib/company";
import type { ContactTopic } from "@/data/types";
import { AlertTriangle, CheckCircle2, Loader2, Send } from "lucide-react";

/**
 * Kontaktformuläret.
 *
 * Det finns ingen publicerad e-postadress. Meddelanden landar i inkorgen i
 * driftinloggningen, där det syns vem som tagit hand om vad.
 *
 * Två saker som formuläret måste vara ärligt med, eftersom avsändaren ofta
 * har ont om tid:
 *
 *   1. Det här är inte en jourlinje. Står bolaget inför ett förfallodatum i
 *      morgon är svaret här för långsamt, och det ska stå.
 *   2. Fälten är begränsade i databasen, inte bara här. Samma gränser gäller
 *      därför oavsett hur meddelandet skickas.
 */

const TOPICS: { value: ContactTopic; label: string; hint: string }[] = [
  {
    value: "question",
    label: "Fråga om tjänsten",
    hint: "Hur något fungerar, vad som ingår, vad som kostar.",
  },
  {
    value: "company",
    label: "Företag som behöver hjälp",
    hint: "Du driver ett bolag och vet inte var du ska börja.",
  },
  {
    value: "advisor",
    label: "Rådgivare som vill ansluta sig",
    hint: "Ansökan görs enklast direkt i formuläret för rådgivare.",
  },
  {
    value: "invoice",
    label: "Faktura eller betalning",
    hint: "Frågor om en avgift, en faktura eller ett underlag.",
  },
  {
    value: "privacy",
    label: "Personuppgifter",
    hint: "Registerutdrag, rättelse eller radering av uppgifter.",
  },
  {
    value: "bug",
    label: "Något fungerar inte",
    hint: "Beskriv gärna vad du gjorde och vad som hände.",
  },
  { value: "other", label: "Annat", hint: "" },
];

/** Samma gränser som CHECK-villkoren i migrationen. */
const MESSAGE_MIN = 10;
const MESSAGE_MAX = 5000;

const Contact = () => {
  const { user } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [topic, setTopic] = useState<ContactTopic>("question");
  const [message, setMessage] = useState("");

  const send = useMutation({
    mutationFn: () =>
      data.contact.submit({
        name: name.trim(),
        email: (email.trim() || user?.email || "").trim(),
        phone: phone.trim() || null,
        company: company.trim() || null,
        topic,
        message: message.trim(),
      }),
  });

  const effectiveEmail = email || user?.email || "";
  const trimmedMessage = message.trim();
  const messageTooShort = trimmedMessage.length > 0 && trimmedMessage.length < MESSAGE_MIN;
  const canSend =
    name.trim().length > 0 &&
    effectiveEmail.trim().length > 0 &&
    trimmedMessage.length >= MESSAGE_MIN;

  const selectedTopic = TOPICS.find((t) => t.value === topic);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!canSend) return;
    send.mutate();
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="pt-24 pb-16">
        <section className="container px-4 mb-12">
          <div className="max-w-2xl">
            <h1 className="font-display text-3xl text-foreground sm:text-4xl">Kontakta oss</h1>
            <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
              Skriv här så kommer meddelandet in till oss. Vi svarar till den
              e-postadress du anger, normalt inom två arbetsdagar.
            </p>
          </div>
        </section>

        <section className="container px-4">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <div className="lg:col-span-2">
              {send.isSuccess ? (
                <WizardCard className="border-success/30 bg-success/5">
                  <div className="flex items-start gap-4">
                    <CheckCircle2
                      className="mt-0.5 h-6 w-6 flex-shrink-0 text-success"
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground">Meddelandet är skickat</h2>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Vi hör av oss till {effectiveEmail}. Behöver du komplettera
                        något kan du skicka ett till meddelande.
                      </p>
                      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                        <Button variant="outline" onClick={() => send.reset()}>
                          Skicka ett till
                        </Button>
                        <Button variant="accent" asChild>
                          <Link to="/wizard">Gå till utvärderingen</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </WizardCard>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <WizardCard>
                    <WizardCardHeader
                      title="Vad gäller det?"
                      description="Hjälper oss att skicka meddelandet till rätt person direkt."
                    />
                    <div className="space-y-2">
                      <label
                        htmlFor="contact-topic"
                        className="block text-sm font-medium text-foreground"
                      >
                        Ämne
                      </label>
                      <select
                        id="contact-topic"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value as ContactTopic)}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        {TOPICS.map((t) => (
                          <option key={t.value} value={t.value}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                      {selectedTopic?.hint && (
                        <p className="text-xs text-muted-foreground">{selectedTopic.hint}</p>
                      )}
                      {topic === "advisor" && (
                        <p className="text-sm text-muted-foreground">
                          <Link
                            to="/for-radgivare"
                            className="font-medium text-accent underline-offset-4 hover:underline"
                          >
                            Gå direkt till ansökan för rådgivare
                          </Link>{" "}
                          – där finns fälten vi behöver för att kunna kontrollera din
                          behörighet.
                        </p>
                      )}
                    </div>
                  </WizardCard>

                  <WizardCard>
                    <WizardCardHeader
                      title="Så når vi dig"
                      description="Svaret går till e-postadressen. Kontrollera att den stämmer."
                    />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <label
                          htmlFor="contact-name"
                          className="block text-sm font-medium text-foreground"
                        >
                          Namn
                        </label>
                        <Input
                          id="contact-name"
                          required
                          autoComplete="name"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="contact-email"
                          className="block text-sm font-medium text-foreground"
                        >
                          E-post
                        </label>
                        <Input
                          id="contact-email"
                          type="email"
                          required
                          autoComplete="email"
                          value={effectiveEmail}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="contact-phone"
                          className="block text-sm font-medium text-foreground"
                        >
                          Telefon <span className="text-muted-foreground">(frivilligt)</span>
                        </label>
                        <Input
                          id="contact-phone"
                          type="tel"
                          autoComplete="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="contact-company"
                          className="block text-sm font-medium text-foreground"
                        >
                          Företag <span className="text-muted-foreground">(frivilligt)</span>
                        </label>
                        <Input
                          id="contact-company"
                          autoComplete="organization"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                        />
                      </div>
                    </div>
                  </WizardCard>

                  <WizardCard>
                    <WizardCardHeader title="Ditt meddelande" />
                    <div className="space-y-2">
                      <label htmlFor="contact-message" className="sr-only">
                        Meddelande
                      </label>
                      <Textarea
                        id="contact-message"
                        required
                        rows={8}
                        maxLength={MESSAGE_MAX}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        aria-invalid={messageTooShort || undefined}
                        aria-describedby="contact-message-help"
                        placeholder="Beskriv kort vad saken gäller."
                      />
                      <p
                        id="contact-message-help"
                        className={`text-xs ${messageTooShort ? "text-destructive" : "text-muted-foreground"}`}
                      >
                        {messageTooShort
                          ? `Skriv minst ${MESSAGE_MIN} tecken så att vi förstår vad saken gäller.`
                          : `${trimmedMessage.length} av ${MESSAGE_MAX.toLocaleString("sv-SE")} tecken.`}
                      </p>
                    </div>

                    {/* Uppmaningen står här och inte längst ned: den som bara
                        skummar formuläret ska se den innan hen skriver klart. */}
                    <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-4 text-sm leading-relaxed text-foreground">
                      <AlertTriangle
                        className="mr-2 inline h-4 w-4 flex-shrink-0 align-text-bottom text-warning"
                        aria-hidden="true"
                      />
                      Skicka inte personnummer, kontoutdrag eller andra känsliga
                      handlingar i formuläret. Behöver vi dem säger vi till, och då
                      lämnar du dem i ditt ärende där de ligger skyddade.
                    </p>
                  </WizardCard>

                  {send.isError && (
                    <p className="text-sm text-destructive" role="alert">
                      Meddelandet gick inte att skicka just nu. Försök igen om en stund.
                    </p>
                  )}

                  <Button
                    type="submit"
                    variant="accent"
                    size="lg"
                    className="w-full"
                    disabled={!canSend || send.isPending}
                  >
                    {send.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden="true" />
                    )}
                    Skicka meddelande
                  </Button>
                </form>
              )}
            </div>

            <aside className="space-y-6 lg:col-span-1">
              <div className="rounded-md border border-border bg-card p-6">
                <h2 className="font-semibold text-foreground">Är det bråttom?</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Vi är inte en jourfunktion. Har bolaget ett förfallodatum inom
                  några dagar går det snabbare att göra utvärderingen och kontakta en
                  rådgivare direkt i katalogen.
                </p>
                <div className="mt-4 flex flex-col gap-2 text-sm">
                  <Link
                    to="/wizard"
                    className="font-medium text-accent underline-offset-4 hover:underline"
                  >
                    Utvärdera situationen
                  </Link>
                  <Link
                    to="/marketplace"
                    className="font-medium text-accent underline-offset-4 hover:underline"
                  >
                    Sök rådgivare
                  </Link>
                </div>
              </div>

              {legalIdentityIsComplete() && (
                <div className="rounded-md border border-border bg-card p-6">
                  <h2 className="font-semibold text-foreground">Postadress</h2>
                  <address className="mt-2 text-sm not-italic leading-relaxed text-muted-foreground">
                    {COMPANY.legalName}
                    <br />
                    {formatAddress()}
                  </address>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    Org.nr {COMPANY.orgNumber}. {COMPANY.productName} är en produkt från{" "}
                    {COMPANY.legalName}, med säte i {COMPANY.registeredOffice}.
                  </p>
                </div>
              )}

              <div className="rounded-md border border-border bg-secondary/40 p-6">
                <h2 className="font-semibold text-foreground">Vad som händer med det du skriver</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Meddelandet sparas hos oss och läses av den som handlägger
                  frågan. Det används för att svara dig, inget annat. Vill du att vi
                  raderar det, skriv det i meddelandet så gör vi det när ärendet är
                  avslutat.
                </p>
              </div>
            </aside>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Contact;
