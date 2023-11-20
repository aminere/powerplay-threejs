import { IComponentProps } from "../../engine/Component";
import { componentFactory } from "../../powerplay";
import { DirectionalLightComponent, IDirectionalLightProps } from "./DirectionalLightComponent";
import { GameMap } from "./GameMap";

export function registerComponents() {
    componentFactory.register<IComponentProps>(GameMap);
    componentFactory.register<IDirectionalLightProps>(DirectionalLightComponent);
}

