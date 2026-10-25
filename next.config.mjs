/** @type {import('next').NextConfig} */
const SHOP = 'https://lexoriashop.vercel.app';

const nextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        { source: '/', destination: '/index.html' },
        // Document bank under a path named in each language; the shop itself is a separate Vercel project
        { source: '/:slug(asiakirjapankki|document-bank|dokumendipank)', destination: `${SHOP}/` },
        // The shop page loads these relative to the site root
        { source: '/img/:file(doc-[a-z0-9-]+\\.webp|hero-bg\\.webp)', destination: `${SHOP}/img/:file` },
        { source: '/api/:fn(checkout|payment-methods)', destination: `${SHOP}/api/:fn` },
        { source: '/lexoria-logo-purple.png', destination: `${SHOP}/lexoria-logo-purple.png` },
      ],
    };
  },
};

export default nextConfig;
