import { Vector2 } from "three";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { pools } from "../../engine/core/Pools";

export type TFlowField = {
    integration: number;
    directionIndex: number; 
};

const { mapRes } = config.game;
const cellCount = mapRes * mapRes;

function initFlowField(flowField: TFlowField[]) {
    for (let i = 0; i < cellCount; ++i) {
        flowField.push({
            integration: 0xffff,
            directionIndex: -1            
        });
    }
}

function shiftSet<T>(set: Set<T>) {
    for (const value of set) {
        set.delete(value);
        return value;
    }
}

const openList = new Set<string>();
const visitedCells = new Map<string, boolean>();
const gridNeighbors = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const diagonalNeighbors = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
const lateralCellBlocked = [false, false];
const verticalCellBlocked = [false, false];
const neighborCoords = new Vector2();
const neighborSectorCoords = new Vector2();
const neighborLocalCoords = new Vector2();
const directionPalette = [
    new Vector2(-1, -1).normalize(),
    new Vector2(0, -1).normalize(),
    new Vector2(1, -1).normalize(),
    new Vector2(-1, 0).normalize(),
    new Vector2(1, 0).normalize(),
    new Vector2(-1, 1).normalize(),
    new Vector2(0, 1).normalize(),
    new Vector2(1, 1).normalize()
];

export type TFlowFieldMap = Map<string, TFlowField[]>;
type TFlowfieldMotion = {
    unitCount: number;
    flowfields: TFlowFieldMap;
}

class FlowField {    

    private _motionId = 1;
    private _motions = new Map<number, TFlowfieldMotion>();

    public compute(targetCoords: Vector2, sectors: Vector2[]) {

        const [currentSectorCoords, currentLocalCoords] = pools.vec2.get(2);
        const cell = GameUtils.getCell(targetCoords, currentSectorCoords, currentLocalCoords);
        if (!cell) {
            return null;
        }       

        const flowfields: TFlowFieldMap = new Map<string, TFlowField[]>();
        for (const sectorCoords of sectors) {
            const flowField = new Array<TFlowField>();
            initFlowField(flowField);
            flowfields.set(`${sectorCoords.x},${sectorCoords.y}`, flowField);
        }
        
        const currentFlowfield = flowfields.get(`${currentSectorCoords.x},${currentSectorCoords.y}`)!;
        const cellIndex = currentLocalCoords.y * mapRes + currentLocalCoords.x;
        currentFlowfield[cellIndex].integration = 0;

        openList.clear();
        const targetCellId = `${targetCoords.x},${targetCoords.y}`;
        openList.add(targetCellId);
        visitedCells.clear();
        visitedCells.set(targetCellId, true);

        let processedCells = 0;
        const [currentCoords, neighborCoords, neighborSectorCoords, neighborLocalCoords] = pools.vec2.get(4);
        while (openList.size > 0) {
            const currentCoordsStr = shiftSet(openList)!;
            const [x, y] = currentCoordsStr.split(",").map(Number);
            currentCoords.set(x, y);
            const currentCell = GameUtils.getCell(currentCoords, currentSectorCoords, currentLocalCoords);
            console.assert(currentCell);
            const flowField = flowfields.get(`${currentSectorCoords.x},${currentSectorCoords.y}`)!;
            const currentIndex = currentLocalCoords.y * mapRes + currentLocalCoords.x;

            for (const [dx, dy] of gridNeighbors) {
                neighborCoords.set(currentCoords.x + dx, currentCoords.y + dy);
                const neighborId = `${neighborCoords.x},${neighborCoords.y}`;
                if (visitedCells.has(neighborId)) {
                    continue;
                }
                visitedCells.set(neighborId, true);

                const neighborCell = GameUtils.getCell(neighborCoords, neighborSectorCoords, neighborLocalCoords);
                if (!neighborCell) {
                    continue;
                }

                const includedSector = sectors.find(s => s.equals(neighborSectorCoords));
                if (!includedSector) {
                    continue;
                }
                
                const neighborCellIndex = neighborLocalCoords.y * mapRes + neighborLocalCoords.x;                
                const endNodeCost = flowField[currentIndex].integration + neighborCell.flowFieldCost;
                const neighborFlowfield = flowfields.get(`${neighborSectorCoords.x},${neighborSectorCoords.y}`)!;
                const neighborFlowfieldInfo = neighborFlowfield[neighborCellIndex];
                if (endNodeCost < neighborFlowfieldInfo.integration) {
                    openList.add(`${neighborCoords.x},${neighborCoords.y}`);
                    neighborFlowfieldInfo.integration = endNodeCost;
                }
                ++processedCells;
            }            
        }

        console.log(`processed cells: ${processedCells}`);
        return flowfields;
    }

    public computeSector(startingDist: number, localCoords: Vector2, sectorCoords: Vector2) {
        const sector = GameUtils.getSector(sectorCoords)!;
        const flowField = new Array<TFlowField>();
        initFlowField(flowField);
        
        const cellIndex = localCoords.y * mapRes + localCoords.x;
        flowField[cellIndex].integration = startingDist;

        openList.clear();
        const targetCellId = `${localCoords.x},${localCoords.y}`;
        openList.add(targetCellId);
        visitedCells.clear();
        visitedCells.set(targetCellId, true);

        let processedCells = 0;
        const [currentCoords, neighborCoords] = pools.vec2.get(2);
        while (openList.size > 0) {
            const currentCoordsStr = shiftSet(openList)!;
            const [x, y] = currentCoordsStr.split(",").map(Number);
            currentCoords.set(x, y);
            const currentIndex = currentCoords.y * mapRes + currentCoords.x;

            for (const [dx, dy] of gridNeighbors) {
                neighborCoords.set(currentCoords.x + dx, currentCoords.y + dy);
                const neighborId = `${neighborCoords.x},${neighborCoords.y}`;
                if (visitedCells.has(neighborId)) {
                    continue;
                }
                visitedCells.set(neighborId, true);

                if (neighborCoords.x < 0 || neighborCoords.x >= mapRes || neighborCoords.y < 0 || neighborCoords.y >= mapRes) {
                    continue;
                }

                const neighborCellIndex = neighborCoords.y * mapRes + neighborCoords.x;                 
                const neighborCell = sector.cells[neighborCellIndex];                
                const endNodeCost = flowField[currentIndex].integration + neighborCell.flowFieldCost;
                const neighborFlowfieldInfo = flowField[neighborCellIndex];
                if (endNodeCost < neighborFlowfieldInfo.integration) {
                    openList.add(`${neighborCoords.x},${neighborCoords.y}`);
                    neighborFlowfieldInfo.integration = endNodeCost;
                }
                ++processedCells;
            }            
        }

        // console.log(`processed cells: ${processedCells}`);
        return flowField;
    }

    public computeDirection(flowfields: TFlowFieldMap, mapCoords: Vector2, directionOut: Vector2) {        
        let minCost = 0xffff;
        let toNeighborX = 0;
        let toNeighborY = 0;
        
        lateralCellBlocked[0] = false;
        lateralCellBlocked[1] = false;
        for (let i = 0; i < 2; i++) {
            const dx = i * 2 - 1;  // -1, 1
            neighborCoords.set(mapCoords.x + dx, mapCoords.y);
            const neighbor = GameUtils.getCell(neighborCoords, neighborSectorCoords, neighborLocalCoords);
            if (!neighbor) {
                continue;
            }

            const flowField = flowfields.get(`${neighborSectorCoords.x},${neighborSectorCoords.y}`);
            if (!flowField) {
                continue;
            }
            
            lateralCellBlocked[i] = neighbor.flowFieldCost === 0xffff;
            const neighborIndex = neighborLocalCoords.y * mapRes + neighborLocalCoords.x;
            const cost = flowField[neighborIndex].integration;
            if (cost < minCost) {
                minCost = cost;
                toNeighborX = dx;
                toNeighborY = 0;
            }
        }

        verticalCellBlocked[0] = false;
        verticalCellBlocked[1] = false;
        for (let i = 0; i < 2; i++) {
            const dy = i * 2 - 1;  // -1, 1
            neighborCoords.set(mapCoords.x, mapCoords.y + dy);
            const neighbor = GameUtils.getCell(neighborCoords, neighborSectorCoords, neighborLocalCoords);
            if (!neighbor) {
                continue;
            }

            const flowField = flowfields.get(`${neighborSectorCoords.x},${neighborSectorCoords.y}`);
            if (!flowField) {
                continue;
            }
            
            verticalCellBlocked[i] = neighbor.flowFieldCost === 0xffff;
            const neighborIndex = neighborLocalCoords.y * mapRes + neighborLocalCoords.x;
            const cost = flowField[neighborIndex].integration;
            if (cost < minCost) {
                minCost = cost;
                toNeighborX = 0;
                toNeighborY = dy;
            }
        }

        for (const [dx, dy] of diagonalNeighbors) {

            // don't navigate diagonally near obstacles
            const lateralIndex = (dx + 1) / 2;
            if (lateralCellBlocked[lateralIndex]) {
                continue;
            }
            const verticalIndex = (dy + 1) / 2;
            if (verticalCellBlocked[verticalIndex]) {
                continue;
            }

            neighborCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const neighbor = GameUtils.getCell(neighborCoords, neighborSectorCoords, neighborLocalCoords);
            if (!neighbor) {
                continue;
            }

            const flowField = flowfields.get(`${neighborSectorCoords.x},${neighborSectorCoords.y}`)!;
            if (!flowField) {
                continue;
            }

            const neighborIndex = neighborLocalCoords.y * mapRes + neighborLocalCoords.x;
            const cost = flowField[neighborIndex].integration;
            if (cost < minCost) {
                minCost = cost;
                toNeighborX = dx;
                toNeighborY = dy;
            }
        }

        if (minCost < 0xffff) {
            directionOut.set(toNeighborX, toNeighborY);
            return true;
        }
        directionOut.set(0, 0);
        return false;
    }

    public computeDirectionIndex(direction: Vector2) {
        if (direction.x < 0) {
            if (direction.y < 0) {
                return 0;
            } else if (direction.y > 0) {
                return 5;
            } else {
                return 3;
            }
        } else if (direction.x > 0) {
            if (direction.y < 0) {
                return 2;
            } else if (direction.y > 0) {
                return 7;
            } else {
                return 4;
            }
        } else {
            if (direction.y < 0) {
                return 1;
            } else if (direction.y > 0) {
                return 6;
            }
        }
        console.assert(false);
        return -1;
    }

    public getDirection(index: number, directionOut: Vector2) {
        directionOut.copy(directionPalette[index]);
    }

    public getMotion(motionId: number) {
        return this._motions.get(motionId)!;
    }

    public register(flowfields: TFlowFieldMap) {
        const motionId = this._motionId;
        this._motions.set(motionId, {
            unitCount: 0,
            flowfields
        });
        this._motionId++
        return motionId;
    }

    public setMotionUnitCount(motionId: number, count: number) {
        const motion = this._motions.get(motionId)!;
        motion.unitCount = count;
    }

    public removeMotion(motionId: number) {
        const motion = this._motions.get(motionId)!;
        console.assert(motion);
        console.assert(motion.unitCount > 0);
        motion.unitCount--;
        if (motion.unitCount === 0) {
            this._motions.delete(motionId);
        }    
        console.log(`remaining motions: ${this._motions.size}`);
    }
}

export const flowField = new FlowField();

