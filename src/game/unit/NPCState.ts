import { FlockProps } from "../components/Flock";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { time } from "../../engine/core/Time";
import { npcUtils } from "./NPCUtils";
import { utils } from "../../engine/Utils";
import { unitAnimation } from "./UnitAnimation";
import { unitMotion } from "./UnitMotion";
import { mathUtils } from "../MathUtils";

enum NpcStep {
    Idle,
    Follow,
    Attack
}

const vision = 5;

export class NPCState extends State<IUnit> {

    private _step = NpcStep.Idle;
    private _target: IUnit | null = null;
    private _hitTimer = 1;

    override update(unit: IUnit): void {

        const flockProps = FlockProps.instance;
        switch (this._step) {
            case NpcStep.Idle: {
                const target = npcUtils.findTarget(unit, vision);
                if (target) {
                    target.attackers.push(unit);
                    this.follow(unit, target);
                }
            }
                break;

            case NpcStep.Follow: {
                const target = this._target!;
                if (target.isAlive) {

                    if (unit.arriving) {
                        mathUtils.smoothDampVec3(unit.desiredPos, target.obj.position, .2, time.deltaTime);
                        const dist = target.obj.position.distanceTo(unit.obj.position);
                        if (dist < flockProps.separation + .2) {
                            console.assert(unit.motionId > 0);
                            unitMotion.onUnitArrived(unit);
                            this._hitTimer = 1 - .2;
                            this._step = NpcStep.Attack;
                            unitAnimation.setAnimation(unit, "attack", { transitionDuration: .3 });
                        }

                    } else {

                        if (!target.coords.mapCoords.equals(unit.targetCell.mapCoords)) {
                            this.follow(unit, target);
                        } else {
                            const arrived = unit.targetCell.mapCoords.equals(unit.coords.mapCoords);
                            if (arrived) {
                                unit.arriving = true;
                            }
                        }

                    }

                } else {
                    this.goToIdle(unit);
                }
            }
                break;

            case NpcStep.Attack: {
                const target = this._target!;
                if (target.isAlive) {
                    const dist = target.obj.position.distanceTo(unit.obj.position);
                    const inRange = dist < flockProps.separation + .4;
                    if (inRange) {
                        unitMotion.updateRotation(unit, unit.obj.position, target.obj.position);
                        this._hitTimer -= time.deltaTime;
                        if (this._hitTimer < 0) {
                            // TODO hit feedback                     
                            this._hitTimer = .5;
                            target.health -= 0.1;
                            if (!target.isAlive) {
                                this.goToIdle(unit);
                            }
                        }

                    } else {
                        this.follow(unit, target);
                    }
                } else {
                    this.goToIdle(unit);
                }

            }
        }
    }

    private follow(unit: IUnit, target: IUnit) {
        switch (this._step) {
            case NpcStep.Attack: {
                unitMotion.npcMove(unit, target.coords.sectorCoords, target.coords.mapCoords, false);
                unitAnimation.setAnimation(unit, "run", {
                    transitionDuration: .3,
                    scheduleCommonAnim: true
                });
            }
                break;

            default:
                unitMotion.npcMove(unit, target.coords.sectorCoords, target.coords.mapCoords);
                break;
        }
        this._step = NpcStep.Follow;
        this._target = target;
    }

    private goToIdle(unit: IUnit) {
        const target = this._target!;
        if (unit.motionId > 0) {
            unitMotion.onUnitArrived(unit);
        }
        unitAnimation.setAnimation(unit, "idle", {
            transitionDuration: 1,
            scheduleCommonAnim: true
        });
        const index = target.attackers.indexOf(unit);
        if (index !== -1) {
            utils.fastDelete(target.attackers, index);
        }
        this._target = null;
        this._step = NpcStep.Idle;
    }
}

