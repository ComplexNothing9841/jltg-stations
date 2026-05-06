import devtoolsJson from 'vite-plugin-devtools-json';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import sqlocal from 'sqlocal/vite';

export default defineConfig({
	plugins: [sveltekit(), devtoolsJson(), sqlocal()],
	optimizeDeps: {
		include: ['maplibre-gl']
	}
});
