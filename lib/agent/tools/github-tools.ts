import { tool } from "ai"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

const GH_API = "https://api.github.com"

function ghHeaders() {
  return {
    Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  }
}

export const githubTools = {
  getRepositoryInfo: tool({
    description: "Get information about a GitHub repository including branches and recent commits",
    inputSchema: z.object({
      owner: z.string().describe("GitHub org or username"),
      repo: z.string().describe("Repository name"),
    }),
    execute: async ({ owner, repo }) => {
      try {
        const [repoRes, branchesRes, commitsRes] = await Promise.all([
          fetch(`${GH_API}/repos/${owner}/${repo}`, { headers: ghHeaders() }),
          fetch(`${GH_API}/repos/${owner}/${repo}/branches?per_page=10`, { headers: ghHeaders() }),
          fetch(`${GH_API}/repos/${owner}/${repo}/commits?per_page=5`, { headers: ghHeaders() }),
        ])
        const repoData = repoRes.ok ? await repoRes.json() : null
        const branches = branchesRes.ok ? await branchesRes.json() : []
        const commits = commitsRes.ok ? await commitsRes.json() : []
        return {
          repo: repoData
            ? { name: repoData.name, defaultBranch: repoData.default_branch, isPrivate: repoData.private }
            : null,
          branches: Array.isArray(branches) ? branches.map((b: Record<string, unknown>) => b.name) : [],
          recentCommits: Array.isArray(commits)
            ? commits.map((c: Record<string, unknown>) => ({
                sha: (c.sha as string)?.slice(0, 7),
                message: (c.commit as Record<string, unknown>)?.message,
                author: ((c.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.name,
                date: ((c.commit as Record<string, unknown>)?.author as Record<string, unknown>)?.date,
              }))
            : [],
        }
      } catch (e: unknown) {
        return { error: String(e) }
      }
    },
  }),

  getFileContents: tool({
    description: "Read the contents of a file from a GitHub repository",
    inputSchema: z.object({
      owner: z.string(),
      repo: z.string(),
      path: z.string().describe("File path in the repo e.g. 'src/config.ts'"),
      branch: z.string().default("main"),
    }),
    execute: async ({ owner, repo, path, branch }) => {
      try {
        const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}?ref=${branch}`, {
          headers: ghHeaders(),
        })
        if (!res.ok) return { error: `File not found: ${path}`, content: null }
        const data = await res.json()
        const content = Buffer.from(data.content, "base64").toString("utf-8")
        return { path, content, sha: data.sha, size: data.size }
      } catch (e: unknown) {
        return { error: String(e), content: null }
      }
    },
  }),

  createBranch: tool({
    description: "Create a new branch in a GitHub repository for a fix",
    inputSchema: z.object({
      owner: z.string(),
      repo: z.string(),
      branchName: z.string().describe("Name for the new branch e.g. 'fix/security-headers'"),
      baseBranch: z.string().default("main").describe("Branch to create from"),
    }),
    execute: async ({ owner, repo, branchName, baseBranch }) => {
      try {
        // Get base branch SHA
        const refRes = await fetch(`${GH_API}/repos/${owner}/${repo}/git/ref/heads/${baseBranch}`, {
          headers: ghHeaders(),
        })
        if (!refRes.ok) return { error: `Base branch '${baseBranch}' not found`, success: false }
        const refData = await refRes.json()
        const sha = refData.object.sha

        // Create new branch
        const createRes = await fetch(`${GH_API}/repos/${owner}/${repo}/git/refs`, {
          method: "POST",
          headers: ghHeaders(),
          body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
        })
        if (!createRes.ok) {
          const err = await createRes.json()
          return { error: err.message || "Failed to create branch", success: false }
        }
        return { success: true, branchName, baseSha: sha }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  commitFileChange: tool({
    description: "Commit a file change (create or update) to a branch in GitHub",
    inputSchema: z.object({
      owner: z.string(),
      repo: z.string(),
      branch: z.string(),
      path: z.string().describe("File path to create or update"),
      content: z.string().describe("New file content"),
      commitMessage: z.string().describe("Commit message explaining the change"),
      existingFileSha: z.string().nullable().describe("SHA of existing file if updating (from getFileContents)"),
    }),
    execute: async ({ owner, repo, branch, path, content, commitMessage, existingFileSha }) => {
      try {
        const encodedContent = Buffer.from(content).toString("base64")
        const body: Record<string, unknown> = {
          message: commitMessage,
          content: encodedContent,
          branch,
        }
        if (existingFileSha) body.sha = existingFileSha

        const res = await fetch(`${GH_API}/repos/${owner}/${repo}/contents/${path}`, {
          method: "PUT",
          headers: ghHeaders(),
          body: JSON.stringify(body),
        })
        if (!res.ok) {
          const err = await res.json()
          return { error: err.message || "Failed to commit file", success: false }
        }
        const data = await res.json()
        return {
          success: true,
          commitSha: data.commit.sha,
          path,
          branch,
        }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  createPullRequest: tool({
    description: "Create a pull request on GitHub with the agent's fix",
    inputSchema: z.object({
      owner: z.string(),
      repo: z.string(),
      title: z.string().describe("PR title"),
      body: z.string().describe("PR description with explanation of the fix"),
      headBranch: z.string().describe("Branch containing the fix"),
      baseBranch: z.string().default("main").describe("Target branch to merge into"),
      incidentId: z.string().nullable().describe("UUID of the related incident to link"),
    }),
    execute: async ({ owner, repo, title, body, headBranch, baseBranch, incidentId }) => {
      try {
        const res = await fetch(`${GH_API}/repos/${owner}/${repo}/pulls`, {
          method: "POST",
          headers: ghHeaders(),
          body: JSON.stringify({
            title,
            body,
            head: headBranch,
            base: baseBranch,
            draft: false,
          }),
        })
        if (!res.ok) {
          const err = await res.json()
          return { error: err.message || "Failed to create PR", success: false }
        }
        const pr = await res.json()

        // Add labels
        await fetch(`${GH_API}/repos/${owner}/${repo}/issues/${pr.number}/labels`, {
          method: "POST",
          headers: ghHeaders(),
          body: JSON.stringify({ labels: ["agent-fix", "automated"] }),
        }).catch(() => {})

        // Always save PR to DB
        const supabase = await createClient()
        await supabase.from("pull_requests").insert({
          incident_id: incidentId ?? null,
          github_pr_number: pr.number,
          github_pr_url: pr.html_url,
          github_repo: repo,
          github_owner: owner,
          title,
          body,
          branch: headBranch,
          base_branch: baseBranch,
          status: "open",
        })

        // Update linked incident if provided
        if (incidentId) {
          await supabase.from("incidents").update({
            pr_raised: true,
            pr_url: pr.html_url,
            pr_number: pr.number,
            updated_at: new Date().toISOString(),
          }).eq("id", incidentId)
        }

        return {
          success: true,
          prNumber: pr.number,
          prUrl: pr.html_url,
          prTitle: pr.title,
          state: pr.state,
        }
      } catch (e: unknown) {
        return { error: String(e), success: false }
      }
    },
  }),

  searchRepositoryCode: tool({
    description: "Search for code patterns in a GitHub repository to find potential issues",
    inputSchema: z.object({
      owner: z.string(),
      repo: z.string(),
      query: z.string().describe("Search query e.g. 'TODO hardcoded secret'"),
    }),
    execute: async ({ owner, repo, query }) => {
      try {
        const encoded = encodeURIComponent(`${query} repo:${owner}/${repo}`)
        const res = await fetch(`${GH_API}/search/code?q=${encoded}&per_page=10`, {
          headers: ghHeaders(),
        })
        if (!res.ok) return { error: await res.text(), results: [] }
        const data = await res.json()
        const results = (data.items || []).map((item: Record<string, unknown>) => ({
          path: item.path,
          url: item.html_url,
          score: item.score,
        }))
        return { results, total: data.total_count }
      } catch (e: unknown) {
        return { error: String(e), results: [] }
      }
    },
  }),

  listOpenPullRequests: tool({
    description: "List open pull requests the agent has created for fixes",
    inputSchema: z.object({
      limit: z.number().default(10),
    }),
    execute: async ({ limit }) => {
      try {
        const supabase = await createClient()
        const { data, error } = await supabase
          .from("pull_requests")
          .select("*, incidents(title, severity)")
          .eq("status", "open")
          .order("created_at", { ascending: false })
          .limit(limit)
        if (error) return { error: error.message, prs: [] }
        return { prs: data, total: data.length }
      } catch (e: unknown) {
        return { error: String(e), prs: [] }
      }
    },
  }),

  syncPullRequestStatuses: tool({
    description: "Sync the status of all open PRs in the database with their actual state on GitHub. Closes stale PRs and marks merged ones as merged.",
    inputSchema: z.object({}),
    execute: async () => {
      try {
        const supabase = await createClient()
        const { data: openPRs, error } = await supabase
          .from("pull_requests")
          .select("*")
          .eq("status", "open")
        if (error) return { error: error.message, synced: 0, merged: 0, closed: 0, stillOpen: 0, errors: [] }

        let merged = 0
        let closed = 0
        let stillOpen = 0
        const errors: string[] = []

        for (const pr of openPRs ?? []) {
          try {
            const res = await fetch(
              `${GH_API}/repos/${pr.github_owner}/${pr.github_repo}/pulls/${pr.github_pr_number}`,
              { headers: ghHeaders() }
            )
            if (!res.ok) {
              errors.push(`PR #${pr.github_pr_number}: GitHub API error ${res.status}`)
              continue
            }
            const ghPR = await res.json()

            if (ghPR.state === "closed") {
              const newStatus = ghPR.merged_at !== null ? "merged" : "closed"
              const { error: updateError } = await supabase
                .from("pull_requests")
                .update({ status: newStatus, updated_at: new Date().toISOString() })
                .eq("id", pr.id)
              if (updateError) {
                errors.push(`PR #${pr.github_pr_number}: DB update error - ${updateError.message}`)
              } else if (newStatus === "merged") {
                merged++
              } else {
                closed++
              }
            } else {
              stillOpen++
            }
          } catch (e: unknown) {
            errors.push(`PR #${pr.github_pr_number}: ${String(e)}`)
          }
        }

        const synced = merged + closed + stillOpen
        return { synced, merged, closed, stillOpen, errors }
      } catch (e: unknown) {
        return { error: String(e), synced: 0, merged: 0, closed: 0, stillOpen: 0, errors: [] }
      }
    },
  }),
}
