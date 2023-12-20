
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { ISerializedGameMap } from "../GameSerialization";
import { utils } from "../../engine/Utils";
import { GameMap } from "./GameMap";
import { engineState } from "../../engine/EngineState";
import { resources } from "../Resources";
import { config } from "../config";
import { pools } from "../../engine/Pools";
import { ResourceType } from "../GameDefinitions";
import { GameUtils } from "../GameUtils";

export class GameMapLoaderProps extends ComponentProps {

    path = "";

    constructor(props?: Partial<GameMapLoaderProps>) {
        super();
        this.deserialize(props);
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
        const response = await fetch(`/scenes/${this.props.path}.json`);
        const data = await response.json() as ISerializedGameMap;

        const obj = utils.createObject(owner.parent!, this.props.path);
        const gameMap = engineState.setComponent(obj, new GameMap());
        const { mapRes } = config.game;
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
                    const cellY = Math.floor(cell.index / mapRes);
                    const cellX = cell.index - cellY * mapRes;
                    localCoords.set(cellX, cellY);
                    resources.create(sectorInstance, localCoords, cellInstance, cell.resource as ResourceType);
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

