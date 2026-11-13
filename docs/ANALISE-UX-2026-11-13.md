# Kalyft — diagnóstico de interface e preparação comercial

Data: 13/11/2026. Análise exploratória; proposta de direção, ainda não aprovada.

## Escopo e limites

Inspeção do site publicado com sessão existente: Hoje, Comida, Treino, criação de plano, Progresso, Ajustes, adicionar alimento, registro com IA, Meta e plano, resumo semanal e cadastro. Inspeção visual em desktop e viewport mobile de 390 × 844. Leitura da estrutura de rotas, componentes compartilhados, estilos, marca, manifesto e trechos dos fluxos secundários de receitas, fotos, autenticação, exercícios e treino.

Não foram enviados formulários, alterados registros, executadas gerações de IA ou criadas contas. Não é certificação funcional, auditoria de segurança, avaliação clínica dos cálculos ou teste completo de acessibilidade. Estados com dados abundantes, treino em andamento, câmera, teclado virtual, Safari em aparelho real, tema claro e conexão instável ainda precisam de validação. O código local pode divergir da publicação.

## Diagnóstico geral

O produto já reúne alimentação, treino e acompanhamento corporal. A apresentação tem consistência básica, mas ainda reflete um app pessoal: formulários extensos, muitos textos explicativos, atalhos importantes pouco visíveis e decisões específicas do dono. O maior ganho virá de reorganizar prioridades e estados, além de redesenhar a marca.

### O que preservar

- Cinco destinos principais com rótulos, seleção ativa e navegação persistente.
- Metas e resultados de IA passam por confirmação do usuário.
- Busca, recentes, receitas, medidas caseiras e cadastro de alimentos dão profundidade ao diário.
- Cores semânticas centralizadas; componentes de formulário reutilizados; foco visível; diversos controles com tamanho adequado para toque.
- Estados vazios explícitos e distinção entre estimativa e registro.
- Estrutura de identidade instalável já presente no manifesto.

### Achados por área

| Área | Evidência observada | Direção recomendada |
|---|---|---|
| Marca | Anilha vermelha/dourada com relevos e brilho; logotipo tipográfico usa outra linguagem | Símbolo simples, reconhecível em tamanho pequeno, acompanhado por logotipo e versões monocromáticas |
| Desktop | Layout global limitado a `max-w-lg`, mantendo coluna estreita e navegação inferior | Navegação lateral e conteúdo em duas colunas onde fizer sentido; formulários continuam com largura de leitura limitada |
| Hoje | Resumo de calorias seguido de explicação, proteína/água, treino e corpo em sequência longa | Visão diária compacta com calorias, macros, água e treino; ações rápidas com prioridade clara |
| Comida | Resumo nutricional e água precedem as refeições | Reduzir altura do resumo; destacar adicionar refeição; água compacta ou acessível também em Hoje |
| Adicionar alimento | IA e código de barras ficam depois da lista de recentes | Busca e modos de entrada disponíveis no topo; recentes abaixo |
| Registro por IA | Link de entrada diz “escrevendo”, embora o destino ofereça foto; explicações ocupam grande parte da tela | Corrigir descoberta de foto; fluxo entrada → revisão → confirmação; resumo claro de privacidade com detalhes acessíveis antes do envio |
| Treino | Estado vazio explica cadastro manual; criação/importação com IA surge na próxima tela | Apresentar caminhos manual, importar e assistido de modo compreensível, sem obrigar o usuário a conhecer a estrutura interna |
| Plano manual | Séries iniciais, semanas e séries posteriores aparecem já na criação | Configuração essencial primeiro; progressão/readaptação como opção avançada |
| Progresso | Três atalhos grandes aparecem antes dos dados de peso e gráficos | Evolução e período primeiro; peso, medidas, fotos e relatórios como subdivisões |
| Meta e plano | Fórmulas, avisos, escolhas, projeções e configurações compartilham uma página longa | Separar visão da meta, edição guiada e explicações de cálculo |
| Confiança dos dados | Comparação “atrás do plano” aparece mesmo com pesagem antiga; resumo exibe tendência junto a zero pesagens da semana | Mostrar data de atualização e insuficiência de dados antes de classificar desempenho |
| Resumo semanal | Três avisos extensos precedem os resultados | Um estado contextual de dados insuficientes, com ação para começar; detalhes sem repetição |
| Ajustes | Perfil, metas, integração e administração compartilham página | Agrupar Conta, Preferências, Integrações e Ajuda; administração em área própria |
| Aplicação semanal | Recurso específico aparece em Progresso | Tornar opcional conforme público e necessidade; não presumir uso por todos |
| Passos | Integração depende de chave e automação no Atalhos | Área avançada, tutorial guiado e limitações claras; não apresentar como sincronização automática universal |
| Cadastro | Aprovação manual e espera antes do primeiro uso | Manter como beta fechado ou redesenhar entrada para autosserviço quando abrir vendas |
| Site público | Rota raiz redireciona ao app | Criar apresentação do produto, benefícios, demonstração real, preços e entrada |

## Ícones e sistema visual

Os ícones atuais da barra são caminhos SVG desenhados no projeto. SVG é um formato profissional; o problema é a ausência de uma família estabelecida e algumas escolhas semânticas, como o sinal de mais para “Hoje”.

Sugestão: adotar uma única família, como Lucide, com tamanhos, espessura, alinhamento e estados consistentes. Usar ícone de início para Hoje, alimentação para Comida, halter para Treino, gráfico para Progresso e controles/engrenagem para Ajustes. Remover caracteres de texto usados como substitutos de ícones dos componentes, quando pertinente.

Referências: https://lucide.dev/guide/ e https://lucide.dev/license . A identidade da marca deve ter desenho próprio, separado da biblioteca utilitária.

Definir tokens de fundo, superfície, texto, borda, destaque e estados; escala tipográfica; espaçamento; raios; botões; campos; cartões; listas; abas; diálogos; notificações; gráficos; estados vazio, carregando, erro, sucesso e offline. Os temas claro e escuro precisam de revisão própria. Hoje o tema acompanha o sistema; propor preferência Claro/Escuro/Sistema.

## Três direções a discutir

1. **Fitness contemporâneo e acolhedor — recomendação inicial.** Neutros, superfície clara e escura bem definidas, um destaque verde ou teal, tipografia legível e marca geométrica. Equilibra alimentação e treino. Precisa de símbolo e detalhes próprios para não parecer genérico.
2. **Performance esportiva.** Grafite, coral ou laranja, títulos mais fortes e foco em treino. Tem mais energia, mas pode intimidar iniciantes e deixar nutrição em segundo plano.
3. **Bem-estar editorial.** Branco quente, verde profundo, composição tranquila e tipografia mais suave. Aproxima rotina e cuidado; pode comunicar menos intensidade para quem busca musculação.

As cores são hipóteses de direção, não uma paleta aprovada. A decisão depende do público inicial e da promessa principal.

## Preparação para venda

Não identifiquei nas rotas e interfaces examinadas uma experiência comercial completa de preços, assinatura, cobrança, cancelamento, ajuda e gestão de dados pelo usuário. Isso deve compor uma frente própria de produto, além do redesign.

- Definir cliente inicial, benefício central, funcionalidades do plano e limites de IA.
- Criar apresentação pública e onboarding que leve ao primeiro registro útil.
- Prever conta, assinatura, suporte, documentos de privacidade/termos e controles de dados, com revisão especializada quando necessária.
- Diferenciar estado vazio, dia sem registro e valor real igual a zero.
- Revisar linguagem de desempenho para não apresentar conclusão atual com dados antigos.
- Validar instalação e uso real no iPhone/Android; manifesto sozinho não comprova funcionamento offline.
- Medir tempo até primeiro registro e facilidade das tarefas frequentes, além de preferência estética.

## Sequência proposta

1. Definir público e posicionamento com o dono.
2. Comparar duas ou três direções de marca e interface.
3. Aprovar símbolo, logotipo, paleta, tipografia e ícones.
4. Prototipar Hoje e registrar alimentação em mobile, com versão desktop.
5. Aplicar o sistema aos demais módulos, preservando as regras funcionais.
6. Projetar entrada comercial, conta e assinatura como escopo separado.
7. Validar tarefas completas, acessibilidade, temas, estados e aparelhos reais antes da publicação.

## Próxima decisão

Quem será o primeiro cliente pagante: pessoa buscando emagrecimento e rotina alimentar, praticante de musculação que quer unir treino e dieta, ou profissional que acompanha clientes?
