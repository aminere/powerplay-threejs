import { Vector2 } from "three";
import type { ICell, TFlowField } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { pools } from "../../engine/Pools";

const { mapRes } = config.game;
const cellCount = mapRes * mapRes;

function initFlowField(flowField: TFlowField[]) {
    for (let i = 0; i < cellCount; ++i) {
        flowField.push({
            integration: 0xffff,
            direction: new Vector2(),
            directionValid: false
        });
    }
}

function resetField(flowField: TFlowField[]) {
    if (flowField.length === 0) {
        initFlowField(flowField);

    } else {
        for (const elem of flowField) {
            elem.integration = 0xffff;
            elem.directionValid = false;
        }
    }
}

function shiftSet<T>(set: Set<T>) {
    for (const value of set) {
        set.delete(value);
        return value;
    }
}

export function getFlowfield(cell: ICell, cellSectorCoords: Vector2, targetSectorCoords: Vector2) {
    if (targetSectorCoords.equals(cellSectorCoords)) {
        return cell.flowField;
    } else {
        return cell.flowFieldsPerSector.get(`${targetSectorCoords.x},${targetSectorCoords.y}`)!;
    }
}

interface IFlowfieldContext {
    targetCell: ICell;
    targetCellSectorCoords: Vector2;
    openList: Set<string>;
    sectors: Vector2[];
}

const sectorCoordsOut2 = new Vector2();
const localCoordsOut2 = new Vector2();
const sectorCoordsOut3= new Vector2();
const localCoordsOut3 = new Vector2();
function processNeighbor(currentCoords: Vector2, neighborCoord: Vector2, diagonalCost: number, context: IFlowfieldContext) {
    // console.log(`processing neighbor ${neighborCoord.x},${neighborCoord.y}`);
    const neighborCell = GameUtils.getCell(neighborCoord, sectorCoordsOut3, localCoordsOut3);
    if (!neighborCell) {
        // console.log(`no neighbor cell at ${neighborCoord.x},${neighborCoord.y}`);
        return;
    }

    const currentCell = GameUtils.getCell(currentCoords, sectorCoordsOut2, localCoordsOut2);
    console.assert(currentCell);
    const flowField = getFlowfield(context.targetCell, context.targetCellSectorCoords, sectorCoordsOut2);
    const currentIndex = localCoordsOut2.y * mapRes + localCoordsOut2.x;
    const endNodeCost = flowField[currentIndex].integration + neighborCell.flowFieldCost + diagonalCost;
    const neighborIndex = localCoordsOut3.y * mapRes + localCoordsOut3.x;
    const neighborFlowfield = getFlowfield(context.targetCell, context.targetCellSectorCoords, sectorCoordsOut3);
    const neighborFlowfieldInfo = neighborFlowfield[neighborIndex];
    if (endNodeCost < neighborFlowfieldInfo.integration) {
        context.openList.add(`${neighborCoord.x},${neighborCoord.y}`);
        neighborFlowfieldInfo.integration = endNodeCost;
    }
};

const neighborCoords = new Vector2();
function processDiagonalNeighbor(currentCoords: Vector2, dx: number, dy: number, context: IFlowfieldContext) {    
    // console.log(`processing diagonal neighbor ${currentCoords.x + dx},${currentCoords.y + dy}`);
    neighborCoords.set(currentCoords.x + dx, currentCoords.y + dy);
    const neighbor = GameUtils.getCell(neighborCoords, sectorCoordsOut2, localCoordsOut2)!;
    if (!neighbor) {
        return;
    }
    const includedSector = context.sectors.find(s => s.equals(sectorCoordsOut2));
    if (!includedSector) {
        // console.log(`sector not included ${sectorCoordsOut2.x},${sectorCoordsOut2.y}`);
        return;
    }

    neighborCoords.set(currentCoords.x + dx, currentCoords.y);    
    const lateralCell = GameUtils.getCell(neighborCoords, sectorCoordsOut2, localCoordsOut2);
    console.assert(lateralCell);
    const lateralSector = GameUtils.getSector(sectorCoordsOut2)!;
    const lateralIndex = localCoordsOut2.y * mapRes + localCoordsOut2.x;
    const lateralCost = lateralSector.cells[lateralIndex].flowFieldCost;
    if (lateralCost === 0xffff) {
        // don't navigate diagonally near obstacles
        return;
    }
    neighborCoords.set(currentCoords.x, currentCoords.y + dy);
    const verticalCell = GameUtils.getCell(neighborCoords, sectorCoordsOut2, localCoordsOut2);
    console.assert(verticalCell);
    const verticalSector = GameUtils.getSector(sectorCoordsOut2)!;
    const verticalIndex = localCoordsOut2.y * mapRes + localCoordsOut2.x;
    const verticalCost = verticalSector.cells[verticalIndex].flowFieldCost;
    if (verticalCost === 0xffff) {
        // don't navigate diagonally near obstacles
        return;
    }

    neighborCoords.set(currentCoords.x + dx, currentCoords.y + dy);
    processNeighbor(currentCoords, neighborCoords, 1, context);
}

const context: IFlowfieldContext = {
    targetCell: null as any,
    targetCellSectorCoords: new Vector2(),
    openList: new Set<string>(),
    sectors: []
};

class FlowField {
    public compute(targetCoords: Vector2, sectors: Vector2[]) {

        const [sectorCoordsOut, localCoordsOut] = pools.vec2.get(2);
        const cell = GameUtils.getCell(targetCoords, sectorCoordsOut, localCoordsOut);
        if (!cell) {
            return false;
        }
        
        // TODO only recompute if the sector costs are dirty
        resetField(cell.flowField);
        cell.flowFieldsPerSector.clear();
        if (sectors.length > 1) {
            for (let i = 0; i < sectors.length - 1; ++i) {
                const sectorCoord = sectors[i];
                const flowField = new Array<TFlowField>();
                initFlowField(flowField);
                cell.flowFieldsPerSector.set(`${sectorCoord.x},${sectorCoord.y}`, flowField);
            }
        }

        const cellIndex = localCoordsOut.y * mapRes + localCoordsOut.x;
        cell.flowField[cellIndex].integration = 0;

        context.openList.clear();
        context.openList.add(`${targetCoords.x},${targetCoords.y}`);
        context.targetCell = cell;
        context.targetCellSectorCoords.copy(sectorCoordsOut);
        context.sectors = sectors;
        const currentCoords = pools.vec2.getOne();
        while (context.openList.size > 0) {
            const currentCoordsStr = shiftSet(context.openList)!;
            const [currentX, currentY] = currentCoordsStr.split(",").map(Number);
            currentCoords.set(currentX, currentY);

            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const neighborX = currentX + dx;
                const neighborY = currentY + dy;
                neighborCoords.set(neighborX, neighborY);

                const neighborCell = GameUtils.getCell(neighborCoords, sectorCoordsOut2);
                if (!neighborCell) {
                    // console.log(`no neighbor cell at ${neighborX},${neighborY}`);
                    continue;
                }

                const includedSector = sectors.find(s => s.equals(sectorCoordsOut2));
                if (!includedSector) {
                    // console.log(`sector not included ${sectorCoordsOut2.x},${sectorCoordsOut2.y}`);
                    continue;
                }
                
                processNeighbor(currentCoords, neighborCoords, 0, context);
            }

            // check diagonal neighbors
            processDiagonalNeighbor(currentCoords, -1, -1, context);
            processDiagonalNeighbor(currentCoords, 1, -1, context);
            processDiagonalNeighbor(currentCoords, -1, 1, context);
            processDiagonalNeighbor(currentCoords, 1, 1, context);
        }
        return true;
    }

    public computeDirection(flowField: TFlowField[], cells: ICell[], cellIndex: number, directionOut: Vector2) {
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
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            const neighborX = cellX + dx;
            const neighborY = cellY + dy;
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

