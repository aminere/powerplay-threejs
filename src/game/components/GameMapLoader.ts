
import { Euler, MathUtils, Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { ISerializedGameMap } from "../GameSerialization";
import { utils } from "../../engine/Utils";
import { engineState } from "../../engine/EngineState";
import { resources } from "../Resources";
import { config } from "../config";
import { ResourceType } from "../GameDefinitions";
import { buildings } from "../Buildings";
import { GameUtils } from "../GameUtils";
import { createSector, updateCameraSize } from "../GameMapUtils";
import { conveyors } from "../Conveyors";
import { unitsManager } from "../unit/UnitsManager";
import { GameMapState } from "./GameMapState";
import { GameMapProps } from "./GameMapProps";
import { conveyorItems } from "../ConveyorItems";
import { treesManager } from "../TreesManager";
import { railFactory } from "../RailFactory";
import { fogOfWar } from "../FogOfWar";
import { cmdFogAddCircle, cmdHideUI, cmdRotateMinimap, cmdShowUI } from "../../Events";
import { engine } from "../../engine/Engine";
import { Water } from "./Water";
import { EnvProps } from "./EnvProps";
import { Trees } from "./Trees";
import { GameMapUpdate } from "./GameMapUpdate";
import gsap from "gsap";

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
            this.createSectors(GameMapProps.instance.size);
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
                    resources.create(sectorInstance, localCoords, cellInstance, cell.resource as ResourceType);
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

            const geometry = (sectorInstance.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
            const position = geometry.getAttribute("position") as THREE.BufferAttribute;
            for (const elevation of sector.elevation) {
                position.setY(elevation.vertexIndex, elevation.height);
            }
        }        

        for (const [buildingId, mapCoordsList] of Object.entries(data.buildings)) {
            for (const mapCoords of mapCoordsList) {
                GameUtils.getCell(mapCoords, sectorCoords, localCoords);
                buildings.create(buildingId, sectorCoords, localCoords);
            }
        }       

        this.init(data.size, owner);

        // spawn units after all sectors are created
        for (const mapCoords of unitsToSpawn) {
            unitsManager.spawn(mapCoords);
        }
    }

    private async preload() {
        await buildings.preload();
        await conveyors.preload();
        await conveyorItems.preload();
        await treesManager.preload();
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

        const trees = utils.createObject(root(), "trees");
        engineState.setComponent(trees, new Trees({ sectorRes: size }));
        trees.visible = false;

        unitsManager.owner = owner;
        updateCameraSize();

        document.addEventListener("keyup", this.onKeyUp);
        document.addEventListener("keydown", this.onKeyDown);
        cmdShowUI.post("gamemap");

        engineState.setComponent(owner, new GameMapUpdate());
    }

    override dispose() {
        document.removeEventListener("keyup", this.onKeyUp);
        document.removeEventListener("keydown", this.onKeyDown);
        cmdHideUI.post("gamemap");

        conveyors.dispose();
        conveyorItems.dispose();
        unitsManager.dispose();
        fogOfWar.dispose();

        this.state.dispose();
    }

    private createSectors(size: number) {
        if (this.state.sectors.size > 0) {
            this.disposeSectors();
        }

        for (let i = 0; i < size; ++i) {
            for (let j = 0; j < size; ++j) {
                createSector(new Vector2(j, i));
            }
        }
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

