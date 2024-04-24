import { MathUtils, Matrix4, Vector2, Vector3 } from "three";
import { ICell } from "../GameTypes";
import { TFlowField, TFlowFieldMap, flowField } from "../pathfinding/Flowfield";
import { GameUtils } from "../GameUtils";
import { computeUnitAddr, getCellFromAddr } from "./UnitAddr";
import { mathUtils } from "../MathUtils";
import { time } from "../../engine/core/Time";
import { GameMapState } from "../components/GameMapState";
import { cellPathfinder } from "../pathfinding/CellPathfinder";
import { GameMapProps } from "../components/GameMapProps";
import { sectorPathfinder } from "../pathfinding/SectorPathfinder";
import { config } from "../config";
import { MiningState } from "./states/MiningState";
import { utils } from "../../engine/Utils";
import { cmdFogMoveCircle } from "../../Events";
import { IUnit } from "./Unit";
import { ICharacterUnit } from "./CharacterUnit";
import { UnitUtils } from "./UnitUtils";
import { NPCState } from "./states/NPCState";
import { UnitType } from "../GameDefinitions";

const cellDirection = new Vector2();
const cellDirection3 = new Vector3();
const deltaPos = new Vector3();
const matrix = new Matrix4();
const destSectorCoords = new Vector2();

const cellCoords = new Vector2();
const toTarget = new Vector3();
const awayDirection = new Vector2();
const avoidedCellCoords = new Vector2();
const avoidedCellSector = new Vector2();
const avoidedCellLocalCoords = new Vector2();
const nextMapCoords = new Vector2();
const nextPos = new Vector3();
            
const { mapRes } = config.game;
const { separations, repulsion, positionDamp } = config.flocking;

const characterArrivalDamping = .05;
const vehicleArrivalDamping = .15;
const arrivalDamping: Record<UnitType, number> = {
    "enemy-melee": characterArrivalDamping,
    "enemy-ranged": characterArrivalDamping,
    "worker": characterArrivalDamping,
    "truck": vehicleArrivalDamping,
    "tank": vehicleArrivalDamping
};

function moveTo(unit: IUnit, motionId: number, mapCoords: Vector2, bindSkeleton = true) {
    if (unit.motionId > 0) {
        flowField.removeMotion(unit.motionId);
    }
    unit.motionId = motionId;
    unit.arriving = false;
    computeUnitAddr(mapCoords, unit.targetCell);
    unit.onMove(bindSkeleton);
}

const nextSector = new Vector2();
function getSectors(mapCoords: Vector2, srcSectorCoords: Vector2, destMapCoords: Vector2, destCell: ICell) {

    const destBuildingId = destCell.building?.instanceId;
    const cellPath = cellPathfinder.findPath(mapCoords, destMapCoords, { 
        diagonals: () => false,
        isWalkable: (destBuildingId || destCell.resource) ? (cell: ICell) => {

            const cellBuildingId = cell.building?.instanceId;
            if (cellBuildingId) {
                // allow to walk to any cell in the destination building, the unit will stop when hitting the building
                if (destCell.pickableResource) {
                    // unless the destination is an output cell
                    const isWalkable = cell.pickableResource !== undefined;
                    return isWalkable;
                } else {
                    return cellBuildingId === destBuildingId;
                }
            } else if (cell.resource) {
                return cell.resource.type === destCell.resource?.type;
            }
            
            return cell.isWalkable;
        } : undefined
    });

    if (cellPath) {
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
    
        if (GameMapProps.instance.debugPathfinding) {
            GameMapState.instance.debug.path.update(cellPath);
        } else {
            GameMapState.instance.debug.path.visible = false;
        }
    
        return out;

    } else {

        // cell pathfinder failed, use coarse sector pathfinder
        GameUtils.getCell(destMapCoords, destSectorCoords)
        return sectorPathfinder.findPath(srcSectorCoords, destSectorCoords);
    }    
}

function endMotion(unit: IUnit) {
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
            endMotion(unit);
            unit.onArrived();
        }

    } else {
        flowField.getDirection(directionIndex, cellDirection);
    }

    cellDirection3.set(cellDirection.x, 0, cellDirection.y).multiplyScalar(steerAmount);
    mathUtils.smoothDampVec3(unit.velocity, cellDirection3, .1, time.deltaTime);
    unit.desiredPos.addVectors(unit.visual.position, unit.velocity);
    unit.desiredPosValid = true;
}

function steer(unit: IUnit, steerAmount: number) {
    const { motionId, desiredPosValid, desiredPos, coords } = unit;
    if (motionId > 0) {
        if (!desiredPosValid) {
            if (unit.arriving) {
                mathUtils.smoothDampVec3(unit.velocity, GameUtils.vec3.zero, arrivalDamping[unit.type], time.deltaTime);
                unit.desiredPos.addVectors(unit.visual.position, unit.velocity);
                unit.desiredPosValid = true;

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

                        if (GameMapProps.instance.debugPathfinding) {
                            coords.sector!.flowfieldViewer.update(flowfields, coords.sector!, coords.sectorCoords);
                            coords.sector!.flowfieldViewer.visible = true;    
                        }

                    } else {
                        console.assert(false);                            
                        unit.velocity.set(0, 0, 0);
                        desiredPos.copy(unit.visual.position);
                        unit.desiredPosValid = true;
                    }                    
                }
            }                
        }

    } else {
        if (!desiredPosValid) {
            unit.velocity.set(0, 0, 0);
            desiredPos.copy(unit.visual.position);
            unit.desiredPosValid = true;
        }
    }
    return desiredPos;
}

function getFlowfieldCost(destCell: ICell, currentCell: ICell) {
    if (destCell.resource) {
        if (destCell.resource.type === currentCell.resource?.type) {            
            return 1;
        }
    } else if (destCell.building) {
        if (destCell.building.instanceId === currentCell.building?.instanceId) {
            if (destCell.pickableResource) {
                if (currentCell === destCell) {
                    return 1;
                }
            } else {
                return 1;
            }
        }
    }
    return currentCell.flowFieldCost;
}

function getVehicleFlowfieldCost(destCell: ICell, currentCell: ICell) {
    if (currentCell.roadTile) {
        return 1;
    } else {
        // discourage vehicles from moving off-road
        return getFlowfieldCost(destCell, currentCell) + 10;
    }
}

const unitNeighbors = new Array<IUnit>();
function getUnitNeighbors(unit: IUnit, radius: number) {
    unitNeighbors.length = 0;
    const { mapCoords } = unit.coords;
    for (let y = mapCoords.y - radius; y <= mapCoords.y + radius; y++) {
        for (let x = mapCoords.x - radius; x <= mapCoords.x + radius; x++) {
            cellCoords.set(x, y);
            const units = GameUtils.getCell(cellCoords)?.units;
            if (units) {
                for (const neighbor of units) {
                    if (neighbor.isAlive && neighbor !== unit) {
                        unitNeighbors.push(neighbor);
                    }
                }
            }
        }
    }
    return unitNeighbors;   
}

function moveAwayFromEachOther(moveAmount: number, desiredPos: Vector3, otherDesiredPos: Vector3) {
    toTarget.subVectors(desiredPos, otherDesiredPos).setY(0);
    const length = toTarget.length();
    if (length > 0) {
        toTarget
            .divideScalar(length)
            .multiplyScalar(moveAmount / 2)

    } else {
        toTarget.set(MathUtils.randFloat(-1, 1), 0, MathUtils.randFloat(-1, 1))
            .normalize()
            .multiplyScalar(moveAmount / 2);
    }
    desiredPos.add(toTarget);
    otherDesiredPos.sub(toTarget);
};

export class UnitMotion {

    public static moveUnit(unit: IUnit, destMapCoords: Vector2, bindSkeleton = true) {

        const destCell = GameUtils.getCell(destMapCoords)!;
        const sectors = getSectors(unit.coords.mapCoords, unit.coords.sectorCoords, destMapCoords, destCell);
        if (!sectors) {
            console.warn(`no sectors found for npcMove from ${unit.coords.mapCoords} to ${destMapCoords}`);
            return;
        }
        const flowfields = flowField.compute(destMapCoords, sectors, cell => getFlowfieldCost(destCell, cell), true)!;

        console.assert(flowfields);
        const motionId = flowField.register(flowfields);
        moveTo(unit, motionId, destMapCoords, bindSkeleton);
        flowField.setMotionUnitCount(motionId, 1);
    }

    public static moveGroup(units: IUnit[], destMapCoords: Vector2, destCell: ICell, favorRoads = false) {
        const sectors = getSectors(units[0].coords.mapCoords, units[0].coords.sectorCoords, destMapCoords, destCell);
        if (!sectors) {
            console.warn(`no sectors found for move from ${units[0].coords.mapCoords} to ${destMapCoords}`);
            return;
        }

        const validMove = (() => {
            if (destCell.resource) {
                return true;
            }
            if (destCell.building) {                
                return true;
            }            
            return destCell.isWalkable;
        })();

        if (!validMove) {
            return;
        }

        
        const _getFlowfieldCost = favorRoads ? getVehicleFlowfieldCost : getFlowfieldCost;
        const flowfields = flowField.compute(destMapCoords, sectors, cell => _getFlowfieldCost(destCell, cell), !favorRoads)!;
        console.assert(flowfields);
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
            unit.onMoveCommand();
            ++unitCount;
        }

        if (motionId !== null) {
            console.assert(unitCount > 0);
            flowField.setMotionUnitCount(motionId, unitCount);
        }

        for (const sector of GameMapState.instance.sectors.values()) {
            sector.flowfieldViewer.visible = false;
        }
        if (GameMapProps.instance.debugPathfinding) {            
            for (const sectorCoords of sectors) {
                const sector = GameUtils.getSector(sectorCoords)!;
                sector.flowfieldViewer.update(flowfields, sector, sectorCoords);
                sector.flowfieldViewer.visible = true;
            }    
        }
    }

    public static updateRotation(unit: IUnit, fromPos: Vector3, toPos: Vector3) {
        deltaPos.subVectors(toPos, fromPos);
        const deltaPosLen = deltaPos.length();
        if (deltaPosLen > 0.01) {
            deltaPos.divideScalar(deltaPosLen);
            unit.lookAt.setFromRotationMatrix(matrix.lookAt(GameUtils.vec3.zero, deltaPos.negate(), GameUtils.vec3.up));
            const rotationDamp = 0.1;
            mathUtils.smoothDampQuat(unit.visual.quaternion, unit.lookAt, rotationDamp, time.deltaTime);
            // unit.mesh.quaternion.copy(unit.rotation);
        }
    }    

    public static endMotion(unit: IUnit) {
        endMotion(unit);
    }

    public static update(unit: IUnit, steerAmount: number, avoidanceSteerAmount: number) {
        const desiredPos = steer(unit, steerAmount * unit.speedFactor);
        const neighbors = getUnitNeighbors(unit, 1);
        for (const neighbor of neighbors) {

            const otherDesiredPos = steer(neighbor, steerAmount * neighbor.speedFactor);
            if (!(unit.collidable && neighbor.collidable)) {
                continue;
            }

            const dist = otherDesiredPos.distanceTo(desiredPos);
            const separation = Math.max(separations[unit.type], separations[neighbor.type]);
            if (dist < separation) {
                unit.isColliding = true;
                neighbor.isColliding = true;                
                const moveAmount = Math.min((separation - dist), avoidanceSteerAmount);
                if (neighbor.motionId > 0) {
                    if (unit.motionId > 0) {
                        moveAwayFromEachOther(moveAmount, desiredPos, otherDesiredPos);

                    } else {
                        toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                        desiredPos.add(toTarget);
                    }
                } else {
                    if (unit.motionId > 0) {
                        toTarget.subVectors(otherDesiredPos, desiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                        otherDesiredPos.add(toTarget);                        
                        unit.onCollidedWithMotionNeighbor(neighbor);

                    } else {
                        moveAwayFromEachOther(moveAmount + repulsion, desiredPos, otherDesiredPos);
                    }
                }
            }
        }

        unit.desiredPosValid = false;
        const isMoving = unit.motionId > 0;
        const needsMotion = isMoving || unit.isColliding;

        if (needsMotion) {
            GameUtils.worldToMap(unit.desiredPos, nextMapCoords);
            const newCell = GameUtils.getCell(nextMapCoords, avoidedCellSector, avoidedCellLocalCoords);
            const walkableCell = newCell?.isWalkable;
            let useDamping = false;
            let avoidedCell: ICell | null | undefined = undefined;

            if (!walkableCell) {
                avoidedCell = newCell;
                avoidedCellCoords.copy(nextMapCoords);

                // move away from blocked cell
                awayDirection.subVectors(unit.coords.mapCoords, nextMapCoords).normalize();
                unit.desiredPos.copy(unit.visual.position);
                unit.desiredPos.x += awayDirection.x * steerAmount * .5;
                unit.desiredPos.z += awayDirection.y * steerAmount * .5;
                unit.velocity.multiplyScalar(.5); // slow down a bit
                useDamping = true;
            }

            if (unit.isColliding) {
                if (!isMoving) {
                    unit.onColliding();
                    useDamping = true;
                }                
                unit.isColliding = false;
            }            

            if (useDamping) {
                nextPos.copy(unit.visual.position);
                mathUtils.smoothDampVec3(nextPos, unit.desiredPos, positionDamp * 2, time.deltaTime);
            } else {
                nextPos.copy(unit.desiredPos);
            }            

            GameUtils.worldToMap(nextPos, nextMapCoords);
            if (nextMapCoords.equals(unit.coords.mapCoords)) {
                UnitMotion.updateRotation(unit, unit.visual.position, nextPos);
                unit.visual.position.copy(nextPos);
                UnitUtils.applyElevation(unit.coords, unit.visual.position);

            } else {

                // moved to a new cell
                const nextCell = GameUtils.getCell(nextMapCoords);
                const validCell = nextCell?.isWalkable;
                if (validCell) {
                    UnitMotion.updateRotation(unit, unit.visual.position, nextPos);
                    unit.visual.position.copy(nextPos);

                    const dx = nextMapCoords.x - unit.coords.mapCoords.x;
                    const dy = nextMapCoords.y - unit.coords.mapCoords.y;
                    if (!UnitUtils.isEnemy(unit)) {
                        cmdFogMoveCircle.post({ mapCoords: unit.coords.mapCoords, radius: 10, dx, dy });
                    }

                    const currentCell = unit.coords.sector!.cells[unit.coords.cellIndex];
                    const unitIndex = currentCell.units!.indexOf(unit);
                    console.assert(unitIndex >= 0);
                    utils.fastDelete(currentCell.units!, unitIndex);
                    if (nextCell.units) {
                        console.assert(!nextCell.units.includes(unit));
                        nextCell.units.push(unit);
                    } else {
                        nextCell.units = [unit];
                    }

                    // update unit coords
                    const { localCoords } = unit.coords;
                    localCoords.x += dx;
                    localCoords.y += dy;
                    if (localCoords.x < 0 || localCoords.x >= mapRes || localCoords.y < 0 || localCoords.y >= mapRes) {
                        // entered a new sector
                        computeUnitAddr(nextMapCoords, unit.coords);
                    } else {
                        unit.coords.mapCoords.copy(nextMapCoords);
                        unit.coords.cellIndex = localCoords.y * mapRes + localCoords.x;
                    }

                    UnitUtils.applyElevation(unit.coords, unit.visual.position);

                    if (isMoving) {
                        const reachedTarget = unit.targetCell.mapCoords.equals(nextMapCoords);
                        if (reachedTarget) {
                            const npcState = unit.fsm.getState(NPCState);
                            if (npcState) {
                                npcState.onReachedTarget(unit as ICharacterUnit);
                            } else {
                                const miningState = unit.fsm.getState(MiningState);
                                if (miningState) {
                                    miningState.stopMining(unit as ICharacterUnit);
                                } else {
                                    unit.arriving = true;
                                    unit.onArriving();
                                }
                            }
                        }
                    }
                }
            }

            if (unit.arriving) {
                if (unit.velocity.length() < 0.01) {
                    UnitMotion.endMotion(unit);
                    unit.onArrived();
                }
            }

            if (avoidedCell !== undefined && isMoving) {
                if (avoidedCell?.building) {
                    const instanceId = avoidedCell.building.instanceId;
                    const targetCell = getCellFromAddr(unit.targetCell);
                    if (instanceId === targetCell.building?.instanceId) {
                        UnitMotion.endMotion(unit);
                        unit.onReachedBuilding(targetCell);                
                    }
                } else if (avoidedCell?.resource) {
                    const targetCell = getCellFromAddr(unit.targetCell);
                    if (avoidedCell.resource.type === targetCell.resource?.type) {
                        UnitMotion.endMotion(unit);
                        unit.onArrived();
    
                        switch (unit.type) {
                            case "worker": {
                                const miningState = unit.fsm.getState(MiningState) ?? unit.fsm.switchState(MiningState);
                                miningState.onReachedResource(unit as ICharacterUnit, avoidedCell, avoidedCellCoords);
                            }                            
                        }
                    }
                }
            }
        }
    }
}

