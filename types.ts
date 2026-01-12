export interface NodeStyle {
  fillColor?: string;
  borderColor?: string;
  textColor?: string;
  fontSize?: number;
  lineColor?: string;
  lineStyle?: LineStyle;
  lineWidth?: number;
  nodeSize?: number; // Added for individual node sizing
}

export interface MindMapData {
  name: string;
  children?: MindMapData[];
  value?: number;
  description?: string;
  // Style overrides for specific node
  style?: NodeStyle;
  // D3 Simulation properties (optional, added during runtime)
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
  r?: number; 
  id?: string; 
}

export enum LayoutType {
  TREE = 'Tree',
  CLUSTER = 'Cluster',
  FISHBONE = 'Fishbone',
  TIMELINE = 'Timeline',
  LOGIC_TREE = 'LogicTree',
  CIRCLE_PACKING = 'CirclePacking'
}

export enum NodeShape {
  CIRCLE = 'Circle',
  RECTANGLE = 'Rectangle',
  ROUNDED_RECT = 'Rounded',
  PILL = 'Pill'
}

export enum EdgeStyle {
  CURVED = 'Curved',
  STRAIGHT = 'Straight',
  STEP = 'Step'
}

export enum LineStyle {
  SOLID = 'Solid',
  DASHED = 'Dashed',
  DOTTED = 'Dotted'
}

export enum ColorTheme {
  NOTEBOOK = 'Notebook', 
  DARK = 'Dark Neon',
  PASTEL = 'Pastel',
  MONOCHROME = 'Monochrome',
  PROFESSIONAL = 'Professional'
}

export interface MapStyleConfig {
  layout: LayoutType;
  nodeShape: NodeShape;
  edgeStyle: EdgeStyle;
  theme: ColorTheme;
  nodeSize: number;
  fontSize: number;
  strokeWidth: number;
  depthLimit: number;
  shadow: boolean; 
  freezeDrag: boolean;
  // Global Style Defaults
  lineColor: string;
  lineStyle: LineStyle;
  nodeColor: string;     // Default fill (if not using theme)
  borderColor: string;
  textColor: string;
  useThemeColors: boolean; // Toggle between Theme Palette and Custom Global Colors
}