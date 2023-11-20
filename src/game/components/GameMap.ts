import { Box2, Object3D, Vector2 } from "three";
import { Component, IComponentProps } from "../../engine/Component"
import { createMapState, destroyMapState } from "../MapState";
import { Sector } from "../Sector";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { ISector } from "../GameTypes";
import { input } from "../../engine/Input";

interface IGameMapState {
    sectors: Map<string, ISector>;
    bounds?: Box2;
}

export class GameMap extends Component<IComponentProps> {
    private _owner!: Object3D;
    private _state!: IGameMapState;

    constructor(props?: IComponentProps) {
        super(props);
        this._state = {
            sectors: new Map<string, any>()
        };
    }

    override start(owner: Object3D) {
        this._owner = owner;
        createMapState(this._state);
        this.createSector(new Vector2(0, 0));      
    }

    override update(owner: Object3D) {        
        if (input.touchInside) {

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
        const { bounds } = this._state;
        if (!bounds) {
            this._state.bounds = new Box2(min.clone(), max.clone());
        } else {
            bounds.expandByPoint(min);
            bounds.expandByPoint(max);
        }
    }
}

