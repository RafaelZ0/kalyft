ALTER TABLE "alimentos_base" DROP CONSTRAINT "alimentos_base_fonte_check";--> statement-breakpoint
ALTER TABLE "alimentos_base" ADD COLUMN "referencia" text;--> statement-breakpoint
ALTER TABLE "alimentos_base" ADD COLUMN "sodio_adicao_mg" numeric(8, 2);--> statement-breakpoint
ALTER TABLE "alimentos_base" ADD CONSTRAINT "alimentos_base_referencia_check" CHECK (char_length("alimentos_base"."referencia") <= 300);--> statement-breakpoint
ALTER TABLE "alimentos_base" ADD CONSTRAINT "alimentos_base_sodio_adicao_check" CHECK ("alimentos_base"."sodio_adicao_mg" between 0 and 40000);--> statement-breakpoint
ALTER TABLE "alimentos_base" ADD CONSTRAINT "alimentos_base_fonte_check" CHECK ("alimentos_base"."fonte" in ('taco', 'ibge'));