
import { BufferAttribute, BufferGeometry, Euler, MathUtils, Mesh, Object3D, Vector2, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { ISerializedAssembly, ISerializedFactory, ISerializedGameMap, TSerializedBuilding } from "../GameSerialization";
import { utils } from "../../engine/Utils";
import { engineState } from "../../engine/EngineState";
import { resources } from "../Resources";
import { config } from "../config/config";
import { buildings } from "../buildings/Buildings";
import { GameUtils } from "../GameUtils";
import { createSector, createSectors, setCameraPos, updateCameraSize } from "../GameMapUtils";
import { conveyors } from "../Conveyors";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { GameMapProps } from "./GameMapProps";
import { conveyorItems } from "../ConveyorItems";
import { trees } from "../Trees";
import { railFactory } from "../RailFactory";
import { fogOfWar } from "../FogOfWar";
import { cmdFogAddCircle, cmdOpenInGameMenu, cmdRenderUI, cmdRotateMinimap, cmdShowUI } from "../../Events";
import { engine } from "../../engine/Engine";
import { EnvProps } from "./EnvProps";
import { GameMapUpdate } from "./GameMapUpdate";
import gsap from "gsap";
import { Rails } from "../Rails";
import { ICell } from "../GameTypes";
import { UnitType } from "../GameDefinitions";
import { objects } from "../../engine/resources/Objects";
import { meshes } from "../../powerplay";
import { Mines } from "../buildings/Mines";
import { depots } from "../buildings/Depots";
import { BuildingType } from "../buildings/BuildingTypes";
import { Incubators } from "../buildings/Incubators";
import { Factories } from "../buildings/Factories";
import { Assemblies } from "../buildings/Assemblies";
import { Tutorial } from "./Tutorial";
import { Sandbox } from "./Sandbox";

const sectorCoords = new Vector2();
const localCoords = new Vector2();
const mapCoords = new Vector2();
const root = () => engine.scene!;

export class GameMapLoaderProps extends ComponentProps {

    path = "";
    fromLocalStorage = false;

    constructor(props?: Partial<GameMapLoaderProps>) {
        super();
        this.deserialize(props);
    }
}

const { mapRes, cellSize } = config.game;
function calcLocalCoords(cellIndex: number, localCoordsOut: Vector2) {
    const cellY = Math.floor(cellIndex / mapRes);
    const cellX = cellIndex - cellY * mapRes;
    localCoordsOut.set(cellX, cellY);
}

async function loadData(path: string, fromLocalStorage: boolean) {
    if (fromLocalStorage) {
        const dataStr = localStorage.getItem(`gameMap_${path}`)!;
        const data = JSON.parse(dataStr) as ISerializedGameMap;
        return data;
    } else {
        const response = await fetch(`/scenes/${path}.json`);
        const data = await response.json() as ISerializedGameMap;
        return data;
    }
}

async function preloadAnimations() {
    const anims = await objects.load("prefabs/animations.json");
    anims.traverse(child => engineState.registerAnimations(child));
    root().add(anims);
}

function createBuildings(instances: TSerializedBuilding[], creator: (sectorCoords: Vector2, localCoords: Vector2, instance?: TSerializedBuilding) => void) {
    for (const instance of instances) {
        GameUtils.getCell(instance.mapCoords, sectorCoords, localCoords);
        creator(sectorCoords, localCoords, instance);
    }
}

export class GameMapLoader extends Component<GameMapLoaderProps, GameMapState> {
    constructor(props?: Partial<GameMapLoaderProps>) {
        super(new GameMapLoaderProps(props));
    }

    override start(owner: Object3D) {
        this.setState(new GameMapState());
        this.onKeyUp = this.onKeyUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);

        if (this.props.path.length > 0) {
            this.load(owner);
        } else {
            const sectorRes = GameMapProps.instance.size;
            createSectors(sectorRes);
            this.preload()
                .then(() => {
                    trees.init(sectorRes);
                    this.init(sectorRes, GameUtils.vec3.zero, owner)
                });
        }
    }

    private async load(owner: Object3D) {

        const data = await loadData(this.props.path, this.props.fromLocalStorage);

        await this.preload();

        trees.init(data.size);
 
        const unitsToSpawn = new Map<Vector2, UnitType[]>();
        for (const sector of data.sectors) {

            const [x, y] = sector.key.split(",").map(i => parseInt(i));
            if (x < 0 || y < 0) {
                continue;
            }

            sectorCoords.set(x, y);

            const sectorInstance = (() => {
                const instance = this.state.sectors.get(sector.key);
                return instance ?? createSector(sectorCoords);
            })();

            const geometry = (sectorInstance.layers.terrain as Mesh).geometry as BufferGeometry;
            const position = geometry.getAttribute("position") as BufferAttribute;
            for (const elevation of sector.elevation) {
                position.setY(elevation.vertexIndex, elevation.height);
            }

            for (let i = 0; i < sector.cells.length; i++) {
                const cell = sector.cells[i];
                const cellInstance = sectorInstance.cells[cell.index];
                if (cell.roadTile) {
                    cellInstance.roadTile = cell.roadTile;
                    sectorInstance.textureData.terrain.set([cell.roadTile!], cell.index);
                }

                calcLocalCoords(cell.index, localCoords);
                mapCoords.set(sectorCoords.x * mapRes + localCoords.x, sectorCoords.y * mapRes + localCoords.y);

                if (cell.resource) {
                    resources.create(sectorInstance, sectorCoords, localCoords, cellInstance, cell.resource);
                }

                if (cell.units !== undefined) {
                    unitsToSpawn.set(mapCoords.clone(), cell.units);
                }

                if (cell.conveyor) {
                    const { direction, startAxis, endAxis } = cell.conveyor;
                    const _direction = new Vector2(direction.x, direction.y);
                    conveyors.create(cellInstance, mapCoords, _direction, startAxis, endAxis);
                }
            }            
        }

        this.init(data.size, data.cameraPos, owner);

        // create units and structure after all sectors are created and fogOfWar is initialized
        for (const [coords, units] of unitsToSpawn) {
            for (const unit of units) {
                unitsManager.spawn(coords, unit);
            }
        }

        for (const [type, instances] of Object.entries(data.buildings)) {
            const buildingType = type as BuildingType;
            switch (buildingType) {
                case "mine":
                    createBuildings(instances, (sectorCoords, localCoords) => Mines.create(sectorCoords, localCoords));
                break;

                case "factory":
                    createBuildings(instances, (sectorCoords, localCoords, instance) => {
                        const factory = instance as ISerializedFactory;
                        Factories.create(sectorCoords, localCoords, factory.output);
                    });           
                    break;

                case "depot":
                    createBuildings(instances, (sectorCoords, localCoords) => depots.create(sectorCoords, localCoords));
                    break;

                case "incubator":
                    createBuildings(instances, (sectorCoords, localCoords) => Incubators.create(sectorCoords, localCoords));
                    break;
                
                case "assembly": {
                    createBuildings(instances, (sectorCoords, localCoords, instance) => {
                        const assembly = instance as ISerializedAssembly;
                        Assemblies.create(sectorCoords, localCoords, assembly.output);
                    });
                }
                    break;

                default:
                    createBuildings(instances, (sectorCoords, localCoords) => buildings.create(buildingType, sectorCoords, localCoords));                                    
            }
        }

        // load rails
        const railCells: ICell[] = [];
        for (const rail of data.rails) {
            const startCoords = new Vector2(rail.startCoords.x, rail.startCoords.y);
            const endCoords = rail.endCoords ? new Vector2(rail.endCoords.x, rail.endCoords.y) : undefined;
            const startCell = Rails.create(
                rail.config,
                startCoords,
                rail.startAxis,
                endCoords,
                rail.endAxis
            );
            if (startCell) {
                railCells.push(startCell);
            }
        }
        for (const cell of railCells) {
            Rails.tryLinkRails(cell);
        }
    }

    private async preload() {
        await buildings.preload();
        await conveyors.preload();
        await conveyorItems.preload();
        await trees.preload();
        await railFactory.preload();
        await preloadAnimations();
        await unitsManager.preload();
        // other resources are loaded on demand
        await meshes.load(`/models/resources/wood.glb`);
        await meshes.load(`/models/resources/water.glb`);
        await meshes.load(`/models/resources/oil.glb`);
        await meshes.load(`/models/buildings/incubator-glass.glb`);
    }

    private init(size: number, _cameraPos: Vector3, owner: Object3D) {
        this.state.sectorRes = size;

        // const water = utils.createObject(root(), "water");
        // water.matrixAutoUpdate = false;
        // water.matrixWorldAutoUpdate = false;
        // water.position.setY(-.2);
        // water.updateMatrix();
        // engineState.setComponent(water, new Water({ sectorRes: size }));

        const props = utils.createObject(root(), "env-props");
        engineState.setComponent(props, new EnvProps({ sectorRes: size }));

        unitsManager.owner = owner;
        updateCameraSize();

        const cameraPos = _cameraPos ?? GameUtils.vec3.zero;
        setCameraPos(cameraPos);        

        document.addEventListener("keyup", this.onKeyUp);
        document.addEventListener("keydown", this.onKeyDown);
        cmdShowUI.post("gamemap");

        const updator = utils.createObject(root(), "GameMapUpdate");
        engineState.setComponent(updator, new GameMapUpdate());

        if (this.props.path.includes("tutorial")) {
            engineState.setComponent(updator, new Tutorial());
        } else if (this.props.path.includes("sandbox")) {
            engineState.setComponent(updator, new Sandbox());
        }

        fogOfWar.init(size);

        // reveal wherever the camera is
        // cameraPos = (mapCoords - (mapRes / 2)) * cellSize;
        // mapCoords = (cameraPos / cellSize) + mapRes / 2;
        const cellX = Math.round((cameraPos.x / cellSize) + mapRes / 2);
        const cellY = Math.round((cameraPos.z / cellSize) + mapRes / 2);
        cmdFogAddCircle.post({ mapCoords: new Vector2(cellX, cellY), radius: Math.round(mapRes / 1.5) });        

        // TODO remove
        // if (false) {
        //     meshes.load(`/models/resources/ak47.glb`).then(() => {
        //         const solider = unitsManager.units.find(u => u.type === "worker")!;
        //         Workers.pickResource(solider as ICharacterUnit, "ak47");
        //         unitAnimation.setAnimation(solider as ICharacterUnit, "idle");
        //     });
        // }
    }

    override dispose() {
        if (!this.state) {
            return;
        }

        document.removeEventListener("keyup", this.onKeyUp);
        document.removeEventListener("keydown", this.onKeyDown);

        cmdRenderUI.detach();
        cmdShowUI.post(null);
        conveyors.dispose();
        conveyorItems.dispose();
        trees.dispose();
        unitsManager.dispose();
        fogOfWar.dispose();
        this.state.dispose();
        GameUtils.clearCellCache();
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
            case "k": unitsManager.killSelection(); break;
            case 'escape': {
                if (this.state.action) {
                    this.state.action = null;
                } else {
                    cmdOpenInGameMenu.post(!this.state.inGameMenuOpen);
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

