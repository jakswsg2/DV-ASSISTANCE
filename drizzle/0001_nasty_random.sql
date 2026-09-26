ALTER TABLE "case_assignments" RENAME COLUMN "notes" TO "operational_note";--> statement-breakpoint
ALTER TABLE "secure_messages" RENAME COLUMN "shred_after_hours" TO "retention_policy_override_hours";--> statement-breakpoint
ALTER TABLE "incident_reports" DROP CONSTRAINT "incident_reports_case_id_cases_id_fk";
--> statement-breakpoint
ALTER TABLE "safety_plans" DROP CONSTRAINT "safety_plans_case_id_cases_id_fk";
--> statement-breakpoint
ALTER TABLE "incident_reports" ADD CONSTRAINT "incident_reports_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "safety_plans" ADD CONSTRAINT "safety_plans_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE restrict ON UPDATE no action;