import { Matrix4, Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { IUnit } from "./IUnit";
import { TFlowField, flowField } from "../pathfinding/Flowfield";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/core/Time";

const cellDirection = new Vector2()
const cellDirection3 = new Vector3();
const deltaPos = new Vector3();
const lookAt = new Matrix4();

function getFlowDirection(motionId: number, mapCoords: Vector2, _flowfield: TFlowField, directionOut: Vector2) {
    const { directionIndex } = _flowfield;
    if (directionIndex < 0) {
        const computed = flowField.computeDirection(motionId, mapCoords, directionOut);
        console.assert(computed, "flowfield direction not valid");                        
        const index = flowField.computeDirectionIndex(directionOut);
        flowField.getDirection(index, directionOut);
        _flowfield.directionIndex = index;

    } else {
        flowField.getDirection(directionIndex, directionOut);                        
    }
}

class UnitUtils {        

    public computeDesiredPos(unit: IUnit, steerAmount: number) {
        const { motionId, desiredPosValid, desiredPos, coords, obj } = unit;
        if (motionId > 0) {
            if (!desiredPosValid) {   
                const flowfields = flowField.getMotion(motionId).flowfields;            
                const _flowField = flowfields.get(`${coords.sectorCoords.x},${coords.sectorCoords.y}`);
                if (_flowField) {
                    const currentCellIndex = coords.cellIndex;
                    const flowfieldInfo = _flowField[currentCellIndex];
                    getFlowDirection(motionId, coords.mapCoords, flowfieldInfo, cellDirection);
                    cellDirection3.set(cellDirection.x, 0, cellDirection.y);
                    
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
                        getFlowDirection(motionId, coords.mapCoords, flowfieldInfo, cellDirection);
                        unit.lastKnownFlowfield.cellIndex = coords.cellIndex;
                        unit.lastKnownFlowfield.sectorCoords.copy(coords.sectorCoords);

                        // coords.sector!.flowfieldViewer.update(motionId, coords.sector!, coords.sectorCoords);
                        // coords.sector!.flowfieldViewer.visible = true;
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

