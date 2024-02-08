
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
import { Buildings } from "../Buildings";

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
        const localCoords = pools.vec2.getOne();
        for (const sector of data.sectors) {
            const sectorInstance = (() => {
                if (sector.key !== "0,0") {
                    const [x, y] = sector.key.split(",").map(i => parseInt(i));
                    gameMap.createSector(new Vector2(x , y));                    
                }
                return gameMap.state.sectors.get(sector.key)!;
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

                if (cell.building !== undefined) {
                    calcLocalCoords(cell.index, localCoords);
                    Buildings.create(sectorInstance, localCoords, cellInstance);
                }
            }

            const geometry = (sectorInstance.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
            const position = geometry.getAttribute("position") as THREE.BufferAttribute;
            for (const elevation of sector.elevation) {
                position.setY(elevation.vertexIndex, elevation.height);
            }
        }
    }
}

