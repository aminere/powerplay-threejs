import { State } from "../../fsm/StateMachine";
import { time } from "../../../engine/core/Time";
import { unitMotion } from "../UnitMotion";
import { ICharacterUnit } from "../ICharacterUnit";
import { IUnit } from "../IUnit";
import { spiralFind } from "../UnitSearch";
import { UnitUtils } from "../UnitUtils";
import { unitAnimation } from "../UnitAnimation";
import { MeleeDefendState } from "./MeleeDefendState";
import { unitConfig } from "../../config/UnitConfig";
import { config } from "../../config/config";

enum NpcStep {
    Idle,
    Follow,
    Attack
}

const vision = 4;
const hitFrequency = .5;
const { separations } = config.steering;

export class NPCState extends State<ICharacterUnit> {

    public get target() { return this._target; }

    private _target: IUnit | null = null;
    private _hitTimer = 1;
    private _step = NpcStep.Idle;

    override update(unit: ICharacterUnit): void {

        const target = this._target;
        if (target) {
            if (!target.isAlive) {
                this._target = null;
                unit.isIdle = true;
                this._step = NpcStep.Idle;
                unitAnimation.setAnimation(unit, "idle", { transitionDuration: .2, scheduleCommonAnim: true })
            }
        }

        switch (this._step) {
            case NpcStep.Idle: {
                const newTarget = spiralFind(unit, vision, other => !UnitUtils.isEnemy(other));
                if (newTarget) {
                    this.attackTarget(unit, newTarget);
                }
            }
            break;

            case NpcStep.Attack: {

                const separation = separations[unit.type] + separations[target!.type];
                const outOfRange = unit.visual.position.distanceTo(target!.visual.position) > separation * 1.1;
                if (outOfRange) {
                    
                    this._step = NpcStep.Follow;
                    unitMotion.moveUnit(unit, target!.coords.mapCoords, false);
                    unitAnimation.setAnimation(unit, "run", { transitionDuration: .2, scheduleCommonAnim: true });

                } else {

                    UnitUtils.rotateToTarget(unit, target!);
                    if (this._hitTimer < 0) {
                        const damage = unitConfig[unit.type].damage;
                        target!.setHitpoints(target!.hitpoints - damage);

                        if (target!.isAlive && UnitUtils.isWorker(target!)) {
                            const worker = target as ICharacterUnit;
                            if (worker.isIdle && worker.motionId === 0 && !worker.resource) {
                                const meleeState = target!.fsm.getState(MeleeDefendState) ?? target!.fsm.switchState(MeleeDefendState);
                                meleeState.startAttack(target as ICharacterUnit, unit);
                            }
                        }

                        this._hitTimer = hitFrequency;
                    } else {
                        this._hitTimer -= time.deltaTime;
                    }
                }
            }
            break;
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
        } else {
            unitMotion.endMotion(unit);
            this._target = null;
            unit.isIdle = true;
            this._step = NpcStep.Idle;
        }
    }

    public onColliding(unit: ICharacterUnit) {
        if (this._step === NpcStep.Attack || unit.motionId === 0) {
            return;
        }
        const withTarget = unit.collidingWith.includes(this._target!);
        if (withTarget) {
            this.startAttack(unit);
        }
    }

    public attackTarget(unit: ICharacterUnit, target: IUnit) {
        this._target = target;
        this._step = NpcStep.Follow;
        unitMotion.moveUnit(unit, target.coords.mapCoords);
    }   

    private startAttack(unit: ICharacterUnit) {
        unitMotion.endMotion(unit);
        this._step = NpcStep.Attack;
        unitAnimation.setAnimation(unit, "attack", { transitionDuration: .1 });
        unit.isIdle = false;
    }
}

