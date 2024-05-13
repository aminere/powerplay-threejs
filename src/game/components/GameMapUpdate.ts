
import { MathUtils, Matrix4, Object3D, Ray, Vector2, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { input } from "../../engine/Input";
import { engine } from "../../engine/Engine";
import { config } from "../config/config";
import { GameUtils } from "../GameUtils";
import { onBeginDrag, onCancelDrag, onAction, onDrag, onEndDrag, raycastOnCells, updateCameraSize, setCameraPos } from "../GameMapUtils";
import { cmdEndSelection, evtActionCleared } from "../../Events";
import { IUnit } from "../unit/IUnit";
import { buildings } from "../buildings/Buildings";
import { unitMotion } from "../unit/UnitMotion";
import { conveyors } from "../Conveyors";
import { time } from "../../engine/core/Time";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { IBuildingInstance } from "../buildings/BuildingTypes";
import { trees } from "../Trees";
import { GameMapProps } from "./GameMapProps";
import { UnitUtils } from "../unit/UnitUtils";
import { ICell } from "../GameTypes";
import { getCellFromAddr } from "../unit/UnitAddr";

const mapCoords = new Vector2();
const cellCoords = new Vector2();
const deltaPos = new Vector3();
const oldPos = new Vector3();
const normalizedPos = new Vector2();
const intersection = new Vector3();
const { zoomSpeed, zoomRange, orthoSize } = config.camera;
const localRay = new Ray();
const inverseMatrix = new Matrix4();
const { rayCaster } = GameUtils;

const enemiesAroundCell = new Array<IUnit>();
function getEnemiesAroundCell(mapCoords: Vector2, radius: number) {
    enemiesAroundCell.length = 0;
    for (let y = mapCoords.y - radius; y <= mapCoords.y + radius; y++) {
        for (let x = mapCoords.x - radius; x <= mapCoords.x + radius; x++) {
            cellCoords.set(x, y);
            const units = GameUtils.getCell(cellCoords)?.units;
            if (units) {
                for (const unit of units) {
                    if (unit.isAlive && UnitUtils.isEnemy(unit)) {
                        enemiesAroundCell.push(unit);
                    }
                }
            }
        }
    }
    return enemiesAroundCell;
}

function raycastOnUnit(worldRay: Ray, unit: IUnit, intersectionOut: Vector3) {
    inverseMatrix.copy(unit.visual.matrixWorld).invert();
    localRay.copy(worldRay).applyMatrix4(inverseMatrix);
    if (localRay.intersectBox(unit.boundingBox, intersectionOut)) {
        intersectionOut.applyMatrix4(unit.visual.matrixWorld); // convert intersection to world space
        return true;
    }
    return false;
}

function getWorldRay(worldRayOut: Ray) {
    const { width, height } = engine.screenRect;
    normalizedPos.set((input.touchPos.x / width) * 2 - 1, -(input.touchPos.y / height) * 2 + 1);
    rayCaster.setFromCamera(normalizedPos, GameMapState.instance.camera);
    worldRayOut.copy(rayCaster.ray);
}

function moveCommand(_mapCoords: Vector2, targetCell: ICell) {
    // group units per sector
    const groups = unitsManager.selectedUnits.reduce((prev, cur) => {
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
    for (const group of Object.values(groups)) {
        if (group.character.length > 0) {
            unitMotion.moveGroup(commandId, group.character, _mapCoords, targetCell);
        }
        if (group.vehicle.length > 0) {
            unitMotion.moveGroup(commandId, group.vehicle, _mapCoords, targetCell, true);
        }
    }
}

export class GameMapUpdate extends Component<ComponentProps> {

    constructor() {
        super(new ComponentProps());
    }

    override update(_owner: Object3D) {
        this.updateInput();
        conveyors.update();
        unitsManager.update();
        buildings.update();
        trees.update();
    }

    private checkKeyboardCameraPan() {
        const state = GameMapState.instance;
        let xNorm = 0;
        let yNorm = 0;
        let keyboardPan = false;
        if (state.pressedKeys.has("a")) {
            xNorm = -1;
            keyboardPan = true;
        } else if (state.pressedKeys.has("d")) {
            xNorm = 1;
            keyboardPan = true;
        }
        if (state.pressedKeys.has("w")) {
            yNorm = -1;
            keyboardPan = true;
        } else if (state.pressedKeys.has("s")) {
            yNorm = 1;
            keyboardPan = true;
        }
        if (keyboardPan) {
            this.checkCameraPan(xNorm, yNorm);
        }
    }

    private checkCameraPan(xNorm: number, yNorm: number) {
        const state = GameMapState.instance;
        if (state.selectionInProgress) {
            return;
        }

        const { width, height } = engine.screenRect;
        const dt = time.deltaTime;
        const { panMargin, panSpeed } = config.camera;
        const margin = 50;
        if (Math.abs(xNorm) > 1 - panMargin) {
            const dx = xNorm * dt * panSpeed * state.cameraZoom;
            deltaPos.set(dx, 0, 0).applyAxisAngle(GameUtils.vec3.up, state.cameraAngleRad);
            oldPos.copy(state.cameraRoot.position);
            setCameraPos(state.cameraRoot.position.add(deltaPos));
            const [_, rightAccessor, __, leftAccessor] = state.cameraBoundsAccessors;
            const rightBound = state.cameraBounds[rightAccessor];
            const leftBound = state.cameraBounds[leftAccessor];
            const { x: leftX } = leftBound;
            const { x: rightX } = rightBound;
            if (dx < 0) {
                if (leftX > 0) {
                    if (rightX > width - margin) {
                        setCameraPos(oldPos);
                    }
                }
            } else {
                if (rightX < width) {
                    if (leftX < margin) {
                        setCameraPos(oldPos);
                    }
                }
            }
        }
        if (Math.abs(yNorm) > 1 - panMargin) {
            const aspect = width / height
            const dy = yNorm * aspect * dt * panSpeed * state.cameraZoom;
            deltaPos.set(0, 0, dy).applyAxisAngle(GameUtils.vec3.up, state.cameraAngleRad);
            oldPos.copy(state.cameraRoot.position);
            setCameraPos(state.cameraRoot.position.add(deltaPos));
            const [topAcecssor, _, bottomAccessor] = state.cameraBoundsAccessors;
            const topBound = state.cameraBounds[topAcecssor];
            const bottomBound = state.cameraBounds[bottomAccessor];
            const { y: topY } = topBound;
            const { y: bottomY } = bottomBound;
            if (dy < 0) {
                if (topY > 0) {
                    if (bottomY > height - margin) {
                        setCameraPos(oldPos);
                    }
                }
            } else {
                if (bottomY < height) {
                    if (topY < margin) {
                        setCameraPos(oldPos);
                    }
                }
            }
        }
    }

    private updateInput() {
        const state = GameMapState.instance;
        const resolution = state.tileSelector.resolution;

        if (input.touchInside && !state.cursorOverUI) {
            const { width, height } = engine.screenRect;
            const touchPos = input.touchPos;
            // [0, s] to [-1, 1]
            const xNorm = (touchPos.x / width) * 2 - 1;
            const yNorm = (touchPos.y / height) * 2 - 1;
            this.checkCameraPan(xNorm, yNorm);

            if (!input.touchPos.equals(state.previousTouchPos)) {
                state.previousTouchPos.copy(input.touchPos);
                if (raycastOnCells(input.touchPos, state.camera, cellCoords, resolution)) {
                    if (state.action) {
                        if (!cellCoords.equals(state.selectedCellCoords)) {
                            state.tileSelector.setPosition(cellCoords.x, cellCoords.y, state.sectors);
                            state.selectedCellCoords.copy(cellCoords);
                        }
                    } else {
                        if (!cellCoords.equals(state.highlightedCellCoords)) {
                            state.highlightedCellCoords.copy(cellCoords!);
                        }
                    }
                }
            }
        }

        this.checkKeyboardCameraPan();

        if (input.wheelDelta !== 0) {
            const [min, max] = zoomRange;
            const newZoom = MathUtils.clamp(state.cameraZoom + input.wheelDelta * zoomSpeed, min, max);
            const deltaZoom = newZoom - state.cameraZoom;
            const { width, height } = engine.screenRect;
            // [0, s] to [-1, 1]
            const touchPos = input.touchPos;
            const [xNorm, yNorm] = [(touchPos.x / width) * 2 - 1, (touchPos.y / height) * 2 - 1];
            const aspect = width / height;
            const offsetX = orthoSize * aspect * xNorm * deltaZoom;
            const offsetY = orthoSize * aspect * yNorm * deltaZoom;
            deltaPos.set(-offsetX, 0, -offsetY).applyAxisAngle(GameUtils.vec3.up, state.cameraAngleRad);
            state.cameraRoot.position.add(deltaPos);
            state.cameraZoom = newZoom;
            updateCameraSize();
        }

        if (input.touchJustPressed) {
            if (!state.cursorOverUI) {
                if (state.action !== null) {
                    if (input.touchButton === 0) {
                        state.touchStartCoords.copy(state.selectedCellCoords);
                    }
                } else {
                    if (GameMapProps.instance.debugCells) {
                        if (input.touchButton === 0) {
                            const cell = GameUtils.getCell(state.highlightedCellCoords);
                            console.log(cell);
                        }
                    }
                }
            }
        } else if (input.touchPressed) {

            if (input.touchButton === 0) {
                if (input.touchJustMoved) {
                    if (!state.cursorOverUI) {
                        if (state.action) {
                            if (!state.touchDragged) {
                                const cell = raycastOnCells(input.touchPos, state.camera, cellCoords, resolution);
                                if (cell) {
                                    if (cellCoords?.equals(state.touchStartCoords) === false) {
                                        state.touchDragged = true;
                                        state.touchHoveredCoords.copy(cellCoords!);
                                        onBeginDrag(state.touchStartCoords, state.touchHoveredCoords);
                                    }
                                }
                            } else {
                                const cell = raycastOnCells(input.touchPos, state.camera, cellCoords, resolution);
                                if (cell) {
                                    if (cellCoords?.equals(state.touchHoveredCoords) === false) {
                                        state.touchHoveredCoords.copy(cellCoords!);
                                        onDrag(state.touchStartCoords, state.touchHoveredCoords);
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (input.touchButton === 2) {
                if (input.touchJustMoved) {
                    if (!state.cursorOverUI) {
                        if (state.action) {
                            const cell = raycastOnCells(input.touchPos, state.camera, cellCoords, resolution);
                            if (cell) {
                                if (cellCoords?.equals(state.touchHoveredCoords) === false) {
                                    state.touchHoveredCoords.copy(cellCoords!);
                                    onAction(2);
                                    state.touchDragged = true;
                                }
                            }
                        }
                    }
                }
            }

        } else if (input.touchJustReleased) {

            if (input.touchButton === 0) {
                const wasDragged = state.touchDragged;
                state.touchDragged = false;
                let canceled = false;

                if (state.cursorOverUI) {
                    if (wasDragged) {
                        onCancelDrag();
                    }
                    if (state.selectionInProgress) {
                        cmdEndSelection.post();
                        state.selectionInProgress = false;
                    }
                    canceled = true;
                }

                if (!canceled) {
                    if (state.action) {
                        if (wasDragged) {
                            onEndDrag();
                        } else {
                            onAction(0);
                        }
                    } else {

                        if (state.selectionInProgress) {
                            cmdEndSelection.post();
                            state.selectionInProgress = false;

                        } else {

                            getWorldRay(rayCaster.ray);
                            const intersections: Array<{
                                unit?: IUnit;
                                building?: IBuildingInstance;
                                distance: number;
                            }> = [];

                            const units = unitsManager.units;

                            for (let i = 0; i < units.length; ++i) {
                                const unit = units[i];
                                if (!unit.isAlive) {
                                    continue;
                                }
                                inverseMatrix.copy(unit.visual.matrixWorld).invert();
                                if (raycastOnUnit(rayCaster.ray, unit, intersection)) {
                                    intersections.push({ unit, distance: rayCaster.ray.origin.distanceTo(intersection) });
                                }
                            }

                            for (const [, building] of state.buildings) {
                                inverseMatrix.copy(building.visual.matrixWorld).invert();
                                localRay.copy(rayCaster.ray).applyMatrix4(inverseMatrix);
                                const boundingBox = buildings.getBoundingBox(building.buildingType);
                                if (localRay.intersectBox(boundingBox, intersection)) {
                                    intersection.applyMatrix4(building.visual.matrixWorld); // convert intersection to world space
                                    intersections.push({ building, distance: rayCaster.ray.origin.distanceTo(intersection) });
                                }
                            }

                            if (intersections.length > 0) {
                                intersections.sort((a, b) => a.distance - b.distance);
                                const { unit, building } = intersections[0];
                                if (unit) {
                                    unitsManager.setSelection({ type: "units", units: [unit] });
                                } else if (building) {
                                    unitsManager.setSelection({ type: "building", building })
                                }

                            } else {
                                const cell = GameUtils.getCell(state.highlightedCellCoords);
                                if (!cell || cell.isEmpty) {
                                    unitsManager.setSelection(null);
                                } else {
                                    unitsManager.setSelection({ type: "cell", cell, mapCoords: state.highlightedCellCoords.clone() });
                                }
                            }
                        }

                    }
                }
            } else if (input.touchButton === 2) {

                if (state.action) {

                    switch (state.action) {
                        case "conveyor": {
                            const executed = onAction(2);
                            if (!executed && !state.touchDragged) {
                                state.action = null;
                                evtActionCleared.post();
                            }
                        }
                            break;

                        case "water": {
                            onAction(2);
                        }
                            break;

                        default: {
                            state.action = null;
                            evtActionCleared.post();
                        }
                    }

                    if (state.touchDragged) {
                        state.touchDragged = false;
                    }

                } else {
                    if (unitsManager.selectedUnits.length > 0) {
                        const targetCell = raycastOnCells(input.touchPos, state.camera, mapCoords, resolution);
                        if (targetCell) {

                            // check if right click on enemy
                            const targetEnemy = (() => {
                                const enemies = getEnemiesAroundCell(mapCoords, 2);
                                if (enemies.length > 0) {
                                    getWorldRay(rayCaster.ray);
                                    const intersections: Array<{ unit: IUnit; distance: number; }> = [];
                                    for (const enemy of enemies) {
                                        if (raycastOnUnit(rayCaster.ray, enemy, intersection)) {
                                            intersections.push({ unit: enemy, distance: rayCaster.ray.origin.distanceTo(intersection) });
                                        }
                                    }
                                    if (intersections.length > 0) {
                                        intersections.sort((a, b) => a.distance - b.distance);
                                        return intersections[0].unit;
                                    }
                                }
                            })();

                            if (targetEnemy) {
                                moveCommand(targetEnemy.coords.mapCoords, getCellFromAddr(targetEnemy.coords));
                                // TODO MeleeAttackState
                            } else {
                                moveCommand(mapCoords, targetCell);
                            }
                        }
                    }
                }
            }
        }
    }
}

