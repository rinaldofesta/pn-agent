# 06 -- Deployment Architecture

**Status:** Draft
**Owner:** TBD
**Last Updated:** 2026-02-25
**PRD Sections:** 8.5, 8.7, 20 (all), 8.4 FR-007

---

## Context

Play New Phase 0 serves 3 design partner organizations with up to 150 total users. The deployment must satisfy EU data residency requirements, provide 99.5% availability during business hours, and keep infrastructure costs within the design partnership budget (no revenue in Phase 0).

This document specifies the infrastructure architecture, component deployment, scaling model, monitoring strategy, and cost estimates for Phase 0, with a clear path to Phase 1 scaling.

---

## Nanoclaw Foundation

**What we inherit:**
- Docker-based container execution model [nc: src/container-runner.ts, Dockerfile]
- Single-process host that manages containers [nc: src/claw.ts]
- Standard Node.js deployment patterns

**What we extend:**
- Single process becomes multi-instance host behind load balancer
- Docker exec becomes Kubernetes pod management (or Docker Compose for Phase 0)
- Local SQLite becomes managed PostgreSQL
- No monitoring becomes Prometheus + Grafana + Sentry

---

## Play New Requirements

- EU data centers only [PRD S8.5]
- 99.5% uptime during business hours (Mon-Fri, 8am-8pm CET) [PRD S8.5]
- <30s response for standard queries [PRD FR-001.8]
- 150 concurrent users [PRD S8.5]
- AES-256 at rest, TLS 1.3 in transit [PRD S8.5]
- Daily encrypted backups [PRD S8.5]
- System health monitoring: LLM latency, error rates, user satisfaction [PRD FR-007.4]
- Admin dashboard: active users, interaction volumes, skill activation [PRD FR-007.1]
- Monthly infrastructure cost target: ~2-5K EUR [PRD S20.2]

---

## Technical Specification

### Phase 0 Deployment Model

Phase 0 runs on a single EU cloud instance (or small cluster) with managed services where possible. Simplicity is prioritized over horizontal scalability.

```
                    PHASE 0 INFRASTRUCTURE

    ┌──────────────────────────────────────────────────────────┐
    │                     EU CLOUD REGION                       │
    │               (e.g., Hetzner FSN1 or AWS eu-central-1)   │
    │                                                           │
    │  ┌─────────────────────────────────────────────────────┐  │
    │  │                LOAD BALANCER                         │  │
    │  │            (nginx or cloud LB)                       │  │
    │  │                                                      │  │
    │  │  TLS termination (Let's Encrypt / ACM)               │  │
    │  │  Rate limiting (global)                              │  │
    │  │  Health check routing                                │  │
    │  └──────────┬──────────────────┬───────────────────────┘  │
    │             │                  │                           │
    │  ┌──────────▼──────────┐  ┌───▼────────────────────┐     │
    │  │  HOST PROCESS       │  │  ADMIN DASHBOARD       │     │
    │  │  (Node.js)          │  │  (Web App)             │     │
    │  │                     │  │                        │     │
    │  │  - Tenant resolver  │  │  - Aggregated metrics  │     │
    │  │  - Channel adapters │  │  - Context management  │     │
    │  │  - Instance manager │  │  - Skill assignment    │     │
    │  │  - Queue processor  │  │  - Integration health  │     │
    │  │  - Pool manager     │  │                        │     │
    │  │  - Pattern collector│  │  Auth: SSO / password  │     │
    │  │  - Metrics exporter │  │                        │     │
    │  │                     │  │                        │     │
    │  │  Replicas: 2        │  │  Replicas: 1           │     │
    │  │  (active-active)    │  │                        │     │
    │  └──────────┬──────────┘  └────────────────────────┘     │
    │             │                                             │
    │  ┌──────────▼─────────────────────────────────────────┐  │
    │  │              CONTAINER POOL                         │  │
    │  │                                                     │  │
    │  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐    ┌────┐    │  │
    │  │  │ C1 │ │ C2 │ │ C3 │ │ C4 │ │ C5 │ .. │C60 │    │  │
    │  │  │WARM│ │WARM│ │ACT │ │ACT │ │ACT │    │WARM│    │  │
    │  │  └────┘ └────┘ └────┘ └────┘ └────┘    └────┘    │  │
    │  │                                                     │  │
    │  │  pn-agent:latest containers                        │  │
    │  │  Max: 60 containers                                │  │
    │  │  Each: 512MB RAM, 0.5 CPU                          │  │
    │  └─────────────────────────────────────────────────────┘  │
    │                                                           │
    │  ┌─────────────────┐  ┌──────────────┐  ┌────────────┐  │
    │  │  PostgreSQL 16   │  │  Redis 7     │  │  Qdrant /  │  │
    │  │  + pgvector      │  │              │  │  Weaviate  │  │
    │  │                  │  │  - Message   │  │            │  │
    │  │  - Org schemas   │  │    queues    │  │  - Personal│  │
    │  │  - Pattern logs  │  │  - Routing   │  │    memory  │  │
    │  │  - Config        │  │    cache     │  │  - Per-user│  │
    │  │  - Audit logs    │  │  - Session   │  │    namespaces│
    │  │  - Org context   │  │    state     │  │            │  │
    │  │    vectors       │  │              │  │            │  │
    │  │                  │  │  RAM: 2GB    │  │  RAM: 4GB  │  │
    │  │  RAM: 4GB        │  │              │  │  Disk: 50GB│  │
    │  │  Disk: 100GB SSD │  │              │  │            │  │
    │  └─────────────────┘  └──────────────┘  └────────────┘  │
    │                                                           │
    │  ┌─────────────────┐  ┌──────────────────────────────┐  │
    │  │  Object Storage │  │  Monitoring Stack            │  │
    │  │  (S3-compat)    │  │                              │  │
    │  │                 │  │  Prometheus + Grafana         │  │
    │  │  - Skill files  │  │  Sentry (error tracking)     │  │
    │  │  - Org context  │  │  Loki (log aggregation)      │  │
    │  │    documents    │  │                              │  │
    │  │  - Exports      │  │  Alerting:                   │  │
    │  │  - Backups      │  │  - PagerDuty / Slack alerts  │  │
    │  │                 │  │  - Error rate thresholds      │  │
    │  │  Disk: 50GB     │  │  - LLM latency thresholds    │  │
    │  └─────────────────┘  └──────────────────────────────┘  │
    │                                                           │
    └──────────────────────────────────────────────────────────┘
```

### Component Deployment Detail

#### Host Process

| Attribute | Value |
|-----------|-------|
| Technology | Node.js 20 LTS (TypeScript, compiled) |
| Replicas | 2 (active-active behind load balancer) |
| CPU per replica | 2 cores |
| RAM per replica | 4 GB |
| State | Stateless (all state in PostgreSQL + Redis) |
| Startup time | <5 seconds |
| Health check | HTTP /health endpoint |
| Deployment | Rolling update, zero-downtime |

The host process handles:
- Slack webhook/socket events
- Teams bot framework events
- Email IMAP polling
- Tenant resolution and routing
- Container pool management
- Pattern collection (IPC watching)
- Prometheus metrics export

#### Container Pool

| Attribute | Value |
|-----------|-------|
| Image | pn-agent:latest |
| Min warm | 5 containers |
| Max total | 60 containers |
| CPU per container | 0.5 cores |
| RAM per container | 512 MB |
| Idle timeout | 15 minutes |
| Recycling | Unmount, flush, return to warm pool |
| Total pool resource ceiling | 30 CPU cores, 30 GB RAM |

#### PostgreSQL

| Attribute | Value |
|-----------|-------|
| Version | 16 with pgvector extension |
| Deployment | Managed service or single instance + streaming replica |
| CPU | 2 cores |
| RAM | 4 GB |
| Storage | 100 GB SSD (expandable) |
| Backup | Daily automated, encrypted, retained 30 days |
| Connection pooling | PgBouncer (if not managed service) |
| Schemas | pn_platform + one schema per org (3 in Phase 0) |

#### Redis

| Attribute | Value |
|-----------|-------|
| Version | 7+ |
| Deployment | Single instance with persistence (AOF) |
| CPU | 1 core |
| RAM | 2 GB |
| Purpose | Message queues, routing cache, session state |
| Persistence | AOF (appendonly) for message queue durability |
| Backup | Daily RDB snapshot |

#### Vector Database

| Attribute | Value |
|-----------|-------|
| Technology | Qdrant or Weaviate (TBD, ADR-001) |
| Deployment | Single instance (Phase 0), cluster (Phase 1+) |
| CPU | 2 cores |
| RAM | 4 GB |
| Storage | 50 GB SSD |
| Namespaces | One per user instance (~150 in Phase 0) |
| Encryption | Per-namespace encryption (application-level in Phase 0) |

#### Object Storage

| Attribute | Value |
|-----------|-------|
| Technology | S3-compatible (MinIO self-hosted, or cloud S3) |
| Storage | 50 GB (Phase 0) |
| Purpose | Skill files, org context documents, user exports, backups |
| Encryption | Server-side AES-256 |
| Lifecycle | Exports deleted after 24 hours, backups retained 30 days |

### Network Architecture

```
                    NETWORK TOPOLOGY

    INTERNET
    │
    ├── Slack API ←→ Host (webhook/socket)
    ├── Teams API ←→ Host (bot framework)
    ├── Email (IMAP/SMTP) ←→ Host
    │
    ▼
    ┌──────────────────────────────────────────┐
    │           PUBLIC NETWORK                  │
    │                                           │
    │  Load Balancer (TLS termination)          │
    │  ├── HTTPS :443 → Host Process :3000      │
    │  └── HTTPS :443 → Admin Dashboard :3001   │
    └──────────────────────┬───────────────────┘
                           │
    ┌──────────────────────▼───────────────────┐
    │           PRIVATE NETWORK                 │
    │                                           │
    │  Host Process ←→ Redis :6379              │
    │  Host Process ←→ PostgreSQL :5432         │
    │  Host Process ←→ Vector DB :6333          │
    │  Host Process ←→ Object Storage :9000     │
    │  Host Process ←→ Container Pool           │
    │                                           │
    │  Container Pool → api.anthropic.com :443  │
    │  Container Pool → api.openai.com :443     │
    │  Container Pool → Vector DB :6333         │
    │  Container Pool → PostgreSQL :5432        │
    │  Container Pool → (nothing else)          │
    └──────────────────────────────────────────┘
```

**Firewall rules:**

| Source | Destination | Port | Allow |
|--------|-------------|------|-------|
| Internet | Load Balancer | 443 | Yes (HTTPS) |
| Load Balancer | Host Process | 3000 | Yes |
| Load Balancer | Admin Dashboard | 3001 | Yes |
| Host Process | PostgreSQL | 5432 | Yes |
| Host Process | Redis | 6379 | Yes |
| Host Process | Vector DB | 6333 | Yes |
| Host Process | Object Storage | 9000 | Yes |
| Container | api.anthropic.com | 443 | Yes |
| Container | api.openai.com | 443 | Yes |
| Container | Vector DB | 6333 | Yes |
| Container | PostgreSQL | 5432 | Yes |
| Container | anything else | any | **BLOCKED** |
| Any internal | Internet (outbound) | any | **BLOCKED** (except above) |

### Scaling Model

#### Phase 0 Sizing (150 users)

```
    PHASE 0 RESOURCE ESTIMATES

    Users: 150 total (3 orgs x 50)
    Peak concurrent: ~50 users (33%)
    Daily LLM calls: ~1,000
    Monthly LLM calls: ~20,000

    ┌────────────────────────┬────────┬──────┬────────┐
    │ Component              │ CPU    │ RAM  │ Storage│
    ├────────────────────────┼────────┼──────┼────────┤
    │ Host Process (x2)      │ 4 cores│ 8 GB │ --     │
    │ Container Pool (peak)  │ 25 cors│ 25GB │ --     │
    │ PostgreSQL             │ 2 cores│ 4 GB │ 100 GB │
    │ Redis                  │ 1 core │ 2 GB │ 1 GB   │
    │ Vector DB              │ 2 cores│ 4 GB │ 50 GB  │
    │ Object Storage         │ --     │ --   │ 50 GB  │
    │ Monitoring             │ 1 core │ 2 GB │ 20 GB  │
    ├────────────────────────┼────────┼──────┼────────┤
    │ TOTAL                  │ 35 cors│ 45GB │ 221 GB │
    └────────────────────────┴────────┴──────┴────────┘

    Note: Container pool peak is worst-case. Average is
    ~15-20 concurrent containers during business hours.
```

#### Phase 1 Scaling Path (2,000 users)

```
    PHASE 1 RESOURCE ESTIMATES

    Users: 2,000 (5-10 orgs)
    Peak concurrent: ~660 users (33%)
    Daily LLM calls: ~20,000

    Key changes from Phase 0:
    - Host Process: 4 replicas (up from 2)
    - Container Pool: max 200 (up from 60)
    - PostgreSQL: managed cluster, read replicas
    - Redis: Redis Cluster (3 nodes)
    - Vector DB: cluster mode (3 nodes)
    - Kubernetes: auto-scaling enabled

    Estimated cost: 15-30K EUR/month [PRD S20.2]
```

### Monitoring Strategy

```
                    MONITORING ARCHITECTURE

    ┌──────────────────────────────────────────────────────┐
    │                    GRAFANA                            │
    │              (Dashboards + Alerting)                  │
    │                                                       │
    │  Dashboard: System Health                             │
    │  ├── Host process: CPU, memory, event loop lag        │
    │  ├── Container pool: active, warm, idle counts        │
    │  ├── Database: connections, query latency, disk       │
    │  ├── Redis: memory, queue depth, pub/sub              │
    │  └── Vector DB: query latency, storage               │
    │                                                       │
    │  Dashboard: Application Metrics                       │
    │  ├── Messages processed/minute (by org, by channel)   │
    │  ├── Response time (p50, p95, p99)                    │
    │  ├── LLM API latency (by provider)                    │
    │  ├── Container cold start time                        │
    │  ├── Queue wait time                                  │
    │  ├── Pattern collection success rate                  │
    │  └── Error rate (by type)                             │
    │                                                       │
    │  Dashboard: Business Metrics                          │
    │  ├── Active users (daily, weekly) per org             │
    │  ├── Interactions per user per week                   │
    │  ├── Skill activation rate                            │
    │  ├── Forward mode usage vs direct query               │
    │  └── Skill feedback scores                            │
    │                                                       │
    │  Dashboard: Privacy & Compliance                      │
    │  ├── Pattern collection volume                        │
    │  ├── Aggregation view query count                     │
    │  ├── Data deletion requests                           │
    │  ├── Audit log volume                                 │
    │  └── Encryption key operations                        │
    └──────────────────────────┬────────────────────────────┘
                               │
                     ┌─────────▼─────────┐
                     │   PROMETHEUS      │
                     │                   │
                     │   Scrape targets: │
                     │   - Host /metrics │
                     │   - Node exporter │
                     │   - PG exporter   │
                     │   - Redis exporter│
                     │   - Custom metrics│
                     │                   │
                     │   Retention: 30d  │
                     └───────────────────┘
```

**Key metrics and alert thresholds:**

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Response time p95 | >20s | >30s | Investigate LLM latency or container pool |
| Error rate | >1% | >5% | Page on-call, investigate |
| Container pool utilization | >80% | >95% | Scale up pool, investigate spike |
| PostgreSQL connections | >80% max | >95% max | Check for connection leaks |
| Redis memory | >70% | >90% | Increase memory or investigate |
| LLM API error rate | >2% | >10% | Switch to fallback provider |
| Queue depth (any user) | >10 msgs | >50 msgs | Investigate processing backlog |
| Host process CPU | >70% | >90% | Scale horizontally |
| Disk usage (any volume) | >70% | >85% | Expand storage |

**Custom LLM latency metrics:**

```typescript
// Prometheus metrics exported by the host process
const llmLatency = new Histogram({
  name: 'pn_llm_request_duration_seconds',
  help: 'LLM API request duration',
  labelNames: ['provider', 'model', 'org_id'],
  buckets: [1, 2, 5, 10, 15, 20, 30, 60],
});

const containerAssignment = new Histogram({
  name: 'pn_container_assignment_duration_seconds',
  help: 'Time to assign container to user request',
  labelNames: ['pool_state'],  // 'warm' or 'cold'
  buckets: [0.1, 0.5, 1, 2, 5, 10, 20],
});

const messageProcessing = new Histogram({
  name: 'pn_message_processing_duration_seconds',
  help: 'End-to-end message processing time',
  labelNames: ['org_id', 'channel', 'message_type'],
  buckets: [5, 10, 15, 20, 25, 30, 45, 60, 120],
});

const patternCollection = new Counter({
  name: 'pn_patterns_collected_total',
  help: 'Total patterns collected',
  labelNames: ['org_id', 'category_l1'],
});

const activeContainers = new Gauge({
  name: 'pn_containers_active',
  help: 'Number of currently active containers',
  labelNames: ['state'],  // 'warm', 'active', 'recycling'
});
```

### Cost Estimates

#### Phase 0 Monthly Infrastructure Cost

```
    PHASE 0 COST BREAKDOWN (EUR/month)

    ┌─────────────────────────────┬──────────┬────────────┐
    │ Component                   │ Spec     │ Est. Cost  │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Compute (host + containers) │ ~40 cores│            │
    │   Option A: Hetzner         │ 3x CCX33│ 300-500    │
    │   Option B: AWS             │ 3x m6i.2x│ 800-1200  │
    ├─────────────────────────────┼──────────┼────────────┤
    │ PostgreSQL (managed)        │ 4GB/100GB│ 50-200     │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Redis                       │ 2GB      │ 30-100     │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Vector DB (self-hosted)     │ 4GB/50GB │ (included) │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Object Storage              │ 50GB     │ 5-20       │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Monitoring (self-hosted)    │ Prom+Graf│ (included) │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Sentry (cloud)              │ Team plan│ 30         │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Domain + TLS                │          │ 10         │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Backup storage              │ 200GB    │ 10-30      │
    ├─────────────────────────────┼──────────┼────────────┤
    │ Network / bandwidth         │          │ 20-50      │
    ├─────────────────────────────┼──────────┼────────────┤
    │ INFRASTRUCTURE SUBTOTAL     │          │ 500-2,100  │
    ╞═════════════════════════════╪══════════╪════════════╡
    │ Claude API (Anthropic)      │ ~20K     │            │
    │   calls/month               │          │            │
    │   Avg 2K input + 1K output  │          │            │
    │   tokens per call           │          │            │
    │   @ Sonnet pricing          │          │ 800-1,500  │
    ├─────────────────────────────┼──────────┼────────────┤
    │ OpenAI API (fallback)       │ ~2K calls│ 100-200    │
    ├─────────────────────────────┼──────────┼────────────┤
    │ LLM SUBTOTAL                │          │ 900-1,700  │
    ╞═════════════════════════════╪══════════╪════════════╡
    │ TOTAL MONTHLY               │          │ 1,400-3,800│
    └─────────────────────────────┴──────────┴────────────┘

    Target: ~2-5K EUR/month [PRD S20.2]
    Estimate: Within target range.

    Note: LLM costs are the largest variable. Will depend
    on average message complexity and conversation length.
    Monitor closely and optimize prompt engineering.
```

#### Cost Optimization Levers

| Lever | Savings Potential | Trade-off |
|-------|-------------------|-----------|
| Prompt caching (Claude) | 20-40% on LLM costs | Requires cache-friendly prompt structure |
| Smaller model for classification | 50% on pattern collection calls | May reduce classification accuracy |
| Container pool right-sizing | 10-20% on compute | Risk of cold starts during spikes |
| Hetzner vs AWS | 50-60% on compute | Fewer managed services, more operational burden |
| pgvector instead of dedicated vector DB | 100% vector DB cost saved | Potentially lower query performance at scale |

### Deployment Pipeline

```
                    CI/CD PIPELINE

    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │  GitHub  │────>│  GitHub  │────>│  Container│
    │  Push    │     │  Actions │     │  Registry │
    └──────────┘     │          │     │          │
                     │  1. Lint │     │  Images: │
                     │  2. Test │     │  - host  │
                     │  3. Build│     │  - agent │
                     │  4. Push │     │  - admin │
                     └──────┬───┘     └──────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
              ▼             ▼             ▼
         ┌─────────┐  ┌─────────┐  ┌──────────┐
         │   DEV   │  │ STAGING │  │   PROD   │
         │         │  │         │  │          │
         │  Auto-  │  │  Auto-  │  │  Manual  │
         │  deploy │  │  deploy │  │  approve │
         │  on PR  │  │  on     │  │  + deploy│
         │  merge  │  │  main   │  │          │
         └─────────┘  └─────────┘  └──────────┘
```

**Deployment steps (production):**

1. Build and test in CI (GitHub Actions)
2. Build container images, push to registry
3. Deploy to staging, run integration tests
4. Manual approval gate
5. Rolling update to production (zero-downtime)
6. Verify health checks pass
7. Monitor error rates for 15 minutes
8. If error rate exceeds threshold, automatic rollback

**Database migrations:**

```
Migrations run as a separate step BEFORE deployment:
1. Run migration in staging, verify
2. Run migration in production (non-destructive only)
3. Deploy new code that uses new schema
4. (If needed) Run post-migration cleanup

Rule: All migrations must be backward-compatible.
New code must work with both old and new schema during rollout.
```

### Backup and Disaster Recovery

| Component | Backup Method | Frequency | Retention | RTO | RPO |
|-----------|---------------|-----------|-----------|-----|-----|
| PostgreSQL | pg_dump (full) + WAL archiving | Daily full + continuous WAL | 30 days | 1 hour | 5 minutes |
| Redis | RDB snapshot + AOF | Hourly RDB, continuous AOF | 7 days | 15 minutes | 1 minute |
| Vector DB | Snapshot API | Daily | 14 days | 1 hour | 24 hours |
| Object Storage | Cross-region replication | Continuous | 30 days | 15 minutes | Near-zero |
| Configuration | Git (version controlled) | Every commit | Unlimited | Minutes | Near-zero |

**Disaster recovery plan:**

```
Scenario: Complete infrastructure loss

1. Provision new infrastructure from Terraform/IaC (30 min)
2. Restore PostgreSQL from latest backup (30 min)
3. Restore Redis from latest snapshot (10 min)
4. Restore Vector DB from latest snapshot (30 min)
5. Deploy application from container registry (10 min)
6. Verify health checks and run smoke tests (15 min)
7. Update DNS / load balancer (5 min)

Total RTO: ~2.5 hours

For Phase 0 (99.5% SLA during business hours):
2.5 hours = well within 6 hours/month allowed downtime.
```

---

## Phase 0 Scope

### What we deploy in Phase 0:

| Component | Deployment | Notes |
|-----------|------------|-------|
| Host process | 2 replicas, Docker Compose or K8s | Active-active |
| Container pool | Docker engine on host nodes | Max 60 containers |
| PostgreSQL | Managed or single + replica | pgvector enabled |
| Redis | Single instance with AOF | Message queues + cache |
| Vector DB | Single instance | Qdrant or Weaviate |
| Object storage | S3-compatible | MinIO or cloud S3 |
| Load balancer | nginx or cloud LB | TLS termination |
| Monitoring | Prometheus + Grafana (self-hosted) | Core dashboards |
| Error tracking | Sentry (cloud) | Team plan |
| CI/CD | GitHub Actions | Auto-deploy staging, manual prod |
| Backups | Automated daily | All components |

### What we defer:

| Component | Deferred To | Reason |
|-----------|-------------|--------|
| Kubernetes auto-scaling | Phase 1 | Fixed capacity sufficient for 150 users |
| Multi-region deployment | Phase 2+ | Single EU region for Phase 0 |
| CDN | Phase 1 | No public web UI in Phase 0 |
| SOC 2 infrastructure controls | Phase 1 | Not required for design partnership |
| Log retention compliance | Phase 1 | 30-day retention sufficient for Phase 0 |
| Dedicated staging environment | Month 2 | Start with dev + prod only |

---

## Phase 1 Scaling Path

When Phase 0 succeeds and we move to Phase 1 (500-2,000 users, 5-10 orgs):

| Area | Phase 0 | Phase 1 |
|------|---------|---------|
| Compute | 2 host replicas, 60 containers | 4+ host replicas, 200+ containers |
| Orchestration | Docker Compose or minimal K8s | Full Kubernetes with auto-scaling |
| PostgreSQL | Single + replica | Managed cluster, read replicas |
| Redis | Single instance | Redis Cluster (3+ nodes) |
| Vector DB | Single instance | Cluster mode (3+ nodes) |
| Monitoring | Self-hosted Prometheus + Grafana | Managed monitoring (Datadog/Grafana Cloud) |
| Regions | 1 EU region | 1 EU region + DR region |
| Cost | 2-5K EUR/month | 15-30K EUR/month |
| Team | 1 engineer + architect | 2-3 engineers + SRE |

---

## Open Questions

| ID | Question | Impact | Decision Date |
|----|----------|--------|---------------|
| OQ-601 | Cloud provider: Hetzner (cheap, EU, less managed) vs AWS (expensive, more managed services) vs GCP? | High -- cost, operations | March 2026 |
| OQ-602 | Kubernetes vs Docker Compose for Phase 0? K8s is more complex but better path to Phase 1. Docker Compose is simpler but requires migration later. | Medium -- complexity | March 2026 |
| OQ-603 | Container runtime: Docker engine vs containerd vs Firecracker microVMs? | Medium -- isolation quality | March 2026 |
| OQ-604 | Should we use managed PostgreSQL (higher cost, less ops) or self-managed (lower cost, more ops)? | Medium -- cost/operations | March 2026 |
| OQ-605 | How do we handle zero-downtime deployments when container pool needs updating? Drain and replace vs in-place update? | Medium -- availability | March 2026 |
| OQ-606 | What is the backup encryption strategy? Same KMS keys as application data, or separate backup encryption keys? | Medium -- security | March 2026 |
