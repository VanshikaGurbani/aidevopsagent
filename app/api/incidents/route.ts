import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const status = url.searchParams.get("status")
  const severity = url.searchParams.get("severity")
  const limit = parseInt(url.searchParams.get("limit") ?? "20")

  const supabase = await createClient()
  let query = supabase
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)

  if (status) query = query.eq("status", status)
  if (severity) query = query.eq("severity", severity)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
