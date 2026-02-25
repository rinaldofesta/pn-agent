# Deploying to Production

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Rinaldo Festa (Technical Architecture)

---

## Context

Play New production infrastructure runs in EU cloud data centers to meet GDPR data residency requirements (PRD Section 8.5). This guide covers provisioning the infrastructure, building and deploying the application, configuring monitoring, and operating the system.

**Phase 0 scale:** 3 organizations, 150 users, ~1,000 LLM calls/day, ~EUR 2-5K/month infrastructure cost.

**References:**
- PRD Section 20 -- Technical Requirements and Infrastructure
- [ADR-001: Nanoclaw as Foundation](../decisions/001-nanoclaw-as-foundation.md)
- [ADR-002: SQLite vs PostgreSQL](../decisions/002-sqlite-vs-postgresql.md)
- [ADR-003: Container Per User vs Shared](../decisions/003-container-per-user-vs-shared.md)
- [Development Setup](./development-setup.md) -- local environment for comparison

---

## Infrastructure Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                     EU Cloud Region (e.g., eu-west-1)                │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐    │
│  │  Kubernetes Cluster                                          │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────┐       │    │
│  │  │  Host Process (Deployment, 2+ replicas)          │       │    │
│  │  │                                                  │       │    │
│  │  │  ┌──────────┐ ┌──────────┐ ┌────────────────┐  │       │    │
│  │  │  │ API      │ │ Channel  │ │ Container      │  │       │    │
│  │  │  │ Server   │ │ Manager  │ │ Orchestrator   │  │       │    │
│  │  │  │ (Express)│ │ (Slack,  │ │ (K8s Jobs)     │  │       │    │
│  │  │  │          │ │  Teams)  │ │                │  │       │    │
│  │  │  └──────────┘ └──────────┘ └────────────────┘  │       │    │
│  │  └──────────────────────────────────────────────────┘       │    │
│  │                                                              │    │
│  │  ┌──────────────────────────────────────────────────┐       │    │
│  │  │  Agent Runner Pods (Job per user invocation)     │       │    │
│  │  │                                                  │       │    │
│  │  │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │       │    │
│  │  │  │ User A   │ │ User B   │ │ User C   │  ...   │       │    │
│  │  │  │ Pod      │ │ Pod      │ │ Pod      │        │       │    │
│  │  │  │ (Claude  │ │ (Claude  │ │ (Claude  │        │       │    │
│  │  │  │  SDK +   │ │  SDK +   │ │  SDK +   │        │       │    │
│  │  │  │  MCP)    │ │  MCP)    │ │  MCP)    │        │       │    │
│  │  │  └──────────┘ └──────────┘ └──────────┘        │       │    │
│  │  └──────────────────────────────────────────────────┘       │    │
│  └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐   │
│  │ Managed           │  │ Container        │  │ Cloud KMS       │   │
│  │ PostgreSQL 16     │  │ Registry         │  │ (Secret Mgmt)   │   │
│  │ (Multi-AZ)        │  │ (ECR/GCR/ACR)    │  │                 │   │
│  └──────────────────┘  └──────────────────┘  └─────────────────┘   │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐                        │
│  │ Prometheus +      │  │ Sentry           │                        │
│  │ Grafana           │  │ (Error Tracking) │                        │
│  └──────────────────┘  └──────────────────┘                        │
└──────────────────────────────────────────────────────────────────────┘
```

---

## EU Cloud Setup

### Region Selection

Select a cloud region within the EU that meets data residency requirements:

| Cloud Provider | Recommended Region | Location | Notes |
|----------------|-------------------|----------|-------|
| **AWS** | `eu-west-1` (Ireland) or `eu-south-1` (Milan) | EU | Milan preferred for Italian partners |
| **GCP** | `europe-west1` (Belgium) or `europe-west8` (Milan) | EU | Milan preferred |
| **Azure** | `West Europe` (Netherlands) or `Italy North` (Milan) | EU | Milan preferred |

**Requirements:**
- All compute, storage, and database resources must be in the selected EU region.
- No data replication outside the EU.
- LLM API calls to Anthropic/OpenAI transit through the public internet (encrypted TLS 1.3). This is acceptable because the data sent to LLM APIs is user conversation content (which the user initiates) and is covered by the Anthropic/OpenAI data processing agreements.

### Infrastructure Provisioning Checklist

- [ ] Cloud account and billing configured
- [ ] VPC/VNet created with private subnets
- [ ] Kubernetes cluster provisioned (managed: EKS/GKE/AKS)
- [ ] Managed PostgreSQL instance provisioned (Multi-AZ)
- [ ] Container registry created
- [ ] Cloud KMS key created for secrets encryption
- [ ] TLS certificate provisioned (Let's Encrypt or ACM/GCM)
- [ ] DNS records configured (e.g., `api.playnew.ai`)
- [ ] Monitoring stack deployed (Prometheus + Grafana)
- [ ] Sentry project created for error tracking
- [ ] Backup policy configured for PostgreSQL
- [ ] Network policies restricting inter-pod communication

---

## Kubernetes Cluster

### Cluster Specification (Phase 0)

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Node count** | 2-4 nodes | 2 for host process, 2 for agent runner pods |
| **Node type** | 4 vCPU, 16 GB RAM | Enough for ~20 concurrent agent runner pods |
| **Kubernetes version** | 1.29+ | Latest stable |
| **Autoscaling** | Cluster autoscaler enabled | Scale 2-6 nodes based on pod demand |
| **Namespaces** | `pn-system` (host process), `pn-agents` (runner pods) | Isolation between host and agents |

### Namespace Setup

```bash
kubectl create namespace pn-system
kubectl create namespace pn-agents

# Label namespaces for network policies
kubectl label namespace pn-system app=playnew role=system
kubectl label namespace pn-agents app=playnew role=agents
```

---

## Docker Image Build

### Host Process Image

The host process runs the API server, channel manager, and container orchestrator:

```dockerfile
# Dockerfile.host
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
COPY skills/ ./skills/
COPY src/db/migrations/ ./migrations/

# Non-root user
RUN addgroup -g 1001 playnew && adduser -u 1001 -G playnew -s /bin/sh -D playnew
USER playnew

EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### Agent Runner Image

The agent runner runs inside each user's pod. It includes Claude SDK, MCP servers, and skill executor:

```dockerfile
# Dockerfile.agent-runner
FROM node:20-alpine AS builder

WORKDIR /app
COPY container/agent-runner/package*.json ./
RUN npm ci --production=false
COPY container/agent-runner/tsconfig.json ./
COPY container/agent-runner/src/ ./src/
RUN npm run build

FROM node:20-alpine

WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY container/agent-runner/package*.json ./

# MCP servers
COPY mcp-servers/ ./mcp-servers/

# Non-root user
RUN addgroup -g 1001 playnew && adduser -u 1001 -G playnew -s /bin/sh -D playnew
USER playnew

CMD ["node", "dist/index.js"]
```

### Build and Push

```bash
# Build images
docker build -f Dockerfile.host -t pn-host:latest .
docker build -f Dockerfile.agent-runner -t pn-agent-runner:latest .

# Tag for registry
docker tag pn-host:latest ${REGISTRY}/pn-host:${VERSION}
docker tag pn-agent-runner:latest ${REGISTRY}/pn-agent-runner:${VERSION}

# Push to container registry
docker push ${REGISTRY}/pn-host:${VERSION}
docker push ${REGISTRY}/pn-agent-runner:${VERSION}
```

---

## Kubernetes Manifests

### Host Process Deployment

```yaml
# k8s/host-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: pn-host
  namespace: pn-system
  labels:
    app: playnew
    component: host
spec:
  replicas: 2
  selector:
    matchLabels:
      app: playnew
      component: host
  template:
    metadata:
      labels:
        app: playnew
        component: host
    spec:
      serviceAccountName: pn-host
      containers:
        - name: host
          image: ${REGISTRY}/pn-host:${VERSION}
          ports:
            - containerPort: 3000
              name: http
          envFrom:
            - configMapRef:
                name: pn-config
            - secretRef:
                name: pn-secrets
          resources:
            requests:
              cpu: "500m"
              memory: "1Gi"
            limits:
              cpu: "2"
              memory: "4Gi"
          livenessProbe:
            httpGet:
              path: /api/v1/health
              port: 3000
            initialDelaySeconds: 15
            periodSeconds: 30
            timeoutSeconds: 5
          readinessProbe:
            httpGet:
              path: /api/v1/health/ready
              port: 3000
            initialDelaySeconds: 10
            periodSeconds: 10
            timeoutSeconds: 3
```

### Agent Runner Job Template

Agent runner pods are created as Kubernetes Jobs (ephemeral, per-invocation):

```yaml
# k8s/agent-runner-job-template.yaml
# This template is instantiated programmatically by the container orchestrator
apiVersion: batch/v1
kind: Job
metadata:
  name: pn-agent-${USER_INSTANCE_ID}-${INVOCATION_ID}
  namespace: pn-agents
  labels:
    app: playnew
    component: agent-runner
    org-id: ${ORG_ID}
    user-instance-id: ${USER_INSTANCE_ID}
spec:
  ttlSecondsAfterFinished: 60     # Clean up completed jobs after 60s
  activeDeadlineSeconds: 120       # Kill job if it runs longer than 2 minutes
  backoffLimit: 0                  # No retries -- fail fast
  template:
    spec:
      restartPolicy: Never
      serviceAccountName: pn-agent-runner
      containers:
        - name: agent-runner
          image: ${REGISTRY}/pn-agent-runner:${VERSION}
          envFrom:
            - configMapRef:
                name: pn-agent-config-${ORG_ID}
            - secretRef:
                name: pn-agent-secrets-${ORG_ID}
          env:
            - name: USER_INSTANCE_ID
              value: "${USER_INSTANCE_ID}"
            - name: ORG_ID
              value: "${ORG_ID}"
            - name: INVOCATION_ID
              value: "${INVOCATION_ID}"
            - name: MESSAGE_PAYLOAD
              value: "${BASE64_ENCODED_MESSAGE}"
          resources:
            requests:
              cpu: "250m"
              memory: "256Mi"
            limits:
              cpu: "500m"
              memory: "512Mi"
          volumeMounts:
            - name: org-context
              mountPath: /data/org-context
              readOnly: true
            - name: user-skills
              mountPath: /data/skills
              readOnly: true
      volumes:
        - name: org-context
          configMap:
            name: pn-org-context-${ORG_ID}
        - name: user-skills
          configMap:
            name: pn-skills
```

### Service and Ingress

```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: pn-host
  namespace: pn-system
spec:
  selector:
    app: playnew
    component: host
  ports:
    - port: 80
      targetPort: 3000
      protocol: TCP
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: pn-ingress
  namespace: pn-system
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/proxy-body-size: "10m"
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.playnew.ai
      secretName: pn-tls
  rules:
    - host: api.playnew.ai
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: pn-host
                port:
                  number: 80
```

### ConfigMaps

```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: pn-config
  namespace: pn-system
data:
  NODE_ENV: "production"
  DATABASE_TYPE: "postgresql"
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
  PORT: "3000"
  CONTAINER_IMAGE: "${REGISTRY}/pn-agent-runner:${VERSION}"
  CONTAINER_MEMORY_LIMIT: "512m"
  CONTAINER_CPU_LIMIT: "0.5"
```

### Secrets

```yaml
# k8s/secrets.yaml (apply with kubectl, do not commit to repo)
apiVersion: v1
kind: Secret
metadata:
  name: pn-secrets
  namespace: pn-system
type: Opaque
stringData:
  DATABASE_URL: "postgresql://pn_app:${DB_PASSWORD}@${DB_HOST}:5432/pn_agent?sslmode=require"
  ANTHROPIC_API_KEY: "${ANTHROPIC_API_KEY}"
  OPENAI_API_KEY: "${OPENAI_API_KEY}"
  JWT_SECRET: "${JWT_SECRET}"
  ENCRYPTION_KEY_REF: "kms://pn/master-key"
```

In production, use a secrets manager (AWS Secrets Manager, GCP Secret Manager, Azure Key Vault) with the Kubernetes External Secrets Operator to inject secrets:

```yaml
# k8s/external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: pn-secrets
  namespace: pn-system
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: cloud-secret-store
    kind: ClusterSecretStore
  target:
    name: pn-secrets
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: pn/production/database-url
    - secretKey: ANTHROPIC_API_KEY
      remoteRef:
        key: pn/production/anthropic-api-key
    - secretKey: OPENAI_API_KEY
      remoteRef:
        key: pn/production/openai-api-key
    - secretKey: JWT_SECRET
      remoteRef:
        key: pn/production/jwt-secret
```

---

## Database Setup

### Managed PostgreSQL

Provision a managed PostgreSQL 16 instance:

| Parameter | Value | Notes |
|-----------|-------|-------|
| **Engine** | PostgreSQL 16 | Latest stable |
| **Instance class** | 2 vCPU, 8 GB RAM | Sufficient for Phase 0 |
| **Storage** | 100 GB SSD, auto-scaling | Grows with data volume |
| **Multi-AZ** | Yes | High availability |
| **Encryption** | TDE enabled (AES-256) | Encryption at rest |
| **SSL** | Require SSL for all connections | Encryption in transit |
| **Automated backups** | Daily, 30-day retention | Point-in-time recovery |
| **Maintenance window** | Saturday 02:00-04:00 CET | Minimal impact |

### Database Initialization

```bash
# Connect to the database
psql $DATABASE_URL

# Create application roles
CREATE ROLE pn_app LOGIN PASSWORD '${APP_PASSWORD}';
CREATE ROLE pn_advisor LOGIN PASSWORD '${ADVISOR_PASSWORD}';
CREATE ROLE pn_admin LOGIN PASSWORD '${ADMIN_PASSWORD}';

# Grant base permissions
GRANT CONNECT ON DATABASE pn_agent TO pn_app, pn_advisor, pn_admin;
GRANT USAGE ON SCHEMA public TO pn_app, pn_advisor, pn_admin;

# Create platform tables
\i migrations/001_nanoclaw_base.sql
\i migrations/002_play_new_extensions.sql
-- ... all migration files

# Seed taxonomy data
npm run db:seed -- --env=production
```

### Per-Organization Schema

When onboarding a new organization (see [Onboarding a Design Partner](./onboarding-a-design-partner.md)):

```bash
npm run org:create -- \
  --name="Organization Name" \
  --industry=professional_services \
  --size-band=200-500 \
  --geo=EU_south \
  --env=production
```

This runs the schema creation and migration scripts for the org.

---

## Health Checks

### Liveness Probe

```typescript
// GET /api/v1/health
// Returns 200 if the process is running.
// Returns 500 if the process is in a bad state (should be restarted).

app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});
```

### Readiness Probe

```typescript
// GET /api/v1/health/ready
// Returns 200 if the process is ready to accept traffic.
// Returns 503 if dependencies are not connected.

app.get('/api/v1/health/ready', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    channels: checkChannels(),
  };

  const allHealthy = Object.values(checks).every(c => c.healthy);

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ready' : 'not_ready',
    checks,
  });
});
```

---

## Monitoring Setup

### Prometheus Metrics

Export application metrics for Prometheus scraping:

```typescript
// Key metrics to export
const metrics = {
  // Request metrics
  http_request_duration_seconds: new Histogram({ ... }),
  http_requests_total: new Counter({ ... }),

  // Agent runner metrics
  agent_runner_spawn_duration_seconds: new Histogram({ ... }),
  agent_runner_spawn_total: new Counter({ labels: ['org_id', 'status'] }),
  agent_runner_active: new Gauge({ ... }),

  // LLM metrics
  llm_request_duration_seconds: new Histogram({ labels: ['provider', 'model', 'task_type'] }),
  llm_requests_total: new Counter({ labels: ['provider', 'model', 'status'] }),
  llm_tokens_total: new Counter({ labels: ['provider', 'model', 'direction'] }),

  // Channel metrics
  channel_messages_total: new Counter({ labels: ['org_id', 'channel', 'direction'] }),
  channel_connection_status: new Gauge({ labels: ['org_id', 'channel'] }),

  // Database metrics
  db_query_duration_seconds: new Histogram({ labels: ['operation'] }),
  db_connections_active: new Gauge({ ... }),
};
```

### Grafana Dashboards

Create dashboards for:

| Dashboard | Panels |
|-----------|--------|
| **System Overview** | Request rate, error rate, P95 latency, active users, active agent pods |
| **Agent Runner** | Spawn rate, spawn duration, success/failure ratio, concurrent pods |
| **LLM Usage** | Calls per provider, tokens per provider, latency per model, cost estimation |
| **Channel Health** | Messages per channel, connection status, error rate per channel |
| **Per-Organization** | Active users, interaction volume, skill activation, pattern collection rate |

### Sentry Error Tracking

Configure Sentry for error tracking and alerting:

```typescript
import * as Sentry from '@sentry/node';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  release: process.env.APP_VERSION,
  tracesSampleRate: 0.1,         // 10% of transactions
  beforeSend(event) {
    // Scrub PII from error reports
    if (event.request?.data) {
      event.request.data = '[REDACTED]';
    }
    return event;
  },
});
```

### Alerting Rules

| Alert | Condition | Severity | Action |
|-------|-----------|----------|--------|
| High error rate | >5% of requests return 5xx for 5 minutes | Critical | Page on-call |
| Slow responses | P95 latency >25s for 10 minutes | Warning | Investigate |
| Channel disconnected | Any channel disconnected >5 minutes | Critical | Page on-call |
| Database connection failure | Connection pool exhausted | Critical | Page on-call |
| LLM provider errors | >10% of LLM calls fail for 5 minutes | Warning | Check provider status |
| Agent runner failures | >5% of agent spawns fail for 5 minutes | Warning | Check K8s node health |
| Disk usage | >80% on any persistent volume | Warning | Expand storage |

---

## Operational Runbooks

### Scaling Containers

**When:** Agent runner pod queue is growing (spawn latency >5s).

```bash
# Check current node capacity
kubectl top nodes

# Check pending pods
kubectl get pods -n pn-agents --field-selector=status.phase=Pending

# If nodes are full, manually scale the cluster (or let autoscaler handle it):
# AWS EKS:
eksctl scale nodegroup --cluster=pn-cluster --name=agent-nodes --nodes=4

# GCP GKE:
gcloud container clusters resize pn-cluster --node-pool=agent-pool --num-nodes=4
```

### Database Backup and Restore

**Automated backups:** Managed PostgreSQL performs daily automated backups with 30-day retention.

**Manual backup:**
```bash
# Create a manual snapshot
# AWS RDS:
aws rds create-db-snapshot --db-instance-identifier pn-agent-db --db-snapshot-identifier pn-manual-$(date +%Y%m%d)

# GCP Cloud SQL:
gcloud sql backups create --instance=pn-agent-db --description="Manual backup $(date +%Y%m%d)"
```

**Restore from backup:**
```bash
# Restore to a new instance (do not restore in-place)
# AWS RDS:
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier pn-agent-db-restored \
  --db-snapshot-identifier pn-manual-20260501

# After verification, switch the application to the restored instance:
kubectl edit secret pn-secrets -n pn-system
# Update DATABASE_URL to point to restored instance
kubectl rollout restart deployment/pn-host -n pn-system
```

### Incident Response

1. **Detect:** Alert fires (Grafana/Sentry) or user reports issue.
2. **Assess severity:**
   - P1 (Critical): All users affected, assistant non-functional.
   - P2 (High): One org affected, or degraded performance for all.
   - P3 (Medium): Intermittent errors, individual users affected.
3. **Communicate:** Notify affected org contacts via email (not via the assistant).
4. **Investigate:** Check logs, metrics, and traces.
5. **Mitigate:** Apply fix or workaround.
6. **Resolve:** Verify fix, notify affected parties.
7. **Post-mortem:** Document what happened, root cause, and prevention measures.

### LLM Provider Failover

**When:** Anthropic API returns errors or high latency for >5 minutes.

**Automatic:** Background tasks (pattern classification, skill scoring) automatically fail over to GPT-4o via `LlmClientWithFallback` (see [ADR-006](../decisions/006-llm-provider-strategy.md)).

**Manual (interactive sessions):**

```bash
# Check Anthropic API status
curl -s https://status.anthropic.com/api/v2/summary.json | jq '.status'

# If confirmed outage, enable degraded mode:
kubectl set env deployment/pn-host -n pn-system INTERACTIVE_FALLBACK=openai

# Monitor fallback quality:
# Check Sentry for increased error rates
# Check Grafana for response quality metrics

# When Anthropic recovers, disable fallback:
kubectl set env deployment/pn-host -n pn-system INTERACTIVE_FALLBACK-
```

### Adding a New Organization

```bash
# 1. Create the organization
npm run org:create -- \
  --name="New Org" \
  --industry=tech \
  --size-band=200-500 \
  --geo=EU_south \
  --env=production

# 2. Create org-specific Kubernetes resources
kubectl create configmap pn-agent-config-${ORG_ID} \
  --from-literal=ORG_ID=${ORG_ID} \
  -n pn-agents

kubectl create secret generic pn-agent-secrets-${ORG_ID} \
  --from-literal=ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY} \
  -n pn-agents

# 3. Configure channel (see Onboarding guide, Week 1-2)
npm run channel:configure -- --org=${ORG_ID} --type=slack ...

# 4. Import strategic context
npm run context:import -- --org=${ORG_ID} --file=context.md

# 5. Import users
npm run users:import -- --org=${ORG_ID} --file=users.csv --channel=slack

# 6. Verify
npm run org:verify -- --org=${ORG_ID}
```

### Rotating Secrets

```bash
# 1. Generate new credentials
NEW_API_KEY=$(anthropic api-keys create --name="pn-production-$(date +%Y%m%d)")

# 2. Update in secrets manager
aws secretsmanager update-secret \
  --secret-id pn/production/anthropic-api-key \
  --secret-string "${NEW_API_KEY}"

# 3. External Secrets Operator syncs automatically (within refreshInterval)
# Or force a sync:
kubectl annotate externalsecret pn-secrets -n pn-system force-sync=$(date +%s)

# 4. Restart deployments to pick up new secrets
kubectl rollout restart deployment/pn-host -n pn-system

# 5. Verify the new key is working
kubectl logs -l component=host -n pn-system --tail=50 | grep "Anthropic"

# 6. Revoke the old key (after confirming the new one works)
```

---

## SSL/TLS Certificate Management

### Automated Certificate Management (cert-manager)

```yaml
# k8s/cluster-issuer.yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: ops@playnew.ai
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
      - http01:
          ingress:
            class: nginx
```

Certificates are automatically provisioned and renewed by cert-manager. The Ingress annotation `cert-manager.io/cluster-issuer: letsencrypt-prod` triggers automatic certificate creation.

### Manual Certificate Renewal (If Not Using cert-manager)

```bash
# Check certificate expiry
echo | openssl s_client -connect api.playnew.ai:443 2>/dev/null | openssl x509 -noout -dates

# Renew with certbot
certbot renew --cert-name api.playnew.ai

# Update Kubernetes secret
kubectl create secret tls pn-tls \
  --cert=/etc/letsencrypt/live/api.playnew.ai/fullchain.pem \
  --key=/etc/letsencrypt/live/api.playnew.ai/privkey.pem \
  -n pn-system --dry-run=client -o yaml | kubectl apply -f -
```

---

## Phase 0 vs Phase 1 Deployment Differences

| Aspect | Phase 0 | Phase 1 |
|--------|---------|---------|
| **Scale** | 150 users, 3 orgs | 2,000 users, 10 orgs |
| **Kubernetes nodes** | 2-4 | 8-16 with autoscaling |
| **PostgreSQL** | Single instance, 2 vCPU | Multi-AZ, 4+ vCPU, read replicas |
| **Agent runner** | K8s Jobs (ephemeral) | Evaluate persistent pods with idle timeout (see [ADR-003](../decisions/003-container-per-user-vs-shared.md)) |
| **Channel connections** | Slack Socket Mode | Slack Events API (webhook) + Teams Bot Framework webhook |
| **CI/CD** | Manual deployment (`kubectl apply`) | GitHub Actions pipeline with staging environment |
| **Monitoring** | Basic Grafana dashboards | Full observability (traces, logs, metrics correlation) |
| **Alerting** | Email alerts | PagerDuty integration, on-call rotation |
| **Secret management** | Kubernetes Secrets (manually applied) | External Secrets Operator with cloud secret manager |
| **Database migrations** | Manual (`npm run db:migrate`) | Automated in deployment pipeline with rollback |
| **Load testing** | Manual verification | Automated load tests before production deployment |
| **Disaster recovery** | Daily backups, manual restore | Automated failover, RTO <1 hour, RPO <1 hour |

---

## Deployment Checklist

Before deploying to production for a new version:

- [ ] All tests pass (`npm test`)
- [ ] Build succeeds (`npm run build`)
- [ ] Docker images build successfully
- [ ] Images pushed to container registry
- [ ] Database migrations reviewed (if any)
- [ ] Database migrations tested on staging
- [ ] Kubernetes manifests reviewed
- [ ] Secrets verified in secrets manager
- [ ] Health check endpoints responding on staging
- [ ] Channel connections verified on staging
- [ ] LLM API keys validated
- [ ] Monitoring dashboards accessible
- [ ] Alerting rules configured
- [ ] Rollback plan documented

### Deployment Steps

```bash
# 1. Build and push images
docker build -f Dockerfile.host -t ${REGISTRY}/pn-host:${VERSION} .
docker build -f Dockerfile.agent-runner -t ${REGISTRY}/pn-agent-runner:${VERSION} .
docker push ${REGISTRY}/pn-host:${VERSION}
docker push ${REGISTRY}/pn-agent-runner:${VERSION}

# 2. Run database migrations (if any)
npm run db:migrate -- --env=production

# 3. Update Kubernetes manifests with new image version
kubectl set image deployment/pn-host host=${REGISTRY}/pn-host:${VERSION} -n pn-system

# 4. Wait for rollout
kubectl rollout status deployment/pn-host -n pn-system --timeout=300s

# 5. Verify health
curl https://api.playnew.ai/api/v1/health/ready

# 6. Update agent runner image reference in config
kubectl edit configmap pn-config -n pn-system
# Update CONTAINER_IMAGE to new version

# 7. Smoke test: send a test message through each channel
npm run smoke-test -- --env=production
```

### Rollback

```bash
# If the deployment fails:
kubectl rollout undo deployment/pn-host -n pn-system

# If database migrations need rollback:
npm run db:migrate -- --env=production --direction=down --version=${PREVIOUS_VERSION}
```
