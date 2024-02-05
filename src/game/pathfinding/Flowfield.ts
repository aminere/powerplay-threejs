import { Vector2 } from "three";
import type { ICell, TFlowField } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { pools } from "../../engine/Pools";
import { ICellAddr } from "../unit/UnitUtils";

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
    openList: Set<Vector2>;
}

const sectorCoordsOut2 = new Vector2();
const localCoordsOut2 = new Vector2();
function processNeighbor(currentCoords: Vector2, neighborCell: ICell, neighborAddr: ICellAddr, diagonalCost: number, context: IFlowfieldContext) {
    const currentCell = GameUtils.getCell(currentCoords, sectorCoordsOut2, localCoordsOut2);
    console.assert(currentCell);
    const flowField = getFlowfield(context.targetCell, context.targetCellSectorCoords, sectorCoordsOut2);
    const currentIndex = localCoordsOut2.y * mapRes + localCoordsOut2.x;
    const endNodeCost = flowField[currentIndex].integration + neighborCell.flowFieldCost + diagonalCost;
    const neighborFlowfield = getFlowfield(context.targetCell, context.targetCellSectorCoords, neighborAddr.sectorCoords);
    if (!neighborFlowfield) {
        debugger;
    }
    const neighborFlowfieldInfo = neighborFlowfield[neighborAddr.cellIndex];
    if (endNodeCost < neighborFlowfieldInfo.integration) {
        context.openList.add(neighborAddr.mapCoords.clone());
        neighborFlowfieldInfo.integration = endNodeCost;
    }
};

const neighborCoords = new Vector2();
const context: IFlowfieldContext = {
    targetCell: null as any,
    targetCellSectorCoords: new Vector2(),
    openList: new Set<Vector2>()
};

class FlowField {

    private _neighborAddr: ICellAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0,
    };

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
        context.openList.add(targetCoords.clone());
        context.targetCell = cell;
        context.targetCellSectorCoords.copy(sectorCoordsOut);
        while (context.openList.size > 0) {
            const currentCoords = shiftSet(context.openList)!;

            for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                this._neighborAddr.mapCoords.set(currentCoords.x + dx, currentCoords.y + dy);
                const neighborCell = GameUtils.getCell(this._neighborAddr.mapCoords, this._neighborAddr.sectorCoords, this._neighborAddr.localCoords);
                if (!neighborCell) {
                    continue;
                }

                const includedSector = sectors.find(s => s.equals(this._neighborAddr.sectorCoords));
                if (!includedSector) {
                    continue;
                }
                
                this._neighborAddr.cellIndex = this._neighborAddr.localCoords.y * mapRes + this._neighborAddr.localCoords.x;
                processNeighbor(currentCoords, neighborCell, this._neighborAddr, 0, context);
            }

            // check diagonal neighbors
            for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                this._neighborAddr.mapCoords.set(currentCoords.x + dx, currentCoords.y + dy);
                const neighborCell = GameUtils.getCell(this._neighborAddr.mapCoords, this._neighborAddr.sectorCoords, this._neighborAddr.localCoords)!;
                if (!neighborCell) {
                    continue;
                }

                const includedSector = sectors.find(s => s.equals(this._neighborAddr.sectorCoords));
                if (!includedSector) {
                    continue;
                }

                neighborCoords.set(currentCoords.x + dx, currentCoords.y);
                const lateralCell = GameUtils.getCell(neighborCoords)!;
                console.assert(lateralCell);                
                if (lateralCell.flowFieldCost === 0xffff) {
                    // don't navigate diagonally near obstacles
                    continue;
                }
                neighborCoords.set(currentCoords.x, currentCoords.y + dy);
                const verticalCell = GameUtils.getCell(neighborCoords)!;
                if (!verticalCell) {
                    debugger;
                }
                console.assert(verticalCell);
                if (verticalCell.flowFieldCost === 0xffff) {
                    // don't navigate diagonally near obstacles
                    continue;
                }

                this._neighborAddr.cellIndex = this._neighborAddr.localCoords.y * mapRes + this._neighborAddr.localCoords.x;
                processNeighbor(currentCoords, neighborCell, this._neighborAddr, 1, context);
            }            
        }
        return true;
    }

    public computeDirection(mapCoords: Vector2, targetCell: ICell, targetCellSector: Vector2, directionOut: Vector2) {        
        let minCost = 0xffff;
        const minNeighbor = pools.vec2.getOne();       

        const isSectorIncluded = (sectorCoords: Vector2) => {
            if (sectorCoords.equals(targetCellSector)) {
                return true;
            }
            if (targetCell.flowFieldsPerSector.size > 0) {
                for (const sectorId of targetCell.flowFieldsPerSector.keys()) {
                    const [sectorX, sectorY] = sectorId.split(",").map(Number);
                    if (sectorX === sectorCoords.x && sectorY === sectorCoords.y) {
                        return true;
                    }
                }
            }
            return false;
        };

        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
            this._neighborAddr.mapCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighbor = GameUtils.getCell(this._neighborAddr.mapCoords, this._neighborAddr.sectorCoords, this._neighborAddr.localCoords);
            if (!neighbor) {
                continue;
            }

            const includedSector = isSectorIncluded(this._neighborAddr.sectorCoords);
            if (!includedSector) {
                continue;
            }

            const flowField = getFlowfield(targetCell, targetCellSector, this._neighborAddr.sectorCoords);
            const neighborIndex = this._neighborAddr.localCoords.y * mapRes + this._neighborAddr.localCoords.x;
            const cost = flowField[neighborIndex].integration;
            if (cost < minCost) {
                minCost = cost;
                minNeighbor.copy(this._neighborAddr.mapCoords);
            }
        }

        for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
            this._neighborAddr.mapCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighbor = GameUtils.getCell(this._neighborAddr.mapCoords, this._neighborAddr.sectorCoords, this._neighborAddr.localCoords);
            if (!neighbor) {
                continue;
            }

            const includedSector = isSectorIncluded(this._neighborAddr.sectorCoords);
            if (!includedSector) {
                continue;
            }

            neighborCoords.set(mapCoords.x + dx, mapCoords.y);
            const lateralCell = GameUtils.getCell(neighborCoords)!;
            console.assert(lateralCell);
            if (lateralCell.flowFieldCost === 0xffff) {
                // don't navigate diagonally near obstacles
                continue;
            }
            neighborCoords.set(mapCoords.x, mapCoords.y + dy);
            const verticalCell = GameUtils.getCell(neighborCoords)!;
            console.assert(verticalCell);            
            if (verticalCell.flowFieldCost === 0xffff) {
                // don't navigate diagonally near obstacles
                continue;
            }

            const flowField = getFlowfield(targetCell, targetCellSector, this._neighborAddr.sectorCoords);
            const neighborIndex = this._neighborAddr.localCoords.y * mapRes + this._neighborAddr.localCoords.x;
            const cost = flowField[neighborIndex].integration;
            if (cost < minCost) {
                minCost = cost;
                minNeighbor.copy(this._neighborAddr.mapCoords);
            }
        }

        if (minCost < 0xffff) {
            directionOut.set(minNeighbor.x - mapCoords.x, minNeighbor.y - mapCoords.y).normalize();
            return true;
        }
        directionOut.set(0, 0);
        return false;
    }
}

export const flowField = new FlowField();

