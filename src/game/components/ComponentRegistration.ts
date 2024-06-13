import { componentFactory } from "../../engine/ecs/ComponentFactory";
import { AnimateMorphTargets, AnimateMorphTargetsProps } from "./AnimateMorphTargets";
import { EnvProps, EnvPropsProps } from "./EnvProps";
import { Fadeout, FadeoutProps } from "./Fadeout";

import { GameMap } from "./GameMap";
import { GameMapLoader, GameMapLoaderProps } from "./GameMapLoader";
import { GameMapProps } from "./GameMapProps";
import { Grass, GrassProps } from "./Grass";
import { Test, TestProps } from "./Test";
import { Water, WaterProps } from "./Water";
import { registerEngineComponents } from "../../engine/components/EngineComponentRegistration";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { Rocket } from "./Rocket";

export function registerComponents() {

    registerEngineComponents();

    componentFactory.register<TestProps>(Test);
    componentFactory.register<GameMapProps>(GameMap);    
    componentFactory.register<GrassProps>(Grass);
    componentFactory.register<AnimateMorphTargetsProps>(AnimateMorphTargets);
    componentFactory.register<WaterProps>(Water);
    componentFactory.register<GameMapLoaderProps>(GameMapLoader);
    componentFactory.register<FadeoutProps>(Fadeout);
    componentFactory.register<EnvPropsProps>(EnvProps);
    componentFactory.register<ComponentProps>(Rocket);
}

