

import { BufferGeometry, LineBasicMaterial, LineSegments, Object3D, Points, PointsMaterial, Vector2, Vector3 } from "three";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { ISector, TFlowField } from "../GameTypes";
import { flowField } from "./Flowfield";

const currentCoords = new Vector2();
const cellDirection = new Vector2();
const worldPos1 = new Vector3();
const cellDirection3 = new Vector3();
const { mapRes, cellSize } = config.game;
const linePoints = new Array<Vector3>();

export class FlowfieldViewer extends Object3D {
    constructor() {
        super();
        const lineSegments = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xff0000 }));
        lineSegments.position.y = 0.05;
        this.add(lineSegments);
        const points = new Points(new BufferGeometry(), new PointsMaterial({ color: 0xff0000, size: 5, sizeAttenuation: false }));
        points.position.y = 0.05;
        this.add(points);
        this.name = "flowfield";
    }

    public update(sector: ISector, field: TFlowField[]) {
        const { mapRes } = config.game;
        const cells = sector.cells;
        linePoints.length = 0;
        for (let i = 0; i < cells.length; i++) {
            const cellY = Math.floor(i / mapRes);
            const cellX = i - cellY * mapRes;
            const cost = cells[i].flowFieldCost;
            if (cost === 0xffff || field[i].integration === 0) {
                continue;
            }
            const computed = flowField.computeDirection(field, cells, i, cellDirection);
            if (computed) {
                currentCoords.set(cellX, cellY);
                GameUtils.mapToWorld(currentCoords, worldPos1);
                linePoints.push(worldPos1.clone());
                cellDirection3.set(cellDirection.x, 0, cellDirection.y);
                linePoints.push(worldPos1.clone().addScaledVector(cellDirection3, 0.5));
            }           
        }
        const lines = this.children[0] as LineSegments;
        lines.geometry.setFromPoints(linePoints);
        lines.geometry.computeBoundingSphere();
        const points = this.children[1] as Points;
        const pointCoords = linePoints.filter((_, i) => i % 2 !== 0);
        points.geometry.setFromPoints(pointCoords);
        points.geometry.computeBoundingSphere();
        this.position.copy(sector.root.position).negate();
    }
}

