import { Vector3 } from "three";
import { unitConfig } from "../../config/UnitConfig";
import { config } from "../../config/config";
import { State } from "../../fsm/StateMachine";
import { IUnit } from "../IUnit";
import { ITankUnit } from "../TankUnit";
import { unitMotion } from "../UnitMotion";
import { UnitUtils } from "../UnitUtils";
import { IVehicleUnit } from "../VehicleUnit";
import { IdleTank } from "./IdleTank";
import { time } from "../../../engine/core/Time";
import { ICharacterUnit } from "../ICharacterUnit";
import { MeleeAttackState } from "./MeleeAttackState";
import { AttackUnit } from "./AttackUnit";

enum AttackStep {
    Idle,
    Approach,
    Attack
}

const attackDelay = .8;
const attackFrequency = 1;
const { separations } = config.steering;
const targetPos = new Vector3();
const { unitScale } = config.game;
const headOffset = unitScale;

export class TankAttackUnit extends State<ITankUnit> {

    private _target: IUnit | null = null;
    private _step = AttackStep.Idle;
    private _attackTimer = 0;

    override update(unit: ITankUnit) {
        const target = this._target;
        if (!target || !target.isAlive) {
            if (unit.motionId > 0) {
                unitMotion.endMotion(unit);
            }
            unit.isIdle = true;
            this._step = AttackStep.Idle;
            this._target = null;
            unit.fsm.switchState(IdleTank);
            return;
        }

        const { range } = unitConfig[unit.type];
        switch (this._step) {
            case AttackStep.Idle: {
                if (UnitUtils.isOutOfRange(unit, target, range.attack)) {
                    unitMotion.moveUnit(unit, target.coords.mapCoords);
                    this._step = AttackStep.Approach;
                } else {
                    this.startAttack(unit);
                }
            }
                break;

            case AttackStep.Approach: {
                unit.resetCannon();
                if (!UnitUtils.isOutOfRange(unit, target!, range.attack - 1)) {
                    if (unit.motionId > 0) {
                        unitMotion.endMotion(unit);
                    }
                    this.startAttack(unit);
                }
            }
                break;

            case AttackStep.Attack: {
                unit.aimCannon(target.visual.position);

                const separation = separations[unit.type] + separations[target!.type];
                const tooClose = unit.visual.position.distanceTo(target!.visual.position) < separation * 1.5;
                if (tooClose) {
                    // can't shoot if too close
                    break;
                }

                if (this._attackTimer > 0) {
                    this._attackTimer -= time.deltaTime;
                    break;
                }

                // get the attacked unit to defend itself
                if (UnitUtils.isTank(target)) {
                    const attack = target.fsm.getState(TankAttackUnit) ?? target.fsm.switchState(TankAttackUnit);
                    attack.setTarget(unit);
                } else {
                    switch (target.type) {
                        case "worker": {
                            const worker = target as ICharacterUnit;
                            if (worker.isIdle && worker.motionId === 0 && !worker.resource) {
                                unitMotion.moveUnit(worker, unit.coords.mapCoords);
                                const meleeState = worker.fsm.getState(MeleeAttackState) ?? worker.fsm.switchState(MeleeAttackState);
                                meleeState.setTarget(unit);
                            }
                        }
                        break;
                        case "enemy-melee": {
                            const enemy = target as ICharacterUnit;
                            if (enemy.isIdle && enemy.motionId === 0) {
                                const attack = enemy!.fsm.getState(AttackUnit) ?? enemy!.fsm.switchState(AttackUnit);
                                attack.setTarget(unit);
                            }
                        }
                        break;
                    }
                }

                targetPos.copy(target.visual.position).addScaledVector(target.visual.up, headOffset);
                unit.shoot(targetPos);
                this._attackTimer = attackFrequency;
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

    public startAttack(unit: IVehicleUnit) {
        if (this._step === AttackStep.Attack) {
            console.assert(false);
            return;
        }
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);
        }
        this._step = AttackStep.Attack;
        this._attackTimer = attackDelay;
        unit.isIdle = false;
    }
}

