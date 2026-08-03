# Designsystem: spacing och kortkomposition

**Version 1.0 · Excellence-kraven 6–7. Lintad av tests/spacing.ts -
en regel som inte testas är en åsikt.**

## Spacing-skalan

Fastställd utifrån produktens faktiska rytm - inte en idealskala som
ingen följer. Alla nya ytor använder stegen nedan; frihandsvärden
(`p-[18px]`, `mt-[13px]`) är förbjudna.

**Komponentsteg** (inuti kort, rader och formulär):

| px | Tailwind | Används till |
|---|---|---|
| 4 | `*-1` | tätaste luft: chip-innermått, ikonavstånd |
| 8 | `*-2` | radluft i listor, knappgap |
| 12 | `*-3` | fältluft i formulär |
| 16 | `*-4` | standardluft mellan block i ett kort |
| 20 | `*-5` | kortets standardpadding (`p-5`) och sektionsrytmen i det (`space-y-5`) |
| 24 | `*-6` | luft mellan kort på en sida |
| 32 | `*-8` | luft mellan sidans huvuddelar |

**Sektionssteg** (mellan ytor på publika sidor): 48/64/80 px
(`*-12`, `*-16`, `*-20`).

**Tillåtna undantag**, båda med skäl som inte är smak:

* `pb-14` - frizonen under den fasta bottennavigeringen (matchar
  navens höjd, inte en rytm).
* `src/components/ui/` - vendorerade primitiver (shadcn) granskas
  inte; de bär bibliotekets egna mått.

**Förbjudna steg:** 7, 9, 10, 11 (28/36/40/44 px) och alla
frihandsvärden. De låg utspridda i produkten (px-7-piller, gap-10,
py-10-spinnrar) och är normaliserade till skalan.

## Kortkompositionen: två korttyper, aldrig fler per sida

1. **Ytkortet** - `rounded-md border border-border bg-card`
   (+ `shadow-soft` där kortet är sidans primära yta, `p-5`).
   Sidans sektioner: analysen, planen, rapporten, samtalsytan.
2. **Radkortet** - `rounded-md border` med tonkant
   (`border-l-4` + lägesfärg) eller sekundär bakgrund, `p-3`/`p-3.5`.
   Rader i en lista: frister, uppgifter, insikter, panelrader.

Allt annat är någon av dessa två i annan klädsel - inte en tredje
typ. Hörnradien är `rounded-md` överallt utom pillerknappar och
avatarer (`rounded-full`) och statuschips (`rounded-sm`);
`rounded-lg`/`rounded-xl` utanför ui-biblioteket är städade och
återinförs inte.

## Regeln bakom reglerna

Skalan finns för att en sida ska kännas komponerad, inte staplad.
När ett nytt kort behöver ett mått som inte finns i skalan är det
nästan alltid kompositionen som är fel, inte skalan.
