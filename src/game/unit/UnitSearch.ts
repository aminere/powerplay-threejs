import { Vector2 } from "three";
import { IUnit } from "./IUnit";
import { GameUtils } from "../GameUtils";
import { getCellFromAddr } from "./UnitAddr";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { buildingConfig } from "../config/BuildingConfig";
import { GameMapState } from "../components/GameMapState";

const cellCoords = new Vector2();

function scan(startX: number, startY: number, sx: number, sy: number, iterations: number, filter: (unit: IUnit) => boolean) {
    for (let i = 0; i < iterations; ++i) {
        cellCoords.set(startX + i * sx, startY + i * sy);
        const cell = GameUtils.getCell(cellCoords);
        if (cell && cell.units) {
            for (const other of cell.units) {
                if (filter(other)) {
                    console.assert(other.isAlive);
                    return other;
                }
            }
        }
    }
    return null;
}

export function edgeFind(unit: IUnit, radius: number, filter: (unit: IUnit) => boolean) {
    const { mapCoords } = unit.coords;

    const startX = mapCoords.x - radius;
    const startY = mapCoords.y - radius;
    const xIterations = radius * 2 + 1;
    let target = scan(startX, startY, 1, 0, xIterations, filter);
    if (target) {
        return target;
    }

    target = scan(startX, startY + xIterations - 1, 1, 0, xIterations, filter);
    if (target) {
        return target;
    }

    const yIterations = xIterations - 2;
    target = scan(startX, startY + 1, 0, 1, yIterations, filter);
    if (target) {
        return target;
    }

    target = scan(startX + xIterations - 1, startY + 1, 0, 1, yIterations, filter);
    if (target) {
        return target;
    }

    return null;
}

export function spiralFind(unit: IUnit, radius: number, filter: (unit: IUnit) => boolean) {
    const { mapCoords } = unit.coords;

    const cell = getCellFromAddr(unit.coords);
    if (cell.units) {
        for (const other of cell.units) {
            if (other === unit) {
                continue;
            }
            if (filter(other)) {
                console.assert(other.isAlive);
                return other;
            }
        }
    }

    let currentRadius = 1;
    while (currentRadius <= radius) {
        const startX = mapCoords.x - currentRadius;
        const startY = mapCoords.y - currentRadius;
        const xIterations = currentRadius * 2 + 1;

        let target = scan(startX, startY, 1, 0, xIterations, filter);
        if (target) {
            return target;
        }

        target = scan(startX, startY + xIterations - 1, 1, 0, xIterations, filter);
        if (target) {
            return target;
        }

        const yIterations = xIterations - 2;
        target = scan(startX, startY + 1, 0, 1, yIterations, filter);
        if (target) {
            return target;
        }

        target = scan(startX + xIterations - 1, startY + 1, 0, 1, yIterations, filter);
        if (target) {
            return target;
        }

        ++currentRadius;
    }

    return null;
}

export class UnitSearch {
    private _fastMode = false;

    public find(unit: IUnit, radius: number, filter: (unit: IUnit) => boolean) {
        if (this._fastMode) {
            return edgeFind(unit, radius, filter);
        } else {
            const result = spiralFind(unit, radius, filter);
            if (!result) {
                this._fastMode = true;
            }
            return result;
        }
    }

    public findBuilding(unit: IUnit, radius: number) {
        const { mapCoords, sectorCoords } = unit.coords;
        const minX = mapCoords.x - radius;
        const minY = mapCoords.y - radius;
        const maxX = mapCoords.x + radius;
        const maxY = mapCoords.y + radius;
        let closestBuilding: IBuildingInstance | null = null;
        let distToClosest = Infinity;
        const { buildings } = GameMapState.instance;
        for (const [dx, dy] of [[0, 0], [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
            const sectorX = sectorCoords.x + dx;
            const sectorY = sectorCoords.y + dy;
            const sectorId = `${sectorX},${sectorY}`;
            const list = buildings.get(sectorId);
            if (!list) {
                continue;
            }
            for (const building of list) {
                const { size } = buildingConfig[building.buildingType];
                const startX = building.mapCoords.x;
                const startY = building.mapCoords.y;
                const endX = startX + size.x - 1;
                const endY = startY + size.z - 1;
                if (endX < minX || startX > maxX || endY < minY || startY > maxY) {
                    continue;
                }

                const centerX = startX + size.x / 2;
                const centerY = startY + size.z / 2;
                const dist = Math.abs(mapCoords.x - centerX) + Math.abs(mapCoords.y - centerY);
                if (dist < distToClosest) {
                    distToClosest = dist;
                    closestBuilding = building;
                }
            }
        }
        return closestBuilding;
    }

    public reset() {
        this._fastMode = false;
    }
}


