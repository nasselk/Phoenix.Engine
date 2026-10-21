export class Entity {
    constructor(world, context) {
        this.id = 0;
        this.spawnTime = 0;
        this.alive = false;
        this.kind = "";
        this.world = world;
        this.context = context;
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
    get age() {
        return this.world.time - this.spawnTime;
    }
    get type() {
        return this.constructor.name;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZW50aXR5LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vc2hhcmVkL3dvcmxkL2VudGl0eS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFPQSxNQUFNLE9BQWdCLE1BQU07SUFTM0IsWUFBbUIsS0FBMkIsRUFBRSxPQUFVO1FBUm5ELE9BQUUsR0FBRyxDQUFDLENBQUM7UUFJUCxjQUFTLEdBQUcsQ0FBQyxDQUFDO1FBQ2QsVUFBSyxHQUFHLEtBQUssQ0FBQztRQUNkLFNBQUksR0FBRyxFQUFFLENBQUM7UUFHaEIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7UUFDbkIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDeEIsQ0FBQztJQUlNLE9BQU8sS0FBVSxDQUFDO0lBRWxCLFNBQVMsS0FBVSxDQUFDO0lBRXBCLE9BQU87UUFDYixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ2pCLE9BQU8sS0FBSyxDQUFDO1FBQ2QsQ0FBQztRQUdELElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxDQUFDO1FBRW5CLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWpDLE9BQU8sSUFBSSxDQUFDO0lBQ2IsQ0FBQztJQUVELElBQVcsR0FBRztRQUNiLE9BQU8sSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztJQUN6QyxDQUFDO0lBRUQsSUFBVyxJQUFJO1FBQ2QsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztJQUM5QixDQUFDO0NBQ0QifQ==