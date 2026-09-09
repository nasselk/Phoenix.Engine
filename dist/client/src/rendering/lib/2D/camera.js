export class Camera {
    constructor(x = 0, y = 0, zoom = 1, angle = 0) {
        this.x = x;
        this.y = y;
        this.zoom = zoom;
        this.angle = angle;
    }
    move(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    transform(container, width, height) {
        container.pivot.set(this.x, this.y);
        container.position.set(width / 2, height / 2);
        container.scale.set(this.zoom);
        container.rotation = this.angle;
        return this;
    }
    revertTransform(container, width, height) {
        container.pivot.set(0, 0);
        container.position.set(width / 2, height / 2);
        container.scale.set(1);
        container.rotation = 0;
        return this;
    }
    toWorld(screenX, screenY, width, height) {
        const dx = (screenX - width / 2) / this.zoom;
        const dy = (screenY - height / 2) / this.zoom;
        const cos = Math.cos(-this.angle);
        const sin = Math.sin(-this.angle);
        return { x: this.x + dx * cos - dy * sin, y: this.y + dx * sin + dy * cos };
    }
    toScreen(worldX, worldY, width, height) {
        const dx = worldX - this.x;
        const dy = worldY - this.y;
        const cos = Math.cos(this.angle);
        const sin = Math.sin(this.angle);
        return { x: width / 2 + (dx * cos - dy * sin) * this.zoom, y: height / 2 + (dx * sin + dy * cos) * this.zoom };
    }
}
