<script lang="ts">
	import type { EditorAxis, EditorView } from "phoenix.engine/client";
	import { Quaternion, Vector3 } from "three";

	const { view }: { view: EditorView } = $props();

	const colors = $derived({
		x: `#${view.axes.colors.x.getHexString()}`,
		y: `#${view.axes.colors.y.getHexString()}`,
		z: `#${view.axes.colors.z.getHexString()}`,
	});

	const AXES: readonly {
		id: EditorAxis;
		label: string;
		axis: "x" | "y" | "z";
		direction: Vector3;
		positive: boolean;
	}[] = [
		{
			id: "x",
			label: "X",
			axis: "x",
			direction: new Vector3(1, 0, 0),
			positive: true,
		},
		{
			id: "y",
			label: "Y",
			axis: "y",
			direction: new Vector3(0, 1, 0),
			positive: true,
		},
		{
			id: "z",
			label: "Z",
			axis: "z",
			direction: new Vector3(0, 0, 1),
			positive: true,
		},
		{
			id: "-x",
			label: "-X",
			axis: "x",
			direction: new Vector3(-1, 0, 0),
			positive: false,
		},
		{
			id: "-y",
			label: "-Y",
			axis: "y",
			direction: new Vector3(0, -1, 0),
			positive: false,
		},
		{
			id: "-z",
			label: "-Z",
			axis: "z",
			direction: new Vector3(0, 0, -1),
			positive: false,
		},
	];

	const CENTER = 50;
	const RADIUS = 34;
	const DRAG_THRESHOLD = 3;

	const INVERSE = new Quaternion();
	const POINT = new Vector3();

	let layer: SVGGElement;
	const depths = AXES.map(() => 0);
	const order = AXES.map((_, index) => index);

	let pointer:
		| { id: number; x: number; y: number; moved: number; axis?: EditorAxis }
		| undefined;

	$effect(() => {
		const groups = AXES.map(
			(axis) =>
				layer.querySelector<SVGGElement>(`[data-axis="${axis.id}"]`)!,
		);
		const balls = groups.map((group) => group.querySelector("circle")!);
		const labels = groups.map((group) => group.querySelector("text")!);
		const lines = groups.map(
			(group) => group.querySelector("line") ?? undefined,
		);

		let frame = requestAnimationFrame(draw);

		function draw(): void {
			INVERSE.copy(view.activeCamera.quaternion).invert();

			for (let index = 0; index < AXES.length; index++) {
				POINT.copy(AXES[index]!.direction).applyQuaternion(INVERSE);

				const x = CENTER + POINT.x * RADIUS;
				const y = CENTER - POINT.y * RADIUS;

				depths[index] = POINT.z;

				balls[index]!.setAttribute("cx", `${x}`);
				balls[index]!.setAttribute("cy", `${y}`);
				labels[index]!.setAttribute("x", `${x}`);
				labels[index]!.setAttribute("y", `${y}`);
				lines[index]?.setAttribute("x2", `${x}`);
				lines[index]?.setAttribute("y2", `${y}`);
			}

			// Farthest first, so what points at the viewer is drawn over what points away.
			let changed = false;

			for (let i = 1; i < order.length; i++) {
				const current = order[i]!;
				let j = i - 1;

				while (j >= 0 && depths[order[j]!]! > depths[current]!) {
					order[j + 1] = order[j]!;
					j--;
					changed = true;
				}

				order[j + 1] = current;
			}

			if (changed) {
				for (const index of order) {
					layer.appendChild(groups[index]!);
				}
			}

			frame = requestAnimationFrame(draw);
		}

		return () => cancelAnimationFrame(frame);
	});

	function down(event: PointerEvent): void {
		(event.currentTarget as Element).setPointerCapture(event.pointerId);

		const axis = (event.target as Element)
			.closest("[data-axis]")
			?.getAttribute("data-axis") as EditorAxis | null;

		pointer = {
			id: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			moved: 0,
			axis: axis ?? undefined,
		};
	}

	function move(event: PointerEvent): void {
		if (pointer?.id !== event.pointerId) {
			return;
		}

		const x = event.clientX - pointer.x;
		const y = event.clientY - pointer.y;

		pointer.x = event.clientX;
		pointer.y = event.clientY;
		pointer.moved += Math.abs(x) + Math.abs(y);

		if (pointer.moved > DRAG_THRESHOLD) {
			view.orbit(x, y);
		}
	}

	function up(event: PointerEvent): void {
		if (pointer?.id !== event.pointerId) {
			return;
		}

		if (pointer.moved <= DRAG_THRESHOLD && pointer.axis !== undefined) {
			view.viewFrom(pointer.axis);
		}

		pointer = undefined;
	}
</script>

<svg
	class="gizmo"
	viewBox="0 0 100 100"
	role="img"
	aria-label="View navigation: click an axis to look from it, drag to orbit"
	onpointerdown={down}
	onpointermove={move}
	onpointerup={up}
	onpointercancel={up}
>
	<circle class="disc" cx={CENTER} cy={CENTER} r="49" />

	<g bind:this={layer}>
		{#each AXES as axis (axis.id)}
			<g
				class="axis"
				class:positive={axis.positive}
				data-axis={axis.id}
				style:--color={colors[axis.axis]}
			>
				{#if axis.positive}
					<line x1={CENTER} y1={CENTER} x2={CENTER} y2={CENTER} />
				{/if}
				<circle r={axis.positive ? 9 : 7.5} />
				<text>{axis.label}</text>
				<title>{axis.label}</title>
			</g>
		{/each}
	</g>
</svg>

<style>
	.gizmo {
		--unit: calc(100vmin / 720);

		display: block;
		width: calc(84 * var(--unit));
		height: calc(84 * var(--unit));
		margin: calc(14 * var(--unit));
		overflow: visible;
		touch-action: none;
		cursor: grab;
		pointer-events: auto;
		user-select: none;
	}

	.gizmo:active {
		cursor: grabbing;
	}

	.disc {
		fill: rgba(255, 255, 255, 0.07);
		opacity: 0;
		transition: opacity 0.15s ease;
	}

	.gizmo:hover .disc {
		opacity: 1;
	}

	.axis {
		cursor: pointer;
	}

	line {
		stroke: var(--color);
		stroke-width: 2.5;
		stroke-linecap: round;
	}

	circle:not(.disc) {
		fill: var(--color);
		fill-opacity: 0.3;
		stroke: var(--color);
		stroke-width: 1.5;
		transition: stroke 0.12s ease;
	}

	.positive circle {
		fill-opacity: 1;
		stroke-width: 0;
	}

	.axis:hover circle {
		stroke: #fff;
		stroke-width: 1.5;
	}

	text {
		fill: rgba(0, 0, 0, 0.8);
		font:
			700 9px system-ui,
			sans-serif;
		text-anchor: middle;
		dominant-baseline: central;
		pointer-events: none;
	}

	.axis:not(.positive) text {
		fill: #fff;
		font-size: 7px;
		opacity: 0;
	}

	.axis:not(.positive):hover text {
		opacity: 1;
	}

	@media (pointer: coarse) {
		.gizmo {
			--unit: calc(100vmin / 540);
		}
	}
</style>
