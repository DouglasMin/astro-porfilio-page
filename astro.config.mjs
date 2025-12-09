import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://main.d3m8pthmupwl40.amplifyapp.com/',
  output: 'static',
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
      wrap: true,
    },
  },
});


