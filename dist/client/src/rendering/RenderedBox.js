import { BoxGeometry, Mesh, MeshLambertMaterial } from "three";
import { BoxEntity } from "../../../shared/world/entities/box";
const UNIT_CUBE = new BoxGeometry(1, 1, 1);
const MATERIALS = new Map();
const materialFor = (rgb) => {
    let material = MATERIALS.get(rgb);
    if (material === undefined) {
        material = new MeshLambertMaterial({ color: rgb });
        MATERIALS.set(rgb, material);
    }
    return material;
};
export class RenderedBox extends BoxEntity {
    constructor(view = RenderedBox.view, x, y, z, width, height, depth, color) {
        super(x, y, z, width, height, depth, color);
        this.view = view;
        this.mesh = new Mesh(UNIT_CUBE, materialFor(this.color));
        this.drawn = this.color;
    }
    onSpawn() {
        this.draw();
        this.view.add(this.mesh);
    }
    update(deltaTime) {
        super.update(deltaTime);
        this.draw();
    }
    onDestroy() {
        this.view.remove(this.mesh);
    }
    draw() {
        const { position } = this;
        this.mesh.position.set(position.x, position.y, position.z);
        this.mesh.scale.set(this.width, this.height, this.depth);
        if (this.color !== this.drawn) {
            this.drawn = this.color;
            this.mesh.material = materialFor(this.color);
        }
    }
    static disposeMaterials() {
        for (const material of MATERIALS.values()) {
            material.dispose();
        }
        MATERIALS.clear();
    }
}
