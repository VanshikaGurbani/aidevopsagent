"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  Rocket,
  ShieldAlert,
  AlertTriangle,
  GitPullRequest,
  Bot,
  Activity,
  Settings,
  ChevronRight,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/deployments", label: "Deployments", icon: Rocket },
  { href: "/security", label: "Security", icon: ShieldAlert },
  { href: "/incidents", label: "Incidents", icon: AlertTriangle },
  { href: "/pull-requests", label: "Pull Requests", icon: GitPullRequest },
  { href: "/agent", label: "Agent Chat", icon: Bot },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex flex-col w-60 shrink-0 bg-sidebar border-r border-sidebar-border h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-sidebar-border">
        <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary">
          <Activity className="w-4 h-4 text-primary-foreground" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-none">DevOps Agent</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">AI — Gemini 3.1</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col gap-0.5 p-3 flex-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group",
                isActive
                  ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                  : "text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground group-hover:text-sidebar-foreground")} />
              <span className="flex-1">{label}</span>
              {isActive && <ChevronRight className="w-3 h-3 text-primary" />}
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-sidebar-border">
        <Link
          href="/settings"
          className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Settings className="w-4 h-4" />
          Settings
        </Link>
        <div className="mt-3 px-3 py-2 rounded-md bg-sidebar-accent/40 border border-sidebar-border">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse" />
            <span className="text-[11px] text-muted-foreground font-mono">Monitor active</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
