// Shared, theme-aware chart color palette. Every chart-bearing page should
// pull colors from here via `getChartPalette(resolvedTheme)` instead of
// hardcoding its own hex array — keeps chart color language consistent
// across the app and correct in both light and dark mode.

export interface ChartSeriesColor {
  line: string;
  fill: string;
}

export interface ChartPalette {
  /** Ordered colors for categorical charts (pie/doughnut/multi-bar). */
  categorical: string[];
  series: {
    brand: ChartSeriesColor;
    blue: ChartSeriesColor;
    emerald: ChartSeriesColor;
    amber: ChartSeriesColor;
    violet: ChartSeriesColor;
    rose: ChartSeriesColor;
    cyan: ChartSeriesColor;
  };
  /** Axis gridline color. */
  grid: string;
  /** Axis tick/label color. */
  tick: string;
  /**
   * Matches --color-background-primary for this theme. Canvas can't resolve
   * CSS custom properties, so chart elements that need to blend into the
   * page background (e.g. doughnut segment borders) use this instead of
   * `var(--color-background-primary)`.
   */
  surface: string;
}

const light: ChartPalette = {
  categorical: ['#0284c7', '#16a34a', '#ca8a04', '#7c3aed', '#dc2626', '#0891b2'],
  series: {
    brand: { line: '#ca8a04', fill: 'rgba(202, 138, 4, 0.16)' },
    blue: { line: '#2563eb', fill: 'rgba(37, 99, 235, 0.14)' },
    emerald: { line: '#059669', fill: 'rgba(5, 150, 105, 0.16)' },
    amber: { line: '#d97706', fill: 'rgba(217, 119, 6, 0.18)' },
    violet: { line: '#7c3aed', fill: 'rgba(124, 58, 237, 0.16)' },
    rose: { line: '#e11d48', fill: 'rgba(225, 29, 72, 0.16)' },
    cyan: { line: '#0891b2', fill: 'rgba(8, 145, 178, 0.16)' },
  },
  grid: 'rgba(68, 64, 60, 0.08)',
  tick: '#78716c',
  surface: '#ffffff',
};

const dark: ChartPalette = {
  categorical: ['#38bdf8', '#4ade80', '#facc15', '#a78bfa', '#f87171', '#22d3ee'],
  series: {
    brand: { line: '#facc15', fill: 'rgba(250, 204, 21, 0.18)' },
    blue: { line: '#60a5fa', fill: 'rgba(96, 165, 250, 0.18)' },
    emerald: { line: '#4ade80', fill: 'rgba(74, 222, 128, 0.18)' },
    amber: { line: '#fbbf24', fill: 'rgba(251, 191, 36, 0.2)' },
    violet: { line: '#a78bfa', fill: 'rgba(167, 139, 250, 0.18)' },
    rose: { line: '#fb7185', fill: 'rgba(251, 113, 133, 0.18)' },
    cyan: { line: '#22d3ee', fill: 'rgba(34, 211, 238, 0.18)' },
  },
  grid: 'rgba(214, 211, 209, 0.12)',
  tick: '#a8a29e',
  surface: '#0c0a09',
};

export function getChartPalette(resolvedTheme: 'light' | 'dark'): ChartPalette {
  return resolvedTheme === 'dark' ? dark : light;
}
