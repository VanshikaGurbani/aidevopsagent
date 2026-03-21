import { createClient } from "@/lib/supabase/server"
import { StatusBadge } from "@/components/dashboard/status-badge"
import { GitPullRequest, GitMerge, GitBranch, ExternalLink, Bot } from "lucide-react"
import type { PullRequest } from "@/lib/types"
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

const prStatusConfig: Record<string, { icon: typeof GitPullRequest; color: string }> = {
  open:   { icon: GitPullRequest, color: "text-status-success" },
  merged: { icon: GitMerge, color: "text-status-info" },
  closed: { icon: GitPullRequest, color: "text-status-error" },
  draft:  { icon: GitPullRequest, color: "text-muted-foreground" },
}

export default async function PullRequestsPage() {
  const supabase = await createClient()

  const { data: prs } = await supabase
    .from("pull_requests")
    .select("*, incidents(title, severity, status)")
    .order("created_at", { ascending: false })
    .limit(50)

  const allPRs = (prs ?? []) as (PullRequest & { incidents: { title: string; severity: string; status: string } | null })[]

  const open = allPRs.filter((p) => p.status === "open")
  const merged = allPRs.filter((p) => p.status === "merged")
  const closed = allPRs.filter((p) => p.status === "closed" || p.status === "draft")

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Agent Pull Requests</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Automated fix PRs raised by the DevOps agent on GitHub</p>
        </div>
        <Link
          href="/agent"
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-card border border-border text-xs text-foreground hover:bg-accent/40 transition-colors"
        >
          <Bot className="w-3.5 h-3.5 text-primary" />
          Ask Agent to Fix
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-status-success/30 bg-status-success/5 font-mono">
          <span className="text-xs text-status-success">Open PRs</span>
          <span className="text-2xl font-semibold text-status-success">{open.length}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-status-info/30 bg-status-info/5 font-mono">
          <span className="text-xs text-status-info">Merged</span>
          <span className="text-2xl font-semibold text-status-info">{merged.length}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3 rounded-lg border border-border bg-card font-mono">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="text-2xl font-semibold text-foreground">{allPRs.length}</span>
        </div>
      </div>

      {allPRs.length === 0 ? (
        <div className="py-20 text-center bg-card border border-border rounded-lg">
          <GitPullRequest className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No PRs raised yet</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Ask the agent to investigate an incident and fix it — it will create a branch, commit the fix, and open a PR automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {allPRs.map((pr) => {
            const StatusIcon = prStatusConfig[pr.status]?.icon ?? GitPullRequest
            const statusColor = prStatusConfig[pr.status]?.color ?? "text-muted-foreground"

            return (
              <div key={pr.id} className="bg-card border border-border rounded-lg p-4 hover:border-border/80 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <StatusIcon className={`w-5 h-5 shrink-0 mt-0.5 ${statusColor}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <a
                          href={pr.github_pr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm font-medium text-foreground hover:text-primary transition-colors flex items-center gap-1"
                        >
                          {pr.title}
                          <ExternalLink className="w-3 h-3 opacity-50" />
                        </a>
                        <span className="text-xs text-muted-foreground font-mono">#{pr.github_pr_number}</span>
                      </div>

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          {pr.branch} → {pr.base_branch}
                        </span>
                        <span className="text-[11px] text-muted-foreground font-mono bg-muted/30 px-1.5 py-0.5 rounded">
                          {pr.github_owner}/{pr.github_repo}
                        </span>
                      </div>

                      {pr.incidents && (
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Related incident:</span>
                          <span className="text-[11px] text-foreground">{pr.incidents.title}</span>
                          <StatusBadge type="severity" value={pr.incidents.severity} />
                        </div>
                      )}

                      {pr.agent_notes && (
                        <p className="text-xs text-muted-foreground mt-2 leading-relaxed border-l-2 border-border pl-2">
                          {pr.agent_notes}
                        </p>
                      )}

                      <p className="text-[11px] text-muted-foreground font-mono mt-2">{timeAgo(pr.created_at)}</p>
                    </div>
                  </div>

                  <div className="shrink-0 flex flex-col items-end gap-2">
                    <span className={`text-[11px] font-mono font-medium px-2 py-0.5 rounded border ${
                      pr.status === "open" ? "bg-status-success/10 text-status-success border-status-success/20" :
                      pr.status === "merged" ? "bg-status-info/10 text-status-info border-status-info/20" :
                      "bg-muted/20 text-muted-foreground border-border"
                    }`}>
                      {pr.status.toUpperCase()}
                    </span>
                    <a
                      href={pr.github_pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline"
                    >
                      Review on GitHub
                    </a>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
