ALTER TABLE "acessos" ALTER COLUMN "status" SET DEFAULT 'aprovado';
--> statement-breakpoint
-- Fase 12A: cadastro aberto. Contas que aguardavam aprovação passam a valer; "recusado" continua bloqueado.
UPDATE "acessos" SET "status" = 'aprovado', "decidido_em" = now() WHERE "status" = 'pendente';
