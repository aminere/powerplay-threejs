
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { UnitUtils } from "../UnitUtils";
import { unitAnimation } from "../UnitAnimation";
import { unitConfig } from "../../config/UnitConfig";
import { config } from "../../config/config";

const { attackTimes } = config.combat.melee;

export class MeleeDefendState extends State<ICharacterUnit> {

    private _target: IUnit | null = null;
    private _loopConsumed = false;
    private _attackIndex = 0;

    override exit(unit: ICharacterUnit) {
        unit.isIdle = true;
        unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
    }

    override update(unit: ICharacterUnit) {

        const target = this._target;
        if (!target) {
            unit.fsm.switchState(null);
            return;
        }
        
        const { range } = unitConfig[unit.type];
        if (!target.isAlive || UnitUtils.isOutOfRange(unit, target, range.attack)) {
            unit.fsm.switchState(null);
            return;
        }

        UnitUtils.rotateToTarget(unit, target!);

        if (this._loopConsumed) {
            if (unit.animation.action.time < attackTimes[0]) {
                this._loopConsumed = false;
            }
            return;
        } else {
            if (unit.animation.action.time < attackTimes[this._attackIndex]) {
                return;
            } else {
                this._attackIndex = (this._attackIndex + 1) % attackTimes.length;
                if (this._attackIndex === 0) {
                    this._loopConsumed = true;
                }
            }
        }

        // attack
        const damage = unitConfig[unit.type].damage;
        target!.setHitpoints(target!.hitpoints - damage);
    }

    public startAttack(unit: ICharacterUnit, target: IUnit) {
        this._target = target;
        unit.isIdle = false;
        this._loopConsumed = false;
        this._attackIndex = 0;
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
    }
}

