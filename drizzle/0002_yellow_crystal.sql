CREATE TABLE "psx_company" (
	"symbol" text PRIMARY KEY NOT NULL,
	"name" text,
	"website" text,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
