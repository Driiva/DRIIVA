CREATE TABLE "stripe_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"payload" json NOT NULL,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
