import { NextResponse } from "next/server"
import { waitUntil } from "@vercel/functions"
import { generateText, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { deploymentTools } from "@/lib/agent/tools/deployment-tools"
import { securityTools } from "@/lib/agent/tools/security-tools"
import { githubTools } from "@/lib/agent/tools/github-tools"
import { slackTools } from "@/lib/agent/tools/slack-tools"

export const maxDuration = 120

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

const SYSTEM_PROMPT = `You are an expert AI DevOps agent. You have full autonomy to take action — not just advise.
You are responding via Slack, so format your response using Slack markdown (*bold*, \`code\`, • bullets).
Keep responses concise but complete. Always include PR links when PRs are raised.

After completing all tool calls, ALWAYS write a summary including:
- What you found per project
- Every action taken (incidents created, PRs raised with full URLs, Slack alerts sent)
- For PRs: include the full URL like: PR raised: https://github.com/owner/repo/pull/123
- Current system state`

async function runAgentAndRespond(text: string, responseUrl: string) {
  try {
    const { text: reply } = await generateText({
      model: googleAI("gemini-3-flash-preview"),
      system: SYSTEM_PROMPT,
      prompt: text,
      tools: {
        ...deploymentTools,
        ...securityTools,
        ...githubTools,
        ...slackTools,
      },
      stopWhen: stepCountIs(20),
    })

    // Post full response back to Slack
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "in_channel",
        text: reply || "✅ Actions completed. Check the DevOps dashboard for results.",
      }),
    })
  } catch (err) {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        response_type: "ephemeral",
        text: `❌ Agent error: ${String(err)}`,
      }),
    })
  }
}

export async function POST(req: Request) {
  const body = await req.text()
  const params = new URLSearchParams(body)

  const token = params.get("token")
  const text = params.get("text") ?? ""
  const responseUrl = params.get("response_url") ?? ""
  const userName = params.get("user_name") ?? "someone"
  const command = params.get("command") ?? "/devops"

  // Verify Slack token
  const slackVerifyToken = process.env.SLACK_VERIFICATION_TOKEN
  if (slackVerifyToken && token !== slackVerifyToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  if (!text.trim()) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: `*DevOps Agent* — Usage:\n\`${command} <your request>\`\n\nExamples:\n• \`${command} scan all projects for security issues\`\n• \`${command} check deployment failures and raise PRs\`\n• \`${command} list all open incidents\``,
    })
  }

  // Acknowledge immediately (Slack requires < 3s)
  const ackResponse = NextResponse.json({
    response_type: "in_channel",
    text: `🤖 *DevOps Agent* — @${userName} asked: _${text}_\n\nAnalyzing... this may take up to 60 seconds.`,
  })

  // Keep function alive after response using waitUntil
  if (responseUrl) {
    waitUntil(runAgentAndRespond(text, responseUrl))
  }

  return ackResponse
}
