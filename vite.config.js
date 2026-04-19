import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
  ],
  // Set the base path to './' for relative asset loading, 
  // or '/' if you're using a custom domain.
  // For username.github.io/repo-name/, use '/repo-name/'
  base: './', 
})
