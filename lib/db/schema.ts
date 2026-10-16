import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const orgId = () =>
  uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" });

// ---------- Identity (system tables, no RLS) ----------

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: createdAt(),
});

export const loginTokens = pgTable(
  "login_tokens",
  {
    id: id(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("login_tokens_email_idx").on(t.email, t.createdAt)],
);

export const sessions = pgTable("sessions", {
  id: id(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  orgId: uuid("org_id").references(() => organizations.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
});

// ---------- Tenancy ----------

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  kind: text("kind", { enum: ["agency", "company"] }).notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  createdAt: createdAt(),
});

export const memberships = pgTable(
  "memberships",
  {
    orgId: orgId(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["owner", "member"] }).notNull().default("owner"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.orgId, t.userId] })],
);

// ---------- Jobs ----------

export const JOB_STATUSES = ["draft", "active", "closed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const jobs = pgTable(
  "jobs",
  {
    id: id(),
    orgId: orgId(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    location: text("location").notNull(),
    status: text("status", { enum: JOB_STATUSES }).notNull().default("draft"),
    testMode: boolean("test_mode").notNull().default(false),
    priceInr: integer("price_inr").notNull(),
    launchedAt: timestamp("launched_at", { withTimezone: true }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    retentionUntil: timestamp("retention_until", { withTimezone: true }),
    purgedAt: timestamp("purged_at", { withTimezone: true }),
    shareToken: text("share_token").unique(),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("jobs_org_idx").on(t.orgId, t.createdAt)],
);

export const questions = pgTable(
  "questions",
  {
    id: id(),
    orgId: orgId(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("questions_job_pos_idx").on(t.jobId, t.position)],
);

export const rubricItems = pgTable("rubric_items", {
  id: id(),
  orgId: orgId(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["knockout", "nice"] }).notNull(),
  text: text("text").notNull(),
  weight: integer("weight").notNull().default(1),
  createdAt: createdAt(),
});

// ---------- Candidates ----------

export const CANDIDATE_STATUSES = [
  "pending", // uploaded, not yet messaged
  "invited", // template sent, waiting for YES
  "in_progress", // answering questions
  "completed", // all answers in
  "declined", // replied NO
  "opted_out", // replied STOP
  "needs_human", // off-script twice; recruiter must step in
  "no_response", // never replied after reminder
  "deleted", // PII removed on request or retention
] as const;
export type CandidateStatus = (typeof CANDIDATE_STATUSES)[number];

export const candidates = pgTable(
  "candidates",
  {
    id: id(),
    orgId: orgId(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phoneEnc: text("phone_enc").notNull(), // AES-GCM encrypted E.164
    phoneHash: text("phone_hash").notNull(), // blind index for lookup
    language: text("language", { enum: ["en", "hi"] }).notNull().default("en"),
    status: text("status", { enum: CANDIDATE_STATUSES }).notNull().default("pending"),
    tag: text("tag", { enum: ["shortlist", "reject"] }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("candidates_job_phone_idx").on(t.jobId, t.phoneHash),
    index("candidates_phone_idx").on(t.phoneHash),
  ],
);

export const consents = pgTable("consents", {
  id: id(),
  orgId: orgId(),
  candidateId: uuid("candidate_id")
    .notNull()
    .references(() => candidates.id, { onDelete: "cascade" }),
  source: text("source", { enum: ["csv_upload"] }).notNull(),
  noticeVersion: text("notice_version").notNull(),
  grantedBy: uuid("granted_by").references(() => users.id, { onDelete: "set null" }),
  grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
});

// ---------- Conversations ----------

export const CONVERSATION_STATES = [
  "awaiting_optin",
  "asking",
  "done",
  "declined",
  "opted_out",
  "needs_human",
  "no_response",
] as const;
export type ConversationState = (typeof CONVERSATION_STATES)[number];

export const conversations = pgTable("conversations", {
  id: id(),
  orgId: orgId(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id")
    .notNull()
    .unique()
    .references(() => candidates.id, { onDelete: "cascade" }),
  state: text("state", { enum: CONVERSATION_STATES }).notNull().default("awaiting_optin"),
  currentQuestion: integer("current_question").notNull().default(0),
  repromptCount: integer("reprompt_count").notNull().default(0),
  lateReplyNotified: boolean("late_reply_notified").notNull().default(false),
  reminderSentAt: timestamp("reminder_sent_at", { withTimezone: true }),
  lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),
  lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const messages = pgTable(
  "messages",
  {
    id: id(),
    orgId: orgId(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    direction: text("direction", { enum: ["in", "out"] }).notNull(),
    kind: text("kind", { enum: ["text", "voice", "template"] }).notNull(),
    body: text("body"),
    transcript: text("transcript"),
    sentBy: text("sent_by", { enum: ["system", "recruiter", "candidate"] }).notNull(),
    // Unique per logical outbound message: guarantees no double sends.
    dedupeKey: text("dedupe_key").unique(),
    providerMessageId: text("provider_message_id"),
    status: text("status", { enum: ["queued", "sent", "failed", "received"] }).notNull(),
    error: text("error"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conv_idx").on(t.conversationId, t.createdAt), index("messages_sent_idx").on(t.sentAt)],
);

export const answers = pgTable(
  "answers",
  {
    id: id(),
    orgId: orgId(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    messageId: uuid("message_id").references(() => messages.id, { onDelete: "set null" }),
    text: text("text").notNull(),
    source: text("source", { enum: ["text", "voice"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("answers_conv_q_idx").on(t.conversationId, t.questionId)],
);

// ---------- Scoring ----------

export const scores = pgTable("scores", {
  id: id(),
  orgId: orgId(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  candidateId: uuid("candidate_id")
    .notNull()
    .unique()
    .references(() => candidates.id, { onDelete: "cascade" }),
  total: integer("total").notNull(), // 0-100, computed in code from the breakdown
  knockoutPassed: boolean("knockout_passed").notNull(),
  breakdown: jsonb("breakdown").notNull(),
  summary: text("summary").notNull(),
  reason: text("reason").notNull(),
  model: text("model").notNull(),
  editedTotal: integer("edited_total"),
  editedBy: uuid("edited_by").references(() => users.id, { onDelete: "set null" }),
  editNote: text("edit_note"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// ---------- Payments ----------

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orgId: orgId(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    amountInr: integer("amount_inr").notNull(),
    provider: text("provider").notNull(),
    providerRef: text("provider_ref").notNull().unique(),
    linkUrl: text("link_url").notNull(),
    status: text("status", { enum: ["created", "paid", "failed", "refunded"] })
      .notNull()
      .default("created"),
    receiptNumber: text("receipt_number").notNull().unique(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("payments_job_idx").on(t.jobId)],
);

// ---------- Compliance ----------

export const deletionRequests = pgTable("deletion_requests", {
  id: id(),
  orgId: orgId(),
  candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
  requestedVia: text("requested_via", { enum: ["whatsapp", "recruiter", "retention"] }).notNull(),
  status: text("status", { enum: ["pending", "completed"] }).notNull().default("pending"),
  createdAt: createdAt(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    orgId: orgId(),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actor: text("actor", { enum: ["user", "system", "candidate"] }).notNull(),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    meta: jsonb("meta").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_idx").on(t.orgId, t.createdAt)],
);

export const costEvents = pgTable("cost_events", {
  id: id(),
  orgId: orgId(),
  jobId: uuid("job_id")
    .notNull()
    .references(() => jobs.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["wa_template", "wa_session", "stt_seconds", "llm_input_tokens", "llm_output_tokens"] }).notNull(),
  quantity: integer("quantity").notNull(),
  createdAt: createdAt(),
});

// ---------- System tables (no RLS) ----------

export const webhookEvents = pgTable(
  "webhook_events",
  {
    id: id(),
    provider: text("provider").notNull(),
    eventId: text("event_id").notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("webhook_events_uniq").on(t.provider, t.eventId)],
);

export const queue = pgTable(
  "job_queue",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").notNull(),
    dedupeKey: text("dedupe_key").unique(),
    status: text("status", { enum: ["queued", "running", "done", "failed"] }).notNull().default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("job_queue_ready_idx").on(t.status, t.runAt)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    orgId: uuid("org_id"),
    userId: uuid("user_id"),
    name: text("name").notNull(),
    props: jsonb("props").notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_name_idx").on(t.name, t.createdAt)],
);

/** Tables guarded by row-level security on org_id. Keep in sync with the RLS migration. */
export const TENANT_TABLES = [
  "organizations",
  "memberships",
  "jobs",
  "questions",
  "rubric_items",
  "candidates",
  "consents",
  "conversations",
  "messages",
  "answers",
  "scores",
  "payments",
  "deletion_requests",
  "audit_log",
  "cost_events",
] as const;
