-- NotificationHub – Initial Migration
-- Generated for: SQLite + MySQL/MariaDB compatible
-- Provider: sqlite (default) | mysql

-- Users
CREATE TABLE "users" (
    "id"           TEXT NOT NULL PRIMARY KEY,
    "email"        TEXT NOT NULL,
    "name"         TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role"         TEXT NOT NULL DEFAULT 'VIEWER',
    "isActive"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- API Tokens
CREATE TABLE "api_tokens" (
    "id"          TEXT NOT NULL PRIMARY KEY,
    "name"        TEXT NOT NULL,
    "tokenHash"   TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "userId"      TEXT NOT NULL,
    "lastUsedAt"  DATETIME,
    "expiresAt"   DATETIME,
    "createdAt"   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "api_tokens_tokenHash_key" ON "api_tokens"("tokenHash");

-- Notifications
CREATE TABLE "notifications" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "source"           TEXT NOT NULL,
    "service"          TEXT,
    "title"            TEXT NOT NULL,
    "message"          TEXT NOT NULL,
    "priority"         TEXT NOT NULL DEFAULT 'INFO',
    "tags"             TEXT NOT NULL DEFAULT '[]',
    "hostname"         TEXT,
    "externalId"       TEXT,
    "timestamp"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receivedAt"       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt"   DATETIME,
    "acknowledgedById" TEXT,
    "duplicateOf"      TEXT,
    "duplicateCount"   INTEGER NOT NULL DEFAULT 1,
    "incidentId"       TEXT,
    "extra"            TEXT NOT NULL DEFAULT '{}',
    CONSTRAINT "notifications_acknowledgedById_fkey" FOREIGN KEY ("acknowledgedById") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "notifications_source_idx"   ON "notifications"("source");
CREATE INDEX "notifications_priority_idx" ON "notifications"("priority");
CREATE INDEX "notifications_timestamp_idx" ON "notifications"("timestamp");

-- Providers
CREATE TABLE "providers" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "type"      TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "config"    TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Rules
CREATE TABLE "rules" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "name"           TEXT NOT NULL,
    "description"    TEXT,
    "isEnabled"      BOOLEAN NOT NULL DEFAULT true,
    "priority"       INTEGER NOT NULL DEFAULT 100,
    "stopProcessing" BOOLEAN NOT NULL DEFAULT false,
    "conditions"     TEXT NOT NULL DEFAULT '[]',
    "conditionLogic" TEXT NOT NULL DEFAULT 'AND',
    "createdAt"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      DATETIME NOT NULL
);

-- Rule Actions
CREATE TABLE "rule_actions" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "ruleId"     TEXT NOT NULL,
    "type"       TEXT NOT NULL,
    "config"     TEXT NOT NULL DEFAULT '{}',
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "providerId" TEXT,
    CONSTRAINT "rule_actions_ruleId_fkey"     FOREIGN KEY ("ruleId")     REFERENCES "rules"     ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rule_actions_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Routing Results
CREATE TABLE "routing_results" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "ruleId"         TEXT,
    "providerId"     TEXT NOT NULL,
    "status"         TEXT NOT NULL,
    "error"          TEXT,
    "sentAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "routing_results_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "notifications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "routing_results_ruleId_fkey"         FOREIGN KEY ("ruleId")         REFERENCES "rules"         ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "routing_results_providerId_fkey"     FOREIGN KEY ("providerId")     REFERENCES "providers"     ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Escalation Policies
CREATE TABLE "escalation_policies" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- Escalation Steps
CREATE TABLE "escalation_steps" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "policyId"   TEXT NOT NULL,
    "stepNumber" INTEGER NOT NULL,
    "delayMins"  INTEGER NOT NULL DEFAULT 10,
    "providerId" TEXT NOT NULL,
    "message"    TEXT,
    CONSTRAINT "escalation_steps_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "escalation_policies" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Active Escalations
CREATE TABLE "active_escalations" (
    "id"               TEXT NOT NULL PRIMARY KEY,
    "notificationId"   TEXT NOT NULL,
    "policyId"         TEXT NOT NULL,
    "currentStep"      INTEGER NOT NULL DEFAULT 0,
    "nextEscalationAt" DATETIME NOT NULL,
    "resolvedAt"       DATETIME,
    "createdAt"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "active_escalations_notificationId_key" ON "active_escalations"("notificationId");

-- Incidents
CREATE TABLE "incidents" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "title"      TEXT NOT NULL,
    "status"     TEXT NOT NULL DEFAULT 'OPEN',
    "priority"   TEXT NOT NULL DEFAULT 'ERROR',
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  DATETIME NOT NULL,
    "resolvedAt" DATETIME
);

-- Notifications <-> Incidents FK
ALTER TABLE "notifications" ADD COLUMN "incidentId_fk" TEXT REFERENCES "incidents"("id") ON DELETE SET NULL;

-- Templates
CREATE TABLE "templates" (
    "id"        TEXT NOT NULL PRIMARY KEY,
    "name"      TEXT NOT NULL,
    "subject"   TEXT,
    "body"      TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "templates_name_key" ON "templates"("name");

-- Settings
CREATE TABLE "settings" (
    "key"       TEXT NOT NULL PRIMARY KEY,
    "value"     TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- Audit Log
CREATE TABLE "audit_logs" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "userId"     TEXT,
    "action"     TEXT NOT NULL,
    "resource"   TEXT NOT NULL,
    "resourceId" TEXT,
    "details"    TEXT NOT NULL DEFAULT '{}',
    "ip"         TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "audit_logs_userId_idx"    ON "audit_logs"("userId");
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs"("resource");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");
