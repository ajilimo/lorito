import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: el repo se publica en ajilimo.github.io/lorito/
export default defineConfig({
  base: '/lorito/',
  plugins: [react()],
})
