import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WizardCard, WizardCardHeader } from "@/components/wizard/WizardCard";
import { useAuth } from "@/hooks/useAuth";
import { data } from "@/data";
import type { FixedPrice, MyProfessionalProfile } from "@/data/types";
import { BadgeCheck, CheckCircle2, Loader2, Lock, Plus, Trash2 } from "lucide-react";

/**
 * Byråns egen profiladministration.
 *
 * Andra halvan av "Är detta din profil?": ett godkänt anspråk kopplar
 * profilen till kontot - här hålls den levande. Byrån råder över det som
 * beskriver tjänsten (beskrivning, ort, kontaktvägar, specialiseringar,
 * fasta priser, faktureringsadress). Identiteten - namn, byrå, kategori -
 * och verifieringsmärket visas som låsta fält med förklaringen varför:
 * de ändras av driften efter kontroll, aldrig av ett formulär. Det är
 * skillnaden mellan ett verifierat register och ett ryktesbibliotek.
 */

const CATEGORY_LABELS: Record<string, string> = {
  konkursforvaltare: "Konkursförvaltare",
  rekonstruktor: "Rekonstruktör",
  revisor: "Revisor",
  affarsjurist: "Affärsjurist",
  kreditbolag: "Kreditbolag",
};

const ProfileForm = ({ profile }: { profile: MyProfessionalProfile }) => {
  const queryClient = useQueryClient();
  const [description, setDescription] = useState(profile.description ?? "");
  const [location, setLocation] = useState(profile.location ?? "");
  const [email, setEmail] = useState(profile.email ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [website, setWebsite] = useState(profile.website ?? "");
  const [specializations, setSpecializations] = useState(profile.specializations.join(", "));
  const [prices, setPrices] = useState<FixedPrice[]>(profile.fixedPrices);
  const [billingEmail, setBillingEmail] = useState(profile.billingEmail ?? "");

  const save = useMutation({
    mutationFn: () =>
      data.professionals.updateMyProfile({
        description: description.trim() || null,
        location: location.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        website: website.trim() || null,
        specializations: specializations
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
        fixedPrices: prices
          .filter((p) => p.service.trim().length > 0)
          .map((p) => ({ service: p.service.trim(), price: Number(p.price) || 0 })),
        billingEmail: billingEmail.trim() || null,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-professional-profile"] });
      queryClient.invalidateQueries({ queryKey: ["professionals"] });
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
      className="space-y-5"
    >
      <WizardCard>
        <WizardCardHeader
          title="Identitet och verifiering"
          description="Ändras av driften efter kontroll – kontakta oss om något är fel."
        />
        <dl className="space-y-2 text-sm">
          {[
            ["Namn", profile.name],
            ["Byrå", profile.company ?? "–"],
            ["Kategori", CATEGORY_LABELS[profile.category] ?? profile.category],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-3">
              <dt className="flex items-center gap-1.5 text-muted-foreground">
                <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                {label}
              </dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-muted-foreground">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Status
            </dt>
            <dd className="flex items-center gap-1 text-sm font-medium text-emerald-600">
              <BadgeCheck className="h-4 w-4" aria-hidden="true" />
              Verifierad
            </dd>
          </div>
        </dl>
      </WizardCard>

      <WizardCard>
        <WizardCardHeader
          title="Så beskrivs ni i katalogen"
          description="Det företag i kris ser när de väljer rådgivare. Hålls uppgifterna aktuella kommer förfrågningarna rätt."
        />
        <div className="space-y-4">
          <label className="block text-sm">
            <span className="font-medium text-foreground">Beskrivning</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-foreground">Ort</span>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">E-post</span>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">Telefon</span>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="mt-1" />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-foreground">Webbplats</span>
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="https://…"
                className="mt-1"
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="font-medium text-foreground">Specialiseringar</span>
            <Input
              value={specializations}
              onChange={(e) => setSpecializations(e.target.value)}
              placeholder="t.ex. Aktiebolag, Ackord, Obeståndsfrågor"
              className="mt-1"
            />
            <span className="mt-1 block text-xs text-muted-foreground">Kommaseparerade.</span>
          </label>
        </div>
      </WizardCard>

      <WizardCard>
        <WizardCardHeader
          title="Fasta priser"
          description="Transparent prissättning är ett av katalogens säljargument. 0 kr visas som Kostnadsfritt."
        />
        <ul className="space-y-2">
          {prices.map((price, index) => (
            <li key={index} className="flex flex-wrap items-center gap-2">
              <Input
                value={price.service}
                onChange={(e) =>
                  setPrices(prices.map((p, i) => (i === index ? { ...p, service: e.target.value } : p)))
                }
                placeholder="Tjänst"
                aria-label={`Tjänst ${index + 1}`}
                className="min-w-0 flex-1 basis-52"
              />
              <Input
                value={String(price.price)}
                onChange={(e) =>
                  setPrices(
                    prices.map((p, i) =>
                      i === index ? { ...p, price: Number(e.target.value.replace(/[^\d]/g, "")) || 0 } : p,
                    ),
                  )
                }
                inputMode="numeric"
                aria-label={`Pris ${index + 1} i kronor`}
                className="w-28 text-right tabular-nums"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPrices(prices.filter((_, i) => i !== index))}
                aria-label={`Ta bort raden ${price.service || index + 1}`}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => setPrices([...prices, { service: "", price: 0 }])}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Lägg till pris
        </Button>
      </WizardCard>

      <WizardCard>
        <WizardCardHeader
          title="Fakturering"
          description="Dit samlingsfakturan för upplåsta ärenden och förmedlingar skickas. Visas aldrig i katalogen."
        />
        <label className="block text-sm">
          <span className="font-medium text-foreground">Faktureringsadress (e-post)</span>
          <Input
            type="email"
            value={billingEmail}
            onChange={(e) => setBillingEmail(e.target.value)}
            placeholder="ekonomi@byran.se"
            className="mt-1"
          />
        </label>
      </WizardCard>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="accent" disabled={save.isPending}>
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Spara profilen
        </Button>
        {save.isSuccess && (
          <span className="flex items-center gap-1 text-sm text-success">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Sparat – syns direkt i katalogen
          </span>
        )}
        {save.isError && (
          <p className="text-sm text-destructive" role="alert">
            {save.error instanceof Error ? save.error.message : "Kunde inte spara profilen."}
          </p>
        )}
      </div>
    </form>
  );
};

const AdvisorProfile = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["my-professional-profile"],
    queryFn: () => data.professionals.getMyProfile(),
    enabled: !!user,
    retry: false,
  });

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto max-w-3xl px-4 pb-16 pt-24">
        <h1 className="mb-1 font-display text-3xl text-foreground">Byråprofil</h1>
        <p className="mb-6 text-muted-foreground">
          Din profil i rådgivarkatalogen – det företag i kris ser när de väljer
          vem de kontaktar.
        </p>

        {!user ? (
          <WizardCard>
            <p className="mb-4 text-muted-foreground">Logga in för att administrera byråns profil.</p>
            <Button variant="accent" onClick={() => navigate("/login")}>
              Logga in
            </Button>
          </WizardCard>
        ) : isLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-accent" aria-hidden="true" />
        ) : !profile ? (
          <WizardCard>
            <WizardCardHeader
              title="Ingen profil är kopplad till ditt konto"
              description="Två vägar in i katalogen – båda granskas innan något publiceras."
            />
            <div className="flex flex-col gap-3 sm:flex-row">
              <Button variant="accent" asChild>
                <Link to="/for-radgivare">Ansök om att synas i katalogen</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/marketplace">Finns byrån redan? Gör anspråk på profilen</Link>
              </Button>
            </div>
          </WizardCard>
        ) : (
          <ProfileForm profile={profile} />
        )}
      </main>
      <Footer />
    </div>
  );
};

export default AdvisorProfile;
