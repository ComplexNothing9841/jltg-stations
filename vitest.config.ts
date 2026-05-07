import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import sqlocal from 'sqlocal/vite';

export default defineConfig({
	plugins: [sveltekit(), sqlocal()],
	test: {
		environment: 'happy-dom',
		globals: true,
		setupFiles: ['./src/test/setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}'],
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			include: ['src/lib/**/*.{js,ts}'],
			exclude: [
				'src/lib/**/*.test.{js,ts}',
				'src/lib/**/*.spec.{js,ts}',
				'src/lib/config/assets.ts',
				'src/lib/config/bootstrap.ts'
			]
		},
		testTimeout: 10000
	},
	resolve: {
		conditions: ['browser'],
		alias: {
			'maplibre-gl': '/src/test/mocks/maplibre-gl.ts'
		}
	}
});
