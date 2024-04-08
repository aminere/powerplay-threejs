import { MathUtils, Matrix4, Vector2, Vector3 } from "three";
import { FlockProps } from "../components/Flock";
import { IUnit } from "./IUnit";
import { config } from "../config";
import { unitMotion } from "./UnitMotion";
import { unitAnimation } from "./UnitAnimation";
import { GameUtils } from "../GameUtils";
import { time } from "../../engine/core/Time";
import { MiningState } from "./MiningState";
import { mathUtils } from "../MathUtils";
import { utils } from "../../engine/Utils";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { engineState } from "../../engine/EngineState";
import { cmdFogMoveCircle } from "../../Events";
import { computeUnitAddr, getCellFromAddr } from "./UnitAddr";
import { ICell } from "../GameTypes";
import { GameMapState } from "../components/GameMapState";
import { IFactoryState } from "../buildings/BuildingTypes";

const unitNeighbors = new Array<IUnit>();
const toTarget = new Vector3();
const awayDirection = new Vector2();
const avoidedCellCoords = new Vector2();
const avoidedCellSector = new Vector2();
const avoidedCellLocalCoords = new Vector2();
const nextMapCoords = new Vector2();
const nextPos = new Vector3();
const pickedItemOffset = new Matrix4().makeTranslation(-.5, 0, 0);
const pickedItemlocalToSkeleton = new Matrix4();
            
const { mapRes } = config.game;

function onUnitArrived(unit: IUnit) {
    unitMotion.onUnitArrived(unit);
    unitAnimation.setAnimation(unit, "idle");
}

const cellNeighbors = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const neighbordMapCoords = new Vector2();

function getUnitNeighbors(unit: IUnit) {
    const cell = unit.coords.sector!.cells[unit.coords.cellIndex];
    unitNeighbors.length = 0;
    if (cell.units) {
        for (const neighbor of cell.units) {
            if (!neighbor.isAlive) {
                continue;
            }
            if (neighbor !== unit) {
                unitNeighbors.push(neighbor);
            }
        }
    }

    for (const [dx, dy] of cellNeighbors) {
        neighbordMapCoords.set(unit.coords.mapCoords.x + dx, unit.coords.mapCoords.y + dy);
        const neighborCell = GameUtils.getCell(neighbordMapCoords);
        if (!neighborCell || !neighborCell.units) {
            continue;
        }
        for (const neighbor of neighborCell.units) {
            if (!neighbor.isAlive) {
                continue;
            }
            unitNeighbors.push(neighbor);
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

export function updateUnits(units: IUnit[]) {
    const props = FlockProps.instance;
    const { repulsion, positionDamp } = props;
    const separationDist = props.separation;
    const steerAmount = props.speed * time.deltaTime;
    const avoidanceSteerAmount = props.avoidanceSpeed * time.deltaTime;

    for (let i = 0; i < units.length; ++i) {
        const unit = units[i];
        if (!unit.isAlive) {
            continue;
        }

        unit.fsm.update();

        const desiredPos = unitMotion.steer(unit, steerAmount * unit.speedFactor);
        const neighbors = getUnitNeighbors(unit);
        for (const neighbor of neighbors) {

            const otherDesiredPos = unitMotion.steer(neighbor, steerAmount * neighbor.speedFactor);
            if (!(unit.collidable && neighbor.collidable)) {
                continue;
            }

            const dist = otherDesiredPos.distanceTo(desiredPos);
            if (dist < separationDist) {
                unit.isColliding = true;
                neighbor.isColliding = true;
                const moveAmount = Math.min((separationDist - dist), avoidanceSteerAmount);
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

                        // if other unit was part of my motion, stop
                        if (neighbor.lastCompletedMotionId === unit.motionId) {
                            const isMining = unit.fsm.getState(MiningState) !== null;
                            if (!isMining) {
                                onUnitArrived(unit);
                            }
                        }

                    } else {
                        moveAwayFromEachOther(moveAmount + repulsion, desiredPos, otherDesiredPos);
                    }
                }
            }
        }

        unit.desiredPosValid = false;
        const isMoving = unit.motionId > 0;
        const needsMotion = isMoving || unit.isColliding;
        let avoidedCell: ICell | null | undefined = undefined;        

        if (needsMotion) {
            GameUtils.worldToMap(unit.desiredPos, nextMapCoords);
            const newCell = GameUtils.getCell(nextMapCoords, avoidedCellSector, avoidedCellLocalCoords);
            const walkableCell = newCell?.isWalkable;
            if (!walkableCell) {
                avoidedCell = newCell;
                avoidedCellCoords.copy(nextMapCoords);

                // move away from blocked cell
                awayDirection.subVectors(unit.coords.mapCoords, nextMapCoords).normalize();
                unit.desiredPos.copy(unit.obj.position);
                unit.desiredPos.x += awayDirection.x * steerAmount * .5;
                unit.desiredPos.z += awayDirection.y * steerAmount * .5;
                GameUtils.worldToMap(unit.desiredPos, nextMapCoords);
            }
        }

        if (avoidedCell !== undefined && isMoving) {
            const miningState = unit.fsm.getState(MiningState);
            if (miningState) {
                miningState.potentialTarget = avoidedCellCoords;
            } else {
                const instanceId = avoidedCell?.building?.instanceId;
                if (instanceId) {
                    const targetCell = getCellFromAddr(unit.targetCell);
                    if (instanceId === targetCell.building?.instanceId) {
                        const carriedResource = unit.resource;
                        if (carriedResource) {
                            const buildingInstance = GameMapState.instance.buildings.get(instanceId)!;
                            if (buildingInstance.buildingType === "factory") {
                                const state = buildingInstance.state as IFactoryState;
                                if (state.input === carriedResource.type) {
                                    state.inputReserve++;
                                    carriedResource.visual.removeFromParent();
                                    unit.resource = null;
                                }
                            }    
                        }

                        onUnitArrived(unit);
                    }
                }
            }
        }

        let hasMoved = false;
        if (needsMotion) {
            if (isMoving) {
                if (avoidedCell !== undefined) {
                    nextPos.copy(unit.obj.position);
                    mathUtils.smoothDampVec3(nextPos, unit.desiredPos, positionDamp * 2, time.deltaTime);
                } else {
                    nextPos.copy(unit.desiredPos);
                }
                hasMoved = true;
            } else if (unit.isColliding) {
                const collisionAnim = utils.getComponent(UnitCollisionAnim, unit.obj);
                if (collisionAnim) {
                    collisionAnim.reset();
                } else {
                    engineState.setComponent(unit.obj, new UnitCollisionAnim({ unit }));
                }
            }
        }

        unit.isColliding = false;
        const collisionAnim = utils.getComponent(UnitCollisionAnim, unit.obj);
        if (collisionAnim) {
            console.assert(unit.motionId === 0);
            nextPos.copy(unit.obj.position);
            mathUtils.smoothDampVec3(nextPos, unit.desiredPos, positionDamp, time.deltaTime);
            hasMoved = true;
        }

        if (hasMoved) {
            GameUtils.worldToMap(nextPos, nextMapCoords);
            if (nextMapCoords.equals(unit.coords.mapCoords)) {
                unitMotion.updateRotation(unit, unit.obj.position, nextPos);
                unit.obj.position.copy(nextPos);
                if (!unit.fsm.currentState) {
                    if (unit.arriving) {
                        if (unit.velocity.length() < 0.01) {
                            onUnitArrived(unit);
                        }
                    }
                }

            } else {

                // moved to a new cell
                const nextCell = GameUtils.getCell(nextMapCoords);
                const validCell = nextCell?.isWalkable;
                if (validCell) {
                    unitMotion.updateRotation(unit, unit.obj.position, nextPos);
                    unit.obj.position.copy(nextPos);

                    const dx = nextMapCoords.x - unit.coords.mapCoords.x;
                    const dy = nextMapCoords.y - unit.coords.mapCoords.y;
                    cmdFogMoveCircle.post({ mapCoords: unit.coords.mapCoords, radius: 10, dx, dy });

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
                        if (!unit.fsm.currentState) {
                            const reachedTarget = unit.targetCell.mapCoords.equals(nextMapCoords);
                            if (reachedTarget) {
                                unit.arriving = true;
                                unitAnimation.setAnimation(unit, "idle", { transitionDuration: .4, scheduleCommonAnim: true });
                            }
                        }
                    }
                }
            }
        }

        if (unit.resource) {
            // attach the resource to the unit
            const visual = unit.resource.visual;
            const skeleton = unitAnimation.getSkeleton(unit);
            const spine2 = skeleton.getObjectByName("Spine2")!;
            pickedItemlocalToSkeleton.multiplyMatrices(spine2.matrixWorld, pickedItemOffset);
            visual.matrix.multiplyMatrices(unit.obj.matrixWorld, pickedItemlocalToSkeleton);
        }
    }
}

