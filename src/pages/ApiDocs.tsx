import Header from "@/components/landing/Header";
import Footer from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { downloadTextFile } from "@/lib/integrations/download";
import { FileJson } from "lucide-react";
import spec from "../../api/openapi.json";

/**
 * Den publika utvecklarsidan: renderar det riktiga kontraktet
 * (api/openapi.json) - specen ÄR sidan. Ingen handskriven lista som
 * kan driva isär från kontraktet, och samma ärliga statusmärkning:
 * live är implementerat och verifierat, beta är kontrakt-först.
 * Ingetdera är driftsatt - det står överst på sidan, inte i en fotnot.
 */

type Operation = {
  operationId?: string;
  summary?: string;
  "x-status"?: string;
};

const METHOD_TONE: Record<string, string> = {
  get: "bg-accent/10 text-accent border-accent/40",
  post: "bg-success/10 text-foreground border-success/50",
  patch: "bg-warning/10 text-foreground border-warning/50",
  delete: "bg-destructive/10 text-foreground border-destructive/40",
};

/**
 * TRE LÄGEN, INTE TVÅ.
 *
 * Märket visade allt som inte var "live" som BETA. Fyra resurser i
 * kontraktet svarar 405 från egna API:t - POST /cases och
 * PATCH /cases/{caseId} bland dem - och stod alltså på den publika sidan
 * som om de gick att anropa. "Beta" betyder "ny", inte "finns inte".
 *
 * En utvecklare som bygger mot en dokumenterad resurs och får metodfel
 * slutar lita på dokumentationen, och då är hela kontraktet värdelöst.
 */
const StatusBadge = ({ status }: { status: string }) => {
  const stil =
    status === "live"
      ? "border-success/50 bg-success/10 text-foreground"
      : status === "planerad"
        ? "border-warning/50 bg-warning/10 text-foreground"
        : "border-border bg-secondary text-muted-foreground";
  const text = status === "live" ? "Live" : status === "planerad" ? "Planerad" : "Beta";
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${stil}`}
    >
      {text}
    </span>
  );
};

const ApiDocs = () => {
  const paths = spec.paths as Record<string, Record<string, Operation>>;
  const webhooks = Object.keys(spec.webhooks);
  const errorCodes = (
    spec.components.schemas.Error as { properties: { code: { enum: string[] } } }
  ).properties.code.enum;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="pt-16 md:pt-20">
        <section className="border-b border-border bg-secondary/30">
          <div className="container px-4 py-12">
            <h1 className="font-display text-3xl text-foreground">Öppet API</h1>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">
              Allt som går att göra i gränssnittet ska gå att göra via API.
              Externa system kan skapa, läsa, uppdatera och avsluta ärenden
              utan att öppna appen. Kontraktet är versionerat (/v1),
              statusmärkt per resurs och bakåtkompatibelt inom en version -
              fält läggs till, aldrig bort.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Samma datagräns som live-ärendelänken: API:t levererar
              strukturerad, spårbar ärendedata - aldrig automatiska
              bedömningar. Slutsatser dras av mottagarens system.
            </p>
            {/* Sagt först, inte i en fotnot: ingen miljö är driftsatt, och
                bas-URL:en nedan svarar inte ännu. Att låta en utvecklare
                upptäcka det själv efter en halvtimmes felsökning vore
                precis den sortens tystnad produkten säger sig undvika. */}
            <p className="mt-4 max-w-2xl rounded-md border border-warning/50 bg-warning/5 p-3 text-sm leading-relaxed text-foreground">
              <span className="font-semibold">Ingen miljö är driftsatt ännu.</span>{" "}
              Bas-URL:erna nedan svarar inte, och kontraktet är därför att läsa
              som en beställning - inte som något att integrera mot i dag. Vi
              säger till här när det ändras.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant="accent"
                onClick={() =>
                  downloadTextFile(
                    JSON.stringify(spec, null, 2),
                    "clearance-openapi.json",
                    "application/json;charset=utf-8",
                  )
                }
              >
                <FileJson className="h-4 w-4" aria-hidden="true" />
                Hämta kontraktet (OpenAPI 3.1)
              </Button>
              <span className="text-sm text-muted-foreground">
                Version {spec.info.version}
              </span>
            </div>
          </div>
        </section>

        <section className="container px-4 py-12">
          <h2 className="font-display text-2xl text-foreground">Resurser</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Byggda på de fyra objekten - samtal, beslut, dokument, uppgifter -
            plus ärendet, rapporterna och delningslänkarna.{" "}
            <span className="font-medium text-foreground">Live</span> är
            implementerat och verifierat mot databasen;{" "}
            <span className="font-medium text-foreground">Beta</span> är
            kontrakt-först och implementeras bakom samma kontrakt. Ingetdera
            går att anropa förrän API:t är driftsatt.
          </p>
          <ul className="mt-6 space-y-2">
            {Object.entries(paths).flatMap(([path, methods]) =>
              Object.entries(methods).map(([method, op]) => (
                <li key={`${method} ${path}`} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className={`w-16 rounded-sm border px-1.5 py-0.5 text-center text-[10px] font-bold uppercase tracking-wide ${METHOD_TONE[method] ?? "border-border"}`}
                    >
                      {method}
                    </span>
                    <code className="min-w-0 flex-1 break-all text-sm text-foreground">{path}</code>
                    <StatusBadge status={op["x-status"] ?? "beta"} />
                  </div>
                  {op.summary && (
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{op.summary}</p>
                  )}
                </li>
              )),
            )}
          </ul>
        </section>

        <section className="container px-4 pb-12">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-md border border-border bg-card p-5">
              <h2 className="font-semibold text-foreground">Realtid (webhooks)</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Plattformen skickar händelser i stället för att tvinga mottagare
                att fråga kontinuerligt. Journalens append-only-modell är
                källan - varje händelse finns redan som journalrad.
              </p>
              <ul className="mt-3 space-y-1">
                {webhooks.map((event) => (
                  <li key={event}>
                    <code className="text-sm text-foreground">{event}</code>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-md border border-border bg-card p-5">
              <h2 className="font-semibold text-foreground">Felkoder</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Strukturerade fel <code>{"{ code, message }"}</code> med en
                dokumenterad koduppsättning - även betalväggen har en egen kod.
              </p>
              <ul className="mt-3 space-y-1">
                {errorCodes.map((code) => (
                  <li key={code}>
                    <code className="text-sm text-foreground">{code}</code>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-md border border-border bg-card p-5">
            <h2 className="font-semibold text-foreground">Miljöer och behörighet</h2>
            <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
              {spec.servers.map((server) => (
                <li key={server.url}>
                  <code className="break-all text-foreground">{server.url}</code> - {server.description}
                </li>
              ))}
              <li>
                API-nycklar per organisation: skapas under Inställningar i
                inloggat läge, visas en enda gång och lagras bara som hash -
                aldrig läsbara i efterhand, bara utbytbara och återkallbara.
              </li>
              <li>
                Samma radskydd som appen: API:t ser exakt det kontots roller
                ser. Borgenärsisoleringen, teamgränserna och betalväggen gäller
                även här.
              </li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ApiDocs;
