CREATE TABLE "passos_semana" (
	"user_id" uuid NOT NULL,
	"inicio" date NOT NULL,
	"tipo" text NOT NULL,
	"alvo" integer,
	"refeicao" text,
	"texto" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passos_semana_user_id_inicio_pk" PRIMARY KEY("user_id","inicio"),
	CONSTRAINT "passos_semana_segunda_check" CHECK (extract(isodow from "passos_semana"."inicio") = 1),
	CONSTRAINT "passos_semana_tipo_check" CHECK ("passos_semana"."tipo" in ('registrar_dias', 'refeicao_dias', 'pesar_dias', 'treinos', 'proteina_dias', 'agua_dias', 'livre')),
	CONSTRAINT "passos_semana_coerencia_check" CHECK (("passos_semana"."tipo" = 'livre' and "passos_semana"."alvo" is null and char_length("passos_semana"."texto") between 1 and 120)
        or ("passos_semana"."tipo" <> 'livre' and "passos_semana"."alvo" between 1 and 7 and "passos_semana"."texto" is null)),
	CONSTRAINT "passos_semana_refeicao_check" CHECK (("passos_semana"."tipo" = 'refeicao_dias' and "passos_semana"."refeicao" in ('cafe', 'almoco', 'lanche', 'jantar', 'ceia')) or ("passos_semana"."tipo" <> 'refeicao_dias' and "passos_semana"."refeicao" is null))
);
--> statement-breakpoint
ALTER TABLE "passos_semana" ADD CONSTRAINT "passos_semana_user_id_perfis_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."perfis"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
-- Editado à mão: auditoria do acompanhamento, como nas demais tabelas do usuário.
CREATE TRIGGER acompanhamento_auditar AFTER INSERT OR UPDATE OR DELETE ON public.passos_semana FOR EACH ROW EXECUTE FUNCTION public.acompanhamento_auditar();
