import { Vector2 } from "three";
import { IUnit } from "./Unit";
import { getCellFromAddr } from "./UnitAddr";
import { GameUtils } from "../GameUtils";

const cellCoords = new Vector2();

let counter = 0;
function scan(startX: number, startY: number, sx: number, sy: number, iterations: number, filter: (unit: IUnit) => boolean) {
    for (let i = 0; i < iterations; ++i) {
        cellCoords.set(startX + i * sx, startY + i * sy);
        const cell = GameUtils.getCell(cellCoords);
        if (cell && cell.units) {
            for (const other of cell.units) {
                if (!other.isAlive) {
                    continue;
                }
                if (filter(other)) {
                    return other;
                }
            }
        }
        counter++;
    }
    return null;
}

export class UnitUtils {
    public static spiralSearch(unit: IUnit, radius: number, filter: (unit: IUnit) => boolean) {
        const { mapCoords } = unit.coords;

        const cell = getCellFromAddr(unit.coords);
        if (cell.units) {
            for (const other of cell.units) {
                if (other === unit) {
                    continue;
                }
                if (!other.isAlive) {
                    continue;
                }
                if (filter(other)) {
                    return other;
                }
            }
        }
        
        counter = 1;
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
}


