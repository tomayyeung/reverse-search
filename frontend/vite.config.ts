import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import path from 'path';
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  plugins: [
    // React Compiler is enabled through the Babel preset until the plugin wires it directly.
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    // Required by the generated wasm-pack bundle in frontend/pkg.
    wasm(),
    topLevelAwait(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@components": path.resolve(__dirname, "./src/components"),
      "@wasm": path.resolve(__dirname, "./pkg")
    },
  },
  server: {
    proxy: {
      // Match frontend deploy behavior while using the local Rust backend.
      "/api": "http://localhost:3000"
    },
    fs: {
      allow: [".."]
    }
  },
  build: {
    target: "esnext"
  }
})
