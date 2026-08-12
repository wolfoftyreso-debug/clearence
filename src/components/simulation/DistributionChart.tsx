import { useId, useMemo, useState } from "react";

/**
 * FÖRDELNINGEN, RITAD.
 *
 * Diagrammet är den enda platsen där en beslutsfattare ser hela utfallet i
 * stället för ett tal. Fyra val styr hur det är byggt, och alla fyra
 * handlar om att inte lura läsaren:
 *
 * 1. HELA FÖRDELNINGEN SYNS, inte bara mitten. En stapel per intervall,
 *    hela vägen ut i svansarna. Det är svansen som avgör om ett bolag
 *    överlever, och att beskära den för att kurvan ska bli vacker är att
 *    dölja just det som betyder något.
 *
 * 2. P10, MEDIAN OCH P90 ÄR UTMÄRKTA I SJÄLVA BILDEN, inte bara i en
 *    tabell bredvid. Ett histogram utan percentiler tvingar ögat att
 *    uppskatta area, vilket ingen gör rätt.
 *
 * 3. MÅL OCH KRITISK GRÄNS RITAS SOM EGNA LINJER, och området på fel sida
 *    tonas. Frågan "hur troligt är det att vi klarar oss" ska gå att läsa
 *    ur bilden, inte räknas fram.
 *
 * 4. INGEN ANIMATION, INGEN 3D, INGA DEKORATIVA FÄRGER. Färg används bara
 *    där den bär betydelse: under den kritiska gränsen. Resten är samma
 *    grafitgrå som resten av produkten. Ett diagram som ser ut som en
 *    reklambild läses som en reklambild.
 *
 * SVG OCH INTE ETT DIAGRAMBIBLIOTEK: samma skäl som CashflowChart. Femtio
 * rader beräkning och några path-element är lättare att granska än ett
 * beroende, och produkten har noll externa anrop att försvara.
 */

export interface HistogramData {
  kanter: number[];
  antal: number[];
}

export interface DistributionChartProps {
  histogram: HistogramData;
  percentiler: { p10: number; p50: number; p90: number };
  medel: number;
  /** Målvärdet, om ett finns. Ritas som en linje. */
  mal?: number | null;
  /** Kritisk gräns. Området under tonas. */
  kritiskGrans?: number | null;
  enhet?: string | null;
  /** Formaterar ett värde för axeln och rutan. */
  format?: (v: number) => string;
}

const standardFormat = (v: number): string => {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${(v / 1e9).toFixed(1)} mdr`;
  if (abs >= 1e6) return `${(v / 1e6).toFixed(1)} mn`;
  if (abs >= 1e4) return `${Math.round(v / 1000)} tkr`;
  return Math.round(v).toLocaleString("sv-SE");
};

/** Ritytan. viewBox-koordinater; SVG:n skalar sedan till sin behållare. */
const B = 720;
const H = 260;
const MARGINAL = { topp: 16, hoger: 12, botten: 34, vanster: 12 };

export const DistributionChart = ({
  histogram,
  percentiler,
  medel,
  mal = null,
  kritiskGrans = null,
  enhet = null,
  format = standardFormat,
}: DistributionChartProps) => {
  const rubrikId = useId();
  const [hovrad, setHovrad] = useState<number | null>(null);

  const modell = useMemo(() => {
    const { kanter, antal } = histogram;
    if (antal.length === 0 || kanter.length < 2) return null;

    const min = kanter[0];
    const max = kanter[kanter.length - 1];
    const spann = max - min || 1;
    const hogst = Math.max(...antal);
    const totalt = antal.reduce((a, b) => a + b, 0) || 1;

    const bredd = B - MARGINAL.vanster - MARGINAL.hoger;
    const hojd = H - MARGINAL.topp - MARGINAL.botten;
    const x = (v: number) => MARGINAL.vanster + ((v - min) / spann) * bredd;
    const y = (n: number) => MARGINAL.topp + hojd - (n / hogst) * hojd;

    const staplar = antal.map((n, i) => {
      const vx = x(kanter[i]);
      const vBredd = Math.max(0.5, x(kanter[i + 1]) - vx - 0.5);
      return {
        i,
        x: vx,
        bredd: vBredd,
        y: y(n),
        hojd: MARGINAL.topp + hojd - y(n),
        antal: n,
        fran: kanter[i],
        till: kanter[i + 1],
        andel: n / totalt,
        // Under den kritiska gränsen: den enda platsen färg används.
        kritisk: kritiskGrans !== null && kanter[i + 1] <= kritiskGrans,
      };
    });

    return { min, max, x, y, staplar, golv: MARGINAL.topp + hojd, hojd };
  }, [histogram, kritiskGrans]);

  if (!modell) {
    return (
      <p className="text-sm text-muted-foreground">
        Fördelningen kunde inte ritas – körningen gav inga sampel.
      </p>
    );
  }

  const { x, staplar, golv } = modell;
  const markorer: { v: number; etikett: string; tjock: boolean }[] = [
    { v: percentiler.p10, etikett: "P10", tjock: false },
    { v: percentiler.p50, etikett: "Median", tjock: true },
    { v: percentiler.p90, etikett: "P90", tjock: false },
  ];

  const aktiv = hovrad === null ? null : staplar[hovrad];

  return (
    <figure className="w-full">
      <svg
        viewBox={`0 0 ${B} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-labelledby={rubrikId}
        preserveAspectRatio="none"
      >
        <title id={rubrikId}>
          {`Fördelning av simuleringens utfall. Median ${format(percentiler.p50)}${enhet ? " " + enhet : ""}, ` +
            `P10 ${format(percentiler.p10)}, P90 ${format(percentiler.p90)}.`}
        </title>

        {/* Området mellan P10 och P90: där fyra av fem utfall hamnar. */}
        <rect
          x={x(percentiler.p10)}
          y={MARGINAL.topp}
          width={Math.max(0, x(percentiler.p90) - x(percentiler.p10))}
          height={golv - MARGINAL.topp}
          className="fill-muted/40"
        />

        {staplar.map((s) => (
          <rect
            key={s.i}
            x={s.x}
            y={s.y}
            width={s.bredd}
            height={Math.max(0, s.hojd)}
            className={
              s.kritisk
                ? "fill-destructive/70"
                : hovrad === s.i
                  ? "fill-foreground"
                  : "fill-foreground/70"
            }
            onMouseEnter={() => setHovrad(s.i)}
            onMouseLeave={() => setHovrad(null)}
          />
        ))}

        {/* Baslinjen. */}
        <line x1={MARGINAL.vanster} y1={golv} x2={B - MARGINAL.hoger} y2={golv} className="stroke-border" strokeWidth={1} />

        {markorer.map((m) => (
          <g key={m.etikett}>
            <line
              x1={x(m.v)}
              y1={MARGINAL.topp}
              x2={x(m.v)}
              y2={golv}
              className="stroke-foreground"
              strokeWidth={m.tjock ? 2 : 1}
              strokeDasharray={m.tjock ? undefined : "3 3"}
            />
            <text x={x(m.v)} y={MARGINAL.topp - 4} textAnchor="middle" className="fill-muted-foreground text-[10px]">
              {m.etikett}
            </text>
          </g>
        ))}

        {/* Medelvärdet. Prickat, för att skilja det från medianen - i en
            skev fördelning ligger de olika, och skillnaden är information. */}
        <line
          x1={x(medel)}
          y1={MARGINAL.topp}
          x2={x(medel)}
          y2={golv}
          className="stroke-muted-foreground"
          strokeWidth={1}
          strokeDasharray="1 3"
        />

        {mal !== null && mal >= modell.min && mal <= modell.max && (
          <g>
            <line x1={x(mal)} y1={MARGINAL.topp} x2={x(mal)} y2={golv} className="stroke-accent" strokeWidth={2} />
            <text x={x(mal)} y={golv + 22} textAnchor="middle" className="fill-accent text-[10px] font-semibold">
              Mål
            </text>
          </g>
        )}
        {kritiskGrans !== null && kritiskGrans >= modell.min && kritiskGrans <= modell.max && (
          <line
            x1={x(kritiskGrans)}
            y1={MARGINAL.topp}
            x2={x(kritiskGrans)}
            y2={golv}
            className="stroke-destructive"
            strokeWidth={2}
          />
        )}

        {/* Axeln: bara ytterkanterna och mitten. Fler tal blir brus. */}
        <text x={MARGINAL.vanster} y={golv + 14} className="fill-muted-foreground text-[10px]">
          {format(modell.min)}
        </text>
        <text x={B / 2} y={golv + 14} textAnchor="middle" className="fill-muted-foreground text-[10px]">
          {format((modell.min + modell.max) / 2)}
        </text>
        <text x={B - MARGINAL.hoger} y={golv + 14} textAnchor="end" className="fill-muted-foreground text-[10px]">
          {format(modell.max)}
        </text>
      </svg>

      {/*
        Exakta värden under bilden och inte som en flytande ruta: en tooltip
        går inte att nå med tangentbord och syns inte i en utskrift, och det
        här underlaget skrivs ut och tas med till möten.
      */}
      <figcaption className="mt-2 min-h-[1.25rem] text-xs leading-relaxed text-muted-foreground">
        {aktiv ? (
          <span>
            {format(aktiv.fran)} – {format(aktiv.till)}
            {enhet ? ` ${enhet}` : ""}:{" "}
            <span className="font-semibold text-foreground">
              {aktiv.antal.toLocaleString("sv-SE")} utfall ({(aktiv.andel * 100).toFixed(1)} %)
            </span>
          </span>
        ) : (
          <span>
            Det skuggade fältet rymmer 80 % av utfallen (P10–P90). Heldragen linje är medianen,
            prickad är medelvärdet.
          </span>
        )}
      </figcaption>
    </figure>
  );
};

/**
 * DEN KUMULATIVA KURVAN.
 *
 * Histogrammet svarar på "var hamnar det troligen". Den här svarar på den
 * fråga någon faktiskt ställer: "hur stor är sannolikheten att vi når minst
 * X?" Den går att läsa av med fingret, vilket ett histogram inte gör.
 *
 * Kurvan ritas SJUNKANDE (andel som når MINST värdet) i stället för den
 * matematiska CDF:en (andel som understiger). Det är samma information
 * spegelvänd, men den formen matchar frågan och slipper ett "1 minus" i
 * huvudet på läsaren.
 */
export interface CumulativeChartProps {
  histogram: HistogramData;
  mal?: number | null;
  enhet?: string | null;
  format?: (v: number) => string;
}

export const CumulativeChart = ({
  histogram,
  mal = null,
  enhet = null,
  format = standardFormat,
}: CumulativeChartProps) => {
  const rubrikId = useId();
  const [hovrad, setHovrad] = useState<number | null>(null);

  const modell = useMemo(() => {
    const { kanter, antal } = histogram;
    if (antal.length === 0 || kanter.length < 2) return null;
    const totalt = antal.reduce((a, b) => a + b, 0) || 1;

    // Andelen som når MINST varje kant, från vänster.
    const punkter: { v: number; andel: number }[] = [];
    let kvar = totalt;
    for (let i = 0; i < antal.length; i++) {
      punkter.push({ v: kanter[i], andel: kvar / totalt });
      kvar -= antal[i];
    }
    punkter.push({ v: kanter[kanter.length - 1], andel: 0 });

    const min = kanter[0];
    const max = kanter[kanter.length - 1];
    const spann = max - min || 1;
    const bredd = B - MARGINAL.vanster - MARGINAL.hoger;
    const hojd = H - MARGINAL.topp - MARGINAL.botten;
    const x = (v: number) => MARGINAL.vanster + ((v - min) / spann) * bredd;
    const y = (a: number) => MARGINAL.topp + hojd - a * hojd;

    const d = punkter.map((p, i) => `${i === 0 ? "M" : "L"} ${x(p.v).toFixed(2)} ${y(p.andel).toFixed(2)}`).join(" ");
    return { punkter, x, y, d, min, max, golv: MARGINAL.topp + hojd };
  }, [histogram]);

  if (!modell) return null;
  const { x, y, d, golv, punkter } = modell;
  const aktiv = hovrad === null ? null : punkter[hovrad];

  return (
    <figure className="w-full">
      <svg viewBox={`0 0 ${B} ${H}`} className="h-auto w-full" role="img" aria-labelledby={rubrikId} preserveAspectRatio="none">
        <title id={rubrikId}>Kumulativ sannolikhet: andelen utfall som når minst ett givet värde.</title>

        {[0.25, 0.5, 0.75].map((a) => (
          <g key={a}>
            <line x1={MARGINAL.vanster} y1={y(a)} x2={B - MARGINAL.hoger} y2={y(a)} className="stroke-border" strokeWidth={1} strokeDasharray="2 4" />
            <text x={MARGINAL.vanster} y={y(a) - 3} className="fill-muted-foreground text-[10px]">
              {a * 100} %
            </text>
          </g>
        ))}

        <path d={d} className="fill-none stroke-foreground" strokeWidth={2} />

        {mal !== null && mal >= modell.min && mal <= modell.max && (
          <line x1={x(mal)} y1={MARGINAL.topp} x2={x(mal)} y2={golv} className="stroke-accent" strokeWidth={2} />
        )}

        {/* Osynliga träffytor: kurvan själv är för smal att peka på. */}
        {punkter.map((p, i) => (
          <rect
            key={i}
            x={x(p.v) - 4}
            y={MARGINAL.topp}
            width={8}
            height={golv - MARGINAL.topp}
            className="fill-transparent"
            onMouseEnter={() => setHovrad(i)}
            onMouseLeave={() => setHovrad(null)}
          />
        ))}

        <line x1={MARGINAL.vanster} y1={golv} x2={B - MARGINAL.hoger} y2={golv} className="stroke-border" strokeWidth={1} />
      </svg>
      <figcaption className="mt-2 min-h-[1.25rem] text-xs leading-relaxed text-muted-foreground">
        {aktiv ? (
          <span className="text-foreground">
            <span className="font-semibold">{(aktiv.andel * 100).toFixed(1)} %</span> sannolikhet att
            resultatet blir minst {format(aktiv.v)}
            {enhet ? ` ${enhet}` : ""}.
          </span>
        ) : (
          <span>Kurvan visar sannolikheten att nå MINST ett givet värde. Peka för att läsa av.</span>
        )}
      </figcaption>
    </figure>
  );
};
