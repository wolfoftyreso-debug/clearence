/**
 * Notiscentret: allt som väntar på användaren, från alla källor.
 *
 * Klockan visade tidigare bara taggade meddelanden - och kunde därmed säga
 * "inget väntar på dig" bredvid en systemanalys som visade kritiskt läge.
 * En notisklocka som inte känner till fristerna är värre än ingen klocka:
 * den lär användaren att tystnad betyder lugn.
 *
 * Aggregatorn är deterministisk och rangordnar efter allvar: passerade
 * frister först, sedan dagens, sedan taggar, sedan händelser och
 * driftlarm. Varje notis pekar dit saken hanteras.
 */

import { countdownTo } from "@/lib/actionPlan";
import type { CaseInvitationRecord, CaseRecord, KbrStatus, OpenMention, OutboundEmailRecord } from "@/data/types";
import type { TimelineEvent, Urgency } from "@/lib/crisisAnalysis";

export interface NotificationItem {
  id: string;
  tone: "critical" | "warning" | "info";
  title: string;
  body: string;
  href: string;
}

export interface NotificationInput {
  caseRecord: CaseRecord | null;
  /**
   * Systemanalysens bedömning av ärendet. Utan den kan klockan stå tom
   * bredvid ett kritiskt läge - fristerna kan ligga veckor bort samtidigt
   * som läget i sig kräver beslut i dag.
   */
  crisis: { urgency: Urgency; title: string } | null;
  timeline: TimelineEvent[];
  mentions: OpenMention[];
  invitations: CaseInvitationRecord[];
  /** Öppna uppgifter i ärendet som är delegerade till den inloggade. */
  assignedOpenTasks?: number;
  kbr: { status: KbrStatus; createdAt: string } | null;
  /** Endast för driftadministratörer; annars tomma. */
  failedEmails: OutboundEmailRecord[];
  pendingApplications: number;
  newContactMessages: number;
  pendingProfileClaims: number;
  now: Date;
}

const TONE_ORDER = { critical: 0, warning: 1, info: 2 } as const;

export const buildNotifications = (input: NotificationInput): NotificationItem[] => {
  const items: NotificationItem[] = [];
  const { now } = input;

  // Ärendets läge enligt systemanalysen. "Månader" är planeringshorisont
  // och larmar inte - klockan ska peka på det som kräver något nu.
  if (input.crisis?.urgency === "immediate") {
    items.push({
      id: "laget-akut",
      tone: "critical",
      title: "Läget kräver omedelbara åtgärder",
      body: `Systemanalysen bedömer: ${input.crisis.title}.`,
      href: "/dashboard#systemanalys",
    });
  } else if (input.crisis?.urgency === "weeks") {
    items.push({
      id: "laget-veckor",
      tone: "warning",
      title: "Läget kräver åtgärder inom veckor",
      body: `Systemanalysen bedömer: ${input.crisis.title}.`,
      href: "/dashboard#systemanalys",
    });
  }

  // Fristerna: passerade och nära.
  let nearFrist = false;
  for (const event of input.timeline) {
    const countdown = countdownTo(event.iso, now);
    if (countdown.tone === "passed") {
      nearFrist = true;
      items.push({
        id: `frist-passerad-${event.iso}-${event.label}`,
        tone: "critical",
        title: `Passerad frist: ${event.label.toLowerCase()}`,
        body: `Datumet passerade ${countdown.label} utan registrerad åtgärd.`,
        href: "/dashboard#frister",
      });
    } else if (countdown.tone === "today") {
      nearFrist = true;
      items.push({
        id: `frist-idag-${event.iso}-${event.label}`,
        tone: "critical",
        title: `Förfaller idag: ${event.label.toLowerCase()}`,
        body: "Sista dagen att agera eller dokumentera beslutet.",
        href: "/dashboard#frister",
      });
    } else if (countdown.daysLeft <= 3) {
      nearFrist = true;
      items.push({
        id: `frist-snart-${event.iso}-${event.label}`,
        tone: "warning",
        title: `${event.label} ${countdown.label}`,
        body: "Planera åtgärden nu - handlingsutrymmet krymper med datumet.",
        href: "/dashboard#frister",
      });
    }
  }

  // Inget nära? Då pekar klockan ändå ut nästa bevakade frist, så att
  // "inga notiser" aldrig kan misstas för "inga frister".
  if (!nearFrist) {
    const upcoming = input.timeline
      .map((event) => ({ event, countdown: countdownTo(event.iso, now) }))
      .filter(({ countdown }) => countdown.tone !== "passed" && countdown.daysLeft > 3)
      .sort((a, b) => a.countdown.daysLeft - b.countdown.daysLeft)[0];
    if (upcoming) {
      items.push({
        id: `frist-nasta-${upcoming.event.iso}-${upcoming.event.label}`,
        tone: "info",
        title: `Nästa frist: ${upcoming.event.label.toLowerCase()} ${upcoming.countdown.label}`,
        body: "Bevakas i tidslinjen - inget kräver åtgärd i dag.",
        href: "/dashboard#frister",
      });
    }
  }

  // KBR-läget.
  if (input.kbr && (input.kbr.status === "required" || input.kbr.status === "critical")) {
    items.push({
      id: "kbr-laget",
      tone: "critical",
      title: input.kbr.status === "critical" ? "Kontrollbalans: kritisk" : "Kontrollbalansräkning krävs",
      body: "Bedömningen visar kapitalbrist. Protokollför styrelsens beslut och följ stämmospåret.",
      href: "/kbr",
    });
  }

  // Uppgifter delegerade till den inloggade. Samma kategori som taggarna:
  // det är samarbetets "du är efterfrågad", inte ärendets läge.
  if ((input.assignedOpenTasks ?? 0) > 0) {
    const n = input.assignedOpenTasks!;
    items.push({
      id: "mention-uppgifter-tilldelade",
      tone: "warning",
      title: n === 1 ? "En uppgift är tilldelad dig" : `${n} uppgifter är tilldelade dig`,
      body: "Öppna handlingsplanen och bocka av när de är gjorda.",
      href: "/dashboard#frister",
    });
  }

  // Taggade meddelanden.
  for (const mention of input.mentions) {
    items.push({
      id: `mention-${mention.messageId}`,
      tone: "warning",
      title: `${mention.authorName ?? "Någon"} väntar på ditt svar`,
      body: mention.conversationTitle ? `I ${mention.conversationTitle}: ${mention.body}` : mention.body,
      href: "/dashboard/meddelanden",
    });
  }

  // Inbjudningar som fått svar senaste veckan.
  for (const invitation of input.invitations) {
    if (!invitation.acceptedAt) continue;
    const days = (now.getTime() - new Date(invitation.acceptedAt).getTime()) / 86_400_000;
    if (days <= 7) {
      items.push({
        id: `invit-accept-${invitation.id}`,
        tone: "info",
        title: `${invitation.email} tackade ja`,
        body: "Deltagaren är nu inne i ärendet och ser samma underlag som du.",
        href: "/dashboard/deltagare",
      });
    }
  }

  // Driftlarm - bara för administratörer, listorna är annars tomma.
  if (input.failedEmails.length > 0) {
    items.push({
      id: "drift-utskick",
      tone: "critical",
      title: `${input.failedEmails.length} utskick har misslyckats`,
      body: "Mejl som inte gått fram väntar på omskick i driftvyn.",
      href: "/admin/kunder",
    });
  }
  if (input.newContactMessages > 0) {
    items.push({
      id: "drift-inkorg",
      tone: "warning",
      title: `${input.newContactMessages} nya meddelanden i inkorgen`,
      body: "Någon har hört av sig via kontaktformuläret.",
      href: "/admin/inkorg",
    });
  }
  if (input.pendingApplications > 0) {
    items.push({
      id: "drift-ansokningar",
      tone: "info",
      title: `${input.pendingApplications} rådgivare väntar på besked`,
      body: "Ansökningar att granska i driftvyn.",
      href: "/admin/ansokningar",
    });
  }
  if (input.pendingProfileClaims > 0) {
    items.push({
      id: "drift-anspråk",
      tone: "info",
      title: `${input.pendingProfileClaims} profilanspråk att granska`,
      body: "Någon säger sig företräda en förifylld katalogprofil.",
      href: "/admin",
    });
  }

  return items.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
};

/* --- notisinställningar ---------------------------------------------------- */

/**
 * Vilka källor klockan visar - ett val per enhet, sparat lokalt. Frister
 * och ärendets läge går INTE att stänga av: en notisklocka som kan tystas
 * om det juridiskt kritiska vore ett sämre löfte än ingen klocka alls.
 * Det som går att välja bort är det sociala och driften.
 */
export type NotificationCategory = "läge" | "samarbete" | "drift";

export const OPTIONAL_CATEGORIES: { id: Exclude<NotificationCategory, "läge">; label: string; description: string }[] = [
  {
    id: "samarbete",
    label: "Meddelanden och deltagare",
    description: "Taggade meddelanden som väntar på ditt svar och deltagare som tackat ja.",
  },
  {
    id: "drift",
    label: "Driftlarm",
    description: "Misslyckade utskick, ny inkorg, ansökningar och profilanspråk. Gäller bara administratörer.",
  },
];

export const categoryOf = (id: string): NotificationCategory => {
  if (id.startsWith("mention-") || id.startsWith("invit-")) return "samarbete";
  if (id.startsWith("drift-")) return "drift";
  return "läge";
};

const PREFS_KEY = "clearance-notification-prefs";

export const getNotificationPrefs = (): Record<NotificationCategory, boolean> => {
  const all: Record<NotificationCategory, boolean> = { läge: true, samarbete: true, drift: true };
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Record<NotificationCategory, boolean>>;
      for (const category of ["samarbete", "drift"] as const) {
        if (parsed[category] === false) all[category] = false;
      }
    }
  } catch {
    /* utan lagring: allt på */
  }
  return all;
};

export const setNotificationPref = (category: Exclude<NotificationCategory, "läge">, enabled: boolean): void => {
  try {
    const prefs = getNotificationPrefs();
    prefs[category] = enabled;
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    window.dispatchEvent(new CustomEvent("clearance-notification-prefs"));
  } catch {
    /* utan lagring går valet inte att spara */
  }
};

export const filterNotifications = (
  items: NotificationItem[],
  prefs: Record<NotificationCategory, boolean> = getNotificationPrefs(),
): NotificationItem[] => items.filter((item) => prefs[categoryOf(item.id)]);
