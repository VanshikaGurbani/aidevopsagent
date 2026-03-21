export type DeploymentStatus = "building" | "ready" | "error" | "canceled" | "queued"
export type IncidentSeverity = "critical" | "high" | "medium" | "low" | "info"
export type IncidentStatus = "open" | "investigating" | "resolved" | "dismissed"
export type IncidentCategory = "deployment" | "security" | "performance" | "availability" | "configuration" | "code"
export type PRStatus = "open" | "merged" | "closed" | "draft"
export type ProjectStatus = "active" | "paused" | "archived"
export type SecurityEventSeverity = "critical" | "high" | "medium" | "low" | "info"

export interface MonitoredProject {
  id: string
  vercel_project_id: string
  name: string
  github_repo: string | null
  github_owner: string | null
  github_branch: string
  framework: string | null
  status: ProjectStatus
  created_at: string
  updated_at: string
}

export interface Deployment {
  id: string
  vercel_deployment_id: string
  project_id: string | null
  vercel_project_id: string
  project_name: string
  url: string | null
  status: DeploymentStatus
  target: "production" | "preview" | null
  branch: string | null
  commit_sha: string | null
  commit_message: string | null
  creator_name: string | null
  build_duration_ms: number | null
  error_message: string | null
  meta: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Incident {
  id: string
  project_id: string | null
  vercel_project_id: string | null
  title: string
  description: string | null
  severity: IncidentSeverity
  status: IncidentStatus
  category: IncidentCategory
  root_cause: string | null
  resolution: string | null
  agent_analysis: string | null
  related_deployment_id: string | null
  slack_notified: boolean
  pr_raised: boolean
  pr_url: string | null
  pr_number: number | null
  meta: Record<string, unknown>
  detected_at: string
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export interface PullRequest {
  id: string
  incident_id: string | null
  github_pr_number: number
  github_pr_url: string
  github_repo: string
  github_owner: string
  title: string
  body: string | null
  branch: string
  base_branch: string
  status: PRStatus
  files_changed: string[]
  agent_notes: string | null
  created_at: string
  updated_at: string
}

export interface SecurityEvent {
  id: string
  project_id: string | null
  vercel_project_id: string | null
  event_type: string
  severity: SecurityEventSeverity
  title: string
  description: string | null
  source: string | null
  raw_data: Record<string, unknown>
  acknowledged: boolean
  created_at: string
}

export interface AgentConversation {
  id: string
  title: string | null
  context: "general" | "deployment" | "security" | "incident" | "github"
  related_project_id: string | null
  related_incident_id: string | null
  message_count: number
  created_at: string
  updated_at: string
}

export interface AgentMessage {
  id: string
  conversation_id: string
  role: "user" | "assistant" | "tool"
  content: string
  tool_calls: unknown[]
  tool_results: unknown[]
  created_at: string
}

export interface DashboardStats {
  totalProjects: number
  activeDeployments: number
  openIncidents: number
  criticalIncidents: number
  recentDeployments: Deployment[]
  recentIncidents: Incident[]
  recentSecurityEvents: SecurityEvent[]
}
