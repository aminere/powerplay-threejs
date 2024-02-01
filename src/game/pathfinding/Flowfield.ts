import { Vector2 } from "three";
import type { ICell, TFlowField } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { gameMapState } from "../components/GameMapState";

const { mapRes } = config.game;

function resetField(field: TFlowField) {
    if (field.length === 0) {
        const cellCount = mapRes * mapRes;
        for (let i = 0; i < cellCount; ++i) {
            field.push({
                integration: 0xffff,
                direction: new Vector2(),
                directionValid: false
            });
        }
    } else {
        for (const cell of field) {
            cell.integration = 0xffff;
            cell.directionValid = false;
        }
    }
}

function shiftSet(set: Set<number>) {
    for (const value of set) {
        set.delete(value);
        return value;
    }
}

class FlowField {
    public compute(targetCoords: Vector2, sectorCoordsOut: Vector2, localCoordsOut: Vector2) {
        const cell = GameUtils.getCell(targetCoords, sectorCoordsOut, localCoordsOut);
        if (!cell) {
            return false;
        }
        
        // TODO only recompute if the sector costs are dirty
        resetField(cell.flowField);
        const cellIndex = localCoordsOut.y * mapRes + localCoordsOut.x;
        cell.flowField[cellIndex].integration = 0;
        const openList = new Set<number>();
        openList.add(cellIndex);

        const sector = gameMapState.sectors.get(`${sectorCoordsOut.x},${sectorCoordsOut.y}`)!;
        const cells = sector.cells;
        const checkNeighbor = (neighborX: number, neighborY: number, currentIndex: number, diagonalCost: number) => {
            const neighborIndex = neighborY * mapRes + neighborX;
            const endNodeCost = cell.flowField[currentIndex].integration + cells[neighborIndex].flowFieldCost + diagonalCost;
            const neighborFlowfieldInfo = cell.flowField[neighborIndex];
            if (endNodeCost < neighborFlowfieldInfo.integration) {
                openList.add(neighborIndex);
                neighborFlowfieldInfo.integration = endNodeCost;
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
            if ((leftNeighborX >= 0 && topNeightborY >= 0) && (cells[leftNeighborIndex].flowFieldCost < 0xffff && cells[topNeighborIndex].flowFieldCost < 0xffff)) {
                checkNeighbor(leftNeighborX, topNeightborY, currentIndex, 1);
            }
            if ((rightNeighborX < mapRes && topNeightborY >= 0) && (cells[rightNeighborIndex].flowFieldCost < 0xffff && cells[topNeighborIndex].flowFieldCost < 0xffff)) {
                checkNeighbor(rightNeighborX, topNeightborY, currentIndex, 1);
            }
            if ((leftNeighborX >= 0 && bottomNeightborY < mapRes) && (cells[leftNeighborIndex].flowFieldCost < 0xffff && cells[bottomNeighborIndex].flowFieldCost < 0xffff)) {
                checkNeighbor(leftNeighborX, bottomNeightborY, currentIndex, 1);
            }
            if ((rightNeighborX < mapRes && bottomNeightborY < mapRes) && (cells[rightNeighborIndex].flowFieldCost < 0xffff && cells[bottomNeighborIndex].flowFieldCost < 0xffff)) {
                checkNeighbor(rightNeighborX, bottomNeightborY, currentIndex, 1);
            }
        }
        return true;
    }

    public computeDirection(flowField: TFlowField, cells: ICell[], cellIndex: number, directionOut: Vector2) {
        let minCost = 0xffff;
        let minIndex = -1;
        const considerNeighbor = (neighborX: number, neighborY: number) => {
            const neighborIndex = neighborY * mapRes + neighborX;
            const cost = flowField[neighborIndex].integration;
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
        if ((leftNeighborX >= 0 && topNeightborY >= 0) && (cells[leftNeighborIndex].flowFieldCost < 0xffff && cells[topNeighborIndex].flowFieldCost < 0xffff)) {
            considerNeighbor(leftNeighborX, topNeightborY);
        }
        if ((rightNeighborX < mapRes && topNeightborY >= 0) && (cells[rightNeighborIndex].flowFieldCost < 0xffff && cells[topNeighborIndex].flowFieldCost < 0xffff)) {
            considerNeighbor(rightNeighborX, topNeightborY);
        }
        if ((leftNeighborX >= 0 && bottomNeightborY < mapRes) && (cells[leftNeighborIndex].flowFieldCost < 0xffff && cells[bottomNeighborIndex].flowFieldCost < 0xffff)) {
            considerNeighbor(leftNeighborX, bottomNeightborY);
        }
        if ((rightNeighborX < mapRes && bottomNeightborY < mapRes) && (cells[rightNeighborIndex].flowFieldCost < 0xffff && cells[bottomNeighborIndex].flowFieldCost < 0xffff)) {
            considerNeighbor(rightNeighborX, bottomNeightborY);
        }
        if (minIndex >= 0) {
            const neighborY = Math.floor(minIndex / mapRes);
            const neighborX = minIndex - neighborY * mapRes;
            directionOut.set(neighborX - cellX, neighborY - cellY).normalize();
            return true;
        }
        directionOut.set(0, 0);
        return false;
    }
}

export const flowField = new FlowField();

