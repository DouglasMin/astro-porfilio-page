import { defineConfig } from 'astro/config';
import { rehypeNotionImages } from './src/lib/rehype-notion-images.ts';

export default defineConfig({
  site: 'https://main.d3m8pthmupwl40.amplifyapp.com/',
  output: 'static',
  image: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
    rehypePlugins: [rehypeNotionImages],
  },
});


