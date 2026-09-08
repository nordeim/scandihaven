-- Extensions required by the schema (citext slugs/emails, pg_trgm search).
CREATE EXTENSION IF NOT EXISTS citext;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
CREATE TYPE "public"."address_kind" AS ENUM('billing', 'shipping');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('active', 'converted', 'abandoned', 'merged');--> statement-breakpoint
CREATE TYPE "public"."gift_card_status" AS ENUM('active', 'depleted', 'expired', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."gift_card_tx_kind" AS ENUM('issue', 'redeem', 'refund', 'expire');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'running', 'done', 'failed', 'dead');--> statement-breakpoint
CREATE TYPE "public"."journal_category" AS ENUM('craft', 'home', 'people', 'sustainability');--> statement-breakpoint
CREATE TYPE "public"."line_condition" AS ENUM('unopened', 'opened', 'damaged');--> statement-breakpoint
CREATE TYPE "public"."media_kind" AS ENUM('image', 'video');--> statement-breakpoint
CREATE TYPE "public"."movement_reason" AS ENUM('purchase', 'sale', 'return', 'adjustment', 'transfer', 'reservation', 'release');--> statement-breakpoint
CREATE TYPE "public"."nav_menu" AS ENUM('header', 'footer_shop', 'footer_about', 'footer_help');--> statement-breakpoint
CREATE TYPE "public"."order_source" AS ENUM('web', 'trade', 'admin');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending_payment', 'review', 'confirmed', 'in_production', 'partially_shipped', 'shipped', 'delivered', 'closed', 'cancelled', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('requires_action', 'processing', 'succeeded', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_terms" AS ENUM('card', 'net30');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'active', 'archived');--> statement-breakpoint
CREATE TYPE "public"."promotion_kind" AS ENUM('fixed', 'percent', 'free_shipping', 'bogo', 'tiered');--> statement-breakpoint
CREATE TYPE "public"."redirect_kind" AS ENUM('301', '302');--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('EU', 'US', 'UK');--> statement-breakpoint
CREATE TYPE "public"."return_status" AS ENUM('requested', 'approved', 'awaiting_shipment', 'in_transit', 'inspecting', 'refunded', 'exchanged', 'rejected', 'closed');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'packed', 'shipped', 'delivered', 'returned');--> statement-breakpoint
CREATE TYPE "public"."shipping_method" AS ENUM('standard', 'express', 'white_glove', 'pickup');--> statement-breakpoint
CREATE TYPE "public"."subscriber_status" AS ENUM('pending', 'confirmed', 'unsubscribed');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('none', 'pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"impersonated_by" text,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" boolean DEFAULT false NOT NULL,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"phone" text,
	"marketing_opt_in" boolean DEFAULT false NOT NULL,
	"segment_tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"stripe_customer_id" text,
	"trade_status" "trade_status" DEFAULT 'none' NOT NULL,
	"trade_tier" text,
	"trade_company_name" text,
	"trade_cvr" text,
	"payment_terms" "payment_terms" DEFAULT 'card' NOT NULL,
	"notes" text,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "back_in_stock_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"email" text NOT NULL,
	"notified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"slug" "citext" NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "citext" NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"hero_media_id" uuid,
	"story_html" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"seo_title" text,
	"seo_description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collection_product" (
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "collection_product_collection_id_product_id_pk" PRIMARY KEY("collection_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_level" (
	"variant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"qty_on_hand" integer DEFAULT 0 NOT NULL,
	"qty_reserved" integer DEFAULT 0 NOT NULL,
	"safety_stock" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_level_variant_id_warehouse_id_pk" PRIMARY KEY("variant_id","warehouse_id")
);
--> statement-breakpoint
CREATE TABLE "inventory_movement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"delta" integer NOT NULL,
	"reason" "movement_reason" NOT NULL,
	"reference_type" text,
	"reference_id" text,
	"actor_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "media_kind" DEFAULT 'image' NOT NULL,
	"url" text NOT NULL,
	"alt" text NOT NULL,
	"width" integer,
	"height" integer,
	"blur_data_url" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "citext" NOT NULL,
	"title" text NOT NULL,
	"description_html" text,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"category_id" uuid,
	"brand" text DEFAULT 'Scandi Haven',
	"country_of_origin" char(2),
	"hs_code" text,
	"lead_time_days_min" integer DEFAULT 2 NOT NULL,
	"lead_time_days_max" integer DEFAULT 4 NOT NULL,
	"is_new" boolean DEFAULT false NOT NULL,
	"is_preorder" boolean DEFAULT false NOT NULL,
	"preorder_ships_on" date,
	"materials" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"care_html" text,
	"sustainability_html" text,
	"dimensions_json" jsonb,
	"weight_g" integer,
	"seo_title" text,
	"seo_description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_image" (
	"product_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_image_product_id_media_id_pk" PRIMARY KEY("product_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text NOT NULL,
	"material" text,
	"color" text,
	"color_hex" char(7),
	"size" text,
	"dimensions_json" jsonb,
	"weight_g" integer,
	"lead_time_days_min_override" integer,
	"lead_time_days_max_override" integer,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"customer_id" text,
	"order_id" uuid,
	"author_name" text NOT NULL,
	"rating" integer NOT NULL,
	"title" text,
	"body" text NOT NULL,
	"photos" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "review_status" DEFAULT 'pending' NOT NULL,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "search_synonym" (
	"term" text NOT NULL,
	"synonym" text NOT NULL,
	CONSTRAINT "search_synonym_term_synonym_pk" PRIMARY KEY("term","synonym")
);
--> statement-breakpoint
CREATE TABLE "variant_image" (
	"variant_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "variant_image_variant_id_media_id_pk" PRIMARY KEY("variant_id","media_id")
);
--> statement-breakpoint
CREATE TABLE "variant_price" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"currency" char(3) NOT NULL,
	"amount" integer NOT NULL,
	"compare_at" integer,
	"trade_amount" integer,
	"sale_amount" integer,
	"sale_starts_at" timestamp with time zone,
	"sale_ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "warehouse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address" jsonb,
	"is_showroom" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" text,
	"fields" jsonb NOT NULL,
	"is_default_shipping" boolean DEFAULT false NOT NULL,
	"is_default_billing" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_card" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_hash" text NOT NULL,
	"code_last4" char(4) NOT NULL,
	"initial_amount" integer NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"balance" integer NOT NULL,
	"purchaser_order_id" uuid,
	"recipient_email" "citext",
	"deliver_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"status" "gift_card_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_card_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_card_id" uuid NOT NULL,
	"order_id" uuid,
	"delta" integer NOT NULL,
	"balance_after" integer NOT NULL,
	"kind" "gift_card_tx_kind" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" "citext",
	"kind" "promotion_kind" NOT NULL,
	"value" integer,
	"tiers_json" jsonb,
	"conditions_json" jsonb NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"per_customer_limit" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "promotion_redemption" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promotion_id" uuid NOT NULL,
	"order_id" uuid,
	"user_id" text,
	"email_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_application" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"company_name" text NOT NULL,
	"cvr" text NOT NULL,
	"contact_email" "citext" NOT NULL,
	"website" text,
	"certificate_media_id" uuid,
	"status" "trade_status" DEFAULT 'pending' NOT NULL,
	"reviewer_id" text,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"user_id" text,
	"email" text,
	"region" "region" DEFAULT 'EU' NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"status" "cart_status" DEFAULT 'active' NOT NULL,
	"gift_message" text,
	"gift_wrap" boolean DEFAULT false NOT NULL,
	"gift_receipt" boolean DEFAULT false NOT NULL,
	"shipping_method" text,
	"totals_json" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"unit_price_snapshot" integer NOT NULL,
	"is_gift_wrap" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_promotion" (
	"cart_id" uuid NOT NULL,
	"promotion_id" uuid NOT NULL,
	CONSTRAINT "cart_promotion_cart_id_promotion_id_pk" PRIMARY KEY("cart_id","promotion_id")
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"number" text NOT NULL,
	"cart_id" uuid,
	"user_id" text,
	"email" text NOT NULL,
	"region" "region" NOT NULL,
	"currency" char(3) NOT NULL,
	"fx_rate" numeric(18, 8) DEFAULT '1' NOT NULL,
	"status" "order_status" DEFAULT 'pending_payment' NOT NULL,
	"subtotal" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"shipping" integer DEFAULT 0 NOT NULL,
	"tax" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"total_eur" integer NOT NULL,
	"payment_terms" "payment_terms" DEFAULT 'card' NOT NULL,
	"gift_message" text,
	"gift_wrap" boolean DEFAULT false NOT NULL,
	"gift_receipt" boolean DEFAULT false NOT NULL,
	"source" "order_source" DEFAULT 'web' NOT NULL,
	"placed_at" timestamp with time zone,
	"fulfilled_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"refunded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"kind" "address_kind" NOT NULL,
	"fields" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"actor" text DEFAULT 'system' NOT NULL,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"title_snapshot" text NOT NULL,
	"sku_snapshot" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_price" integer NOT NULL,
	"tax_rate" numeric(6, 4),
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"fulfillable_from" text
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"stripe_payment_intent_id" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" char(3) NOT NULL,
	"status" "payment_status" DEFAULT 'requires_action' NOT NULL,
	"amount_refunded" integer DEFAULT 0 NOT NULL,
	"method_details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_line" (
	"return_request_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	"condition" "line_condition" DEFAULT 'unopened' NOT NULL,
	CONSTRAINT "return_line_return_request_id_order_line_id_pk" PRIMARY KEY("return_request_id","order_line_id")
);
--> statement-breakpoint
CREATE TABLE "return_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"rma_number" text NOT NULL,
	"status" "return_status" DEFAULT 'requested' NOT NULL,
	"reason_code" text NOT NULL,
	"customer_note" text,
	"photo_media_ids" jsonb,
	"refund_amount" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"tracking_url" text,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment_line" (
	"shipment_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"qty" integer NOT NULL,
	CONSTRAINT "shipment_line_shipment_id_order_line_id_pk" PRIMARY KEY("shipment_id","order_line_id")
);
--> statement-breakpoint
CREATE TABLE "announcement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"href" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "citext" NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"hero_media_id" uuid,
	"body_html" text NOT NULL,
	"category" "journal_category" NOT NULL,
	"author" text NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"related_product_ids" jsonb DEFAULT '[]' NOT NULL,
	"author_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lookbook" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "citext" NOT NULL,
	"title" text NOT NULL,
	"season" text NOT NULL,
	"hero_media_id" uuid,
	"hotspots" jsonb DEFAULT '[]' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nav_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"menu" "nav_menu" NOT NULL,
	"label" text NOT NULL,
	"href" text NOT NULL,
	"parent_id" uuid,
	"featured_media_id" uuid,
	"featured_collection_slug" "citext",
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_locale" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"locale" char(5) NOT NULL,
	"title" text,
	"description_html" text,
	"care_html" text,
	"seo_title" text,
	"seo_description" text
);
--> statement-breakpoint
CREATE TABLE "redirect" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_path" text NOT NULL,
	"target_path" text NOT NULL,
	"kind" "redirect_kind" DEFAULT '301' NOT NULL,
	"hits" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "static_page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" "citext" NOT NULL,
	"title" text NOT NULL,
	"body_html" text NOT NULL,
	"seo_title" text,
	"seo_description" text,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analytics_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"actor_role" text,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"before" jsonb,
	"after" jsonb,
	"ip_hash" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rate" (
	"currency" char(3) PRIMARY KEY NOT NULL,
	"rate" numeric(18, 8) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"run_after" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "newsletter_subscriber" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" "citext" NOT NULL,
	"status" "subscriber_status" DEFAULT 'pending' NOT NULL,
	"token_hash" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_hit" (
	"bucket" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "rate_limit_hit_bucket_window_start_pk" PRIMARY KEY("bucket","window_start")
);
--> statement-breakpoint
CREATE TABLE "shipping_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"method" "shipping_method" NOT NULL,
	"min_weight_g" integer DEFAULT 0 NOT NULL,
	"max_weight_g" integer,
	"amount" integer NOT NULL,
	"currency" char(3) DEFAULT 'EUR' NOT NULL,
	"eta_days_min" integer DEFAULT 2 NOT NULL,
	"eta_days_max" integer DEFAULT 5 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"region" text NOT NULL,
	"countries" text[] NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "webhook_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"stripe_event_id" text NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "back_in_stock_request" ADD CONSTRAINT "back_in_stock_request_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_level" ADD CONSTRAINT "inventory_level_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_movement" ADD CONSTRAINT "inventory_movement_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_image" ADD CONSTRAINT "product_image_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_customer_id_user_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_image" ADD CONSTRAINT "variant_image_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_image" ADD CONSTRAINT "variant_image_media_id_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_price" ADD CONSTRAINT "variant_price_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_card_transaction" ADD CONSTRAINT "gift_card_transaction_gift_card_id_gift_card_id_fk" FOREIGN KEY ("gift_card_id") REFERENCES "public"."gift_card"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_promotion_id_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotion"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promotion_redemption" ADD CONSTRAINT "promotion_redemption_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_application" ADD CONSTRAINT "trade_application_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_application" ADD CONSTRAINT "trade_application_certificate_media_id_media_id_fk" FOREIGN KEY ("certificate_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_line" ADD CONSTRAINT "cart_line_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_promotion" ADD CONSTRAINT "cart_promotion_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_promotion" ADD CONSTRAINT "cart_promotion_promotion_id_promotion_id_fk" FOREIGN KEY ("promotion_id") REFERENCES "public"."promotion"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_cart_id_cart_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."cart"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_address" ADD CONSTRAINT "order_address_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_line" ADD CONSTRAINT "return_line_return_request_id_return_request_id_fk" FOREIGN KEY ("return_request_id") REFERENCES "public"."return_request"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_line" ADD CONSTRAINT "return_line_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_request" ADD CONSTRAINT "return_request_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_line" ADD CONSTRAINT "shipment_line_shipment_id_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_line" ADD CONSTRAINT "shipment_line_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_post" ADD CONSTRAINT "journal_post_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_post" ADD CONSTRAINT "journal_post_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lookbook" ADD CONSTRAINT "lookbook_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nav_entry" ADD CONSTRAINT "nav_entry_featured_media_id_media_id_fk" FOREIGN KEY ("featured_media_id") REFERENCES "public"."media"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_locale" ADD CONSTRAINT "product_locale_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_rate" ADD CONSTRAINT "shipping_rate_zone_id_shipping_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."shipping_zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_user_id_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_user_id_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_trade_status_idx" ON "user" USING btree ("trade_status");--> statement-breakpoint
CREATE UNIQUE INDEX "verification_identifier_value_idx" ON "verification" USING btree ("identifier","value");--> statement-breakpoint
CREATE UNIQUE INDEX "back_in_stock_variant_email_idx" ON "back_in_stock_request" USING btree ("variant_id","email");--> statement-breakpoint
CREATE UNIQUE INDEX "category_slug_idx" ON "category" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "category_parent_sort_idx" ON "category" USING btree ("parent_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "collection_slug_idx" ON "collection" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "inventory_movement_variant_created_idx" ON "inventory_movement" USING btree ("variant_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "product_slug_idx" ON "product" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "product_status_sort_idx" ON "product" USING btree ("status","sort_order");--> statement-breakpoint
CREATE INDEX "product_category_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_sku_idx" ON "product_variant" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "product_variant_product_idx" ON "product_variant" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "review_product_status_created_idx" ON "review" USING btree ("product_id","status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "variant_price_variant_currency_idx" ON "variant_price" USING btree ("variant_id","currency");--> statement-breakpoint
CREATE INDEX "address_user_idx" ON "address" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "gift_card_code_hash_idx" ON "gift_card" USING btree ("code_hash");--> statement-breakpoint
CREATE INDEX "gift_card_status_idx" ON "gift_card" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gift_card_tx_card_idx" ON "gift_card_transaction" USING btree ("gift_card_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "promotion_code_idx" ON "promotion" USING btree ("code");--> statement-breakpoint
CREATE INDEX "promotion_redemption_scope_idx" ON "promotion_redemption" USING btree ("promotion_id","user_id");--> statement-breakpoint
CREATE INDEX "trade_application_status_idx" ON "trade_application" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_token_idx" ON "cart" USING btree ("token");--> statement-breakpoint
CREATE INDEX "cart_status_updated_idx" ON "cart" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "cart_line_unique_idx" ON "cart_line" USING btree ("cart_id","variant_id","is_gift_wrap");--> statement-breakpoint
CREATE UNIQUE INDEX "order_number_idx" ON "order" USING btree ("number");--> statement-breakpoint
CREATE INDEX "order_status_placed_idx" ON "order" USING btree ("status","placed_at");--> statement-breakpoint
CREATE INDEX "order_user_idx" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_address_order_idx" ON "order_address" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_event_order_created_idx" ON "order_event" USING btree ("order_id","created_at");--> statement-breakpoint
CREATE INDEX "order_line_order_idx" ON "order_line" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_intent_idx" ON "payment" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "payment_order_status_idx" ON "payment" USING btree ("order_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "return_rma_idx" ON "return_request" USING btree ("rma_number");--> statement-breakpoint
CREATE INDEX "return_order_status_idx" ON "return_request" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "shipment_order_status_idx" ON "shipment" USING btree ("order_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "journal_post_slug_idx" ON "journal_post" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "journal_post_category_published_idx" ON "journal_post" USING btree ("category","published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "lookbook_slug_idx" ON "lookbook" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "nav_entry_menu_sort_idx" ON "nav_entry" USING btree ("menu","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_locale_idx" ON "product_locale" USING btree ("product_id","locale");--> statement-breakpoint
CREATE UNIQUE INDEX "redirect_source_idx" ON "redirect" USING btree ("source_path");--> statement-breakpoint
CREATE UNIQUE INDEX "static_page_slug_idx" ON "static_page" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "analytics_event_name_time_idx" ON "analytics_event" USING btree ("name","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_idempotency_idx" ON "job" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "job_status_run_after_idx" ON "job" USING btree ("status","run_after");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_email_idx" ON "newsletter_subscriber" USING btree ("email");--> statement-breakpoint
CREATE INDEX "shipping_rate_zone_method_idx" ON "shipping_rate" USING btree ("zone_id","method");--> statement-breakpoint
CREATE INDEX "shipping_zone_region_idx" ON "shipping_zone" USING btree ("region");--> statement-breakpoint
CREATE UNIQUE INDEX "webhook_event_stripe_id_idx" ON "webhook_event" USING btree ("stripe_event_id");