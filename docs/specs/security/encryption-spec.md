# Encryption Specification

**Version:** 0.1.0
**Last Updated:** 2026-02-25
**Status:** Draft -- Pre-Phase 0 Architecture
**Owner:** Rinaldo Festa

---

## Context

Play New's privacy architecture requires that personal data (Tier 1) is encrypted with user-scoped keys, and organizational data (Tier 2, 3) is encrypted with org-scoped keys. A breach of the database alone must not expose readable data. Even Play New engineers with infrastructure access must not be able to read customer data.

This specification defines the encryption algorithms, key hierarchy, key management procedures, and rotation policies.

Related documents:
- [Data Classification](../data/data-classification.md) -- what data lives in which tier
- [Security Model](./security-model.md) -- threat model and controls
- [Database Schema](../data/database-schema.md) -- storage locations

---

## Encryption At Rest

### By Data Tier

| Data Tier | Encryption | Key Scope | Algorithm | Storage |
|-----------|-----------|-----------|-----------|---------|
| **Tier 1: Personal** | Application-level encryption | User-scoped key | AES-256-GCM | `messages.content` (encrypted), vector DB embeddings (encrypted namespace) |
| **Tier 2: Org Context** | Application-level encryption | Org-scoped key | AES-256-GCM | `org_context_docs.content` (encrypted) |
| **Tier 3: Anonymized Patterns** | Database-level encryption | Org-scoped key | PostgreSQL TDE (or application-level) | `pattern_logs`, `insights` |
| **Tier 4: Cross-Org** | Database-level encryption | Platform key | PostgreSQL TDE | Materialized benchmark views |
| **Credentials** | Cloud KMS envelope encryption | Per-credential | AES-256-GCM (KMS-wrapped) | Secrets manager |

### Application-Level Encryption

Tier 1 and Tier 2 data receive application-level encryption before writing to the database. This means the database stores ciphertext -- even a database dump is useless without the keys.

**Encrypted fields:**
- `messages.content` -- chat message text (Tier 1)
- `messages.metadata` -- tool call details, attachments (Tier 1)
- `org_context_docs.content` -- strategy docs, competitive intel (Tier 2)
- Vector DB embeddings -- personal memory entries (Tier 1)

**NOT encrypted at application level (metadata only, needed for queries):**
- `messages.role`, `messages.created_at`, `messages.chat_id` -- needed for message ordering
- `pattern_logs.*` -- already anonymized categorical data; encrypted at DB level
- `user_instances.settings` -- preferences, not sensitive content
- All foreign keys, timestamps, and status fields

### Encryption Implementation

```typescript
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;       // 96-bit IV for GCM
const TAG_LENGTH = 16;      // 128-bit auth tag

interface EncryptedPayload {
    iv: string;              // Base64-encoded IV
    ciphertext: string;      // Base64-encoded ciphertext
    tag: string;             // Base64-encoded authentication tag
    keyVersion: number;      // Key version (for rotation support)
}

function encrypt(plaintext: string, key: Buffer, keyVersion: number): EncryptedPayload {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, key, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
    ciphertext += cipher.final('base64');

    return {
        iv: iv.toString('base64'),
        ciphertext,
        tag: cipher.getAuthTag().toString('base64'),
        keyVersion,
    };
}

function decrypt(payload: EncryptedPayload, key: Buffer): string {
    const decipher = createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));

    let plaintext = decipher.update(payload.ciphertext, 'base64', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
}
```

**Storage format:** Encrypted fields are stored as JSON strings in the database:

```json
{
    "iv": "dGhpcyBpcyBhIHRlc3Q=",
    "ciphertext": "ZW5jcnlwdGVkIGNvbnRlbnQ=",
    "tag": "YXV0aGVudGljYXRpb24gdGFn",
    "keyVersion": 1
}
```

---

## Encryption In Transit

### External Traffic

| Path | Protocol | Minimum Version | Certificate |
|------|----------|----------------|-------------|
| User browser -> Play New API | TLS | 1.3 | Let's Encrypt or commercial CA |
| Slack API -> Play New webhook | TLS | 1.2 (Slack's minimum) | Slack-signed requests verified |
| Play New -> LLM providers | TLS | 1.3 | Provider CA |
| Play New -> External APIs (MCP) | TLS | 1.2 | Provider CA |

### Internal Traffic

| Path | Protocol | Certificate |
|------|----------|-------------|
| API gateway -> Application servers | mTLS | Internal CA (auto-provisioned) |
| Application -> Database | TLS | Internal CA, client certificate auth |
| Application -> Secrets manager | TLS + IAM | Cloud provider managed |
| Container -> Container (if any) | None (blocked) | N/A -- containers do not communicate directly |

### TLS Configuration

```yaml
# Nginx/load balancer TLS configuration
ssl_protocols TLSv1.3;
ssl_ciphers 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256:TLS_AES_128_GCM_SHA256';
ssl_prefer_server_ciphers on;
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:10m;
ssl_stapling on;
ssl_stapling_verify on;
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
```

---

## Key Hierarchy

```
                    ┌─────────────────────────┐
                    │    Cloud KMS Root Key    │
                    │  (AWS KMS / GCP KMS)     │
                    │  Never leaves KMS HSM    │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │   Platform Master Key    │
                    │  (Envelope-encrypted     │
                    │   by Root Key)           │
                    └────────┬───────┬────────┘
                             │       │
              ┌──────────────▼─┐   ┌─▼──────────────┐
              │  Org Master Key │   │  Org Master Key │  ... (one per org)
              │  (org_abc)      │   │  (org_xyz)      │
              │  Encrypted by   │   │  Encrypted by   │
              │  Platform Key   │   │  Platform Key   │
              └──┬──────────┬──┘   └─────────────────┘
                 │          │
    ┌────────────▼──┐  ┌───▼─────────────┐
    │  User Key     │  │  User Key       │  ... (one per user instance)
    │  (user_001)   │  │  (user_002)     │
    │  Derived via  │  │  Derived via    │
    │  HKDF from    │  │  HKDF from     │
    │  Org Key +    │  │  Org Key +     │
    │  User Salt    │  │  User Salt     │
    └───────────────┘  └─────────────────┘
```

### Key Types

| Key | Purpose | Algorithm | Storage | Rotation |
|-----|---------|-----------|---------|----------|
| **Root Key** | Top of hierarchy. Encrypts platform master key. | KMS-managed (AES-256) | Cloud KMS HSM. Never exported. | Annual (KMS automatic) |
| **Platform Master Key** | Encrypts org master keys. Used for Tier 4 data. | AES-256 | Encrypted by Root Key. Stored in KMS. | Annual |
| **Org Master Key** | Encrypts Tier 2, Tier 3 data for the organization. | AES-256 | Encrypted by Platform Key. Stored in secrets manager. | Every 6 months |
| **User Key** | Encrypts Tier 1 data for a specific user. | AES-256 | Derived (not stored). Derivation parameters in secrets manager. | On demand or every 12 months |

---

## Key Derivation

User keys are derived from the org master key using HKDF (HMAC-based Key Derivation Function):

```typescript
import { hkdf } from 'crypto';

interface UserKeyParams {
    orgMasterKey: Buffer;     // 256-bit org master key
    userSalt: Buffer;         // 256-bit random salt (unique per user, stored in secrets manager)
    userInstanceId: string;   // Used as HKDF info parameter
}

async function deriveUserKey(params: UserKeyParams): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        hkdf(
            'sha256',
            params.orgMasterKey,
            params.userSalt,
            `play-new-user-key:${params.userInstanceId}`,  // info string
            32,  // 256 bits
            (err, derivedKey) => {
                if (err) reject(err);
                else resolve(Buffer.from(derivedKey));
            },
        );
    });
}
```

**Why derivation instead of storing each user key:**
- Fewer secrets to manage (only org key + user salts)
- User key can be re-derived at any time from org key + salt
- Org admin recovery is possible (see Key Escrow section)
- If a user key is compromised, only the salt needs to be rotated

**User salt storage:**

```
secrets/
  org/{org_id}/
    master_key             # AES-256, encrypted by platform key
    user_salts/
      {instance_id}        # 256-bit random salt per user
```

---

## Key Management

### Cloud KMS Integration

Play New uses the cloud provider's KMS for root key management:

**AWS KMS:**

```typescript
import { KMSClient, EncryptCommand, DecryptCommand } from '@aws-sdk/client-kms';

const kms = new KMSClient({ region: 'eu-central-1' });

// Encrypt org master key with root key
async function encryptOrgKey(orgKey: Buffer): Promise<Buffer> {
    const result = await kms.send(new EncryptCommand({
        KeyId: 'alias/play-new-root-key',
        Plaintext: orgKey,
        EncryptionContext: {
            purpose: 'org-master-key',
        },
    }));
    return Buffer.from(result.CiphertextBlob!);
}

// Decrypt org master key
async function decryptOrgKey(encryptedOrgKey: Buffer): Promise<Buffer> {
    const result = await kms.send(new DecryptCommand({
        CiphertextBlob: encryptedOrgKey,
        EncryptionContext: {
            purpose: 'org-master-key',
        },
    }));
    return Buffer.from(result.Plaintext!);
}
```

**GCP Cloud KMS:** Equivalent using `@google-cloud/kms` client library.

### Key Lifecycle

#### Organization Onboarding

```
1. Generate random 256-bit org master key
2. Encrypt org master key with platform master key (via KMS)
3. Store encrypted org master key in secrets manager at org/{org_id}/master_key
4. Record key metadata (creation date, version) in organizations.encryption_key_ref
```

#### User Instance Creation

```
1. Generate random 256-bit user salt
2. Store salt in secrets manager at org/{org_id}/user_salts/{instance_id}
3. User key is derived on demand (not stored): HKDF(org_key, user_salt, instance_id)
4. Record salt reference in user_instances.encryption_key_ref
```

#### Key Rotation -- Org Master Key

```
1. Generate new org master key (v2)
2. Decrypt current org master key (v1) via KMS
3. For each user in the org:
   a. Derive old user key using v1 org key + user salt
   b. Decrypt all Tier 1 data with old user key
   c. Derive new user key using v2 org key + same user salt
   d. Re-encrypt all Tier 1 data with new user key
4. Re-encrypt all Tier 2, 3 data with v2 org key
5. Encrypt v2 org key with platform key, store in secrets manager
6. Mark v1 as deprecated (retain for 30 days for rollback)
7. After 30 days, delete v1
```

**Key rotation is performed offline** (during maintenance window) to avoid impacting user experience. Estimated time: ~10 minutes per 50 users (dominated by re-encryption I/O).

#### Key Rotation -- User Key

If a specific user's key needs rotation (e.g., compromise suspected):

```
1. Generate new user salt (v2)
2. Derive old user key with current salt (v1)
3. Derive new user key with new salt (v2)
4. Re-encrypt all user's Tier 1 data: old key -> new key
5. Store new salt in secrets manager
6. Delete old salt after 30 days
```

### Key Escrow for Org Admin Recovery

**Scenario:** A user leaves the organization. The org needs to ensure no orphaned encrypted data remains.

**Policy:** When a user is deleted (GDPR erasure), ALL their Tier 1 data is hard-deleted. There is no need to decrypt it -- it is simply destroyed. The user salt is deleted from secrets manager.

**Scenario:** Org master key is lost or corrupted.

**Recovery procedure:**
1. Org master key is encrypted by the platform master key (stored in KMS).
2. Platform admin can recover the org master key by decrypting it with the platform key.
3. This is a break-glass procedure requiring two-person approval and full audit logging.

**What org admins CANNOT do:**
- Derive individual user keys (they do not have access to user salts or the KMS decrypt operation)
- Read any Tier 1 data even with the org master key (user keys require user-specific salts)

---

## Database Encryption (PostgreSQL TDE)

In addition to application-level encryption, the PostgreSQL database uses Transparent Data Encryption for defense-in-depth:

```sql
-- PostgreSQL 16+ supports TDE natively
-- Configure in postgresql.conf:
-- encryption_key_command = '/usr/local/bin/fetch-db-key.sh %k'
```

This provides an additional layer: even if application-level encryption has a bug, the database files on disk are still encrypted.

**SQLite (development):** SQLite does not natively support encryption. For development, we use `better-sqlite3` without encryption. This is acceptable because development databases contain only test data.

For staging environments that need SQLite with encryption, `SQLCipher` can be used as a drop-in replacement.

---

## Libraries and Dependencies

| Purpose | Library | Language | License |
|---------|---------|----------|---------|
| AES-256-GCM encryption | Node.js built-in `crypto` | TypeScript | N/A (built-in) |
| HKDF key derivation | Node.js built-in `crypto.hkdf` | TypeScript | N/A (built-in) |
| AWS KMS client | `@aws-sdk/client-kms` | TypeScript | Apache 2.0 |
| GCP KMS client | `@google-cloud/kms` | TypeScript | Apache 2.0 |
| Secrets manager | `@aws-sdk/client-secrets-manager` or `@google-cloud/secret-manager` | TypeScript | Apache 2.0 |

**No external cryptography libraries are used.** Node.js built-in `crypto` module provides all required cryptographic primitives (AES-256-GCM, HKDF-SHA256, secure random generation). This minimizes supply-chain attack surface.

---

## Implementation: Encryption Service

```typescript
// src/security/encryption-service.ts

interface EncryptionService {
    // Encrypt data for a specific user (Tier 1)
    encryptForUser(instanceId: string, plaintext: string): Promise<EncryptedPayload>;
    decryptForUser(instanceId: string, payload: EncryptedPayload): Promise<string>;

    // Encrypt data for an organization (Tier 2, 3)
    encryptForOrg(orgId: string, plaintext: string): Promise<EncryptedPayload>;
    decryptForOrg(orgId: string, payload: EncryptedPayload): Promise<string>;

    // Key management
    createOrgKey(orgId: string): Promise<void>;
    createUserSalt(orgId: string, instanceId: string): Promise<void>;
    rotateOrgKey(orgId: string): Promise<void>;
    rotateUserKey(orgId: string, instanceId: string): Promise<void>;
    deleteUserKey(orgId: string, instanceId: string): Promise<void>;
}
```

**Key caching:** Derived keys are cached in memory for the duration of a request (or container session). They are NEVER written to disk. Cache is a simple `Map<string, Buffer>` with TTL, cleared on process exit.

```typescript
class KeyCache {
    private cache = new Map<string, { key: Buffer; expiresAt: number }>();
    private readonly ttlMs = 5 * 60 * 1000;  // 5 minutes

    set(id: string, key: Buffer): void {
        this.cache.set(id, { key, expiresAt: Date.now() + this.ttlMs });
    }

    get(id: string): Buffer | null {
        const entry = this.cache.get(id);
        if (!entry || Date.now() > entry.expiresAt) {
            this.cache.delete(id);
            return null;
        }
        return entry.key;
    }

    clear(): void {
        // Overwrite key material before clearing
        for (const entry of this.cache.values()) {
            entry.key.fill(0);
        }
        this.cache.clear();
    }
}
```

---

## Phase 0 Scope

**Included in Phase 0:**
- AES-256-GCM application-level encryption for Tier 1 (messages.content) and Tier 2 (org_context_docs.content)
- Key hierarchy: Root Key (Cloud KMS) -> Org Master Key -> User Key (derived via HKDF)
- Secrets manager integration for key storage (AWS Secrets Manager or GCP Secret Manager)
- TLS 1.3 for all external traffic
- Encryption service implementation (`src/security/encryption-service.ts`)
- Key creation during org onboarding and user instance creation
- User key deletion on user data erasure

**Deferred to Phase 1:**
- mTLS for internal service-to-service communication
- Automated key rotation (manual rotation in Phase 0)
- PostgreSQL TDE
- Key rotation tooling (re-encryption scripts)
- HSM-backed key storage (KMS uses software-backed keys in Phase 0 for cost)

**Deferred to Phase 2+:**
- Client-side encryption (user holds their own key, not derived from org key)
- On-premise KMS integration for enterprise customers
- Hardware security module (HSM) for key operations

---

## Open Questions

- **[OQ-ENC-001]** Should we use AWS KMS or GCP Cloud KMS? Decision depends on the cloud provider chosen for infrastructure. Both have equivalent functionality. See deployment architecture docs.
- **[OQ-ENC-002]** For vector DB encryption (personal memory embeddings), should we encrypt the embeddings themselves (which may break similarity search) or rely on namespace isolation + disk encryption?
- **[OQ-ENC-003]** The key derivation model means rotating the org master key requires re-encrypting ALL user data. For large orgs (2000+ users), this could take hours. Should we consider an independent user key model instead?
- **[OQ-ENC-004]** Should the `keyVersion` in `EncryptedPayload` support concurrent key versions during rotation? This would allow gradual migration instead of big-bang re-encryption.
- **[OQ-ENC-005]** For Phase 0 with SQLite, should we skip application-level encryption entirely and focus on getting the key infrastructure right for PostgreSQL production? Or is it important to encrypt from day one even in dev?
