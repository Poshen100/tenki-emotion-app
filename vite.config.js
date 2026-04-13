/// <reference types="vitest" />
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
    // Static site - just serve files from repo root
    root: '.',
    test: {
        globals: true,
        include: [
            'tests/**/*.test.{js,ts}',
            'packages/**/__tests__/**/*.test.{js,ts}',
            'packages/**/src/**/__tests__/**/*.test.{js,ts}',
        ],
        exclude: [
            'node_modules',
            'dist',
            'tests/progressive-tei.test.js',
            'tests/event-bridge-v2.test.js',
            'tests/decision-dock.test.js',
            'tests/ppg-phase4.test.js',
            'tests/tei-display-adapter.test.js',
            'tests/tei-rs99-display.test.js',
        ],
    },
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
