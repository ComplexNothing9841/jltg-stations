/// <reference types="@sveltejs/kit" />
import { build, files, version } from '$service-worker';

const SHELL = `tw-stations-shell-${version}`;
const PRECACHE = [...build, ...files];

self.addEventListener('install', (event) => {
	event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(PRECACHE)));
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then(async (keys) => {
			await Promise.all(
				keys
					.filter((key) => key.startsWith('tw-stations-shell-') && key !== SHELL)
					.map((key) => caches.delete(key))
			);
			await self.clients.claim();
		})
	);
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') return;
	event.respondWith(
		caches.match(event.request).then((cached) => {
			if (cached) return cached;
			return fetch(event.request)
				.then((response) => {
					const url = new URL(event.request.url);
					if (url.protocol.startsWith('http')) {
						const clone = response.clone();
						const cacheName = url.pathname.startsWith('/_app/') ? SHELL : 'tw-stations-runtime';
						void caches.open(cacheName).then((cache) => cache.put(event.request, clone));
					}
					return response;
				})
				.catch(async () => {
					const runtimeCached = await caches.match(event.request, { ignoreSearch: true });
					if (runtimeCached) return runtimeCached;
					if (event.request.mode === 'navigate') {
						const shellCached = await caches.match('/');
						if (shellCached) return shellCached;
					}
					throw new TypeError(`Network request failed for ${event.request.url}`);
				});
		})
	);
});
