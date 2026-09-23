import type { Component } from "svelte";
import type { JoystickProps } from "./Joystick.types";

export type { JoystickMove, JoystickProps } from "./Joystick.types";

declare const Joystick: Component<JoystickProps>;

export default Joystick;
