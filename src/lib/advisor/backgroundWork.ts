/**
 * BAKGRUNDSARBETET: det som pågår medan användaren svarar.
 *
 * Poängen är att intervjun och analysen ska löpa parallellt, så att det
 * finns något färdigt när sista frågan är besvarad. Panelen visar vad
 * som pågår, ett moment i taget.
 *
 * DEN HÄR FILEN FÅR INTE LJUGA. Det är hela svårigheten. En panel som
 * radar upp "analyserar sociala medier - klart" när ingen sådan koppling
 * finns är inte en trevlig detalj, det är ett påstående om att systemet
 * vet något det inte vet - och användaren fattar beslut om sitt bolag
 * med den bilden. Varje moment bär därför en KÄLLA, och ett moment vars
 * källa inte är ansluten redovisas som just det: "Ingen källa ansluten",
 * med en not om vad som skulle krävas. Momenten står kvar i listan
 * eftersom de hör till kartan över vad tjänsten ska kunna - men de
 * markeras aldrig som gjorda.
 *
 * Formuleringen om insamlingen är användarens egen, ordagrant, och den
 * står i DISCLOSURE nedan. Den säger vad som samlas in och varifrån.
 * Motsatsen - att systemet "tar in all information den kan" - är både
 * otydlig och obehaglig, och testet i tests/onboarding.ts förbjuder den.
 */

/** Vad ett moment vilar på. */
export type BackgroundSource =
  | "foretagsregister"
  | "intervjun"
  | "analysmotorn"
  | "webb"
  | "sociala-medier"
  | "recensioner"
  | "nyheter"
  | "branschdata";

import { liveSources, sourceById } from "@/lib/sources/registry";

export type BackgroundState = "pagar" | "klar" | "ingen-kalla";

export interface BackgroundTask {
  id: string;
  label: string;
  source: BackgroundSource;
  state: BackgroundState;
  /** Vad som faktiskt kom fram, eller vad som saknas för att det ska kunna göra det. */
  note: string;
}

/**
 * Meningen som beskriver insamlingen för användaren.
 *
 * Ordagrant som den ska stå. Den säger tre saker: att informationen är
 * OFFENTLIG, att den KOMBINERAS med det användaren själv berättar, och
 * varför - träffsäkerhet. Ingen av de tre får falla bort.
 */
export const DISCLOSURE =
  "Jag samlar in relevant offentlig information om företaget och kombinerar den med det du berättar för att skapa en så träffsäker analys som möjligt.";

/**
 * Källor som faktiskt är anslutna i den här versionen.
 *
 * De tre första är interna: intervjun är användarens egna svar,
 * analysmotorn räknar på dem, och företagsregistret läses genom
 * dataporten. De YTTRE källorna kommer ur src/lib/sources/registry, så att
 * panelen inte kan påstå att något är anslutet som registret säger kräver
 * ett avtal - eller tvärtom.
 */
const CONNECTED: BackgroundSource[] = [
  "foretagsregister",
  "intervjun",
  "analysmotorn",
  ...(liveSources().map((s) => s.id) as BackgroundSource[]),
];

/**
 * Vad som saknas för de källor som inte är anslutna.
 *
 * Texten kommer ur källregistret, som är den enda platsen där det står
 * VARFÖR en källa inte är ansluten. Den gamla varianten stod skriven här,
 * och sa samma sak om alla fem: "kräver en koppling". Det är sant men
 * oanvändbart - skillnaden mellan "kräver ett avtal med Bolagsverket" och
 * "får inte hämtas alls" är precis vad den som läser behöver veta.
 */
const missingNote = (source: BackgroundSource): string => {
  const spec = sourceById(source);
  if (!spec) return "";
  return spec.needs;
};

interface Plan {
  id: string;
  label: string;
  source: BackgroundSource;
  /** Texten när momentet är klart. Får bara nämna sådant källan faktiskt gav. */
  done: (ctx: BackgroundContext) => string;
}

export interface BackgroundContext {
  companyName: string;
  orgNumber: string;
  /** Sant när uppslaget mot företagsregistret gav svar. */
  registryHit: boolean;
  /** Antal besvarade intervjufrågor just nu. */
  answered: number;
  /** Antal ifyllda profilfält just nu. */
  profileFields: number;
}

/**
 * Momenten, i den ordning de visas.
 *
 * Listan är medvetet densamma oavsett om källan finns: den är kartan
 * över vad en företagsanalys består av. Skillnaden syns i tillståndet,
 * inte i om raden finns.
 *
 * Etiketterna är SUBSTANTIV, inte "Hämtar det", "Läser det andra". Två
 * skäl: en lista där varje rad börjar med ett nytt verb är brusigare än
 * en lista med saker, och ett naket "Hämtar X" är just den sortens
 * väntebesked som produkten förbjuder (tests/prepare.ts, regel 4) -
 * det säger vad systemet gör men inte vad användaren får. Vad som pågår
 * står i stället en gång, överst, som ett riktigt väntebesked.
 */
const PLAN: Plan[] = [
  {
    id: "register",
    label: "Offentlig företagsinformation",
    source: "foretagsregister",
    done: (c) => `${c.companyName} (${c.orgNumber}) hämtat ur företagsregistret.`,
  },
  {
    id: "webbplats",
    label: "Bolagets webbplats",
    source: "webb",
    done: () => "",
  },
  {
    id: "sociala",
    label: "Sociala medier",
    source: "sociala-medier",
    done: () => "",
  },
  {
    id: "recensioner",
    label: "Kundrecensioner",
    source: "recensioner",
    done: () => "",
  },
  {
    id: "nyheter",
    label: "Nyhetsartiklar om bolaget",
    source: "nyheter",
    done: () => "",
  },
  {
    id: "bransch",
    label: "Branschtillhörighet",
    source: "intervjun",
    done: () => "Branschen kommer ur ditt eget svar, inte ur extern statistik.",
  },
  {
    id: "konkurrenter",
    label: "Konkurrenter",
    source: "branschdata",
    done: () => "",
  },
  {
    id: "storlek",
    label: "Bolagets storlek",
    source: "intervjun",
    done: (c) => `Bygger på ${c.answered} besvarade frågor om verksamheten.`,
  },
  {
    id: "risker",
    label: "Risker",
    source: "analysmotorn",
    done: () => "Räknas fram ur dina svar när intervjun är klar.",
  },
  {
    id: "mojligheter",
    label: "Möjligheter",
    source: "analysmotorn",
    done: () => "Räknas fram ur dina svar när intervjun är klar.",
  },
  {
    id: "profil",
    label: "Första företagsprofilen",
    source: "analysmotorn",
    done: (c) => `${c.profileFields} av 9 fält i profilen vilar på ett svar.`,
  },
];

/**
 * Momentens tillstånd just nu.
 *
 * `upTo` är hur långt körningen hunnit - panelen tickar fram ett moment i
 * taget så att det syns att något händer. Moment vars källa saknas
 * "hinns" också, men landar i ingen-kalla i stället för klar.
 */
export const backgroundTasks = (ctx: BackgroundContext, upTo: number): BackgroundTask[] =>
  PLAN.map((plan, i) => {
    const connected = CONNECTED.includes(plan.source);
    // Registret är anslutet, men det betyder inte att det svarade. Ett
    // moment som inte fick svar får inte stå som klart.
    const answered = plan.source !== "foretagsregister" || ctx.registryHit;
    if (i >= upTo) {
      return { id: plan.id, label: plan.label, source: plan.source, state: "pagar", note: "" };
    }
    if (!connected) {
      return {
        id: plan.id,
        label: plan.label,
        source: plan.source,
        state: "ingen-kalla",
        note: missingNote(plan.source),
      };
    }
    if (!answered) {
      return {
        id: plan.id,
        label: plan.label,
        source: plan.source,
        state: "ingen-kalla",
        note: "Företagsregistret gav inget svar på det här numret.",
      };
    }
    return { id: plan.id, label: plan.label, source: plan.source, state: "klar", note: plan.done(ctx) };
  });

export const BACKGROUND_STEPS = PLAN.length;

/** Sammanfattningen under panelen: vad som blev gjort och vad som inte kunde göras. */
export const backgroundSummary = (tasks: BackgroundTask[]): string => {
  const done = tasks.filter((t) => t.state === "klar").length;
  const missing = tasks.filter((t) => t.state === "ingen-kalla").length;
  if (missing === 0) return `${done} av ${tasks.length} moment klara.`;
  return `${done} av ${tasks.length} moment klara. ${missing} kunde inte göras – källan är inte ansluten, och då säger jag hellre det än gissar.`;
};
