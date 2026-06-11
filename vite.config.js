import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    // Static site - just serve files from repo root
    root: '.',
    plugins: [
        VitePWA({
            registerType: 'autoUpdate',
            devOptions: { enabled: true },
            manifest: {
                name: 'Tenki Core',
                short_name: 'Tenki',
                description: 'Bio-Risk SaaS for Pro Traders',
                theme_color: '#4cc9f0',
                background_color: '#0a0e27',
                display: 'fullscreen'
            }
        })
    ],
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
