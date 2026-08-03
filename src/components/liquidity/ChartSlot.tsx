import { Suspense, lazy, useEffect, useRef, useState } from "react";
import type { CashflowChartProps } from "./CashflowChart";

const CashflowChart = lazy(() => import("./CashflowChart"));

/**
 * Diagramplatsen: renderar ett tyst skelett tills rutan faktiskt är
 * synlig i viewporten - först då hämtas diagram-chunken (recharts).
 * Excellence-krav 11: sidan ska inte betala 380 kB för ett diagram
 * som läsaren kanske aldrig scrollar till.
 */
export const ChartSlot = (props: CashflowChartProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || inView) return;
    if (!("IntersectionObserver" in window)) {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setInView(true);
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView]);

  return (
    <div ref={ref} className="h-full w-full">
      {inView ? (
        <Suspense fallback={<div className="h-full w-full animate-pulse rounded-md bg-secondary/50" />}>
          <CashflowChart {...props} />
        </Suspense>
      ) : (
        <div className="h-full w-full rounded-md bg-secondary/30" aria-hidden="true" />
      )}
    </div>
  );
};
