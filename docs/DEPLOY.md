# Deploy do Portal EJMC — Vercel + Supabase

Guia passo a passo para colocar o Portal no ar.

---

## Pré-requisitos

- Conta no [GitHub](https://github.com) (para hospedar o repositório)
- Conta no [Vercel](https://vercel.com) (deploy gratuito)
- Conta no [Supabase](https://supabase.com) (banco PostgreSQL gratuito)
- (Opcional) Conta no [Resend](https://resend.com) (emails transacionais)
- (Opcional) Google Cloud Console configurado (OAuth + Calendar)

---

## Passo 1: Criar o banco de dados no Supabase

1. Acesse [supabase.com](https://supabase.com) e crie uma conta
2. Clique em **"New Project"**
3. Preencha:
   - **Name**: `portal-ejmc`
   - **Database Password**: anote essa senha (vai precisar depois)
   - **Region**: escolha a mais próxima (ex: São Paulo se disponível, ou East US)
4. Aguarde a criação (1-2 minutos)
5. Após criado, vá em **Settings → Database**
6. Copie a **Connection String** no formato:

   ```
   postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true
   ```

   > ⚠️ Substitua `[PASSWORD]` pela senha que você definiu no passo 3

7. Copie também a **Direct connection** (para migrations):
   ```
   postgresql://postgres.[ref]:[PASSWORD]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```

---

## Passo 2: Rodar as migrations no banco

No terminal local, com a connection string do Supabase:

```bash
# Defina a variável de ambiente temporariamente
# Windows (PowerShell):
$env:DATABASE_URL="postgresql://postgres.XXXX:SENHA@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

# Ou crie/edite o arquivo .env.local com:
# DATABASE_URL="sua-connection-string-direct-aqui"

# Gerar o client Prisma
npx prisma generate

# Aplicar as migrations no banco de produção
npx prisma migrate deploy

# Rodar o seed (admin padrão + dados iniciais)
npx prisma db seed
```

> O seed cria:
>
> - 1 usuário Admin (email: `admin@ejmc.com.br`, senha: `Admin123!`)
> - KPIs pré-definidos
> - Configuração de pontos por infração
> - 7 computadores para reserva

---

## Passo 3: Subir o repositório para o GitHub

```bash
# Se ainda não tem remote configurado:
git remote add origin https://github.com/SEU-USUARIO/portal-ejmc.git

# Push para o GitHub
git push -u origin main
```

---

## Passo 4: Criar o projeto na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login com GitHub
2. Clique em **"Add New..." → "Project"**
3. Selecione o repositório `portal-ejmc`
4. A Vercel detecta automaticamente que é Next.js
5. **Antes de clicar Deploy**, configure as variáveis de ambiente (próximo passo)

---

## Passo 5: Configurar variáveis de ambiente na Vercel

No painel do projeto Vercel, vá em **Settings → Environment Variables** e adicione:

| Variável                     | Valor                                                 |     Obrigatória      |
| ---------------------------- | ----------------------------------------------------- | :------------------: |
| `DATABASE_URL`               | Connection string do Supabase (com `?pgbouncer=true`) |          ✅          |
| `AUTH_SECRET`                | Gerar com `openssl rand -base64 32`                   |          ✅          |
| `NEXTAUTH_SECRET`            | Mesmo valor do `AUTH_SECRET`                          |          ✅          |
| `NEXTAUTH_URL`               | `https://seu-projeto.vercel.app` (URL do deploy)      |          ✅          |
| `APP_BASE_URL`               | Mesmo que `NEXTAUTH_URL`                              |          ✅          |
| `GOOGLE_CLIENT_ID`           | ID do OAuth (Google Cloud Console)                    | ⚠️ Para login Google |
| `GOOGLE_CLIENT_SECRET`       | Secret do OAuth                                       | ⚠️ Para login Google |
| `RESEND_API_KEY`             | API key do Resend                                     |    ⚠️ Para emails    |
| `EMAIL_FROM`                 | `EJMC Portal <no-reply@seudominio.com>`               |    ⚠️ Para emails    |
| `GOOGLE_CALENDAR_ID`         | ID do calendário compartilhado                        |     ❌ Opcional      |
| `GOOGLE_SERVICE_ACCOUNT_KEY` | JSON da service account                               |     ❌ Opcional      |

### Como gerar o AUTH_SECRET:

```bash
# No terminal:
openssl rand -base64 32
# Copie o resultado e cole na Vercel
```

Se não tiver `openssl`, use: https://generate-secret.vercel.app/32

---

## Passo 6: Deploy!

1. Volte à página de import do projeto na Vercel
2. Com as variáveis configuradas, clique em **"Deploy"**
3. Aguarde o build (2-3 minutos)
4. Após sucesso, acesse a URL fornecida (ex: `https://portal-ejmc.vercel.app`)

---

## Passo 7: Configurar Google OAuth (para login com Google)

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto ou selecione existente
3. Vá em **APIs & Services → Credentials**
4. Clique **"Create Credentials" → "OAuth 2.0 Client ID"**
5. Configure:
   - **Application type**: Web application
   - **Authorized JavaScript origins**: `https://seu-projeto.vercel.app`
   - **Authorized redirect URIs**: `https://seu-projeto.vercel.app/api/auth/callback/google`
6. Copie o Client ID e Client Secret para as variáveis na Vercel
7. Redeploy (a Vercel faz automaticamente ao salvar variáveis)

---

## Passo 8: Primeiro acesso

1. Acesse `https://seu-projeto.vercel.app/login`
2. Faça login com as credenciais do admin criado no seed:
   - **Email**: `admin@ejmc.com.br`
   - **Senha**: `Admin123!`
3. Vá em **Admin** e altere a senha do admin
4. Crie contas para os membros ou deixe que se cadastrem

---

## Troubleshooting

### Build falha com erro de Prisma

- Verifique se `DATABASE_URL` está configurada corretamente na Vercel
- O formato deve incluir `?pgbouncer=true` para Supabase com connection pooling

### Build falha com `P3005` (The database schema is not empty)

- O banco não tem histórico de migrações. Siga a seção "Baseline" em "Migrações do banco".

### Erro "NEXTAUTH_URL must be set"

- Adicione `NEXTAUTH_URL` com a URL completa do deploy (com https://)

### Login Google não funciona

- Verifique se as redirect URIs no Google Console incluem a URL da Vercel
- O formato deve ser: `https://seu-dominio.vercel.app/api/auth/callback/google`

### Emails não são enviados

- Verifique se `RESEND_API_KEY` está configurada
- O domínio do remetente (`EMAIL_FROM`) deve estar verificado no Resend
- Em ambiente de teste, o Resend aceita envio apenas para o email da conta

### Banco não conecta

- Supabase: use a connection string com pooler (porta 6543) para a aplicação
- Use a connection string direta (porta 5432) apenas para migrations

---

## Migrações do banco

O build (`npm run build`) roda `prisma generate && prisma migrate deploy && next build`. O `migrate deploy` aplica, no banco configurado, as migrações de `prisma/migrations/` que ainda não foram aplicadas. Ele não compara o schema com o banco nem apaga nada por conta própria: executa só o SQL das migrações pendentes. Se uma migração falhar, o build falha e o site continua na versão anterior.

### Como mudar o schema

1. Edite `prisma/schema.prisma`.
2. Rode `npx prisma migrate dev --name <nome>` apontando para um banco de **desenvolvimento** (nunca o de produção).
3. Revise o SQL gerado em `prisma/migrations/<data>_<nome>/migration.sql`, principalmente `DROP` e `ALTER ... DROP COLUMN`.
4. Commite a pasta da migração junto com o schema. O próximo deploy aplica a migração.

Não use `prisma db push` em banco compartilhado ou de produção.

### Conferir o estado do banco (só leitura)

```bash
npm run db:status
```

Mostra quais migrações estão aplicadas e quais estão pendentes no banco de `DATABASE_URL` (ou `DIRECT_URL`).

### Baseline: banco que foi criado ou alterado com `db push`

Antes desta mudança, o build usava `prisma db push`. Se o banco não tiver a tabela de histórico `_prisma_migrations`, o `migrate deploy` falha com o erro `P3005` ("The database schema is not empty"). Nesse caso, é preciso dizer uma única vez ao Prisma que as migrações existentes já estão aplicadas. Confirme antes que o banco está igual ao `schema.prisma`:

```bash
# Deve imprimir "No difference detected"
npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma
```

Depois marque cada migração como aplicada (só grava no histórico, não altera tabelas):

```bash
npx prisma migrate resolve --applied 20260607202623_init
npx prisma migrate resolve --applied 20260609180517_add_album_member
npx prisma migrate resolve --applied 20260609195114_add_album_order
npx prisma migrate resolve --applied 20260610231933_add_highlights
npx prisma migrate resolve --applied 20260612000000_redesign_project
```

Se o banco já tiver `_prisma_migrations` com as quatro primeiras, não é preciso baseline: a migração `20260612000000_redesign_project` é idempotente e passa sem alterar nada num banco que já recebeu a mudança via `db push`.

### Conexão direta para migrações (`DIRECT_URL`)

Migrações precisam de conexão direta com o Postgres. Se `DATABASE_URL` na Vercel for a do pooler em modo transação (porta 6543, `?pgbouncer=true`), crie também a variável `DIRECT_URL` com a conexão direta ou de sessão (porta 5432). A Prisma CLI usa `DIRECT_URL` quando ela existe; a aplicação continua usando `DATABASE_URL`.

### Preview deploys

Cada branch enviada ao GitHub gera um preview na Vercel, e o build do preview também roda `migrate deploy`. Se os previews usarem o mesmo banco da produção, uma migração nova numa branch é aplicada na produção antes do merge. Para evitar isso, configure um `DATABASE_URL` separado para o ambiente Preview na Vercel.

---

## Deploy automático

Após a configuração inicial, cada `git push` na branch `main` dispara um novo deploy automaticamente na Vercel. Preview deploys são criados para branches e PRs.

---

## Domínio customizado (opcional)

1. Na Vercel: **Settings → Domains**
2. Adicione seu domínio (ex: `portal.ejmc.com.br`)
3. Configure o DNS conforme instruções da Vercel (CNAME ou A record)
4. Atualize `NEXTAUTH_URL` e `APP_BASE_URL` com o novo domínio
