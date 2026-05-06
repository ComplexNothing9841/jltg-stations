<script lang="ts">
	import { Drawer } from 'vaul-svelte';
	import { MediaQuery } from 'svelte/reactivity';

	const isDesktop = new MediaQuery('(min-width: 1024px)');

	let {
		open = $bindable(false),
		onConfirm = () => {},
		loading = false
	}: {
		open?: boolean;
		onConfirm?: () => void | Promise<void>;
		loading?: boolean;
	} = $props();
</script>

<Drawer.Root bind:open direction={isDesktop.current ? 'right' : 'bottom'}>
	<Drawer.Portal>
		<Drawer.Overlay class="reset-drawer-overlay" onclick={() => !loading && (open = false)} />
		<Drawer.Content class="reset-drawer">
			<Drawer.Title class="reset-title">Reset all data?</Drawer.Title>
			<Drawer.Description class="reset-description">
				This will remove all local game data and cached assets from this device.
			</Drawer.Description>
			<div class="reset-actions">
				<button class="cancel-button" onclick={() => (open = false)} disabled={loading}
					>Cancel</button
				>
				<button class="confirm-button" onclick={() => void onConfirm()} disabled={loading}>
					{loading ? 'Resetting...' : 'Yes, reset everything'}
				</button>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.Root>

<style>
	:global(.reset-drawer-overlay) {
		position: fixed;
		inset: 0;
		z-index: 18;
		background: rgba(52, 37, 18, 0.35);
	}

	:global(.reset-drawer) {
		position: fixed;
		z-index: 19;
		top: 0.75rem;
		right: 0.75rem;
		bottom: 0.75rem;
		width: min(30rem, calc(100vw - 1.5rem));
		padding: 1rem;
		background: var(--panel);
		border: 1px solid var(--line);
		border-radius: 24px;
		box-shadow: var(--shadow);
		display: grid;
		align-content: start;
		gap: 0.8rem;
	}

	:global(.reset-title) {
		margin: 0;
	}

	:global(.reset-description) {
		margin: 0;
		color: var(--muted);
	}

	.reset-actions {
		display: flex;
		gap: 0.6rem;
		margin-top: 0.2rem;
	}

	.cancel-button,
	.confirm-button {
		border-radius: 999px;
		padding: 0.7rem 1rem;
		font-weight: 600;
		cursor: pointer;
	}

	.cancel-button {
		border: 1px solid var(--line);
		background: var(--panel-strong);
		color: inherit;
	}

	.confirm-button {
		border: 1px solid color-mix(in srgb, #a00024 30%, var(--line));
		background: color-mix(in srgb, #a00024 12%, var(--panel-strong));
		color: inherit;
	}

	@media (max-width: 959px) {
		:global(.reset-drawer) {
			top: auto;
			left: 0.75rem;
			right: 0.75rem;
			bottom: 0.75rem;
			width: auto;
		}
	}
</style>
