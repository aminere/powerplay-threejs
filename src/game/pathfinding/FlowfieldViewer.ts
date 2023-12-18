

import { BufferGeometry, LineBasicMaterial, LineSegments, Object3D, Points, PointsMaterial, Vector2, Vector3 } from "three";
import { pools } from "../../engine/Pools";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { ISector } from "../GameTypes";

export class FlowfieldViewer extends Object3D {
    constructor() {
        super();
        const lineSegments = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xff0000 }));
        lineSegments.position.y = 0.05;
        this.add(lineSegments);
        const points = new Points(new BufferGeometry(), new PointsMaterial({ color: 0xff0000, size: 5 }));
        points.position.y = 0.05;
        this.add(points);
    }

    public update(sector: ISector, localCoords: Vector2) {
        const { mapRes } = config.game;
        const linePoints = new Array<Vector3>();
        const [currentCoords, neighborCoords] = pools.vec2.get(2);
        const [worldPos1, worldPos2, direction] = pools.vec3.get(3);
        const { costs, integrations } = sector.flowField;
        for (let i = 0; i < sector.cells.length; i++) {
            const cellY = Math.floor(i / mapRes);
            const cellX = i - cellY * mapRes;
            if (cellX === localCoords.x && cellY === localCoords.y) {
                continue;
            }
            const cost = costs[i];
            if (cost === 0xffff) {
                continue;
            }

            let minCost = 0xffff;
            let minIndex = -1;
            const considerNeighbor = (neighborX: number, neighborY: number) => {
                const neighborIndex = neighborY * mapRes + neighborX;
                const cost = integrations[neighborIndex];
                if (cost < minCost) {
                    minCost = cost;
                    minIndex = neighborIndex;
                }
            }

            for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const neighborX = cellX + x;
                const neighborY = cellY + y;
                if (neighborX < 0 || neighborX >= mapRes || neighborY < 0 || neighborY >= mapRes) {
                    continue;
                }
                considerNeighbor(neighborX, neighborY);
            }

            // check diagonal neighbors
            const leftNeighborX = cellX - 1;
            const leftNeightborY = cellY;
            const leftNeighborIndex = leftNeightborY * mapRes + leftNeighborX;
            const rightNeighborX = cellX + 1;
            const rightNeightborY = cellY;
            const rightNeighborIndex = rightNeightborY * mapRes + rightNeighborX;
            const topNeighborX = cellX;
            const topNeightborY = cellY - 1;
            const topNeighborIndex = topNeightborY * mapRes + topNeighborX;
            const bottomNeighborX = cellX;
            const bottomNeightborY = cellY + 1;
            const bottomNeighborIndex = bottomNeightborY * mapRes + bottomNeighborX;
            if ((leftNeighborX >= 0 && topNeightborY >= 0) && (costs[leftNeighborIndex] < 0xffff || costs[topNeighborIndex] < 0xffff)) {
                considerNeighbor(leftNeighborX, topNeightborY);
            }
            if ((rightNeighborX < mapRes && topNeightborY >= 0) && (costs[rightNeighborIndex] < 0xffff || costs[topNeighborIndex] < 0xffff)) {
                considerNeighbor(rightNeighborX, topNeightborY);
            }
            if ((leftNeighborX >= 0 && bottomNeightborY < mapRes) && (costs[leftNeighborIndex] < 0xffff || costs[bottomNeighborIndex] < 0xffff)) {
                considerNeighbor(leftNeighborX, bottomNeightborY);
            }
            if ((rightNeighborX < mapRes && bottomNeightborY < mapRes) && (costs[rightNeighborIndex] < 0xffff || costs[bottomNeighborIndex] < 0xffff)) {
                considerNeighbor(rightNeighborX, bottomNeightborY);
            }
            if (minIndex >= 0) {
                currentCoords.set(cellX, cellY);
                const neighborY = Math.floor(minIndex / mapRes);
                const neighborX = minIndex - neighborY * mapRes;
                neighborCoords.set(neighborX, neighborY);
                GameUtils.mapToWorld(currentCoords, worldPos1);
                GameUtils.mapToWorld(neighborCoords, worldPos2);
                direction.subVectors(worldPos2, worldPos1).normalize();
                linePoints.push(worldPos1.clone());
                linePoints.push(worldPos1.clone().addScaledVector(direction, 0.5));
            }
        }
        const lines = this.children[0] as LineSegments;
        lines.geometry.setFromPoints(linePoints);
        lines.geometry.computeBoundingSphere();
        const points = this.children[1] as Points;
        const pointCoords = linePoints.filter((_, i) => i % 2 !== 0);
        points.geometry.setFromPoints(pointCoords);
        points.geometry.computeBoundingSphere();
    }
}

