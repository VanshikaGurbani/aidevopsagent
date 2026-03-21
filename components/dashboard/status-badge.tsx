import { cn } from "@/lib/utils"
import type { DeploymentStatus, IncidentSeverity, IncidentStatus } from "@/lib/types"

const deploymentStatusConfig: Record<DeploymentStatus, { label: string; color: string; dot: string }> = {
  ready:    { label: "Ready",    color: "text-status-success bg-status-success/10 border-status-success/20", dot: "bg-status-success" },
  building: { label: "Building", color: "text-status-info bg-status-info/10 border-status-info/20",    dot: "bg-status-info animate-pulse" },
  error:    { label: "Error",    color: "text-status-error bg-status-error/10 border-status-error/20",   dot: "bg-status-error" },
  canceled: { label: "Canceled", color: "text-status-neutral bg-status-neutral/10 border-status-neutral/20", dot: "bg-status-neutral" },
  queued:   { label: "Queued",   color: "text-status-warning bg-status-warning/10 border-status-warning/20", dot: "bg-status-warning" },
}

const severityConfig: Record<IncidentSeverity, { label: string; color: string; dot: string }> = {
  critical: { label: "Critical", color: "text-status-error bg-status-error/10 border-status-error/20",    dot: "bg-status-error animate-pulse" },
  high:     { label: "High",     color: "text-orange-400 bg-orange-400/10 border-orange-400/20",           dot: "bg-orange-400" },
  medium:   { label: "Medium",   color: "text-status-warning bg-status-warning/10 border-status-warning/20", dot: "bg-status-warning" },
  low:      { label: "Low",      color: "text-status-info bg-status-info/10 border-status-info/20",        dot: "bg-status-info" },
  info:     { label: "Info",     color: "text-muted-foreground bg-muted/20 border-border",                 dot: "bg-muted-foreground" },
}

const incidentStatusConfig: Record<IncidentStatus, { label: string; color: string }> = {
  open:          { label: "Open",          color: "text-status-error bg-status-error/10 border-status-error/20" },
  investigating: { label: "Investigating", color: "text-status-warning bg-status-warning/10 border-status-warning/20" },
  resolved:      { label: "Resolved",      color: "text-status-success bg-status-success/10 border-status-success/20" },
  dismissed:     { label: "Dismissed",     color: "text-muted-foreground bg-muted/20 border-border" },
}

interface StatusBadgeProps {
  type: "deployment" | "severity" | "incident"
  value: string
  className?: string
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  let config: { label: string; color: string; dot?: string }

  if (type === "deployment") {
    config = deploymentStatusConfig[value as DeploymentStatus] ?? { label: value, color: "text-muted-foreground bg-muted/20 border-border" }
  } else if (type === "severity") {
    config = severityConfig[value as IncidentSeverity] ?? { label: value, color: "text-muted-foreground bg-muted/20 border-border" }
  } else {
    config = incidentStatusConfig[value as IncidentStatus] ?? { label: value, color: "text-muted-foreground bg-muted/20 border-border" }
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[11px] font-medium font-mono", config.color, className)}>
      {config.dot && <span className={cn("w-1.5 h-1.5 rounded-full", config.dot)} />}
      {config.label}
    </span>
  )
}
