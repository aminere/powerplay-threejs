import { engineState } from "../../engine/EngineState";
import { Flock } from "../components/Flock";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import { flowField } from "../pathfinding/Flowfield";
import { pools } from "../../engine/Pools";
import { time } from "../../engine/Time";
import { skeletonManager } from "../animation/SkeletonManager";

enum NpcStep {
    Idle,
    Follow,
    Attack
}


export class NPCState extends State<IUnit> {

    private _step = NpcStep.Idle;
    private _target: IUnit | null = null;
    private _attackTimer = -1;
    private _attackStarted = false;
    private _hitTimer = 1;
    private _unitsInRange = new Array<[IUnit, number]>();

    override enter(_unit: IUnit) {
    }

    override update(unit: IUnit): void {

        const flock = engineState.getComponents(Flock)[0];
        switch (this._step) {
            case NpcStep.Idle: {
                const vision = flock.component.props.npcVision;
                const units = flock.component.state!.units;
                
                const unitsInRange = this._unitsInRange;
                unitsInRange.length = 0;
                for (const target of units) {
                    if (target.type === unit.type) {
                        continue;
                    }
                    if (!target.isAlive) {
                        continue;
                    }
                    const dist = target.obj.position.distanceTo(unit.obj.position);
                    if (dist < vision) {
                        unitsInRange.push([target, dist]);
                    }
                }

                if (unitsInRange.length > 0) {                    
                    unitsInRange.sort((a, b) => a[1] - b[1]);
                    for (let i = 0; i < unitsInRange.length; i++) {
                        const target = unitsInRange[i][0];
                        if (target.attackers.length === 0 || i === unitsInRange.length - 1) {
                            this._target = target;
                            target.attackers.push(unit);
                            this.follow(unit, target);
                            break;
                        }
                    }
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
                            this._attackTimer = 0.2;
                            this._attackStarted = false;
                            this._step = NpcStep.Attack;
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
                        if (!this._attackStarted) {
                            this._attackTimer -= time.deltaTime;
                            if (this._attackTimer < 0) {
                                this._attackStarted = true;
                                this._hitTimer = 1 - .2;
                                skeletonManager.applySkeleton("attack", unit);
                            }
                        } else {
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
        this._step = NpcStep.Follow;
        const [sectorCoords, localCoords] = pools.vec2.get(2);
        if (flowField.compute(target.coords.mapCoords, sectorCoords, localCoords)) {
            unitUtils.moveTo(unit, target.coords.mapCoords);
        }
    }

    private goToIdle(unit: IUnit) {
        if (this._target) {
            const index = this._target.attackers.indexOf(unit);
            if (index !== -1) {
                this._target.attackers.splice(index, 1);
            }
        }
        this._target = null;
        this._step = NpcStep.Idle;
        unit.isMoving = false;
        skeletonManager.applySkeleton("idle", unit);
    }
}

