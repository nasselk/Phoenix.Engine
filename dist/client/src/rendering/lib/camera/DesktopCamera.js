import { OrbitCamera } from "./Camera";
export class DesktopCamera extends OrbitCamera {
    constructor(options = {}) {
        super(options);
        this.pointer = -1;
        this.panPointer = -1;
        this.onPointerDown = (event) => {
            if (this.dragging && event.button === (this.free ? this.freeButton : this.button)) {
                this.pointer = event.pointerId;
                this.orbiting = true;
            }
            else if (this.free && event.button === this.panButton) {
                this.panPointer = event.pointerId;
            }
        };
        this.onPointerMove = (event) => {
            if (event.pointerId === this.pointer) {
                this.drag(event.movementX, event.movementY);
            }
            if (event.pointerId === this.panPointer) {
                this.pan(event.movementX, event.movementY);
            }
        };
        this.onPointerUp = (event) => {
            if (event.pointerId === this.pointer) {
                this.pointer = -1;
                this.orbiting = false;
            }
            if (event.pointerId === this.panPointer) {
                this.panPointer = -1;
            }
        };
        this.onWheel = (event) => {
            this.zoomByDelta(event.deltaY);
        };
        this.button = options.button ?? 0;
        this.freeButton = options.freeButton ?? 2;
        this.panButton = options.panButton ?? 0;
    }
    listen(element) {
        element.addEventListener("pointerdown", this.onPointerDown);
        element.addEventListener("wheel", this.onWheel, { passive: true });
        window.addEventListener("pointermove", this.onPointerMove);
        window.addEventListener("pointerup", this.onPointerUp);
        window.addEventListener("pointercancel", this.onPointerUp);
    }
    unlisten(element) {
        element.removeEventListener("pointerdown", this.onPointerDown);
        element.removeEventListener("wheel", this.onWheel);
        window.removeEventListener("pointermove", this.onPointerMove);
        window.removeEventListener("pointerup", this.onPointerUp);
        window.removeEventListener("pointercancel", this.onPointerUp);
        this.pointer = this.panPointer = -1;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRGVza3RvcENhbWVyYS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uL2NsaWVudC9zcmMvcmVuZGVyaW5nL2xpYi9jYW1lcmEvRGVza3RvcENhbWVyYS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsV0FBVyxFQUEyQixNQUFNLFVBQVUsQ0FBQztBQWFoRSxNQUFNLE9BQU8sYUFBYyxTQUFRLFdBQVc7SUEwQzdDLFlBQW1CLE9BQU8sR0FBeUIsRUFBRTtRQUNwRCxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUF0Q1IsWUFBTyxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBQ2IsZUFBVSxHQUFHLENBQUMsQ0FBQyxDQUFDO1FBRVAsa0JBQWEsR0FBRyxDQUFDLEtBQW1CLEVBQVEsRUFBRTtZQUM5RCxJQUFJLElBQUksQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDO2dCQUNuRixJQUFJLENBQUMsT0FBTyxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7Z0JBQy9CLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1lBQ3RCLENBQUM7aUJBQU0sSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLEtBQUssQ0FBQyxNQUFNLEtBQUssSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO2dCQUN6RCxJQUFJLENBQUMsVUFBVSxHQUFHLEtBQUssQ0FBQyxTQUFTLENBQUM7WUFDbkMsQ0FBQztRQUNGLENBQUMsQ0FBQztRQUVlLGtCQUFhLEdBQUcsQ0FBQyxLQUFtQixFQUFRLEVBQUU7WUFDOUQsSUFBSSxLQUFLLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxPQUFPLEVBQUUsQ0FBQztnQkFDdEMsSUFBSSxDQUFDLElBQUksQ0FBQyxL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