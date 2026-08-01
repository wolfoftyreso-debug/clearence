import { useId } from "react";
import { cn } from "@/lib/utils";

interface AmountInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  helpText?: string;
  className?: string;
}

export const AmountInput = ({ 
  value, 
  onChange, 
  placeholder = "0",
  label,
  helpText,
  className
}: AmountInputProps) => {
  const inputId = useId();

  const formatAmount = (input: string): string => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, '');
    // Add thousand separators
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatAmount(e.target.value);
    onChange(formatted);
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
          {label}
        </label>
      )}
      <div className="relative">
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          value={value}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full px-4 py-3.5 pr-12 rounded-md border border-border bg-background text-foreground text-lg focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent transition-colors"
        />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
          kr
        </span>
      </div>
      {helpText && (
        <p className="text-xs text-muted-foreground">{helpText}</p>
      )}
    </div>
  );
};
