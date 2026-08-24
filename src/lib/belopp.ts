/**
 * ETT BELOPP UR EN TEXT. EN TOLKNING, INTE TVÅ.
 *
 * Beloppsfälten är fritext. De fylls i av formuläret (som normaliserar till
 * siffror och mellanslag), men också av SIE-importen, av det öppna API:t och
 * av det som redan ligger i databasen. Vad strängen betyder måste alltså
 * avgöras i EN funktion.
 *
 * DET GJORDE DET INTE. Produkten hade två tolkar som gav olika svar på
 * samma sparade sträng:
 *
 *   sträng          wizard/analys   KBR-modulen
 *   "180000,50"        18 000 050       180 000
 *   "12,5"                    125            12
 *   "180.000"             180 000           180
 *   "-500 000"            500 000      -500 000
 *
 * Den ena strök allt utom siffror - alltså blev decimaltecknet en nolla
 * till och beloppet hundra gånger för stort, och minustecknet försvann så
 * att en negativ post blev en verklig skuld. Den andra lät parseInt stanna
 * vid första punkten. Samma ärende kunde därför visa en skuld i
 * nulägesanalysen och en annan i kontrollbalansräkningen, utan att något
 * såg trasigt ut.
 *
 * REGLERNA HÄR ÄR SKRIVNA, INTE UNDERFÖRSTÅDDA:
 *
 *  1. Mellanslag är tusenavskiljare och stryks - även hårt mellanslag
 *     (U+00A0), som är det Excel klistrar in.
 *  2. "kr", "SEK" och liknande efterled stryks.
 *  3. KOMMA är decimaltecken. "180000,50" är 180 000 kronor och 50 öre.
 *  4. PUNKT är tusenavskiljare NÄR den följs av exakt tre siffror och
 *     inget komma finns i strängen ("1.200.000"). Annars är den ett
 *     decimaltecken ("1.5"). Det är den tolkning som gör rätt för båda
 *     sätten folk faktiskt skriver.
 *  5. Fälten är hela kronor. Decimaler avrundas till närmaste krona.
 *  6. Ett NEGATIVT belopp är inget svar på "hur mycket". Det ger 0, precis
 *     som "vet ej" gör. Att i stället stryka minustecknet - som den gamla
 *     tolken gjorde - förvandlar en felskrivning till en skuld.
 *  7. Allt annat ger 0. Produkten hanterar "vi vet inte" överallt; den
 *     hanterar inte en gissning som ser ut som ett faktum.
 */

/** Mellanslag i alla former, inklusive det Excel klistrar in. */
/*
 * Mellanslag i alla former. Skrivna som escape-sekvenser med flit: ett
 * hårt mellanslag som TECKEN i källkoden syns inte, och den som redigerar
 * raden vet inte att det står där.
 *
 * \u00a0 hårt mellanslag - det Excel klistrar in.
 * \u202f smalt hårt mellanslag - franskt/schweiziskt tusenavskiljande.
 * \u2007 siffermellanslag - används i tabeller.
 */
const MELLANSLAG = /[\s\u00a0\u202f\u2007]/g;

export const beloppUrText = (varde: string | null | undefined): number => {
  const rat = String(varde ?? "")
    .replace(MELLANSLAG, "")
    .replace(/(kr|sek|:-)$/i, "")
    .trim();
  if (rat === "") return 0;

  const negativt = rat.startsWith("-");
  const utanTecken = rat.replace(/^[+-]/, "");

  // Bara siffror: det vanliga fallet, och det formuläret producerar.
  if (/^\d+$/.test(utanTecken)) {
    const n = Number(utanTecken);
    return negativt ? 0 : n;
  }

  let normaliserat: string;
  if (utanTecken.includes(",")) {
    // Kommat är decimaltecken. Punkter är då tusenavskiljare.
    normaliserat = utanTecken.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(utanTecken)) {
    // "1.200.000" - punkter som tusenavskiljare.
    normaliserat = utanTecken.replace(/\./g, "");
  } else {
    // En ensam punkt som inte avgränsar tusental: decimaltecken.
    normaliserat = utanTecken;
  }

  if (!/^\d+(\.\d+)?$/.test(normaliserat)) return 0;
  const tal = Number(normaliserat);
  if (!Number.isFinite(tal)) return 0;
  return negativt ? 0 : Math.round(tal);
};
