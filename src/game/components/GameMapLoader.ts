
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { ISerializedGameMap } from "../GameSerialization";
import { utils } from "../../engine/Utils";
import { GameMap } from "./GameMap";
import { engineState } from "../../engine/EngineState";
import { resources } from "../Resources";
import { config } from "../config";
import { ResourceType } from "../GameDefinitions";
import { buildings } from "../Buildings";
import { GameUtils } from "../GameUtils";
import { createSector } from "../GameMapUtils";
import { unitUtils } from "../unit/UnitUtils";
import { conveyors } from "../Conveyors";
import { GameMapUpdate } from "./GameMapUpdate";

const sectorCoords = new Vector2();
const localCoords = new Vector2();
const mapCoords = new Vector2();

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

export class GameMapLoader extends Component<GameMapLoaderProps> {
    constructor(props?: Partial<GameMapLoaderProps>) {
        super(new GameMapLoaderProps(props));
    }

    override start(owner: Object3D) {
        if (this.props.path.length > 0) {
            this.load(owner);
        }
    }

    private async load(owner: Object3D) {

        const data = await loadData(this.props.path, this.props.fromLocalStorage);        
        const obj = utils.createObject(owner.parent!, this.props.path);
        const gameMap = engineState.setComponent(obj, new GameMap());

        await gameMap.preload();

        const unitsToSpawn = new Array<Vector2>();
        for (const sector of data.sectors) {

            const [x, y] = sector.key.split(",").map(i => parseInt(i));
            sectorCoords.set(x, y);

            const sectorInstance = (() => {
                const instance = gameMap.state.sectors.get(sector.key);
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

        gameMap.init(data.size);

        // spawn units after all sectors are created
        for (const mapCoords of unitsToSpawn) {
            unitUtils.spawn(mapCoords);
        }

        engineState.setComponent(owner, new GameMapUpdate())
    }
}

