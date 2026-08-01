import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { data } from "@/data";
import {
  CASE_ROLE_DESCRIPTIONS,
  CASE_ROLE_LABELS,
  INVITABLE_ROLES,
  type CaseRole,
} from "@/lib/caseRoles";
import { Loader2, Mail, ShieldQuestion, UserPlus, Users, X } from "lucide-react";

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

const DashboardParticipants = () => {
  const queryClient = useQueryClient();
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
      <div className="mx-auto max-w-3xl space-y-8">
        <header>
          <h1 className="text-2xl font-semibold text-foreground">Deltagare</h1>
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
                    className="flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md border border-border bg-card p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground">
                        {member.displayName || member.email || "Utan namn"}
                      </p>
                      {member.email && member.displayName && (
                        <p className="text-xs text-muted-foreground">{member.email}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-foreground">
                        {CASE_ROLE_LABELS[member.role]}
                      </p>
                      <p className="max-w-xs text-xs text-muted-foreground">
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

            {/* Bjud in */}
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
