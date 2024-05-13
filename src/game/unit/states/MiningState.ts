import { time } from "../../../engine/core/Time";
import { RawResourceType } from "../../GameDefinitions";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
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
                switch (resourceType) {
                    case "water":
                    case "oil":
                        // Infinite for now
                        // TODO deal with liquids differently, spread the cost across the surrounding cells using flood fill
                        // clear when the entire patch reaches 0
                        break;

                    default:
                        cell.resource.amount -= 1;
                        if (cell.resource.amount === 0) {
                            cell.resource = undefined;
                        }
                }
                
                Workers.pickResource(unit, resourceType, this._targetResource.mapCoords);

            } else {
                // depleted resource
            }

            if (unit.targetBuilding) {
                unit.fsm.switchState(null);
                unitMotion.moveUnit(unit, unit.targetBuilding, false);
                unitAnimation.setAnimation(unit, "run", { transitionDuration: .1, scheduleCommonAnim: true });
            } else {
                this.stopMining(unit);
            }            
        }
    }

    private stopMining(unit: ICharacterUnit) {
        unit.fsm.switchState(null);
        unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
    }
}

