<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import ShareButton from './ShareButton.svelte';
	import { MediaQuery } from 'svelte/reactivity';
	import { CopyCheckIcon, CopyIcon } from '@lucide/svelte';
	let { message = $bindable(null) }: { message: string | null } = $props();
	let copied = $state(false);
	const isDesktop = new MediaQuery('(min-width: 1024px)');
	async function copy() {
		if (!message) return;
		await navigator.clipboard.writeText(message);
		copied = true;
	}
</script>

<Drawer.Root
	open={!!message}
	onClose={() => (message = null)}
	direction={isDesktop.current ? 'right' : 'bottom'}
>
	<Drawer.Portal>
		<Drawer.Overlay class="share-overlay" onclick={() => (message = null)} />
		<Drawer.Content class="share-drawer" data-vaul-no-drag>
			<Drawer.Title class="share-title">Share your Move</Drawer.Title>
			<p class="message">{message}</p>
			{#if message}
				<div class="share-actions">
					<button class="ghost-button" type="button" onclick={copy} data-vaul-no-drag>
						{#if copied}
							<CopyCheckIcon size="16" />
						{:else}
							<CopyIcon size="16" />
						{/if}
					</button>
					<ShareButton payload={message} label="Share" />
					<button
						class="primary-button"
						type="button"
						onclick={() => (message = null)}
						data-vaul-no-drag
					>
						Done
					</button>
				</div>
			{/if}
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	:global(.share-overlay) {
		position: fixed;
		inset: 0;
		z-index: 24;
		background: rgba(52, 37, 18, 0.3);
	}
	:global(.share-drawer) {
		position: fixed;
		right: 0.75rem;
		bottom: 0.75rem;
		left: 0.75rem;
		z-index: 25;
		padding: 1rem;
		background: var(--panel);
		backdrop-filter: blur(12px);
		border: 1px solid var(--line);
		border-radius: 24px;
		box-shadow: var(--shadow);
		overflow: clip;
	}
	:global(.share-title) {
		margin: 0;
		font-family: 'Permanent Marker', cursive;
	}
	:global(.share-description) {
		margin: 0.4rem 0 0.75rem;
		color: var(--muted);
	}
	:global(.message) {
		min-height: 2.5rem;
		max-width: 70%;
		margin-left: auto; /* push to right */
		padding: 0.6rem 0.9rem;
		background: #0b93f6; /* classic iMessage blue */
		color: white;
		border-radius: 18px 18px 4px 18px; /* subtle tail corner */
		border: none;
		font-family:
			system-ui,
			-apple-system,
			sans-serif;
		white-space: pre-wrap;
		user-select: text;
		word-break: break-word;
	}
	.share-actions {
		margin-top: 0.75rem;
		display: flex;
		gap: 0.65rem;
		align-items: center;
		flex-wrap: wrap;
	}
	@media (min-width: 960px) {
		:global(.share-drawer) {
			left: auto;
			width: min(36rem, calc(100vw - 2rem));
		}
	}
</style>
