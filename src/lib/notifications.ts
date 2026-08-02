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
      href: "/dashboard",
    });
  } else if (input.crisis?.urgency === "weeks") {
    items.push({
      id: "laget-veckor",
      tone: "warning",
      title: "Läget kräver åtgärder inom veckor",
      body: `Systemanalysen bedömer: ${input.crisis.title}.`,
      href: "/dashboard",
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
        href: "/dashboard",
      });
    } else if (countdown.tone === "today") {
      nearFrist = true;
      items.push({
        id: `frist-idag-${event.iso}-${event.label}`,
        tone: "critical",
        title: `Förfaller idag: ${event.label.toLowerCase()}`,
        body: "Sista dagen att agera eller dokumentera beslutet.",
        href: "/dashboard",
      });
    } else if (countdown.daysLeft <= 3) {
      nearFrist = true;
      items.push({
        id: `frist-snart-${event.iso}-${event.label}`,
        tone: "warning",
        title: `${event.label} ${countdown.label}`,
        body: "Planera åtgärden nu - handlingsutrymmet krymper med datumet.",
        href: "/dashboard",
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
        href: "/dashboard",
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
