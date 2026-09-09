export class Entity {
    constructor() {
        this.id = 0;
        this.spawnTime = 0;
        this.alive = false;
        this.kind = "";
    }
    get type() {
        return this.constructor.name;
    }
    get age() {
        return this.world.time - this.spawnTime;
    }
    update(_deltaTime) { }
    onSpawn() { }
    onDestroy() { }
    destroy() {
        this.world?.destroy(this);
    }
}
