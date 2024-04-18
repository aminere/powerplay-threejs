import { IUnit } from "./IUnit";
import { unitsManager } from "./UnitsManager";

export class NPCUtils {

    public findTarget(unit: IUnit, vision: number) {
        // TODO rewrite using neighbor cells, don't loop through all units.
        const { units } = unitsManager;

        const { unitsInRange } = unit;
        let unitsInRangeCount = 0;
        for (const target of units) {
            if (target.type === unit.type) {
                continue;
            }
            if (!target.isAlive) {
                continue;
            }
            const dist = target.mesh.position.distanceTo(unit.mesh.position);
            if (dist < vision) {
                if (unitsInRangeCount < unitsInRange.length) {
                    const unitInRange = unitsInRange[unitsInRangeCount];
                    unitInRange[0] = target;
                    unitInRange[1] = dist;
                } else {
                    unitsInRange.push([target, dist]);
                }
                ++unitsInRangeCount;
            }
        }
        unitsInRange.length = unitsInRangeCount;

        if (unitsInRange.length > 0) {
            unitsInRange.sort((a, b) => a[1] - b[1]);
            for (let i = 0; i < unitsInRange.length; i++) {
                const target = unitsInRange[i][0];
                if (target.attackers.length === 0 || i === unitsInRange.length - 1) {
                    return target;
                }
            }
        }
    }
}

export const npcUtils = new NPCUtils();

