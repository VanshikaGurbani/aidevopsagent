# AI DevOps Agent

An autonomous AI DevOps agent built with Next.js, Gemini 3 Flash, and the Vercel AI SDK. It monitors your Vercel deployments, scans for security issues, manages incidents, raises GitHub PRs for fixes, responds to Slack slash commands, and runs automated checks on a schedule.

## Features

### Deployment Management
- List all Vercel projects and recent deployments in real time
- Trigger new deployments to production or preview
- Cancel in-progress deployments
- **Rollback** — `/devops rollback <project-name>` instantly rolls back to the last successful production deployment
- View deployment logs and error summaries

### Security Scanning
- Scan project configs and `vercel.json` for misconfigurations
- Detect exposed secrets and insecure headers
- Log security events with severity classification (low / medium / high / critical)
- **Env var drift detection** — compare environment variable keys between two projects and surface missing or extra vars

### Incident Management
- Create, update, and resolve incidents with severity levels
- Correlate incidents across multiple projects
- Link incidents to the PRs that fix them
- View all open incidents on the dashboard

### GitHub Automation
- Create fix branches, commit changes, and open pull requests automatically
- Label agent-raised PRs with `agent-fix` and `automated`
- Search repository code for patterns and vulnerabilities
- **Stale PR cleanup** — syncs all open PRs against GitHub, marks merged/closed ones in the database

### Slack Integration
- Use `/devops <request>` in any Slack channel to interact with the agent
- Receive alerts for critical incidents and deployment failures
- Get notified when the agent raises a PR
- **Weekly digest** — posts every Saturday at 5pm EST: deployments, incidents resolved, PRs raised, security findings

### Automated Monitoring (Daily Cron)
- **Deployment failure detection** — finds new failed deployments and creates incidents, deduped so you only get alerted once per failure
- **Uptime checks** — pings every monitored project URL; creates a critical incident and Slack alert if a project is unreachable
- Monitoring runs once a day (09:00 UTC, see `vercel.json`) via Vercel Cron; change the `schedule` there to run it more often (Vercel's Hobby plan only allows daily crons)
- The cron route only creates incidents and Slack alerts. Root-cause analysis and fix PRs happen when you ask the agent (Slack `/devops` or the dashboard chat), not on the cron

---

## Safety controls

The agent acts on real systems, so every change it makes goes through guards in `lib/agent/guards.ts` before any API call:

- **Draft PRs.** Agent PRs open as drafts, so a person has to mark them ready for review. Set `AGENT_PR_READY=true` to open them ready. Repositories that do not support drafts get a normal PR.
- **No direct commits** to `main`, `master`, `production` or `release`; the agent works on its own fix branch.
- **Path rules.** Edits to `.github/`, `.env*`, `.claude/`, `deploy.sh`, key files and anything outside the repo are always refused. Set `AGENT_ALLOWED_PATHS` (comma-separated paths or globs, e.g. `app/,vercel.json,lib/*.ts`) to restrict edits to those paths only.
- **Secret scan.** A commit, commit message, PR title or PR description that contains something that looks like a credential (cloud or GitHub tokens, Slack tokens and webhooks, Stripe/Google keys, private keys, JWTs, hardcoded `api_key = "..."`) is refused. Only the kind of secret is reported, never its value. This is a pattern check, not a guarantee.
- **Size limit.** Files over 200 KB are refused.
- **Dry run.** Set `AGENT_DRY_RUN=true` and the agent only reports what it would do (branches, commits, PRs, deploys, cancels, rollbacks) without making any of those calls.

---

## Tech Stack

- **Framework** — Next.js 16 (App Router)
- **AI** — Google Gemini 3 Flash via `@ai-sdk/google`
- **AI SDK** — Vercel AI SDK v6 (`streamText`, `generateText`, `useChat`, `stepCountIs`)
- **Database** — Supabase (PostgreSQL)
- **Deployment** — Vercel
- **UI** — Tailwind CSS + Shadcn UI

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/RonitGandhi/v0-ai-dev-ops-agent
cd v0-ai-dev-ops-agent
pnpm install
```

### 2. Set up environment variables

Create a `.env.local` file in the root:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Google AI (Gemini)
GOOGLE_GENERATIVE_AI_API_KEY=your_google_ai_key

# GitHub
GITHUB_TOKEN=your_github_pat

# Vercel
VERCEL_TOKEN=your_vercel_token

# Slack (ZeroToAgent app)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
SLACK_VERIFICATION_TOKEN=your_verification_token
SLACK_BOT_TOKEN=xoxb-...

# Cron security
CRON_SECRET=your_random_secret

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run locally

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Deploy to production

```bash
./deploy.sh
```

Prints all env vars, builds the app, and deploys to Vercel production.

---

## Slack Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) → your app
2. **Slash Commands** → `/devops` → set Request URL to:
   ```
   https://v0-ai-dev-ops-agent.vercel.app/api/slack
   ```
3. **Install App** → Reinstall to workspace

### Example commands

```
/devops scan all projects for security issues
/devops show me all open incidents
/devops check deployment failures and raise PRs
/devops rollback financial-planner
/devops sync all open PR statuses
/devops check env var drift between financial-planner and chatbot
/devops list all open pull requests
```

---

## Automated Schedule

| Job | Schedule | What it does |
|---|---|---|
| Monitor | Daily, 09:00 UTC | Deployment failure checks + uptime pings for all projects |
| Weekly Digest | Saturday 5pm EST | Posts a weekly summary to Slack |

---

## Project Structure

```
app/
├── (dashboard)/          # Main UI pages
│   ├── page.tsx          # Overview / command center
│   ├── agent/            # AI chat interface
│   ├── deployments/      # Vercel deployments
│   ├── incidents/        # Incident tracker
│   ├── pull-requests/    # Agent-raised PRs
│   └── security/         # Security scan results
├── api/
│   ├── agent/            # Streaming chat endpoint
│   ├── slack/            # Slack slash command handler
│   ├── monitor/          # Daily cron — uptime + deployment checks
│   ├── digest/           # Weekly Slack digest
│   └── conversations/    # Chat session persistence (24hr)
lib/
├── agent/tools/
│   ├── deployment-tools.ts   # Vercel API — list, deploy, rollback, env drift
│   ├── github-tools.ts       # GitHub API — branches, commits, PRs, stale sync
│   ├── security-tools.ts     # Incident management, security event logging
│   └── slack-tools.ts        # Slack alerts and notifications
└── vercel.ts                 # Vercel API utilities
```
