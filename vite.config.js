import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Land Master is deployed to GitHub Pages under the repository name
// "Land-Master", so all built asset URLs must be prefixed with that path.
export default defineConfig({
  base: '/Land-Master/',
  plugins: [react()],
})
