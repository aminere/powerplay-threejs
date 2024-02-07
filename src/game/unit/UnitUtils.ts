import { Matrix4, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { IUnit } from "./IUnit";
import { flowField } from "../pathfinding/Flowfield";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/Time";
import { unitMotion } from "./UnitMotion";

const cellDirection3 = new Vector3();
const deltaPos = new Vector3();
const lookAt = new Matrix4();

class UnitUtils {        

    public computeDesiredPos(unit: IUnit, steerAmount: number) {
        const { motionId, desiredPosValid, desiredPos, coords, obj } = unit;
        if (motionId > 0) {
            if (!desiredPosValid) {   
                const flowfields = unitMotion.getFlowfields(motionId);            
                const _flowField = flowfields.get(`${coords.sectorCoords.x},${coords.sectorCoords.y}`);
                if (_flowField) {
                    const currentCellIndex = coords.cellIndex;
                    const flowfieldInfo = _flowField[currentCellIndex];
                    const { direction } = flowfieldInfo;
                    if (!flowfieldInfo.directionValid) {
                        const computed = flowField.computeDirection(unit.motionId, unit.coords.mapCoords, direction);
                        console.assert(computed, "flowfield direction not valid");
                        flowfieldInfo.directionValid = true;
                    }
                    cellDirection3.set(direction.x, 0, direction.y);
                    if (!unit.lastKnownFlowfield) {
                        unit.lastKnownFlowfield = {
                            cellIndex: currentCellIndex,
                            sectorCoords: coords.sectorCoords.clone()
                        };
                    } else {
                        unit.lastKnownFlowfield.cellIndex = currentCellIndex;
                        unit.lastKnownFlowfield.sectorCoords.copy(coords.sectorCoords);
                    }
                } else {

                    console.log(`flowfield not found for ${coords.sectorCoords.x},${coords.sectorCoords.y}`);
                    if (unit.lastKnownFlowfield) {
                        const lastKnownSector = unit.lastKnownFlowfield.sectorCoords;
                        const _flowField = flowfields.get(`${lastKnownSector.x},${lastKnownSector.y}`)!;
                        console.assert(_flowField);
                        console.log(`computing based on ${lastKnownSector.x},${lastKnownSector.y}`);
                        const neighborCellIndex = unit.lastKnownFlowfield.cellIndex;
                        const neighborDist = _flowField[neighborCellIndex].integration;
                        const cell = coords.sector!.cells[coords.cellIndex];
                        const cellDist = neighborDist + cell.flowFieldCost;
                        const newFlowfield = flowField.computeSector(cellDist, coords.localCoords, coords.sectorCoords);
                        flowfields.set(`${coords.sectorCoords.x},${coords.sectorCoords.y}`, newFlowfield);

                        const flowfieldInfo = newFlowfield[coords.cellIndex];
                        const { direction } = flowfieldInfo;
                        flowField.computeDirection(unit.motionId, unit.coords.mapCoords, direction);
                        flowfieldInfo.directionValid = true;
                        cellDirection3.set(direction.x, 0, direction.y);
                        unit.lastKnownFlowfield.cellIndex = coords.cellIndex;
                        unit.lastKnownFlowfield.sectorCoords.copy(coords.sectorCoords);

                        coords.sector!.flowfieldViewer.update(motionId, coords.sector!, coords.sectorCoords);
                        coords.sector!.flowfieldViewer.visible = true;
                    } else {
                        console.assert(false);
                        cellDirection3.set(0, 0, 0);
                    }                    
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
}

export const unitUtils = new UnitUtils();

