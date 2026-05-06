<script lang="ts">
	let {
		payload = '',
		label = 'Share action'
	}: {
		payload?: string;
		label?: string;
	} = $props();

	let status = $state('');

	async function share() {
		if (!payload) return;
		if (navigator.share) {
			await navigator.share({ text: payload });
			status = 'Shared';
		} else {
			await navigator.clipboard.writeText(payload);
			status = 'Copied';
		}
	}
</script>

<button class="ghost-button" type="button" onclick={share}>{label}</button>
{#if status}
	<span class="inline-status">{status}</span>
{/if}
