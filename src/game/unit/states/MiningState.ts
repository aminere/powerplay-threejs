import { time } from "../../../engine/core/Time";
import { RawResourceType } from "../../GameDefinitions";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../CharacterUnit";
import { copyUnitAddr, getCellFromAddr, makeUnitAddr } from "../UnitAddr";
import { unitAnimation } from "../UnitAnimation";
import { unitMotion } from "../UnitMotion";
import { Workers } from "../Workers";

export class MiningState extends State<ICharacterUnit> {
    private _timer = 0;
    private _targetResource = makeUnitAddr();

    override enter(unit: ICharacterUnit) {
        this._timer = 1;
        unitAnimation.setAnimation(unit, "pick", { transitionDuration: .4 });
        copyUnitAddr(unit.targetCell, this._targetResource);
        unit.isIdle = false;
        unit.collidable = false;

        if (unit.resource) {
            unit.resource = null;
        }
    }

    override exit(unit: ICharacterUnit): void {
        unit.isIdle = true;
        unit.collidable = true;
    }

    override update(unit: ICharacterUnit): void {
        this._timer -= time.deltaTime;
        if (this._timer < 0) {
            const cell = getCellFromAddr(this._targetResource);
            if (cell.resource && cell.resource.amount > 0) {
                const resourceType = cell.resource.type as RawResourceType;
                if (resourceType === "water") {
                    // TODO deal with water differently, must lower the water level in the surrounding water patch
                    // clear the entire water patch when level reaches 0
                } else {
                    cell.resource.amount -= 1;
                    if (cell.resource.amount === 0) {
                        cell.resource = undefined;
                    }
                }
                Workers.pickResource(unit, resourceType, this._targetResource.mapCoords);

            } else {
                // depleted resource
            }

            unit.fsm.switchState(null);
            if (unit.targetBuilding) {
                unitMotion.moveUnit(unit, unit.targetBuilding, false);
                unitAnimation.setAnimation(unit, "run", { transitionDuration: .1, scheduleCommonAnim: true });
            } else {
                unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
            }
        }
    }
}

