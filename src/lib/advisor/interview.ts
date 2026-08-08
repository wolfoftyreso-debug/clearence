/**
 * INTERVJUN: ett samtal i stället för ett formulär.
 *
 * Frågorna ställs en i taget och nästa fråga beror på svaren innan.
 * Adaptiviteten är inte pynt - den är det som gör att antalet frågor kan
 * hållas nere. Ett bolag utan anställda ska inte få en fråga om hur
 * organisationen ser ut, och ett bolag som säljer till privatpersoner
 * ska inte få en fråga om sin största kunds andel av intäkterna.
 *
 * DEN VIKTIGASTE ANPASSNINGEN gäller den som har bråttom. CLEARANCE är
 * byggt för bolag i kris. Den som just svarat att lönerna inte kan
 * betalas på fredag ska inte behöva svara på hur ni hittar nya kunder
 * innan hen får hjälp. Frågor märkta `skipWhenAcute` faller därför bort
 * när läget är akut, och intervjun landar på tio frågor i stället för
 * femton. Det är samma princip som resten av produkten: ordningen ska
 * följa vad som brådskar, inte vad som är bekvämt att samla in.
 *
 * Motorn är deterministisk. Samma svar ger samma nästa fråga, varje
 * gång, och det går att testa.
 */

import type { CompanyProfile } from "./companyProfile";

export interface InterviewOption {
  /** Det användaren klickar på. */
  label: string;
  /** Vad svaret säger om profilen. */
  fills: Partial<CompanyProfile>;
  /**
   * Signaler som inte är profilfält men som styr senare frågor och
   * risknivån - koncentration och riktning.
   */
  signal?: { concentration?: "låg" | "medel" | "hög"; trend?: "upp" | "stabil" | "ner" | "kraftigt ner" };
}

export interface InterviewQuestion {
  id: string;
  /** Frågan, ställd som en människa skulle ställa den. */
  text: string;
  /**
   * Varför den ställs. Övergångsprincipen gäller även här: ingen ny fråga
   * utan en kort introduktion om ämnet.
   */
  why: string;
  options: InterviewOption[];
  /** Faller bort när läget är akut - se filhuvudet. */
  skipWhenAcute?: boolean;
  /** Villkor mot profilen så här långt. Utelämnat = ställs alltid. */
  askWhen?: (profile: CompanyProfile) => boolean;
}

/*
 * Villkoren är OPTIMISTISKA så länge fältet är okänt.
 *
 * Skälet är räknaren. Hade en fråga vars villkor ännu inte gick att
 * pröva räknats bort hade totalen VUXIT när svaret kom in - "fråga 3 av
 * 13" följt av "fråga 4 av 15" läses som att mållinjen flyttar sig, och
 * det är det säkraste sättet att få någon att sluta svara. Med den här
 * riktningen kan totalen bara krympa, och en intervju som blir kortare
 * är alltid välkomna nyheter.
 */
const hasEmployees = (p: CompanyProfile): boolean => p.employees !== "1 person";

const sellsToBusinesses = (p: CompanyProfile): boolean => p.customers !== "B2C";

/**
 * Frågebanken i den ordning frågorna ställs.
 *
 * Ordningen är inte godtycklig: den går från lätt att svara på till
 * eftertänksamt. Den som just skapat ett konto orkar svara "hur många
 * jobbar här"; frågan om vad man helst vill förbättra på sex månader
 * kräver att man hunnit landa.
 */
export const INTERVIEW: InterviewQuestion[] = [
  {
    id: "anstallda",
    text: "Hur många personer arbetar i företaget?",
    why: "Antalet styr vad som händer vid en betalningsstörning – löner har egna frister och eget skydd.",
    options: [
      { label: "Bara jag", fills: { employees: "1 person", growthPhase: "Enmansbolag" } },
      { label: "2–5 personer", fills: { employees: "2–5" } },
      { label: "6–20 personer", fills: { employees: "6–20" } },
      { label: "21–50 personer", fills: { employees: "21–50" } },
      { label: "Fler än 50", fills: { employees: "Fler än 50" } },
    ],
  },
  {
    id: "bransch",
    text: "Vilken bransch ligger närmast?",
    why: "Branschen avgör vad som är normalt: byggbolag och konsultbolag har helt olika betalningsmönster.",
    /*
     * Listan var för grov. En bilverkstad, en frisör, en elektriker och en
     * lantbrukare hade inget eget val och tvingades till "Något annat" -
     * och en bransch-fråga där var fjärde bolag svarar "annat" ger ingen
     * branschbild att luta sig mot. Alternativen nedan täcker de vanligaste
     * småföretagen i Sverige, grovt i linje med SNI:s huvudgrupper så att
     * de kan bytas mot företagsregistrets SNI-kod den dag den kopplas in.
     * "Något annat" finns kvar som sista utväg, inte som förstahandssvar.
     */
    options: [
      { label: "Bygg och anläggning", fills: { industry: "Bygg" } },
      { label: "Hantverk och installation", fills: { industry: "Hantverk och installation" } },
      { label: "Bil och verkstad", fills: { industry: "Bil och verkstad" } },
      { label: "Handel", fills: { industry: "Handel" } },
      { label: "Restaurang och hotell", fills: { industry: "Restaurang och hotell" } },
      { label: "Transport och åkeri", fills: { industry: "Transport" } },
      { label: "Tillverkning och industri", fills: { industry: "Tillverkning" } },
      { label: "IT och teknik", fills: { industry: "IT och teknik" } },
      { label: "Konsult och tjänster", fills: { industry: "Konsult och tjänster" } },
      { label: "Vård och omsorg", fills: { industry: "Vård och omsorg" } },
      { label: "Skönhet och hälsa", fills: { industry: "Skönhet och hälsa" } },
      { label: "Fastighet och förvaltning", fills: { industry: "Fastighet" } },
      { label: "Jordbruk och skog", fills: { industry: "Jordbruk och skog" } },
      { label: "Något annat", fills: { industry: "Övrigt" } },
    ],
  },
  {
    id: "erbjudande",
    text: "Vad säljer ni främst?",
    why: "Varor binder kapital i lager, tjänster binder det i tid. Det syns direkt i likviditeten.",
    options: [
      { label: "Varor", fills: { businessModel: "Varuförsäljning" } },
      { label: "Tjänster", fills: { businessModel: "Tjänster" } },
      { label: "Projekt och uppdrag", fills: { businessModel: "Projekt" } },
      { label: "Abonnemang", fills: { businessModel: "Abonnemang" } },
      { label: "Blandat", fills: { businessModel: "Blandat" } },
    ],
  },
  {
    id: "kunder",
    text: "Vem köper av er?",
    why: "Vem som är kund styr betalningstiderna och vilka verktyg som finns om de inte betalar.",
    options: [
      { label: "Andra företag", fills: { customers: "B2B" } },
      { label: "Privatpersoner", fills: { customers: "B2C" } },
      { label: "Offentlig sektor", fills: { customers: "Offentlig sektor" } },
      { label: "Både företag och privatpersoner", fills: { customers: "Blandat" } },
    ],
  },
  {
    id: "geografi",
    text: "Var finns kunderna?",
    why: "Geografin avgör vilka regler som gäller om det blir en process, och hur bred marknaden är.",
    options: [
      { label: "På orten", fills: { geography: "Lokalt" } },
      { label: "I regionen", fills: { geography: "Regionalt" } },
      { label: "I hela Sverige", fills: { geography: "Sverige" } },
      { label: "I Norden", fills: { geography: "Norden" } },
      { label: "Utanför Norden också", fills: { geography: "Internationellt" } },
    ],
  },
  {
    id: "omsattning",
    text: "Ungefär hur stor är omsättningen på ett år?",
    why: "Storleken avgör vilka verktyg som är rimliga. En rekonstruktion kostar detsamma oavsett bolagets storlek.",
    options: [
      { label: "Under 2 miljoner", fills: { revenue: "Under 2 Mkr" } },
      { label: "2–10 miljoner", fills: { revenue: "2–10 Mkr" } },
      { label: "10–50 miljoner", fills: { revenue: "10–50 Mkr" } },
      { label: "Över 50 miljoner", fills: { revenue: "Över 50 Mkr" } },
      { label: "Jag vet inte säkert", fills: {} },
    ],
  },
  {
    id: "utveckling",
    text: "Hur har omsättningen utvecklats det senaste året?",
    why: "Riktningen säger mer än nivån. Ett bolag på väg upp med tillfällig kassabrist är en annan sak än ett på väg ner.",
    options: [
      { label: "Ökat", fills: { growthPhase: "Tillväxt" }, signal: { trend: "upp" } },
      { label: "Ungefär oförändrad", fills: { growthPhase: "Stabil" }, signal: { trend: "stabil" } },
      { label: "Minskat", fills: { growthPhase: "Vikande" }, signal: { trend: "ner" } },
      { label: "Minskat kraftigt", fills: { growthPhase: "Kraftigt vikande" }, signal: { trend: "kraftigt ner" } },
    ],
  },
  {
    id: "aterkommande",
    text: "Har ni återkommande kunder eller mest engångsaffärer?",
    why: "Återkommande intäkter är det som gör en prognos möjlig. Utan dem blir varje månad en ny fråga.",
    options: [
      { label: "Mest återkommande", fills: { businessModel: "Återkommande intäkter" } },
      { label: "Ungefär hälften av varje", fills: {} },
      { label: "Mest engångsaffärer", fills: { businessModel: "Engångsaffärer" } },
    ],
  },
  {
    id: "beroende",
    text: "Hur stor del av intäkterna kommer från er största kund?",
    why: "En kund som står för halva omsättningen är den enskilt största risken i många småbolag.",
    askWhen: sellsToBusinesses,
    options: [
      { label: "Under en tiondel", fills: {}, signal: { concentration: "låg" } },
      { label: "Ungefär en fjärdedel", fills: {}, signal: { concentration: "medel" } },
      { label: "Ungefär hälften", fills: {}, signal: { concentration: "hög" } },
      { label: "Mer än hälften", fills: {}, signal: { concentration: "hög" } },
      { label: "Jag vet inte", fills: {} },
    ],
  },
  {
    id: "system",
    text: "Har ni ekonomisystem eller affärssystem idag?",
    why: "Det avgör hur snabbt vi kan få fram siffrorna – och om underlaget kan hämtas eller måste skrivas in.",
    options: [
      { label: "Ja, ett affärssystem", fills: { digitalMaturity: "Hög" } },
      { label: "Ja, ett bokföringsprogram", fills: { digitalMaturity: "Medel" } },
      { label: "Redovisningsbyrån sköter det", fills: { digitalMaturity: "Medel" } },
      { label: "Nej, vi gör det för hand", fills: { digitalMaturity: "Låg" } },
    ],
  },
  {
    id: "organisation",
    text: "Hur ser organisationen ut?",
    why: "Vem som får besluta styr vad som kan göras den här veckan – ett styrelsebeslut tar längre tid än ett eget.",
    askWhen: hasEmployees,
    options: [
      { label: "Jag driver och beslutar själv", fills: { growthPhase: "Ägarledd" } },
      { label: "Jag och några nyckelpersoner", fills: {} },
      { label: "Vi har en ledningsgrupp", fills: {} },
      { label: "Vi har en aktiv styrelse", fills: {} },
    ],
  },
  {
    id: "utmaning",
    text: "Vad är den största utmaningen just nu?",
    why: "Det här styr vad analysen ska börja med. Allt annat kan vänta tills det är sagt.",
    options: [
      { label: "Likviditeten", fills: {} },
      { label: "För få kunder", fills: {} },
      { label: "Lönsamheten", fills: {} },
      { label: "Kostnaderna", fills: {} },
      { label: "Personalen", fills: {} },
      { label: "Ägar- eller styrelsefrågor", fills: {} },
    ],
  },
  {
    id: "nya-kunder",
    text: "Hur hittar ni nya kunder idag?",
    why: "Om intäkterna behöver upp är det här den enda knappen som finns att vrida på kort sikt.",
    skipWhenAcute: true,
    options: [
      { label: "På rekommendation", fills: {} },
      { label: "Egen säljare eller eget säljarbete", fills: {} },
      { label: "Annonsering och digitala kanaler", fills: { digitalMaturity: "Medel" } },
      { label: "Upphandlingar", fills: {} },
      { label: "Vi söker inte aktivt", fills: {} },
    ],
  },
  {
    id: "sasong",
    text: "Är intäkterna jämna över året eller säsongsbetonade?",
    why: "En säsongssvacka som är väntad hanteras annorlunda än ett tapp ingen räknat med.",
    skipWhenAcute: true,
    options: [
      { label: "Ganska jämna", fills: {} },
      { label: "Tydliga säsonger", fills: {} },
      { label: "Helt ojämna", fills: {} },
    ],
  },
  {
    id: "sex-manader",
    text: "Vad skulle du helst vilja ha löst om ett halvår?",
    why: "Det är det svaret hela handlingsplanen ska mätas mot. Utan det blir planen vår, inte din.",
    skipWhenAcute: true,
    options: [
      { label: "Att kassan räcker utan att jag tänker på den", fills: {} },
      { label: "Att skulderna är under kontroll", fills: {} },
      { label: "Att bolaget är lönsamt igen", fills: {} },
      { label: "Att jag har lämnat över eller sålt", fills: {} },
      { label: "Att det är ordnat avvecklat", fills: {} },
    ],
  },
];

/**
 * SVARAD är inte samma sak som SVARAD MED NÅGOT.
 *
 * Att hoppa över en fråga ÄR ett svar - svaret "det vill jag inte säga".
 * Överhoppade frågor lagras som tom sträng, och en tom sträng är falsk.
 * Motorn läste därför `!answers[id]` som "obesvarad" och ställde samma
 * fråga igen, i evighet: knappen "Hoppa över frågan" gjorde ingenting
 * alls och användaren satt fast.
 *
 * Frågan om något är besvarat ska därför ALLTID gå genom den här
 * funktionen, aldrig genom sanningsvärdet hos svaret. Nyckeln finns =
 * användaren har tagit ställning.
 */
export const isAnswered = (answers: Record<string, string>, id: string): boolean =>
  Object.prototype.hasOwnProperty.call(answers, id);

/**
 * Läget är akut när introduktionen sa det, eller när användaren själv
 * pekat ut likviditeten som den största utmaningen.
 */
export const isAcute = (situationId: string | null, answers: Record<string, string>): boolean =>
  situationId === "loner" ||
  situationId === "ansvar" ||
  answers.utmaning === "Likviditeten";

/** Frågorna som gäller för det här bolaget, i ordning. */
export const applicableQuestions = (
  profile: CompanyProfile,
  situationId: string | null,
  answers: Record<string, string>,
): InterviewQuestion[] => {
  const acute = isAcute(situationId, answers);
  return INTERVIEW.filter((q) => {
    // En fråga som redan är besvarad står kvar i listan - annars skulle
    // "fråga 4 av 12" räkna ner medan man svarar, vilket är obegripligt.
    if (acute && q.skipWhenAcute && !isAnswered(answers, q.id)) return false;
    if (q.askWhen && !q.askWhen(profile) && !isAnswered(answers, q.id)) return false;
    return true;
  });
};

/** Nästa obesvarade fråga, eller null när intervjun är klar. */
export const nextQuestion = (
  profile: CompanyProfile,
  situationId: string | null,
  answers: Record<string, string>,
): InterviewQuestion | null =>
  applicableQuestions(profile, situationId, answers).find((q) => !isAnswered(answers, q.id)) ?? null;

/** Var i intervjun användaren är: "Fråga 4 av 12". */
export const interviewProgress = (
  profile: CompanyProfile,
  situationId: string | null,
  answers: Record<string, string>,
): { current: number; total: number } => {
  const applicable = applicableQuestions(profile, situationId, answers);
  const answeredCount = applicable.filter((q) => isAnswered(answers, q.id)).length;
  return { current: Math.min(answeredCount + 1, applicable.length), total: applicable.length };
};
