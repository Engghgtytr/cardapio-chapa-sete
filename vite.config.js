import { defineConfig } from 'vite';

// Endereço público do site. Na Vercel vem sozinho (VERCEL_PROJECT_PRODUCTION_URL);
// em outro lugar, defina SITE_URL=https://seu-dominio. Sem ele, as tags que exigem
// endereço completo (canonical, og:url, og:image, sitemap) ficam de fora em vez de
// apontar para um domínio inventado.
const siteUrl = (() => {
  const raw = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || '';
  if (!raw) return '';
  return (raw.startsWith('http') ? raw : `https://${raw}`).replace(/\/+$/, '');
})();

function seo() {
  return {
    name: 'seo-por-endereco',
    transformIndexHtml(html) {
      if (!siteUrl) return html;
      const tags = [
        `<link rel="canonical" href="${siteUrl}/" />`,
        `<meta property="og:url" content="${siteUrl}/" />`,
        `<meta property="og:image" content="${siteUrl}/og-image.jpg" />`,
        `<meta name="twitter:image" content="${siteUrl}/og-image.jpg" />`,
      ];
      return html.replace('</head>', `    ${tags.join('\n    ')}\n  </head>`);
    },
    generateBundle() {
      // O painel (#/admin) não precisa de regra aqui: é uma rota por hash, que robôs
      // não visitam, e quem protege os dados é o RLS, não o robots.txt.
      const robots = ['User-agent: *', 'Allow: /', ...(siteUrl ? ['', `Sitemap: ${siteUrl}/sitemap.xml`] : [])];
      this.emitFile({ type: 'asset', fileName: 'robots.txt', source: `${robots.join('\n')}\n` });
      if (!siteUrl) return;
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc></url>
</urlset>
`;
      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap });
    },
  };
}

export default defineConfig({
  plugins: [seo()],
});
