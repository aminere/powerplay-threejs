import { Box3Helper, LineBasicMaterial, MathUtils, Object3D, Vector2, Vector3 } from "three";
import { ICell } from "../GameTypes";
import { flowField } from "../pathfinding/Flowfield";
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
import { ICharacterUnit } from "./ICharacterUnit";
import { unitConfig } from "../config/UnitConfig";
import { FlowfieldUtils } from "../pathfinding/FlowfieldUtils";
import { AttackUnit } from "./states/AttackUnit";
import { TankAttackUnit } from "./states/TankAttackUnit";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { engineState } from "../../engine/EngineState";

const destSectorCoords = new Vector2();

const cellCoords = new Vector2();
const awayDirection = new Vector2();
const awayDirection3 = new Vector3();
const lookDirection = new Vector3();
const nextMapCoords = new Vector2();
const nextPos = new Vector3();

const { mapRes } = config.game;
const { maxForce, separations } = config.steering;

function getBox3Helper(visual: Object3D) {
    return visual.getObjectByProperty("type", "Box3Helper") as Box3Helper;
}

// const velocity1 = new Vector3();
// const velocity2 = new Vector3();
// function movingInSameDirection(unit: IUnit, neighbor: IUnit) {
//     velocity1.copy(unit.velocity).normalize();
//     velocity2.copy(neighbor.velocity).normalize();
//     return velocity1.dot(velocity2) >= 0;
// }

function vectorsHaveSameDirection(v1: Vector3, v2: Vector3) {
    return v1.dot(v2) >= .8;
}

function moveTo(unit: IUnit, motionCommandId: number, motionId: number, mapCoords: Vector2, bindSkeleton = true) {
    if (unit.motionId > 0) {
        flowField.removeMotion(unit);
    }
    unit.motionId = motionId;
    unit.motionCommandId = motionCommandId;
    unit.arriving = false;
    unit.motionTime = 0;
    computeUnitAddr(mapCoords, unit.targetCell);

    // if (UnitUtils.isVehicle(unit)) {
    //     const vehicle = unit as IVehicleUnit;
    //     computeUnitAddr2x2(mapCoords, vehicle.targetCell2x2);
    // }

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

        const { path } = GameMapState.instance.debug;
        if (GameMapProps.instance.debugPathfinding) {
            path.setPath(cellPath);
            path.visible = true;
        } else {
            path.visible = false;
        }

        return out;

    } else {

        // cell pathfinder failed, use coarse sector pathfinder
        GameUtils.getCell(destMapCoords, destSectorCoords)
        return sectorPathfinder.findPath(srcSectorCoords, destSectorCoords);
    }
}

function endMotion(unit: IUnit) {
    flowField.removeMotion(unit);
    unit.motionId = 0;
    unit.motionCommandId = 0;
    unit.arriving = false;
    unit.velocity.set(0, 0, 0);
    unit.acceleration.set(0, 0, 0);
}

// function isDirectionValid(flowfields: TFlowFieldMap, unit: IUnit) {
//     const { mapCoords, sectorCoords, cellIndex } = unit.coords;
//     const _flowField = flowfields.get(`${sectorCoords.x},${sectorCoords.y}`)!;
//     const flowfieldInfo = _flowField[cellIndex];
//     if (flowfieldInfo.direction) {
//         return true;
//     } else {
//         const computed = flowField.computeDirection(flowfields, mapCoords, cellDirection);
//         if (computed) {
//             flowfieldInfo.direction = cellDirection.clone();
//             return true;
//         } else {
//             return false;
//         }
//     }
// }

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

const neighbors = new Set<IUnit>();
function getNeighbors(mapCoords: Vector2, radius: number, out: Set<IUnit>) {
    for (let y = mapCoords.y - radius; y <= mapCoords.y + radius; y++) {
        for (let x = mapCoords.x - radius; x <= mapCoords.x + radius; x++) {
            cellCoords.set(x, y);
            const units = GameUtils.getCell(cellCoords)?.units;
            if (units) {
                for (const neighbor of units) {
                    if (!neighbor.isIdle) {
                        continue;
                    }
                    if (UnitUtils.isVehicle(neighbor) && neighbor.motionCommandId === 0) {
                        continue;
                    }
                    out.add(neighbor);
                }
            }
        }
    }
}

// const cellUnits2x2 = new Array<IUnit>();
// function getCellUnits2x2(mapCoords2x2: Vector2, radius: number) {
//     cellUnits2x2.length = 0;
//     const { sectors } = GameMapState.instance;
//     for (let y = mapCoords2x2.y - radius; y <= mapCoords2x2.y + radius; y++) {
//         for (let x = mapCoords2x2.x - radius; x <= mapCoords2x2.x + radius; x++) {
//             const sectorX = Math.floor(x / vehicleMapRes);
//             const sectorY = Math.floor(y / vehicleMapRes);
//             const sector = sectors.get(`${sectorX},${sectorY}`);
//             if (sector) {
//                 const sectorStartX = sectorX * vehicleMapRes;
//                 const sectorStartY = sectorY * vehicleMapRes;
//                 const localX = x - sectorStartX;
//                 const localY = y - sectorStartY;
//                 const cellIndex = localY * vehicleMapRes + localX;
//                 const cell = sector.cells2x2[cellIndex];
//                 for (const neighbor of cell.units) {
//                     cellUnits2x2.push(neighbor);
//                 }
//             }
//         }
//     }
//     return cellUnits2x2;
// }

// function tryMoveVehicle(vehicle: IVehicleUnit, nextMapCoords: Vector2) {
//     const x = Math.floor(nextMapCoords.x / cellsPerVehicleCell);
//     const y = Math.floor(nextMapCoords.y / cellsPerVehicleCell);
//     const coords2x2 = vehicle.coords2x2;
//     if (coords2x2.mapCoords.x === x && coords2x2.mapCoords.y === y) {
//         return;
//     }
//     const currentCell = coords2x2.sector!.cells2x2[coords2x2.cellIndex];
//     const unitIndex = currentCell.units!.indexOf(vehicle);
//     console.assert(unitIndex >= 0);
//     utils.fastDelete(currentCell.units!, unitIndex);
//     computeUnitAddr2x2(nextMapCoords, coords2x2);
//     const nextCell = coords2x2.sector.cells2x2[coords2x2.cellIndex];
//     nextCell.units.push(vehicle);
// }

function moveAwayFrom(unit: IUnit, neighbor: IUnit, currentAccel: number, repulsion: number) {
    awayDirection3.subVectors(unit.visual.position, neighbor.visual.position).setY(0);
    const distToNeighbor = awayDirection3.length();
    if (distToNeighbor > 0) {
        awayDirection3.divideScalar(distToNeighbor)
    } else {
        awayDirection3.set(MathUtils.randFloat(-1, 1), 0, MathUtils.randFloat(-1, 1)).normalize();
    }

    // more repulsion if units are closer
    const separation = separations[unit.type] + separations[neighbor.type];
    const distance = Math.min(distToNeighbor, separation);
    const repulsionFactor = Math.max(1 - distance / separation, .1);

    unit.acceleration
        .multiplyScalar(currentAccel)
        .addScaledVector(awayDirection3, maxForce * repulsionFactor * repulsion)
        .clampLength(0, maxForce);
}

function avoidMovingNeighbor(unit: IUnit, neighbor: IUnit, factor: number) {
    // move away in a direction perpendicular to the neighbor's velocity
    awayDirection3.copy(neighbor.velocity).setY(0).normalize();
    awayDirection3.cross(GameUtils.vec3.up);
    const perpendicularToMotion = lookDirection.subVectors(unit.visual.position, neighbor.visual.position).setY(0)
        .projectOnVector(awayDirection3)
        .normalize();
    unit.acceleration.addScaledVector(perpendicularToMotion, maxForce * factor);
}

function slideAlongNeighbor(unit: IUnit, neighbor: IUnit) {
    awayDirection3.subVectors(unit.visual.position, neighbor.visual.position).setY(0).normalize();
    awayDirection3.cross(GameUtils.vec3.up);
    unit.acceleration
        .multiplyScalar(.1)
        .addScaledVector(awayDirection3, maxForce)
        .clampLength(0, maxForce);
}

function isMovingTowards(unit: IUnit, neighbor: IUnit) {
    const toNeighbor = awayDirection3.subVectors(neighbor.visual.position, unit.visual.position).setY(0).normalize();
    return vectorsHaveSameDirection(toNeighbor, unit.velocity);
}

function collisionResponse(unit: IUnit, neighbor: IUnit) {    

    if (unit.motionId > 0) {

        if (unit.motionTime < 1) {
            // fresh motion, simple separation
            moveAwayFrom(unit, neighbor, 1, .5);
            return;
        }

        if (neighbor.motionId === 0) {
            if (neighbor.isIdle) {
                // no need to do anything, the stationary neighbor will move itself
            } else {
                slideAlongNeighbor(unit, neighbor);
            }
            return;
        }

        if (isMovingTowards(unit, neighbor)) {
            if (isMovingTowards(neighbor, unit)) {
                // slow down and move away from the collision
                moveAwayFrom(unit, neighbor, .5, 1);
            } else {
                // neighbor is moving away from me
                (getBox3Helper(unit.visual).material as LineBasicMaterial).color.set(0xff0000);
                moveAwayFrom(unit, neighbor, 1, 1);
            }            
        } else {
            (getBox3Helper(unit.visual).material as LineBasicMaterial).color.set(0x0000ff);
            // already moving away from the collision
            moveAwayFrom(unit, neighbor, 1, 1);
        }
        return;    
    }

    // unit is not moving
    if (unit.isIdle) {
        if (neighbor.motionId === 0) {
            moveAwayFrom(unit, neighbor, 1, 1);
        } else {
            avoidMovingNeighbor(unit, neighbor, .2);
        }
        
        if (!UnitUtils.isVehicle(unit)) {
            const collisionAnim = utils.getComponent(UnitCollisionAnim, unit.visual);
            if (collisionAnim) {
                collisionAnim.reset();
            } else {
                const character = unit as ICharacterUnit;
                engineState.setComponent(unit.visual, new UnitCollisionAnim({ unit: character }));
            }
        }

    } else {
        // keep being busy, but slightly move away from the collision
        (getBox3Helper(unit.visual).material as LineBasicMaterial).color.set(0x00ff00);
        moveAwayFrom(unit, neighbor, 1, 1);
    }
}

const unitsToMove = new Array<IUnit>();
export class UnitMotion {

    private _motionCommandId = 1;
    private _collisionResults = new Map<string, boolean>();

    public createMotionCommandId() {
        const commandId = this._motionCommandId;
        this._motionCommandId++;
        return commandId;
    }

    public resetCollisionResults(units: IUnit[]) {
        this._collisionResults.clear();
        if (GameMapProps.instance.debugCollisions) {
            for (const unit of units) {
                const box = getBox3Helper(unit.visual);
                box.visible = false;
                (box.material as LineBasicMaterial).color.set(0xffff00);
            }
        }
    }

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
        flowField.getMotion(motionId).units.push(unit);

        const commandId = this.createMotionCommandId();
        moveTo(unit, commandId, motionId, destMapCoords, bindSkeleton);
    }

    public moveGroup(motionCommandId: number, units: IUnit[], destMapCoords: Vector2, destCell: ICell, favorRoads: boolean, targetUnit?: IUnit) {
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

        unitsToMove.length = 0;
        for (const unit of units) {
            if (!unit.isAlive) {
                continue;
            }
            if (unit.coords.mapCoords.equals(destMapCoords)) {
                continue;
            }
                   
            if (targetUnit) {                
                const target = unit.fsm.getState(AttackUnit)?.target ?? unit.fsm.getState(TankAttackUnit)?.target;
                if (targetUnit === target) {
                    // unit is attacking the target, don't interrupt
                    continue;
                }
            }

            unit.motionCommandId = motionCommandId;
            unitsToMove.push(unit);            
        }

        if (unitsToMove.length === 0) {
            return;
        }

        const _getFlowfieldCost = favorRoads ? getVehicleFlowfieldCost : getFlowfieldCost;
        const flowfields = flowField.compute(destMapCoords, sectors, cell => _getFlowfieldCost(destCell, cell), !favorRoads)!;
        console.assert(flowfields);
        const motionId = flowField.register(flowfields, targetUnit);
        const movingUnits = flowField.getMotion(motionId).units;
        for (const unit of unitsToMove) {            
            // if (!isDirectionValid(flowfields, unit)) {
            //     continue;
            // }
            unit.clearAction();
            moveTo(unit, motionCommandId, motionId, destMapCoords);
            movingUnits!.push(unit);
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
                const direction = (() => {
                    return FlowfieldUtils.getDirection(unit, awayDirection);
                    // if (UnitUtils.isVehicle(unit)) {
                    //     return FlowfieldUtils.getDirectionBilinear(unit, awayDirection);
                    // } else {
                    //     return FlowfieldUtils.getDirection(unit, awayDirection);
                    // }
                })();                               
                unit.acceleration.x += direction.x * maxForce;
                unit.acceleration.z += direction.y * maxForce;
                unit.acceleration.clampLength(0, maxForce);
            }
            unit.motionTime += time.deltaTime;
        }

        const checkCollisions = (() => {
            if (!unit.isIdle) {
                return false;
            }
            if (UnitUtils.isVehicle(unit) && unit.motionId === 0) {
                return false;
            }
            return unit.collidable;
        })();

        if (checkCollisions) {
            neighbors.clear();
            const radius = (() => {
                if (UnitUtils.isVehicle(unit)) {
                    return 2;
                }
                return 1;
            })();
            getNeighbors(unit.coords.mapCoords, radius, neighbors);
            for (const neighbor of neighbors) {
                if (!neighbor.collidable) {
                    continue;
                }
                if (neighbor === unit) {
                    continue;
                }

                const collisionTestId = `${unit.visual.id},${neighbor.visual.id}`;
                const collides = (() => {
                    const cachedResult = this._collisionResults.get(collisionTestId);
                    if (cachedResult === undefined) {
                        const newResult = UnitUtils.collides(unit, neighbor);
                        this._collisionResults.set(collisionTestId, newResult);
                        const collisionTestId2 = `${neighbor.visual.id},${unit.visual.id}`;
                        this._collisionResults.set(collisionTestId2, newResult);
                        if (newResult) {
                            unit.collidingWith.push(neighbor);
                            neighbor.collidingWith.push(unit);
                            if (GameMapProps.instance.debugCollisions) {
                                getBox3Helper(unit.visual).visible = true;
                                getBox3Helper(neighbor.visual).visible = true;
                            }
                        }
                        return newResult;
                    } else {
                        return cachedResult;
                    }
                })();

                if (collides) {
                    const canAffectEachOther = (() => {
                        // const isEnemy1 = UnitUtils.isEnemy(unit);
                        // const isEnemy2 = UnitUtils.isEnemy(neighbor);
                        // if (isEnemy1 !== isEnemy2) {
                        //     // enemies can't push each other
                        //     return false;
                        // }
                        return true;
                    })();

                    if (canAffectEachOther) {
                        collisionResponse(unit, neighbor);
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
        const needsMotion = isMoving || unit.collidingWith.length > 0;
        if (!needsMotion) {
            return;
        }

        const maxSpeed = UnitUtils.getMaxSpeed(unit);
        unit.velocity.addScaledVector(unit.acceleration, time.deltaTime).clampLength(0, maxSpeed);
        nextPos.copy(unit.visual.position).addScaledVector(unit.velocity, time.deltaTime);

        GameUtils.worldToMap(nextPos, nextMapCoords);
        const nextCell = GameUtils.getCell(nextMapCoords);

        if (nextCell?.isWalkable) {            

            unit.visual.position.copy(nextPos);

            if (!nextMapCoords.equals(unit.coords.mapCoords)) {

                const dx = nextMapCoords.x - unit.coords.mapCoords.x;
                const dy = nextMapCoords.y - unit.coords.mapCoords.y;
                if (!UnitUtils.isEnemy(unit)) {
                    const { range } = unitConfig[unit.type];
                    cmdFogMoveCircle.post({ mapCoords: unit.coords.mapCoords, radius: range.vision, dx, dy });
                }

                const currentCell = unit.coords.sector!.cells[unit.coords.cellIndex];
                const unitIndex = currentCell.units!.indexOf(unit);
                console.assert(unitIndex >= 0);
                utils.fastDelete(currentCell.units!, unitIndex);
                if (UnitUtils.isVehicle(unit)) {
                    for (let [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
                        cellCoords.set(unit.coords.mapCoords.x + dx, unit.coords.mapCoords.y + dy);
                        const cell = GameUtils.getCell(cellCoords);
                        if (cell) {
                            const unitIndex = cell.units!.indexOf(unit);
                            console.assert(unitIndex >= 0);
                            utils.fastDelete(cell.units!, unitIndex);
                        }
                    }
                }

                if (nextCell.units) {
                    console.assert(!nextCell.units.includes(unit));
                    nextCell.units.push(unit);
                } else {
                    nextCell.units = [unit];
                }
                if (UnitUtils.isVehicle(unit)) {
                    for (let [dx, dy] of [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]) {
                        cellCoords.set(nextMapCoords.x + dx, nextMapCoords.y + dy);
                        const cell = GameUtils.getCell(cellCoords);
                        if (cell) {
                            if (cell.units) {
                                cell.units.push(unit);
                            } else {
                                cell.units = [unit];
                            }
                        }
                    }
                }

                // update unit coords
                const { localCoords } = unit.coords;
                localCoords.x += dx;
                localCoords.y += dy;
                if (localCoords.x < 0 || localCoords.x >= mapRes || localCoords.y < 0 || localCoords.y >= mapRes) {
                    // entered a new sector
                    computeUnitAddr(nextMapCoords, unit.coords);
                    // if (UnitUtils.isVehicle(unit)) {
                    //     tryMoveVehicle(unit as IVehicleUnit, nextMapCoords);
                    // }

                } else {
                    unit.coords.mapCoords.copy(nextMapCoords);
                    unit.coords.cellIndex = localCoords.y * mapRes + localCoords.x;
                    // if (UnitUtils.isVehicle(unit)) {
                    //     tryMoveVehicle(unit as IVehicleUnit, nextMapCoords);
                    // }
                }

                if (isMoving && !unit.arriving) {
                    const reachedTarget = (() => {
                        return unit.targetCell.mapCoords.equals(nextMapCoords);
                        // if (UnitUtils.isVehicle(unit)) {
                        //     const vehicle = unit as IVehicleUnit;
                        //     if (vehicle.targetCell2x2.mapCoords.equals(vehicle.coords2x2.mapCoords)) {
                        //         return true;
                        //     }
                        //     const targetCell2x2 = getCell2x2FromAddr(vehicle.targetCell2x2);
                        //     const cell2x2 = getCell2x2FromAddr(vehicle.coords2x2);
                        //     if (cell2x2.building && targetCell2x2.building === cell2x2.building) {
                        //         return true;
                        //     }
                        //     return false;
                        // } else {
                        //     return unit.targetCell.mapCoords.equals(nextMapCoords);
                        // }
                    })();
                    if (reachedTarget) {
                        (() => {
                            const attack = unit.fsm.getState(AttackUnit);
                            if (attack) {
                                attack.onReachedTarget(unit as ICharacterUnit);
                                return;
                            }

                            unit.arriving = true;
                        })();
                    }
                }

                // enemy has moved to a new cell, if it was being followed, update the concerned motion
                if (UnitUtils.isEnemy(unit)) {
                    const motions = Array.from(flowField.motions.values());
                    for (const motion of motions) {
                        if (motion.targetUnit === unit) {
                            const targetCell = getCellFromAddr(unit.coords);
                            this.moveCommand(motion.units, unit.coords.mapCoords, targetCell, unit);
                        }
                    }
                }
            }
            
            const rotationHalfDuration = (() => {
                if (UnitUtils.isVehicle(unit)) {
                    if (unit.collidingWith.length > 0) {
                        return .1;
                    }
                }
                return .1;
            })();

            UnitUtils.applyElevation(unit);
            UnitUtils.updateRotation(unit, unit.velocity, rotationHalfDuration);

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

        if (unit.collidingWith.length > 0) {
            unit.onColliding();
            unit.collidingWith.length = 0;
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

    public moveCommand(units: IUnit[], _mapCoords: Vector2, targetCell: ICell, targetUnit?: IUnit) {

        // group units per sector
        const groupsPerSector = units.reduce((prev, cur) => {
            if (UnitUtils.isEnemy(cur)) {
                return prev;
            }

            const key = `${cur.coords.sectorCoords.x},${cur.coords.sectorCoords.y}`;
            const units = prev[key];
            const isVehicle = UnitUtils.isVehicle(cur);
            if (!units) {
                prev[key] = isVehicle ? { character: [], vehicle: [cur] } : { character: [cur], vehicle: [] };
            } else {
                units[isVehicle ? "vehicle" : "character"].push(cur);
            }
            return prev;
        }, {} as Record<string, Record<"character" | "vehicle", IUnit[]>>);

        const commandId = unitMotion.createMotionCommandId();
        const groups = Object.values(groupsPerSector);

        for (const group of groups) {
            if (group.character.length > 0) {
                unitMotion.moveGroup(commandId, group.character, _mapCoords, targetCell, false, targetUnit);
            }
            if (group.vehicle.length > 0) {
                unitMotion.moveGroup(commandId, group.vehicle, _mapCoords, targetCell, true, targetUnit);
            }
        }
    }
}

export const unitMotion = new UnitMotion();

