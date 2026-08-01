import { cn } from "@/lib/utils";

interface YesNoButtonsProps {
  value: boolean | null;
  onChange: (value: boolean) => void;
  yesLabel?: string;
  noLabel?: string;
}

export const YesNoButtons = ({ 
  value, 
  onChange, 
  yesLabel = "Ja", 
  noLabel = "Nej" 
}: YesNoButtonsProps) => {
  return (
    <div className="flex gap-3">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={cn(
          "flex-1 py-4 px-6 rounded-md border text-base font-medium transition-colors",
          value === true
            ? "bg-success/10 text-success border-success"
            : "bg-background border-border hover:border-success/50 text-foreground"
        )}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={cn(
          "flex-1 py-4 px-6 rounded-md border text-base font-medium transition-colors",
          value === false
            ? "bg-destructive/10 text-destructive border-destructive"
            : "bg-background border-border hover:border-destructive/50 text-foreground"
        )}
      >
        {noLabel}
      </button>
    </div>
  );
};
