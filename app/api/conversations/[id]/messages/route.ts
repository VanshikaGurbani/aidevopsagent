import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Only return messages from conversations created within the last 24 hours
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  const { data: conversation } = await supabase
    .from("agent_conversations")
    .select("created_at")
    .eq("id", id)
    .single()

  if (!conversation || conversation.created_at < cutoff) {
    return NextResponse.json([])
  }

  const { data: messages } = await supabase
    .from("agent_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true })

  return NextResponse.json(messages ?? [])
}
