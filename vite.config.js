import { defineConfig } from 'vite'

export default defineConfig({
    // Static site - just serve files as-is
    root: '.',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: {
                main: 'index.html'
            }
        }
    },
    server: {
        port: 5173
    }
})
