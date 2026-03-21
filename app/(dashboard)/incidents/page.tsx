import { createClient } from "@/lib/supabase/server"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { AlertTriangle, GitPullRequest, Bot, CheckCircle2 } from "lucide-react"
import type { Incident } from "@/lib/types"
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

const categoryIcons: Record<string, string> = {
  deployment: "Deploy",
  security: "Security",
  performance: "Perf",
  availability: "Avail",
  configuration: "Config",
  code: "Code",
}

export default async function IncidentsPage() {
  const supabase = await createClient()

  const [{ data: incidents }, { count: resolved }] = await Promise.all([
    supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(50),
    supabase.from("incidents").select("*", { count: "exact", head: true }).eq("status", "resolved"),
  ])

  const allIncidents = (incidents ?? []) as Incident[]
  const open = allIncidents.filter((i) => i.status === "open" || i.status === "investigating")
  const closed = allIncidents.filter((i) => i.status === "resolved" || i.status === "dismissed")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Incidents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Agent-detected and manually raised incidents</p>
        </div>
        <Link
          href="/agent"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Bot className="w-3.5 h-3.5" />
          Ask Agent to Investigate
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Open", count: allIncidents.filter((i) => i.status === "open").length, color: "text-status-error border-status-error/30 bg-status-error/5" },
          { label: "Investigating", count: allIncidents.filter((i) => i.status === "investigating").length, color: "text-status-warning border-status-warning/30 bg-status-warning/5" },
          { label: "Resolved", count: resolved ?? 0, color: "text-status-success border-status-success/30 bg-status-success/5" },
          { label: "PRs Raised", count: allIncidents.filter((i) => i.pr_raised).length, color: "text-status-info border-status-info/30 bg-status-info/5" },
        ].map(({ label, count, color }) => (
          <div key={label} className={`flex items-center justify-between px-4 py-3 rounded-lg border font-mono ${color}`}>
            <span className="text-xs">{label}</span>
            <span className="text-2xl font-semibold">{count}</span>
          </div>
        ))}
      </div>

      {/* Open incidents */}
      {open.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <AlertTriangle className="w-4 h-4 text-status-warning" />
            <h2 className="text-sm font-medium">Active Incidents</h2>
            <span className="text-[10px] font-mono bg-status-warning/10 text-status-warning border border-status-warning/20 px-1.5 py-0.5 rounded">
              {open.length}
            </span>
          </div>
          <div className="divide-y divide-border">
            {open.map((inc) => (
              <IncidentRow key={inc.id} incident={inc} />
            ))}
          </div>
        </div>
      )}

      {/* Closed incidents */}
      {closed.length > 0 && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-medium text-muted-foreground">Resolved / Dismissed</h2>
          </div>
          <div className="divide-y divide-border opacity-75">
            {closed.map((inc) => (
              <IncidentRow key={inc.id} incident={inc} />
            ))}
          </div>
        </div>
      )}

      {allIncidents.length === 0 && (
        <div className="py-20 text-center">
          <CheckCircle2 className="w-10 h-10 text-status-success mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No incidents recorded</p>
          <p className="text-xs text-muted-foreground mt-1">The agent will auto-create incidents when issues are detected.</p>
        </div>
      )}
    </div>
  )
}

function IncidentRow({ incident: inc }: { incident: Incident }) {
  function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return `${Math.floor(hrs / 24)}d ago`
  }

  const categoryIcons: Record<string, string> = {
    deployment: "Deploy", security: "Security", performance: "Perf",
    availability: "Avail", configuration: "Config", code: "Code",
  }

  return (
    <div className="px-4 py-4 hover:bg-accent/20 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge type="severity" value={inc.severity} />
            <span className="text-[10px] font-mono bg-muted/30 text-muted-foreground px-1.5 py-0.5 rounded">
              {categoryIcons[inc.category] ?? inc.category}
            </span>
            {inc.pr_raised && (
              <span className="text-[10px] font-mono bg-status-info/10 text-status-info border border-status-info/20 px-1.5 py-0.5 rounded flex items-center gap-1">
                <GitPullRequest className="w-2.5 h-2.5" /> PR #{inc.pr_number}
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-foreground mt-2 leading-snug">{inc.title}</p>
          {inc.description && (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed line-clamp-2">{inc.description}</p>
          )}
          {inc.root_cause && (
            <p className="text-xs text-status-warning mt-1.5 font-mono">
              Root cause: {inc.root_cause}
            </p>
          )}
          {inc.resolution && (
            <p className="text-xs text-status-success mt-1 font-mono">
              Resolution: {inc.resolution}
            </p>
          )}
          <div className="flex items-center gap-3 mt-2.5">
            <span className="text-[11px] text-muted-foreground font-mono">{timeAgo(inc.created_at)}</span>
            {inc.vercel_project_id && (
              <span className="text-[11px] text-muted-foreground font-mono">
                {inc.vercel_project_id}
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <StatusBadge type="incident" value={inc.status} />
          {inc.pr_url && (
            <a
              href={inc.pr_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              <GitPullRequest className="w-3 h-3" /> View PR
            </a>
          )}
          <Link href="/agent" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Investigate
          </Link>
        </div>
      </div>
    </div>
  )
}
