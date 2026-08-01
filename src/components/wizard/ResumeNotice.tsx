import { Button } from "@/components/ui/button";
import { History } from "lucide-react";

/**
 * Visas överst i en guide när sidan öppnats med återupptagen data.
 *
 * Utan den här raden ser återupptagningen ut som ett spöke: fält är ifyllda
 * med siffror man inte minns att man skrev, och det första en misstänksam
 * användare gör är att undra vem som fyllt i dem. En mening som säger vad som
 * hänt, och en knapp för att börja om, tar bort både förvirringen och
 * misstanken.
 */
export const ResumeNotice = ({ onReset }: { onReset: () => void }) => (
  <div
    className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-accent/30 bg-accent/5 p-4"
    role="status"
  >
    <History className="h-5 w-5 flex-shrink-0 text-accent" aria-hidden="true" />
    <p className="min-w-0 flex-1 text-sm leading-relaxed text-foreground">
      Vi har sparat det du fyllde i förra gången, lokalt i din webbläsare. Du
      fortsätter där du var.
    </p>
    <Button type="button" variant="outline" size="sm" onClick={onReset}>
      Börja om från början
    </Button>
  </div>
);
