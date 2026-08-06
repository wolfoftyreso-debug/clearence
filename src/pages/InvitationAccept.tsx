import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import { CASE_ROLE_DESCRIPTIONS, CASE_ROLE_LABELS } from "@/lib/caseRoles";
import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { CheckCircle2, Loader2, ShieldQuestion } from "lucide-react";

/**
 * Acceptsidan för en inbjudan - dit mejllänken pekar.
 *
 * Tre lägen, i den ordning en verklig mottagare möter dem:
 *
 *  1. UTLOGGAD: förklara att kontot måste ha samma adress som fick mejlet,
 *     och länka till inloggningen. Utan den förklaringen registrerar folk
 *     sig med sin privata adress och möter ett obegripligt "finns inte".
 *
 *  2. INLOGGAD, FEL/OKÄND INBJUDAN: samma neutrala svar oavsett om inbjudan
 *     inte finns, är utgången eller är ställd till någon annan - vilka
 *     adresser som bjudits in till vilka ärenden är inget den här sidan
 *     ska läcka.
 *
 *  3. INLOGGAD, RÄTT ADRESS: visa bolag och roll INNAN accept. Man ska veta
 *     vad man tackar ja till - särskilt vad rollen låter en se och göra.
 */

const InvitationAccept = () => {
  const { id } = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [accepted, setAccepted] = useState(false);

  const { data: peek, isLoading } = useQuery({
    queryKey: ["invitation-peek", id],
    queryFn: () => data.members.peekInvitation(id as string),
    enabled: Boolean(id) && Boolean(user),
  });

  const accept = useMutation({
    mutationFn: () => data.members.acceptInvitation(id as string),
    onSuccess: () => {
      setAccepted(true);
      setTimeout(() => navigate("/dashboard"), 1600);
    },
  });

  const spentAt = peek?.acceptedAt ?? null;
  const revoked = peek?.revokedAt !== null && peek?.revokedAt !== undefined;
  const expired = peek ? new Date(peek.expiresAt).getTime() < Date.now() : false;
  const open = peek && !spentAt && !revoked && !expired;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-12">
        <h1 className="text-2xl font-semibold text-foreground">Inbjudan till ett ärende</h1>

        {authLoading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-accent" aria-hidden="true" />
        ) : !user ? (
          <div className="mt-6 rounded-md border border-border bg-card p-5">
            <p className="text-sm leading-relaxed text-foreground">
              Du har fått en inbjudan till ett ärende på Clearance. För att tacka
              ja behöver du vara inloggad med{" "}
              <strong>samma e-postadress som inbjudan skickades till</strong> –
              länken i sig ger ingen åtkomst.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Har du inget konto skapar du ett med den adressen först. Kom sedan
              tillbaka hit via länken i mejlet.
            </p>
            <Button asChild className="mt-4">
              <Link to="/login">Logga in eller skapa konto</Link>
            </Button>
          </div>
        ) : isLoading ? (
          <Loader2 className="mt-6 h-5 w-5 animate-spin text-accent" aria-hidden="true" />
        ) : accepted ? (
          <div className="mt-6 rounded-md border border-success/40 bg-success/10 p-5">
            <p className="flex items-center gap-2 font-medium text-foreground">
              <CheckCircle2 className="h-5 w-5 text-success" aria-hidden="true" />
              Du är nu med i ärendet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Du skickas vidare till översikten …
            </p>
          </div>
        ) : !peek ? (
          <div className="mt-6 rounded-md border border-border bg-card p-5">
            <p className="flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
              <ShieldQuestion className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span>
                Inbjudan hittades inte. Den kan ha gått ut, vara återkallad –
                eller vara ställd till en annan e-postadress än den du är
                inloggad med. Kontrollera att du är inloggad med adressen som
                fick mejlet.
              </span>
            </p>
          </div>
        ) : !open ? (
          <div className="mt-6 rounded-md border border-border bg-card p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              {spentAt
                ? "Inbjudan är redan använd. Ärendet finns i din översikt."
                : revoked
                  ? "Inbjudan är återkallad. Kontakta den som bjöd in dig om det är fel."
                  : "Inbjudan har gått ut. Be den som bjöd in dig att skicka en ny."}
            </p>
            {spentAt && (
              <Button asChild className="mt-4">
                <Link to="/dashboard">Till översikten</Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="mt-6 rounded-md border border-border bg-card p-5">
            <p className="text-sm leading-relaxed text-foreground">
              {peek.inviterName ?? "En kollega"} har bjudit in dig till ärendet
              för <strong>{peek.companyName ?? "bolaget"}</strong>
              {peek.orgNumber ? ` (${peek.orgNumber})` : ""} som{" "}
              <strong>{CASE_ROLE_LABELS[peek.role].toLowerCase()}</strong>.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Rollen innebär: {CASE_ROLE_DESCRIPTIONS[peek.role]}
            </p>
            <Button
              className="mt-4"
              disabled={accept.isPending}
              onClick={() => accept.mutate()}
            >
              {accept.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                "Tacka ja och gå till ärendet"
              )}
            </Button>
            {accept.isError && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {accept.error instanceof Error
                  ? accept.error.message
                  : "Kunde inte tacka ja. Försök igen."}
              </p>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default InvitationAccept;
