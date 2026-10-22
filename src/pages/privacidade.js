import { logo } from '../components/brand.js';

// Política de privacidade em linguagem simples. Precisa bater com o que o site
// faz de verdade: se algo mudar no código (ex.: entrar um analytics), mude aqui.
export function renderPrivacidade(app) {
  app.innerHTML = `
  <div class="doc">
    <header class="doc__top">${logo('#/')}</header>
    <main class="doc__body">
      <h1>Privacidade</h1>
      <p class="doc__lead">A Chapa Sete é uma loja fictícia, criada como projeto de portfólio. Mesmo assim, o site foi feito para guardar o mínimo possível sobre quem visita.</p>

      <h2>O seu pedido</h2>
      <p>Nome, endereço, forma de pagamento e observações que você digita na sacola <strong>não são enviados para este site nem guardados por ele</strong>. Eles viram uma mensagem que só sai do seu aparelho se você tocar em enviar no WhatsApp. A partir daí, valem as regras do WhatsApp e da loja que recebe a mensagem.</p>
      <p>Enquanto a página está aberta, o que você digitou fica na memória do navegador, para não se perder se você fechar a sacola. Ao fechar a aba, isso some.</p>

      <h2>Cookies e rastreamento</h2>
      <p>O site não usa cookies de propaganda nem ferramentas de rastreamento (como Google Analytics ou Meta Pixel). Por isso não há aviso de cookies.</p>

      <h2>Painel da loja</h2>
      <p>O e-mail e a senha de quem administra a loja ficam no serviço de login do Supabase, que guarda a senha de forma cifrada. Na demonstração do painel, as mudanças ficam só no armazenamento do seu próprio navegador e podem ser apagadas no botão "Desfazer minhas mudanças".</p>

      <h2>Serviços usados</h2>
      <ul class="doc__list">
        <li><strong>Vercel</strong>: hospeda o site.</li>
        <li><strong>Supabase</strong>: quando a loja usa banco de dados, guarda o cardápio, os preços e as fotos dos pratos.</li>
      </ul>
      <p>Esses serviços recebem dados técnicos de qualquer acesso a um site, como o endereço IP, para entregar as páginas.</p>

      <p class="doc__back"><a href="#/">Voltar para a loja</a></p>
    </main>
  </div>`;
}
