import { MathUtils, Vector2, Vector3 } from "three";
import { ICell } from "../GameTypes";
import { TFlowField, TFlowFieldMap, flowField } from "../pathfinding/Flowfield";
import { GameUtils } from "../GameUtils";
import { computeUnitAddr, getCellFromAddr } from "./UnitAddr";
import { time } from "../../engine/core/Time";
import { GameMapState } from "../components/GameMapState";
import { cellPathfinder } from "../pathfinding/CellPathfinder";
import { GameMapProps } from "../components/GameMapProps";
import { sectorPathfinder } from "../pathfinding/SectorPathfinder";
import { config } from "../config/config";
import { utils } from "../../engine/Utils";
import { cmdFogMoveCircle } from "../../Events";
import { IUnit } from "./IUnit";
import { UnitUtils } from "./UnitUtils";
import { NPCState } from "./states/NPCState";
import { ICharacterUnit } from "./ICharacterUnit";

const cellDirection = new Vector2();
const destSectorCoords = new Vector2();

const cellCoords = new Vector2();
const awayDirection = new Vector2();
const awayDirection3 = new Vector3();
const lookDirection = new Vector3();
const nextMapCoords = new Vector2();
const nextPos = new Vector3();

const { mapRes } = config.game;
const { maxSpeed, maxForce } = config.steering;

function moveTo(unit: IUnit, motionCommandId: number, motionId: number, mapCoords: Vector2, bindSkeleton = true) {
    if (unit.motionId > 0) {
        flowField.removeMotion(unit.motionId);
    }
    unit.motionId = motionId;
    unit.motionCommandId = motionCommandId;
    unit.arriving = false;
    computeUnitAddr(mapCoords, unit.targetCell);
    unit.onMove(bindSkeleton);
}

const nextSector = new Vector2();
function getSectors(mapCoords: Vector2, srcSectorCoords: Vector2, destMapCoords: Vector2, destCell: ICell) {

    const destBuildingId = destCell.building;
    const cellPath = cellPathfinder.findPath(mapCoords, destMapCoords, {
        diagonals: () => false,
        isWalkable: (destBuildingId || destCell.resource) ? (cell: ICell) => {
            if (cell.building) {
                // allow to walk to any cell in the destination building, the unit will stop when hitting the building
                return cell.building === destBuildingId;
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
    unit.motionCommandId = 0;
    unit.arriving = false;
    unit.velocity.set(0, 0, 0);
    unit.acceleration.set(0, 0, 0);
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

function applyFlowfieldForce(unit: IUnit, maxForce: number) {
    const { motionId, coords } = unit;

    function applyForce(unit: IUnit, _flowfield: TFlowField, maxForce: number) {
        const { directionIndex } = _flowfield;
        if (directionIndex < 0) {
            const mapCoords = unit.coords.mapCoords;
            const flowfields = flowField.getMotion(motionId).flowfields;
            const computed = flowField.computeDirection(flowfields, mapCoords, cellDirection);
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
        
        unit.acceleration.x += cellDirection.x * maxForce;
        unit.acceleration.z += cellDirection.y * maxForce;
        unit.acceleration.clampLength(0, maxForce);
    }

    const flowfields = flowField.getMotion(motionId).flowfields;
    const _flowField = flowfields.get(`${coords.sectorCoords.x},${coords.sectorCoords.y}`);
    if (_flowField) {
        const currentCellIndex = coords.cellIndex;
        if (!unit.lastKnownFlowfield) {
            unit.lastKnownFlowfield = {
                cellIndex: currentCellIndex,
                sectorCoords: coords.sectorCoords.clone()
            };
        } else {
            unit.lastKnownFlowfield.cellIndex = currentCellIndex;
            unit.lastKnownFlowfield.sectorCoords.copy(coords.sectorCoords);
        }

        const flowfieldInfo = _flowField[currentCellIndex];
        return applyForce(unit, flowfieldInfo, maxForce);

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
            unit.lastKnownFlowfield.cellIndex = coords.cellIndex;
            unit.lastKnownFlowfield.sectorCoords.copy(coords.sectorCoords);

            if (GameMapProps.instance.debugPathfinding) {
                coords.sector!.flowfieldViewer.update(flowfields, coords.sector!, coords.sectorCoords);
                coords.sector!.flowfieldViewer.visible = true;
            }

            const flowfieldInfo = newFlowfield[coords.cellIndex];
            return applyForce(unit, flowfieldInfo, maxForce);

        } else {
            console.assert(false);
            unit.velocity.set(0, 0, 0);
            unit.acceleration.set(0, 0, 0);
        }
    }
}

function getFlowfieldCost(destCell: ICell, currentCell: ICell) {
    if (destCell.resource) {
        if (destCell.resource.type === currentCell.resource?.type) {
            return 1;
        }
    } else if (destCell.building) {
        if (destCell.building === currentCell.building) {
            return 1;
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

export class UnitMotion {

    public createMotionCommandId() {
        const commandId = this._motionCommandId;
        this._motionCommandId++;
        return commandId;
    }

    private _motionCommandId = 1;    

    public moveUnit(unit: IUnit, destMapCoords: Vector2, bindSkeleton = true) {
        const destCell = GameUtils.getCell(destMapCoords)!;
        const sectors = getSectors(unit.coords.mapCoords, unit.coords.sectorCoords, destMapCoords, destCell);
        if (!sectors) {
            console.warn(`no sectors found for npcMove from ${unit.coords.mapCoords} to ${destMapCoords}`);
            return;
        }
        const flowfields = flowField.compute(destMapCoords, sectors, cell => getFlowfieldCost(destCell, cell), true)!;
        console.assert(flowfields);
        const motionId = flowField.register(flowfields);
        const commandId = this.createMotionCommandId();
        moveTo(unit, commandId, motionId, destMapCoords, bindSkeleton);
        flowField.setMotionUnitCount(motionId, 1);
    }

    // public moveUnitWithCommandId(unit: IUnit, commandId: number, destMapCoords: Vector2) {
    //     const destCell = GameUtils.getCell(destMapCoords)!;
    //     const sectors = getSectors(unit.coords.mapCoords, unit.coords.sectorCoords, destMapCoords, destCell);
    //     if (!sectors) {
    //         console.warn(`no sectors found for npcMove from ${unit.coords.mapCoords} to ${destMapCoords}`);
    //         return;
    //     }
    //     const favorRoads = UnitUtils.isVehicle(unit);
    //     const _getFlowfieldCost = favorRoads ? getVehicleFlowfieldCost : getFlowfieldCost;
    //     const flowfields = flowField.compute(destMapCoords, sectors, cell => _getFlowfieldCost(destCell, cell), !favorRoads)!;
    //     console.assert(flowfields);
    //     const motionId = flowField.register(flowfields);
    //     moveTo(unit, commandId, motionId, destMapCoords);
    //     flowField.setMotionUnitCount(motionId, 1);
    // }

    public moveGroup(motionCommandId: number, units: IUnit[], destMapCoords: Vector2, destCell: ICell, favorRoads = false) {
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
    
            unit.clearAction();
            moveTo(unit, motionCommandId, motionId, destMapCoords);            
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

    public endMotion(unit: IUnit) {
        endMotion(unit);
    }

    public applyForces(unit: IUnit) {

        if (unit.motionId > 0) {
            if (!unit.arriving) {
                applyFlowfieldForce(unit, maxForce);
            }
        }        

        if (unit.collidable) {
            const neighbors = getUnitNeighbors(unit, 2);
            for (const neighbor of neighbors) {
                if (!neighbor.collidable) {
                    continue;
                }

                if (UnitUtils.collides(unit, neighbor)) {
                    unit.isColliding = true;
                    neighbor.isColliding = true;

                    awayDirection3.subVectors(unit.visual.position, neighbor.visual.position).setY(0);
                    const length = awayDirection3.length();
                    if (length > 0) {
                        awayDirection3.divideScalar(length)
                    } else {
                        awayDirection3.set(MathUtils.randFloat(-1, 1), 0, MathUtils.randFloat(-1, 1)).normalize();
                    }

                    const canBeAffectedByNeighbor = (() => {
                        if (UnitUtils.isVehicle(unit) && !UnitUtils.isVehicle(neighbor)) {
                            return false;
                        }
                        return true;
                    })();

                    if (canBeAffectedByNeighbor) {

                        const forceFactor = (() => {
                            if (unit.motionId > 0 && neighbor.motionId === 0) {
                                return .2;
                            }
                            return .8
                        })();

                        unit.acceleration
                            .multiplyScalar(1 - forceFactor)
                            .addScaledVector(awayDirection3, maxForce * forceFactor)
                            .clampLength(0, maxForce);
                    } else {
                        unit.acceleration                            
                            .addScaledVector(awayDirection3, maxForce * .1)
                            .clampLength(0, maxForce);
                    }

                    if (unit.motionId > 0) {
                        unit.onCollidedWhileMoving(neighbor);                        
                    }
                }
            }
        }
    }

    public steer(unit: IUnit) {

        const isMoving = unit.motionId > 0;
        const needsMotion = isMoving || unit.isColliding;
        if (!needsMotion) {
            return;
        }

        const _maxSpeed = (() => {
            if (UnitUtils.isVehicle(unit)) {
                const cell = getCellFromAddr(unit.coords);
                if (cell.roadTile) {
                    return maxSpeed * 1.5;
                }
            }
            return maxSpeed;
        })();

        unit.velocity.addScaledVector(unit.acceleration, time.deltaTime).clampLength(0, _maxSpeed);
        nextPos.copy(unit.visual.position).addScaledVector(unit.velocity, time.deltaTime);

        GameUtils.worldToMap(nextPos, nextMapCoords);
        const nextCell = GameUtils.getCell(nextMapCoords);

        if (nextCell?.isWalkable) {
            UnitUtils.updateRotation(unit, unit.visual.position, nextPos);
            
            unit.visual.position.copy(nextPos);

            if (!nextMapCoords.equals(unit.coords.mapCoords)) {

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

                if (isMoving) {
                    const reachedTarget = unit.targetCell.mapCoords.equals(nextMapCoords);
                    if (reachedTarget) {
                        const npcState = unit.fsm.getState(NPCState);
                        if (npcState) {
                            npcState.onReachedTarget(unit as ICharacterUnit);
                        } else {
                            unit.arriving = true;
                            unit.onArriving();
                        }
                    }
                }
            }

            UnitUtils.applyElevation(unit.coords, unit.visual.position);

        } else {

            // nextCell is not walkable
            if (nextCell !== null) {

                let isObstacle = true;

                if (isMoving) {
                    if (nextCell.building) {
                        const targetCell = getCellFromAddr(unit.targetCell);
                        if (nextCell.building === targetCell.building) {
                            this.endMotion(unit);
                            unit.onReachedBuilding(targetCell);                            
                            isObstacle = false;
                        }
                    } else if (nextCell.resource) {
                        const targetCell = getCellFromAddr(unit.targetCell);
                        if (nextCell.resource.type === targetCell.resource?.type) {
                            this.endMotion(unit);
                            unit.onReachedResource(targetCell);
                            isObstacle = false;
                        }
                    }
                }

                if (isObstacle) {
                    // slide along the obstacle
                    awayDirection.subVectors(unit.coords.mapCoords, nextMapCoords).normalize();
                    awayDirection3.set(awayDirection.x, 0, awayDirection.y).cross(GameUtils.vec3.up);
                    lookDirection.set(0, 0, 1).applyQuaternion(unit.visual.quaternion);
                    unit.velocity.lerp(lookDirection, .5).projectOnVector(awayDirection3).normalize().multiplyScalar(maxSpeed);
                    unit.acceleration.copy(unit.velocity).clampLength(0, maxForce);
                    nextPos.copy(unit.visual.position).addScaledVector(unit.velocity, time.deltaTime);
                    GameUtils.worldToMap(nextPos, nextMapCoords);
                    const nextCell = GameUtils.getCell(nextMapCoords);
                    if (nextCell?.isWalkable) {
                        unit.visual.position.copy(nextPos);
                    }
                }
            }
        }

        if (unit.isColliding) {
            if (!isMoving) {
                unit.onColliding();
            }
            unit.isColliding = false;
        }

        if (unit.arriving) {
            UnitUtils.slowDown(unit);
            if (unit.velocity.length() < 0.1) {
                endMotion(unit);
                unit.onArrived();
            }
        } else if (!isMoving) {
            UnitUtils.slowDown(unit);
        }
    }
}

export const unitMotion = new UnitMotion();

