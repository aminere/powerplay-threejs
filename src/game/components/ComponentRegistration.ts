import { componentFactory } from "../../powerplay";
import { GameMap } from "./GameMap";
import { GameMapProps } from "./GameMapProps";

export function registerComponents() {
    componentFactory.register<GameMapProps>(GameMap);
}

