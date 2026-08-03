import { useId } from "react";
import { cn } from "@/lib/utils";

interface DateSelectorProps {
  value: number;
  onChange: (value: number) => void;
  label?: string;
  helpText?: string;
  quickOptions?: number[];
}

export const DateSelector = ({ 
  value, 
  onChange, 
  label,
  helpText,
  quickOptions = [12, 23, 25, 27]
}: DateSelectorProps) => {
  const inputId = useId();

  return (
    <div className="space-y-3">
      {label && (
        <p className="block text-sm font-medium text-foreground">
          {label}
        </p>
      )}
      
      {/* Quick selection buttons */}
      <div className="flex flex-wrap gap-2">
        {quickOptions.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => onChange(day)}
            className={cn(
              "px-4 py-2 rounded-md border text-sm font-medium transition-colors",
              value === day
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-background border-border text-foreground hover:border-accent/50"
            )}
          >
            {day}:e
          </button>
        ))}
      </div>

      {/* Manual input */}
      <div className="flex items-center gap-2">
        <label htmlFor={inputId} className="text-sm text-muted-foreground">
          Eller ange dag:
        </label>
        <input
          id={inputId}
          type="number"
          min={1}
          max={31}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || 1)}
          className="w-20 px-3 py-2 rounded-md border border-border bg-background text-foreground text-center focus:outline-none focus:ring-2 focus:ring-accent"
        />
      </div>

      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};
