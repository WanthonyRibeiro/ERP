Cronograma

App web para visualizar e gerenciar o cronograma da obra com Gantt interativo.

---

## Passo a passo para colocar no ar

### 1. Criar conta no Supabase (banco de dados)

1. Acesse https://supabase.com e crie uma conta gratuita
2. Clique em **"New Project"**, dê um nome (ex: `genova`) e escolha a região **South America (São Paulo)**
3. No menu lateral, vá em **SQL Editor**
4. Cole o conteúdo do arquivo `supabase/schema.sql` e clique em **Run**
5. Vá em **Project Settings → API** e copie:
   - **Project URL** (algo como `https://xxxx.supabase.co`)
   - **anon public** key

### 2. Configurar variáveis de ambiente

Na pasta do projeto, crie um arquivo `.env` baseado no `.env.example`:

```
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-anon-aqui
```

### 3. Instalar e rodar localmente

```bash
npm install
npm run dev
```

Abra http://localhost:5173 no navegador.

### 4. Publicar na Vercel (hospedagem gratuita)

1. Suba o projeto para um repositório no GitHub
2. Acesse https://vercel.com e faça login com sua conta GitHub
3. Clique em **"Add New Project"** e selecione o repositório
4. Em **Environment Variables**, adicione as duas variáveis do `.env`
5. Clique em **Deploy** — pronto, você terá uma URL pública!

---

## Como usar

- **Login/Cadastro**: crie uma conta com e-mail e senha
- **Nova Tarefa**: botão no topo para adicionar tarefas
- **Editar Tarefa**: clique em qualquer barra ou linha no Gantt
- **Progresso**: arraste o slider na edição ou atualize manualmente
- **Importar Excel**: importa a planilha original do cronograma
- **Exportar Excel**: baixa o cronograma atual em `.xlsx`
- **Filtros**: filtre por categoria no topo do Gantt

---

## Stack utilizada

- **Frontend**: React 18 + Vite
- **Banco de dados / Auth**: Supabase (PostgreSQL)
- **Hospedagem**: Vercel
- **Excel**: SheetJS (xlsx)
