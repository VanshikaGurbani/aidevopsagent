const VERCEL_API = "https://api.vercel.com"

function headers() {
  const token = process.env.VERCEL_TOKEN ?? process.env.VERCEL_ACCESS_TOKEN
  return { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
}

export interface VercelProject {
  id: string
  name: string
  framework: string | null
  link?: { repo?: string; org?: string; productionBranch?: string; type?: string }
  latestDeployments?: VercelDeployment[]
  updatedAt: number
}

export interface VercelDeployment {
  uid: string
  name: string
  url: string | null
  state: "BUILDING" | "READY" | "ERROR" | "CANCELED" | "QUEUED" | string
  target: "production" | "preview" | null
  meta?: { githubCommitMessage?: string; githubCommitRef?: string; githubCommitSha?: string; githubCommitAuthorName?: string }
  createdAt: number
  buildingAt?: number
  ready?: number
  errorMessage?: string | null
}

export async function fetchAllProjects(): Promise<VercelProject[]> {
  const res = await fetch(`${VERCEL_API}/v9/projects?limit=100`, { headers: headers(), next: { revalidate: 30 } })
  if (!res.ok) return []
  const data = await res.json()
  return data.projects ?? []
}

export async function fetchDeploymentsForProject(projectId: string, limit = 10): Promise<VercelDeployment[]> {
  const res = await fetch(`${VERCEL_API}/v6/deployments?projectId=${projectId}&limit=${limit}`, {
    headers: headers(),
    next: { revalidate: 30 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.deployments ?? []
}

export async function fetchAllDeployments(limit = 50): Promise<VercelDeployment[]> {
  const res = await fetch(`${VERCEL_API}/v6/deployments?limit=${limit}`, {
    headers: headers(),
    next: { revalidate: 30 },
  })
  if (!res.ok) return []
  const data = await res.json()
  return data.deployments ?? []
}

export function normalizeState(state: string): "building" | "ready" | "error" | "canceled" | "queued" {
  const map: Record<string, "building" | "ready" | "error" | "canceled" | "queued"> = {
    BUILDING: "building", READY: "ready", ERROR: "error", CANCELED: "canceled", QUEUED: "queued",
    building: "building", ready: "ready", error: "error", canceled: "canceled", queued: "queued",
  }
  return map[state] ?? "error"
}
