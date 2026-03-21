import { createClient } from "@/lib/supabase/server"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { ShieldAlert, ShieldCheck, Eye, Clock } from "lucide-react"
import type { SecurityEvent } from "@/lib/types"
import Link from "next/link"

export const revalidate = 30

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

const eventTypeLabels: Record<string, string> = {
  automated_scan: "Auto Scan",
  unauthorized_access: "Auth Failure",
  secret_scan: "Secret Scan",
  config_issue: "Config Issue",
  vulnerability: "Vulnerability",
  deployment_security: "Deploy Check",
}

export default async function SecurityPage() {
  const supabase = await createClient()

  const [
    { data: events },
    { count: criticalCount },
    { count: highCount },
    { count: unacknowledgedCount },
  ] = await Promise.all([
    supabase.from("security_events").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("security_events").select("*", { count: "exact", head: true }).eq("severity", "critical"),
    supabase.from("security_events").select("*", { count: "exact", head: true }).eq("severity", "high"),
    supabase.from("security_events").select("*", { count: "exact", head: true }).eq("acknowledged", false),
  ])

  const securityEvents = (events ?? []) as SecurityEvent[]
  const unacknowledged = securityEvents.filter((e) => !e.acknowledged)
  const acknowledged = securityEvents.filter((e) => e.acknowledged)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Security Monitor</h1>
          <p className="text-sm text-muted-foreground mt-0.5">24/7 automated security event feed</p>
        </div>
        <Link
          href="/agent"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border text-xs text-foreground hover:bg-accent/40 transition-colors"
        >
          <ShieldAlert className="w-3.5 h-3.5 text-primary" />
          Run Security Scan
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-status-error/30 bg-status-error/5 font-mono">
          <span className="text-xs text-status-error">Critical Events</span>
          <span className="text-2xl font-semibold text-status-error">{criticalCount ?? 0}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-orange-400/30 bg-orange-400/5 font-mono">
          <span className="text-xs text-orange-400">High Events</span>
          <span className="text-2xl font-semibold text-orange-400">{highCount ?? 0}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-status-warning/30 bg-status-warning/5 font-mono">
          <span className="text-xs text-status-warning">Unacknowledged</span>
          <span className="text-2xl font-semibold text-status-warning">{unacknowledgedCount ?? 0}</span>
        </div>
      </div>

      {/* Live monitor indicator */}
      <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-card border border-border">
        <span className="w-2 h-2 rounded-full bg-status-success animate-pulse" />
        <p className="text-xs text-muted-foreground font-mono">
          Security monitoring active — agent scans all projects every 5 minutes via cron
        </p>
        <div className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="w-3 h-3" />
          Auto-scanned
        </div>
      </div>

      {/* Unacknowledged events */}
      {unacknowledged.length > 0 && (
        <div className="bg-card border border-status-error/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-status-error" />
              <h2 className="text-sm font-medium text-foreground">Active Alerts</h2>
              <span className="text-[10px] font-mono bg-status-error/10 text-status-error border border-status-error/20 px-1.5 py-0.5 rounded">
                {unacknowledged.length} unread
              </span>
            </div>
          </div>
          <div className="divide-y divide-border">
            {unacknowledged.map((evt) => (
              <div key={evt.id} className="px-4 py-4 hover:bg-accent/20 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <StatusBadge type="severity" value={evt.severity} className="shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{evt.title}</p>
                      {evt.description && (
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{evt.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2">
                        {evt.source && (
                          <span className="text-[10px] font-mono bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded">
                            {eventTypeLabels[evt.event_type] ?? evt.event_type}
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground font-mono">{timeAgo(evt.created_at)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Link
                      href="/agent"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Investigate
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Acknowledged / historical */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <ShieldCheck className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Event History</h2>
        </div>
        {acknowledged.length === 0 && unacknowledged.length === 0 ? (
          <div className="py-16 text-center">
            <ShieldCheck className="w-8 h-8 text-status-success mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No security events detected.</p>
            <p className="text-xs text-muted-foreground mt-1">Ask the agent to run a security scan.</p>
          </div>
        ) : acknowledged.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">No acknowledged events yet.</div>
        ) : (
          <div className="divide-y divide-border">
            {acknowledged.map((evt) => (
              <div key={evt.id} className="flex items-center gap-4 px-4 py-3 hover:bg-accent/20 transition-colors opacity-70">
                <Eye className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <StatusBadge type="severity" value={evt.severity} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{evt.title}</p>
                </div>
                <span className="text-xs text-muted-foreground font-mono shrink-0">{timeAgo(evt.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
