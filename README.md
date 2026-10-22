# Chapa Sete · cardápio digital

Cardápio digital para uma hamburgueria **fictícia**, feito como projeto de portfólio da Penchel.Dev. A pessoa vê o cardápio no celular, monta a sacola e o pedido vira uma mensagem pronta no WhatsApp. O dono muda preço, foto, horário e o que esgotou por um painel, sem mexer em código.

> A loja, o endereço e os preços não existem. Fotos e vídeos foram gerados com IA.

## O que tem

- **Página da loja:** vídeo da chapa no topo, uma seção que trava na tela mostrando como o smash é feito (com vídeos curtos), cartazes dos pratos, endereço e horário.
- **Cardápio** (`#/cardapio`): abas por categoria, sacola com quantidade e observação, entrega ou retirada, troco, e a mensagem do pedido para o WhatsApp.
- **Painel do dono** (`#/admin`): liga e desliga "Tem hoje" (esgotado), edita preço, nome, descrição e foto, cria pratos e ajusta WhatsApp, taxa de entrega, endereço e horários.
- **Privacidade** (`#/privacidade`): o pedido não é guardado pelo site e não há rastreamento.

## Tecnologia

- Vite + JavaScript puro (sem framework), CSS próprio.
- Supabase: PostgreSQL com RLS, login e armazenamento das fotos.
- Hospedagem estática (Vercel), com CSP e cabeçalhos de segurança em `vercel.json`.

## Rodar no PC

```bash
npm install
npm run dev      # abre em http://localhost:5173
npm test         # testes (inclusive do banco, num PostgreSQL embutido)
npm run build    # versão final em dist/
```

Sem o arquivo `.env`, o site funciona no **modo demonstração**: usa os dados de exemplo e o painel entra sem senha, salvando as mudanças só no navegador de quem testa. É assim que ele fica publicado como portfólio.

## Ligar ao Supabase (dados reais)

1. Crie um projeto em [supabase.com](https://supabase.com) (plano gratuito).
2. No **SQL Editor**, rode, nesta ordem, os arquivos de `supabase/migrations/`:
   - `001_cardapio.sql`: tabelas, validações e regras de acesso (RLS);
   - `002_storage.sql`: bucket `menu-images` para as fotos;
   - `003_seed.sql`: dados iniciais. Rode só na primeira vez, porque ele volta os preços aos valores de exemplo.
3. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**. Ninguém se cadastra pelo site.
4. Em **Authentication → Users → Add user**, crie a conta do dono (e-mail e senha forte).
5. No SQL Editor, dê o acesso de admin a essa conta:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'email-do-dono@exemplo.com';
   ```
6. Copie `.env.example` para `.env` e preencha com a **Project URL** e a chave **anon / publishable** (Project Settings → API). Nunca use a `service_role`.
7. Na Vercel, cadastre as mesmas duas variáveis em **Settings → Environment Variables** e publique de novo.

### Quem pode o quê (RLS)

| Quem | Lê | Altera |
|---|---|---|
| Visitante | loja, categorias e pratos ativos | nada |
| Conta logada sem admin | o mesmo que o visitante | nada |
| Admin (linha em `admins`) | tudo, inclusive pratos fora do cardápio | loja, categorias, pratos e fotos |

Ninguém vira admin pelo site: a tabela `admins` não tem regra de escrita. Esconder telas no painel é só conforto; quem barra de verdade é o banco. Os testes em `tests/database.test.js` conferem isso rodando as migrations reais.

## Scripts de mídia

As fotos e vídeos originais (150 MB) ficam em `imagens-ia/`, fora do Git. As versões otimizadas que o site usa estão em `public/`.

```bash
npm run imagens  # PNG → WebP em dois tamanhos
npm run videos   # recorta, fecha o loop sem "pulo", comprime e gera o pôster
npm run seed     # gera 003_seed.sql a partir de src/data/demo-menu.js
```

## Qualidade

- Lighthouse no celular (rede e processador lentos simulados): 98 a 100 em Desempenho, Acessibilidade, Boas práticas e SEO.
- Respeita "reduzir movimento": sem vídeos e sem a trava de rolagem.
- Os vídeos têm botão de pausa, só tocam quando estão na tela e não carregam com "economia de dados" ligada.
