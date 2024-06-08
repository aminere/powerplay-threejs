import { BufferGeometry, Line, LineBasicMaterial, Object3D, Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";

export class PathViewer extends Object3D {
    constructor() {
        super();
        const lineSegments = new Line(new BufferGeometry(), new LineBasicMaterial({ color: 0xffffff }));
        lineSegments.position.y = 0.01;
        this.add(lineSegments);
        this.name = "PathViewer";
        this.visible = false;
    }

    public setPath(mapCoords: Vector2[]) {
        const lines = this.children[0] as Line;
        lines.geometry.setFromPoints(mapCoords.map(p => GameUtils.mapToWorld(p, new Vector3())));
        lines.geometry.computeBoundingSphere();
    }

    public setPoints(worldPos: Vector3[]) {
        const lines = this.children[0] as Line;
        lines.geometry.setFromPoints(worldPos);
        lines.geometry.computeBoundingSphere();
    }
}

