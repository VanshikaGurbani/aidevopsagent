/**
 * Minimal in-memory stand-in for the Supabase query builder, enough for the agent tools and
 * cron routes. It enforces the CHECK constraints from scripts/001_create_devops_schema.sql so
 * tests fail the way the real database would.
 */
type Row = Record<string, unknown>

const CHECKS: Record<string, Record<string, string[]>> = {
  incidents: {
    severity: ["critical", "high", "medium", "low", "info"],
    status: ["open", "investigating", "resolved", "dismissed"],
    category: ["deployment", "security", "performance", "availability", "configuration", "code"],
  },
}

export interface FakeDb {
  tables: Record<string, Row[]>
  errors: string[]
}

export function createFakeDb(seed: Record<string, Row[]> = {}): FakeDb {
  return { tables: structuredClone(seed), errors: [] }
}

class Query implements PromiseLike<{ data: unknown; error: { message: string } | null }> {
  private op: "select" | "insert" | "update" = "select"
  private payload: Row = {}
  private filters: Array<(r: Row) => boolean> = []
  private wantsOne = false
  private max: number | null = null

  constructor(private db: FakeDb, private table: string) {}

  select() { return this }
  insert(p: Row) { this.op = "insert"; this.payload = p; return this }
  update(p: Row) { this.op = "update"; this.payload = p; return this }
  eq(col: string, v: unknown) { this.filters.push((r) => r[col] === v); return this }
  in(col: string, vs: unknown[]) { this.filters.push((r) => vs.includes(r[col])); return this }
  ilike(col: string, pattern: string) {
    const re = new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$", "i")
    this.filters.push((r) => re.test(String(r[col] ?? "")))
    return this
  }
  order() { return this }
  limit(n: number) { this.max = n; return this }
  single() { this.wantsOne = true; return this }
  maybeSingle() { this.wantsOne = true; return this }

  then<A, B>(ok?: ((v: { data: unknown; error: { message: string } | null }) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve(this.run()).then(ok, fail)
  }

  private run(): { data: unknown; error: { message: string } | null } {
    const rows = (this.db.tables[this.table] ??= [])
    if (this.op === "insert" || this.op === "update") {
      for (const [col, allowed] of Object.entries(CHECKS[this.table] ?? {})) {
        const v = this.payload[col]
        if (v !== undefined && !allowed.includes(String(v))) {
          const message = `new row for relation "${this.table}" violates check constraint "${this.table}_${col}_check"`
          this.db.errors.push(message)
          return { data: null, error: { message } }
        }
      }
    }
    if (this.op === "insert") {
      const row = { id: `${this.table}-${rows.length + 1}`, ...this.payload }
      rows.push(row)
      return { data: this.wantsOne ? row : [row], error: null }
    }
    let result = rows.filter((r) => this.filters.every((f) => f(r)))
    if (this.op === "update") for (const r of result) Object.assign(r, this.payload)
    if (this.max !== null) result = result.slice(0, this.max)
    return { data: this.wantsOne ? (result[0] ?? null) : result, error: null }
  }
}

export function fakeSupabase(db: FakeDb) {
  return { from: (table: string) => new Query(db, table) }
}
