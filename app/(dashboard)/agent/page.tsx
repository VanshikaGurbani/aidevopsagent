"use client"

import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { useState, useRef, useEffect, useCallback } from "react"
import {
  Bot,
  User,
  Send,
  Loader2,
  Plus,
  Rocket,
  ShieldAlert,
  AlertTriangle,
  GitPullRequest,
  Wrench,
  ChevronRight,
  Terminal,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { UIMessage } from "ai"
import ReactMarkdown from "react-markdown"

const SUGGESTED_PROMPTS = [
  {
    icon: Rocket,
    label: "List Deployments",
    prompt: "List my recent Vercel deployments and tell me if any have failed.",
  },
  {
    icon: ShieldAlert,
    label: "Security Scan",
    prompt: "Run a security scan across all my monitored projects and log any findings.",
  },
  {
    icon: AlertTriangle,
    label: "Check Incidents",
    prompt: "Show me all open incidents and investigate any critical ones.",
  },
  {
    icon: GitPullRequest,
    label: "Fix & PR",
    prompt: "Check for any open incidents that have code fixes and raise GitHub PRs for them.",
  },
]

interface ToolCallPart {
  type: "tool-invocation"
  toolInvocation: {
    toolName: string
    state: string
    input?: Record<string, unknown>
    output?: unknown
  }
}

interface TextPart {
  type: "text"
  text: string
}

type MessagePart = ToolCallPart | TextPart | { type: string }

function ToolCallDisplay({ part }: { part: ToolCallPart }) {
  const { toolName, state, input, output } = part.toolInvocation
  const isLoading = state === "input-streaming" || state === "input-available"
  const isDone = state === "output-available"
  const isError = state === "output-error"

  const toolLabels: Record<string, string> = {
    listProjects: "Listing Vercel projects",
    listDeployments: "Fetching deployments",
    getDeploymentDetails: "Getting deployment details",
    triggerDeployment: "Triggering deployment",
    cancelDeployment: "Canceling deployment",
    rollbackDeployment: "Rolling back deployment",
    getProjectEnvironmentVariables: "Checking environment variables",
    saveDeploymentToDb: "Saving deployment record",
    checkDeploymentSecurity: "Scanning deployment security",
    scanProjectConfiguration: "Scanning project config",
    createIncident: "Creating incident",
    updateIncidentStatus: "Updating incident status",
    logSecurityEvent: "Logging security event",
    getOpenIncidents: "Fetching open incidents",
    getRepositoryInfo: "Reading repository info",
    getFileContents: "Reading file",
    createBranch: "Creating branch",
    commitFileChange: "Committing fix",
    createPullRequest: "Opening pull request",
    searchRepositoryCode: "Searching code",
    listOpenPullRequests: "Listing PRs",
    sendIncidentAlert: "Sending Slack alert",
    sendDeploymentNotification: "Sending Slack notification",
    sendPRNotification: "Notifying team via Slack",
    sendCustomAlert: "Sending Slack message",
  }

  const label = toolLabels[toolName] ?? toolName

  return (
    <div className={cn(
      "flex items-center gap-2.5 px-3 py-2 rounded-md border text-xs font-mono my-1",
      isLoading ? "bg-status-info/5 border-status-info/20 text-status-info" :
      isDone ? "bg-status-success/5 border-status-success/20 text-status-success" :
      isError ? "bg-status-error/5 border-status-error/20 text-status-error" :
      "bg-muted/20 border-border text-muted-foreground"
    )}>
      {isLoading ? (
        <Loader2 className="w-3 h-3 animate-spin shrink-0" />
      ) : (
        <Wrench className="w-3 h-3 shrink-0" />
      )}
      <span className="flex-1">{label}</span>
      {isDone && typeof output === "object" && output !== null && "success" in output && (
        <span className={cn("text-[10px]", (output as Record<string, unknown>).success ? "text-status-success" : "text-status-error")}>
          {(output as Record<string, unknown>).success ? "Done" : "Failed"}
        </span>
      )}
    </div>
  )
}

function MessageBubble({ message, isStreaming }: { message: UIMessage; isStreaming?: boolean }) {
  const isUser = message.role === "user"
  const parts = message.parts as MessagePart[]

  const hasVisibleContent = parts?.some(
    (p) => (p.type === "text" && (p as TextPart).text.trim()) || p.type === "tool-invocation"
  )

  return (
    <div className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
      {/* Avatar */}
      <div className={cn(
        "w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5",
        isUser ? "bg-secondary border border-border" : "bg-primary"
      )}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-foreground" />
          : <Bot className="w-3.5 h-3.5 text-primary-foreground" />
        }
      </div>

      {/* Content */}
      <div className={cn("flex-1 max-w-[85%] space-y-0.5", isUser ? "items-end" : "items-start")}>
        {parts?.map((part, i) => {
          if (part.type === "text") {
            const text = (part as TextPart).text
            if (!text.trim()) return null
            return (
              <div
                key={i}
                className={cn(
                  "px-3.5 py-2.5 rounded-lg text-sm leading-relaxed",
                  isUser
                    ? "bg-secondary text-foreground border border-border ml-auto"
                    : "bg-card text-foreground border border-border"
                )}
              >
                <FormattedText text={text} />
              </div>
            )
          }

          if (part.type === "tool-invocation") {
            return <ToolCallDisplay key={i} part={part as ToolCallPart} />
          }

          return null
        })}

        {/* Show streaming indicator when no content yet */}
        {!isUser && !hasVisibleContent && isStreaming && (
          <div className="px-3.5 py-2.5 rounded-lg bg-card border border-border">
            <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Loader2 className="w-3 h-3 animate-spin" />
              <StreamingLabel />
            </div>
          </div>
        )}

        {/* Fallback: agent finished with no text at all (shouldn't happen with new instructions) */}
        {!isUser && !hasVisibleContent && !isStreaming && (parts?.length ?? 0) > 0 && (
          <div className="px-3.5 py-2.5 rounded-lg bg-card border border-border text-xs text-muted-foreground">
            Actions completed. Check the <strong>Incidents</strong>, <strong>Pull Requests</strong>, and <strong>Security</strong> pages for results.
          </div>
        )}
      </div>
    </div>
  )
}

function StreamingLabel() {
  const PHRASES = [
    "Thinking...", "Scanning...", "Reasoning...", "Tinkering...",
    "Analyzing...", "Investigating...", "Processing...", "Working on it...",
    "Checking logs...", "Reading code...", "Planning actions...", "Almost there...",
  ]
  const [label, setLabel] = useState(PHRASES[0])
  useEffect(() => {
    let i = 0
    const t = setInterval(() => { i = (i + 1) % PHRASES.length; setLabel(PHRASES[i]) }, 1800)
    return () => clearInterval(t)
  }, [])
  return <span>{label}</span>
}

function FormattedText({ text }: { text: string }) {
  return (
    <ReactMarkdown
      components={{
        h1: ({ children }) => <p className="font-semibold text-foreground text-base mb-1">{children}</p>,
        h2: ({ children }) => <p className="font-semibold text-foreground text-sm mb-1">{children}</p>,
        h3: ({ children }) => <p className="font-medium text-foreground text-sm mb-0.5">{children}</p>,
        p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic text-muted-foreground">{children}</em>,
        code: ({ children }) => <code className="font-mono text-xs bg-muted/40 px-1.5 py-0.5 rounded text-muted-foreground">{children}</code>,
        pre: ({ children }) => <pre className="font-mono text-xs bg-muted/40 px-3 py-2 rounded my-1 overflow-x-auto text-muted-foreground">{children}</pre>,
        ul: ({ children }) => <ul className="space-y-0.5 my-1">{children}</ul>,
        ol: ({ children }) => <ol className="space-y-0.5 my-1 list-decimal list-inside">{children}</ol>,
        li: ({ children }) => <li className="flex gap-2 text-sm"><span className="text-primary mt-0.5 shrink-0">•</span><span>{children}</span></li>,
        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:opacity-80">{children}</a>,
      }}
    >
      {text}
    </ReactMarkdown>
  )
}

const SESSION_KEY = "devops_agent_session"
const SESSION_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

function getSavedSession(): { id: string; ts: number } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.ts > SESSION_TTL_MS) {
      localStorage.removeItem(SESSION_KEY)
      return null
    }
    return parsed
  } catch { return null }
}

// Inner chat component — only mounts after session is ready so useChat gets correct initialMessages
function ChatInterface({
  conversationId,
  initialMessages,
  onNewSession,
}: {
  conversationId: string
  initialMessages: UIMessage[]
  onNewSession: () => void
}) {
  const [chatInput, setChatInput] = useState("")
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const { messages, sendMessage, status } = useChat({
    messages: initialMessages,
    transport: new DefaultChatTransport({
      api: "/api/agent",
      prepareSendMessagesRequest: ({ id, messages }) => ({
        body: { messages, conversationId, id },
      }),
    }),
  })

  const isLoading = status === "streaming" || status === "submitted"

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const handleSend = () => {
    const text = chatInput.trim()
    if (!text || isLoading) return
    sendMessage({ text })
    setChatInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestedPrompt = (prompt: string) => {
    setChatInput(prompt)
    inputRef.current?.focus()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b border-border bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
            <Bot className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-foreground">DevOps Agent</h1>
            <p className="text-[11px] text-muted-foreground font-mono">
              Gemini 3 Flash — Session active
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border",
            isLoading
              ? "bg-status-info/10 text-status-info border-status-info/20"
              : "bg-status-success/10 text-status-success border-status-success/20"
          )}>
            <span className={cn("w-1.5 h-1.5 rounded-full", isLoading ? "bg-status-info animate-pulse" : "bg-status-success")} />
            {isLoading ? "Working..." : "Ready"}
          </div>
          <button
            onClick={onNewSession}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Session
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="text-center">
              <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                <Terminal className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold text-foreground">DevOps Agent Ready</h2>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-sm text-balance">
                Ask me to manage your Vercel deployments, investigate incidents, run security scans, or raise GitHub PRs for fixes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTED_PROMPTS.map(({ icon: Icon, label, prompt }) => (
                <button
                  key={label}
                  onClick={() => handleSuggestedPrompt(prompt)}
                  className="flex items-center gap-2.5 px-3.5 py-3 rounded-lg border border-border bg-card hover:bg-accent/30 hover:border-border/80 transition-colors text-left group"
                >
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground">{label}</p>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, idx) => (
            <MessageBubble
              key={message.id}
              message={message}
              isStreaming={isLoading && idx === messages.length - 1}
            />
          ))
        )}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3">
            <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center shrink-0 mt-0.5">
              <Bot className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div className="px-3.5 py-2.5 rounded-lg bg-card border border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <Loader2 className="w-3 h-3 animate-spin" />
                <StreamingLabel />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 px-6 py-4 border-t border-border bg-card">
        <div className="flex gap-2 items-end">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask the agent to manage deployments, investigate incidents, scan security, or raise PRs..."
              disabled={isLoading}
              rows={1}
              className={cn(
                "w-full resize-none bg-secondary border border-border rounded-lg px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all font-sans",
                "min-h-[42px] max-h-[120px]"
              )}
              style={{ height: "auto" }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = "auto"
                el.style.height = `${Math.min(el.scrollHeight, 120)}px`
              }}
            />
          </div>
          <button
            onClick={handleSend}
            disabled={!chatInput.trim() || isLoading}
            className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2 font-mono">
          Press Enter to send — Shift+Enter for new line — Agent can take real actions on Vercel and GitHub
        </p>
      </div>
    </>
  )
}

export default function AgentPage() {
  const [session, setSession] = useState<{ id: string; initialMessages: UIMessage[] } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const loadSession = useCallback(async (forceNew = false) => {
    setIsLoading(true)
    setSession(null)
    try {
      if (!forceNew) {
        const saved = getSavedSession()
        if (saved) {
          const res = await fetch(`/api/conversations/${saved.id}/messages`)
          if (res.ok) {
            const msgs = await res.json()
            const initialMessages: UIMessage[] = msgs.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text", text: m.content }],
            }))
            setSession({ id: saved.id, initialMessages })
            setIsLoading(false)
            return
          }
        }
      }
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "New Session", context: "general" }),
      })
      const data = await res.json()
      localStorage.setItem(SESSION_KEY, JSON.stringify({ id: data.id, ts: Date.now() }))
      setSession({ id: data.id, initialMessages: [] })
    } catch (e) {
      console.error("Failed to load session:", e)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleNewSession = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    loadSession(true)
  }, [loadSession])

  return (
    <div className="flex flex-col h-screen">
      {isLoading || !session ? (
        <div className="flex items-center justify-center h-full">
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-mono">
            <Loader2 className="w-4 h-4 animate-spin" />
            Initializing session...
          </div>
        </div>
      ) : (
        <ChatInterface
          key={session.id}
          conversationId={session.id}
          initialMessages={session.initialMessages}
          onNewSession={handleNewSession}
        />
      )}
    </div>
  )
}
