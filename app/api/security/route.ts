import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = parseInt(url.searchParams.get("limit") ?? "30")
  const unacknowledged = url.searchParams.get("unacknowledged") === "true"

  const supabase = await createClient()
  let query = supabase
    .from("security_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (unacknowledged) query = query.eq("acknowledged", false)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const { id } = await req.json()
  const supabase = await createClient()
  const { error } = await supabase
    .from("security_events")
    .update({ acknowledged: true })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
