# Protótipo independente — Hoje

Abra `hoje.html` no navegador. O arquivo usa os SVGs aprovados em `../marca`; mantenha as duas pastas juntas.

## O que revisar

- Identidade vermelha e logo C em fundo claro e escuro.
- Sistema, Claro e Escuro no seletor do cabeçalho. Sistema usa a preferência do dispositivo em tempo real; a escolha manual fica salva neste navegador quando o armazenamento local estiver disponível.
- Desktop com menu lateral e duas colunas; celular com navegação inferior e uma coluna.
- Calorias, nutrientes, alimentação, água, treino e evolução.
- Botões de água atualizam apenas a demonstração e permitem desfazer.
- Demais ações exibem mensagem indicando uma próxima etapa. Não existem chamadas ao banco ou à IA.

Todos os registros e números são fictícios; não são os dados reais da conta. A opção de tema utiliza uma chave própria, `kalyft-prototipo-tema`.

Os ícones são da biblioteca Lucide, versão 0.468.0, carregada do unpkg. É necessária conexão para carregar os ícones; a implementação final deve incorporar a dependência ao projeto. Logo, estilos e comportamento demonstrativo são locais.

## Verificação desta entrega

Verificados: sintaxe do JavaScript, referências aos arquivos de marca e presença dos controles/estados de tema. A abertura no navegador conectado falhou: o servidor local não respondeu e o navegador bloqueia URLs de arquivo. Não houve inspeção visual renderizada nem teste de interação no navegador nesta etapa.

O protótipo fica em `design/prototipo` e não foi conectado às rotas Next.js, ao build ou ao deploy. A integração deve partir da versão concluída pelo outro chat e preservar as novas funções de acompanhamento.
