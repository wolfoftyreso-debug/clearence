import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
  AreaChart,
} from "recharts";

/**
 * Det enda area-diagrammet i produkten, delat av likviditetsvyerna.
 * Bor i en egen fil för att recharts (~380 kB) ska ligga i en egen
 * chunk som laddas först när diagrammet faktiskt ska visas
 * (ChartSlot väntar på synlighet) - inte när sidan öppnas.
 */
export type CashflowChartProps = {
  data: object[];
  dataKey: string;
  xKey: string;
  /** CSS-färg för linjen och gradienten, t.ex. "hsl(var(--accent))". */
  color: string;
  /** Etiketten i tooltipen, t.ex. "Saldo" eller scenariots namn. */
  tooltipLabel: string;
  /** recharts interval för x-axelns etiketter (utelämnad = auto). */
  xTickInterval?: number;
  tickFontSize?: number;
};

const CashflowChart = ({
  data,
  dataKey,
  xKey,
  color,
  tooltipLabel,
  xTickInterval,
  tickFontSize = 12,
}: CashflowChartProps) => {
  const gradientId = `cashflow-${dataKey}`;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: tickFontSize, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={{ stroke: "hsl(var(--border))" }}
          {...(xTickInterval !== undefined ? { interval: xTickInterval } : {})}
        />
        <YAxis
          tick={{ fontSize: tickFontSize, fill: "hsl(var(--muted-foreground))" }}
          tickLine={false}
          axisLine={{ stroke: "hsl(var(--border))" }}
          tickFormatter={(value: number) => `${Math.round(value / 1000)}k`}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toLocaleString("sv-SE")} kr`, tooltipLabel]}
          labelStyle={{ color: "hsl(var(--foreground))" }}
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "6px",
          }}
        />
        <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="5 5" />
        <Area
          type="monotone"
          dataKey={dataKey}
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradientId})`}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export default CashflowChart;
