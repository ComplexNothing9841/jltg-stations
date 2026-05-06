<script lang="ts">
	import { Drawer } from 'vaul-svelte';

	let {
		open = false,
		title = 'Confirm action',
		description,
		numberInput,
		onConfirm,
		onClose
	}: {
		open?: boolean;
		title?: string;
		description?: string;
		numberInput?: string;
		onConfirm: (amount: number) => void | Promise<void>;
		onClose: () => void;
	} = $props();

	let amount = $state(1);
	let errorMessage = $state<string | null>(null);
	let clearTimer: ReturnType<typeof setTimeout> | null = null;

	function clearError() {
		errorMessage = null;
		if (clearTimer) {
			clearTimeout(clearTimer);
			clearTimer = null;
		}
	}

	async function handleConfirm() {
		clearError();
		try {
			await onConfirm(amount);
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Action failed.';
			clearTimer = setTimeout(() => {
				errorMessage = null;
				clearTimer = null;
			}, 6000);
		}
	}

	$effect(() => {
		if (!open) {
			amount = 1;
			clearError();
		}
	});
</script>

<Drawer.NestedRoot
	{open}
	onOpenChange={(nextOpen) => {
		if (!nextOpen) {
			onClose();
		}
	}}
>
	<Drawer.Portal>
		<Drawer.Overlay class="modal-backdrop" onclick={onClose} />
		<Drawer.Content class="modal-card" data-vaul-no-drag>
			<Drawer.Title class="modal-title">{title}</Drawer.Title>
			{#if errorMessage}
				<div class="modal-error" role="alert">
					<span>{errorMessage}</span>
					<button type="button" class="clear-error-btn" onclick={clearError}>Dismiss</button>
				</div>
			{/if}
			{#if description}
				<p>{description}</p>
			{/if}
			{#if numberInput}
				<label>
					{numberInput}
					<input bind:value={amount} min="1" step="1" type="number" data-vaul-no-drag />
				</label>
			{/if}
			<div class="modal-actions">
				<button class="ghost-button" type="button" onclick={onClose} data-vaul-no-drag
					>Cancel</button
				>
				<button class="primary-button" type="button" onclick={handleConfirm} data-vaul-no-drag
					>Confirm</button
				>
			</div>
		</Drawer.Content>
	</Drawer.Portal>
</Drawer.NestedRoot>

<style>
	:global(.modal-backdrop) {
		position: fixed;
		inset: 0;
		z-index: 20;
		background: rgba(52, 37, 18, 0.3);
	}

	:global(.modal-card) {
		position: fixed;
		right: 0.75rem;
		bottom: 0.75rem;
		left: 0.75rem;
		z-index: 21;
		padding: 1rem;
		background: var(--panel);
		backdrop-filter: blur(12px);
		border: 1px solid var(--line);
		border-radius: 24px;
		box-shadow: var(--shadow);
		overflow: clip;
	}

	:global(.modal-title) {
		margin: 0;
		font-family: 'Permanent Marker', cursive;
	}

	:global(.modal-card label) {
		display: grid;
		gap: 0.35rem;
		margin: 0.75rem 0;
	}

	:global(.modal-card input) {
		padding: 0.72rem 0.85rem;
		background: white;
		border: 1px solid var(--line);
		border-radius: 14px;
	}

	.modal-error {
		margin-top: 0.6rem;
		padding: 0.55rem 0.7rem;
		background: #fff0ef;
		border: 1px solid #f4b4af;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.clear-error-btn {
		background: transparent;
		border: 0;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		font: inherit;
	}

	.modal-actions {
		display: flex;
		gap: 0.65rem;
		align-items: center;
		flex-wrap: wrap;
	}

	@media (min-width: 960px) {
		:global(.modal-card) {
			left: auto;
			width: min(32rem, calc(100vw - 2rem));
		}
	}
</style>
