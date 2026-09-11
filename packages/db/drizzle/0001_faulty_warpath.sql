-- Prerequisite for the generated column below (round 7, R-DB-1): Postgres
-- marks array_to_string STABLE (element output functions may be
-- locale-dependent for some types), which forbids it in GENERATED ALWAYS
-- expressions. For text[] the output is genuinely deterministic, so this
-- wrapper honestly re-declares immutability for the text[] case only.
CREATE OR REPLACE FUNCTION "immutable_text_array_to_string"(arr text[], sep text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE
AS 'SELECT array_to_string(arr, sep)';--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "search_vector" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english'::regconfig, coalesce(title, '')), 'A') || setweight(to_tsvector('english'::regconfig, coalesce(immutable_text_array_to_string(materials, ' '), '') || ' ' || coalesce(description_html, '')), 'B')) STORED;--> statement-breakpoint
CREATE INDEX "product_search_vector_idx" ON "product" USING gin ("search_vector");
