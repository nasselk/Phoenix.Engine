<script lang="ts">
	import { onMount } from "svelte";
	import type { AdSlotProps } from "./AdSlot.types";

	const {
		id,
		ads,
		width = "300px",
		dimensions = { width: 300, height: 250 },
		onmount = () => {
			ads.requestBannerAd?.(id, dimensions.width, dimensions.height);

			return () => ads.clearBannerAd?.(id);
		},
	}: AdSlotProps = $props();

	let element: HTMLDivElement | undefined = $state();

	onMount(() => (element ? onmount(element) : undefined));
</script>

{#if ads.requestBannerAd}
	<div
		class="adSlot"
		bind:this={element}
		{id}
		style={`width: ${dimensions.width}px; height: ${dimensions.height}px; zoom: calc(${width} / ${dimensions.width}px);`}
	></div>
{/if}

<style>
	.adSlot {
		pointer-events: auto;
	}
</style>
