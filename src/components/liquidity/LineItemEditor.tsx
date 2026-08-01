import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AmountInput } from "@/components/wizard/AmountInput";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";

export interface LineItemDraft {
  label: string;
  amount: number;
  recurring: boolean;
  dayOfMonth: number;
  date: string;
}

export interface LineItemRow extends LineItemDraft {
  id: string;
  /**
   * Set on rows read out of a bank statement. Those amounts are what actually
   * left the account, so they must not have employer contributions added on
   * top - the payment to Skatteverket is already its own row in the statement.
   */
  fromStatement?: boolean;
}

interface LineItemEditorProps {
  items: LineItemRow[];
  onAdd: (item: LineItemDraft) => void;
  onRemove: (id: string) => void;
  /** Placeholder for the description field, e.g. "T.ex. Kontorshyra". */
  labelPlaceholder: string;
  /** One-tap chips that prefill the description. */
  suggestions?: string[];
  /** Default day-of-month for new recurring rows. */
  defaultDay?: number;
  /** Whether new rows default to monthly. */
  defaultRecurring?: boolean;
  /** Shown above the list when there is nothing yet. */
  emptyHint: string;
  /** "out" renders amounts in red with a minus, "in" green with a plus. */
  direction: "in" | "out";
}

const parseAmount = (value: string): number => parseInt(value.replace(/\s/g, ""), 10) || 0;

export const LineItemEditor = ({
  items,
  onAdd,
  onRemove,
  labelPlaceholder,
  suggestions = [],
  defaultDay = 25,
  defaultRecurring = true,
  emptyHint,
  direction,
}: LineItemEditorProps) => {
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [recurring, setRecurring] = useState(defaultRecurring);
  const [dayOfMonth, setDayOfMonth] = useState(defaultDay);
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = parseAmount(amount);
    if (!label.trim() || parsed <= 0) return;
    onAdd({ label: label.trim(), amount: parsed, recurring, dayOfMonth, date });
    setLabel("");
    setAmount("");
  };

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <div className="space-y-4">
      {/* Existing rows */}
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground bg-secondary/50 rounded-md p-4">{emptyHint}</p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border overflow-hidden">
          {items.map((item) => (
            <li key={item.id} className="flex items-center gap-3 p-3 bg-card">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-foreground truncate">{item.label}</p>
                <p className="text-xs text-muted-foreground">
                  {item.recurring
                    ? `Varje månad, den ${item.dayOfMonth}:e`
                    : `En gång, ${item.date}`}
                </p>
              </div>
              <span
                className={`font-semibold tabular-nums ${
                  direction === "out" ? "text-foreground" : "text-emerald-600"
                }`}
              >
                {direction === "out" ? "−" : "+"}
                {item.amount.toLocaleString("sv-SE")} kr
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onRemove(item.id)}
                aria-label={`Ta bort ${item.label}`}
              >
                <Trash2 className="w-4 h-4 text-muted-foreground" />
              </Button>
            </li>
          ))}
          <li className="flex items-center justify-between p-3 bg-secondary/40">
            <span className="text-sm font-medium text-foreground">Summa per tillfälle</span>
            <span className="font-semibold tabular-nums text-foreground">
              {total.toLocaleString("sv-SE")} kr
            </span>
          </li>
        </ul>
      )}

      {/* Quick-fill chips */}
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setLabel(s)}
              className="px-3 py-1.5 rounded-full border border-border bg-background text-sm text-muted-foreground hover:border-accent/50 hover:text-foreground transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleSubmit} className="space-y-3 p-4 rounded-md border border-border bg-background">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder={labelPlaceholder}
            aria-label="Beskrivning"
          />
          <AmountInput value={amount} onChange={setAmount} placeholder="0" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setRecurring(true)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                recurring ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"
              }`}
            >
              Varje månad
            </button>
            <button
              type="button"
              onClick={() => setRecurring(false)}
              className={`px-3 py-2 text-sm font-medium transition-colors ${
                !recurring ? "bg-accent text-accent-foreground" : "bg-background text-muted-foreground"
              }`}
            >
              En gång
            </button>
          </div>

          {recurring ? (
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              den
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Math.min(31, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                className="w-16 px-2 py-2 rounded-lg border border-border bg-background text-center"
                aria-label="Dag i månaden"
              />
              :e
            </label>
          ) : (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
              aria-label="Datum"
            />
          )}

          <Button type="submit" variant="outline" size="sm" className="ml-auto">
            <Plus className="w-4 h-4" />
            Lägg till
          </Button>
        </div>
      </form>
    </div>
  );
};
