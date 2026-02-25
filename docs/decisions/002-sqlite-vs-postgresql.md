# ADR-002: SQLite vs PostgreSQL -- Database Strategy

**Status:** Accepted
**Date:** 2026-02-25
**Deciders:** Rinaldo Festa (Technical Architect)
**Technical Story:** Play New needs a database strategy that supports rapid development iteration (nanoclaw compatibility) while enabling multi-tenant production deployment with strong isolation.

---

## Context

Nanoclaw uses SQLite via `better-sqlite3` for all persistence: chats, messages, sessions, scheduled tasks, and router state. SQLite is excellent for nanoclaw's single-user/single-org use case -- it is fast, zero-config, and requires no external service.

Play New has fundamentally different requirements:

1. **Multi-tenancy:** 3 organizations in Phase 0, 10-20 in Phase 2. Each org's data must be strongly isolated.
2. **Concurrent access:** Multiple user instances within an org may write patterns, read org context, and log audit events simultaneously.
3. **Aggregation queries:** Anonymized views (`v_team_patterns`, `v_org_patterns`) require GROUP BY, HAVING, STDDEV, and PERCENTILE_CONT across large datasets.
4. **Row-Level Security:** PostgreSQL RLS provides defense-in-depth for multi-tenant isolation.
5. **GDPR compliance:** Data residency, encryption at rest (TDE), and audit capabilities are better supported by PostgreSQL.
6. **Scalability:** Phase 2 targets 15,000 users producing ~150K LLM calls/day. SQLite's single-writer limitation would become a bottleneck.

At the same time, we need to:
- Maintain nanoclaw compatibility (SQLite) for the development workflow
- Iterate rapidly during Phase 0 without database server overhead
- Run tests quickly with in-memory databases

---

## Options Evaluated

### Option A: SQLite Per Organization

Use a separate SQLite database file per organization.

| Aspect | Assessment |
|--------|------------|
| **Isolation** | Strong -- each org is a separate file on disk |
| **Nanoclaw compat** | Excellent -- same `better-sqlite3` library |
| **Concurrent writes** | Poor -- SQLite supports one writer at a time per file. Multiple user instances in the same org would contend. |
| **Aggregation** | Poor -- no `STDDEV`, no `PERCENTILE_CONT`, no window functions (limited). Cross-org queries impossible without application-layer merge. |
| **Operational** | Moderate -- many small files, backup per-file, no standard monitoring tools |
| **RLS** | Not available |
| **Phase 0** | Could work (3 orgs, 50 users each) |
| **Phase 1+** | Would not scale |

### Option B: PostgreSQL with Schema-Per-Org

Each organization gets its own PostgreSQL schema. Platform-level tables in `public` schema.

| Aspect | Assessment |
|--------|------------|
| **Isolation** | Strong -- separate schema per org. Cross-schema queries require explicit `JOIN`. |
| **Nanoclaw compat** | Requires abstraction layer (sync SQLite -> async PostgreSQL) |
| **Concurrent writes** | Excellent -- PostgreSQL handles thousands of concurrent writers |
| **Aggregation** | Excellent -- full SQL analytics: STDDEV, PERCENTILE_CONT, window functions, CTEs |
| **Operational** | Standard -- pgAdmin, standard backup tools, monitoring, replication |
| **RLS** | Available as additional defense-in-depth within schemas |
| **Phase 0** | Slightly more setup overhead but fully capable |
| **Phase 1+** | Scales to 50K+ users without architecture changes |

### Option C: PostgreSQL with Row-Level Security (Single Schema)

Single PostgreSQL schema for all organizations. RLS policies enforce isolation.

| Aspect | Assessment |
|--------|------------|
| **Isolation** | Moderate -- relies entirely on RLS policies being correct. A bug in RLS = cross-org data leak. |
| **Nanoclaw compat** | Same as Option B (abstraction layer needed) |
| **Concurrent writes** | Excellent |
| **Aggregation** | Excellent |
| **Operational** | Simpler schema management (one schema), but RLS adds complexity to every query |
| **RLS** | Core isolation mechanism (not defense-in-depth) |
| **Phase 0** | Workable but RLS policies must be 100% correct from day one |
| **Phase 1+** | Scales well, but shared indexes across all orgs may degrade at large scale |

---

## Decision

**Use SQLite for development (fast iteration, nanoclaw compatibility) and PostgreSQL with schema-per-org for production.**

Specifically:

1. **Development environment:** SQLite via `better-sqlite3`. Single database file at `./data/pn-agent.db`. All tables in one database. Matches nanoclaw's native behavior.

2. **Staging and production:** PostgreSQL 16+ with schema-per-org isolation.
   - `public` schema: `organizations`, `skills` (platform-level), `taxonomy`
   - `org_{org_id}` schema: all org-scoped tables (`user_instances`, `teams`, `chats`, `messages`, `sessions`, `pattern_logs`, `insights`, `org_context_docs`, `audit_logs`, `user_skills`, `mcp_connections`)

3. **Database abstraction layer:** `DatabaseAdapter` interface with two implementations (`SqliteAdapter`, `PostgresAdapter`). Application code never calls SQLite or PostgreSQL APIs directly.

4. **Dual migration support:** Migration files written in standard SQL. Adapter translates PostgreSQL-specific syntax (UUID, JSONB, TIMESTAMPTZ) to SQLite equivalents (TEXT) at runtime.

---

## Database Abstraction Layer

```typescript
// src/db/adapter.ts

interface DatabaseAdapter {
    // Query execution
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
    queryOne<T>(sql: string, params?: unknown[]): Promise<T | null>;
    execute(sql: string, params?: unknown[]): Promise<{ rowsAffected: number }>;

    // Transaction support
    transaction<T>(fn: (tx: TransactionAdapter) => Promise<T>): Promise<T>;

    // Schema management
    migrate(direction: 'up' | 'down', version?: string): Promise<void>;
    setOrgSchema(orgId: string): Promise<void>;  // PostgreSQL: SET search_path

    // Connection lifecycle
    connect(): Promise<void>;
    disconnect(): Promise<void>;

    // Metadata
    readonly type: 'sqlite' | 'postgresql';
}
```

### SQLite Adapter

```typescript
// src/db/sqlite-adapter.ts
import Database from 'better-sqlite3';

class SqliteAdapter implements DatabaseAdapter {
    readonly type = 'sqlite';
    private db: Database.Database;

    async connect(): Promise<void> {
        this.db = new Database(this.path);
        this.db.pragma('journal_mode = WAL');        // Better concurrent read performance
        this.db.pragma('foreign_keys = ON');          // Enforce FK constraints
        this.db.pragma('busy_timeout = 5000');        // Wait up to 5s for locks
    }

    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
        // Translate PostgreSQL-isms to SQLite
        const sqliteSql = this.translateSql(sql);
        const stmt = this.db.prepare(sqliteSql);
        return stmt.all(...(params || [])) as T[];
    }

    async setOrgSchema(_orgId: string): Promise<void> {
        // No-op for SQLite (single schema)
    }

    private translateSql(sql: string): string {
        return sql
            .replace(/gen_random_uuid\(\)/g, "lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr('89ab', abs(random()) % 4 + 1, 1) || substr(lower(hex(randomblob(2))),2) || '-' || lower(hex(randomblob(6)))")
            .replace(/TIMESTAMPTZ/g, 'TEXT')
            .replace(/JSONB/g, 'TEXT')
            .replace(/UUID/g, 'TEXT')
            .replace(/INET/g, 'TEXT')
            .replace(/now\(\)/g, "datetime('now')")
            .replace(/::uuid/g, '')
            .replace(/::text/g, '');
    }
}
```

### PostgreSQL Adapter

```typescript
// src/db/postgres-adapter.ts
import { Pool, PoolClient } from 'pg';

class PostgresAdapter implements DatabaseAdapter {
    readonly type = 'postgresql';
    private pool: Pool;

    async connect(): Promise<void> {
        this.pool = new Pool({
            connectionString: this.connectionString,
            max: 20,                        // Connection pool size
            idleTimeoutMillis: 30000,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false,
        });
    }

    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
        const result = await this.pool.query(sql, params);
        return result.rows as T[];
    }

    async setOrgSchema(orgId: string): Promise<void> {
        // Sanitize orgId to prevent SQL injection (only alphanumeric and hyphens)
        const schemaName = `org_${orgId.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await this.pool.query(`SET search_path TO ${schemaName}, public`);
    }

    async transaction<T>(fn: (tx: TransactionAdapter) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn(new PostgresTransaction(client));
            await client.query('COMMIT');
            return result;
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    }
}
```

---

## Schema-Per-Org in PostgreSQL

### Organization Onboarding

When a new organization is created:

```sql
-- 1. Create org schema
CREATE SCHEMA org_abc123;

-- 2. Run org-scoped migrations within the schema
SET search_path TO org_abc123, public;

CREATE TABLE user_instances ( ... );
CREATE TABLE teams ( ... );
CREATE TABLE chats ( ... );
CREATE TABLE messages ( ... );
-- ... all org-scoped tables

-- 3. Create anonymized views
CREATE VIEW v_team_patterns AS ...;
CREATE VIEW v_org_patterns AS ...;
CREATE VIEW v_skill_usage AS ...;

-- 4. Set schema-level permissions
GRANT USAGE ON SCHEMA org_abc123 TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA org_abc123 TO app_user;

-- Revoke dangerous operations on audit_logs
REVOKE UPDATE, DELETE ON org_abc123.audit_logs FROM app_user;
```

### Query Routing

Every database request includes the `org_id`. The adapter sets the PostgreSQL `search_path` before executing:

```typescript
async function queryForOrg<T>(orgId: string, sql: string, params: unknown[]): Promise<T[]> {
    await this.adapter.setOrgSchema(orgId);
    return this.adapter.query<T>(sql, params);
}
```

### Cross-Org Queries

Cross-org queries (for Tier 4 benchmarks) explicitly join across schemas:

```sql
-- Platform admin query (not available to org users)
SELECT
    o.industry, o.size_band,
    p.category_l1, p.metric_type,
    AVG(p.metric_value) as benchmark_avg
FROM public.organizations o
CROSS JOIN LATERAL (
    SELECT * FROM pg_catalog.format('org_%s.pattern_logs', o.org_id)
) p
GROUP BY o.industry, o.size_band, p.category_l1, p.metric_type
HAVING COUNT(DISTINCT o.org_id) >= 3;
```

In practice, cross-org benchmarks are computed by a scheduled job that reads from each org schema and writes to a `public.benchmarks` materialized view.

---

## Consequences

### Positive

1. **Fast development.** SQLite requires zero setup. `npm run dev` works immediately. Tests use in-memory SQLite for speed.
2. **Strong production isolation.** Schema-per-org means a query in org A's schema cannot accidentally access org B's data, even without RLS. This is the strongest isolation model short of separate database instances.
3. **Nanoclaw compatibility.** The SQLite adapter preserves nanoclaw's existing query patterns. Upstream merges are less likely to break database code.
4. **Full SQL power.** PostgreSQL provides STDDEV, PERCENTILE_CONT, window functions, CTEs, and JSONB operators needed for the intelligence layer.
5. **Operational maturity.** PostgreSQL has decades of operational tooling: pg_dump, replication, monitoring, connection pooling (PgBouncer).

### Negative

1. **Dual implementation cost.** Every database feature must work on both SQLite and PostgreSQL. Some features (views, RLS) are PostgreSQL-only.
2. **SQL translation complexity.** The SQLite adapter's `translateSql` function will grow as we use more PostgreSQL-specific features. This is a maintenance burden.
3. **Schema-per-org management.** Creating schemas, running migrations per schema, and managing schema-level permissions adds operational complexity.
4. **Testing gap.** Unit tests run on SQLite. Production runs PostgreSQL. There will be behavioral differences (type coercion, NULL handling, constraint behavior) that only integration tests catch.
5. **Cross-org queries are complex.** Joining across schemas requires dynamic SQL or materialized views. Not a problem for Phase 0 (manual intelligence) but matters for Phase 2+.

---

## Migration Strategy

### Phase 0: SQLite for Everything

- All development on SQLite
- Design partners deployed with single PostgreSQL instance, single schema (no schema-per-org yet)
- `org_id` filtering at application layer provides isolation

### Phase 0 Late / Phase 1: Schema-Per-Org

- Migrate to schema-per-org for existing design partners
- New organizations get their own schema from day one
- Cross-org benchmark view deployed

### Phase 2+: Consider Dedicated Databases

If schema-per-org becomes insufficient (extremely large orgs, regulatory requirements for physical isolation), we can migrate specific orgs to dedicated PostgreSQL instances. The database adapter makes this transparent.

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **SQLite/PostgreSQL behavioral differences cause production bugs** | Medium | Medium | Integration test suite runs on both backends. CI runs PostgreSQL tests. |
| **Schema-per-org creates too many schemas** | Low (Phase 0-1) | Low | PostgreSQL handles thousands of schemas. Only relevant at 100+ orgs. |
| **SQL translation layer becomes unmaintainable** | Medium | Medium | Keep translations minimal. Use PostgreSQL-compatible SQL wherever possible. Accept that some features are PostgreSQL-only. |
| **Migration tooling breaks during schema-per-org migration** | Medium | Medium | Test migration scripts on staging with real data copies. Have rollback plan. |
| **Performance difference between dev (SQLite) and prod (PostgreSQL)** | Medium | Low | Performance testing happens on PostgreSQL staging, not SQLite dev. |

---

## Review Date

This decision will be reviewed at the Phase 0 midpoint (approximately May 2026) to assess:
- Is the dual-adapter approach causing significant development friction?
- Is schema-per-org the right isolation model, or should we evaluate RLS?
- Are there SQLite/PostgreSQL behavioral differences causing bugs?
- Should we invest in a more sophisticated migration framework?
