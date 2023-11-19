import { Box2, Object3D, Vector2 } from "three";
import { Component } from "../../engine/Component"
import { createMapState, destroyMapState } from "../MapState";
import { GameMapProps } from "./GameMapProps";
import { Sector } from "../Sector";
import { config } from "../config";
import { GameUtils } from "../GameUtils";

export class GameMap extends Component<GameMapProps> {
    private _initialized = false;
    private _owner!: Object3D;

    constructor(props?: GameMapProps) {
        super(props ?? {
            sectors: new Map<string, any>()
        });
    }

    override update(owner: Object3D) {
        if (!this._initialized) {
            this._initialized = true;
            this._owner = owner;
            createMapState(this.props);
            this.createSector(new Vector2(0, 0));            
        }
    }

    override dispose() {
        destroyMapState();
    }

    private createSector(coords: Vector2) {
        const sectorRoot = Sector.create(coords, this._owner);

        // update bounds
        const { mapRes, cellSize } = config.game;
        const mapSize = mapRes * cellSize;
        const [min, max] = GameUtils.pool.vec2.get(2);
        min.set(sectorRoot.position.x, sectorRoot.position.z);
        max.set(min.x + mapSize, min.y + mapSize);
        const { bounds } = this.props;
        if (!bounds) {
            this.props.bounds = new Box2(min.clone(), max.clone());
        } else {
            bounds.expandByPoint(min);
            bounds.expandByPoint(max);
        }
    }
}

