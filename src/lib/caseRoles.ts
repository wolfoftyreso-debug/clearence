/**
 * Ärendets roller på svenska - EN källa för menyer, medlemslistor och
 * inbjudningsmejl.
 *
 * Beskrivningarna säger vad rollen KAN, inte vad den heter: den som bjuder
 * in väljer i praktiken en behörighetsnivå, och "revisor" säger inget om
 * huruvida personen kan ändra i ärendet. Vilka roller som får skriva avgörs
 * i databasen (case_write_roles); texterna här ska spegla den, inte ersätta
 * den.
 *
 * INVITABLE_ROLES speglar databasens constraint: 'owner' delas inte ut per
 * mejl, och 'creditor' är medvetet utesluten tills borgenärsvyn finns -
 * en inbjudan till en vy som inte finns är ett löfte som inte hålls.
 */

export type CaseRole =
  | "owner"
  | "company_staff"
  | "reconstructor"
  | "trustee"
  | "auditor"
  | "legal_advisor"
  | "board_member"
  | "creditor"
  | "observer";

export const CASE_ROLE_LABELS: Record<CaseRole, string> = {
  owner: "Företrädare",
  company_staff: "Ekonomifunktion",
  reconstructor: "Rekonstruktör",
  trustee: "Konkursförvaltare",
  auditor: "Revisor",
  legal_advisor: "Juridisk rådgivare",
  board_member: "Styrelseledamot",
  creditor: "Borgenär",
  observer: "Observatör",
};

export const CASE_ROLE_DESCRIPTIONS: Record<CaseRole, string> = {
  owner: "Företrädare för bolaget. Ser och ändrar allt, bjuder in och återkallar.",
  company_staff: "Bolagets ekonomifunktion. Ser hela ärendet och uppdaterar uppgifterna.",
  reconstructor:
    "Förordnad av tingsrätten. Ser och uppdaterar hela ärendet, kan bjuda in och återkalla.",
  trustee: "Konkursförvaltare. Ser och uppdaterar hela ärendet, kan bjuda in och återkalla.",
  auditor: "Ser hela ärendet, ändrar ingenting.",
  legal_advisor: "Ser hela ärendet, ändrar ingenting.",
  board_member: "Ser hela ärendet, ändrar ingenting.",
  creditor: "Ser bara sin egen fordran och korrespondens - aldrig ärendet i övrigt.",
  observer: "Läsåtkomst för t.ex. tillsyn. Ser hela ärendet, ändrar ingenting.",
};

/** Rollerna som går att bjuda in per mejl, i den ordning de ska föreslås. */
export const INVITABLE_ROLES: CaseRole[] = [
  "board_member",
  "auditor",
  "company_staff",
  "legal_advisor",
  "reconstructor",
  "trustee",
  "observer",
];
