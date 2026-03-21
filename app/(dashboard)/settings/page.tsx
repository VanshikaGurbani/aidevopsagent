import {
  Settings,
  KeyRound,
  Github,
  Slack,
  Triangle,
  Bot,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react"

// This is a React Server Component — process.env is available server-side
export default function SettingsPage() {
  // Read all env vars server-side and pass as plain booleans to avoid
  // leaking secrets to the client
  const envStatus = {
    VERCEL_TOKEN: Boolean(process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN),
    GITHUB_TOKEN: Boolean(process.env.GITHUB_TOKEN),
    SLACK_WEBHOOK_URL: Boolean(process.env.SLACK_WEBHOOK_URL),
    SLACK_BOT_TOKEN: Boolean(process.env.SLACK_BOT_TOKEN),
    AI_GATEWAY_API_KEY: Boolean(process.env.AI_GATEWAY_API_KEY),
    CRON_SECRET: Boolean(process.env.CRON_SECRET),
    NEXT_PUBLIC_APP_URL: Boolean(process.env.NEXT_PUBLIC_APP_URL),
  }

  const integrations = [
    {
      icon: Triangle,
      name: "Vercel API",
      description: "Manage deployments, projects, and environment variables",
      docsUrl: "https://vercel.com/docs/rest-api",
      marketplaceUrl: "https://vercel.com/dashboard",
      envVars: [{ key: "VERCEL_TOKEN", set: envStatus.VERCEL_TOKEN }],
      setupNote: "VERCEL_TOKEN is a built-in system variable Vercel injects automatically — no setup needed.",
    },
    {
      icon: Github,
      name: "GitHub",
      description: "Create branches, commit fixes, and open pull requests automatically",
      docsUrl: "https://docs.github.com/en/rest",
      marketplaceUrl: "https://vercel.com/integrations/github",
      envVars: [{ key: "GITHUB_TOKEN", set: envStatus.GITHUB_TOKEN }],
      setupNote: "Go to github.com/settings/tokens → Generate classic token → repo scope. Paste as GITHUB_TOKEN in Settings → Vars.",
    },
    {
      icon: Slack,
      name: "Slack",
      description: "Incident alerts and deployment failure notifications",
      docsUrl: "https://api.slack.com/messaging/webhooks",
      marketplaceUrl: "https://vercel.com/integrations/slack",
      envVars: [
        { key: "SLACK_WEBHOOK_URL", set: envStatus.SLACK_WEBHOOK_URL },
        { key: "SLACK_BOT_TOKEN", set: envStatus.SLACK_BOT_TOKEN },
      ],
      setupNote: "Add the Slack integration from Vercel Marketplace — both vars are injected automatically after connecting your workspace.",
    },
    {
      icon: Bot,
      name: "Vercel AI Gateway",
      description: "Powers the DevOps agent with Gemini 3.1 Pro",
      docsUrl: "https://vercel.com/docs/ai-gateway",
      marketplaceUrl: "https://vercel.com/dashboard",
      envVars: [{ key: "AI_GATEWAY_API_KEY", set: envStatus.AI_GATEWAY_API_KEY }],
      setupNote: "Enable AI Gateway in your Vercel project settings. The API key is auto-injected.",
    },
  ]

  const otherVars = [
    { key: "CRON_SECRET", set: envStatus.CRON_SECRET, note: "Secures the /api/monitor cron endpoint from public calls." },
    { key: "NEXT_PUBLIC_APP_URL", set: envStatus.NEXT_PUBLIC_APP_URL, note: "Your deployed URL for Slack deep-links, e.g. https://your-app.vercel.app" },
  ]

  const allConfigured = Object.values(envStatus).every(Boolean)
  const configuredCount = Object.values(envStatus).filter(Boolean).length
  const totalCount = Object.values(envStatus).length

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Settings className="w-5 h-5" />
          Settings & Integrations
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Connect services via Vercel Marketplace — env vars are injected automatically after each integration is added.
        </p>
      </div>

      {/* Overall status bar */}
      <div className={`rounded-lg border p-4 flex items-center gap-3 ${allConfigured ? "border-status-success/40 bg-status-success/5" : "border-status-warning/40 bg-status-warning/5"}`}>
        {allConfigured ? (
          <CheckCircle2 className="w-5 h-5 text-status-success shrink-0" />
        ) : (
          <XCircle className="w-5 h-5 text-status-warning shrink-0" />
        )}
        <div>
          <p className="text-sm font-medium">
            {allConfigured ? "All integrations configured" : `${configuredCount} of ${totalCount} variables configured`}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {allConfigured
              ? "The agent is fully operational."
              : "Configure the missing variables below to unlock all agent capabilities."}
          </p>
        </div>
      </div>

      {/* Integration cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5" />
          Integrations
        </h2>
        {integrations.map((integration) => {
          const IntegrationIcon = integration.icon
          const allVarsSet = integration.envVars.every((v) => v.set)
          return (
            <div
              key={integration.name}
              className="rounded-lg border border-border bg-card p-4 space-y-3"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-md bg-secondary flex items-center justify-center shrink-0">
                    <IntegrationIcon className="w-4 h-4 text-foreground" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{integration.name}</span>
                      <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border ${allVarsSet ? "text-status-success border-status-success/30 bg-status-success/10" : "text-status-error border-status-error/30 bg-status-error/10"}`}>
                        {allVarsSet ? "connected" : "disconnected"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{integration.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={integration.marketplaceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 border border-border rounded px-2 py-1 hover:border-foreground/30 transition-colors"
                  >
                    Setup <ExternalLink className="w-3 h-3" />
                  </a>
                  <a
                    href={integration.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                  >
                    Docs <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Env var status */}
              <div className="space-y-1.5">
                {integration.envVars.map(({ key, set }) => (
                  <div key={key} className="flex items-center gap-2">
                    {set ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-status-success shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-status-error shrink-0" />
                    )}
                    <code className="text-xs font-mono text-muted-foreground">{key}</code>
                    <span className={`text-[10px] font-mono ${set ? "text-status-success" : "text-status-error"}`}>
                      {set ? "set" : "not set"}
                    </span>
                  </div>
                ))}
              </div>

              {/* Setup note */}
              <p className="text-[11px] text-muted-foreground bg-secondary/50 rounded px-3 py-2 font-mono leading-relaxed border border-border/50">
                {integration.setupNote}
              </p>
            </div>
          )
        })}
      </div>

      {/* Other env vars */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <KeyRound className="w-3.5 h-3.5" />
          Other Variables
        </h2>
        <div className="rounded-lg border border-border bg-card divide-y divide-border">
          {otherVars.map(({ key, set, note }) => (
            <div key={key} className="p-4 flex items-start gap-4">
              {set ? (
                <CheckCircle2 className="w-4 h-4 text-status-success mt-0.5 shrink-0" />
              ) : (
                <XCircle className="w-4 h-4 text-status-error mt-0.5 shrink-0" />
              )}
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2">
                  <code className="text-xs font-mono text-foreground">{key}</code>
                  <span className={`text-[10px] font-mono ${set ? "text-status-success" : "text-status-error"}`}>
                    {set ? "set" : "not set"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">{note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Slack connection note */}
      <div className="rounded-lg border border-status-info/30 bg-status-info/5 p-4">
        <p className="text-sm font-medium text-foreground mb-1">Slack showing disconnected after connecting?</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          After adding the Slack integration in Vercel Marketplace, the webhook URL is injected as{" "}
          <code className="font-mono bg-secondary px-1 rounded">SLACK_WEBHOOK_URL</code>. If it still shows disconnected,
          go to <strong>Settings → Vars</strong> in v0 and confirm the variable appears there. You may need to redeploy
          or reload the preview for the new env var to take effect.
        </p>
      </div>
    </div>
  )
}
