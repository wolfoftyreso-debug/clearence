import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { data } from "@/data";
import { AlertCircle, BookOpenCheck, CheckCircle2, FileUp, Loader2 } from "lucide-react";

/**
 * Bokföringen in i ärendet.
 *
 * SKILLNADEN MOT SiePrefill, som läser samma filformat: den läser filen i
 * webbläsaren och lovar uttryckligen att den "skickas ingenstans". Det
 * löftet gäller där och ska inte tummas på.
 *
 * Den här gör det motsatta, och SÄGER DET. Filen skickas till servern,
 * tolkas där och sparas som ärendets lägesbild - för att siffrorna sedan
 * ska gå att visa för en rådgivare, en bank eller en rekonstruktör, och
 * för att analysmotorn på översikten ska ha något att räkna på. Två olika
 * handlingar med två olika löften, och användaren ska aldrig behöva gissa
 * vilken hen utför.
 *
 * TOLKNINGEN SKER PÅ SERVERN, inte här. Lägesbilden är underlag för beslut
 * om rekonstruktion och konkurs; ett underlag klienten själv sätter ihop
 * är ett underlag klienten kan skriva vad som helst i.
 */

interface ImportBookkeepingProps {
  caseId: string;
  /** Körs när en fil lästs in, så att vyn kan hämta om lägesbilden. */
  onImported: () => void;
}

/** Samma tak som API:t sätter. Prövas här också, för att felet ska bli begripligt. */
const MAX_BYTES = 25 * 1024 * 1024;

export const ImportBookkeeping = ({ caseId, onImported }: ImportBookkeepingProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [läser, setLäser] = useState(false);
  const [fel, setFel] = useState<string | null>(null);
  const [klart, setKlart] = useState<string | null>(null);

  const hantera = async (file: File) => {
    setFel(null);
    setKlart(null);

    if (file.size === 0) {
      setFel("Filen är tom.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFel("Filen är större än 25 MB. Exportera ett enskilt räkenskapsår.");
      return;
    }

    setLäser(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const bild = await data.financial.importSie({ caseId, fileName: file.name, bytes });
      // Det som INTE gick att läsa sägs rakt ut. En lägesbild som ser
      // komplett ut men saknar halva bokföringen är farligare än ingen.
      const luckor = bild.gaps.length;
      setKlart(
        `${bild.companyName ?? "Bokföringen"} inläst.` +
          (luckor > 0 ? ` ${luckor} uppgifter saknas i filen och visas som luckor.` : ""),
      );
      onImported();
    } catch (error) {
      // Serverns besked går fram ordagrant: det är skrivet för att förklara
      // vad som är fel med just den här filen.
      setFel(error instanceof Error ? error.message : "Filen kunde inte läsas in.");
    } finally {
      setLäser(false);
    }
  };

  return (
    <div className="rounded-md border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <BookOpenCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Läs in bokföringen</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Exportera en SIE-fil ur bokföringsprogrammet – Fortnox, Visma, Bokio och
            övriga har det under Export – så räknas läget fram ur den. Filen sparas i
            ärendet, så att siffrorna går att visa för din rådgivare.
          </p>
        </div>
      </div>

      <div className="mt-4">
        <input
          ref={inputRef}
          type="file"
          accept=".se,.si,.sie,.txt"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void hantera(file);
            // Nollställs så att samma fil går att välja igen efter ett fel.
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={läser}
          onClick={() => inputRef.current?.click()}
        >
          {läser ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Läser filen…
            </>
          ) : (
            <>
              <FileUp className="h-4 w-4" aria-hidden="true" />
              Välj SIE-fil
            </>
          )}
        </Button>
      </div>

      {fel && (
        <p
          role="alert"
          className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {fel}
        </p>
      )}
      {klart && (
        <p
          role="status"
          className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-foreground"
        >
          <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-accent" aria-hidden="true" />
          {klart}
        </p>
      )}
    </div>
  );
};
