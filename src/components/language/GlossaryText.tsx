import { useEffect, useState } from "react";
import {
  acceptSimplerSuggestion,
  adaptText,
  dismissSimplerSuggestion,
  getLanguageLevel,
  LANGUAGE_EVENT,
  LANGUAGE_LEVELS,
  recordGlossaryClick,
  segmentText,
  setLanguageLevel,
  shouldSuggestSimpler,
  type GlossaryEntry,
  type LanguageLevel,
} from "@/lib/language";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

/**
 * De klickbara juridiska begreppen och språknivåväljaren.
 *
 * Varje fackterm i en text renderad genom GlossaryText går att klicka:
 * förklaringen öppnas där ordet står, i klarspråk, utan att läsaren
 * skickas någon annanstans. Klicken räknas - upprepade klick är signalen
 * som får systemet att EN gång föreslå enklare språk.
 */

/** Reagerar på språkbyten var de än görs (inställningar, mobilmeny, banner). */
export const useLanguageLevel = (): LanguageLevel => {
  const [level, setLevel] = useState<LanguageLevel>(getLanguageLevel);
  useEffect(() => {
    const update = () => setLevel(getLanguageLevel());
    window.addEventListener(LANGUAGE_EVENT, update);
    return () => window.removeEventListener(LANGUAGE_EVENT, update);
  }, []);
  return level;
};

const TermPopover = ({ entry, onClose }: { entry: GlossaryEntry; onClose: () => void }) => (
  <span className="absolute left-0 top-full z-40 mt-1 block w-72 max-w-[80vw] rounded-md border border-border bg-card p-3 text-left shadow-medium">
    <span className="flex items-start justify-between gap-2">
      <span className="block text-sm font-semibold text-foreground">{entry.term}</span>
      <button type="button" onClick={onClose} aria-label="Stäng förklaringen" className="text-muted-foreground hover:text-foreground">
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </span>
    <span className="mt-1 block text-xs font-normal leading-relaxed text-muted-foreground">
      {entry.explanation}
    </span>
  </span>
);

/**
 * Text med klickbara begrepp, anpassad till läsarens språknivå.
 * Innehållet är detsamma på alla nivåer - bara språket och pedagogiken
 * ändras, och det är motorn i src/lib/language.ts som garanterar det.
 */
export const GlossaryText = ({ text, as: Tag = "p", className }: { text: string; as?: "p" | "span"; className?: string }) => {
  const level = useLanguageLevel();
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  const adapted = adaptText(text, level);

  return (
    <Tag className={className}>
      {segmentText(adapted).map((segment, index) =>
        segment.entry ? (
          <span key={`${segment.text}-${index}`} className="relative inline-block">
            <button
              type="button"
              onClick={() => {
                recordGlossaryClick();
                setOpenTerm(openTerm === `${index}` ? null : `${index}`);
              }}
              aria-expanded={openTerm === `${index}`}
              className="cursor-help border-b border-dotted border-accent text-inherit hover:text-accent"
            >
              {segment.text}
            </button>
            {openTerm === `${index}` && (
              <TermPopover entry={segment.entry} onClose={() => setOpenTerm(null)} />
            )}
          </span>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </Tag>
  );
};

/** Språkprofilväljaren: fyra nivåer, beskrivna med vad de gör för läsaren. */
export const LanguageLevelPicker = () => {
  const level = useLanguageLevel();
  return (
    <div className="space-y-1.5">
      {LANGUAGE_LEVELS.map((option) => (
        <label
          key={option.id}
          className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
            level === option.id ? "border-accent bg-accent/5" : "border-border hover:border-accent/50"
          }`}
        >
          <input
            type="radio"
            name="language-level"
            value={option.id}
            checked={level === option.id}
            onChange={() => setLanguageLevel(option.id)}
            className="mt-1 h-4 w-4 accent-accent"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-foreground">{option.label}</span>
            <span className="block text-xs leading-relaxed text-muted-foreground">{option.description}</span>
          </span>
        </label>
      ))}
      <p className="pt-1 text-xs leading-relaxed text-muted-foreground">
        Innehållet är detsamma på alla nivåer. Bara språket anpassas – aldrig
        innebörden.
      </p>
    </div>
  );
};

/**
 * Förslaget: efter upprepade begreppsklick frågar systemet EN gång om
 * enklare språk. Ett nej sparas och frågan återkommer inte - det är
 * texten som ska anpassa sig, aldrig användaren som ska känna sig dum.
 */
export const SimplerLanguageSuggestion = () => {
  const [, force] = useState(0);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    window.addEventListener(LANGUAGE_EVENT, update);
    return () => window.removeEventListener(LANGUAGE_EVENT, update);
  }, []);

  if (!shouldSuggestSimpler()) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-accent/40 bg-accent/5 p-3">
      <p className="min-w-0 flex-1 text-sm text-foreground">
        Vill du att CLEARANCE använder enklare språk i fortsättningen?
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={acceptSimplerSuggestion}>
          Ja, använd enklare språk
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={dismissSimplerSuggestion}>
          Nej tack
        </Button>
      </div>
    </div>
  );
};
