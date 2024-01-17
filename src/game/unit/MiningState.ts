import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { ICellPtr, unitUtils } from "./UnitUtils";
import { Object3D, Vector2 } from "three";
import { GameUtils } from "../GameUtils";
import { pools } from "../../engine/Pools";
import { flowField } from "../pathfinding/Flowfield";
import { skeletonManager } from "../animation/SkeletonManager";
import { IUniqueSkeleton, skeletonPool } from "../animation/SkeletonPool";
import { utils } from "../../engine/Utils";
import { Animator } from "../../engine/components/Animator";
import { time } from "../../engine/Time";

enum MiningStep {
    GoToResource,
    Mine,
    GoToBase,
}

export class MiningState extends State<IUnit> {

    public set potentialTarget(value: Vector2) { this._potentialTarget.copy(value); }

    private _step!: MiningStep;
    private _miningTimer!: number;
    private _targetResource!: ICellPtr;
    private _potentialTarget = new Vector2(-1, -1);
    private _transitionSkeleton: IUniqueSkeleton | null = null;
    private _timeout: NodeJS.Timeout | null = null;

    override enter(unit: IUnit) {        
        this._step = MiningStep.GoToResource;
        this._targetResource = unitUtils.makeCellPtr(unit.targetCell);
        this._potentialTarget.set(-1, -1);
    }

    override exit(_owner: IUnit) {
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
        switch (this._step) {

            case MiningStep.GoToResource: {
                const isTarget = unit.targetCell.mapCoords.equals(this._potentialTarget);
                if (isTarget) {
                    unit.isMoving = false;
                    unit.collidable = false;
                    this._step = MiningStep.Mine;
                    this._miningTimer = 1;
                    
                    const skeleton = skeletonManager.getSkeleton(unit.animation)!;
                    const animator = utils.getComponent(Animator, skeleton.armature)!;
                    console.assert(!this._transitionSkeleton);
                    this._transitionSkeleton = skeletonPool.applyTransitionSkeleton({
                        unit,
                        srcAnim: unit.animation,
                        srcAnimTime: animator.currentAction.time,
                        destAnim: "pick"
                    });
                }
            }
                break;

            case MiningStep.GoToBase: {
                const isTarget = unit.targetCell.mapCoords.equals(this._potentialTarget);
                if (isTarget) {
                    unit.isMoving = false;
                    this._step = MiningStep.GoToResource;
                    unitUtils.moveTo(unit, this._targetResource.mapCoords);
                }
            }
                break;

            case MiningStep.Mine:
                this._miningTimer -= time.deltaTime;
                if (this._miningTimer < 0) {
                    const sector = unit.coords.sector!;
                    let distToClosestBuilding = 999999;
                    let closestBuilding: Object3D | null = null;
                    const worldPos = pools.vec3.getOne();
                    for (const building of sector.layers.buildings.children) {
                        building.getWorldPosition(worldPos);
                        const dist = worldPos.distanceTo(unit.obj.position);
                        if (dist < distToClosestBuilding) {
                            distToClosestBuilding = dist;
                            closestBuilding = building;
                        }
                    }
                    if (!closestBuilding) {
                        // TODO scan other sectors
                        console.assert(false, "No building found");
                    } else {
                        closestBuilding.getWorldPosition(worldPos);
                        const [sectorCoords, localCoords, targetBuilding] = pools.vec2.get(3);
                        GameUtils.worldToMap(worldPos, targetBuilding);
                        if (flowField.compute(targetBuilding, sectorCoords, localCoords)) {
                            unitUtils.moveTo(unit, targetBuilding, false);

                            const transitionDuration = .3;
                            skeletonPool.transition(this._transitionSkeleton!, "pick", "run", transitionDuration);
                            this._timeout = setTimeout(() => {
                                this._transitionSkeleton!.isFree = true;
                                this._transitionSkeleton = null;
                                skeletonManager.applySkeleton("run", unit);
                                this._timeout = null;
                            }, transitionDuration * 1000);

                        } else {
                            console.assert(false, "No path found");
                        }
                    }
                    this._step = MiningStep.GoToBase;
                }
                break;

        }
    }
}

