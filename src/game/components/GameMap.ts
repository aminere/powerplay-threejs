import { DirectionalLight, Euler, MathUtils, Matrix4, Object3D, OrthographicCamera, Ray, Vector2, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component"
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { input } from "../../engine/Input";
import { engine } from "../../engine/Engine";
import { pools } from "../../engine/core/Pools";
import { IGameMapState, gameMapState } from "./GameMapState";
import { TileSector } from "../TileSelector";
import { cmdEndSelection, cmdFogAddCircle, cmdHideUI, cmdRotateMinimap, cmdSetSelectedElems, cmdShowUI } from "../../Events";
import { createSector, onBeginDrag,  onCancelDrag, onClick, onDrag, onEndDrag, raycastOnCells, updateCameraBounds } from "./GameMapUtils";
import { railFactory } from "../RailFactory";
import { utils } from "../../engine/Utils";
import { time } from "../../engine/core/Time";
import { GameMapProps } from "./GameMapProps";
import { engineState } from "../../engine/EngineState";
import { Flock } from "./Flock";
import { Water } from "./Water";
import { EnvProps } from "./EnvProps";
import { Trees } from "./Trees";
import { fogOfWar } from "../FogOfWar";
import gsap from "gsap";
import { IBuildingInstance, ISector } from "../GameTypes";
import { buildings } from "../Buildings";
import { IUnit, UnitType } from "../unit/IUnit";
import { unitMotion } from "../unit/UnitMotion";
import { conveyors } from "../Conveyors";
import { conveyorItems } from "../ConveyorItems";
import { unitUtils } from "../unit/UnitUtils";

const localRay = new Ray();
const inverseMatrix = new Matrix4();
const { rayCaster } = GameUtils;

export class GameMap extends Component<GameMapProps, IGameMapState> {

    constructor(props?: Partial<GameMapProps>) {
        super(new GameMapProps(props));
    }

    override start() {

        const root = engine.scene!;
        const rails = utils.createObject(root, "rails");
        const trains = utils.createObject(root, "trains");
        const cars = utils.createObject(root, "cars");
        const buildings = utils.createObject(root, "buildings");
        const conveyors = utils.createObject(root, "conveyors");

        this.setState({
            sectorsRoot: utils.createObject(root, "sectors"),
            sectors: new Map<string, ISector>(),
            sectorRes: this.props.size,
            action: null,
            previousRoad: [],
            previousRail: [],
            previousConveyors: [],
            cameraZoom: 1,
            cameraAngleRad: 0,
            cameraTween: null,
            cameraRoot: null!,
            cameraPivot: null!,
            camera: null!,
            light: null!,
            cameraBoundsAccessors: [0, 1, 2, 3],
            cameraBounds: [
                new Vector3(), // top
                new Vector3(), // right
                new Vector3(), // bottom
                new Vector3() // left
            ],
            pressedKeys: new Set<string>(),
            previousTouchPos: new Vector2(),
            tileSelector: null!,
            selectedCellCoords: new Vector2(),
            highlightedCellCoords: new Vector2(),
            touchStartCoords: new Vector2(),
            touchHoveredCoords: new Vector2(),
            touchDragged: false,
            cursorOverUI: false,
            selectionInProgress: false,
            layers: {
                rails,
                trains,
                cars,
                buildings,
                conveyors
            },
            buildings: new Map<string, IBuildingInstance>(),
            selectedBuilding: null
        });

        gameMapState.instance = this.state;

        this.initMap();

        this.state.cameraRoot = engine.scene?.getObjectByName("camera-root")!;

        const camera = this.state.cameraRoot.getObjectByProperty("type", "OrthographicCamera") as OrthographicCamera;
        this.state.camera = camera;
        this.state.cameraPivot = this.state.camera.parent!;

        const light = this.state.cameraRoot.getObjectByProperty("type", "DirectionalLight") as DirectionalLight;
        this.state.light = light;
        light.shadow.camera.far = camera.far;

        const [, rotationY] = config.camera.rotation;
        this.state.cameraAngleRad = MathUtils.degToRad(rotationY);
        this.updateCameraSize();

        this.state.tileSelector = new TileSector();
        this.state.tileSelector.visible = false;
        root.add(this.state.tileSelector);

        railFactory.preload();

        this.onKeyUp = this.onKeyUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        document.addEventListener("keyup", this.onKeyUp);
        document.addEventListener("keydown", this.onKeyDown);
    }

    override dispose() {
        document.removeEventListener("keyup", this.onKeyUp);
        document.removeEventListener("keydown", this.onKeyDown);
        cmdHideUI.post("gamemap");
        conveyors.dispose();
        conveyorItems.dispose();
        gameMapState.instance = null;
        this.props.dispose();
    }

    override update(_owner: Object3D) {
        if (input.touchInside && !this.state.cursorOverUI) {
            const { width, height } = engine.screenRect;
            const touchPos = input.touchPos;
            // [0, s] to [-1, 1]
            const xNorm = (touchPos.x / width) * 2 - 1;
            const yNorm = (touchPos.y / height) * 2 - 1;
            this.checkCameraPan(xNorm, yNorm);

            if (!input.touchPos.equals(this.state.previousTouchPos)) {
                this.state.previousTouchPos.copy(input.touchPos);
                const cellCoords = pools.vec2.getOne();
                raycastOnCells(input.touchPos, this.state.camera, cellCoords);
                if (this.state.action) {
                    if (cellCoords?.equals(this.state.selectedCellCoords) === false) {
                        this.state.tileSelector.setPosition(cellCoords!);
                        this.state.selectedCellCoords.copy(cellCoords!);
                    }
                } else {
                    if (cellCoords?.equals(this.state.highlightedCellCoords) === false) {
                        this.state.highlightedCellCoords.copy(cellCoords!);
                    }
                }
            }
        }

        this.checkKeyboardCameraPan();

        if (input.wheelDelta !== 0) {
            const { zoomSpeed, zoomRange, orthoSize } = config.camera;
            const [min, max] = zoomRange;
            const newZoom = MathUtils.clamp(this.state.cameraZoom + input.wheelDelta * zoomSpeed, min, max);
            const deltaZoom = newZoom - this.state.cameraZoom;
            const { width, height } = engine.screenRect;
            // [0, s] to [-1, 1]
            const touchPos = input.touchPos;
            const [xNorm, yNorm] = [(touchPos.x / width) * 2 - 1, (touchPos.y / height) * 2 - 1];
            const aspect = width / height;
            const offsetX = orthoSize * aspect * xNorm * deltaZoom;
            const offsetY = orthoSize * aspect * yNorm * deltaZoom;
            const deltaPos = pools.vec3.getOne();
            deltaPos.set(-offsetX, 0, -offsetY).applyAxisAngle(GameUtils.vec3.up, this.state.cameraAngleRad);
            this.state.cameraRoot.position.add(deltaPos);
            this.state.cameraZoom = newZoom;
            this.updateCameraSize();
        }

        if (input.touchJustPressed) {
            if (!this.state.cursorOverUI) {
                if (this.state.action !== null) {
                    if (input.touchButton === 0) {
                        this.state.touchStartCoords.copy(this.state.selectedCellCoords);
                    }
                }
            }
        } else if (input.touchPressed) {

            if (input.touchButton === 0) {
                if (input.touchJustMoved) {
                    if (!this.state.cursorOverUI) {
                        if (this.state.action) {
                            const cellCoords = pools.vec2.getOne();
                            if (!this.state.touchDragged) {
                                const cell = raycastOnCells(input.touchPos, this.state.camera, cellCoords);
                                if (cell) {
                                    if (cellCoords?.equals(this.state.touchStartCoords) === false) {
                                        this.state.touchDragged = true;
                                        this.state.touchHoveredCoords.copy(cellCoords!);
                                        onBeginDrag(this.state.touchStartCoords, this.state.touchHoveredCoords);
                                    }
                                }
                            } else {
                                const cell = raycastOnCells(input.touchPos, this.state.camera, cellCoords);
                                if (cell) {
                                    if (cellCoords?.equals(this.state.touchHoveredCoords) === false) {
                                        this.state.touchHoveredCoords.copy(cellCoords!);
                                        onDrag(this.state.touchStartCoords, this.state.touchHoveredCoords);
                                    }
                                }
                            }
                        }
                    }
                }
            }

        } else if (input.touchJustReleased) {

            if (input.touchButton === 0) {
                const wasDragged = this.state.touchDragged;
                this.state.touchDragged = false;
                let canceled = false;

                if (this.state.cursorOverUI) {
                    if (wasDragged) {
                        onCancelDrag();
                    }
                    if (this.state.selectionInProgress) {
                        cmdEndSelection.post();
                        gameMapState.selectionInProgress = false;
                    }
                    canceled = true;
                }

                if (!canceled) {
                    if (this.state.action) {
                        if (wasDragged) {
                            onEndDrag();
                        } else {
                            onClick(0);
                        }
                    } else {

                        const flock = engineState.getComponents(Flock)[0];
                        const flockState = flock?.component.state;

                        if (this.state.selectionInProgress) {
                            cmdEndSelection.post();
                            gameMapState.selectionInProgress = false;

                        } else {

                            const { width, height } = engine.screenRect;
                            const normalizedPos = pools.vec2.getOne();
                            normalizedPos.set((input.touchPos.x / width) * 2 - 1, -(input.touchPos.y / height) * 2 + 1);
                            rayCaster.setFromCamera(normalizedPos, gameMapState.camera);

                            const intersections: Array<{
                                unit?: IUnit;
                                building?: IBuildingInstance;
                                distance: number;
                            }> = [];

                            if (flockState) {
                                const { units } = unitUtils;
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

                                for (const [, building] of this.state.buildings) {
                                    inverseMatrix.copy(building.obj.matrixWorld).invert();
                                    localRay.copy(rayCaster.ray).applyMatrix4(inverseMatrix);
                                    const buildingId = building.buildingId;
                                    const boundingBox = buildings.getBoundingBox(buildingId);
                                    if (localRay.intersectBox(boundingBox, intersection)) {
                                        intersections.push({ building, distance: localRay.origin.distanceTo(intersection) });
                                    }
                                }
                            }

                            if (intersections.length > 0) {
                                intersections.sort((a, b) => a.distance - b.distance);

                                const { unit, building } = intersections[0];
                                if (unit) {
                                    flockState!.selectedUnits = [unit];
                                    this.state.selectedBuilding = null;
                                    cmdSetSelectedElems.post({ units: flockState.selectedUnits });

                                } else if (building) {
                                    if (flockState && flockState.selectedUnits.length > 0) {
                                        flockState.selectedUnits.length = 0;
                                    }
                                    this.state.selectedBuilding = building;

                                    cmdSetSelectedElems.post({ building });
                                }

                            } else {

                                if (flockState && flockState.selectedUnits.length > 0) {
                                    flockState.selectedUnits.length = 0;
                                }

                                this.state.selectedBuilding = null;
                                const cell = GameUtils.getCell(this.state.highlightedCellCoords);
                                if (cell?.conveyor) {
                                    // cmdSetSelectedElems.post({ conveyor: this.state.highlightedCellCoords.clone() });
                                    conveyorItems.addItem(cell, this.state.highlightedCellCoords);

                                } else {
                                    cmdSetSelectedElems.post({});
                                }
                            }
                        }

                    }
                }
            } else if (input.touchButton === 2) {

                if (this.state.action) {
                    onClick(2);
                } else {
                    const flock = engineState.getComponents(Flock)[0];
                    const flockState = flock?.component.state;
                    if (flockState) {
                        if (flockState.selectedUnits.length > 0) {
                            const [targetCellCoords, targetSectorCoords] = pools.vec2.get(2);
                            const targetCell = raycastOnCells(input.touchPos, gameMapState.camera, targetCellCoords, targetSectorCoords);
                            if (targetCell) {
                                // group units per sector
                                const groups = flockState.selectedUnits.reduce((prev, cur) => {
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
                                    unitMotion.move(units, targetSectorCoords, targetCellCoords, targetCell);
                                }
                            }
                        }
                    }
                }

            }
        }

        conveyors.update();
    }    

    public initMap() {
        this.createSectors();

        // water
        const water = utils.createObject(engine.scene!, "water");
        water.matrixAutoUpdate = false;
        water.matrixWorldAutoUpdate = false;
        water.position.setY(-.75);
        water.updateMatrix();
        engineState.setComponent(water, new Water({ sectorRes: this.props.size }));

        // env props
        const props = utils.createObject(engine.scene!, "env-props");
        engineState.setComponent(props, new EnvProps({ sectorRes: this.props.size }));

        fogOfWar.init(this.props.size);
        const { mapRes } = config.game;
        cmdFogAddCircle.post({ mapCoords: new Vector2(mapRes / 2, mapRes / 2), radius: mapRes / 2 });

        const trees = utils.createObject(engine.scene!, "trees");
        const treesComponent = new Trees({ sectorRes: this.props.size });        
        engineState.setComponent(trees, treesComponent);

        const flocks = engineState.getComponents(Flock);
        const flock = flocks[0];

        Promise.all([
            // treesComponent.load(trees),
            flock.component.props.active ? flock.component.load(flock.owner) : Promise.resolve(),
            buildings.preload(),
            conveyors.preload(),
            conveyorItems.preload()
        ]).then(() => {
            cmdShowUI.post("gamemap");
        });
    }

    public createSectors() {
        if (this.state.sectors.size > 0) {
            this.disposeSectors();
        }

        const size = this.props.size;
        for (let i = 0; i < size; ++i) {
            for (let j = 0; j < size; ++j) {
                createSector(new Vector2(j, i));
            }
        }
    }

    public setCameraPos(pos: Vector3) {
        this.state.cameraRoot.position.copy(pos);
        updateCameraBounds();
    }

    public spawnUnitRequest() {
        const { selectedBuilding } = this.state;
        console.assert(selectedBuilding);
        const flock = engineState.getComponents(Flock)[0];
        flock.component.spawnUnitRequest(selectedBuilding!);
    }

    private disposeSectors() {
        const { sectors } = this.state;
        for (const sector of sectors.values()) {
            const { root } = sector;
            root.removeFromParent();
            root.traverse((obj) => {
                utils.disposeObject(obj);
            });
        }
        sectors.clear();
    }

    private checkCameraPan(xNorm: number, yNorm: number) {

        if (this.state.selectionInProgress) {
            return;
        }

        const { width, height } = engine.screenRect;
        const dt = time.deltaTime;
        const { panMargin, panSpeed } = config.camera;
        const margin = 50;
        const [delta, oldPos] = pools.vec3.get(2);
        if (Math.abs(xNorm) > 1 - panMargin) {
            const dx = xNorm * dt * panSpeed * this.state.cameraZoom;
            delta.set(dx, 0, 0).applyAxisAngle(GameUtils.vec3.up, this.state.cameraAngleRad);
            oldPos.copy(this.state.cameraRoot.position);
            this.state.cameraRoot.position.add(delta);
            updateCameraBounds();
            const [_, rightAccessor, __, leftAccessor] = this.state.cameraBoundsAccessors;
            const rightBound = this.state.cameraBounds[rightAccessor];
            const leftBound = this.state.cameraBounds[leftAccessor];
            const { x: leftX } = leftBound;
            const { x: rightX } = rightBound;
            if (dx < 0) {
                if (leftX > 0) {
                    if (rightX > width - margin) {
                        this.state.cameraRoot.position.copy(oldPos);
                        updateCameraBounds();
                    }
                }
            } else {
                if (rightX < width) {
                    if (leftX < margin) {
                        this.state.cameraRoot.position.copy(oldPos);
                        updateCameraBounds();
                    }
                }
            }
        }
        if (Math.abs(yNorm) > 1 - panMargin) {
            const aspect = width / height;
            const dy = yNorm * aspect * dt * panSpeed * this.state.cameraZoom;
            delta.set(0, 0, dy).applyAxisAngle(GameUtils.vec3.up, this.state.cameraAngleRad);
            oldPos.copy(this.state.cameraRoot.position);
            this.state.cameraRoot.position.add(delta);
            updateCameraBounds();
            const [topAcecssor, _, bottomAccessor] = this.state.cameraBoundsAccessors;
            const topBound = this.state.cameraBounds[topAcecssor];
            const bottomBound = this.state.cameraBounds[bottomAccessor];
            const { y: topY } = topBound;
            const { y: bottomY } = bottomBound;
            if (dy < 0) {
                if (topY > 0) {
                    if (bottomY > height - margin) {
                        this.state.cameraRoot.position.copy(oldPos);
                        updateCameraBounds();
                    }
                }
            } else {
                if (bottomY < height) {
                    if (topY < margin) {
                        this.state.cameraRoot.position.copy(oldPos);
                        updateCameraBounds();
                    }
                }
            }
        }
    }

    private checkKeyboardCameraPan() {
        let xNorm = 0;
        let yNorm = 0;
        let keyboardPan = false;
        if (this.state.pressedKeys.has("a")) {
            xNorm = -1;
            keyboardPan = true;
        } else if (this.state.pressedKeys.has("d")) {
            xNorm = 1;
            keyboardPan = true;
        }
        if (this.state.pressedKeys.has("w")) {
            yNorm = -1;
            keyboardPan = true;
        } else if (this.state.pressedKeys.has("s")) {
            yNorm = 1;
            keyboardPan = true;
        }
        if (keyboardPan) {
            this.checkCameraPan(xNorm, yNorm);
        }
    }
    

    private onKeyDown(e: KeyboardEvent) {
        const key = e.key.toLowerCase();
        this.state.pressedKeys.add(key);
    }

    private onKeyUp(e: KeyboardEvent) {
        let cameraDirection = 0;
        const key = e.key.toLowerCase();

        switch (key) {
            case 'q': cameraDirection = -1; break;
            case 'e': cameraDirection = 1; break;
        }
        if (cameraDirection !== 0 && !this.state.cameraTween) {
            this.state.cameraTween = gsap.to(this.state,
                {
                    cameraAngleRad: this.state.cameraAngleRad + Math.PI / 2 * cameraDirection,
                    duration: .45,
                    ease: "power2.out",
                    onUpdate: () => {
                        const [rotationX] = config.camera.rotation;
                        this.state.cameraPivot.setRotationFromEuler(new Euler(MathUtils.degToRad(rotationX), this.state.cameraAngleRad, 0, 'YXZ'));
                        cmdRotateMinimap.post(MathUtils.radToDeg(this.state.cameraAngleRad));
                    },
                    onComplete: () => {
                        this.state.cameraTween = null;

                        // rotate camera bounds
                        const length = this.state.cameraBoundsAccessors.length;
                        this.state.cameraBoundsAccessors = this.state.cameraBoundsAccessors.map((_, index) => {
                            if (cameraDirection < 0) {
                                return this.state.cameraBoundsAccessors[(index + 1) % length];
                            } else {
                                if (index === 0) {
                                    return this.state.cameraBoundsAccessors[length - 1];
                                } else {
                                    return this.state.cameraBoundsAccessors[index - 1];
                                }
                            }
                        });
                    }
                });
        }

        this.state.pressedKeys.delete(key);
    }

    private updateCameraSize() {
        const { width, height } = engine.screenRect;
        const aspect = width / height;
        const { orthoSize, shadowRange } = config.camera;

        const orthoCamera = (this.state.camera as OrthographicCamera);
        orthoCamera.zoom = 1 / this.state.cameraZoom;
        // const zoom = this.state.cameraZoom;
        // orthoCamera.left = -orthoSize * aspect * zoom;
        // orthoCamera.right = orthoSize * aspect * zoom;
        // orthoCamera.top = orthoSize * zoom;
        // orthoCamera.bottom = -orthoSize * zoom;
        orthoCamera.updateProjectionMatrix();

        updateCameraBounds();
        const cameraLeft = -orthoSize * this.state.cameraZoom * aspect;
        const _shadowRange = Math.max(Math.abs(cameraLeft) * shadowRange, 10);
        this.state.light.shadow.camera.left = -_shadowRange;
        this.state.light.shadow.camera.right = _shadowRange;
        this.state.light.shadow.camera.top = _shadowRange;
        this.state.light.shadow.camera.bottom = -_shadowRange;
        this.state.light.shadow.camera.updateProjectionMatrix();
    }
}

