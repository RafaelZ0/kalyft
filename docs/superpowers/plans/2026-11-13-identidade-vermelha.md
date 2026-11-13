# Identidade vermelha — implementação

> Execução: subagent-driven-development para módulos independentes e revisão integrada.

**Objetivo:** aplicar ao aplicativo a identidade vermelha e logo C aprovadas, com temas Sistema/Claro/Escuro e navegação responsiva.
**Arquitetura:** preservar páginas Server Components, DAL, Server Actions e ContextoDadosProvider. Compartilhar tokens CSS, componentes visuais e ícones Lucide locais. Preferência de aparência no dispositivo, inicializada antes da hidratação com nonce da CSP.
**Stack:** Next.js 16.3.8, React 19, TypeScript, Tailwind 4, Lucide React.

## Restrições
- Não alterar regras de nutrição, acesso, acompanhamento, banco ou permissões.
- Usar dados reais e estados vazios, sem valores fictícios do protótipo.
- Sistema é padrão; preferências manuais persistem. Sem scripts remotos ou relaxamento de CSP.
- Respeitar guias locais de Next.js. Não publicar sem validação.

## Tarefa 1 — base, marca e tema
- [x] Instalar Lucide React local e integrar marca vetorial aprovada em `lib/marca.tsx` e ícones instaláveis.
- [x] Criar `lib/aparencia.ts`, teste de preferência inválida e sincronização Sistema/claro/escuro em `tests/aparencia.test.ts`.
- [x] Adicionar provider/seletor acessível, inicialização com nonce em `app/layout.tsx` e tokens em `app/globals.css`.
- [x] Redesenhar `components/ui.tsx`, `app/(app)/layout.tsx`, barra de navegação e cabeçalho; manter contexto de acompanhamento.

## Tarefa 2 — alimentação
- [x] Atualizar apresentação das páginas em `app/(app)/comida` com cartões, ícones e hierarquia compacta.
- [x] Trazer atalhos de IA e código de barras para antes dos recentes.
- [x] Atualizar painel de água reutilizável em Hoje, preservando FormDados e ações existentes.
- [x] Não editar actions, DAL ou CSS global. Verificar tipos após integração.

## Tarefa 3 — treino e progresso
- [x] Atualizar páginas/componentes em `app/(app)/treino` e `app/(app)/progresso`, sem alterar ações nem cálculos.
- [x] Usar cartões, estados vazios e atalhos legíveis; preservar gráficos e formulários existentes.
- [x] Manter nomes/datas dos registros visíveis e permissões de acompanhamento.

## Tarefa 4 — Hoje, conta e autenticação
- [x] Redesenhar Hoje com dados reais, calorias/macros, água, treino, refeições e corpo em colunas responsivas.
- [x] Adicionar Aparência em Conta e adaptar páginas de autenticação à marca.
- [x] Harmonizar páginas de acompanhamento sem modificar regras ou barreiras de acesso.

## Tarefa 5 — validação
- [x] Executar testes de aparência, testes existentes, lint, typecheck e build; corrigir regressões.
- [x] Inspecionar telas e alternância de temas em mobile/desktop quando navegador local disponível; registrar limitações concretas.
- [x] Revisar diffs, ícones, marca, CSP e preservação das funções de acompanhamento.

## Progresso
Implementação concluída no código, com revisão integrada. Publicação não iniciada.

Validação: 435 testes em 32 arquivos; lint; typecheck; build de produção com Webpack; geração real dos PNGs; revisão do acompanhamento e dos formulários. Login inspecionado no navegador em claro/escuro, preferência persistente após reload e layout mobile. Telas autenticadas ainda requerem inspeção visual com sessão local. Turbopack falhou neste ambiente Windows ao iniciar subprocesso do PostCSS; Webpack compilou e gerou todas as rotas sem erro. Nenhuma alteração em actions, DAL, schema ou migrations.
