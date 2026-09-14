export class Entity {
    constructor(world, context) {
        this.id = 0;
        this.spawnTime = 0;
        this.alive = false;
        this.kind = "";
        this.world = world;
        this.context = context;
    }
    get age() {
        return this.world.time - this.spawnTime;
    }
    get type() {
        return this.constructor.name;
    }
    onSpawn() { }
    onDestroy() { }
    destroy() {
        if (!this.alive) {
            return false;
        }
        this.alive = false;
        this.world.onEntityDestroy(this);
        return true;
    }
}
