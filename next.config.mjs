/** @type {import('next').NextConfig} */
const SHOP = 'https://lexoriashop.vercel.app';

const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/index.html' },
        // Price list under a path named in each language
        { source: '/:slug(hinnasto|fees|hinnakiri)', destination: '/hinnasto.html' },
        // Company details, privacy notice and terms of use of the main site
        { source: '/:slug(tiedot|legal|teave)', destination: '/legal.html' },
        // Document bank under a path named in each language; the shop itself is a separate Vercel project
        { source: '/:slug(asiakirjapankki|document-bank|dokumendipank)', destination: `${SHOP}/` },
        // The shop page loads these relative to the site root
        { source: '/img/:file(doc-[a-z0-9-]+\\.webp|hero-bg\\.webp)', destination: `${SHOP}/img/:file` },
        { source: '/api/:fn(checkout|payment-methods|contact)', destination: `${SHOP}/api/:fn` },
        { source: '/lexoria-logo-purple.png', destination: `${SHOP}/lexoria-logo-purple.png` },
      ],
    };
  },
};

export default nextConfig;
