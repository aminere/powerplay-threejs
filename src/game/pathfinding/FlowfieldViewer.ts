

import { BufferGeometry, LineBasicMaterial, LineSegments, Object3D, Points, PointsMaterial, Vector2, Vector3 } from "three";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { ISector } from "../GameTypes";
import { flowField } from "./Flowfield";
import { pools } from "../../engine/Pools";

const currentCoords = new Vector2();
const cellDirection = new Vector2();
const worldPos1 = new Vector3();
const cellDirection3 = new Vector3();
const { mapRes, cellSize } = config.game;
const mapSize = mapRes * cellSize;
export class FlowfieldViewer extends Object3D {
    constructor() {
        super();
        const lineSegments = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xff0000 }));
        lineSegments.position.y = 0.05;
        this.add(lineSegments);
        const points = new Points(new BufferGeometry(), new PointsMaterial({ color: 0xff0000, size: 5, sizeAttenuation: false }));
        points.position.y = 0.05;
        this.add(points);
    }

    public update(sector: ISector, localCoords: Vector2) {
        const { mapRes } = config.game;
        const linePoints = new Array<Vector3>();
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        const cell = sector.cells[cellIndex];
        const cells = sector.cells;
        for (let i = 0; i < cells.length; i++) {
            const cellY = Math.floor(i / mapRes);
            const cellX = i - cellY * mapRes;
            if (cellX === localCoords.x && cellY === localCoords.y) {
                continue;
            }
            const cost = cells[i].flowFieldCost;
            if (cost === 0xffff) {
                continue;
            }
            const computed = flowField.computeDirection(cell.flowField, cells, i, cellDirection);
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

        const offset = pools.vec3.getOne();
        offset.set(mapSize / 2, 0, mapSize / 2);
        this.position.copy(sector.root.position).add(offset);
    }
}

