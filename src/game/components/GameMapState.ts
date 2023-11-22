import { Box2 } from "three";
import { Action, ISector } from "../GameTypes";

export interface IGameMapState {
    sectors: Map<string, ISector>;
    bounds?: Box2;
    action: Action | null;
}

