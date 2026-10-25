# Obratrix

Plataforma SaaS para gestão de obras: equipe, planejamento, diário de obra e custos, com interface em pt-BR e suporte a múltiplas empresas.

## Requisitos

- Node.js 22 LTS
- pnpm 10
- Docker (para o Supabase local)
- Supabase CLI (`pnpm exec supabase`)

## Desenvolvimento local

```bash
cp .env.example .env.local
pnpm install
pnpm db:start
```

Copie `API_URL`, `ANON_KEY`, `SERVICE_ROLE_KEY` e `DB_URL` exibidos por `pnpm exec supabase status -o env` para `.env.local` como `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `DATABASE_URL`. Defina também `SEED_PASSWORD` com uma senha de demonstração.

```bash
pnpm db:baseline
pnpm db:reset
pnpm db:check-prefix
pnpm db:types
pnpm db:seed
pnpm dev
```

Abra <http://localhost:3000>. A conta de demonstração do diretor é `diretor@obratrix.demo`; a senha é a definida em `SEED_PASSWORD`. O seed também cria usuários demo para engenharia, encarregado e financeiro.

## Scripts

| Comando | Descrição |
| --- | --- |
| `pnpm dev` | Inicia o Next.js em modo de desenvolvimento |
| `pnpm lint` | Executa ESLint |
| `pnpm typecheck` | Executa verificação TypeScript |
| `pnpm build` | Gera a aplicação de produção |
| `pnpm db:start` / `pnpm db:stop` | Inicia/para a stack Supabase local |
| `pnpm db:reset` | Recria o banco local e aplica migrations Supabase |
| `pnpm db:push` | Aplica migrations ao projeto Supabase remoto linkado |
| `pnpm db:types` | Gera tipos TypeScript usando o schema local |
| `pnpm db:seed` | Cria dados demo idempotentes (requer service role) |
| `pnpm db:baseline` | Registra os objetos existentes do schema `public` antes das migrations |
| `pnpm db:check-prefix` | Verifica o prefixo dos objetos novos em `public` |
| `pnpm db:test-rls` | Executa os cenários automatizados de RLS |

## Banco e migrations

O Supabase é um projeto exclusivo do Obratrix. Inicialize a stack local com `supabase start`; novas alterações de schema devem ser criadas como migrations timestampadas em `supabase/migrations/`. Use `supabase db reset` para aplicar e validar localmente e `supabase db push` somente depois de linkar o projeto remoto correto.

Todos os objetos de domínio do banco usam o prefixo `obx_` (tabelas, tipos, funções, triggers, índices e policies). O prefixo mantém o schema organizado e deixa clara a propriedade dos objetos. A trigger `obx_trg_novo_usuario` cria o perfil em `obx_usuarios` após o cadastro no Supabase Auth.

Para verificar isolamento de nomes antes/depois das migrations, execute `pnpm db:baseline` antes do reset e `pnpm db:check-prefix` depois. O seed é implementado em `scripts/seed.ts` usando service role: é idempotente, cria usuários demo, empresa, centros de custo, duas obras, EAP, RDOs, ocorrências e custos de demonstração.

## Modelo de dados

- **Empresa e acesso:** `obx_empresas`, `obx_usuarios`, `obx_empresa_membros`, `obx_obra_membros`.
- **Planejamento:** `obx_obras`, `obx_centros_custo`, `obx_eap_itens`; a view `obx_vw_obra_resumo` resume orçamento, custos e avanço.
- **Campo:** `obx_rdos` e tabelas filhas de mão de obra, produção, equipamentos, materiais e ocorrências; `obx_fotos` guarda metadados do bucket privado `obx_fotos`.
- **Financeiro e rastreabilidade:** `obx_custos` e `obx_auditoria`.
- **Permissões:** RLS ativo em todas as tabelas `obx_`; as políticas respeitam perfil da empresa e vínculo por obra.

Os registros de auditoria incluem `empresa_id` para restringir leitura por diretoria; o campo não tem FK intencionalmente para preservar o histórico quando uma empresa for excluída.

## Aplicação

O frontend usa Next.js App Router (`src/`), TypeScript strict, Tailwind CSS, componentes no padrão shadcn/ui, `next-intl` sem prefixo de locale na URL e Supabase SSR/Auth. Empresa ativa e locale podem ser selecionados por cookie; os helpers de `src/lib/format.ts` recebem locale e moeda (padrão `pt-BR`/`BRL`). O manifesto PWA e ícones estão incluídos; não há service worker nem suporte offline nesta etapa.