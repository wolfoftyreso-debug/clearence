/**
 * PROFFSVERKTYGETS LAGRING - verktygets EGEN port, vid sidan av motorns.
 *
 * Motorn ställer inga krav på var akterna bor; den tar poster in och ger
 * bedömningar ut. Men verktyget självt behöver ett lagringskontrakt, av
 * samma skäl som produkten har DataPort: den dag byrån vill byta JSON-mappen
 * mot sitt ärendesystem eller en egen Postgres ska bytet vara EN ny adapter,
 * inte en omskrivning.
 *
 * Två adaptrar, med olika ärenden:
 *
 *   minnesLager  för prov och demonstration - allt i minnet, inget läcker.
 *   filLager     byråns ärendemapp - en JSON-fil per akt i en katalog.
 *                Ingen databas, inga beroenden; en liten byrå kan börja här
 *                och lägga mappen där deras backup redan går.
 *
 * Adaptern hittar aldrig på. En fil som inte går att läsa som en akt är ett
 * FEL med filnamn i, inte en tyst överhoppning - en akt som försvinner tyst
 * ur portföljen är det värsta en praktiker kan råka ut för här.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { CaseRecord, CaseTask, CaseMemberRecord, PaymentRecord, KbrStatus } from "../clearance-motor";

/** Allt verktyget vet om ett ärende: akten. */
export interface ArendeAkt {
  arende: CaseRecord;
  medlemmar: CaseMemberRecord[];
  betalningar: PaymentRecord[];
  uppgifter: CaseTask[];
  kbr: { status: KbrStatus; createdAt: string } | null;
}

export interface ArendeLager {
  lista(): Promise<string[]>;
  hamta(id: string): Promise<ArendeAkt | null>;
  spara(akt: ArendeAkt): Promise<void>;
}

/** Minsta rimlighetskontroll: en akt utan id eller orgnummer är ingen akt. */
const kravPaAkt = (akt: ArendeAkt, kalla: string): ArendeAkt => {
  if (!akt?.arende?.id || !akt.arende.orgNumber) {
    throw new Error(`Akten i ${kalla} saknar id eller organisationsnummer - vägrar gissa.`);
  }
  return akt;
};

export const minnesLager = (start: ArendeAkt[] = []): ArendeLager => {
  const akter = new Map(start.map((a) => [a.arende.id, a]));
  return {
    async lista() { return [...akter.keys()].sort(); },
    async hamta(id) { return akter.get(id) ?? null; },
    async spara(akt) { akter.set(kravPaAkt(akt, "minnet").arende.id, akt); },
  };
};

export const filLager = (katalog: string): ArendeLager => {
  mkdirSync(katalog, { recursive: true });
  const banaFor = (id: string): string => {
    // Id:t blir filnamn. Allt utanför det ofarliga byts bort så att ett id
    // aldrig kan peka utanför ärendemappen.
    const namn = id.replace(/[^A-Za-z0-9_-]/g, "_");
    return join(katalog, `${namn}.json`);
  };
  return {
    async lista() {
      return readdirSync(katalog)
        .filter((f) => f.endsWith(".json"))
        .map((f) => kravPaAkt(JSON.parse(readFileSync(join(katalog, f), "utf8")), f).arende.id)
        .sort();
    },
    async hamta(id) {
      const bana = banaFor(id);
      if (!existsSync(bana)) return null;
      return kravPaAkt(JSON.parse(readFileSync(bana, "utf8")), bana);
    },
    async spara(akt) {
      writeFileSync(banaFor(kravPaAkt(akt, "spara").arende.id), JSON.stringify(akt, null, 2) + "\n");
    },
  };
};
