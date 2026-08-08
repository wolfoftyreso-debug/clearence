import { ShieldCheck } from "lucide-react";
import { DATA_MINIMERING_HINT } from "@/lib/dataMinimering";

/**
 * Den korta dataminimeringspåminnelsen, tänkt att stå intill ett
 * fritextfält. Diskret men läsbar - den ska ses av den som skriver, inte
 * gömmas i en policy ingen öppnar.
 */
export const DataMinimeringHint = ({ className = "" }: { className?: string }) => (
  <p className={`flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground ${className}`}>
    <ShieldCheck className="mt-0.5 h-3 w-3 flex-shrink-0" aria-hidden="true" />
    <span>{DATA_MINIMERING_HINT}</span>
  </p>
);
