/**
 * Startpunkten.
 *
 * Ligger i en egen fil så att index.ts går att importera - av testerna,
 * och senare av en Lambda-adapter - utan att en server börjar lyssna som
 * bieffekt. En modul som gör något bara för att den läses är svår att
 * testa och lätt att bli överraskad av.
 */

import { createApiServer } from "./index";
import { closePool } from "./db";

const port = Number(process.env.PORT ?? 8080);
const server = createApiServer();

server.listen(port, () => console.log(`CLEARANCE API v1 lyssnar på ${port}`));

// Avslutet stänger lyssnaren först och poolen sedan: en pågående request
// ska få skriva klart sin transaktion innan anslutningarna rycks bort.
const stop = () => {
  server.close(() => {
    void closePool().then(() => process.exit(0));
  });
};
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
