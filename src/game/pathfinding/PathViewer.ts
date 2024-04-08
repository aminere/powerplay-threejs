import { BufferGeometry, Line, LineBasicMaterial, Object3D, Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";

export class PathViewer extends Object3D {
    constructor() {
        super();
        const lineSegments = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0x0000ff }));
        lineSegments.position.y = 0.05;
        this.add(lineSegments);
        this.name = "PathViewer";
        this.visible = false;
    }

    public update(path: Vector2[]) {
        this.visible = true;
        const lines = this.children[0] as Line;
        lines.geometry.setFromPoints(path.map(p => {
            return GameUtils.mapToWorld(p, new Vector3());
        }));
        lines.geometry.computeBoundingSphere();
    }
}

