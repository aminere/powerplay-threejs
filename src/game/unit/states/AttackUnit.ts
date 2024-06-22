import { unitConfig } from "../../config/UnitConfig";
import { config } from "../../config/config";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { unitAnimation } from "../UnitAnimation";
import { unitMotion } from "../UnitMotion";
import { UnitUtils } from "../UnitUtils";
import { IdleEnemy } from "./IdleEnemy";
import { MeleeDefendState } from "./MeleeDefendState";

enum AttackStep {
    Idle,
    Approach,
    Attack
}

const { separations } = config.steering;
const { attackTimes} = config.combat.melee;

export class AttackUnit extends State<ICharacterUnit> {

    public get target() { return this._target; }

    private _target: IUnit | null = null;
    private _step = AttackStep.Idle;
    private _loopConsumed = false;
    private _attackIndex = 0;    

    override update(unit: ICharacterUnit) {

        const target = this._target;
        if (!target || !target.isAlive) {
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
                unitMotion.moveUnit(unit, target.coords.mapCoords, false);
                unitAnimation.setAnimation(unit, "run", { transitionDuration: .2, scheduleCommonAnim: true });
                this._step = AttackStep.Approach;
            }
                break;

            case AttackStep.Attack: {

                UnitUtils.rotateToTarget(unit, target!);
                
                const separation = separations[unit.type] + separations[target!.type];
                const outOfRange = unit.visual.position.distanceTo(target!.visual.position) > separation * 1.1;
                if (outOfRange) {
                    this._step = AttackStep.Approach;
                    unitMotion.moveUnit(unit, target!.coords.mapCoords, false);
                    unitAnimation.setAnimation(unit, "run", { transitionDuration: .2, scheduleCommonAnim: true });
                    break;
                }

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
                target!.setHitpoints(target!.hitpoints - damage);
                if (target!.isAlive && UnitUtils.isWorker(target!)) {
                    const worker = target as ICharacterUnit;
                    if (worker.isIdle && worker.motionId === 0 && !worker.resource) {
                        const meleeState = target!.fsm.getState(MeleeDefendState) ?? target!.fsm.switchState(MeleeDefendState);
                        meleeState.startAttack(target as ICharacterUnit, unit);
                    }
                }
            }
            break;
        }
    }

    public setTarget(target: IUnit) {
        if (this._target?.isAlive) {
            // already have a target
            return;
        }
        this._target = target;
    }

    public startAttack(unit: ICharacterUnit) {
        if (this._step === AttackStep.Attack) {
            console.assert(false);
            return;
        }
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);
        }
        this._step = AttackStep.Attack;
        unit.isIdle = false;
        this._loopConsumed = false;
        this._attackIndex = 0;
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
    }

    public onColliding(unit: ICharacterUnit) {
        if (this._step === AttackStep.Attack || unit.motionId === 0) {
            return;
        }
        const withTarget = unit.collidingWith.includes(this._target!);
        if (withTarget) {
            this.startAttack(unit);
        }
    }

    public onReachedTarget(unit: ICharacterUnit) {
        const target = this._target;
        if (target?.isAlive) {
            if (target.coords.mapCoords.equals(unit.targetCell.mapCoords)) {
                // target didn't move since last detection, so start attacking
                this.startAttack(unit);
            } else {
                // keep following
                unitMotion.moveUnit(unit, target.coords.mapCoords);
            }
        }
    }
}

