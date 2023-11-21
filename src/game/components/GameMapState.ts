import { Box2 } from "three";
import { ISector } from "../GameTypes";

export interface IGameMapState {
    sectors: Map<string, ISector>;
    bounds?: Box2;
}

