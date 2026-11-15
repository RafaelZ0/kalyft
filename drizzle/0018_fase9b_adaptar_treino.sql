CREATE TABLE "adaptacoes_treino" (
	"user_id" uuid NOT NULL,
	"data" date NOT NULL,
	"treino_id" uuid NOT NULL,
	"minutos" integer,
	"itens" jsonb NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "adaptacoes_treino_user_id_data_pk" PRIMARY KEY("user_id","data"),
	CONSTRAINT "adaptacoes_treino_data_check" CHECK ("adaptacoes_treino"."data" >= date '2000-01-01'),
	CONSTRAINT "adaptacoes_treino_minutos_check" CHECK ("adaptacoes_treino"."minutos" is null or "adaptacoes_treino"."minutos" in (15, 20, 30, 45, 60)),
	CONSTRAINT "adaptacoes_treino_itens_check" CHECK (jsonb_typeof("adaptacoes_treino"."itens") = 'array' and jsonb_array_length("adaptacoes_treino"."itens") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "adaptacoes_treino" ADD CONSTRAINT "adaptacoes_treino_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "adaptacoes_treino" ADD CONSTRAINT "adaptacoes_treino_treino_id_user_id_treinos_id_user_id_fk" FOREIGN KEY ("treino_id","user_id") REFERENCES "public"."treinos"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Editado à mão: auditoria do acompanhamento, como nas demais tabelas do usuário.
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.adaptacoes_treino FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
