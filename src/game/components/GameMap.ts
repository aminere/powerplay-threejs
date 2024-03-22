import { DirectionalLight, Euler, MathUtils,  Object3D, OrthographicCamera, Vector2, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component"
import { config } from "../config";
import { engine } from "../../engine/Engine";
import { IGameMapState, gameMapState } from "./GameMapState";
import { TileSector } from "../TileSelector";
import { cmdFogAddCircle, cmdHideUI, cmdRotateMinimap, cmdSetSelectedElems, cmdShowUI } from "../../Events";
import { createSector, updateCameraBounds, updateCameraSize } from "../GameMapUtils";
import { railFactory } from "../RailFactory";
import { utils } from "../../engine/Utils";
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
import { conveyors } from "../Conveyors";
import { conveyorItems } from "../ConveyorItems";
import { unitUtils } from "../unit/UnitUtils";
import { GameMapUpdate } from "./GameMapUpdate";

export class GameMap extends Component<GameMapProps, IGameMapState> {

    constructor(props?: Partial<GameMapProps>) {
        super(new GameMapProps(props));
    }

    override start(owner: Object3D) {

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

        this.state.cameraRoot = engine.scene?.getObjectByName("camera-root")!;

        const camera = this.state.cameraRoot.getObjectByProperty("type", "OrthographicCamera") as OrthographicCamera;
        this.state.camera = camera;
        this.state.cameraPivot = this.state.camera.parent!;

        const light = this.state.cameraRoot.getObjectByProperty("type", "DirectionalLight") as DirectionalLight;
        this.state.light = light;
        light.shadow.camera.far = camera.far;

        const [, rotationY] = config.camera.rotation;
        this.state.cameraAngleRad = MathUtils.degToRad(rotationY);

        this.state.tileSelector = new TileSector();
        this.state.tileSelector.visible = false;
        root.add(this.state.tileSelector);

        railFactory.preload();

        this.onKeyUp = this.onKeyUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        document.addEventListener("keyup", this.onKeyUp);
        document.addEventListener("keydown", this.onKeyDown);

        if (this.props.initSelf) {
            this.createSectors();
            this.preload(this.props.size)
                .then(() => this.init(this.props.size))
                .then(() => engineState.setComponent(owner, new GameMapUpdate()));
        }
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

    public async preload(size: number) {
        await buildings.preload();
        await conveyors.preload();

        const flocks = engineState.getComponents(Flock);
        const flock = flocks[0];
        if (flock.component.props.active) {
            await flock.component.load(flock.owner);
        }

        fogOfWar.init(size);
        const { mapRes } = config.game;
        cmdFogAddCircle.post({ mapCoords: new Vector2(mapRes / 2, mapRes / 2), radius: mapRes / 2 });
    }

    public init(size: number) {
        this.state.sectorRes = size;

        // water
        const water = utils.createObject(engine.scene!, "water");
        water.matrixAutoUpdate = false;
        water.matrixWorldAutoUpdate = false;
        water.position.setY(-.75);
        water.updateMatrix();
        engineState.setComponent(water, new Water({ sectorRes: size }));

        // env props
        const props = utils.createObject(engine.scene!, "env-props");
        engineState.setComponent(props, new EnvProps({ sectorRes: size }));

        const trees = utils.createObject(engine.scene!, "trees");
        const treesComponent = new Trees({ sectorRes: size });        
        engineState.setComponent(trees, treesComponent);

        Promise.all([
            // treesComponent.load(trees),
            conveyorItems.preload()
        ]).then(() => {
            cmdShowUI.post("gamemap");
        });

        updateCameraSize();
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

            case "delete": {
                const flock = engineState.getComponents(Flock)[0];
                const { selectedUnits } = flock.component.state;
                if (selectedUnits.length > 0) {
                    for (const unit of selectedUnits) {
                        unitUtils.kill(unit);
                    }
                    selectedUnits.length = 0;
                    cmdSetSelectedElems.post({ units: selectedUnits });
                }
            }
                break;
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
}

