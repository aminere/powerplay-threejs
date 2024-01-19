import { engineState } from "../../engine/EngineState";
import { Flock } from "../components/Flock";
import { IUnit } from "./IUnit";

export class NPCUtils {

    public findTarget(unit: IUnit, vision: number) {
        const flock = engineState.getComponents(Flock)[0];
        const units = flock.component.state!.units;

        const { unitsInRange } = unit;
        let unitsInRangeCount = 0;
        for (const target of units) {
            if (target.type === unit.type) {
                continue;
            }
            if (!target.isAlive) {
                continue;
            }
            const dist = target.obj.position.distanceTo(unit.obj.position);
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

