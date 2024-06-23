import { unitConfig } from "../../config/UnitConfig";
import { config } from "../../config/config";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { unitAnimation } from "../UnitAnimation";
import { unitMotion } from "../UnitMotion";
import { UnitUtils } from "../UnitUtils";
import { IdleEnemy } from "./IdleEnemy";
import { SoldierState } from "./SoldierState";

enum AttackStep {
    Idle,
    Approach,
    MeleeAttack
}

const { separations } = config.steering;
const { attackTimes} = config.combat.melee;

export class AttackUnit extends State<ICharacterUnit> {

    public get target() { return this._target; }

    private _target: IUnit | null = null;
    private _step = AttackStep.Idle;
    private _loopConsumed = false;
    private _attackIndex = 0;    

    override exit(unit: ICharacterUnit) {
        if (!unit.isIdle) {
            unit.isIdle = true;
            unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
        }
    }

    override update(unit: ICharacterUnit) {

        const target = this._target;
        if (!target || !target.isAlive) {
            if (unit.motionId > 0) {
                unitMotion.endMotion(unit);
            }
                    
            this._step = AttackStep.Idle;
            this._target = null;

            if (UnitUtils.isEnemy(unit)) {
                unit.fsm.switchState(IdleEnemy);
            } else {
                unit.fsm.switchState(null);
            }
            return;
        }

        switch (this._step) {
            case AttackStep.Idle: {
                unitMotion.moveUnit(unit, target.coords.mapCoords, false);
                unitAnimation.setAnimation(unit, "run", { transitionDuration: .2, scheduleCommonAnim: true });
                this._step = AttackStep.Approach;
            }
                break;

            case AttackStep.Approach: {
                switch (unit.resource?.type) {
                    case "ak47": 
                    case "rpg": {
                        const { range } = config.combat[unit.resource.type];
                        if (!UnitUtils.isOutOfRange(unit, target, range - 1)) {
                            unitMotion.endMotion(unit);
                            const soldier = unit.fsm.switchState(SoldierState);
                            soldier.attackTarget(target);
                        }
                    }
                }
            }
            break;

            case AttackStep.MeleeAttack: {
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
                target.setHitpoints(target.hitpoints - damage);
                if (target.isAlive) {
                    // get attacked unit to respond
                    if (UnitUtils.isVehicle(target)) {
                        break;
                    }                    
                    if (target.isIdle && target.motionId === 0) {
                        if (UnitUtils.isWorker(target)) {
                            const worker = target as ICharacterUnit;
                            if (worker.resource) {
                                break;
                            }
                        }

                        const attack = target!.fsm.getState(AttackUnit) ?? target!.fsm.switchState(AttackUnit);
                        attack.setTarget(unit);
                    }                    
                }
            }
            break;
        }
    }

    public setTarget(target: IUnit) {
        if (this._target?.isAlive) {
            return;
        }
        this._target = target;
    }    

    public onColliding(unit: ICharacterUnit) {
        if (this._step === AttackStep.MeleeAttack || unit.motionId === 0) {
            return;
        }
        const withTarget = unit.collidingWith.includes(this._target!);
        if (withTarget) {
            this.startMeleeAttack(unit);
        }
    }

    public onReachedTarget(unit: ICharacterUnit) {
        const target = this._target;
        if (target?.isAlive) {
            if (target.coords.mapCoords.equals(unit.targetCell.mapCoords)) {
                // target didn't move since last detection, so start attacking
                this.startMeleeAttack(unit);
            } else {
                (() => {
                    const attack = target.fsm.getState(AttackUnit);
                    if (attack) {
                        if (attack.target === unit) {
                            // avoid orbiting into each other
                            if (unit.motionId > 0) {
                                unitMotion.endMotion(unit);
                            }
                            return;
                        }
                    }

                    // keep following
                    unitMotion.moveUnit(unit, target.coords.mapCoords);
                })();
            }
        }
    }

    private startMeleeAttack(unit: ICharacterUnit) {
        if (this._step === AttackStep.MeleeAttack) {
            console.assert(false);
            return;
        }
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);
        }
        this._step = AttackStep.MeleeAttack;
        unit.isIdle = false;
        this._loopConsumed = false;
        this._attackIndex = 0;
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
    }
}

