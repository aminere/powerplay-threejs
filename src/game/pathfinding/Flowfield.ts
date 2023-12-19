import { Vector2 } from "three";
import { IFlowField } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { pools } from "../../engine/Pools";
import { gameMapState } from "../components/GameMapState";
import { config } from "../config";

function resetField(field: IFlowField) {
    const { integrations, directions } = field;
    for (let i = 0; i < integrations.length; i++) {
        integrations[i] = 0xffff;
        directions[i][1] = false;
    }
}

function shiftSet(set: Set<number>) {
    for (const value of set) {
        set.delete(value);
        return value;
    }
}

class FlowField {
    public compute(targetCoords: Vector2, localCoordsOut: Vector2) {
        const sectorCoords = pools.vec2.getOne();
        const cell = GameUtils.getCell(targetCoords, sectorCoords, localCoordsOut);
        if (cell && GameUtils.isEmpty(cell)) {
            const sector = gameMapState.sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;

            resetField(sector.flowField);
            const { mapRes } = config.game;
            const { costs, integrations } = sector.flowField;
            const cellIndex = localCoordsOut.y * mapRes + localCoordsOut.x;
            integrations[cellIndex] = 0;
            const openList = new Set<number>();
            openList.add(cellIndex);

            const checkNeighbor = (neighborX: number, neighborY: number, currentIndex: number, diagonalCost: number) => {
                const neighborIndex = neighborY * mapRes + neighborX;
                const endNodeCost = integrations[currentIndex] + costs[neighborIndex] + diagonalCost;
                if (endNodeCost < integrations[neighborIndex]) {
                    openList.add(neighborIndex);
                    integrations[neighborIndex] = endNodeCost;
                }
            };

            while (openList.size > 0) {
                const currentIndex = shiftSet(openList)!;
                const currentY = Math.floor(currentIndex / mapRes);
                const currentX = currentIndex - currentY * mapRes;
                for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                    const neighborX = currentX + x;
                    const neighborY = currentY + y;
                    if (neighborX < 0 || neighborX >= mapRes || neighborY < 0 || neighborY >= mapRes) {
                        continue;
                    }
                    checkNeighbor(neighborX, neighborY, currentIndex, 0);
                }

                // check diagonal neighbors
                const leftNeighborX = currentX - 1;
                const leftNeightborY = currentY;
                const leftNeighborIndex = leftNeightborY * mapRes + leftNeighborX;
                const rightNeighborX = currentX + 1;
                const rightNeightborY = currentY;
                const rightNeighborIndex = rightNeightborY * mapRes + rightNeighborX;
                const topNeighborX = currentX;
                const topNeightborY = currentY - 1;
                const topNeighborIndex = topNeightborY * mapRes + topNeighborX;
                const bottomNeighborX = currentX;
                const bottomNeightborY = currentY + 1;
                const bottomNeighborIndex = bottomNeightborY * mapRes + bottomNeighborX;
                if ((leftNeighborX >= 0 && topNeightborY >= 0) && (costs[leftNeighborIndex] < 0xffff || costs[topNeighborIndex] < 0xffff)) {
                    checkNeighbor(leftNeighborX, topNeightborY, currentIndex, 1);
                }
                if ((rightNeighborX < mapRes && topNeightborY >= 0) && (costs[rightNeighborIndex] < 0xffff || costs[topNeighborIndex] < 0xffff)) {
                    checkNeighbor(rightNeighborX, topNeightborY, currentIndex, 1);
                }
                if ((leftNeighborX >= 0 && bottomNeightborY < mapRes) && (costs[leftNeighborIndex] < 0xffff || costs[bottomNeighborIndex] < 0xffff)) {
                    checkNeighbor(leftNeighborX, bottomNeightborY, currentIndex, 1);
                }
                if ((rightNeighborX < mapRes && bottomNeightborY < mapRes) && (costs[rightNeighborIndex] < 0xffff || costs[bottomNeighborIndex] < 0xffff)) {
                    checkNeighbor(rightNeighborX, bottomNeightborY, currentIndex, 1);
                }
            }
            return sector;
        }
        return null;
    }

    public computeDirection(flowField: IFlowField, cellIndex: number, directionOut: Vector2) {
        const { costs, integrations } = flowField;
        const { mapRes } = config.game;
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

        const cellY = Math.floor(cellIndex / mapRes);
        const cellX = cellIndex - cellY * mapRes;
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
            const neighborY = Math.floor(minIndex / mapRes);
            const neighborX = minIndex - neighborY * mapRes;
            directionOut.set(neighborX - cellX, neighborY - cellY).normalize();
            return true;
        }
        return false;
    }
}

export const flowField = new FlowField();

