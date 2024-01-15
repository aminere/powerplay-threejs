import { Matrix4, Quaternion, Vector2, Vector3 } from "three";
import { ISector } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "../components/GameMapState";
import { config } from "../config";
import { IUnit } from "./IUnit";
import { flowField } from "../pathfinding/Flowfield";
import { SkeletonManager } from "../animation/SkeletonManager";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { engineState } from "../../engine/EngineState";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/Time";

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

const { mapRes } = config.game;
const cellDirection3 = new Vector3();
const deltaPos = new Vector3();
const lookAt = new Matrix4();
class UnitUtils {

    public set skeletonManager(value: SkeletonManager) { this._skeletonManager = value; }
    public get skeletonManager() { return this._skeletonManager; }

    public set baseRotation(value: Quaternion) { this._baseRotation.copy(value); }

    private _skeletonManager!: SkeletonManager;
    private _baseRotation = new Quaternion();

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
                const { directions } = _flowField;
                const [cellDirection, cellDirectionValid] = directions[currentCellIndex];
                if (!cellDirectionValid) {
                    flowField.computeDirection(_flowField, sector!.flowFieldCosts, currentCellIndex, cellDirection);
                    directions[currentCellIndex][1] = true;
                }
                cellDirection3.set(cellDirection.x, 0, cellDirection.y);
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

    public moveTo(unit: IUnit, mapCoords: Vector2) {
        unit.isMoving = true;
        unit.collidable = true;
        this.computeCellAddr(mapCoords, unit.targetCell);
        engineState.removeComponent(unit.obj, UnitCollisionAnim);
        this._skeletonManager.applySkeleton("run", unit.obj);
    }    

    public updateRotation(unit: IUnit, fromPos: Vector3, toPos: Vector3) {
        deltaPos.subVectors(toPos, fromPos);
        const deltaPosLen = deltaPos.length();
        if (deltaPosLen > 0.01) {
            cellDirection3.copy(deltaPos).divideScalar(deltaPosLen);
            unit.lookAt.setFromRotationMatrix(lookAt.lookAt(GameUtils.vec3.zero, cellDirection3.negate(), GameUtils.vec3.up));
            const rotationDamp = 0.2;
            unit.rotationVelocity = mathUtils.smoothDampQuat(unit.rotation, unit.lookAt, unit.rotationVelocity, rotationDamp, 999, time.deltaTime);
            unit.obj.quaternion.multiplyQuaternions(unit.rotation, this._baseRotation);
        }
    }
}

export const unitUtils = new UnitUtils();

