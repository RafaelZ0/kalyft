# Acompanhamento — relatório de validação local

13/11/2026. Branch codex/acompanhamento-alunos. Implementação ainda não publicada.

## Implementado

Lista de alunos aprovados, contexto opaco vinculado à sessão, faixa de acompanhamento e retorno, leitura dos módulos, solicitação/aceite/recusa/revogação de edição temporária e de fotos separadas, histórico de alterações. Identidade real permanece independente do titular acompanhado. Formulários e callbacks de séries carregam o contexto renderizado. Escritas acompanhadas passam pela validação transacional do Postgres e auditoria por trigger. Fotos são verificadas também no GET dos bytes, com contexto e cache privado. IA, aplicação semanal, tokens e upload/exclusão de fotos permanecem pessoais.

## Evidências desta execução

- Linha de base: 379 testes unitários passaram.
- Novas regras e integrações: 429 testes unitários passaram.
- Testes novos de banco: 5 passaram, incluindo concessão por titular, deduplicação de solicitações, vínculo à sessão, auditoria e bloqueio após revogação. Migration 0016 aplicada somente pelo runner do banco de teste.
- Typecheck e ESLint passaram após correções de tipagem do teste do driver e prefer-const.
- Build Turbopack falhou por acesso à fonte e depois por falha interna ao criar processo no Windows. Build alternativo Webpack concluído com sucesso, incluindo TypeScript e geração de rotas.
- Suíte completa de banco: 245 testes passaram em 14 arquivos após adaptação das fixtures pessoais. A primeira tentativa foi interrompida após falhas relacionadas às fixtures antigas sem cookie/contexto da requisição.
- Migration aplicada no desenvolvimento e no teste. Produção não alterada. Navegador não conseguiu acessar http://localhost:3001 (timeout); validação visual e iPhone continuam pendentes.

## Auditoria de dependências

npm audit --omit=dev executado com acesso à rede reportou 16 vulnerabilidades (7 baixas, 4 moderadas, 3 altas e 2 críticas). O relatório inclui Next.js 16.3.8, Zod e dependências de Neon Auth/Better Auth; não houve instalação de pacotes nesta implementação. Não foi executado audit fix. Atualização com revisão de compatibilidade é pendência antes de publicar.

## Pendências para encerrar

1. Build Webpack e suíte de banco concluídos; preservar esses resultados ao revisar futuras alterações.
2. Revisão de autorização de todas as superfícies listadas em acompanhamento-superficies.md e verificação manual com contas sintéticas.
3. Testar no iPhone conforme roteiro; revisar diff e dependências.
4. Aplicar migration em dev, validar preview e preparar publicação somente com banco e código compatíveis.

Nenhum segredo foi intencionalmente adicionado aos arquivos. Auditoria integral do histórico de Git ainda não foi repetida nesta fase.
