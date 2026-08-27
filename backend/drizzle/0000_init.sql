CREATE TABLE "family_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"member_user_id" text,
	"member_mobile" text NOT NULL,
	"member_name" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_verifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'UNVERIFIED' NOT NULL,
	"method" text,
	"provider" text,
	"reference" text,
	"encrypted_data" text,
	"masked_value" text,
	"consent_given" boolean DEFAULT false NOT NULL,
	"consent_at" timestamp with time zone,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_verifications_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"mobile" text NOT NULL,
	"role" text NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"avatar_url" text,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"language" text DEFAULT 'en' NOT NULL,
	"notification_prefs" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"mobile" text NOT NULL,
	"role" text NOT NULL,
	"name" text,
	"email" text,
	"password_hash" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"mobile_verified" boolean DEFAULT false NOT NULL,
	"frozen_reason" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_customers" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"customer_user_id" text NOT NULL,
	"display_name" text,
	"credit_limit_paise" bigint,
	"terms_days" integer,
	"max_txn_paise" bigint,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchant_staff" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_user_id" text NOT NULL,
	"shop_name" text NOT NULL,
	"legal_name" text,
	"category" text,
	"description" text,
	"address" text,
	"city" text,
	"state" text,
	"pincode" text,
	"phone" text,
	"email" text,
	"upi_id" text,
	"gstin" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"default_credit_limit_paise" bigint DEFAULT 500000 NOT NULL,
	"default_terms_days" integer DEFAULT 15 NOT NULL,
	"default_max_txn_paise" bigint DEFAULT 200000 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_codes" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"token" text NOT NULL,
	"label" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"customer_user_id" text NOT NULL,
	"balance_paise" bigint DEFAULT 0 NOT NULL,
	"total_udhaar_paise" bigint DEFAULT 0 NOT NULL,
	"total_repaid_paise" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"udhaar_id" text,
	"type" text NOT NULL,
	"method" text DEFAULT 'SYSTEM' NOT NULL,
	"amount_paise" bigint NOT NULL,
	"balance_after_paise" bigint NOT NULL,
	"description" text,
	"reference_type" text,
	"reference_id" text,
	"created_by_user_id" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promise_to_pay" (
	"id" text PRIMARY KEY NOT NULL,
	"udhaar_id" text NOT NULL,
	"customer_user_id" text NOT NULL,
	"promised_date" timestamp with time zone NOT NULL,
	"amount_paise" bigint NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"note" text,
	"fulfilled_at" timestamp with time zone,
	"missed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "udhaar" (
	"id" text PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"account_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"customer_user_id" text NOT NULL,
	"created_by_user_id" text,
	"principal_paise" bigint NOT NULL,
	"outstanding_paise" bigint NOT NULL,
	"status" text DEFAULT 'REQUESTED' NOT NULL,
	"items" jsonb,
	"note" text,
	"bill_ref" text,
	"due_date" timestamp with time zone NOT NULL,
	"customer_confirmed" boolean DEFAULT true NOT NULL,
	"merchant_confirmed" boolean DEFAULT false NOT NULL,
	"limit_exceeded" boolean DEFAULT false NOT NULL,
	"accepted_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"rejected_reason" text,
	"cleared_at" timestamp with time zone,
	"disputed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "udhaar_events" (
	"id" text PRIMARY KEY NOT NULL,
	"udhaar_id" text NOT NULL,
	"type" text NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"title" text NOT NULL,
	"description" text,
	"amount_paise" bigint,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"gateway_order_id" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"currency" text DEFAULT 'INR' NOT NULL,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_webhooks" (
	"id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"provider" text DEFAULT 'mock' NOT NULL,
	"event_type" text NOT NULL,
	"payment_id" text,
	"gateway_order_id" text,
	"gateway_payment_id" text,
	"signature" text,
	"payload" jsonb,
	"status" text DEFAULT 'RECEIVED' NOT NULL,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"udhaar_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"customer_user_id" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"method" text DEFAULT 'UPI' NOT NULL,
	"status" text DEFAULT 'CREATED' NOT NULL,
	"idempotency_key" text NOT NULL,
	"gateway_provider" text DEFAULT 'mock' NOT NULL,
	"gateway_order_id" text,
	"gateway_payment_id" text,
	"fee_paise" bigint DEFAULT 0 NOT NULL,
	"net_paise" bigint DEFAULT 0 NOT NULL,
	"refunded_paise" bigint DEFAULT 0 NOT NULL,
	"failure_reason" text,
	"initiated_by_user_id" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"receipt_no" text NOT NULL,
	"type" text NOT NULL,
	"udhaar_id" text,
	"payment_id" text,
	"merchant_id" text NOT NULL,
	"customer_user_id" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"outstanding_after_paise" bigint NOT NULL,
	"method" text,
	"snapshot" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"payment_id" text NOT NULL,
	"udhaar_id" text,
	"amount_paise" bigint NOT NULL,
	"reason" text,
	"gateway_refund_id" text,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settlements" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"payment_id" text,
	"gross_paise" bigint NOT NULL,
	"fee_paise" bigint DEFAULT 0 NOT NULL,
	"net_paise" bigint NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"reference" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"data" jsonb,
	"read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" text PRIMARY KEY NOT NULL,
	"udhaar_id" text NOT NULL,
	"customer_user_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"type" text NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'SCHEDULED' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"udhaar_id" text NOT NULL,
	"account_id" text NOT NULL,
	"amount_paise" bigint NOT NULL,
	"reason" text NOT NULL,
	"reference_txn_id" text,
	"dispute_id" text,
	"created_by_user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dispute_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"dispute_id" text NOT NULL,
	"added_by_user_id" text,
	"added_by_role" text,
	"kind" text DEFAULT 'NOTE' NOT NULL,
	"text" text,
	"file_url" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" text PRIMARY KEY NOT NULL,
	"ref" text NOT NULL,
	"udhaar_id" text NOT NULL,
	"raised_by_user_id" text NOT NULL,
	"merchant_id" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'OPEN' NOT NULL,
	"description" text,
	"amount_claimed_paise" bigint,
	"resolution" text,
	"resolved_by_user_id" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_items" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"product_id" text,
	"name" text NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_price_paise" bigint DEFAULT 0 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_percent" integer DEFAULT 0 NOT NULL,
	"line_total_paise" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_no" text NOT NULL,
	"merchant_id" text NOT NULL,
	"customer_user_id" text,
	"customer_name" text,
	"subtotal_paise" bigint DEFAULT 0 NOT NULL,
	"discount_paise" bigint DEFAULT 0 NOT NULL,
	"tax_paise" bigint DEFAULT 0 NOT NULL,
	"total_paise" bigint DEFAULT 0 NOT NULL,
	"paid_paise" bigint DEFAULT 0 NOT NULL,
	"udhaar_paise" bigint DEFAULT 0 NOT NULL,
	"udhaar_id" text,
	"status" text DEFAULT 'ISSUED' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"merchant_id" text NOT NULL,
	"sku" text,
	"name" text NOT NULL,
	"category" text,
	"purchase_price_paise" bigint,
	"selling_price_paise" bigint DEFAULT 0 NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 0 NOT NULL,
	"tax_percent" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text,
	"entity_id" text,
	"summary" text,
	"metadata" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "family_permissions" ADD CONSTRAINT "family_permissions_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "family_permissions" ADD CONSTRAINT "family_permissions_member_user_id_users_id_fk" FOREIGN KEY ("member_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_customers" ADD CONSTRAINT "merchant_customers_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_customers" ADD CONSTRAINT "merchant_customers_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff" ADD CONSTRAINT "merchant_staff_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchant_staff" ADD CONSTRAINT "merchant_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_codes" ADD CONSTRAINT "qr_codes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transactions" ADD CONSTRAINT "ledger_transactions_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_to_pay" ADD CONSTRAINT "promise_to_pay_udhaar_id_udhaar_id_fk" FOREIGN KEY ("udhaar_id") REFERENCES "public"."udhaar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promise_to_pay" ADD CONSTRAINT "promise_to_pay_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "udhaar" ADD CONSTRAINT "udhaar_account_id_ledger_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."ledger_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "udhaar" ADD CONSTRAINT "udhaar_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "udhaar" ADD CONSTRAINT "udhaar_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "udhaar" ADD CONSTRAINT "udhaar_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "udhaar_events" ADD CONSTRAINT "udhaar_events_udhaar_id_udhaar_id_fk" FOREIGN KEY ("udhaar_id") REFERENCES "public"."udhaar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "udhaar_events" ADD CONSTRAINT "udhaar_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_orders" ADD CONSTRAINT "payment_orders_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_udhaar_id_udhaar_id_fk" FOREIGN KEY ("udhaar_id") REFERENCES "public"."udhaar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_initiated_by_user_id_users_id_fk" FOREIGN KEY ("initiated_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settlements" ADD CONSTRAINT "settlements_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_udhaar_id_udhaar_id_fk" FOREIGN KEY ("udhaar_id") REFERENCES "public"."udhaar"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_udhaar_id_udhaar_id_fk" FOREIGN KEY ("udhaar_id") REFERENCES "public"."udhaar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_dispute_id_disputes_id_fk" FOREIGN KEY ("dispute_id") REFERENCES "public"."disputes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dispute_evidence" ADD CONSTRAINT "dispute_evidence_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_udhaar_id_udhaar_id_fk" FOREIGN KEY ("udhaar_id") REFERENCES "public"."udhaar"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_user_id_users_id_fk" FOREIGN KEY ("raised_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_user_id_users_id_fk" FOREIGN KEY ("customer_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_merchant_id_merchants_id_fk" FOREIGN KEY ("merchant_id") REFERENCES "public"."merchants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "family_owner_idx" ON "family_permissions" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "otp_mobile_idx" ON "otp_codes" USING btree ("mobile");--> statement-breakpoint
CREATE UNIQUE INDEX "users_mobile_role_uq" ON "users" USING btree ("mobile","role");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_customer_uq" ON "merchant_customers" USING btree ("merchant_id","customer_user_id");--> statement-breakpoint
CREATE INDEX "merchant_customer_cust_idx" ON "merchant_customers" USING btree ("customer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "merchant_staff_uq" ON "merchant_staff" USING btree ("merchant_id","user_id");--> statement-breakpoint
CREATE INDEX "merchants_owner_idx" ON "merchants" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "qr_token_uq" ON "qr_codes" USING btree ("token");--> statement-breakpoint
CREATE INDEX "qr_merchant_idx" ON "qr_codes" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_account_uq" ON "ledger_accounts" USING btree ("merchant_id","customer_user_id");--> statement-breakpoint
CREATE INDEX "ledger_account_customer_idx" ON "ledger_accounts" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "ledger_txn_account_idx" ON "ledger_transactions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "ledger_txn_udhaar_idx" ON "ledger_transactions" USING btree ("udhaar_id");--> statement-breakpoint
CREATE INDEX "promise_udhaar_idx" ON "promise_to_pay" USING btree ("udhaar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "udhaar_ref_uq" ON "udhaar" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "udhaar_merchant_idx" ON "udhaar" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "udhaar_customer_idx" ON "udhaar" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "udhaar_account_idx" ON "udhaar" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "udhaar_status_idx" ON "udhaar" USING btree ("status");--> statement-breakpoint
CREATE INDEX "udhaar_events_udhaar_idx" ON "udhaar_events" USING btree ("udhaar_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_orders_gwid_uq" ON "payment_orders" USING btree ("gateway_order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_webhooks_event_uq" ON "payment_webhooks" USING btree ("event_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_ref_uq" ON "payments" USING btree ("ref");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_idempotency_uq" ON "payments" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "payments_udhaar_idx" ON "payments" USING btree ("udhaar_id");--> statement-breakpoint
CREATE INDEX "payments_merchant_idx" ON "payments" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "payments_customer_idx" ON "payments" USING btree ("customer_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_no_uq" ON "receipts" USING btree ("receipt_no");--> statement-breakpoint
CREATE INDEX "receipts_udhaar_idx" ON "receipts" USING btree ("udhaar_id");--> statement-breakpoint
CREATE INDEX "receipts_customer_idx" ON "receipts" USING btree ("customer_user_id");--> statement-breakpoint
CREATE INDEX "refunds_payment_idx" ON "refunds" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "settlements_merchant_idx" ON "settlements" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "notifications_user_idx" ON "notifications" USING btree ("user_id","read");--> statement-breakpoint
CREATE INDEX "reminders_due_idx" ON "reminders" USING btree ("scheduled_at","status");--> statement-breakpoint
CREATE INDEX "reminders_udhaar_idx" ON "reminders" USING btree ("udhaar_id");--> statement-breakpoint
CREATE INDEX "adjustments_udhaar_idx" ON "adjustments" USING btree ("udhaar_id");--> statement-breakpoint
CREATE INDEX "dispute_evidence_dispute_idx" ON "dispute_evidence" USING btree ("dispute_id");--> statement-breakpoint
CREATE UNIQUE INDEX "disputes_ref_uq" ON "disputes" USING btree ("ref");--> statement-breakpoint
CREATE INDEX "disputes_udhaar_idx" ON "disputes" USING btree ("udhaar_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "invoice_items_invoice_idx" ON "invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_no_uq" ON "invoices" USING btree ("invoice_no");--> statement-breakpoint
CREATE INDEX "invoices_merchant_idx" ON "invoices" USING btree ("merchant_id");--> statement-breakpoint
CREATE INDEX "products_merchant_idx" ON "products" USING btree ("merchant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_sku_uq" ON "products" USING btree ("merchant_id","sku");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");