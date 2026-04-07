declare module "asciichart" {
  export interface AsciichartCfg {
    offset?: number;
    padding?: string;
    height?: number;
    min?: number;
    max?: number;
    format?: (x: number, rowIndex: number) => string;
    colors?: string[];
    symbols?: string[];
  }
  export function plot(series: number[] | number[][], cfg?: AsciichartCfg): string;
  const mod: { plot: typeof plot };
  export default mod;
}
