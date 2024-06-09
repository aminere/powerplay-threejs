import { Euler, MathUtils, Matrix4, Ray, Vector2, Vector3 } from "three";
import { engine } from "../engine/Engine";
import { input } from "../engine/Input";
import { GameUtils } from "./GameUtils";
import { GameMapState } from "./components/GameMapState";
import { config } from "./config/config";
import { IUnit } from "./unit/IUnit";
import { IBuildingInstance } from "./buildings/BuildingTypes";
import { UnitUtils } from "./unit/UnitUtils";
import { unitsManager } from "./unit/UnitsManager";
import { ICell } from "./GameTypes";
import { unitMotion } from "./unit/UnitMotion";
import { cmdEndSelection, cmdOpenInGameMenu, cmdRotateMinimap, evtMoveCommand } from "../Events";
import { onAction, onBeginDrag, onCancelDrag, onDrag, onEndDrag, raycastOnCells, setCameraPos, updateCameraSize } from "./GameMapUtils";
import { time } from "../engine/core/Time";
import { GameMapProps } from "./components/GameMapProps";
import { buildings } from "./buildings/Buildings";
import { getCellFromAddr } from "./unit/UnitAddr";
import { MeleeAttackState } from "./unit/states/MeleeAttackState";
import { ICharacterUnit } from "./unit/ICharacterUnit";
import { buildingConfig } from "./config/BuildingConfig";
import gsap from "gsap";
import { TankState } from "./unit/states/TankState";

const mapCoords = new Vector2();
const cellCoords = new Vector2();
const deltaPos = new Vector3();
const oldPos = new Vector3();
const normalizedPos = new Vector2();
const intersection = new Vector3();
const { zoomSpeed, zoomRange, orthoSize } = config.camera;
const { mapRes, cellsPerVehicleCell } = config.game;
const localRay = new Ray();
const worldRay = new Ray();
const inverseMatrix = new Matrix4();
const intersections: Array<{ unit?: IUnit; building?: IBuildingInstance; distance: number; }> = [];

const enemiesAroundCell = new Array<IUnit>();
function getEnemiesAroundCell(mapCoords: Vector2, radius: number) {
    enemiesAroundCell.length = 0;
    for (let y = mapCoords.y - radius; y <= mapCoords.y + radius; y++) {
        for (let x = mapCoords.x - radius; x <= mapCoords.x + radius; x++) {
            cellCoords.set(x, y);
            const units = GameUtils.getCell(cellCoords)?.units;
            if (units) {
                for (const unit of units) {
                    if (UnitUtils.isEnemy(unit)) {
                        enemiesAroundCell.push(unit);
                    }
                }
            }
        }
    }
    return enemiesAroundCell;
}

const buildingsAroundCell = new Set<IBuildingInstance>();
function getBuildingsAroundCell(mapCoords: Vector2, radius: number) {
    buildingsAroundCell.clear();
    for (let y = mapCoords.y - radius; y <= mapCoords.y + radius; y++) {
        for (let x = mapCoords.x - radius; x <= mapCoords.x + radius; x++) {
            cellCoords.set(x, y);
            const building = GameUtils.getCell(cellCoords)?.building;
            if (building) {
                const instance = GameMapState.instance.buildings.get(building)!;
                buildingsAroundCell.add(instance);
            }
        }
    }
    return buildingsAroundCell;
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
    const { rayCaster } = GameUtils;
    normalizedPos.set((input.touchPos.x / width) * 2 - 1, -(input.touchPos.y / height) * 2 + 1);
    rayCaster.setFromCamera(normalizedPos, GameMapState.instance.camera);
    worldRayOut.copy(rayCaster.ray);
}

function moveCommand(units: IUnit[], _mapCoords: Vector2, targetCell: ICell, targetUnit?: IUnit) {

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

function onCellHovered(_cellCoords: Vector2, touchStart: Vector2) {
    const state = GameMapState.instance;
    state.tileSelector.setPosition(_cellCoords.x, _cellCoords.y);
    if (GameMapState.instance.cursorOverUI) {
        state.tileSelector.visible = false;
    } else {
        state.tileSelector.visible = true;
    }
    if (state.touchDragged) {
        onDrag(touchStart, _cellCoords);
    }
}

function checkCameraPan(xNorm: number, yNorm: number) {

    const state = GameMapState.instance;
    if (!state.config.cameraPan) {
        return;
    }

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
            if (state.cursorOverUI) {
                setCameraPos(oldPos);
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

function checkKeyboardInput() {
    let xNorm = 0;
    let yNorm = 0;
    let keyboardPan = false;
    if (input.keyPressed.has("a")) {
        xNorm = -1;
        keyboardPan = true;
    } else if (input.keyPressed.has("d")) {
        xNorm = 1;
        keyboardPan = true;
    }
    if (input.keyPressed.has("w")) {
        yNorm = -1;
        keyboardPan = true;
    } else if (input.keyPressed.has("s")) {
        yNorm = 1;
        keyboardPan = true;
    }
    if (keyboardPan) {
        checkCameraPan(xNorm, yNorm);
    }

    const cameraRotationDir = (() => {
        if (input.keyJustReleased.has("q")) {
            return -1;
        } else if (input.keyJustReleased.has("e")) {
            return 1;
        }
        return 0;
    })();

    const state = GameMapState.instance;
    if (cameraRotationDir !== 0 && !state.cameraTween) {
        state.cameraTween = gsap.to(state, {
            cameraAngleRad: state.cameraAngleRad + Math.PI / 2 * cameraRotationDir,
            duration: .45,
            ease: "power2.out",
            onUpdate: () => {
                const [rotationX] = config.camera.rotation;
                state.cameraPivot.setRotationFromEuler(new Euler(MathUtils.degToRad(rotationX), state.cameraAngleRad, 0, 'YXZ'));
                cmdRotateMinimap.post(MathUtils.radToDeg(state.cameraAngleRad));
            },
            onComplete: () => {
                state.cameraTween = null;

                // rotate camera bounds
                const length = state.cameraBoundsAccessors.length;
                state.cameraBoundsAccessors = state.cameraBoundsAccessors.map((_, index) => {
                    if (cameraRotationDir < 0) {
                        return state.cameraBoundsAccessors[(index + 1) % length];
                    } else {
                        if (index === 0) {
                            return state.cameraBoundsAccessors[length - 1];
                        } else {
                            return state.cameraBoundsAccessors[index - 1];
                        }
                    }
                });
            }
        });
    }

    if (input.keyJustReleased.has("escape")) {
        if (state.config.tutorial) {
            cmdOpenInGameMenu.post(!state.inGameMenuOpen);
        } else {
            if (state.action) {
                state.action = null;
            } else {
                cmdOpenInGameMenu.post(!state.inGameMenuOpen);
            }
        }
    }

    if (input.keyJustReleased.has("k")) {
        unitsManager.killSelection();
    }
}

class GameMapInput {

    public update() {
        const state = GameMapState.instance;
        const resolution = state.tileSelector.resolution;

        if (input.touchInside) {
            const { width, height } = engine.screenRect;
            const touchPos = input.touchPos;
            // [0, s] to [-1, 1]
            const xNorm = (touchPos.x / width) * 2 - 1;
            const yNorm = (touchPos.y / height) * 2 - 1;
            checkCameraPan(xNorm, yNorm);

            if (!input.touchPos.equals(state.previousTouchPos)) {
                state.previousTouchPos.copy(input.touchPos);

                if (state.action === "destroy") {
                    if (GameUtils.screenCastOnPlane(state.camera, input.touchPos, 0, intersection)) {
                        GameUtils.worldToMap(intersection, cellCoords);
                        if (!cellCoords.equals(state.surfaceCellCoords)) {
                            state.surfaceCellCoords.copy(cellCoords);
                            onCellHovered(cellCoords, state.surfaceTouchStart);
                        }
                    }
                } else {
                    if (raycastOnCells(input.touchPos, state.camera, cellCoords, resolution)) {
                        if (!cellCoords.equals(state.raycastedCellCoords)) {
                            state.raycastedCellCoords.copy(cellCoords);
                            if (state.action) {
                                state.tileSelector.fit(cellCoords.x, cellCoords.y, state.sectors);
                                onCellHovered(cellCoords, state.raycastedTouchStart);
                            }
                        }
                    }
                }
            }
        }

        checkKeyboardInput();

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
                        if (!state.config.input.leftClick) {
                            return;
                        }
                        state.raycastedTouchStart.copy(state.raycastedCellCoords);
                        state.surfaceTouchStart.copy(state.surfaceCellCoords);
                    }
                } else {
                    if (GameMapProps.instance.debugCells) {
                        if (input.touchButton === 0) {
                            if (!state.config.input.leftClick) {
                                return;
                            }
                            const sectorCoords = new Vector2();
                            const localCoords = new Vector2();
                            const cell = GameUtils.getCell(state.raycastedCellCoords, sectorCoords, localCoords);
                            const _x = Math.floor(state.raycastedCellCoords.x / 2);
                            const _y = Math.floor(state.raycastedCellCoords.y / 2);
                            console.log(`mapCoords: ${state.raycastedCellCoords.x},${state.raycastedCellCoords.y}, mapCoords2x2: ${_x},${_y}`);
                            console.log(cell);
                            const sector = GameUtils.getSector(sectorCoords)!;
                            const x = Math.floor(localCoords.x / cellsPerVehicleCell);
                            const y = Math.floor(localCoords.y / cellsPerVehicleCell);
                            const cellIndex2x2 = y * (mapRes / cellsPerVehicleCell) + x;
                            const cell2x2 = sector.cells2x2[cellIndex2x2];
                            console.log(cell2x2);
                        }
                    }
                }
            }
        } else if (input.touchPressed) {

            if (input.touchButton === 0) {
                if (!state.config.input.leftClick) {
                    return;
                }
                if (input.touchJustMoved) {
                    if (!state.cursorOverUI) {
                        if (state.action) {
                            if (!state.touchDragged) {
                                const startCoords = state.action === "destroy" ? state.surfaceTouchStart : state.raycastedTouchStart;
                                const currentCoords = state.action === "destroy" ? state.surfaceCellCoords : state.raycastedCellCoords;
                                if (!startCoords.equals(currentCoords)) {
                                    const startCell = GameUtils.getCell(startCoords);
                                    const endCell = GameUtils.getCell(currentCoords);
                                    if (startCell && endCell) {
                                        state.touchDragged = true;
                                        onBeginDrag(startCoords, currentCoords);
                                    }
                                }
                            }
                        }
                    }
                }
            }

        } else if (input.touchJustReleased) {

            if (input.touchButton === 0) {
                if (!state.config.input.leftClick) {
                    return;
                }

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

                        if (unitsManager.selectedUnits.length > 0) {
                            unitsManager.setSelection({ type: "units", units: unitsManager.selectedUnits });
                        } else {
                            unitsManager.setSelection(null);
                        }
                    }
                    canceled = true;
                }

                if (!canceled) {
                    if (state.action) {
                        if (wasDragged) {
                            onEndDrag(state.raycastedTouchStart, state.raycastedCellCoords);
                        } else {
                            onAction();
                        }
                    } else {

                        if (state.selectionInProgress) {
                            cmdEndSelection.post();
                            state.selectionInProgress = false;

                        } else {

                            const units = unitsManager.units;
                            getWorldRay(worldRay);
                            intersections.length = 0;
                            for (let i = 0; i < units.length; ++i) {
                                const unit = units[i];
                                if (!unit.isAlive) {
                                    continue;
                                }
                                inverseMatrix.copy(unit.visual.matrixWorld).invert();
                                if (raycastOnUnit(worldRay, unit, intersection)) {
                                    intersections.push({ unit, distance: worldRay.origin.distanceTo(intersection) });
                                }
                            }

                            for (const [, building] of state.buildings) {
                                inverseMatrix.copy(building.visual.matrixWorld).invert();
                                localRay.copy(worldRay).applyMatrix4(inverseMatrix);
                                const boundingBox = buildings.getBoundingBox(building.buildingType);
                                if (localRay.intersectBox(boundingBox, intersection)) {
                                    intersection.applyMatrix4(building.visual.matrixWorld); // convert intersection to world space
                                    intersections.push({ building, distance: worldRay.origin.distanceTo(intersection) });
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
                                if (GameUtils.screenCastOnPlane(state.camera, input.touchPos, 0, intersection)) {
                                    GameUtils.worldToMap(intersection, cellCoords);
                                    const cell = GameUtils.getCell(cellCoords);
                                    if (!cell || cell.isEmpty) {
                                        unitsManager.setSelection(null);
                                    } else {
                                        unitsManager.setSelection({ type: "cell", cell, mapCoords: cellCoords.clone() });
                                    }
                                }
                            }
                        }
                    }
                }
            } else if (input.touchButton === 2) {

                if (!state.config.input.rightClick) {
                    return;
                }

                if (state.action) {
                    state.action = null;
                    if (state.touchDragged) {
                        state.touchDragged = false;
                    }

                } else {

                    if (unitsManager.selectedUnits.length > 0) {
                        const targetCell = raycastOnCells(input.touchPos, state.camera, mapCoords, resolution);
                        if (targetCell) {

                            getWorldRay(worldRay);
                            intersections.length = 0;

                            const enemies = getEnemiesAroundCell(mapCoords, 2);
                            for (const enemy of enemies) {
                                if (raycastOnUnit(worldRay, enemy, intersection)) {
                                    intersections.push({ unit: enemy, distance: worldRay.origin.distanceTo(intersection) });
                                }
                            }

                            const _buildings = getBuildingsAroundCell(mapCoords, 4);
                            for (const building of _buildings) {
                                inverseMatrix.copy(building.visual.matrixWorld).invert();
                                localRay.copy(worldRay).applyMatrix4(inverseMatrix);
                                const boundingBox = buildings.getBoundingBox(building.buildingType);
                                if (localRay.intersectBox(boundingBox, intersection)) {
                                    intersection.applyMatrix4(building.visual.matrixWorld); // convert intersection to world space
                                    intersections.push({ building, distance: worldRay.origin.distanceTo(intersection) });
                                }
                            }

                            const units = unitsManager.selectedUnits;
                            if (intersections.length > 0) {
                                intersections.sort((a, b) => a.distance - b.distance);
                                const { unit: targetEnemy, building } = intersections[0];
                                if (targetEnemy) {
                                    moveCommand(units, targetEnemy.coords.mapCoords, getCellFromAddr(targetEnemy.coords), targetEnemy);
                                    evtMoveCommand.post(targetEnemy.coords.mapCoords);

                                    for (const _unit of units) {
                                        if (UnitUtils.isWorker(_unit)) {
                                            const attack = _unit.fsm.switchState(MeleeAttackState);
                                            attack.attackTarget(_unit as ICharacterUnit, targetEnemy);
                                            continue;
                                        }
                                        
                                        const tankState = _unit.fsm.getState(TankState);
                                        if (tankState) {
                                            tankState.followTarget(targetEnemy);
                                            continue;
                                        }
                                    }


                                } else if (building) {
                                    // move to center of building
                                    const { size } = buildingConfig[building.buildingType];
                                    mapCoords.set(
                                        Math.floor(building.mapCoords.x + size.x / 2),
                                        Math.floor(building.mapCoords.y + size.z / 2)
                                    );
                                    moveCommand(units, mapCoords, GameUtils.getCell(mapCoords)!);
                                    evtMoveCommand.post(mapCoords);

                                }
                            } else {
                                moveCommand(units, mapCoords, targetCell);
                                evtMoveCommand.post(mapCoords);
                            }
                        }
                    }
                }
            }
        }
    }
}

export const gameMapInput = new GameMapInput();

