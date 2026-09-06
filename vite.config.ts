import process from 'node:process';
import { defineConfig } from 'vitest/config';
import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';

/**
 * The site is served from https://yakanet.github.io/tatr-dashboard rather than from
 * the root, so the deploy workflow passes the repository name as `BASE_PATH`. An
 * empty base is correct for `vite dev` and for a custom domain.
 */
function basePath(): '' | `/${string}` {
	if (process.argv.includes('dev')) return '';

	const value = process.env.BASE_PATH?.replace(/\/+$/, '');
	if (!value) return '';

	return value.startsWith('/') ? (value as `/${string}`) : `/${value}`;
}

export default defineConfig({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			// `404.html` is what makes client-side routing work at any path depth on
			// GitHub Pages: it serves that file for every path it has no file for.
			adapter: adapter({ fallback: '404.html' }),
			paths: { base: basePath() }
		})
	],
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
