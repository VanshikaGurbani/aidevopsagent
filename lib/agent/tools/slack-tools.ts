import { tool } from "ai"
import { z } from "zod"

function getSeverityEmoji(severity: string): string {
  switch (severity) {
    case "critical": return "🔴"
    case "high": return "🟠"
    case "medium": return "🟡"
    case "low": return "🔵"
    default: return "⚪"
  }
}

async function postToSlack(payload: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL
  if (!webhookUrl) return { ok: false, error: "SLACK_WEBHOOK_URL not configured" }

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!res.ok) return { ok: false, error: await res.text() }
    return { ok: true }
  } catch (e: unknown) {
    return { ok: false, error: String(e) }
  }
}

export const slackTools = {
  sendIncidentAlert: tool({
    description: "Send a Slack alert when a new incident is detected",
    inputSchema: z.object({
      incidentTitle: z.string(),
      incidentDescription: z.string(),
      severity: z.enum(["critical", "high", "medium", "low", "info"]),
      projectName: z.string().nullable(),
      incidentId: z.string().nullable(),
      category: z.string(),
    }),
    execute: async ({ incidentTitle, incidentDescription, severity, projectName, incidentId, category }) => {
      const emoji = getSeverityEmoji(severity)
      const payload = {
        text: `${emoji} *DevOps Agent Alert: ${incidentTitle}*`,
        blocks: [
          {
            type: "header",
            text: {
              type: "plain_text",
              text: `${emoji} ${severity.toUpperCase()} Incident Detected`,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Title:*\n${incidentTitle}` },
              { type: "mrkdwn", text: `*Severity:*\n${severity.toUpperCase()}` },
              { type: "mrkdwn", text: `*Category:*\n${category}` },
              { type: "mrkdwn", text: `*Project:*\n${projectName ?? "Unknown"}` },
            ],
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Description:*\n${incidentDescription}` },
          },
          incidentId
            ? {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "View in Dashboard" },
                    url: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/incidents/${incidentId}`,
                    style: severity === "critical" ? "danger" : "primary",
                  },
                ],
              }
            : null,
        ].filter(Boolean),
      }
      const result = await postToSlack(payload)
      return result.ok
        ? { success: true, message: "Slack alert sent" }
        : { success: false, error: result.error }
    },
  }),

  sendDeploymentNotification: tool({
    description: "Send a Slack notification about a deployment status change",
    inputSchema: z.object({
      projectName: z.string(),
      deploymentUrl: z.string().nullable(),
      status: z.enum(["building", "ready", "error", "canceled", "queued"]),
      target: z.string().nullable(),
      commitMessage: z.string().nullable(),
      errorSummary: z.string().nullable(),
    }),
    execute: async ({ projectName, deploymentUrl, status, target, commitMessage, errorSummary }) => {
      const statusEmoji = {
        ready: "✅",
        error: "❌",
        building: "🔨",
        canceled: "⛔",
        queued: "⏳",
      }[status] ?? "📦"

      const payload = {
        text: `${statusEmoji} Deployment ${status.toUpperCase()} — ${projectName}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `${statusEmoji} *${projectName}* deployment is *${status.toUpperCase()}*${target ? ` (${target})` : ""}`,
            },
          },
          commitMessage
            ? {
                type: "section",
                text: { type: "mrkdwn", text: `*Commit:* ${commitMessage}` },
              }
            : null,
          status === "error" && errorSummary
            ? {
                type: "section",
                text: { type: "mrkdwn", text: `*Error:* \`${errorSummary}\`` },
              }
            : null,
          status === "ready" && deploymentUrl
            ? {
                type: "actions",
                elements: [
                  {
                    type: "button",
                    text: { type: "plain_text", text: "Open Deployment" },
                    url: `https://${deploymentUrl}`,
                    style: "primary",
                  },
                ],
              }
            : null,
        ].filter(Boolean),
      }
      const result = await postToSlack(payload)
      return result.ok
        ? { success: true, message: "Deployment notification sent" }
        : { success: false, error: result.error }
    },
  }),

  sendPRNotification: tool({
    description: "Send a Slack notification when the agent raises a PR for a fix",
    inputSchema: z.object({
      prTitle: z.string(),
      prUrl: z.string(),
      prNumber: z.number(),
      repo: z.string(),
      incidentTitle: z.string().nullable(),
      fixSummary: z.string(),
    }),
    execute: async ({ prTitle, prUrl, prNumber, repo, incidentTitle, fixSummary }) => {
      const payload = {
        text: `🤖 Agent raised PR #${prNumber}: ${prTitle}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `🤖 *DevOps Agent raised a fix PR*\n*<${prUrl}|#${prNumber} ${prTitle}>*`,
            },
          },
          {
            type: "section",
            fields: [
              { type: "mrkdwn", text: `*Repository:*\n${repo}` },
              incidentTitle
                ? { type: "mrkdwn", text: `*Related Incident:*\n${incidentTitle}` }
                : { type: "mrkdwn", text: `*Type:*\nProactive Fix` },
            ],
          },
          {
            type: "section",
            text: { type: "mrkdwn", text: `*Fix Summary:*\n${fixSummary}` },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Review PR on GitHub" },
                url: prUrl,
                style: "primary",
              },
            ],
          },
        ],
      }
      const result = await postToSlack(payload)
      return result.ok
        ? { success: true, message: "PR notification sent to Slack" }
        : { success: false, error: result.error }
    },
  }),

  sendCustomAlert: tool({
    description: "Send a custom message or alert to Slack",
    inputSchema: z.object({
      message: z.string().describe("The message to send"),
      severity: z.enum(["critical", "high", "medium", "low", "info"]).nullable(),
    }),
    execute: async ({ message, severity }) => {
      const emoji = severity ? getSeverityEmoji(severity) : "📢"
      const payload = { text: `${emoji} ${message}` }
      const result = await postToSlack(payload)
      return result.ok
        ? { success: true }
        : { success: false, error: result.error }
    },
  }),
}
