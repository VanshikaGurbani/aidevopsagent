import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET() {
  const supabase = await createClient()

  const [
    { count: totalProjects },
    { count: activeDeployments },
    { count: openIncidents },
    { count: criticalIncidents },
    { data: recentDeployments },
    { data: recentIncidents },
    { data: recentSecurityEvents },
    { data: deploymentsByStatus },
  ] = await Promise.all([
    supabase.from("monitored_projects").select("*", { count: "exact", head: true }),
    supabase.from("deployments").select("*", { count: "exact", head: true }).eq("status", "building"),
    supabase.from("incidents").select("*", { count: "exact", head: true }).in("status", ["open", "investigating"]),
    supabase.from("incidents").select("*", { count: "exact", head: true }).eq("severity", "critical").in("status", ["open", "investigating"]),
    supabase.from("deployments").select("*").order("created_at", { ascending: false }).limit(5),
    supabase.from("incidents").select("*").order("created_at", { ascending: false }).limit(5),
    supabase.from("security_events").select("*").order("created_at", { ascending: false }).limit(10),
    supabase.from("deployments").select("status"),
  ])

  // Count by status
  const statusCounts = (deploymentsByStatus ?? []).reduce<Record<string, number>>((acc, d) => {
    acc[d.status] = (acc[d.status] ?? 0) + 1
    return acc
  }, {})

  return NextResponse.json({
    totalProjects: totalProjects ?? 0,
    activeDeployments: activeDeployments ?? 0,
    openIncidents: openIncidents ?? 0,
    criticalIncidents: criticalIncidents ?? 0,
    recentDeployments: recentDeployments ?? [],
    recentIncidents: recentIncidents ?? [],
    recentSecurityEvents: recentSecurityEvents ?? [],
    deploymentsByStatus: statusCounts,
  })
}
