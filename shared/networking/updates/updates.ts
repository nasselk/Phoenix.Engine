/**
 * Which slot a `cooldown` message targets, encoded as a 2-bit field on the wire.
 * The numeric order IS the encoding — never reorder, only append (and only up to 4 fit in 2 bits).
 * Note `diving` here is the server-side name; the client HUD store calls that slot `dive`.
 */
export enum CooldownSlot {
	ability1,
	ability2,
	diving,
	arena,
}

// All these updates "sub events" are included in the worldUpdate event
export enum Updates {
	// Only to self
	xp,
	resource,
	oxygen,
	coins,
	cooldown,
	canUseAbility,
	arenaRequest,
	serverMessage,
	camera,
	apexes,

	// To all players near
	position,
	createEntity,
	destroyEntity,
	becomeDynamic,
	becomeStatic,
	resize,
	chatMessage,

	// To whole server
	minimap,
	leaderboard,
	playerCount,
}
