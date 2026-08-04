/**
 * AVISERINGSTJÄNSTEN: händelser, kanaler och regler.
 *
 * Den befintliga notiscentret (src/lib/notifications.ts) HÄRLEDER sitt
 * innehåll ur nuläget vid varje rendering. Det är rätt för en klocka i
 * appen - klockan ska visa det som gäller nu, och nuläget är sanningen.
 *
 * Men det går inte att skicka på. Ett SMS är oåterkalleligt: skickas det
 * två gånger har mottagaren fått två, och en produkt som tjatar mitt i en
 * kris blir avstängd. Därför är en AVISERING något annat än en notis: den
 * har en identitet, och identiteten är det som gör att den skickas exakt
 * en gång.
 *
 * Identiteten är `dedupeKey` nedan. Den byggs av vad händelsen gäller -
 * inte av när den upptäcktes - så att samma upptäckt gjord tio gånger
 * ger en avisering.
 *
 * Kanalerna är utbytbara med flit. SMS är den första betalda kanalen,
 * men reglerna i den här filen känner inte till någon leverantör: de
 * säger VAD som ska skickas och TILL VEM, och lämnar HUR till
 * arbetaren. Push kan läggas till utan att en enda regel skrivs om.
 */

/**
 * Raden i integration_secrets som bär SMS-nyckeln.
 *
 * Den står HÄR och ingen annanstans. Driftpanelen behöver den för att
 * kunna spara nyckeln, arbetaren för att kunna läsa den - och en sträng
 * som skrivs av på två ställen glider isär den dag leverantören byts.
 * tests/notificationService.ts faller om namnet dyker upp någon
 * annanstans i källkoden.
 */
export const SMS_SECRET_PROVIDER = "46elks";

/* --- Kanalerna ------------------------------------------------------------ */

export type Channel = "inapp" | "email" | "sms" | "push";

export interface ChannelSpec {
  id: Channel;
  label: string;
  /** Kort beskrivning för inställningssidan. */
  description: string;
  /**
   * Kanaler som ännu inte är i drift står som `false` och går inte att
   * välja. Att visa ett val som inte gör något är att ljuga tyst.
   */
  live: boolean;
}

export const CHANNELS: readonly ChannelSpec[] = [
  {
    id: "inapp",
    label: "I appen",
    description: "Klockan i menyn. Alltid på, för alla nivåer.",
    live: true,
  },
  {
    id: "email",
    label: "E-post",
    description: "Ett mejl till adressen du loggar in med.",
    live: true,
  },
  {
    id: "sms",
    label: "SMS",
    description: "Ett kort meddelande till din mobil, så du slipper logga in för att veta läget.",
    live: true,
  },
  {
    id: "push",
    label: "Push",
    description: "Notis i mobilappen. Finns inte än - appen är inte släppt.",
    live: false,
  },
];

export const channelSpec = (id: Channel): ChannelSpec =>
  CHANNELS.find((c) => c.id === id) ?? CHANNELS[0];

/* --- Händelserna ---------------------------------------------------------- */

/**
 * Hur brådskande händelsen är. Ordningen är inte kosmetisk - den styr
 * både vilka nivåer som får den och om den bryter tyst tid.
 */
export type Severity = "tidskritisk" | "atgard" | "information";

export type EventKind =
  /** En frist närmar sig. Tiden går oavsett vad användaren gör. */
  | "frist-narmar-sig"
  /** Ärendet kräver något av användaren för att komma vidare. */
  | "atgard-kravs"
  /** Systemanalysen har räknat om läget. */
  | "analys-klar"
  /** En handling har fått ett granskningsbeslut. */
  | "dokument-granskat"
  /** En rådgivare har skrivit i ärendet. */
  | "radgivare-kommenterat"
  /** Ärendet har bytt status. */
  | "arende-status"
  /** Processen har gått vidare till nästa steg. */
  | "steg-framat";

export interface EventSpec {
  kind: EventKind;
  severity: Severity;
  /** Vad raden heter i inställningarna och i journalen. */
  label: string;
}

export const EVENTS: readonly EventSpec[] = [
  { kind: "frist-narmar-sig", severity: "tidskritisk", label: "En tidsfrist närmar sig" },
  { kind: "atgard-kravs", severity: "atgard", label: "Något kräver din åtgärd" },
  { kind: "dokument-granskat", severity: "atgard", label: "En handling har granskats" },
  { kind: "radgivare-kommenterat", severity: "atgard", label: "En rådgivare har kommenterat" },
  { kind: "analys-klar", severity: "information", label: "En ny analys är klar" },
  { kind: "arende-status", severity: "information", label: "Ärendet har bytt status" },
  { kind: "steg-framat", severity: "information", label: "Processen har gått vidare" },
];

export const eventSpec = (kind: EventKind): EventSpec | null =>
  EVENTS.find((e) => e.kind === kind) ?? null;

export const severityOf = (kind: EventKind): Severity | null => eventSpec(kind)?.severity ?? null;

/* --- Användarens val ------------------------------------------------------ */

/**
 * De tre nivåerna. Fler val hade gett användaren mer kontroll på pappret
 * och mindre i praktiken: den som är mitt i en kris orkar inte kryssa i
 * sju rutor, och en inställningssida ingen orkar fylla i blir kvar på
 * förvalet.
 */
export type Level = "alla" | "atgard" | "tidskritiska";

export const LEVELS: readonly { id: Level; label: string; description: string }[] = [
  {
    id: "alla",
    label: "Alla viktiga händelser",
    description: "Även när något gått framåt av sig självt och inget krävs av dig.",
  },
  {
    id: "atgard",
    label: "Bara när något krävs av dig",
    description: "Frister, åtgärder, granskningsbeslut och kommentarer från rådgivare.",
  },
  {
    id: "tidskritiska",
    label: "Bara det tidskritiska",
    description: "Endast frister som närmar sig. Det minsta som går att välja.",
  },
];

/** Vilka allvarlighetsgrader varje nivå släpper igenom. */
const LEVEL_LETS_THROUGH: Record<Level, readonly Severity[]> = {
  alla: ["tidskritisk", "atgard", "information"],
  atgard: ["tidskritisk", "atgard"],
  tidskritiska: ["tidskritisk"],
};

export const levelAllows = (level: Level, kind: EventKind): boolean => {
  const severity = severityOf(kind);
  if (!severity) return false;
  return LEVEL_LETS_THROUGH[level].includes(severity);
};

/* --- Plangränsen ---------------------------------------------------------- */

/**
 * SMS är en betald kanal. Klockan i appen är det aldrig - att ta betalt
 * för att få veta att ens eget ärende ändrats vore att ta betalt för
 * produkten två gånger.
 *
 * Nivåerna heter Start, Standard, Business och Enterprise
 * (src/lib/pricing.ts). SMS bor i Business och uppåt, samma plats som
 * ekonomisystemskopplingen.
 */
export type PlanId = "start" | "standard" | "business" | "enterprise";

const PAID_SMS_PLANS: readonly PlanId[] = ["business", "enterprise"];

export const channelInPlan = (channel: Channel, plan: PlanId): boolean => {
  if (channel === "inapp") return true;
  if (channel === "email") return plan !== "start";
  if (channel === "sms") return PAID_SMS_PLANS.includes(plan);
  return false; // push: inte i drift
};

/** Texten som förklarar varför kanalen är låst, och vad som öppnar den. */
export const planGateReason = (channel: Channel, plan: PlanId): string | null => {
  if (channelInPlan(channel, plan)) return null;
  if (channel === "push") return "Push finns inte än. Mobilappen är inte släppt.";
  if (channel === "sms") {
    return "SMS ingår i Clearance Business och Enterprise. På din nivå finns klockan i appen och e-post.";
  }
  if (channel === "email") return "E-postaviseringar ingår från Clearance Standard.";
  return null;
};

/* --- Tyst tid ------------------------------------------------------------- */

/**
 * Ingen ska väckas 03:00 av att en handling blivit granskad.
 *
 * Men en frist som löper ut är inte samma sak som en granskning: den
 * tidskritiska händelsen BRYTER tyst tid, för alternativet är att
 * användaren sover genom det enda vi finns till för att förhindra. Det
 * är ett medvetet undantag och det står i inställningarna, så att ingen
 * blir överrumplad av det.
 *
 * Timmarna är halvöppna: start 21, slut 7 betyder 21:00-06:59.
 */
export interface QuietHours {
  /** Timme 0-23 när tystnaden börjar. */
  startHour: number;
  /** Timme 0-23 när den slutar. */
  endHour: number;
}

export const DEFAULT_QUIET_HOURS: QuietHours = { startHour: 21, endHour: 7 };

export const inQuietHours = (hour: number, quiet: QuietHours): boolean => {
  const { startHour: start, endHour: end } = quiet;
  if (start === end) return false; // ingen tyst tid alls
  // Passerar midnatt: 21 -> 7 är kvällen ELLER morgonen.
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
};

/**
 * Timmen hos mottagaren.
 *
 * Ingen tidszon lagras per användare, och produkten säljs i Sverige, så
 * Europe/Stockholm är antagandet. Det är ett ANTAGANDE och inte en
 * sanning: den som driver ett svenskt bolag från Spanien får sin tysta
 * tid enligt svensk klocka. Dagen vi säljer utanför Sverige behöver
 * notification_prefs en tidszonskolumn - och då byts den här funktionen,
 * inte reglerna omkring den.
 */
export const localHour = (at: Date, timeZone = "Europe/Stockholm"): number =>
  Number(
    new Intl.DateTimeFormat("sv-SE", { hour: "2-digit", hour12: false, timeZone }).format(at),
  ) % 24;

/**
 * När tystnaden tar slut. Används för att SKJUTA UPP i stället för att
 * slänga: ett besked som kommer 07:00 är fortfarande användbart.
 */
export const nextQuietEnd = (at: Date, quiet: QuietHours, timeZone = "Europe/Stockholm"): Date => {
  const hour = localHour(at, timeZone);
  if (!inQuietHours(hour, quiet)) return at;
  // Hur många timmar kvar till slutet, moduloräknat över midnatt.
  const hoursLeft = (quiet.endHour - hour + 24) % 24 || 24;
  const out = new Date(at.getTime() + hoursLeft * 3_600_000);
  // Ned till hel timme: ett besked 07:00 är begripligare än 07:43, och
  // exakthet på minuten betyder ingenting för den som sovit.
  out.setUTCMinutes(0, 0, 0);
  return out;
};

/* --- Beslutet ------------------------------------------------------------- */

export interface DeliveryDecision {
  /** Skickas den? */
  send: boolean;
  /**
   * Varför inte, när den inte skickas. Sparas på leveransraden så att
   * frågan "varför fick jag inget SMS" går att besvara utan gissningar.
   */
  reason:
    | null
    | "kanal-avstangd"
    | "utanfor-niva"
    | "ingar-inte-i-planen"
    | "tyst-tid"
    | "saknar-verifierat-nummer"
    | "kanalen-ar-inte-i-drift";
}

export interface DeliveryContext {
  kind: EventKind;
  channel: Channel;
  level: Level;
  plan: PlanId;
  /** Kanaler användaren stängt av helt. */
  enabledChannels: readonly Channel[];
  quiet: QuietHours;
  /** Lokal timme hos mottagaren, 0-23. */
  hour: number;
  /** Bara meningsfullt för SMS. */
  hasVerifiedPhone: boolean;
}

/**
 * En (1) funktion avgör om en avisering går ut. Att sprida ut villkoren
 * över arbetare, databas och gränssnitt hade gett tre halvregler som
 * hinner glida isär - och den som frågar "varför fick jag inget" hade
 * fått tre olika svar.
 */
export const decideDelivery = (ctx: DeliveryContext): DeliveryDecision => {
  const no = (reason: NonNullable<DeliveryDecision["reason"]>): DeliveryDecision => ({
    send: false,
    reason,
  });

  if (!channelSpec(ctx.channel).live) return no("kanalen-ar-inte-i-drift");
  if (!channelInPlan(ctx.channel, ctx.plan)) return no("ingar-inte-i-planen");

  // Klockan i appen är inte ett utskick: den kan inte väcka någon, och
  // den kan inte tjata. Den lyder därför varken under nivåvalet eller
  // tyst tid - allt hamnar där, och användaren läser när hen vill.
  if (ctx.channel === "inapp") return { send: true, reason: null };

  if (!ctx.enabledChannels.includes(ctx.channel)) return no("kanal-avstangd");
  if (!levelAllows(ctx.level, ctx.kind)) return no("utanfor-niva");
  if (ctx.channel === "sms" && !ctx.hasVerifiedPhone) return no("saknar-verifierat-nummer");

  // Tidskritiskt bryter tystnaden. Allt annat väntar.
  if (inQuietHours(ctx.hour, ctx.quiet) && severityOf(ctx.kind) !== "tidskritisk") {
    return no("tyst-tid");
  }

  return { send: true, reason: null };
};

/** Läsbar förklaring till ett uteblivet utskick. Visas i driftpanelen. */
export const REASON_TEXT: Record<NonNullable<DeliveryDecision["reason"]>, string> = {
  "kanal-avstangd": "Mottagaren har stängt av kanalen.",
  "utanfor-niva": "Händelsen ligger utanför mottagarens valda nivå.",
  "ingar-inte-i-planen": "Kanalen ingår inte i mottagarens abonnemang.",
  "tyst-tid": "Tyst tid. Händelsen var inte tidskritisk.",
  "saknar-verifierat-nummer": "Inget verifierat mobilnummer.",
  "kanalen-ar-inte-i-drift": "Kanalen är inte i drift.",
};
