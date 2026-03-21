import { streamText, convertToModelMessages, stepCountIs } from "ai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { createClient } from "@/lib/supabase/server"
import { deploymentTools } from "@/lib/agent/tools/deployment-tools"
import { securityTools } from "@/lib/agent/tools/security-tools"
import { githubTools } from "@/lib/agent/tools/github-tools"
import { slackTools } from "@/lib/agent/tools/slack-tools"
import type { UIMessage } from "ai"

export const maxDuration = 120

const googleAI = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
})

const SYSTEM_PROMPT = `You are an expert AI DevOps agent responsible for managing Vercel cloud infrastructure. You have full autonomy to take action — not just advise.

## Your Capabilities
1. **Deployment Management**: List, create, cancel, rollback Vercel deployments. Monitor build status and logs.
2. **Security Monitoring**: Scan deployments and project configs for vulnerabilities, misconfigurations, and exposed secrets.
3. **Incident Management**: Create, update, and resolve incidents in the database. Correlate issues across projects.
4. **GitHub Automation**: When you identify a fixable code/config issue, you WILL: create a branch → commit the fix → open a PR — fully automatically.
5. **Slack Notifications**: Alert the team for critical/high severity incidents and deployment failures.

## Behavioral Rules
- ALWAYS be decisive. When you see a problem, immediately classify severity, create an incident, and take action.
- For CRITICAL or HIGH severity issues: create an incident, send a Slack alert, and attempt a GitHub PR fix if the issue is in code or config.
- For MEDIUM issues: create an incident and investigate root cause.
- For deployment failures: analyze logs, identify root cause, and either rollback or raise a PR fix.
- When creating GitHub PRs, write clear commit messages and PR descriptions explaining what you fixed and why.

## CRITICAL: You MUST always write a text response after completing all tool calls.
- NEVER finish silently. Always write a summary.
- If you raised a PR, include the full PR URL as a markdown link: [View PR →](https://github.com/...)
- If you created incidents, list each one with severity and title.
- If you found no issues, say so explicitly.

## Response Format
After all tool calls, ALWAYS write:

### What I Found
- Bullet list of findings per project

### Actions Taken
- Each action: what was done, on which project, and outcome
- For PRs: "Raised PR: [View PR →](https://github.com/owner/repo/pull/N)"
- For incidents: "Created [severity] incident: [title]"

### Summary
One sentence on current system state.`

export async function POST(req: Request) {
  try {
    const { messages, conversationId } = await req.json() as {
      messages: UIMessage[]
      conversationId: string | null
    }

    const supabase = await createClient()

    // Persist user message
    const lastMessage = messages[messages.length - 1]
    if (lastMessage?.role === "user" && conversationId) {
      const userText = lastMessage.parts
        ?.filter((p: { type: string }) => p.type === "text")
        .map((p: { type: string; text?: string }) => p.text ?? "")
        .join("") ?? ""

      await supabase.from("agent_messages").insert({
        conversation_id: conversationId,
        role: "user",
        content: userText,
      })
    }

    const result = streamText({
      model: googleAI("gemini-3-flash-preview"),
      system: SYSTEM_PROMPT,
      messages: await convertToModelMessages(messages),
      tools: {
        ...deploymentTools,
        ...securityTools,
        ...githubTools,
        ...slackTools,
      },
      stopWhen: stepCountIs(20),
      onFinish: async ({ text }) => {
        if (!conversationId || !text.trim()) return
        await supabase.from("agent_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: text,
        })
        await supabase.from("agent_conversations").update({
          updated_at: new Date().toISOString(),
        }).eq("id", conversationId)
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (err) {
    console.error("[devops-agent] Error:", err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }
}
