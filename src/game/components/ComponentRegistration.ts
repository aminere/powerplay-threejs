import { componentFactory } from "../../powerplay";
import { DirectionalLightComponent, IDirectionalLightProps } from "./DirectionalLightComponent";
import { GameMap, GameMapProps } from "./GameMap";

export function registerComponents() {
    componentFactory.register<GameMapProps>(GameMap);
    componentFactory.register<IDirectionalLightProps>(DirectionalLightComponent);
}

