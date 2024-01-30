import { Matrix4, Vector2, Vector3 } from "three";
import { ISector } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "../components/GameMapState";
import { config } from "../config";
import { IUnit } from "./IUnit";
import { flowField } from "../pathfinding/Flowfield";
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
    sector?: ISector;
    cellIndex: number;
}

export interface ICellPtr {
    sectorCoords: Vector2;
    mapCoords: Vector2;
    cellIndex: number;
}

function scheduleCommonAnim(unit: IUnit, animation: string, delaySecs: number) {
    if (unit.skeleton!.timeout) {
        clearTimeout(unit.skeleton!.timeout);
    }
    unit.skeleton!.timeout = setTimeout(() => {
        unit.skeleton!.isFree = true;
        unit.skeleton!.timeout = null;
        unit.skeleton = null;
        const action = skeletonManager.applySkeleton(animation, unit.obj)!;
        unit.animation!.name = animation;
        unit.animation!.action = action;
    }, delaySecs * 1000);
};

const { mapRes } = config.game;
const cellDirection3 = new Vector3();
const deltaPos = new Vector3();
const lookAt = new Matrix4();
class UnitUtils {

    public makeCellPtr(cellAddr: ICellAddr) {
        return {
            sectorCoords: cellAddr.sectorCoords.clone(),
            mapCoords: cellAddr.mapCoords.clone(),
            cellIndex: cellAddr.cellIndex
        };
    }

    public getCell(cellPtr: ICellPtr) {
        const { sectors } = gameMapState;
        const { sectorCoords, cellIndex } = cellPtr;
        const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`);
        if (!sector) {
            return null;
        }
        return sector.cells[cellIndex];
    }

    public computeCellAddr(mapCoords: Vector2, addrOut: ICellAddr) {
        addrOut.mapCoords.copy(mapCoords);
        GameUtils.getCell(mapCoords, addrOut.sectorCoords, addrOut.localCoords);
        addrOut.sector = gameMapState.sectors.get(`${addrOut.sectorCoords.x},${addrOut.sectorCoords.y}`);
        addrOut.cellIndex = addrOut.localCoords.y * mapRes + addrOut.localCoords.x;
    }

    public computeDesiredPos(unit: IUnit, steerAmount: number) {
        const { isMoving, desiredPosValid, desiredPos, targetCell, coords, obj } = unit;
        if (isMoving) {
            if (!desiredPosValid) {
                const { sector } = targetCell;
                const targetCellIndex = targetCell.cellIndex;
                const currentCellIndex = coords.cellIndex;
                const _flowField = sector!.cells[targetCellIndex].flowField!;
                const flowfieldInfo =  _flowField[currentCellIndex];
                const { direction, directionValid } = flowfieldInfo;
                if (!directionValid) {
                    flowField.computeDirection(_flowField, sector!.flowFieldCosts, currentCellIndex, direction);
                    flowfieldInfo.directionValid = true;
                }
                cellDirection3.set(direction.x, 0, direction.y);
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
            const rotationDamp = 0.2;
            unit.rotationVelocity = mathUtils.smoothDampQuat(unit.rotation, unit.lookAt, unit.rotationVelocity, rotationDamp, 999, time.deltaTime);
            unit.obj.quaternion.copy(unit.rotation);
        }
    }

    public setAnimation(unit: IUnit, animation: string, props?: {
        transitionDuration?: number;
        scheduleCommonAnim?: boolean;
        destAnimLoopMode?: LoopMode;
    }) {
        if (animation === unit.animation!.name) {
            return;
        }
        
        if (props?.transitionDuration !== undefined) {

            const { transitionDuration, destAnimLoopMode } = props;
            const skeletonId = getSkeletonId(unit.animation!.name, animation);
            if (unit.skeleton?.id === skeletonId) {
                skeletonPool.transition({ 
                    unit,
                    destAnim: animation, 
                    duration: transitionDuration,
                    destAnimLoopMode 
                });
            } else {
                if (unit.skeleton) {
                    skeletonPool.releaseSkeleton(unit);
                }
                skeletonPool.applyTransitionSkeleton({
                    unit,
                    destAnim: animation,
                    duration: transitionDuration,
                    destAnimLoopMode        
                });
            }

            if (props.scheduleCommonAnim) {
                scheduleCommonAnim(unit, animation, transitionDuration + .2);
            }

        } else {

            if (unit.skeleton) {
                skeletonPool.releaseSkeleton(unit);
            }

            const action = skeletonManager.applySkeleton(animation, unit.obj)!;
            unit.animation!.name = animation;
            unit.animation!.action = action;
        }
    }
}

export const unitUtils = new UnitUtils();

