CREATE TABLE "fotos_corpo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"posicao" text NOT NULL,
	"nota" text,
	"bytes" "bytea" NOT NULL,
	"tamanho" integer NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fotos_corpo_id_user_unique" UNIQUE("id","user_id"),
	CONSTRAINT "fotos_corpo_posicao_check" CHECK ("fotos_corpo"."posicao" in ('frente', 'lado', 'costas')),
	CONSTRAINT "fotos_corpo_nota_check" CHECK (char_length("fotos_corpo"."nota") <= 200),
	CONSTRAINT "fotos_corpo_data_check" CHECK ("fotos_corpo"."data" >= date '2000-01-01'),
	CONSTRAINT "fotos_corpo_tamanho_check" CHECK ("fotos_corpo"."tamanho" between 1024 and 512000 and octet_length("fotos_corpo"."bytes") = "fotos_corpo"."tamanho")
);
--> statement-breakpoint
ALTER TABLE "fotos_corpo" ADD CONSTRAINT "fotos_corpo_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fotos_corpo_user_data_idx" ON "fotos_corpo" USING btree ("user_id","data" DESC NULLS LAST);