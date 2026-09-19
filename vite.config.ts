import { defineConfig } from "vite";

export default defineConfig({
  // Relative URLs, so the built site works from any host or sub-path.
  // Both pages live at the site root for this to hold.
  base: "./",
  build: {
    rollupOptions: {
      input: {
        main: "index.html",
        play: "play.html",
      },
    },
  },
});
