import { FlockProps } from "../../components/Flock";
import { State } from "../../fsm/StateMachine";
import { time } from "../../../engine/core/Time";
import { npcUtils } from "../NPCUtils";
import { utils } from "../../../engine/Utils";
import { unitAnimation } from "../UnitAnimation";
import { UnitMotion } from "../UnitMotion";
import { mathUtils } from "../../MathUtils";
import { ICharacterUnit } from "../CharacterUnit";
import { IUnit } from "../Unit";

enum NpcStep {
    Idle,
    Follow,
    Attack
}

const vision = 5;

export class NPCState extends State<ICharacterUnit> {

    private _step = NpcStep.Idle;
    private _target: IUnit | null = null;
    private _hitTimer = 1;

    override update(unit: ICharacterUnit): void {

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
                        mathUtils.smoothDampVec3(unit.desiredPos, target.mesh.position, .2, time.deltaTime);
                        const dist = target.mesh.position.distanceTo(unit.mesh.position);
                        if (dist < flockProps.separation + .2) {
                            console.assert(unit.motionId > 0);
                            UnitMotion.onUnitArrived(unit);
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
                    const dist = target.mesh.position.distanceTo(unit.mesh.position);
                    const inRange = dist < flockProps.separation + .4;
                    if (inRange) {
                        UnitMotion.updateRotation(unit, unit.mesh.position, target.mesh.position);
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

    private follow(unit: ICharacterUnit, target: IUnit) {
        switch (this._step) {
            case NpcStep.Attack: {
                UnitMotion.moveUnit(unit, target.coords.mapCoords, false);
                unitAnimation.setAnimation(unit, "run", {
                    transitionDuration: .3,
                    scheduleCommonAnim: true
                });
            }
                break;

            default:
                UnitMotion.moveUnit(unit, target.coords.mapCoords);
                break;
        }
        this._step = NpcStep.Follow;
        this._target = target;
    }

    private goToIdle(unit: ICharacterUnit) {
        const target = this._target!;
        if (unit.motionId > 0) {
            UnitMotion.onUnitArrived(unit);
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

