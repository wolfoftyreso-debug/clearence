import { Link } from "react-router";
import type { Insight, InsightSeverity } from "@/lib/financial/insights";
import { AlertCircle, AlertTriangle, ArrowRight, Info } from "lucide-react";

interface InsightListProps {
  insights: Insight[];
  /** Shown when there is nothing to say, so silence is never mistaken for "all clear". */
  emptyText?: string;
}

const ICON: Record<InsightSeverity, typeof AlertCircle> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const TONE: Record<InsightSeverity, string> = {
  critical: "border-l-destructive",
  warning: "border-l-warning",
  info: "border-l-accent",
};

const ICON_TONE: Record<InsightSeverity, string> = {
  critical: "text-destructive",
  warning: "text-warning",
  info: "text-accent",
};

/**
 * Renders what the assistant found.
 *
 * The evidence sits next to each claim rather than behind a disclosure. A
 * company in crisis is being asked to act on these numbers, and a number
 * someone has to click to verify is a number they will act on without
 * verifying.
 */
export const InsightList = ({ insights, emptyText }: InsightListProps) => {
  if (insights.length === 0) {
    return (
      <p className="rounded-md border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
        {emptyText ??
          "Inget att lyfta utifrån den data vi har. Det betyder inte att allt är bra – bara att vi inte hittade något i det vi kan se."}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {insights.map((insight) => {
        const Icon = ICON[insight.severity];
        return (
          <li
            key={insight.id}
            className={`rounded-md border border-l-4 border-border bg-card p-4 ${TONE[insight.severity]}`}
          >
            <div className="flex items-start gap-3">
              <Icon
                className={`mt-0.5 h-5 w-5 flex-shrink-0 ${ICON_TONE[insight.severity]}`}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-foreground">{insight.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {insight.detail}
                </p>

                {/* The claim and its key number live in the title/detail;
                    the row-by-row evidence sits one tap away behind a native
                    disclosure that says how many rows it holds (Excellence
                    rond 2: links replace expanded text, nothing is hidden
                    silently). Values are usually amounts, but not always: the
                    "missing datasets" insight puts a whole sentence here. A
                    non-shrinking value blew the layout past the viewport on a
                    phone, so the row stacks when there is no room and long
                    values wrap rather than push. */}
                {insight.evidence.length > 0 && (
                  <details className="mt-3 border-t border-border pt-3">
                    <summary className="cursor-pointer list-none text-sm font-medium text-accent underline-offset-4 hover:underline">
                      Visa underlaget ({insight.evidence.length}{" "}
                      {insight.evidence.length === 1 ? "post" : "poster"})
                    </summary>
                    <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                      {insight.evidence.map((row) => (
                        <div
                          key={row.label}
                          className="flex min-w-0 flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4"
                        >
                          <dt className="min-w-0 break-words text-muted-foreground">{row.label}</dt>
                          <dd className="min-w-0 break-words font-medium tabular-nums text-foreground sm:text-right">
                            {row.value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}

                {insight.action && (
                  <Link
                    to={insight.action.href}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-accent underline-offset-4 hover:underline"
                  >
                    {insight.action.label}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};
