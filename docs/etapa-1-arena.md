# Etapa 1: Arena de animações (prompt 02)

O contexto é o oposto do StockFlow. Lá, a pessoa usa o sistema o dia inteiro. Aqui, ela está **com fome, no celular**, e quer pedir rápido. Por isso:

- **Na página da loja** (vista uma vez, para impressionar), pode haver **um** momento marcante: a seção que trava.
- **No cardápio** (usado para pedir), as animações só confirmam ações e nunca fazem a pessoa esperar.

As durações são escolhas de projeto, não números de pesquisa.

## Página da loja

### Duelo 1: entrada do site

| Item | Splash com logo | Nenhuma animação |
|---|---|---|
| Efeito na navegação | Atrasa o conteúdo em 1 a 2 s | O vídeo e o nome aparecem na hora |
| Frequência | 1x por visita | — |
| Prós para o tema | Reforça a marca | O próprio vídeo da chapa já é o impacto |
| Contras | Duas "aberturas" seguidas (splash + vídeo) cansam | Nenhum |
| **🏆 Vencedora** | | **Nenhuma**: o vídeo faz o papel de abertura |

### Duelo 2: fundo do topo

| Item | Vídeo em loop | Foto parada |
|---|---|---|
| Efeito na navegação | Mostra o produto "vivo"; prende o olhar | Carrega mais rápido |
| Frequência | 1x por visita | 1x por visita |
| Prós para o tema | Chapa estalando vende hambúrguer melhor que foto | Simples |
| Contras | Peso (cerca de 2 MB) e movimento constante | Menos memorável |
| **🏆 Vencedora** | **Vídeo, com regras:** foto da capa enquanto carrega, não baixa com "economia de dados" ou "reduzir movimento", botão de pausar | |

### Duelo 3: título do topo

| Item | Texto letra por letra (typewriter) | Fade-in com leve subida |
|---|---|---|
| Efeito na navegação | A pessoa espera para ler o nome | Lê na hora |
| Frequência | 1x por visita | 1x por visita |
| Contras | Atrasa a mensagem principal; clichê | Nenhum relevante |
| **🏆 Vencedora** | | **Fade-in + subida de 12 px, 400 ms, uma vez** |

### Duelo 4: "Como nasce um smash" (o momento marcante)

| Item | Tela travada com troca de fundo (pinning) | Seções que aparecem ao rolar (scroll reveal) |
|---|---|---|
| Efeito na navegação | Conta uma história em 4 passos sem a pessoa perder o lugar | Cada passo aparece e some da tela |
| Frequência | 1x por visita | 1x por visita |
| Prós para o tema | Mostra o processo (carne → smash → queijo → montagem), que é o diferencial de uma hamburgueria de smash | Simples |
| Contras | Mais trabalho; precisa de versão sem movimento | Comum, esquecível |
| **🏆 Vencedora** | **Pinning**: é o único momento de destaque do site e tem propósito (explicar o produto) | |

Como funciona:
1. **A tela trava:** a seção tem 400 vh de altura e um bloco interno `position: sticky` de 100 vh. A rolagem continua normal (sem hijacking), mas o bloco fica parado.
2. **O fundo muda:** o progresso da rolagem dentro da seção escolhe o passo atual (0 a 3). A foto do passo entra por cima da anterior com fade de 500 ms.
3. **A legenda aparece:** a legenda do passo entra com fade e subida de 16 px, 400 ms. Uma barrinha de progresso mostra "2 de 4".
4. **A tela destrava:** quando a rolagem passa dos 400 vh, a página continua.

Tecnologia: `position: sticky` + um ouvinte de rolagem leve (`requestAnimationFrame`), só com `opacity` e `transform`. Sem GSAP.

### Duelo 5: destaques do cardápio

| Item | Cards entrando um por um ao rolar | Nenhuma animação |
|---|---|---|
| Frequência | 1x por visita | — |
| Prós | Parece "vivo" | Não compete com a seção anterior |
| Contras | Segundo efeito de rolagem logo depois do pinning: dilui o destaque | — |
| **🏆 Vencedora** | | **Nenhuma**: um momento marcante só |

## Cardápio

### Duelo 6: carregamento

| Item | Skeleton (formato dos cards em cinza) | Spinner |
|---|---|---|
| Efeito na navegação | Mostra onde virão foto, nome e preço | Só diz "espera" |
| Frequência | 1x por visita | 1x por visita |
| **🏆 Vencedora** | **Skeleton**, com brilho suave (sem brilho em "reduzir movimento") | |

### Duelo 7: foto do prato terminando de carregar

| Item | Fade-in de 200 ms | Aparecer de repente |
|---|---|---|
| Frequência | Uma vez por prato | — |
| Prós | Esconde o "pulo" da imagem pintando aos pedaços | — |
| **🏆 Vencedora** | **Fade-in de 200 ms** | |

### Duelo 8: abas de categoria ao rolar

| Item | Indicador deslizando até a aba atual | Troca seca de cor |
|---|---|---|
| Frequência | Várias vezes por visita | Várias vezes |
| Prós | Mostra para onde a pessoa foi | Mais simples |
| Contras | Precisa ser rápido para não incomodar | Menos claro em qual aba se está |
| **🏆 Vencedora** | **Indicador deslizando, 200 ms**, só `transform` | |

### Duelo 9: adicionar um prato (o feedback mais importante)

| Item | Contador da sacola dá um "pulinho" | Aviso flutuante "Adicionado" |
|---|---|---|
| Efeito na navegação | Confirma sem cobrir nada | Cobre o cardápio a cada item |
| Frequência | Várias vezes por visita | Várias vezes |
| Prós | Mostra **onde** o item foi parar | Texto explícito |
| Contras | Sutil (por isso o anúncio para leitor de tela) | Cansa no 3º item |
| **🏆 Vencedora** | **Contador pula** (escala 1 → 1,2 → 1, 250 ms) + o total muda + anúncio `aria-live` "Clássico Smash adicionado" | |

### Duelo 10: abrir a sacola

| Item | Painel subindo de baixo (bottom sheet) | Ir para outra página |
|---|---|---|
| Efeito na navegação | O cardápio continua atrás; fechar volta ao mesmo lugar | Perde a posição no cardápio |
| Frequência | 1 a 3x por visita | — |
| **🏆 Vencedora** | **Bottom sheet, 300 ms** com curva de gaveta; sai em 200 ms | |

### Duelo 11: toque nos cards de prato vs nenhuma animação

| Item | Card cresce no hover | Só o botão [+] reage ao toque |
|---|---|---|
| Frequência | Dezenas de vezes | Dezenas de vezes |
| Contras | Celular não tem hover; "empurra" a lista | — |
| **🏆 Vencedora** | | **Só o botão:** escala 0,97 ao pressionar (120 ms) |

### Duelo 12: enviar o pedido

| Item | Animação de "pedido enviado" | Nenhuma animação |
|---|---|---|
| Contras | A pessoa sai para o WhatsApp e nem veria | — |
| **🏆 Vencedora** | | **Nenhuma**: o WhatsApp abre e é ali que a conversa continua |

## Painel do dono

Mesmo padrão do StockFlow, que já funciona: modal com entrada e saída, aviso flutuante ao salvar e botões com escala ao pressionar. Nada além disso, porque é ferramenta de trabalho.

## 🏆 Equipe campeã

| # | Animação | Onde | Duração | Com "reduzir movimento" |
|---|---|---|---|---|
| 1 | Vídeo em loop | Topo da loja | contínuo | Não carrega; fica a foto da capa |
| 2 | Fade + subida | Título do topo | 400 ms, 1x | Só o fade |
| 3 | **Pinning com troca de foto e legendas** | "Como nasce um smash" | 500 ms por troca | Sem trava: os 4 passos aparecem um embaixo do outro |
| 4 | Skeleton | Cardápio carregando | enquanto carrega | Sem o brilho |
| 5 | Fade da foto | Cada prato | 200 ms | Igual (fade não é movimento) |
| 6 | Indicador deslizando | Abas de categoria | 200 ms | Troca sem deslizar |
| 7 | Pulinho do contador | Sacola | 250 ms | Só a cor muda |
| 8 | Bottom sheet | Sacola | 300 ms entra / 200 ms sai | Fade |
| 9 | Escala ao pressionar | Botões | 120 ms | Igual (escala mínima, sem deslocamento) |

**Curvas** (as mesmas do StockFlow): `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)` para entradas e `--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)` para a sacola.

**Cortadas:** splash, typewriter, cards entrando ao rolar, hover nos cards e animação de envio.
