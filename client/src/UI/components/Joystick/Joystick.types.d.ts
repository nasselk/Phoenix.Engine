/** Where the stick is being held, as a game reads it rather than as the screen draws it. */
export type JoystickMove = {
	/** -1 fully left, 1 fully right. */
	readonly x: number;
	/** -1 fully down, 1 fully up: the screen's y grows downwards, a stick's does not. */
	readonly y: number;
	/** Radians counter-clockwise from the right, `Math.atan2(y, x)`. 0 while the stick is inside its dead zone. */
	readonly angle: number;
	/** How far it is held, 0 at the edge of the dead zone and 1 at the rim. */
	readonly distance: number;
};

export interface JoystickProps {
	/** Added to the joystick's own class, for a game that would rather style it from the outside. */
	class?: string;
	top?: string;
	left?: string;
	right?: string;
	bottom?: string;
	/** Width and height of the ring, as any CSS length. */
	size?: string;
	/**
	 * How much of the ring answers to nothing, as a fraction of its radius. `distance` starts from 0
	 * at its edge, so there is no jump out of it.
	 */
	deadZone?: number;
	/** Press anywhere in this element and the joystick comes to the finger. Left where it is without one. */
	stickyZone?: HTMLElement;
	/** With a sticky zone, fade out of sight while nobody is holding it. */
	fade?: boolean;
	onstart?: () => void;
	onmove?: (move: JoystickMove) => void;
	onstop?: () => void;
}
