import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import adapter from "@sveltejs/adapter-netlify";
import { contentSecurityDirectives } from "./src/lib/server/contentSecurityPolicy.js";

/** @type {import('@sveltejs/kit').Config} */
const config = {
  kit: {
    adapter: adapter(),
    csp: {
      mode: "auto",
      directives: contentSecurityDirectives({
        dev: process.env.NODE_ENV !== "production",
      }),
    },
  },

  preprocess: [vitePreprocess({})],
};
export default config;
