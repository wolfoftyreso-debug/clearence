import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface WizardCardProps {
  children: ReactNode;
  className?: string;
  /**
   * Guidens ankarnamn. Kortet är den yta CLEARANCE pekar på när den
   * visar var något ligger, och attributet måste därför nå ända ut till
   * DOM:en - en komponent som sväljer det gör ankaret osynligt för
   * guiden utan att något klagar.
   */
  "data-guide"?: string;
  /**
   * DOM-id, för länkar som rullar hit (#fakturor). Samma skäl som ovan:
   * det måste nå ut till elementet, annars pekar ankarlänken på tomma
   * intet och sidan står still.
   */
  id?: string;
}

export const WizardCard = ({ children, className, "data-guide": guide, id }: WizardCardProps) => {
  return (
    <div
      id={id}
      data-guide={guide}
      className={cn(
        "bg-card rounded-md border border-border p-5 md:p-6 shadow-soft",
        className
      )}
    >
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
