// WBS (Work Breakdown Structure) domain types
// Mirrors project_wbs_nodes and project_dependencies tables

export type WBSLevel = 'macro' | 'activity' | 'task'
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'
export type GanttScale = 'weekly' | 'monthly' | 'quarterly' | 'yearly'
export type ProjectType = 'contract' | 'internal' | 'alliance'
export type ProgressMode = 'computed' | 'manual'
export type NodeStatus = 'pending' | 'in_progress' | 'done' | 'blocked'
export type NodePriority = 'low' | 'medium' | 'high' | 'urgent'

export interface WBSNode {
  id: string
  project_id: string
  parent_id: string | null
  level: WBSLevel
  position: number
  title: string
  description: string | null
  is_milestone: boolean
  status: NodeStatus
  priority: NodePriority
  start_at: string | null
  due_at: string | null
  completed_at: string | null
  assigned_to: string | null
  progress_mode: ProgressMode
  progress_pct: number | null
  created_by: string
  created_at: string
  updated_at: string
  // Client-side tree navigation (populated by buildTree)
  children?: WBSNode[]
  // Client-side computed progress (populated by getNodeProgress)
  computedProgress?: number
}

export interface Dependency {
  id: string
  project_id: string
  predecessor_id: string
  successor_id: string
  dep_type: DependencyType
  lag_days: number
  created_by: string
  created_at: string
}

/** Summary used in portfolio view and dashboard */
export interface PortfolioProjectSummary {
  id: string
  title: string
  stage: string
  project_type: ProjectType
  start_date: string | null
  due_date: string | null
  /** 0-100 */
  progress: number
  color: string | null
  contact_name: string | null
  assigned_to_name: string | null
  macro_count: number
  task_done: number
  task_total: number
}

/** Map built by GanttV2 while rendering rows; used by DependencyLayer for SVG arrows */
export interface GanttBarRect {
  /** Left edge as fraction 0-1 of the total timeline width */
  leftFraction: number
  /** Right edge as fraction 0-1 */
  rightFraction: number
  /** Center Y in pixels from the top of the scrollable timeline area */
  rowCenterY: number
}

export type NodeBarMap = Map<string, GanttBarRect>

/** Weather data for WeatherWidget */
export interface WeatherDay {
  date: string           // ISO date string  'YYYY-MM-DD'
  temp_min: number       // Celsius
  temp_max: number       // Celsius
  description: string
  icon: string           // OpenWeather icon code e.g. '04d'
  /** Probability of precipitation 0-1 */
  pop: number
}

export interface WeatherData {
  city: string
  updated_at: string     // ISO datetime of last fetch
  current: {
    temp: number
    feels_like: number
    description: string
    icon: string
    humidity: number
    wind_speed: number   // m/s
    wind_deg: number
    /** mm rain last 1h — may be undefined if no rain */
    rain_1h?: number
    clouds: number       // %
  }
  forecast: WeatherDay[] // 5 days
}
