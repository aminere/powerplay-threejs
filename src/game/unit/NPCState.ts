import { engineState } from "../../engine/EngineState";
import { Flock } from "../components/Flock";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import { flowField } from "../pathfinding/Flowfield";
import { pools } from "../../engine/Pools";
import { time } from "../../engine/Time";
import { npcUtils } from "./NPCUtils";
import { utils } from "../../engine/Utils";

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

        const flock = engineState.getComponents(Flock)[0];
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
                    if (!target.coords.mapCoords.equals(unit.targetCell.mapCoords)) {
                        this.follow(unit, target);
                    } else {
                        const dist = target.obj.position.distanceTo(unit.obj.position);
                        if (dist < flock.component.props.separation + .2) {
                            unit.isMoving = false;
                            this._hitTimer = 1 - .2;
                            this._step = NpcStep.Attack;
                            unitUtils.setAnimation(unit, "attack", { transitionDuration: .3 });
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
                    const inRange = dist < flock.component.props.separation + .4;
                    if (inRange) {
                        unitUtils.updateRotation(unit, unit.obj.position, target.obj.position);
                        this._hitTimer -= time.deltaTime;
                        if (this._hitTimer < 0) {
                            // TODO hit feedback                     
                            this._hitTimer = .5;
                            target.health -= 0.5;
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
        const [sectorCoords, localCoords] = pools.vec2.get(2);
        if (flowField.compute(target.coords.mapCoords, sectorCoords, localCoords)) {
            switch (this._step) {
                case NpcStep.Attack: {
                    unitUtils.moveTo(unit, target.coords.mapCoords, false);
                    unitUtils.setAnimation(unit, "run", {
                        transitionDuration: .3,
                        scheduleCommonAnim: true
                    });
                }
                    break;

                default:
                    unitUtils.moveTo(unit, target.coords.mapCoords);                    
                    break;
            }
            this._step = NpcStep.Follow;
            this._target = target;
        }
    }

    private goToIdle(unit: IUnit) {
        const target = this._target!;
        unitUtils.setAnimation(unit, "idle", {
            transitionDuration: 1,
            scheduleCommonAnim: true
        });
        const index = target.attackers.indexOf(unit);
        if (index !== -1) {
            utils.fastDelete(target.attackers, index);
        }
        this._target = null;
        unit.isMoving = false;
        this._step = NpcStep.Idle;
    }
}

