import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import { useAuth } from "@/hooks/useAuth";
import {
  CASE_ROLE_DESCRIPTIONS,
  CASE_ROLE_LABELS,
  INVITABLE_ROLES,
  type CaseRole,
} from "@/lib/caseRoles";
import { ArrowRight, Loader2, Mail, ShieldQuestion, UserPlus, Users, X } from "lucide-react";
import { LockedFeature, useEntitlements } from "@/components/billing/LockedFeature";

/**
 * Deltagare: vilka som är inne i ärendet, och vägen in för nästa person.
 *
 * En kontrollbalansprocess är inte en ensamsyssla - styrelsen, revisorn och
 * eventuell rådgivare behöver se samma sak. Sidan gör två saker begripliga:
 *
 *  1. VEM SER VAD. Rollvalet i formuläret är i praktiken ett behörighetsval,
 *     så varje roll beskrivs med vad den kan - inte bara vad den heter.
 *     Att borgenärer aldrig kan bjudas in hit sägs rakt ut: det är en av
 *     produktens viktigaste gränser, inte en brist.
 *
 *  2. LÄNKEN ÄR INTE NYCKELN, ADRESSEN ÄR. Inbjudan blir medlemskap först
 *     när någon loggar in med exakt den adress som bjöds in. Den meningen
 *     står vid formuläret, för den som bjuder in är den som annars
 *     vidarebefordrar länken "till rätt person".
 */

const swedishDate = (iso: string) =>
  new Date(iso).toLocaleDateString("sv-SE", { day: "numeric", month: "short", year: "numeric" });

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const SHARE_STATUS: Record<string, string> = {
  sent: "Väntar på rådgivaren – ser bara en avidentifierad förhandsvisning",
  unlocked: "Upplåst – rådgivaren ser sammanfattningen och dina kontaktuppgifter",
  declined: "Avböjd – ingen information utöver förhandsvisningen delades",
  withdrawn: "Återkallad",
};

/**
 * Live ärendelänken: länken ÄR ärendet, alltid aktuell - för mottagare
 * UTANFÖR ärendet (bank, försäkringsbolag, finansiär) som ska följa
 * läget utan medlemskap. Tidsbegränsad, återkallbar, åtkomstloggad,
 * och med nivåval: översikt eller fullständig. Data, inte bedömningar.
 */
const ShareLinksSection = ({ caseId }: { caseId: string }) => {
  const queryClient = useQueryClient();
  const [scope, setScope] = useState<"overview" | "full">("overview");
  const { data: links } = useQuery({
    queryKey: ["share-links", caseId],
    queryFn: () => data.shares.list(caseId),
    retry: false,
  });
  const create = useMutation({
    mutationFn: () => data.shares.create({ caseId, scope, validDays: 30 }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-links", caseId] }),
  });
  const revoke = useMutation({
    mutationFn: (id: string) => data.shares.revoke(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["share-links", caseId] }),
  });
  const linkUrl = (id: string): string => {
    const base = `${window.location.origin}${window.location.pathname}`;
    return window.location.hash ? `${base}#/lank/${id}` : `${window.location.origin}/lank/${id}`;
  };

  return (
    <section aria-labelledby="share-links-heading" data-guide="arendelank" className="rounded-md border border-border bg-card p-5">
      <h2 id="share-links-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <ArrowRight className="h-5 w-5 text-accent" aria-hidden="true" />
        Live ärendelänk
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        En säker länk som visar ärendets nuläge varje gång den öppnas – för
        bank, försäkringsbolag eller finansiär som ska följa läget utan att
        vara deltagare. Länken är giltig i 30 dagar, kan återkallas när som
        helst, och varje öppning loggas. Den visar data – bedömningarna gör
        mottagaren själv.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value === "full" ? "full" : "overview")}
          aria-label="Länkens nivå"
          className="h-9 rounded-md border border-border bg-card px-2 text-sm text-foreground"
        >
          <option value="overview">Översikt – läge och frister</option>
          <option value="full">Fullständig – även handlingarna</option>
        </select>
        <Button size="sm" variant="outline" disabled={create.isPending} onClick={() => create.mutate()}>
          Skapa länk
        </Button>
      </div>
      {(links ?? []).length > 0 && (
        <ul className="mt-3 space-y-2">
          {(links ?? []).map((link) => (
            <li key={link.id} className="rounded-md border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">
                  {link.scope === "full" ? "Fullständig vy" : "Översiktsvy"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {link.revokedAt
                    ? "Återkallad"
                    : `giltig till ${link.expiresAt.slice(0, 10)} · öppnad ${link.accessCount} ${link.accessCount === 1 ? "gång" : "gånger"}`}
                </span>
              </div>
              {!link.revokedAt && (
                <p className="mt-1.5 break-all rounded-md bg-secondary/40 p-2 font-mono text-xs text-foreground" data-share-url>
                  {linkUrl(link.id)}
                </p>
              )}
              {!link.revokedAt && (
                <button
                  type="button"
                  onClick={() => revoke.mutate(link.id)}
                  className="mt-1.5 text-xs font-medium text-destructive underline-offset-4 hover:underline"
                >
                  Återkalla länken
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

/**
 * Delningsinsynen: vilka rådgivare som kontaktats i ärendet, vad de kan se
 * i det här ögonblicket och när samtycket gavs. Transparensen är löftet -
 * ingen delning utan godkännande, och ingen delning utan det här kvittot.
 */
const SharesSection = ({ caseId }: { caseId: string }) => {
  const { data: shares } = useQuery({
    queryKey: ["case-shares", caseId],
    queryFn: () => data.leads.listForCase(caseId),
    retry: false,
  });
  const { data: professionals } = useQuery({
    queryKey: ["professionals"],
    queryFn: () => data.professionals.listActive(),
    enabled: (shares ?? []).length > 0,
  });

  if (!shares || shares.length === 0) return null;
  const nameOf = (professionalId: string) => {
    const pro = (professionals ?? []).find((p) => p.id === professionalId);
    return pro ? pro.company ?? pro.name : "Rådgivare";
  };

  return (
    <section aria-labelledby="shares-heading" className="rounded-md border border-border bg-card p-5">
      <h2 id="shares-heading" className="flex items-center gap-2 text-lg font-semibold text-foreground">
        <ShieldQuestion className="h-5 w-5 text-accent" aria-hidden="true" />
        Delat med rådgivare
      </h2>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        Rådgivare du kontaktat via CLEARANCE, och exakt vad de kan se just nu.
        Ingen information delas utan ditt godkännande – och varje delning
        redovisas här.
      </p>
      <ul className="mt-3 space-y-2">
        {shares.map((share) => (
          <li key={share.id} className="rounded-md border border-border p-3">
            <p className="text-sm font-medium text-foreground">{nameOf(share.professionalId)}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {SHARE_STATUS[share.status] ?? share.status} · samtycke lämnat{" "}
              {swedishDate(share.consentAt)}
              {share.unlockedAt && ` · upplåst ${swedishDate(share.unlockedAt)}`}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
};

/**
 * Kollega-genvägen: om den inloggade hör till en byrå med team visas
 * kollegorna som snabbval under adressfältet. Ett klick fyller i adressen
 * - inget mer. Teamet ger ALDRIG åtkomst i sig; inbjudan är per ärende
 * och går genom exakt samma flöde som en manuellt ifylld adress.
 */
const TeamQuickPick = ({
  current,
  onPick,
}: {
  current: string;
  onPick: (email: string) => void;
}) => {
  const { user } = useAuth();
  const { data: myProfile } = useQuery({
    queryKey: ["my-professional-profile"],
    queryFn: () => data.professionals.getMyProfile(),
    retry: false,
  });
  const { data: team } = useQuery({
    queryKey: ["firm-team", myProfile?.id],
    queryFn: () => data.professionals.listTeam(myProfile!.id),
    enabled: !!myProfile,
    retry: false,
  });

  const colleagues = (team ?? []).filter(
    (m) => m.email && m.email !== user?.email?.toLowerCase(),
  );
  if (colleagues.length === 0) return null;

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Från teamet:</span>
      {colleagues.map((member) => (
        <button
          key={member.userId}
          type="button"
          onClick={() => onPick(member.email!)}
          className={`rounded-full border px-2 py-0.5 text-xs transition-colors ${
            current === member.email
              ? "border-accent bg-accent/10 text-foreground"
              : "border-border text-muted-foreground hover:border-accent hover:text-foreground"
          }`}
        >
          {member.email}
        </button>
      ))}
    </div>
  );
};

const DashboardParticipants = () => {
  const queryClient = useQueryClient();
  const { exportAndSharing: inviteEntitled } = useEntitlements();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CaseRole>("board_member");

  const { data: caseRecord, isLoading: caseLoading } = useQuery({
    queryKey: ["latest-case"],
    queryFn: () => data.cases.getLatest(),
  });

  const caseId = caseRecord?.id ?? null;

  const { data: members } = useQuery({
    queryKey: ["case-members", caseId],
    queryFn: () => data.members.listMembers(caseId as string),
    enabled: caseId !== null,
  });
  const { data: invitations } = useQuery({
    queryKey: ["case-invitations", caseId],
    queryFn: () => data.members.listInvitations(caseId as string),
    enabled: caseId !== null,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["case-members", caseId] });
    queryClient.invalidateQueries({ queryKey: ["case-invitations", caseId] });
  };

  const invite = useMutation({
    mutationFn: () => data.members.invite(caseId as string, email.trim(), role),
    onSuccess: () => {
      setEmail("");
      refresh();
    },
  });

  const revoke = useMutation({
    mutationFn: (invitationId: string) => data.members.revokeInvitation(invitationId),
    onSuccess: refresh,
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!caseId || !EMAIL_SHAPE.test(email.trim())) return;
    invite.mutate();
  };

  const activeMembers = (members ?? []).filter((m) => !m.revokedAt);
  const openInvitations = (invitations ?? []).filter((i) => !i.acceptedAt && !i.revokedAt);
  const settledInvitations = (invitations ?? []).filter((i) => i.acceptedAt || i.revokedAt);

  return (
    <DashboardShell title="Deltagare">
      <div data-guide="deltagarvyn" className="mx-auto max-w-3xl space-y-8">
        <header>
          <h2 className="text-2xl font-semibold text-foreground">Deltagare</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Vilka som ser ärendet, och med vilken behörighet.
          </p>
        </header>

        {caseLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-accent" aria-hidden="true" />
        ) : !caseRecord ? (
          <div className="rounded-md border border-border bg-card p-5">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Det finns inget ärende än att bjuda in till.{" "}
              <Link to="/wizard" className="font-medium text-accent underline">
                Gör utvärderingen
              </Link>{" "}
              så skapas ärendet, och sedan kan styrelse, revisor och rådgivare
              bjudas in hit.
            </p>
          </div>
        ) : (
          <>
            {/* Medlemmarna */}
            <section aria-labelledby="members-heading">
              <h2
                id="members-heading"
                className="flex items-center gap-2 text-lg font-semibold text-foreground"
              >
                <Users className="h-5 w-5 text-accent" aria-hidden="true" />
                I ärendet
              </h2>
              <ul className="mt-3 space-y-2">
                {activeMembers.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-col gap-2 rounded-md border border-border bg-card p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-x-4"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">
                        {member.displayName || member.email || "Utan namn"}
                      </p>
                      {member.email && member.displayName && (
                        <p className="truncate text-xs text-muted-foreground">{member.email}</p>
                      )}
                    </div>
                    <div className="min-w-0 sm:max-w-[16rem] sm:text-right">
                      <p className="text-sm font-medium text-foreground">
                        {CASE_ROLE_LABELS[member.role]}
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {CASE_ROLE_DESCRIPTIONS[member.role]}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            {/* Öppna inbjudningar */}
            {openInvitations.length > 0 && (
              <section aria-labelledby="invitations-heading">
                <h2
                  id="invitations-heading"
                  className="flex items-center gap-2 text-lg font-semibold text-foreground"
                >
                  <Mail className="h-5 w-5 text-accent" aria-hidden="true" />
                  Väntar på svar
                </h2>
                <ul className="mt-3 space-y-2">
                  {openInvitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border p-4"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {CASE_ROLE_LABELS[invitation.role]} · bjöds in{" "}
                          {swedishDate(invitation.createdAt)} · gäller till{" "}
                          {swedishDate(invitation.expiresAt)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(invitation.id)}
                        aria-label={`Återkalla inbjudan till ${invitation.email}`}
                      >
                        <X className="h-4 w-4" aria-hidden="true" />
                        Återkalla
                      </Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Bjud in. Betalväggen: delning med externa aktiveras efter
                första betalningen - deltagarlistan och allt arbete finns
                kvar oavsett. */}
            {!inviteEntitled ? (
              <LockedFeature title="Bjud in revisor, jurist och styrelse till ärendet" />
            ) : (
            <section
              aria-labelledby="invite-heading"
              className="rounded-md border border-border bg-card p-5"
            >
              <h2
                id="invite-heading"
                className="flex items-center gap-2 text-lg font-semibold text-foreground"
              >
                <UserPlus className="h-5 w-5 text-accent" aria-hidden="true" />
                Bjud in
              </h2>
              <form onSubmit={submit} className="mt-4 space-y-4">
                <div>
                  <label htmlFor="invite-email" className="text-sm font-medium text-foreground">
                    E-postadress
                  </label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="namn@bolaget.se"
                    className="mt-1"
                  />
                  {/* Kollega-genvägen: byråns team ett klick bort. Teamet
                      ger ingen automatisk åtkomst - genvägen fyller bara i
                      adressen, inbjudan är fortfarande per ärende. */}
                  <TeamQuickPick current={email} onPick={setEmail} />
                </div>
                <fieldset>
                  <legend className="text-sm font-medium text-foreground">
                    Roll – väljer vad personen kan se och göra
                  </legend>
                  <div className="mt-2 space-y-1.5">
                    {INVITABLE_ROLES.map((option) => (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                          role === option
                            ? "border-accent bg-accent/5"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="invite-role"
                          value={option}
                          checked={role === option}
                          onChange={() => setRole(option)}
                          className="mt-1 h-4 w-4 accent-accent"
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-foreground">
                            {CASE_ROLE_LABELS[option]}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {CASE_ROLE_DESCRIPTIONS[option]}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Button
                  type="submit"
                  disabled={!EMAIL_SHAPE.test(email.trim()) || invite.isPending}
                >
                  {invite.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    "Skicka inbjudan"
                  )}
                </Button>
                {invite.isError && (
                  <p className="text-sm text-destructive" role="alert">
                    {invite.error instanceof Error
                      ? invite.error.message
                      : "Kunde inte skicka inbjudan. Försök igen."}
                  </p>
                )}
              </form>
              <p className="mt-4 flex items-start gap-2 rounded-md bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                <ShieldQuestion className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                <span>
                  Inbjudan mejlas och blir medlemskap först när mottagaren loggar
                  in med exakt den här adressen – en vidarebefordrad länk ger
                  ingen åtkomst. Borgenärer kan inte bjudas in till ärendet: de
                  ser aldrig mer än sin egen fordran, oavsett roll och misstag.
                </span>
              </p>
            </section>
            )}

            {/* Vägen till NY kompetens: katalogen. Menyvalet "Rådgivare"
                flyttade hit i Excellence rond 2 - att hitta en rådgivare är
                en del av att bemanna ärendet, inte en egen arbetsyta. */}
            <Link
              to="/marketplace"
              className="flex items-center gap-4 rounded-md border border-border bg-card p-5 shadow-soft transition-colors hover:border-accent/50"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md bg-accent/10">
                <Users className="h-5 w-5 text-accent" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-foreground">Hitta rådgivare</h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Sök rekonstruktörer, jurister och revisorer på område och
                  region – och skicka en förfrågan med ditt underlag.
                </p>
              </div>
              <ArrowRight className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>

            {/* Live ärendelänken - också delning, alltså bakom samma
                betalvägg som inbjudningarna. */}
            {inviteEntitled ? (
              <ShareLinksSection caseId={caseRecord.id} />
            ) : (
              <LockedFeature title="Live ärendelänk till bank och finansiär" />
            )}

            {/* Delningen med rådgivare: full insyn i vem som kontaktats,
                vad de ser och när samtycket gavs. Ingen rad utan samtycke -
                det är databasens regel, det här är fönstret mot den. */}
            <SharesSection caseId={caseRecord.id} />

            {/* Historik */}
            {settledInvitations.length > 0 && (
              <section aria-label="Tidigare inbjudningar">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Tidigare inbjudningar
                </h3>
                <ul className="mt-2 space-y-1">
                  {settledInvitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex flex-wrap gap-x-3 px-1 py-1 text-xs text-muted-foreground"
                    >
                      <span className="min-w-0 flex-1">{invitation.email}</span>
                      <span>
                        {invitation.acceptedAt
                          ? `tackade ja ${swedishDate(invitation.acceptedAt)}`
                          : `återkallad ${swedishDate(invitation.revokedAt as string)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
};

export default DashboardParticipants;
