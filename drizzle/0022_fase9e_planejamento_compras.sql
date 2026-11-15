CREATE TABLE "compras_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"semana" date NOT NULL,
	"chave" text,
	"texto" text,
	"comprado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "compras_itens_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "compras_itens_segunda_check" CHECK (extract(isodow from "compras_itens"."semana") = 1),
	CONSTRAINT "compras_itens_conteudo_check" CHECK (("compras_itens"."chave" is not null and "compras_itens"."texto" is null and "compras_itens"."chave" ~ '^(base|usuario):[0-9a-f-]{36}$')
        or ("compras_itens"."chave" is null and "compras_itens"."texto" is not null and char_length("compras_itens"."texto") between 1 and 80))
);
--> statement-breakpoint
CREATE TABLE "refeicoes_planejadas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"refeicao" text NOT NULL,
	"tipo" text NOT NULL,
	"receita_id" uuid,
	"refeicao_salva_id" uuid,
	"alimento_base_id" uuid,
	"alimento_usuario_id" uuid,
	"quantidade" numeric(6, 1) NOT NULL,
	"consumido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refeicoes_planejadas_id_user_key" UNIQUE("id","user_id"),
	CONSTRAINT "refeicoes_planejadas_data_check" CHECK ("refeicoes_planejadas"."data" >= date '2000-01-01'),
	CONSTRAINT "refeicoes_planejadas_refeicao_check" CHECK ("refeicoes_planejadas"."refeicao" in ('cafe', 'almoco', 'lanche', 'jantar', 'ceia')),
	CONSTRAINT "refeicoes_planejadas_tipo_check" CHECK (("refeicoes_planejadas"."tipo" = 'receita' and "refeicoes_planejadas"."receita_id" is not null and num_nonnulls("refeicoes_planejadas"."refeicao_salva_id", "refeicoes_planejadas"."alimento_base_id", "refeicoes_planejadas"."alimento_usuario_id") = 0 and "refeicoes_planejadas"."quantidade" between 0.5 and 10)
        or ("refeicoes_planejadas"."tipo" = 'salva' and "refeicoes_planejadas"."refeicao_salva_id" is not null and num_nonnulls("refeicoes_planejadas"."receita_id", "refeicoes_planejadas"."alimento_base_id", "refeicoes_planejadas"."alimento_usuario_id") = 0 and "refeicoes_planejadas"."quantidade" between 0.5 and 10)
        or ("refeicoes_planejadas"."tipo" = 'alimento' and num_nonnulls("refeicoes_planejadas"."alimento_base_id", "refeicoes_planejadas"."alimento_usuario_id") = 1 and num_nonnulls("refeicoes_planejadas"."receita_id", "refeicoes_planejadas"."refeicao_salva_id") = 0 and "refeicoes_planejadas"."quantidade" between 1 and 5000))
);
--> statement-breakpoint
ALTER TABLE "compras_itens" ADD CONSTRAINT "compras_itens_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_planejadas" ADD CONSTRAINT "refeicoes_planejadas_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_planejadas" ADD CONSTRAINT "refeicoes_planejadas_alimento_base_id_alimentos_base_id_fk" FOREIGN KEY ("alimento_base_id") REFERENCES "public"."alimentos_base"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_planejadas" ADD CONSTRAINT "refeicoes_planejadas_receita_id_user_id_receitas_id_user_id_fk" FOREIGN KEY ("receita_id","user_id") REFERENCES "public"."receitas"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_planejadas" ADD CONSTRAINT "refeicoes_planejadas_refeicao_salva_id_user_id_refeicoes_salvas_id_user_id_fk" FOREIGN KEY ("refeicao_salva_id","user_id") REFERENCES "public"."refeicoes_salvas"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refeicoes_planejadas" ADD CONSTRAINT "refeicoes_planejadas_alimento_usuario_id_user_id_alimentos_usuario_id_user_id_fk" FOREIGN KEY ("alimento_usuario_id","user_id") REFERENCES "public"."alimentos_usuario"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "compras_itens_chave_key" ON "compras_itens" USING btree ("user_id","semana","chave") WHERE "compras_itens"."chave" is not null;--> statement-breakpoint
CREATE INDEX "compras_itens_user_semana" ON "compras_itens" USING btree ("user_id","semana");--> statement-breakpoint
CREATE INDEX "refeicoes_planejadas_user_data" ON "refeicoes_planejadas" USING btree ("user_id","data");--> statement-breakpoint
-- Editado à mão: auditoria do acompanhamento, como nas demais tabelas do usuário.
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.refeicoes_planejadas FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
--> statement-breakpoint
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.compras_itens FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
