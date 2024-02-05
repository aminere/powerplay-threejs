import { Matrix4, Vector2, Vector3 } from "three";
import { ISector } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "../components/GameMapState";
import { config } from "../config";
import { IUnit } from "./IUnit";
import { flowField, getFlowfield } from "../pathfinding/Flowfield";
import { skeletonManager } from "../animation/SkeletonManager";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { engineState } from "../../engine/EngineState";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/Time";
import { getSkeletonId, skeletonPool } from "../animation/SkeletonPool";
import { LoopMode } from "../../engine/Types";

export interface ICellAddr {
    mapCoords: Vector2;
    localCoords: Vector2;
    sectorCoords: Vector2;
    cellIndex: number;
    sector?: ISector;
}

const { mapRes } = config.game;
const cellDirection3 = new Vector3();
const deltaPos = new Vector3();
const lookAt = new Matrix4();

function setCommonAnimation(unit: IUnit, animation: string) {
    if (unit.skeleton) {
        skeletonPool.releaseSkeleton(unit);
    }
    const action = skeletonManager.applySkeleton(animation, unit.obj)!;
    unit.animation.name = animation;
    unit.animation.action = action;
}

class UnitUtils {    

    public computeCellAddr(mapCoords: Vector2, addrOut: ICellAddr) {
        addrOut.mapCoords.copy(mapCoords);
        GameUtils.getCell(mapCoords, addrOut.sectorCoords, addrOut.localCoords);
        addrOut.sector = gameMapState.sectors.get(`${addrOut.sectorCoords.x},${addrOut.sectorCoords.y}`);
        addrOut.cellIndex = addrOut.localCoords.y * mapRes + addrOut.localCoords.x;
    }

    public copyCellAddr(src: ICellAddr, dest: ICellAddr) {
        dest.mapCoords.copy(src.mapCoords);
        dest.localCoords.copy(src.localCoords);
        dest.sectorCoords.copy(src.sectorCoords);
        dest.cellIndex = src.cellIndex;
        dest.sector = src.sector;
    }

    public computeDesiredPos(unit: IUnit, steerAmount: number) {
        const { isMoving, desiredPosValid, desiredPos, targetCell, coords, obj } = unit;
        if (isMoving) {
            if (!desiredPosValid) {
                const { sector } = targetCell;
                const targetCellIndex = targetCell.cellIndex;
                const targetCellInstance = sector!.cells[targetCellIndex];
                const _flowField = getFlowfield(targetCellInstance, targetCell.sectorCoords, coords.sectorCoords);
                if (_flowField) {
                    const currentCellIndex = coords.cellIndex;
                    const flowfieldInfo = _flowField[currentCellIndex];
                    const { direction } = flowfieldInfo;
                    if (!flowfieldInfo.directionValid) {
                        const computed = flowField.computeDirection(unit.coords.mapCoords, targetCellInstance, targetCell.sectorCoords, direction);
                        flowfieldInfo.directionValid = true;
                        console.assert(computed, "flowfield direction not valid");
                    }
                    cellDirection3.set(direction.x, 0, direction.y);
                    unit.flowfieldDir.copy(direction);
                } else {
                    console.log(`moving near corner, using the last known direction`);
                    cellDirection3.set(unit.flowfieldDir.x, 0, unit.flowfieldDir.y);
                }                
                desiredPos.addVectors(obj.position, cellDirection3.multiplyScalar(steerAmount));
                unit.desiredPosValid = true;
            }
        } else {
            if (!desiredPosValid) {
                desiredPos.copy(obj.position);
                unit.desiredPosValid = true;
            }
        }
        return desiredPos;
    }

    public moveTo(unit: IUnit, mapCoords: Vector2, bindSkeleton = true) {
        unit.isMoving = true;
        unit.collidable = true;
        this.computeCellAddr(mapCoords, unit.targetCell);
        engineState.removeComponent(unit.obj, UnitCollisionAnim);
        if (bindSkeleton) {
            this.setAnimation(unit, "run");
        }
    }

    public updateRotation(unit: IUnit, fromPos: Vector3, toPos: Vector3) {
        deltaPos.subVectors(toPos, fromPos);
        const deltaPosLen = deltaPos.length();
        if (deltaPosLen > 0.01) {
            cellDirection3.copy(deltaPos).divideScalar(deltaPosLen);
            unit.lookAt.setFromRotationMatrix(lookAt.lookAt(GameUtils.vec3.zero, cellDirection3.negate(), GameUtils.vec3.up));
            const rotationDamp = 0.3;
            unit.rotationVelocity = mathUtils.smoothDampQuat(unit.rotation, unit.lookAt, unit.rotationVelocity, rotationDamp, 999, time.deltaTime);
            unit.obj.quaternion.copy(unit.rotation);
        }
    }

    public setAnimation(
        unit: IUnit,
        animation: string,
        props?: {
            transitionDuration?: number;
            scheduleCommonAnim?: boolean;
            destAnimLoopMode?: LoopMode;
        }
    ) {
        if (animation === unit.animation!.name) {
            return;
        }
        
        if (props?.transitionDuration !== undefined) {

            const { transitionDuration, destAnimLoopMode } = props;
            const skeletonId = getSkeletonId(unit.animation!.name, animation);
            
            if (unit.skeleton?.id === skeletonId) {
                skeletonPool.transition({ unit, destAnim: animation, duration: transitionDuration, destAnimLoopMode });
            } else {
                if (unit.skeleton) {
                    skeletonPool.releaseSkeleton(unit);
                }
                skeletonPool.applyTransitionSkeleton({ unit, destAnim: animation, duration: transitionDuration, destAnimLoopMode });
            }

            if (props.scheduleCommonAnim) {
                if (unit.skeleton!.timeout) {
                    clearTimeout(unit.skeleton!.timeout);
                }
                unit.skeleton!.timeout = setTimeout(() => {
                    unit.skeleton!.timeout = null;
                    setCommonAnimation(unit, animation);
                }, transitionDuration * 1000 + 200);
            } else {
                if (unit.skeleton!.timeout) {
                    clearTimeout(unit.skeleton!.timeout);
                    unit.skeleton!.timeout = null;
                }
            }

        } else {
            setCommonAnimation(unit, animation);
        }
    }
}

export const unitUtils = new UnitUtils();

