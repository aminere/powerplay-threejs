
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { ISerializedGameMap } from "../GameSerialization";
import { utils } from "../../engine/Utils";
import { GameMap } from "./GameMap";
import { engineState } from "../../engine/EngineState";
import { resources } from "../Resources";
import { config } from "../config";
import { pools } from "../../engine/core/Pools";
import { ResourceType } from "../GameDefinitions";
import { buildings } from "../Buildings";
import { GameUtils } from "../GameUtils";

export class GameMapLoaderProps extends ComponentProps {

    path = "";

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
        const response = await fetch(`/scenes/${this.props.path}.json`);
        const data = await response.json() as ISerializedGameMap;

        const obj = utils.createObject(owner.parent!, this.props.path);
        const gameMap = engineState.setComponent(obj, new GameMap());
        const [_sectorCoords, localCoords] = pools.vec2.get(2);        
        for (const sector of data.sectors) {

            const sectorCoords = (() => {
                const [x, y] = sector.key.split(",").map(i => parseInt(i));
                _sectorCoords.set(x, y);
                return _sectorCoords;
            })();

            const sectorInstance = (() => {
                const instance = gameMap.state.sectors.get(sector.key);
                return instance ?? gameMap.createSector(sectorCoords);
            })();

            for (let i = 0; i < sector.cells.length; i++) {
                const cell = sector.cells[i];
                const cellInstance = sectorInstance.cells[cell.index];
                if (cell.roadTile) {
                    cellInstance.roadTile = cell.roadTile;
                    sectorInstance.textureData.terrain.set([cell.roadTile!], cell.index);
                }

                if (cell.resource) {
                    calcLocalCoords(cell.index, localCoords);
                    resources.create(sectorInstance, localCoords, cellInstance, cell.resource as ResourceType);
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
                GameUtils.getCell(mapCoords, _sectorCoords, localCoords);
                buildings.create(buildingId, _sectorCoords, localCoords);
            }
        }
    }
}

