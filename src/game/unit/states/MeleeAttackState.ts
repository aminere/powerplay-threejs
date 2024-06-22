
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { UnitUtils } from "../UnitUtils";
import { unitAnimation } from "../UnitAnimation";
import { unitMotion } from "../UnitMotion";
import { config } from "../../config/config";
import { unitConfig } from "../../config/UnitConfig";
import { SoldierState } from "./SoldierState";
import { AttackUnit } from "./AttackUnit";

const { separations } = config.steering;
const { attackTimes} = config.combat.melee;

enum MeleeAttackStateStep {
    Follow,
    Attack
}

export class MeleeAttackState extends State<ICharacterUnit> {

    public get target() { return this._target; }

    private _target: IUnit | null = null;
    private _step = MeleeAttackStateStep.Follow;
    private _loopConsumed = false;
    private _attackIndex = 0;

    override exit(unit: ICharacterUnit) {
        unit.isIdle = true;
        unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
    }

    override update(unit: ICharacterUnit) {

        const target = this._target!;
        const validTarget = target?.isAlive;
        if (!validTarget) {
            this.endAttack(unit);
            return;
        }

        switch (this._step) {
            case MeleeAttackStateStep.Follow: {
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

            case MeleeAttackStateStep.Attack: {

                UnitUtils.rotateToTarget(unit, target);

                const separation = separations[unit.type] + separations[target.type];
                const outOfRange = unit.visual.position.distanceTo(target.visual.position) > separation * 1.5;
                if (outOfRange) {
                    this._step = MeleeAttackStateStep.Follow;
                    unitMotion.moveUnit(unit, target.coords.mapCoords, false);
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
            }
        }        
    }

    public attackTarget(target: IUnit) {
        this._target = target;
    }    

    public onColliding(unit: ICharacterUnit) {
        if (this._step === MeleeAttackStateStep.Attack || unit.motionId === 0) {
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
                (() => {
                    const attack = target.fsm.getState(AttackUnit);
                    if (attack) {
                        if (attack.target === unit) {
                            // avoid orbiting into each other
                            this.endAttack(unit);
                            return;
                        }
                    }

                    // keep following
                    unitMotion.moveUnit(unit, target.coords.mapCoords);
                })();
            }
        } else {
            this.endAttack(unit);
        }
    }

    private startAttack(unit: ICharacterUnit) {
        unitMotion.endMotion(unit);
        this._step = MeleeAttackStateStep.Attack;
        unit.isIdle = false;
        this._loopConsumed = false;
        this._attackIndex = 0;
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
    }

    private endAttack(unit: IUnit) {
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);
        }
        unit.fsm.switchState(null);
    }
}

