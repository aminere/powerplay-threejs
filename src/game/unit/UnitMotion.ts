import { Matrix4, Vector2, Vector3 } from "three";
import { ICell } from "../GameTypes";
import { TFlowField, TFlowFieldMap, flowField } from "../pathfinding/Flowfield";
import { MiningState } from "./MiningState";
import { IUnit } from "./IUnit";
import { GameUtils } from "../GameUtils";
import { computeUnitAddr } from "./UnitAddr";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { unitAnimation } from "./UnitAnimation";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/core/Time";
import { GameMapState } from "../components/GameMapState";
import { cellPathfinder } from "../pathfinding/CellPathfinder";
import { GameMapProps } from "../components/GameMapProps";

const cellDirection = new Vector2();
const cellDirection3 = new Vector3();
const deltaPos = new Vector3();
const lookAt = new Matrix4();

function moveTo(unit: IUnit, motionId: number, mapCoords: Vector2, bindSkeleton = true) {
    if (unit.motionId > 0) {
        flowField.removeMotion(unit.motionId);
    }
    unit.motionId = motionId;
    unit.arriving = false; 
    unit.collidable = true;
    computeUnitAddr(mapCoords, unit.targetCell);
    engineState.removeComponent(unit.obj, UnitCollisionAnim);
    if (bindSkeleton) {
        unitAnimation.setAnimation(unit, "run");
    }
}

const nextSector = new Vector2();
function getSectors(mapCoords: Vector2, srcSectorCoords: Vector2, destMapCoords: Vector2) {
    const cellPath = cellPathfinder.findPath(mapCoords, destMapCoords, { diagonals: () => false });
    if (!cellPath) {
        return null;
    }
    const currentSector = srcSectorCoords.clone();
    const sectors = new Set<string>();
    sectors.add(`${currentSector.x},${currentSector.y}`);
    for (const cell of cellPath) {
        GameUtils.getCell(cell, nextSector);
        if (!currentSector.equals(nextSector)) {
            sectors.add(`${nextSector.x},${nextSector.y}`);
            currentSector.copy(nextSector);
        }
    }
    const out = Array.from(sectors).map(s => { 
        const [x, y] = s.split(",");
        return new Vector2(parseInt(x), parseInt(y));
    });
    return out;
}

function onUnitArrived(unit: IUnit) {
    flowField.removeMotion(unit.motionId);
    unit.motionId = 0;
    unit.arriving = false;
    unit.velocity.set(0, 0, 0);
}

function isDirectionValid(flowfields: TFlowFieldMap, unit: IUnit) {
    const { mapCoords, sectorCoords, cellIndex } = unit.coords;
    const _flowField = flowfields.get(`${sectorCoords.x},${sectorCoords.y}`)!;
    const flowfieldInfo = _flowField[cellIndex];
    if (flowfieldInfo.directionIndex < 0) {
        const computed = flowField.computeDirection(flowfields, mapCoords, cellDirection);
        if (computed) {
            const index = flowField.computeDirectionIndex(cellDirection);
            flowfieldInfo.directionIndex = index;
            return true;
        } else {
            return false;
        }
    } else {
        return true;
    }
}

function steerFromFlowfield(unit: IUnit, _flowfield: TFlowField, steerAmount: number) {
    const { directionIndex } = _flowfield;    
    if (directionIndex < 0) {
        const mapCoords = unit.coords.mapCoords;
        const motion = flowField.getMotion(unit.motionId);
        const computed = flowField.computeDirection(motion.flowfields, mapCoords, cellDirection);
        if (computed) {
            const index = flowField.computeDirectionIndex(cellDirection);
            flowField.getDirection(index, cellDirection);
            _flowfield.directionIndex = index;
        } else {
            cellDirection.set(0, 0);
            onUnitArrived(unit);
            unitAnimation.setAnimation(unit, "idle", { transitionDuration: .4, scheduleCommonAnim: true });
        }

    } else {
        flowField.getDirection(directionIndex, cellDirection);
    }

    cellDirection3.set(cellDirection.x, 0, cellDirection.y).multiplyScalar(steerAmount);
    mathUtils.smoothDampVec3(unit.velocity, cellDirection3, .1, time.deltaTime);
    unit.desiredPos.addVectors(unit.obj.position, unit.velocity);
    unit.desiredPosValid = true;
}

class UnitMotion {

    public moveUnit(unit: IUnit, destMapCoords: Vector2, bindSkeleton = true) {
        const sectors = getSectors(unit.coords.mapCoords, unit.coords.sectorCoords, destMapCoords);
        if (!sectors) {
            console.warn(`no sectors found for npcMove from ${unit.coords.mapCoords} to ${destMapCoords}`);
            return;
        }
        const flowfields = flowField.compute(destMapCoords, sectors)!;
        console.assert(flowfields);
        const motionId = flowField.register(flowfields);
        moveTo(unit, motionId, destMapCoords, bindSkeleton);
        flowField.setMotionUnitCount(motionId, 1);
    }

    public moveGroup(units: IUnit[], destMapCoords: Vector2, destCell: ICell) {
        const sectors = getSectors(units[0].coords.mapCoords, units[0].coords.sectorCoords, destMapCoords);
        if (!sectors) {
            console.warn(`no sectors found for move from ${units[0].coords.mapCoords} to ${destMapCoords}`);
            return;
        }        

        const hasResource = destCell.resource || destCell.pickableResource;

        const validMove = (() => {
            if (hasResource) {
                return true;
            }

            if (destCell.buildingId) {                
                return true;
            }

            if (!destCell.isWalkable) {
                return false;
            }
            return true;
        })();

        if (!validMove) {
            return;
        }

        const flowfields = flowField.compute(destMapCoords, sectors)!;
        console.assert(flowfields);
        const nextState = hasResource ? MiningState : null;
        let unitCount = 0;
        let motionId: number | null = null;
        for (const unit of units) {
            if (!unit.isAlive) {
                continue;
            }
            
            if (unit.coords.mapCoords.equals(destMapCoords)) {
                continue;
            }

            if (!isDirectionValid(flowfields, unit)) {
                continue;
            }

            if (motionId === null) {
                motionId = flowField.register(flowfields);
            }

            moveTo(unit, motionId, destMapCoords);
            unit.fsm.switchState(nextState);
            ++unitCount;
        }

        if (motionId !== null) {
            console.assert(unitCount > 0);
            flowField.setMotionUnitCount(motionId, unitCount);
        }

        for (const sector of GameMapState.instance.sectors.values()) {
            sector.flowfieldViewer.visible = false;
        }
        if (GameMapProps.instance.debugFlowFields) {            
            for (const sectorCoords of sectors) {
                const sector = GameUtils.getSector(sectorCoords)!;
                sector.flowfieldViewer.update(flowfields, sector, sectorCoords);
                sector.flowfieldViewer.visible = true;
            }    
        }
    }

    public steer(unit: IUnit, steerAmount: number) {
        const { motionId, desiredPosValid, desiredPos, coords, obj } = unit;
        if (motionId > 0) {
            if (!desiredPosValid) { 
                
                if (unit.arriving) {

                    if (!unit.fsm.currentState) {
                        mathUtils.smoothDampVec3(unit.velocity, GameUtils.vec3.zero, .15, time.deltaTime);
                        unit.desiredPos.addVectors(unit.obj.position, unit.velocity);
                        unit.desiredPosValid = true;
                    }

                } else {
                    const flowfields = flowField.getMotion(motionId).flowfields;            
                    const _flowField = flowfields.get(`${coords.sectorCoords.x},${coords.sectorCoords.y}`);
                    if (_flowField) {
                        const currentCellIndex = coords.cellIndex;
                        const flowfieldInfo = _flowField[currentCellIndex];
                        steerFromFlowfield(unit, flowfieldInfo, steerAmount); 
                        
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
                            steerFromFlowfield(unit,flowfieldInfo, steerAmount);

                            unit.lastKnownFlowfield.cellIndex = coords.cellIndex;
                            unit.lastKnownFlowfield.sectorCoords.copy(coords.sectorCoords);

                            if (GameMapProps.instance.debugFlowFields) {
                                coords.sector!.flowfieldViewer.update(flowfields, coords.sector!, coords.sectorCoords);
                                coords.sector!.flowfieldViewer.visible = true;    
                            }

                        } else {
                            console.assert(false);                            
                            unit.velocity.set(0, 0, 0);
                            desiredPos.copy(obj.position);
                            unit.desiredPosValid = true;
                        }                    
                    }
                }                
            }

        } else {
            if (!desiredPosValid) {
                unit.velocity.set(0, 0, 0);
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
            deltaPos.divideScalar(deltaPosLen);
            unit.lookAt.setFromRotationMatrix(lookAt.lookAt(GameUtils.vec3.zero, deltaPos.negate(), GameUtils.vec3.up));
            const rotationDamp = 0.1;
            mathUtils.smoothDampQuat(unit.rotation, unit.lookAt, rotationDamp, time.deltaTime);
            unit.obj.quaternion.copy(unit.rotation);
        }
    }    

    public onUnitArrived(unit: IUnit) {
        onUnitArrived(unit);
    }
}

export const unitMotion = new UnitMotion();

