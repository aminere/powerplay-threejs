
import { Object3D, Vector2 } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { ISerializedGameMap } from "../GameTypes";
import { utils } from "../../engine/Utils";
import { GameMap } from "./GameMap";

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

        const gameMap = utils.createObject(owner.parent!, this.props.path);
        const component = utils.setComponent(gameMap, new GameMap());

        for (const sector of data.sectors) {
            const sectorInstance = (() => {
                if (sector.key !== "0,0") {
                    const [x, y] = sector.key.split(",").map(i => parseInt(i));
                    component.createSector(new Vector2(x , y));                    
                }
                return component.state.sectors.get(sector.key)!;
            })();

            for (const cell of sector.cells) {
                const cellInstance = sectorInstance.cells[cell.index];
                cellInstance.roadTile = cell.roadTile;
                sectorInstance.textureData.terrain.set([cell.roadTile!], cell.index);                
            }

            const geometry = (sectorInstance.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
            const position = geometry.getAttribute("position") as THREE.BufferAttribute;
            for (const elevation of sector.elevation) {
                position.setY(elevation.vertexIndex, elevation.height);
            }
        }
    }
}

