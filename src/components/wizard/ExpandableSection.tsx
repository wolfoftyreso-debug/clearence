import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface ExpandableSectionProps {
  isOpen: boolean;
  children: ReactNode;
  className?: string;
}

export const ExpandableSection = ({ isOpen, children, className }: ExpandableSectionProps) => {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (contentRef.current) {
      setHeight(isOpen ? contentRef.current.scrollHeight : 0);
    }
  }, [isOpen, children]);

  return (
    <div
      className={cn(
        "overflow-hidden transition-colors duration-300 ease-out",
        className
      )}
      style={{ height: `${height}px` }}
    >
      <div ref={contentRef} className="pt-4">
        {children}
      </div>
    </div>
  );
};
