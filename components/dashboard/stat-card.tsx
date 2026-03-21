import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: number | string
  icon: LucideIcon
  trend?: string
  accent?: "default" | "success" | "warning" | "error" | "info"
  className?: string
}

const accentClasses = {
  default: "border-border text-foreground",
  success: "border-status-success/30 text-status-success",
  warning: "border-status-warning/30 text-status-warning",
  error:   "border-status-error/30 text-status-error",
  info:    "border-status-info/30 text-status-info",
}

const iconBgClasses = {
  default: "bg-muted text-muted-foreground",
  success: "bg-status-success/10 text-status-success",
  warning: "bg-status-warning/10 text-status-warning",
  error:   "bg-status-error/10 text-status-error",
  info:    "bg-status-info/10 text-status-info",
}

export function StatCard({ title, value, icon: Icon, trend, accent = "default", className }: StatCardProps) {
  return (
    <div className={cn("flex flex-col gap-3 p-4 rounded-lg bg-card border", accentClasses[accent], className)}>
      <div className="flex items-start justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{title}</p>
        <div className={cn("p-1.5 rounded-md", iconBgClasses[accent])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-semibold font-mono tabular-nums">{value}</p>
        {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
      </div>
    </div>
  )
}
