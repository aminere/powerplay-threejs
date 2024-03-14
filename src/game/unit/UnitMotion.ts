import { Matrix4, Vector2, Vector3 } from "three";
import { ICell } from "../GameTypes";
import { TFlowField, flowField } from "../pathfinding/Flowfield";
import { MiningState } from "./MiningState";
import { IUnit } from "./IUnit";
import { sectorPathfinder } from "../pathfinding/SectorPathfinder";
import { GameUtils } from "../GameUtils";
import { computeUnitAddr } from "./UnitAddr";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { unitAnimation } from "./UnitAnimation";
import { cellPathfinder } from "../pathfinding/CellPathfinder";
import { config } from "../config";
import { pools } from "../../engine/core/Pools";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/core/Time";
import { gameMapState } from "../components/GameMapState";

const { mapRes } = config.game;
const oneSector = [new Vector2()];
const cellDirection = new Vector2();
const cellDirection3 = new Vector3();
const deltaPos = new Vector3();
const lookAt = new Matrix4();

function getTargetCoords(path: Vector2[], desiredTargetCell: ICell, desiredTargetCellCoords: Vector2) {
    const resource = desiredTargetCell.resource?.name;
    if (resource) {
        return desiredTargetCellCoords;
    } else if (desiredTargetCell.isWalkable) {
        return path[path.length - 1];
    } else if (path.length > 2) {
        return path[path.length - 2];
    }
    return null;
}    

function moveTo(unit: IUnit, motionId: number, mapCoords: Vector2, bindSkeleton = true) {
    if (unit.motionId > 0) {
        flowField.onUnitArrived(unit.motionId);
    }
    unit.motionId = motionId;    
    unit.collidable = true;
    computeUnitAddr(mapCoords, unit.targetCell);
    engineState.removeComponent(unit.obj, UnitCollisionAnim);
    if (bindSkeleton) {
        unitAnimation.setAnimation(unit, "run");
    }
}

function getSectors(sourceSectorCoords: Vector2, destSectorCoords: Vector2) {
    const sameSector = sourceSectorCoords.equals(destSectorCoords);
    if (sameSector) {
        oneSector[0] = sourceSectorCoords;
        return oneSector;
    } else {
        const sectorPath = sectorPathfinder.findPath(sourceSectorCoords, destSectorCoords)!;
        console.assert(sectorPath);
        return sectorPath;
    }
}

function getSrcMapCoords(srcMapCoords: Vector2, sectors: Vector2[]) {
    const sameSector = sectors.length === 1;
    if (sameSector) {
        return srcMapCoords;
    } else {
        console.assert(sectors.length > 1);
        const [sector1, sector2] = sectors.slice(-2);
        const dx = sector2.x - sector1.x;
        const dy = sector2.y - sector1.y;
        console.assert(Math.abs(dx) + Math.abs(dy) === 1);
        const sector = GameUtils.getSector(sector2)!;
        if (dx === 0) {
            console.assert(Math.abs(dy) === 1);
            const y = dy > 0 ? 0 : mapRes - 1;
            for (let x = 0; x < mapRes; x++) {
                const cellIndex = y * mapRes + x;
                if (sector.cells[cellIndex].isWalkable) {
                    return pools.vec2.getOne().set(sector2.x * mapRes + x, sector2.y * mapRes + y);
                }
            }

        } else {
            console.assert(Math.abs(dx) === 1);
            const x = dx > 0 ? 0 : mapRes - 1;
            for (let y = 0; y < mapRes; y++) {
                const cellIndex = y * mapRes + x;
                if (sector.cells[cellIndex].isWalkable) {
                    return pools.vec2.getOne().set(sector2.x * mapRes + x, sector2.y * mapRes + y);
                }
            }
        }
    }
    return null;
}

function steerFromFlowfield(unit: IUnit, _flowfield: TFlowField, steerAmount: number) {
    const { directionIndex } = _flowfield;    
    if (directionIndex < 0) {
        const mapCoords = unit.coords.mapCoords;
        const computed = flowField.computeDirection(unit.motionId, mapCoords, cellDirection);
        console.assert(computed, "flowfield direction not valid");                        
        const index = flowField.computeDirectionIndex(cellDirection);
        flowField.getDirection(index, cellDirection);
        _flowfield.directionIndex = index;

    } else {
        flowField.getDirection(directionIndex, cellDirection);                        
    }

    cellDirection3.set(cellDirection.x, 0, cellDirection.y).multiplyScalar(steerAmount);
    mathUtils.smoothDampVec3(unit.velocity, cellDirection3, .1, time.deltaTime);
    unit.desiredPos.addVectors(unit.obj.position, unit.velocity);
    unit.desiredPosValid = true;
}

class UnitMotion {

    public npcMove(unit: IUnit, destSectorCoords: Vector2, destMapCoords: Vector2, bindSkeleton = true) {
        const sourceSectorCoords = unit.coords.sectorCoords;
        const sectors = getSectors(sourceSectorCoords, destSectorCoords);
        const flowfields = flowField.compute(destMapCoords, sectors)!;
        console.assert(flowfields);
        const motionId = flowField.register(flowfields);
        moveTo(unit, motionId, destMapCoords, bindSkeleton);
        flowField.setMotionUnitCount(motionId, 1);
    }

    public move(units: IUnit[], destSectorCoords: Vector2, destMapCoords: Vector2, destCell: ICell) {
        const sourceSectorCoords = units[0].coords.sectorCoords;
        const sectors = getSectors(sourceSectorCoords, destSectorCoords);
        const srcMapCoords = getSrcMapCoords(units[0].coords.mapCoords, sectors);

        if (!srcMapCoords) {
            return;
        }

        console.assert(Math.abs(destMapCoords.x - srcMapCoords.x) < mapRes);
        console.assert(Math.abs(destMapCoords.y - srcMapCoords.y) < mapRes);
        const path = cellPathfinder.findPath(srcMapCoords, destMapCoords, { diagonals: () => false });
        if (!path || path.length < 2) {
            return;
        }

        const targetCellCoords = getTargetCoords(path, destCell, destMapCoords);
        if (!targetCellCoords) {
            return;
        }

        const flowfields = flowField.compute(targetCellCoords, sectors)!;
        console.assert(flowfields);        
        const resource = destCell.resource?.name;
        const nextState = resource ? MiningState : null;
        let unitCount = 0;
        let motionId: number | null = null;
        for (const unit of units) {
            if (!unit.isAlive) {
                continue;
            }
            if (unit.coords.mapCoords.equals(targetCellCoords)) {
                continue;
            }

            if (motionId === null) {
                motionId = flowField.register(flowfields);
            }

            moveTo(unit, motionId, targetCellCoords);
            unit.fsm.switchState(nextState);
            ++unitCount;
        }

        if (motionId !== null) {
            console.assert(unitCount > 0);
            flowField.setMotionUnitCount(motionId, unitCount);

            for (const sector of gameMapState.sectors.values()) {
                sector.flowfieldViewer.visible = false;
            }
            for (const sectorCoords of sectors) {
                const sector = GameUtils.getSector(sectorCoords)!;
                sector.flowfieldViewer.update(motionId, sector, sectorCoords);
                sector.flowfieldViewer.visible = false; //true;
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
                            // coords.sector!.flowfieldViewer.update(motionId, coords.sector!, coords.sectorCoords);
                            // coords.sector!.flowfieldViewer.visible = true;
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
        flowField.onUnitArrived(unit.motionId);
        unit.motionId = 0;
        unit.arriving = false;
        unit.velocity.set(0, 0, 0);
    }
}

export const unitMotion = new UnitMotion();

