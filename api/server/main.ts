/**
 * Startpunkten.
 *
 * Ligger i en egen fil så att index.ts går att importera - av testerna,
 * och senare av en Lambda-adapter - utan att en server börjar lyssna som
 * bieffekt. En modul som gör något bara för att den läses är svår att
 * testa och lätt att bli överraskad av.
 */

import type { Server } from "node:http";
import { createApiServer } from "./index";
import { closePool, kravSakerDatabasroll } from "./db";

const port = Number(process.env.PORT ?? 8080);

let server: Server | null = null;

/*
 * ROLLEN PRÖVAS FÖRE FÖRSTA REQUESTEN, inte efter.
 *
 * En felpekad DATABASE_URL (superanvändaren, tabellernas ägare, en roll med
 * BYPASSRLS) stänger av radskyddet UTAN att något går sönder: frågorna
 * fortsätter fungera och börjar returnera andra bolags insolvensdata. Att
 * upptäcka det när en kund ser fel akt är för sent - att vägra starta är
 * det enda svar som fungerar. Poden startar inte, utrullningen stannar,
 * och loggen säger vad som ska ändras.
 */
kravSakerDatabasroll()
  .then((roll) => {
    server = createApiServer();
    server.listen(port, () =>
      console.log(`CLEARANCE API v1 lyssnar på ${port} (databasroll: ${roll.roll})`),
    );
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    void closePool().finally(() => process.exit(1));
  });

// Avslutet stänger lyssnaren först och poolen sedan: en pågående request
// ska få skriva klart sin transaktion innan anslutningarna rycks bort.
const stop = () => {
  if (!server) {
    void closePool().finally(() => process.exit(0));
    return;
  }
  server.close(() => {
    void closePool().then(() => process.exit(0));
  });
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
