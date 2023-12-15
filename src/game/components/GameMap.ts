import { Box2, Camera, Color, DirectionalLight, Euler, MathUtils, Object3D, OrthographicCamera, Vector2, Vector3 } from "three";
import { Component } from "../../engine/Component"
import { Sector } from "../Sector";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { input } from "../../engine/Input";
import { engine } from "../../engine/Engine";
import { pools } from "../../engine/Pools";
import { IGameMapState, gameMapState } from "./GameMapState";
import { TileSector } from "../TileSelector";
import { cmdHideUI, cmdShowUI, evtCursorOverUI } from "../../Events";
import { onBeginDrag, onBuilding, onCancelDrag, onDrag, onElevation, onEndDrag, onMineral, onRoad, onTerrain, onTree, raycastOnCells } from "./GameMapUtils";
import { railFactory } from "../RailFactory";
import { utils } from "../../engine/Utils";
import { Train } from "./Train";
import { Car } from "./Car";
import { time } from "../../engine/Time";
import gsap from "gsap";
import { GameMapProps } from "./GameMapProps";
import { engineState } from "../../engine/EngineState";

export class GameMap extends Component<GameMapProps, IGameMapState> {

    constructor(props?: Partial<GameMapProps>) {
        super(new GameMapProps(props));
    }

    override start(owner: Object3D) {

        const rails = new Object3D();
        rails.name = "rails";
        const trains = new Object3D();
        trains.name = "trains";
        const cars = new Object3D();
        cars.name = "cars";
        owner.add(rails);
        owner.add(trains);
        owner.add(cars);

        this.setState({
            sectors: new Map<string, any>(),
            action: null,
            previousRoad: [],
            previousRail: [],
            owner,
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
            touchStartCoords: new Vector2(),
            touchHoveredCoords: new Vector2(),
            touchDragged: false,
            cursorOverUI: false,
            layers: {
                rails,
                trains,
                cars
            }            
        });
        
        gameMapState.instance = this.state;        
        this.createSector(new Vector2(0, 0));
        this.state.cameraRoot = engine.scene?.getObjectByName("camera-root")!;
        this.state.camera = this.state.cameraRoot.getObjectByProperty("type", "OrthographicCamera") as Camera;
        this.state.cameraPivot = this.state.camera.parent!;
        this.state.light = this.state.cameraRoot.getObjectByProperty("type", "DirectionalLight") as DirectionalLight;
        const [, rotationY] = config.camera.rotation;
        this.state.cameraAngleRad = MathUtils.degToRad(rotationY);
        this.updateCameraSize();

        this.state.tileSelector = new TileSector();
        this.state.tileSelector.visible = false;
        owner.parent!.add(this.state.tileSelector);

        this.onKeyUp = this.onKeyUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onCursorOverUI = this.onCursorOverUI.bind(this);
        document.addEventListener("keyup", this.onKeyUp);
        document.addEventListener("keydown", this.onKeyDown);
        evtCursorOverUI.attach(this.onCursorOverUI);
        cmdShowUI.post("gamemap");
        railFactory.preload();
    }

    override dispose() {
        document.removeEventListener("keyup", this.onKeyUp);
        document.removeEventListener("keydown", this.onKeyDown);
        evtCursorOverUI.detach(this.onCursorOverUI);
        cmdHideUI.post("gamemap");
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

                if (this.state.action) {
                    const cellCoords = raycastOnCells(input.touchPos, this.state.camera);
                    if (cellCoords?.equals(this.state.selectedCellCoords) === false) {
                        this.state.tileSelector.setPosition(cellCoords!);
                        this.state.selectedCellCoords.copy(cellCoords!);                        
                        // default rail preview was here                        
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
            if (input.touchJustMoved) {
                if (!this.state.cursorOverUI) {
                    if (this.state.action) {
                        if (!this.state.touchDragged) {
                            const cellCoords = raycastOnCells(input.touchPos, this.state.camera);
                            if (cellCoords?.equals(this.state.touchStartCoords) === false) {
                                this.state.touchDragged = true;
                                this.state.touchHoveredCoords.copy(cellCoords!);
                                onBeginDrag(this.state.touchStartCoords, this.state.touchHoveredCoords, this.props);
                            }
                        } else {
                            const cellCoords = raycastOnCells(input.touchPos, this.state.camera);
                            if (cellCoords?.equals(this.state.touchHoveredCoords) === false) {
                                this.state.touchHoveredCoords.copy(cellCoords!);
                                onDrag(this.state.touchStartCoords, this.state.touchHoveredCoords, this.props);
                            }
                        }
                    }
                }
            }
        } else if (input.touchJustReleased) {
            const wasDragged = this.state.touchDragged;
            this.state.touchDragged = false;
            let canceled = false;

            if (this.state.cursorOverUI) {
                if (wasDragged) {
                    onCancelDrag();                    
                }
                canceled = true;           
            }

            if (!canceled) {
                if (this.state.action) {
                    if (!wasDragged) {
                        
                        const [sectorCoords, localCoords] = pools.vec2.get(2);
                        const cell = GameUtils.getCell(this.state.selectedCellCoords, sectorCoords, localCoords);
                        if (!cell) {
                            this.createSector(sectorCoords.clone());
                            this.updateCameraBounds();                    
                        } else {
                            const mapCoords = this.state.selectedCellCoords;
                            const { radius } = this.state.tileSelector;
                            switch (this.state.action) {
                                case "elevation": {
                                    onElevation(mapCoords, sectorCoords, localCoords, radius, input.touchButton);
                                    this.state.tileSelector.fit(mapCoords);       
                                }
                                break;

                                case "terrain": {
                                    onTerrain(mapCoords, this.props.tileType);
                                }
                                break;
        
                                case "road": {
                                    onRoad(mapCoords, cell, input.touchButton);
                                }
                                break;
        
                                case "building": {
                                    onBuilding(sectorCoords, localCoords, cell, input.touchButton);
                                }
                                break;

                                case "mineral": {
                                    onMineral(sectorCoords, localCoords, cell, input.touchButton);
                                }
                                break;

                                case "tree": {
                                    onTree(sectorCoords, localCoords, cell, input.touchButton);
                                }
                                break;
        
                                case "car": {                                    
                                    if (input.touchButton === 0) {
                                        if (!cell.unit) {
                                            const { sectors, layers } = this.state;
                                            const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
                                            
                                            const car = utils.createObject(layers.cars, "car");
                                            engineState.setComponent(car, new Car({
                                                coords: this.state.selectedCellCoords.clone()
                                            }));
            
                                            Sector.updateHighlightTexture(sector, localCoords, new Color(0xff0000));
                                            cell.unit = car;
                                        }
        
                                    } else if (input.touchButton === 2) {
                                        const cars = engineState.getComponents(Car);
                                        if (cars) {
                                            for (const car of cars) {
                                                // car.entity.setComponent(GroupMotion, {
                                                //     motion: groupMotion
                                                // });                             
                                                car.component.goTo(this.state.selectedCellCoords);
                                            }
                                        }

                                    } else if (input.touchButton === 1) {
                                        console.log(cell);
                                        // console.log(Components.ofType(Car)?.filter(c => c.coords.equals(this._selectedCellCoords)));                                        
                                    }
                                }
                                    break;
        
                                case "train": {
                                    if (input.touchButton === 0) {
                                        if (cell.rail) {
                                            const { layers } = this.state;
                                            const wagonLength = 2;
                                            const numWagons = 4;
                                            const gap = .3;                                            
                                            const train = utils.createObject(layers.trains, "train");
                                            engineState.setComponent(train, new Train({
                                                cell,
                                                wagonLength,
                                                numWagons,
                                                gap
                                            }));
                                        }
                                    }
                                }
                                break;
                            }
                        }                        
                    } else {
                        onEndDrag();
                    }
                } 
            }
        }
    }    

    public createSector(coords: Vector2) {
        const sectorRoot = Sector.create(coords, this.state.owner);

        // update bounds
        const { mapRes, cellSize } = config.game;
        const mapSize = mapRes * cellSize;
        const [min, max] = pools.vec2.get(2);
        min.set(sectorRoot.position.x, sectorRoot.position.z);
        max.set(min.x + mapSize, min.y + mapSize);
        const { bounds } = this.state;
        if (!bounds) {
            this.state.bounds = new Box2(min.clone(), max.clone());
        } else {
            bounds.expandByPoint(min);
            bounds.expandByPoint(max);
        }
    }

    private checkCameraPan(xNorm: number, yNorm: number) {
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
            this.updateCameraBounds();
            const [_, rightAccessor, __, leftAccessor] = this.state.cameraBoundsAccessors;
            const rightBound = this.state.cameraBounds[rightAccessor];
            const leftBound = this.state.cameraBounds[leftAccessor];
            const { x: leftX } = leftBound;
            const { x: rightX } = rightBound;
            if (dx < 0) {
                if (leftX > 0) {
                    if (rightX > width - margin) {
                        this.state.cameraRoot.position.copy(oldPos);
                        this.updateCameraBounds();
                    }
                }
            } else {
                if (rightX < width) {
                    if (leftX < margin) {
                        this.state.cameraRoot.position.copy(oldPos);
                        this.updateCameraBounds();
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
            this.updateCameraBounds();
            const [topAcecssor, _, bottomAccessor] = this.state.cameraBoundsAccessors;
            const topBound = this.state.cameraBounds[topAcecssor];
            const bottomBound = this.state.cameraBounds[bottomAccessor];
            const { y: topY } = topBound;
            const { y: bottomY } = bottomBound;
            if (dy < 0) {
                if (topY > 0) {
                    if (bottomY > height - margin) {
                        this.state.cameraRoot.position.copy(oldPos);
                        this.updateCameraBounds();
                    }
                }
            } else {
                if (bottomY < height) {
                    if (topY < margin) {
                        this.state.cameraRoot.position.copy(oldPos);
                        this.updateCameraBounds();
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

    private updateCameraBounds() {
        const worldPos = pools.vec3.getOne();
        const [top, right, bottom, left] = this.state.cameraBounds;
        const mapBounds = this.state.bounds;
        GameUtils.worldToScreen(worldPos.set(mapBounds!.min.x, 0, mapBounds!.min.y), this.state.camera, top);
        GameUtils.worldToScreen(worldPos.set(mapBounds!.max.x, 0, mapBounds!.max.y), this.state.camera, bottom);
        GameUtils.worldToScreen(worldPos.set(mapBounds!.min.x, 0, mapBounds!.max.y), this.state.camera, left);
        GameUtils.worldToScreen(worldPos.set(mapBounds!.max.x, 0, mapBounds!.min.y), this.state.camera, right);
        utils.updateDirectionalLightTarget(this.state.light);
    }

    private onKeyDown(e: KeyboardEvent) {
        this.state.pressedKeys.add(e.key);
    }

    private onKeyUp(e: KeyboardEvent) {
        let cameraDirection = 0;
        switch (e.key) {
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

        this.state.pressedKeys.delete(e.key);
    }

    private updateCameraSize() {
        const { width, height } = engine.screenRect;        
        const aspect = width / height;
        const { orthoSize, shadowRange } = config.camera;
        (this.state.camera as OrthographicCamera).zoom = 1 / this.state.cameraZoom;
        (this.state.camera as OrthographicCamera).updateProjectionMatrix();
        this.updateCameraBounds();
        const cameraLeft = -orthoSize * this.state.cameraZoom * aspect;
        const _shadowRange = Math.max(Math.abs(cameraLeft) * shadowRange, 10);
        this.state.light.shadow.camera.left = -_shadowRange;
        this.state.light.shadow.camera.right = _shadowRange;
        this.state.light.shadow.camera.top = _shadowRange;
        this.state.light.shadow.camera.bottom = -_shadowRange;
        this.state.light.shadow.camera.updateProjectionMatrix();
    }

    private onCursorOverUI(over: boolean) {
        this.state.cursorOverUI = over;
        if (this.state.action) {
            this.state.tileSelector.visible = !over;
        }
    }
}

