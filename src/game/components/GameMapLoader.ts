
import { BufferAttribute, BufferGeometry, Euler, MathUtils, Mesh, Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { ISerializedFactory, ISerializedGameMap } from "../GameSerialization";
import { utils } from "../../engine/Utils";
import { engineState } from "../../engine/EngineState";
import { resources } from "../Resources";
import { config } from "../config";
import { buildings } from "../buildings/Buildings";
import { GameUtils } from "../GameUtils";
import { createSector, createSectors, updateCameraSize } from "../GameMapUtils";
import { conveyors } from "../Conveyors";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { GameMapProps } from "./GameMapProps";
import { conveyorItems } from "../ConveyorItems";
import { trees } from "../Trees";
import { railFactory } from "../RailFactory";
import { fogOfWar } from "../FogOfWar";
import { cmdFogAddCircle, cmdHideUI, cmdRotateMinimap, cmdShowUI } from "../../Events";
import { engine } from "../../engine/Engine";
import { Water } from "./Water";
import { EnvProps } from "./EnvProps";
import { GameMapUpdate } from "./GameMapUpdate";
import gsap from "gsap";
import { BuildingType } from "../buildings/BuildingTypes";
import { Rails } from "../Rails";
import { ICell } from "../GameTypes";

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

const { mapRes } = config.game;
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
            createSectors(GameMapProps.instance.size);
            this.preload()
                .then(() => this.init(GameMapProps.instance.size, owner));               
        }
    }

    private async load(owner: Object3D) {

        const data = await loadData(this.props.path, this.props.fromLocalStorage);        

        await this.preload();

        const unitsToSpawn = new Array<Vector2>();
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
                    if (cell.resource !== "wood") {
                        resources.create(sectorInstance, localCoords, cellInstance, cell.resource);
                    }
                }

                if (cell.unitCount !== undefined) {                    
                    for (let j = 0; j < cell.unitCount; j++) {
                        unitsToSpawn.push(mapCoords.clone());
                    }
                }

                if (cell.conveyor) {
                    const { direction, startAxis, endAxis } = cell.conveyor;
                    const _direction = new Vector2(direction.x, direction.y);
                    conveyors.create(cellInstance, mapCoords, _direction, startAxis, endAxis);
                }
            }

            const geometry = (sectorInstance.layers.terrain as Mesh).geometry as BufferGeometry;
            const position = geometry.getAttribute("position") as BufferAttribute;
            for (const elevation of sector.elevation) {
                position.setY(elevation.vertexIndex, elevation.height);
            }
        }        

        this.init(data.size, owner);

        // create units and structure after all sectors are created and fogOfWar is initialized
        for (const mapCoords of unitsToSpawn) {
            unitsManager.spawn(mapCoords, "worker");
        }

        for (const [buildingType, instances] of Object.entries(data.buildings)) {
            for (const instance of instances) {
                GameUtils.getCell(instance.mapCoords, sectorCoords, localCoords);
                switch (buildingType) {
                    case "factory": {
                        const factory = instance as ISerializedFactory;
                        buildings.createFactory(sectorCoords, localCoords, factory.input, factory.output);
                    }
                        break;

                    default:
                        buildings.create(buildingType as BuildingType, sectorCoords, localCoords);
                }
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
        await unitsManager.preload();
    }   

    private init(size: number, owner: Object3D) {
        this.state.sectorRes = size;

        fogOfWar.init(size);
        cmdFogAddCircle.post({ mapCoords: new Vector2(mapRes / 2, mapRes / 2), radius: mapRes / 2 });

        const water = utils.createObject(root(), "water");
        water.matrixAutoUpdate = false;
        water.matrixWorldAutoUpdate = false;
        water.position.setY(-.75);
        water.updateMatrix();
        engineState.setComponent(water, new Water({ sectorRes: size }));

        const props = utils.createObject(root(), "env-props");
        engineState.setComponent(props, new EnvProps({ sectorRes: size }));

        unitsManager.owner = owner;
        updateCameraSize();

        document.addEventListener("keyup", this.onKeyUp);
        document.addEventListener("keydown", this.onKeyDown);
        cmdShowUI.post("gamemap");

        engineState.setComponent(owner, new GameMapUpdate());
    }

    override dispose() {

        if (!this.state) {
            return;
        }

        document.removeEventListener("keyup", this.onKeyUp);
        document.removeEventListener("keydown", this.onKeyDown);
        cmdHideUI.post("gamemap");

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
            case "delete": unitsManager.killSelection(); break;
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

