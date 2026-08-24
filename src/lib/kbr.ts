/**
 * KONTROLLBALANSRÄKNINGEN: när den krävs, och varför.
 *
 * Det här är produktens tyngsta juridiska bedömning. ABL 25 kap. 13 §:
 * styrelsen ska genast upprätta en kontrollbalansräkning när det finns skäl
 * att anta att bolagets eget kapital understiger HÄLFTEN av det registrerade
 * aktiekapitalet. Svarar produkten fel här svarar den fel om det enda som
 * verkligen räknas.
 *
 * REGELN LÅG I EN REACT-KOMPONENT.
 *
 * Den bodde i ett useMemo inne i src/pages/KBRModule.tsx, alltså oåtkomlig
 * för allt utom en webbläsare. Ett scenariotest kunde inte röra den, och den
 * enda vägen att "pröva" den hade varit att skriva regeln en gång till i
 * provet - vilket bevisar att två implementationer är överens, inte att
 * någon av dem är rätt.
 *
 * Funktionen nedan är EXAKT den beräkning komponenten gjorde. Ingen regel är
 * ändrad i flytten; det som var sant förut är sant nu, och nu går det att
 * pröva.
 */

import type { KbrStatus } from "@/data/types";

export interface KbrUnderlag {
  /** Registrerat aktiekapital i kronor. */
  aktiekapital: number;
  /** Summa tillgångar i kronor. */
  tillgangar: number;
  /** Summa skulder i kronor. */
  skulder: number;
}

export interface KbrBedomning {
  status: KbrStatus;
  /** Tillgångar minus skulder. */
  egetKapital: number;
  /** Hälften av aktiekapitalet - gränsen i ABL 25:13. */
  grans: number;
  /** Eget kapital i procent av aktiekapitalet. */
  andel: number;
  meddelande: string;
  /**
   * SANT BARA NÄR SIFFRORNA RÄCKER FÖR EN BEDÖMNING.
   *
   * Utan aktiekapital eller tillgångar finns ingen bedömning att göra.
   * Statusen blir då "not_required" - inte för att KBR är onödig, utan för
   * att den är OKÄND. Den som läser statusen utan att läsa den här flaggan
   * läser "allt är bra" ur "vi vet inte", och det är ett annat påstående.
   */
  harUnderlag: boolean;
}

/**
 * Läser ett belopp som användaren skrivit det.
 *
 * Regeln bor i src/lib/belopp.ts. Den låg tidigare här som ett parseInt,
 * som stannade vid första punkten: "180.000" blev 180. Nulägesanalysen
 * hade sin egen, motsatta tolkning av samma sträng.
 */
export { beloppUrText } from "@/lib/belopp";

export const bedomKbr = (underlag: KbrUnderlag): KbrBedomning => {
  const { aktiekapital, tillgangar, skulder } = underlag;

  if (!aktiekapital || !tillgangar) {
    return {
      status: "not_required",
      egetKapital: 0,
      grans: 0,
      andel: 0,
      meddelande: "",
      harUnderlag: false,
    };
  }

  const egetKapital = tillgangar - skulder;
  const grans = aktiekapital / 2;
  const andel = aktiekapital > 0 ? (egetKapital / aktiekapital) * 100 : 0;

  if (egetKapital >= aktiekapital) {
    return {
      status: "not_required",
      egetKapital,
      grans,
      andel,
      meddelande: "Eget kapital överstiger aktiekapitalet. Ingen KBR krävs.",
      harUnderlag: true,
    };
  }
  if (egetKapital >= grans) {
    return {
      status: "warning",
      egetKapital,
      grans,
      andel,
      meddelande: "Eget kapital närmar sig kritisk nivå. Överväg åtgärder.",
      harUnderlag: true,
    };
  }
  if (egetKapital > 0) {
    return {
      status: "required",
      egetKapital,
      grans,
      andel,
      meddelande:
        "Eget kapital understiger hälften av aktiekapitalet. Kontrollbalansräkning krävs enligt aktiebolagslagen 25 kap. 13 §.",
      harUnderlag: true,
    };
  }
  return {
    status: "critical",
    egetKapital,
    grans,
    andel,
    meddelande: "Eget kapital är negativt. Omedelbar KBR och åtgärder krävs.",
    harUnderlag: true,
  };
};
