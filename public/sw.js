/*
 * SERVICE-WORKERN.
 *
 * Den finns för två saker: att appen ska gå att installera på hemskärmen,
 * och att en tunnel eller ett tappat nät inte ska ge en vit skärm.
 *
 * Den gör INTE appen till en offline-produkt. Ärendet bor i backend, och
 * ett bolag i kris ska aldrig fatta beslut på siffror som cachats för tre
 * dagar sedan. Därför är reglerna hårda:
 *
 *  1. INGENTING SOM KRÄVER INLOGGNING CACHAS. Varken API-svar, sessioner
 *     eller dokument. En delad telefon får inte bära ett annat bolags
 *     ekonomi i sin cache, och en signerad URL som ligger kvar är en
 *     läcka som överlever utloggningen.
 *  2. HTML HÄMTAS ALLTID FRÅN NÄTET FÖRST. Cache-first på dokumentet är
 *     hur användare fastnar på ett gammalt bygge i veckor utan att förstå
 *     varför en rättad bugg är kvar.
 *  3. BARA HASHADE TILLGÅNGAR CACHAS PERMANENT. Vite döper om filen när
 *     innehållet ändras, så en träff i cachen kan aldrig vara inaktuell.
 *
 * Versionen nedan bumpas när reglerna ändras. Gamla cachar städas vid
 * aktivering - annars växer de tills webbläsaren tömmer dem åt oss, vid
 * en tidpunkt vi inte valt.
 */

const VERSION = "v1";
const SKAL = `clearance-skal-${VERSION}`;
const TILLGANGAR = `clearance-tillgangar-${VERSION}`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SKAL).then((c) => c.addAll([OFFLINE, "/icon-192.png"])).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((namn) =>
        Promise.all(
          namn
            .filter((n) => n.startsWith("clearance-") && !n.endsWith(VERSION))
            .map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

/** Sant för det som är oföränderligt och offentligt: Vites hashade filer. */
const arHashadTillgang = (url) =>
  url.origin === self.location.origin &&
  (/^\/assets\/.+\.[0-9a-zA-Z_-]{8,}\.(js|css|woff2?|png|svg|jpe?g)$/.test(url.pathname) ||
    /^\/(icon-\d+|icon-maskable-\d+|apple-touch-icon|favicon)\.(png|ico)$/.test(url.pathname));

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Bara GET. En POST som spelas upp ur en cache är en handling som
  // utförs två gånger.
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Aldrig annans domän, aldrig API:et, aldrig något med inloggning.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/v1/") || url.pathname.startsWith("/api/")) return;
  if (request.headers.has("Authorization")) return;

  /*
   * Dokument: en RIKTIG nätverkstur, aldrig webbläsarens HTTP-cache.
   *
   * `no-store` är inte en detalj. Med ett vanligt fetch(request) svarade
   * webbläsaren offline med index.html ur sin egen diskcache - anropet
   * lyckades alltså, catch-grenen kördes aldrig, och användaren fick
   * appskalet vars script inte gick att hämta. En vit skärm, alltså
   * exakt det den här filen finns för att förhindra.
   *
   * Med no-store misslyckas anropet på riktigt när nätet är borta, och
   * offline-sidan visas. För en enkelsidig app är det dessutom rätt ändå:
   * HTML:en ska aldrig komma ur en cache som kan vara ett bygge gammal.
   */
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request.url, {
        cache: "no-store",
        credentials: "same-origin",
        redirect: "follow",
      })
        .then((svar) => {
          // Ett 5xx är inte ett fungerande dokument. Hellre den ärliga
          // sidan än en felsida från en lastbalanserare.
          if (svar.status >= 500) throw new Error("serverfel");
          return svar;
        })
        .catch(() => caches.match(OFFLINE)),
    );
    return;
  }

  if (arHashadTillgang(url)) {
    event.respondWith(
      caches.match(request).then(
        (traff) =>
          traff ??
          fetch(request).then((svar) => {
            // Bara hela, lyckade svar sparas. Ett 206 eller ett fel som
            // cachas är ett fel som blir permanent.
            if (svar.ok && svar.status === 200) {
              const kopia = svar.clone();
              caches.open(TILLGANGAR).then((c) => c.put(request, kopia));
            }
            return svar;
          }),
      ),
    );
  }
});
