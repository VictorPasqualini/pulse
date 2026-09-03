# Pulse

Um painel financeiro que lê a sua planilha de entradas e saídas — a que já existe,
sem reformatar nada — e transforma cada linha nova em gráfico na hora.

A planilha é a única fonte de verdade. Não há banco de dados: você adiciona uma
linha no OneDrive, clica em **Atualizar** e o painel reflete a mudança.

## A regra que define o produto

Investimento não é gasto e rendimento não é receita.

Na planilha, um aporte aparece como **saída** (o dinheiro sai da conta) e um
rendimento aparece como **entrada** (o dinheiro chega). Contabilmente está certo,
mas somar essas linhas ao fluxo de caixa infla despesa e receita ao mesmo tempo e
destrói qualquer noção de quanto você realmente gasta e poupa.

Por isso o Pulse classifica cada lançamento em cinco baldes:

| Balde | Entra no fluxo de caixa? | Exemplo |
| --- | --- | --- |
| `income` | sim, como entrada | salário, freela |
| `expense` | sim, como saída | mercado, aluguel |
| `invest_contrib` | não | aporte no Tesouro Selic |
| `invest_withdraw` | não | resgate de CDB |
| `invest_yield` | não | dividendo, juros, marcação a mercado |

Só `income` e `expense` alimentam entradas, saídas e saldo. Os três de
investimento vivem na tela **Investimentos**, onde são o assunto principal.

A classificação sai de `src/lib/classify.ts`: uma coluna de ativo preenchida é o
sinal mais forte; na falta dela, listas de termos (ajustáveis em
**/configuracao**) são casadas contra segmento, descrição, ativo, meio de
pagamento e conta.

## Telas

| Rota | O que mostra |
| --- | --- |
| `/` | Painel do mês: saldo, entradas, saídas, aportes; entradas × saídas por mês; gastos por segmento; gastos por semana; resultado mensal; cartão de crédito; maiores saídas |
| `/investimentos` | Posição acumulada, total aportado, rendimento acumulado, retorno sobre o aporte, ganho/perda por mês, melhor e pior mês, e a carteira por ativo |
| `/cartoes` | Fatura do mês, participação nas saídas, maior cartão, ticket médio, gasto por cartão e por segmento, e a fatura mês a mês |
| `/lancamentos` | A tabela completa, filtrável por mês, segmento, tipo e busca livre — e a lista de linhas que o leitor não conseguiu interpretar |
| `/configuracao` | Link da planilha, aba, linha do cabeçalho, mapeamento de colunas e regras de classificação |

## Como ligar na sua planilha

1. No OneDrive, **Compartilhar → Qualquer pessoa com o link → Pode visualizar** e
   copie o link.
2. Abra `/configuracao`, cole o link em **Planilha** e clique em **Salvar e ler**.
3. Confira o mapeamento em **Colunas**. O Pulse chuta cada coluna por palavra-chave
   e mostra as primeiras linhas para você conferir; qualquer chute errado é
   corrigido no select ao lado.

Não tem planilha ainda? **Baixar planilha modelo** (`/api/modelo`) gera um CSV com
as colunas esperadas e exemplos — inclusive de aporte e rendimento, para deixar a
regra acima explícita.

Alternativa ao passo 2: exportar `PULSE_SOURCE_URL` no ambiente. Ele preenche o
link quando ainda não há um salvo.

### Colunas reconhecidas

`date`, `description`, `amount` (ou o par `amountIn`/`amountOut`), `flow`,
`segment`, `account`, `method`, `card`, `asset`, `installment`, `note`.

Só `date`, algum valor e `description` são realmente necessários. O resto melhora
o que o painel consegue mostrar. Formatos brasileiros — `dd/mm/aaaa`,
`R$ 1.234,56`, parênteses para negativo — são lidos sem configuração, e `.xlsx`,
`.csv` e `.tsv` funcionam do mesmo jeito.

## Rodando

```bash
npm install
npm run dev        # http://localhost:3000
```

| Script | O que faz |
| --- | --- |
| `npm run dev` | servidor de desenvolvimento |
| `npm run build` | build de produção |
| `npm start` | serve o build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run check` | typecheck + build |

## Como está montado

Next.js 16 (App Router) + React 19 + TypeScript strict + Tailwind CSS v4. Sem
banco, sem ORM, sem biblioteca de gráficos.

```
src/lib/          leitura e domínio
  onedrive.ts     converte um link de compartilhamento em URL de download
  source.ts       busca o arquivo, com guarda de SSRF e cache de 60 s
  xlsx/reader.ts  leitor de .xlsx próprio, sobre fflate
  csv.ts          CSV/TSV com detecção de separador e BOM
  mapping.ts      adivinha cabeçalho e colunas
  normalize.ts    linha crua → Transaction, registrando o que não deu para ler
  classify.ts     os cinco baldes
  metrics.ts      agregações por mês, segmento, semana, cartão e ativo
  palette.ts      a paleta, emitida como custom properties

src/components/
  charts/         SVG escrito à mão sobre chartkit.tsx (eixos, grade, tooltip)
  chrome/         navegação, seletor de mês, tema, filtros
  brand/          a logo
```

Os gráficos não leem hexadecimal: a cor vem sempre de `var(--series-N)`,
`var(--flow-in|out|invest)` e `var(--seq-N)`, então tema claro e escuro nunca
divergem e nenhum componente consegue escapar da paleta validada.

O único estado persistido é `.pulse/config.json` (ignorado pelo git): link, aba,
linha do cabeçalho, mapeamento e regras. Apagar o arquivo devolve o app ao estado
inicial.

## Licença

MIT — veja [LICENSE](LICENSE).
