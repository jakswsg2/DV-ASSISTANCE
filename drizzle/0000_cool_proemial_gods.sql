CREATE TYPE "public"."case_status" AS ENUM('intake_pending', 'active', 'under_review', 'closed', 'escalated');--> statement-breakpoint
CREATE TYPE "public"."danger_level" AS ENUM('standard', 'elevated', 'high', 'severe');--> statement-breakpoint
CREATE TYPE "public"."data_classification" AS ENUM('PUBLIC', 'INTERNAL', 'CONFIDENTIAL', 'HIGHLY_SENSITIVE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('anonymous', 'client', 'advocate', 'partner', 'admin');--> statement-breakpoint
CREATE TABLE "advocate_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_unit" text NOT NULL,
	"active_caseload_count" integer DEFAULT 0 NOT NULL,
	"max_caseload_capacity" integer DEFAULT 20 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"advocate_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	"unassigned_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "case_status" DEFAULT 'intake_pending' NOT NULL,
	"danger_level" "danger_level" DEFAULT 'standard' NOT NULL,
	"sanitized_summary" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "client_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"preferred_alias" text NOT NULL,
	"safe_contact_method" text DEFAULT 'in_app_only' NOT NULL,
	"safe_times_to_contact" text,
	"danger_assessment_score" integer,
	"is_restricted_view" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"uploader_id" uuid NOT NULL,
	"sanitized_file_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"storage_path" text NOT NULL,
	"classification" "data_classification" DEFAULT 'HIGHLY_SENSITIVE' NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid,
	"incident_date_approximate" text NOT NULL,
	"incident_type" text NOT NULL,
	"sanitized_narrative" text NOT NULL,
	"police_report_filed" boolean DEFAULT false NOT NULL,
	"police_report_reference" text,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "safety_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"case_id" uuid,
	"version" integer DEFAULT 1 NOT NULL,
	"safe_locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"emergency_contacts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"essential_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"safe_code_word" text,
	"last_reviewed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "secure_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"recipient_id" uuid NOT NULL,
	"encrypted_payload" text NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"shred_after_hours" integer
);
--> statement-breakpoint
CREATE TABLE "security_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" text NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"outcome" text NOT NULL,
	"request_id" text,
	"ip_hash" text,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "support_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"is_24_7" boolean DEFAULT false NOT NULL,
	"contact_phone" text,
	"contact_text" text,
	"website_url" text,
	"is_physical_address_confidential" boolean DEFAULT true NOT NULL,
	"general_city_region" text NOT NULL,
	"languages_supported" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_identities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_subject_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "user_role" DEFAULT 'anonymous' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"safe_alias" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advocate_profiles" ADD CONSTRAINT "advocate_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_assignments" ADD CONSTRAINT "case_assignments_advocate_id_users_id_fk" FOREIGN KEY ("advocate_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_profiles" ADD CONSTRAINT "client_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploader_id_users_id_fk" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_plans" ADD CONSTRAINT "safety_plans_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_plans" ADD CONSTRAINT "safety_plans_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secure_messages" ADD CONSTRAINT "secure_messages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secure_messages" ADD CONSTRAINT "secure_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "secure_messages" ADD CONSTRAINT "secure_messages_recipient_id_users_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "security_audit_events" ADD CONSTRAINT "security_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_identities" ADD CONSTRAINT "user_identities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_advocate_profiles_user_id" ON "advocate_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_advocate_profiles_org_unit" ON "advocate_profiles" USING btree ("organization_unit");--> statement-breakpoint
CREATE INDEX "idx_case_assignments_case_id" ON "case_assignments" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_case_assignments_advocate_id" ON "case_assignments" USING btree ("advocate_id");--> statement-breakpoint
CREATE INDEX "idx_case_assignments_status" ON "case_assignments" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cases_client_id" ON "cases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_cases_status" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_cases_danger_level" ON "cases" USING btree ("danger_level");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_client_profiles_user_id" ON "client_profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_documents_case_id" ON "documents" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_documents_uploader_id" ON "documents" USING btree ("uploader_id");--> statement-breakpoint
CREATE INDEX "idx_incident_reports_case_id" ON "incident_reports" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_incident_reports_submitted_at" ON "incident_reports" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "idx_safety_plans_client_id" ON "safety_plans" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "idx_safety_plans_case_id" ON "safety_plans" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_secure_messages_case_id" ON "secure_messages" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "idx_secure_messages_sender_id" ON "secure_messages" USING btree ("sender_id");--> statement-breakpoint
CREATE INDEX "idx_secure_messages_recipient_id" ON "secure_messages" USING btree ("recipient_id");--> statement-breakpoint
CREATE INDEX "idx_secure_messages_sent_at" ON "secure_messages" USING btree ("sent_at");--> statement-breakpoint
CREATE INDEX "idx_security_audit_timestamp" ON "security_audit_events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "idx_security_audit_actor" ON "security_audit_events" USING btree ("actor_user_id");--> statement-breakpoint
CREATE INDEX "idx_security_audit_action" ON "security_audit_events" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_security_audit_resource" ON "security_audit_events" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "idx_support_resources_category" ON "support_resources" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_support_resources_city" ON "support_resources" USING btree ("general_city_region");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_user_identities_provider_sub" ON "user_identities" USING btree ("provider","provider_subject_id");--> statement-breakpoint
CREATE INDEX "idx_user_identities_user_id" ON "user_identities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_users_role" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "idx_users_status" ON "users" USING btree ("status");