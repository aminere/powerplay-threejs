
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { time } from "../../../engine/core/Time";
import { UnitUtils } from "../UnitUtils";
import { unitAnimation } from "../UnitAnimation";
import { unitMotion } from "../UnitMotion";
import { NPCState } from "./NPCState";
import { config } from "../../config/config";
import { unitConfig } from "../../config/UnitConfig";
import { SoldierState } from "./SoldierState";

const hitFrequency = .5;
const { separations } = config.steering;

enum MeleeAttackStateStep {
    Follow,
    Attack
}

export class MeleeAttackState extends State<ICharacterUnit> {

    private _target: IUnit | null = null;
    private _hitTimer = 0;
    private _step = MeleeAttackStateStep.Follow;    

    override exit(unit: ICharacterUnit) {
        unit.isIdle = true;
        unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
    }

    override update(unit: ICharacterUnit) {

        const target = this._target;
        if (target) {
            if (!target.isAlive) {
                this.endAttack(unit);
                return;
            }
        }

        switch (this._step) {
            case MeleeAttackStateStep.Follow: {
                const hasAk47 = unit.resource?.type === "ak47";
                if (hasAk47) {
                    if (!UnitUtils.isOutOfRange(unit, target!, config.combat.ak47Range - 1)) {
                        unitMotion.endMotion(unit);
                        const soldier = unit.fsm.switchState(SoldierState);
                        soldier.attackTarget(unit, target!);                        
                    }
                }
            }
            break;

            case MeleeAttackStateStep.Attack: {
                const separation = separations[unit.type] + separations[target!.type];
                const outOfRange = unit.visual.position.distanceTo(target!.visual.position) > separation * 1.5;
                if (outOfRange) {
                    this._step = MeleeAttackStateStep.Follow;
                    unitMotion.moveUnit(unit, target!.coords.mapCoords, false);
                    unitAnimation.setAnimation(unit, "run", { transitionDuration: .2, scheduleCommonAnim: true });

                } else {
                    UnitUtils.rotateToTarget(unit, target!);
                    if (this._hitTimer < 0) {
                        const damage = unitConfig[unit.type].damage;
                        target!.setHitpoints(target!.hitpoints - damage);
                        this._hitTimer = hitFrequency;
                    } else {
                        this._hitTimer -= time.deltaTime;
                    }
                }
            }
        }        
    }

    public attackTarget(unit: ICharacterUnit, target: IUnit) {
        this._target = target;
        unit.isIdle = false;
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
                    const npcState = target.fsm.getState(NPCState);
                    if (npcState) {
                        if (npcState.target === unit) {
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
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
    }

    private endAttack(unit: IUnit) {
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);
        }
        unit.fsm.switchState(null);
    }
}

