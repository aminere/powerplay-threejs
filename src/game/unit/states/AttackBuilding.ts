
import { IBuildingInstance } from "../../buildings/BuildingTypes";
import { State } from "../../fsm/StateMachine";
import { IUnit } from "../IUnit";
import { unitMotion } from "../UnitMotion";
import { unitAnimation } from "../UnitAnimation";
import { ICharacterUnit } from "../ICharacterUnit";
import { config } from "../../config/config";
import { unitConfig } from "../../config/UnitConfig";
import { buildings } from "../../buildings/Buildings";
import { IdleEnemy } from "./IdleEnemy";
import { UnitUtils } from "../UnitUtils";

enum AttackStep {
    Idle,
    Approach,
    Attack
}

const { attackTimes } = config.combat.melee;

export class AttackBuilding extends State<IUnit> {

    private _target: IBuildingInstance | null = null;
    private _step = AttackStep.Idle;
    private _loopConsumed = false;
    private _attackIndex = 0;   

    override update(unit: ICharacterUnit) {
        
        const target = this._target;
        if (!target || target.deleted) {
            if (unit.motionId > 0) {
                unitMotion.endMotion(unit);
            }
            unit.isIdle = true;
            unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
            this._step = AttackStep.Idle;
            this._target = null;
            unit.fsm.switchState(IdleEnemy);
            return;
        }

        switch (this._step) {
            case AttackStep.Idle: {
                UnitUtils.moveToBuilding(unit, target);
                unitAnimation.setAnimation(unit, "run", { transitionDuration: .2, scheduleCommonAnim: true });
                this._step = AttackStep.Approach;
            }
                break;

            case AttackStep.Attack: {
                if (this._loopConsumed) {
                    if (unit.animation.action.time < attackTimes[0]) {
                        this._loopConsumed = false;
                    }
                    break;
                } else {
                    if (unit.animation.action.time < attackTimes[this._attackIndex]) {
                        break;
                    } else {
                        this._attackIndex = (this._attackIndex + 1) % attackTimes.length;
                        if (this._attackIndex === 0) {
                            this._loopConsumed = true;
                        }
                    }
                }

                // attack
                const damage = unitConfig[unit.type].damage;
                target.hitpoints -= damage;
                if (target.hitpoints <= 0) {
                    target.hitpoints = 0;
                    buildings.clear(target);
                    this._target = null;
                }
            }
            break;
        }
    }

    public startAttack(unit: ICharacterUnit) {
        if (this._step === AttackStep.Attack) {
            console.assert(false);
            return;
        }
        this._step = AttackStep.Attack;
        unit.isIdle = false;
        this._loopConsumed = false;
        this._attackIndex = 0;
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
    }

    public setTarget(target: IBuildingInstance) {
        this._target = target;
    }
}

