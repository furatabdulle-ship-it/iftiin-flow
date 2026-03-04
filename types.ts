export enum SlideType {
  TEXT = 'TEXT',
  CHART = 'CHART',
  LIST = 'LIST',
  QUOTE = 'QUOTE',
  STATS = 'STATS',
  TIMELINE = 'TIMELINE'
}

export interface SlideData {
  id: number;
  type: SlideType;
  title: string;
  subtitle?: string;
  content: string[];
  chartData?: Array<{ name: string; value: number }>;
  statsData?: Array<{ label: string; value: string }>;
}