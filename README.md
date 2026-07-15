# Rateio Presentes

Interface web para acompanhar os rateios de presentes/despedidas (dados vindos da
planilha "Rateio Presentes" no Google Sheets, alimentada diariamente pela automação
de e-mail) e controlar quem já pagou via Pix.

## Funcionalidades

- Visualização de um rateio por vez, com navegação entre o mais recente e o mais antigo.
- Busca por nome de participante, remetente ou assunto, e filtro por status de pagamento.
- Marcar participante como pago e registrar a data do pagamento (grava direto na planilha).
- Clonar um rateio existente para criar um novo: traz os participantes, permite
  adicionar/remover pessoas, e edita percentual (%) ou valor exato (R$) por participante
  — os dois campos ficam sincronizados. Validação impede salvar se a soma dos valores
  não bater com o valor total informado.

## Configuração (nenhuma credencial fica no código)

Este projeto não versiona nenhum dado pessoal, chave de API ou ID de planilha. Tudo é
lido de variáveis de ambiente (veja `.env.example`).

### 1. Criar uma Service Account no Google Cloud

1. Acesse o [Google Cloud Console](https://console.cloud.google.com/) e crie/selecione um projeto.
2. Ative a **Google Sheets API** (APIs e serviços > Ativar APIs e serviços).
3. Vá em **IAM e administrador > Contas de serviço** e crie uma nova conta de serviço.
4. Gere uma chave JSON para essa conta de serviço (Chaves > Adicionar chave > JSON) e baixe o arquivo.

### 2. Compartilhar a planilha com a Service Account

Abra a planilha "Rateio Presentes" no Google Sheets e compartilhe (botão "Compartilhar")
com o e-mail da service account (campo `client_email` do JSON) como **Editor**.

### 3. Configurar variáveis de ambiente

Copie `.env.example` para `.env.local` (uso local) e preencha:

- `GOOGLE_SERVICE_ACCOUNT_EMAIL`: campo `client_email` do JSON.
- `GOOGLE_PRIVATE_KEY`: campo `private_key` do JSON (mantenha as quebras de linha como `\n`).
- `GOOGLE_SHEET_ID`: ID da planilha, extraído da URL
  `https://docs.google.com/spreadsheets/d/ESTE_TRECHO/edit`.
- `GOOGLE_SHEET_TAB`: nome da aba (padrão `Sheet1`).

Em produção (Vercel), configure as mesmas variáveis em
**Project Settings > Environment Variables** — nunca em arquivos versionados.

### 4. Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`.

## Estrutura

- `lib/sheets.ts` — acesso à API do Google Sheets (leitura agrupada por rateio, escrita de status de pagamento, criação de novos rateios).
- `app/api/rateios/route.ts` — lista rateios (GET) e cria um novo rateio (POST).
- `app/api/participante/route.ts` — atualiza status/data de pagamento de um participante (PATCH).
- `app/page.tsx` — tela principal (navegação, busca, filtro, marcação de pagamento).
- `app/novo/page.tsx` — tela de criação/clonagem de rateio com split percentual/valor.
