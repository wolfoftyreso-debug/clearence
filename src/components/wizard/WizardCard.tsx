import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WizardCardProps {
  children: ReactNode;
  className?: string;
}

export const WizardCard = ({ children, className }: WizardCardProps) => {
  return (
    <div className={cn(
      "bg-card rounded-md border border-border p-5 md:p-6 shadow-soft",
      className
    )}>
      {children}
    </div>
  );
};

interface WizardCardHeaderProps {
  title: string;
  description?: string;
}

export const WizardCardHeader = ({ title, description }: WizardCardHeaderProps) => {
  return (
    <div className="mb-5">
      <h3 className="text-lg font-display font-semibold text-foreground mb-1">
        {title}
      </h3>
      {description && (
        <p className="text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      )}
    </div>
  );
};
