# Kalyft – Fase 12A: cadastro aberto (sem aprovação manual) – relatório de segurança (seção 11 do SEGURANCA.md)

Data: 16/11/2026. Pedido do dono: "qualquer um pode ter conta, mas toda conta que entrar eu posso ver, mas para
mexer tenho que pedir autorização". Plano aprovado ("aprovo").

## 1. O que mudou

- `registrarAcesso` grava toda conta nova como "aprovado"; uma linha "pendente" antiga vira "aprovado" no próximo
  acesso (protege a janela entre a migration e o deploy). "recusado" nunca é desfeito, exceto para o administrador
  (como antes).
- Migration 0026: padrão da coluna `acessos.status` passa a "aprovado" e as linhas "pendente" existentes viram
  "aprovado". O CHECK continua aceitando "pendente" só por compatibilidade.
- Removidos: painel "Cadastros pendentes" em Conta, a action `decidirCadastro` e `listarPendentes`. `decidirAcesso`
  fica na camada de dados (bloqueio pelo administrador), sem tela por enquanto.
- `/aguardando` agora só aparece para conta recusada ("Acesso não liberado").
- Aviso de privacidade na tela de criar conta e em Conta (para quem não é administrador): "O administrador do
  Kalyft pode ver seus registros. Para alterar qualquer coisa, ele precisa da sua autorização."

## 2. O que não mudou (conferido)

- Ver: o administrador lê contas aprovadas pelo acompanhamento (contexto vinculado à sessão, prazo de 12 h);
  fotos exigem aceite separado.
- Mexer: escrita exige concessão de edição vigente, validada no Postgres na mesma transação e auditada.
- IA continua pessoal e com limite diário por pessoa; com cadastro aberto, esse limite é a proteção de custo.
- Lembretes só vão para contas "aprovado"; conta recusada não recebe.

## 3. Testes

| Suíte | Resultado |
|---|---|
| Banco – novo `cadastro-aberto` | conta nova aprovada; pendente antiga aprovada; recusada continua bloqueada; administrador vê a conta nova e a escrita sem autorização é recusada (nada gravado) |
| Totais | unidade 587, banco 387, `tsc`, `eslint`, `next build` sem erros |

## 4. `npm audit`

Nenhuma dependência nova.

## 5. Segredos

Nenhum.

## 6. Riscos residuais

1. Qualquer pessoa com e-mail confirmado pode criar conta: o custo da IA fica limitado pelo teto diário por pessoa,
   não pelo número de contas. Se aparecer abuso, dá para bloquear a conta ("recusado") pelo banco; uma tela de
   bloqueio em Alunos é uma etapa futura.
2. Contas criadas antes desta fase não viram o aviso de privacidade no cadastro; ele aparece em Conta.

## 7. Publicação

Migration 0026 em produção antes do push (aprovado com o plano).
