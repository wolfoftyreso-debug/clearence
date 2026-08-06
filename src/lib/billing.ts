/**
 * Kontots livscykel.
 *
 * Beslutad modell: det är gratis att komma igång. Betalar kunden inte inom en
 * vecka stängs kontot.
 *
 * Jag invände mot den en gång, den bekräftades, och då är den bestämd. Det
 * som återstår är att bygga den så att den gör vad den ska och inte något
 * värre. Två saker följer av det, och båda sitter i koden här:
 *
 *  1. **Stängt betyder utestängd, inte raderad.** Att stänga av åtkomsten
 *     driver in betalningen lika bra som att förstöra materialet, och det
 *     senare går inte att ångra. Ett bolag mitt i en rekonstruktion har sin
 *     likviditetsplan och sina kontoutdrag här; blir de borta finns de ofta
 *     inte någon annanstans heller. Gallring är en separat, medveten åtgärd.
 *
 *  2. **Ingen blir stängd utan att ha sett det komma.** Varningen börjar tre
 *     dagar före och räknar ned varje dag. En avstängning som kommer som en
 *     överraskning läser användaren som ett fel i tjänsten, inte som en
 *     obetald faktura, och då ringer de supporten i stället för att betala.
 *
 * Alla beräkningar är rena funktioner på datum. Ingen `Date.now()` inuti -
 * anropspunkten skickar in "nu", så att testerna kan resa vilken dag som
 * helst.
 */

export type AccountStatus =
  /** Gratisperioden löper. */
  | "trial"
  /** Fakturan är skickad och förfallodagen har inte passerat. */
  | "invoiced"
  /**
   * Förfallodagen har passerat men ingen har stängt kontot ännu.
   * Innehållet är låst; stängningen är fortfarande en åtgärd som återstår.
   */
  | "overdue"
  /** Stängt av jobbet eller för hand - `closedAt` är satt. */
  | "closed"
  /** Betalt och i drift. */
  | "active";

/** Gratisperioden, i dagar. */
export const TRIAL_DAYS = 7;

/** Så många dagar före stängning varningen börjar. */
export const WARNING_DAYS = 3;

export interface AccountBilling {
  /** När kontot skapades. ISO. */
  startedAt: string;
  /**
   * Sista dag att betala. ISO. Sätts när första fakturan skapas; är den null
   * löper gratisperioden fortfarande.
   */
  dueAt: string | null;
  /** När betalningen registrerades. ISO, eller null. */
  paidAt: string | null;
  /** Satt när kontot faktiskt stängdes, av jobbet eller för hand. ISO. */
  closedAt: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Hela dagar från `from` till `to`. Negativt när `to` redan passerat.
 *
 * Muterar inte argumenten. Slutet av måldagen används som referens, så att
 * "förfaller idag" ger 0 och inte -1 - en avstängning klockan 09:00 på
 * förfallodagen vore att ta en hel dag från någon som betalar på kvällen.
 */
export const daysBetween = (from: Date, to: Date): number => {
  const endOfTarget = new Date(to);
  endOfTarget.setHours(23, 59, 59, 999);
  return Math.ceil((endOfTarget.getTime() - from.getTime()) / DAY_MS) - 1;
};

/** Sista dagen på gratisperioden. */
export const trialEndsAt = (startedAt: string): Date =>
  new Date(new Date(startedAt).getTime() + TRIAL_DAYS * DAY_MS);

export interface BillingState {
  status: AccountStatus;
  /** Dagar kvar till stängning. Negativt när fristen gått ut. Null när inget hotar. */
  daysLeft: number | null;
  /** Datumet som räknas ned mot, ISO. Null när inget hotar. */
  deadline: string | null;
  /** Sant när gränssnittet ska varna. */
  shouldWarn: boolean;
  /** Sant när innehållet ska vara låst. */
  isLocked: boolean;
}

/**
 * Var kontot står en given dag.
 *
 * Ordningen på kontrollerna är inte godtycklig: betalt slår allt, och ett
 * uttryckligen stängt konto slår datumen. Ett konto som betalats efter
 * stängning ska öppnas igen, inte fortsätta vara stängt för att ett fält
 * ligger kvar.
 */
export const billingState = (billing: AccountBilling, now: Date): BillingState => {
  if (billing.paidAt) {
    return { status: "active", daysLeft: null, deadline: null, shouldWarn: false, isLocked: false };
  }

  if (billing.closedAt && new Date(billing.closedAt) <= now) {
    return {
      status: "closed",
      daysLeft: null,
      deadline: billing.closedAt,
      shouldWarn: true,
      isLocked: true,
    };
  }

  // Ingen förfallodag satt: gratisperioden löper, och den är i sig
  // nedräkningen.
  const deadline = billing.dueAt ? new Date(billing.dueAt) : trialEndsAt(billing.startedAt);
  const daysLeft = daysBetween(new Date(now), new Date(deadline));

  if (daysLeft < 0) {
    /*
     * Förfallen, men INTE stängd.
     *
     * Stängningen är en åtgärd någon vidtar - stängningsjobbet, eller drift
     * för hand - och den syns som `closedAt`. Fram till dess är kontot
     * förfallet, inte stängt.
     *
     * Skillnaden är inte akademisk. Vyn skrev tidigare "Kontot är stängt"
     * i samma sekund som förfallodagen passerade, innan något faktiskt
     * hänt: ett påstående om en åtgärd som ingen hade vidtagit. Den som
     * betalade samma kväll fick veta att kontot var stängt när det inte
     * var det.
     *
     * Låsningen ligger kvar oförändrad - det är beslutat att åtkomsten
     * upphör vid förfallodagen. Det som ändras är vad användaren får läsa.
     */
    return {
      status: "overdue",
      daysLeft,
      deadline: deadline.toISOString(),
      shouldWarn: true,
      isLocked: true,
    };
  }

  return {
    status: billing.dueAt ? "invoiced" : "trial",
    daysLeft,
    deadline: deadline.toISOString(),
    shouldWarn: daysLeft <= WARNING_DAYS,
    isLocked: false,
  };
};

/**
 * Vad användaren ska läsa. Formuleringarna hör ihop med tillståndet och ska
 * inte skrivas om lokalt i varje vy - då säger två sidor olika saker om samma
 * konto, vilket är exakt vad som får någon att ringa i stället för att betala.
 */
export const billingMessage = (
  state: BillingState,
): { title: string; body: string; tone: "info" | "warning" | "critical" } | null => {
  switch (state.status) {
    case "active":
      return null;

    case "trial":
      if (!state.shouldWarn) return null;
      return {
        title:
          state.daysLeft === 0
            ? "Sista dagen på din gratisperiod"
            : `${state.daysLeft} dagar kvar av gratisperioden`,
        body: "När den tar slut skickar vi en faktura. Betalar du den behåller du åtkomsten utan avbrott.",
        tone: "warning",
      };

    case "invoiced":
      if (!state.shouldWarn) return null;
      return {
        title:
          state.daysLeft === 0
            ? "Fakturan förfaller idag"
            : `Fakturan förfaller om ${state.daysLeft} dagar`,
        body: "Kommer ingen betalning in stängs kontot. Ditt material ligger kvar och blir tillgängligt igen när betalningen registreras.",
        tone: "warning",
      };

    case "overdue":
      return {
        title: "Fakturan är förfallen",
        body: "Åtkomsten är pausad tills betalningen registreras. Ditt material finns kvar – vi raderar ingenting.",
        tone: "critical",
      };

    case "closed":
      return {
        title: "Kontot är stängt",
        body: "Vi har inte fått in betalningen. Ditt material finns kvar och blir tillgängligt igen så snart betalningen registreras – vi raderar ingenting.",
        tone: "critical",
      };
  }
};
