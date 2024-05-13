
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { time } from "../../../engine/core/Time";
import { UnitUtils } from "../UnitUtils";
import { unitAnimation } from "../UnitAnimation";

const hitFrequency = .5;
const damage = .1;

export class MeleeDefendState extends State<ICharacterUnit> {

    private _target: IUnit | null = null;
    private _hitTimer = 0;

    override exit(unit: ICharacterUnit) {
        unit.isIdle = true;
        unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
    }

    override update(unit: ICharacterUnit) {

        const target = this._target;
        if (target) {
            if (!target.isAlive || UnitUtils.isOutOfRange(unit, target, 1)) {
                unit.fsm.switchState(null);
            } else {
                UnitUtils.rotateToTarget(unit, target!);
                if (this._hitTimer < 0) {
                    target!.setHitpoints(target!.hitpoints - damage);
                    this._hitTimer = hitFrequency;
                } else {
                    this._hitTimer -= time.deltaTime;
                }
            }
        } else {
            unit.fsm.switchState(null);
        }
    }

    public startAttack(unit: ICharacterUnit, target: IUnit) {
        this._target = target;
        unit.isIdle = false;
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
    }
}

