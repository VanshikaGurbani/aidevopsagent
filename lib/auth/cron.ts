import { timingSafeEqual } from "node:crypto"

/**
 * Vercel Cron calls our cron routes with `Authorization: Bearer <CRON_SECRET>`.
 * Fails closed: if CRON_SECRET is not configured nothing is authorized (a plain string
 * comparison against `Bearer ${undefined}` would accept the literal header "Bearer undefined").
 */
export function isAuthorizedCron(req: Request, secret: string | undefined = process.env.CRON_SECRET): boolean {
  if (!secret) return false
  const expected = Buffer.from(`Bearer ${secret}`)
  const received = Buffer.from(req.headers.get("Authorization") ?? "")
  return received.length === expected.length && timingSafeEqual(received, expected)
}
