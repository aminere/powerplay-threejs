import { Vector2 } from "three";
import type { ICell } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { pools } from "../../engine/Pools";
import { unitMotion } from "../unit/UnitMotion";
import { IUnitAddr } from "../unit/UnitAddr";

export type TFlowField = {
    integration: number;
    direction: Vector2;
    directionValid: boolean;
};

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

// function resetField(flowField: TFlowField[]) {
//     if (flowField.length === 0) {
//         initFlowField(flowField);

//     } else {
//         for (const elem of flowField) {
//             elem.integration = 0xffff;
//             elem.directionValid = false;
//         }
//     }
// }

function shiftSet<T>(set: Set<T>) {
    for (const value of set) {
        set.delete(value);
        return value;
    }
}

interface IFlowfieldContext {
    targetCell: ICell;
    targetCellSectorCoords: Vector2;
    openList: Set<string>;
    flowfields: Map<string, TFlowField[]>;
}

const sectorCoordsOut2 = new Vector2();
const localCoordsOut2 = new Vector2();
function processNeighbor(currentCoords: Vector2, neighborCell: ICell, neighborAddr: IUnitAddr, context: IFlowfieldContext) {
    const currentCell = GameUtils.getCell(currentCoords, sectorCoordsOut2, localCoordsOut2);
    console.assert(currentCell);
    const flowField = context.flowfields.get(`${sectorCoordsOut2.x},${sectorCoordsOut2.y}`)!;
    const currentIndex = localCoordsOut2.y * mapRes + localCoordsOut2.x;
    const endNodeCost = flowField[currentIndex].integration + neighborCell.flowFieldCost;
    const neighborFlowfield = context.flowfields.get(`${neighborAddr.sectorCoords.x},${neighborAddr.sectorCoords.y}`)!;
    const neighborFlowfieldInfo = neighborFlowfield[neighborAddr.cellIndex];
    if (endNodeCost < neighborFlowfieldInfo.integration) {
        context.openList.add(`${neighborAddr.mapCoords.x},${neighborAddr.mapCoords.y}`);
        neighborFlowfieldInfo.integration = endNodeCost;
    }
};

const context: IFlowfieldContext = {
    targetCell: null as any,
    targetCellSectorCoords: new Vector2(),
    openList: new Set<string>(),
    flowfields: new Map<string, TFlowField[]>()
};

const gridNeighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const diagonalNeighbors = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const neighborCoords = new Vector2();
const visited = new Map<string, boolean>();

class FlowField {

    private _neighborAddr: IUnitAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0,
    };

    // private _cache = new Map<string, TFlowField[]>();
    public compute(targetCoords: Vector2, sectors: Vector2[]) {

        const [sectorCoordsOut, localCoordsOut] = pools.vec2.get(2);
        const cell = GameUtils.getCell(targetCoords, sectorCoordsOut, localCoordsOut);
        if (!cell) {
            return null;
        }       

        const flowfields = new Map<string, TFlowField[]>();
        for (const sectorCoords of sectors) {
            const flowField = new Array<TFlowField>();
            initFlowField(flowField);
            flowfields.set(`${sectorCoords.x},${sectorCoords.y}`, flowField);
        }

        const cellIndex = localCoordsOut.y * mapRes + localCoordsOut.x;
        flowfields.get(`${sectorCoordsOut.x},${sectorCoordsOut.y}`)![cellIndex].integration = 0;

        context.flowfields = flowfields;
        context.openList.clear();
        context.openList.add(`${targetCoords.x},${targetCoords.y}`);
        context.targetCell = cell;
        context.targetCellSectorCoords.copy(sectorCoordsOut);
        const currentCoords = pools.vec2.getOne();
        visited.clear();
        while (context.openList.size > 0) {
            const currentCoordsStr = shiftSet(context.openList)!;
            const [x, y] = currentCoordsStr.split(",").map(Number);
            currentCoords.set(x, y);

            for (const [dx, dy] of gridNeighbors) {
                this._neighborAddr.mapCoords.set(currentCoords.x + dx, currentCoords.y + dy);
                const neighborId = `${this._neighborAddr.mapCoords.x},${this._neighborAddr.mapCoords.y}`;
                if (visited.has(neighborId)) {
                    continue;
                }
                visited.set(neighborId, true);

                const neighborCell = GameUtils.getCell(this._neighborAddr.mapCoords, this._neighborAddr.sectorCoords, this._neighborAddr.localCoords);
                if (!neighborCell) {
                    continue;
                }

                const includedSector = sectors.find(s => s.equals(this._neighborAddr.sectorCoords));
                if (!includedSector) {
                    continue;
                }
                
                this._neighborAddr.cellIndex = this._neighborAddr.localCoords.y * mapRes + this._neighborAddr.localCoords.x;
                processNeighbor(currentCoords, neighborCell, this._neighborAddr, context);
            }

            // check diagonal neighbors
            // for (const [dx, dy] of diagonalNeighbors) {
            //     this._neighborAddr.mapCoords.set(currentCoords.x + dx, currentCoords.y + dy);
            //     const neighborCell = GameUtils.getCell(this._neighborAddr.mapCoords, this._neighborAddr.sectorCoords, this._neighborAddr.localCoords)!;
            //     if (!neighborCell) {
            //         continue;
            //     }

            //     const includedSector = sectors.find(s => s.equals(this._neighborAddr.sectorCoords));
            //     if (!includedSector) {
            //         continue;
            //     }

            //     neighborCoords.set(currentCoords.x + dx, currentCoords.y);
            //     const lateralCell = GameUtils.getCell(neighborCoords)!;
            //     console.assert(lateralCell);                
            //     if (lateralCell.flowFieldCost === 0xffff) {
            //         // don't navigate diagonally near obstacles
            //         continue;
            //     }
            //     neighborCoords.set(currentCoords.x, currentCoords.y + dy);
            //     const verticalCell = GameUtils.getCell(neighborCoords)!;
            //     if (!verticalCell) {
            //         debugger;
            //     }
            //     console.assert(verticalCell);
            //     if (verticalCell.flowFieldCost === 0xffff) {
            //         // don't navigate diagonally near obstacles
            //         continue;
            //     }

            //     this._neighborAddr.cellIndex = this._neighborAddr.localCoords.y * mapRes + this._neighborAddr.localCoords.x;
            //     processNeighbor(currentCoords, neighborCell, this._neighborAddr, 1, context);
            // }   
        }

        return flowfields;
    }

    public computeDirection(motionId: number, mapCoords: Vector2, directionOut: Vector2) {        
        let minCost = 0xffff;
        const minNeighbor = pools.vec2.getOne();
        const flowfields = unitMotion.getFlowfields(motionId);

        for (const [dx, dy] of gridNeighbors) {
            this._neighborAddr.mapCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighbor = GameUtils.getCell(this._neighborAddr.mapCoords, this._neighborAddr.sectorCoords, this._neighborAddr.localCoords);
            if (!neighbor) {
                continue;
            }

            const flowField = flowfields.get(`${this._neighborAddr.sectorCoords.x},${this._neighborAddr.sectorCoords.y}`);
            if (!flowField) {
                continue;
            }
            
            const neighborIndex = this._neighborAddr.localCoords.y * mapRes + this._neighborAddr.localCoords.x;
            const cost = flowField[neighborIndex].integration;
            if (cost < minCost) {
                minCost = cost;
                minNeighbor.copy(this._neighborAddr.mapCoords);
            }
        }

        for (const [dx, dy] of diagonalNeighbors) {
            this._neighborAddr.mapCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighbor = GameUtils.getCell(this._neighborAddr.mapCoords, this._neighborAddr.sectorCoords, this._neighborAddr.localCoords);
            if (!neighbor) {
                continue;
            }

            const flowField = flowfields.get(`${this._neighborAddr.sectorCoords.x},${this._neighborAddr.sectorCoords.y}`)!;
            if (!flowField) {
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

