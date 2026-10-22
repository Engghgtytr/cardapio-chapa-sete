# Etapa 1: arquitetura (prompt 01)

Projeto: **cardápio digital** da **Chapa Sete Smash Burger**, uma hamburgueria **fictícia** usada como demonstração de portfólio da Penchel.Dev.

## Contexto

| Item | Decisão |
|---|---|
| Público | Clientes da hamburgueria, quase todos no **celular**, muitos abrindo pelo QR code da mesa ou pelo link do Instagram |
| Objetivo do cliente | Ver o cardápio e **mandar o pedido pelo WhatsApp** em menos de 1 minuto |
| Objetivo do dono | Mudar preço, foto e "esgotado" **sozinho**, sem programador |
| Objetivo do portfólio | Mostrar um site comercial bonito, rápido no celular, com banco de dados e uma animação marcante |
| Loja | Uma só (sem multiempresa) |

## Categoria e formato técnico

**Categoria:** Catálogo Digital (comercial, sem pagamento online) + Landing de negócio local + painel administrativo.

**Formato:** **dinâmico com banco de dados** (Supabase). Pela regra do prompt 01: o dono cadastra e o cliente vê o que foi cadastrado, então os dados precisam ficar num servidor.

| Formato | Vantagem | Desvantagem | Decisão |
|---|---|---|---|
| Estático (pratos num arquivo JSON) | Simples, sem login | Para mudar um preço o dono precisa de um programador | ❌ |
| **Catálogo + painel + WhatsApp** | O dono edita sozinho; o pedido chega no WhatsApp que ele já usa | Precisa de login e banco | ✅ |
| E-commerce com pagamento | Pedido pago na hora | Nível 4 de segurança (pagamento), taxas, responsabilidade legal | ❌ Não fazer agora |

Tecnologias: as mesmas do StockFlow (HTML, CSS e JavaScript em módulos, Vite, Supabase, Vitest e Vercel). Aproveita o que já foi aprendido e mostra que o padrão se repete.

## Mapa de telas

```text
PÁGINA DA LOJA  #/                       (vitrine: quem vem do Instagram ou do Google)
  1. Topo: vídeo em loop (foto da capa enquanto carrega) · nome · "aberto agora" · [Ver cardápio]
  2. "Como nasce um smash": a tela trava, 4 fotos trocam e as legendas entram
  3. Destaques: 3 burgers com foto e preço · [Ver cardápio completo]
  4. Onde estamos: horário, endereço fictício, [Chamar no WhatsApp]
  5. Rodapé: "Projeto de portfólio da Penchel.Dev; loja fictícia"

CARDÁPIO  #/cardapio                     (o QR code da mesa abre direto aqui)
  · Cabeçalho compacto: logo, aberto/fechado
  · Abas de categoria fixas no topo, acompanhando a rolagem
  · Lista de pratos: foto, nome, descrição, preço, [+] ou "Esgotado"
  · Botão flutuante da sacola com quantidade e total

SACOLA  (painel que sobe de baixo, por cima do cardápio)
  · Itens com [−] quantidade [+] · observação por item ("sem cebola")
  · Nome · Retirada ou Entrega (+ endereço e taxa) · Pagamento (Pix, cartão, dinheiro + troco)
  · Total · [Enviar pedido pelo WhatsApp]

PAINEL DO DONO  #/admin                  (com login)
  · Pratos: criar, editar, foto, esgotado, ordem
  · Categorias: criar e reordenar
  · Loja: nome, WhatsApp, horários, taxa de entrega
  · QR code: gerar e imprimir
```

## Modelo de dados (Supabase)

```text
store_settings   (1 linha)  nome, whatsapp, endereço, taxa_entrega_cents, horários (json)
categories                  id, nome, posição
menu_items                  id, category_id, nome, descrição, price_cents, image_path,
                            available (esgotado ou não), active (aparece ou não), posição
admins                      user_id   → quem pode editar
Storage: bucket menu-images (fotos dos pratos, leitura pública)
```

Preços em **centavos inteiros**, como no StockFlow. O nome e o endereço do cliente **não são salvos**: vão direto na mensagem do WhatsApp.

## Funcionalidades por prioridade

**Obrigatório**
- Página da loja com vídeo e a seção que trava
- Cardápio por categorias, com foto, preço e "esgotado"
- Sacola com quantidade, observação e total calculado
- Mensagem do pedido formatada e aberta no WhatsApp
- Painel do dono: pratos, categorias, fotos e dados da loja
- Funciona bem no celular, com "reduzir movimento" e teclado

**Se der tempo**
- "Aberto agora / Fechado" automático pelo horário
- QR code por mesa (o pedido diz "Mesa 4")
- Sacola salva no navegador (não perde ao recarregar)

**Não fazer agora**
- Pagamento online
- Painel de pedidos em tempo real (os pedidos ficam no WhatsApp)
- Várias lojas, cupons, programa de fidelidade, integração com iFood

## Riscos e como evitar

| Risco | Como evitar |
|---|---|
| **O site de demonstração mandar pedido para o WhatsApp de uma pessoa real** (um número inventado pode existir) | No **modo demonstração**, o botão mostra a mensagem que chegaria à loja, em vez de abrir o WhatsApp. O envio de verdade só acontece com um número configurado pelo dono |
| Fotos pesadas deixando o cardápio lento no 4G | Converter para WebP em tamanhos diferentes (`srcset`), carregar sob demanda (`loading="lazy"`) e comprimir no navegador antes do envio pelo painel |
| Vídeo pesado no topo | Cerca de 2 MB, foto da capa enquanto carrega, sem vídeo com "economia de dados" ou "reduzir movimento" |
| Cliente alterar o preço no navegador | O pedido é só uma mensagem: o dono confere o valor no WhatsApp antes de aceitar. Não há pagamento no site para fraudar |
| Qualquer pessoa criar conta e virar "dono" | Cadastro público desligado no Supabase; só quem está na tabela `admins` edita (garantido pelo RLS) |
| A seção que trava irritar quem quer pedir | Ela fica só na página da loja; o QR code leva direto ao cardápio, que não trava |
| Mensagem do WhatsApp com caracteres quebrados | Montar o texto e passar por `encodeURIComponent`, com testes automatizados |

## Etapas

| Etapa | Entrega |
|---|---|
| 1 | Este planejamento + Arena de animações (`etapa-1-arena.md`) |
| 2 | Página da loja e cardápio com dados de exemplo e imagens provisórias |
| 3 | Sacola, total, mensagem do WhatsApp e testes |
| 4 | Supabase: banco, RLS e painel do dono com login |
| 5 | Fotos e vídeos de IA otimizados; upload de fotos pelo painel |
| 6 | Animações finais (seção que trava), acessibilidade e segurança (prompt 06) |
| 7 | Publicação na Vercel e testes na versão publicada |
