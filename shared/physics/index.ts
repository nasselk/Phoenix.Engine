// What both sides agree on about the physics. The simulation itself is Rapier's, in ./rapier, which
// each side's entry point exports itself: it is about a megabyte of WebAssembly, compressed, that a
// side only pays for if it simulates.
export { EPSILON, GRAVITY } from "./constants";
