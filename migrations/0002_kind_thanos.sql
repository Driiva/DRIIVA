CREATE TABLE "policy_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"policy_id" integer NOT NULL,
	"from_status" text,
	"to_status" text NOT NULL,
	"caused_by" text NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "policy_audit_log" ADD CONSTRAINT "policy_audit_log_policy_id_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."policies"("id") ON DELETE cascade ON UPDATE no action;