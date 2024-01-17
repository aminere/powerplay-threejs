import { engineState } from "../../engine/EngineState";
import { Flock } from "../components/Flock";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import { flowField } from "../pathfinding/Flowfield";
import { pools } from "../../engine/Pools";
import { time } from "../../engine/Time";
import { skeletonManager } from "../animation/SkeletonManager";
import { IUniqueSkeleton, skeletonPool } from "../animation/SkeletonPool";
import { Animator } from "../../engine/components/Animator";
import { utils } from "../../engine/Utils";

enum NpcStep {
    Idle,
    Follow,
    Attack
}


export class NPCState extends State<IUnit> {

    private _step = NpcStep.Idle;
    private _target: IUnit | null = null;
    private _hitTimer = 1;
    private _unitsInRange = new Array<[IUnit, number]>();
    private _transitionSkeleton: IUniqueSkeleton | null = null;
    private _timeout: NodeJS.Timeout | null = null;

    override enter(_unit: IUnit) {
    }

    override exit(_unit: IUnit) {
        if (this._transitionSkeleton) {
            this._transitionSkeleton!.isFree = true;
            this._transitionSkeleton = null;            
        }
        if (this._timeout) {
            clearTimeout(this._timeout);
            this._timeout = null;
        }
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
                            this._hitTimer = 1 - .2;
                            this._step = NpcStep.Attack;

                            // skeletonManager.applySkeleton("attack", unit);
                            console.assert(unit.animation === "run");
                            const skeleton = skeletonManager.getSkeleton(unit.animation)!;
                            const animator = utils.getComponent(Animator, skeleton.armature)!;
                            console.assert(!this._transitionSkeleton);
                            const transitionDuration = .3;
                            this._transitionSkeleton = skeletonPool.applyTransitionSkeleton({
                                unit,
                                srcAnim: unit.animation,
                                srcAnimTime: animator.currentAction.time,
                                destAnim: "attack",
                                duration: transitionDuration
                            });                            
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
                    const transitionDuration = .3;
                    skeletonPool.transition(this._transitionSkeleton!, "attack", "run", transitionDuration);
                    this._timeout = setTimeout(() => {
                        this._transitionSkeleton!.isFree = true;
                        this._transitionSkeleton = null;
                        skeletonManager.applySkeleton("run", unit);
                        this._timeout = null;
                    }, transitionDuration * 1000);
                }
                    break;

                default:
                    unitUtils.moveTo(unit, target.coords.mapCoords);
                    break;
            }
        }

        this._step = NpcStep.Follow;
    }

    private goToIdle(unit: IUnit) {
        const target = this._target!;
        switch (this._step) {
            case NpcStep.Idle: {
                skeletonManager.applySkeleton("idle", unit);
            }
                break;

            case NpcStep.Attack: {
                const transitionDuration = 1;
                console.assert(this._transitionSkeleton);
                this._transitionSkeleton!.isFree = true;
                const attack = engineState.animations.get("attack")!;
                const srcAnimTime = this._transitionSkeleton?.mixer.existingAction(attack.clip)!.time!;
                this._transitionSkeleton = skeletonPool.applyTransitionSkeleton({
                    unit,
                    srcAnim: "attack",
                    srcAnimTime,
                    destAnim: "idle",
                    duration: transitionDuration
                });
                this._timeout = setTimeout(() => {
                    this._transitionSkeleton!.isFree = true;
                    this._transitionSkeleton = null;
                    skeletonManager.applySkeleton("idle", unit);
                    this._timeout = null;
                }, transitionDuration * 1000);
            }
                break;
        }
        
        const index = target.attackers.indexOf(unit);
        if (index !== -1) {
            target.attackers.splice(index, 1);
        }
        this._target = null;
        unit.isMoving = false;
        this._step = NpcStep.Idle;
    }
}

