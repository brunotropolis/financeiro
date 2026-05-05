# Análise de extratos — abril/2026

Análise dos 6 PDFs enviados pelo Bruno em 05/05/2026 pra calibrar o parser de importação.

## PDFs recebidos

| # | Arquivo | Conta | CNPJ/Conta | Período |
|---|---|---|---|---|
| 1 | Transações_cartões_01-04-2026_06-05-2026.pdf | Conta Simples — Cartões pré-pagos | MRN Serv 62.533.201/0001-01 / Conta 155191876 | 01/04 a 05/05 |
| 2 | Extrato_Conta_Simples_20260505121532.pdf | Conta Simples — Conta Corrente | MRN Serv / Conta 155191876 | 01/04 a 05/05 |
| 3 | ComprovanteBB - 2026-05-05-121203.pdf | Banco do Brasil | Manual RN / Ag 9-4 Conta 481019-8 | maio 2026 |
| 4 | ComprovanteBB - 2026-05-05-121336.pdf | Banco do Brasil | Manual RN / Ag 9-4 Conta 481019-8 | abril 2026 |
| 5 | Comp-05052026152737.pdf | Unicred Dream Baby | Dream Baby / Conta 169560 | 06/04 a 05/05 |
| 6 | Comp-05052026120736.pdf | Unicred Manual do Recém-Nascido | Manual RN / Conta 94005 | 06/04 a 05/05 |

## Estruturas por banco

### Conta Simples — Cartões (pré-pago)
Layout: tabela com **Data | Tipo + cartão (****XXXX) | Estabelecimento | Entradas | Saídas**.
- 5 cartões diferentes (****7420, ****2488, ****3744, ****4945, etc) — todos de MRN Serviços
- Entradas = "Inserido na conta SCALE (aumento de limite)" → recargas vindas da Conta Simples corrente
- IOF lançado separado da compra internacional (mesmo dia, valor pequeno)

### Conta Simples — Corrente
Conta-trânsito. Padrão sempre par:
- "Recebimento via PIX de DREAM BABY/MANUAL DO RECEMNASCIDO" (entrada)
- "Transferência de limite" (saída pro cartão)
Saldo sempre R$ 0 ou negativo. Excepcionalmente recebe TED/DOC da Amazon (R$ 0,01 — provavelmente teste).

### Banco do Brasil
Tabela: **Dia | Lote | Documento | Histórico (multilinha) | Valor (+/-)**.
- Inclui linhas de "Saldo do dia" (ignorar — não é transação)
- Pares "Pagto cartão crédito + Estorno de Débito" mesmo valor mesmo dia → ignorar (tentativa de débito automático que retornou)
- Outros tipos: I.O.F., Tarifa Pacote Serviços, Cobrança Juros, Pix-Enviado, Pix-Recebido, ORPAG ORIGEM EXTERIOR (recebimento internacional), Produtos Brasilcap, PGT CARTAO

### Unicred (Dream Baby + Manual RN)
Mesmo formato em ambos. Texto contínuo: **DATA | ID DOC | HISTÓRICO | LANÇAMENTOS R$ | SALDO R$**.
Tipos:
- DEB PIX / PGTO PIX (saída)
- CRED PIX (entrada)
- LIQ TIT - IB(<descricao>) — boletos (aluguel, copel, etc)
- 94005 / 169560 / 3066444 TRANSF TEF PIX — TED entre contas (cross-references entre as próprias contas)
- Convênio ARREC CONVENIO(<empresa>) — concessionárias (sanepar)
- 4201193100 DEBITO DE COBRANCA(cartao) — pagamento fatura Unicred
- 2024261027 LIQ PARCELA EMPR — empréstimo
- 0 PJ CONTA PJ 1 — tarifa mensal (R$ 51,50)
- 0 JUROS CHEQ ESPECIAL — juros cheque especial
- RECEB TED D STR(<empresa>) — recebimento TED (Amazon, etc)

## Mapa de fluxo do dinheiro (abril/2026)

```
┌─────────────────────┐
│  Greenn webhook     │ → CRED PIX(GREENN) na Unicred Dream Baby (5x no mês: 3.992,82 + 1.944,89 + 5.262,52 + 4.394,79 + 3.529,17 + 4.378,20 = R$ 23.502,39 em maio)
└──────────┬──────────┘
           ↓
┌─────────────────────┐         ┌──────────────────────────┐
│ Unicred Dream Baby  │ ────→   │ Unicred Manual RN        │ (TRANSF TEF — várias)
│ (recebe Greenn)     │         │ (paga aluguel, mercado,  │
└─────────────────────┘         │  uber, escola, etc)      │
                                │                          │
                                │ Recebe Amazon TED:       │
                                │ R$ 7.307,31 (29/04)      │
                                │ R$ 64,14 (29/04)         │
                                └────────┬─────────────────┘
                                         ↓
                                ┌──────────────────────────┐
                                │ Conta Simples Corrente   │ (transito - PIX entra de Manual RN/Dream Baby
                                │ (sempre saldo ~R$ 0)     │  e sai como "Transferência de limite")
                                └────────┬─────────────────┘
                                         ↓
                                ┌──────────────────────────┐
                                │ Conta Simples Cartões    │
                                │ (Facebook ads, Anthropic,│
                                │  ManyChat, Google, etc)  │
                                └──────────────────────────┘
```

## Insights pra modelagem do sistema

### 1. Transferências internas DOMINAM o volume
Maior parte do volume é transferência entre as próprias contas do Bruno. Pra dashboard de despesa real **não posso somar entradas + saídas** ingenuamente — preciso identificar e zerar transferências internas.

**Lista das contas que devem ser flagadas como "internas" entre si:**
- Manual Recém-Nascido (Unicred + BB)
- Dream Baby (Unicred + Inter)
- MRN Serviços Digitais (Conta Simples corrente + cartões + Inter)
- Bruno Sampaio (PF) — também aparece em transferências
- Day Anjos (PF) — também aparece

Identificação automática: razão social ou nome PF que match com `entidades.razao_social` ou parte do nome.

### 2. Greenn é a maior fonte de receita
6 recebimentos em 1 mês na Unicred Dream Baby = R$ 23.502,39. Sprint 5 prevê integração webhook automática — esses recebimentos devem ser **linkados às receitas_brutas existentes**.

### 3. Amazon afiliados também já aparece
Unicred Manual RN: R$ 7.307,31 + R$ 64,14 (29/04) via "RECEB TED D STR(AMAZON SERVICOS DE V)". Sprint 5 (Amazon afiliados) precisa criar receitas_brutas com origem=amazon_aff.

### 4. PayPal cross-reference
BB Manual RN: R$ 146,12 via "Pix - Recebido" de "10878448000166 PAYPAL DO B" → Conta PayPal Manual RN tá enviando pro BB.

### 5. ORPAG (recebimento internacional)
BB Manual RN 22/04: R$ 1.308,75 "ORPAG ORIGEM EXTERIOR" → provavelmente AdSense/afiliado internacional. Nesse caso veio R$ 4,97 de IOF junto.

### 6. Despesas pessoais misturadas com PJ
Várias despesas no Unicred Manual RN são pessoais (mercado, uber, escola, farmácia, restaurante). Não parece ter conta PF separada usada — Bruno usa contas PJ pra tudo. **Sistema precisa categorizar individualmente por categoria, não inferir de entidade**.

### 7. Pagamento dos cartões
- **Conta Simples cartão**: pagos via "Transferência de limite" (recargas) — pré-pago
- **Cartão Unicred Manual RN**: "DEBITO DE COBRANCA(cartao)" R$ 1.971,10 (09/04) na conta Unicred
- **Cartão BB Empresarial Visa**: "Pagto cartão crédito EMPRESARIAL VISA" — várias tentativas com estorno (cheque especial), efetivado dia 22/04 R$ 126,10 (provavelmente parcial). Lançamento futuro: R$ 666,34 em 11/05.

### 8. Aluguel + Copel = boletos via Internet Banking (Unicred)
- Aluguel: R$ 4.075,77 (10/04) — LIQ TIT - IB(aluguel)
- Copel: R$ 713,18 (06/04) — LIQ TIT - IB(copel)
- Sanepar: R$ 390,79 (07/04) — Convênio ARREC

### 9. Empréstimo na Unicred Manual RN
"2024261027 LIQ PARCELA EMPR" R$ 3.410,26 em 27/04. Recorrência mensal provavelmente — cadastrar como recorrência ativa.

### 10. Tarifas e taxas a categorizar
- Unicred: PJ CONTA PJ 1 R$ 51,50 (mensal)
- BB: Tarifa Pacote de Serviços R$ 81,40 (mensal)
- Cobrança IOF (BB)
- Juros Cheque Especial (BB e Unicred)

## Categorização sugerida (regras)

### Identificação automática por descrição

| Padrão na descrição | Categoria |
|---|---|
| FACEBK, FACEBOOK | Anúncio |
| MANYCHAT, GPTMAKER, UNNICHAT, VTURB, PANDA VIDEO | Ferramentas |
| ANTHROPIC, LOVABLE | Ferramentas |
| GOOGLE WORKSPACE, APPLECOMBILL, APPLE.COM/BILL | Ferramentas |
| EBN*HOSTINGER, TURBO CLOUD, CADEMI | Ferramentas |
| MERCADO BELLA VILLA, J BATTISTI, CONDOR, IRMAOS MUFFATO, PAULIN COMERCIO DE FRIOS, FPEP, CIA BEAL ALIMENTOS, SUB BRIGADEIRO | Mercado |
| IFOODCOM, PASCAL RESTAURANTE, PANIFICADORA PANICIELLO, TORO RESTAURANTES | Lazer (Refeição) |
| UBER DO BRASIL | Transporte |
| FARMACIA E DROGARIA NISSEI | Saúde |
| KC CLINICA MEDICA | Saúde |
| ANGELA C S VAZ PODOLOGIA | Saúde |
| BALAROTI, CONDOR SUPER CENTER | Casa/Construção |
| HIPERZOO PET SHOP | Pet |
| ASSOCIACAO FRANCISCANA DE ENSINO | Educação |
| LIQ TIT - IB(aluguel) | Aluguel/Infra |
| Convênio ARREC CONVENIO(sanepar) | Aluguel/Infra (água) |
| LIQ TIT - IB(copel) | Aluguel/Infra (luz) |
| TELEFONICA BRASIL | Aluguel/Infra (telefonia) |
| 2024261027 LIQ PARCELA EMPR | Despesa Financeira (empréstimo) |
| Cobrança de I.O.F. | Tributos |
| Tarifa Pacote de Serviços, PJ CONTA PJ 1 | Despesa bancária |
| Cobrança de Juros, JUROS CHEQ ESPECIAL | Despesa Financeira |

### Identificação automática de transferências internas

Se descrição match exato com:
- Manual Recém-Nascido / MANUAL RECEM NASCIDO / MANUAL DO RECEM-NASCIDO
- Dream Baby / DREAM BABY
- MRN Serviços / MRN SERVICOS DIGITAIS
- Bruno Sampaio / BRUNO SAMPAIO DE SOUZA DIAS
- Dayane / Day / DAYANE DOS ANJOS

→ Marcar como `tipo_movimentacao = transferencia` e linkar destino se possível
→ NÃO criar transação (não é despesa real)

### Identificação automática de receitas externas

| Padrão | Origem `receitas_brutas` |
|---|---|
| CRED PIX(GREENN) ou CRED RECEBIMENTO PIX(GREENN) | greenn (cross-reference com webhook) |
| RECEB TED D STR(AMAZON SERVICOS DE V) | amazon_aff |
| Pix - Recebido ... PAYPAL | paypal (via PayPal payout) |
| ORPAG ORIGEM EXTERIOR | adsense/manual (precisa contexto) |

## Recorrências candidatas a criar (baseado neste mês)

| Descrição | Valor aprox | Dia | Conta |
|---|---|---|---|
| Aluguel | 4.075,77 | 10 | Unicred Manual RN |
| Copel (luz) | 713,18 | 6 | Unicred Manual RN |
| Sanepar (água) | 390,79 | 7 | Unicred Manual RN |
| Telefonica (telefone) | 394,07 | 20 | Unicred Manual RN |
| Tarifa Unicred PJ | 51,50 | 10 | ambas Unicred |
| Tarifa BB Pacote | 81,40 | 10 | BB Manual RN |
| Empréstimo Unicred | 3.410,26 | 27 | Unicred Manual RN |
| Google Workspace | 114,32 + 194,18 | 1 | Cartão Conta Simples |
| Apple iCloud (****3744) | 19,90 + 53,90 | 1 e 9 | Cartão Conta Simples |
| ManyChat | 27,78 + 168,96 | 1 | Cartão Conta Simples (USD c/ IOF) |
| Anthropic | 51,43 | 20 | Cartão Conta Simples (USD c/ IOF) |
| Hostinger | 89,99 | 6 | Cartão Conta Simples |
| ADD-ON UNNICHAT | 79,00 | 3 | Cartão Conta Simples |
| Escola Bom Jesus | 19,80 | 4 | Unicred Manual RN |

(Faturamento Greenn e Facebook ads não são recorrências fixas — variam muito.)
