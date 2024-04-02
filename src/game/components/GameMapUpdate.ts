
import { MathUtils, Matrix4, Object3D, Ray, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { input } from "../../engine/Input";
import { engine } from "../../engine/Engine";
import { pools } from "../../engine/core/Pools";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { onBeginDrag, onCancelDrag, onAction, onDrag, onEndDrag, raycastOnCells, updateCameraSize, setCameraPos } from "../GameMapUtils";
import { cmdEndSelection, cmdSetSelectedElems } from "../../Events";
import { IUnit, UnitType } from "../unit/IUnit";
import { buildings } from "../buildings/Buildings";
import { conveyorItems } from "../ConveyorItems";
import { unitMotion } from "../unit/UnitMotion";
import { conveyors } from "../Conveyors";
import { time } from "../../engine/core/Time";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { IBuildingInstance } from "../buildings/BuildingTypes";

const cellCoords = new Vector2();
const { zoomSpeed, zoomRange, orthoSize } = config.camera;
const localRay = new Ray();
const inverseMatrix = new Matrix4();
const { rayCaster } = GameUtils;

export class GameMapUpdate extends Component<ComponentProps> {
    constructor() {
        super(new ComponentProps());
    }

    override update(_owner: Object3D) {
        
        const state = GameMapState.instance;
        if (input.touchInside && !state.cursorOverUI) {
            const { width, height } = engine.screenRect;
            const touchPos = input.touchPos;
            // [0, s] to [-1, 1]
            const xNorm = (touchPos.x / width) * 2 - 1;
            const yNorm = (touchPos.y / height) * 2 - 1;
            this.checkCameraPan(xNorm, yNorm);

            if (!input.touchPos.equals(state.previousTouchPos)) {
                state.previousTouchPos.copy(input.touchPos);
                raycastOnCells(input.touchPos, state.camera, cellCoords);
                if (state.action) {
                    if (cellCoords?.equals(state.selectedCellCoords) === false) {
                        state.tileSelector.setPosition(cellCoords!, state.sectors);
                        state.selectedCellCoords.copy(cellCoords!);
                    }
                } else {
                    if (cellCoords?.equals(state.highlightedCellCoords) === false) {
                        state.highlightedCellCoords.copy(cellCoords!);
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
            const deltaPos = pools.vec3.getOne();
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
                }
            }
        } else if (input.touchPressed) {

            if (input.touchButton === 0) {
                if (input.touchJustMoved) {
                    if (!state.cursorOverUI) {
                        if (state.action) {
                            const cellCoords = pools.vec2.getOne();
                            if (!state.touchDragged) {
                                const cell = raycastOnCells(input.touchPos, state.camera, cellCoords);
                                if (cell) {
                                    if (cellCoords?.equals(state.touchStartCoords) === false) {
                                        state.touchDragged = true;
                                        state.touchHoveredCoords.copy(cellCoords!);
                                        onBeginDrag(state.touchStartCoords, state.touchHoveredCoords);
                                    }
                                }
                            } else {
                                const cell = raycastOnCells(input.touchPos, state.camera, cellCoords);
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
                            const cellCoords = pools.vec2.getOne();
                            const cell = raycastOnCells(input.touchPos, state.camera, cellCoords);
                            if (cell) {
                                if (cellCoords?.equals(state.touchHoveredCoords) === false) {
                                    state.touchHoveredCoords.copy(cellCoords!);
                                    onAction(2);
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

                            const { width, height } = engine.screenRect;
                            const normalizedPos = pools.vec2.getOne();
                            normalizedPos.set((input.touchPos.x / width) * 2 - 1, -(input.touchPos.y / height) * 2 + 1);
                            rayCaster.setFromCamera(normalizedPos, state.camera);

                            const intersections: Array<{
                                unit?: IUnit;
                                building?: IBuildingInstance;
                                distance: number;
                            }> = [];

                            const units = unitsManager.units;
                            const intersection = pools.vec3.getOne();
                            for (let i = 0; i < units.length; ++i) {
                                const unit = units[i];
                                const { obj, type } = unit;
                                if (type === UnitType.NPC) {
                                    continue;
                                }
                                if (!unit.isAlive) {
                                    continue;
                                }
                                inverseMatrix.copy(obj.matrixWorld).invert();
                                localRay.copy(rayCaster.ray).applyMatrix4(inverseMatrix);
                                const boundingBox = obj.boundingBox;
                                if (localRay.intersectBox(boundingBox, intersection)) {
                                    intersections.push({ unit, distance: localRay.origin.distanceTo(intersection) });
                                }
                            }

                            for (const [, building] of state.buildings) {
                                inverseMatrix.copy(building.visual.matrixWorld).invert();
                                localRay.copy(rayCaster.ray).applyMatrix4(inverseMatrix);
                                const boundingBox = buildings.getBoundingBox(building.buildingType);
                                if (localRay.intersectBox(boundingBox, intersection)) {
                                    intersections.push({ building, distance: localRay.origin.distanceTo(intersection) });
                                }
                            }

                            if (intersections.length > 0) {
                                intersections.sort((a, b) => a.distance - b.distance);

                                const { unit, building } = intersections[0];
                                if (unit) {
                                    state.selectedBuilding = null;
                                    unitsManager.selectedUnits = [unit];                                    
                                    cmdSetSelectedElems.post({ units: unitsManager.selectedUnits });

                                } else if (building) {
                                    if (unitsManager.selectedUnits.length > 0) {
                                        unitsManager.selectedUnits.length = 0;
                                    }
                                    state.selectedBuilding = building;
                                    cmdSetSelectedElems.post({ building });
                                }

                            } else {

                                if (unitsManager.selectedUnits.length > 0) {
                                    unitsManager.selectedUnits.length = 0;
                                }

                                state.selectedBuilding = null;
                                const cell = GameUtils.getCell(state.highlightedCellCoords);
                                if (cell?.conveyor) {
                                    // cmdSetSelectedElems.post({ conveyor: this.state.highlightedCellCoords.clone() });
                                    conveyorItems.addItem(cell, state.highlightedCellCoords);

                                } else {
                                    cmdSetSelectedElems.post({});
                                }
                            }
                        }

                    }
                }
            } else if (input.touchButton === 2) {

                if (state.action) {
                    onAction(2);
                } else {
                    if (unitsManager.selectedUnits.length > 0) {
                        const targetCellCoords = pools.vec2.getOne();
                        const targetCell = raycastOnCells(input.touchPos, state.camera, targetCellCoords);
                        if (targetCell) {
                            // group units per sector
                            const groups = unitsManager.selectedUnits.reduce((prev, cur) => {
                                const key = `${cur.coords.sectorCoords.x},${cur.coords.sectorCoords.y}`;
                                let units = prev[key];
                                if (!units) {
                                    units = [cur];
                                    prev[key] = units;
                                } else {
                                    units.push(cur);
                                }
                                return prev;
                            }, {} as Record<string, IUnit[]>);

                            for (const units of Object.values(groups)) {
                                unitMotion.move(units, targetCellCoords, targetCell);
                            }
                        }
                    }
                }

            }
        }

        conveyors.update();
        unitsManager.update();
        buildings.update();
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
        const [delta, oldPos] = pools.vec3.get(2);
        if (Math.abs(xNorm) > 1 - panMargin) {
            const dx = xNorm * dt * panSpeed * state.cameraZoom;
            delta.set(dx, 0, 0).applyAxisAngle(GameUtils.vec3.up, state.cameraAngleRad);
            oldPos.copy(state.cameraRoot.position);
            setCameraPos(state.cameraRoot.position.add(delta));            
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
            delta.set(0, 0, dy).applyAxisAngle(GameUtils.vec3.up, state.cameraAngleRad);
            oldPos.copy(state.cameraRoot.position);
            setCameraPos(state.cameraRoot.position.add(delta));
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
}

