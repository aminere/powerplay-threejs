import { Vector3 } from "three";
import { unitConfig } from "../../config/UnitConfig";
import { State } from "../../fsm/StateMachine";
import { ITankUnit } from "../TankUnit";
import { unitMotion } from "../UnitMotion";
import { UnitUtils } from "../UnitUtils";
import { IVehicleUnit } from "../VehicleUnit";
import { IdleTank } from "./IdleTank";
import { time } from "../../../engine/core/Time";
import { IBuildingInstance } from "../../buildings/BuildingTypes";

enum AttackStep {
    Idle,
    Approach,
    Attack
}

const attackDelay = .8;
const attackFrequency = 1;
export class TankAttackBuilding extends State<ITankUnit> {

    private _target: IBuildingInstance | null = null;
    private _step = AttackStep.Idle;
    private _attackTimer = 0;

    override update(unit: ITankUnit) {
        const target = this._target;
        if (!target || target.deleted) {
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
                if (UnitUtils.isBuildingOutOfRange(unit, target, range.attack)) {
                    UnitUtils.moveToBuilding(unit, target);
                    this._step = AttackStep.Approach;
                } else {
                    this.startAttack(unit);
                }
            }
                break;

            case AttackStep.Approach: {
                if (!UnitUtils.isBuildingOutOfRange(unit, target!, range.attack - 1)) {
                    if (unit.motionId > 0) {
                        unitMotion.endMotion(unit);
                    }
                    this.startAttack(unit);
                }
            }
                break;

            case AttackStep.Attack: {
                unit.aimCannon(target.visual.position);                

                if (this._attackTimer > 0) {
                    this._attackTimer -= time.deltaTime;
                    break;
                }

                unit.shoot(new Vector3());
                this._attackTimer = attackFrequency;
            }
                break;
        }
    }

    public setTarget(target: IBuildingInstance) {
        if (this._target && !this._target.deleted) {
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

