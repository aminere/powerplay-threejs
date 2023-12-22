import { componentFactory } from "../../engine/ComponentFactory";
import { Animator, AnimatorProps } from "../../engine/components/Animator";
import { Particles } from "../../engine/components/Particles";
import { ParticlesProps } from "../../engine/components/ParticlesProps";
import { AnimateMorphTargets, AnimateMorphTargetsProps } from "./AnimateMorphTargets";
import { Flock, FlockProps } from "./Flock";

import { GameMap } from "./GameMap";
import { GameMapLoader, GameMapLoaderProps } from "./GameMapLoader";
import { GameMapProps } from "./GameMapProps";
import { Grass, GrassProps } from "./Grass";
import { Test, TestProps } from "./Test";
import { Water, WaterProps } from "./Water";

export function registerComponents() {
    componentFactory.register<AnimatorProps>(Animator);
    componentFactory.register<ParticlesProps>(Particles);

    componentFactory.register<GameMapProps>(GameMap);    
    componentFactory.register<GrassProps>(Grass);
    componentFactory.register<AnimateMorphTargetsProps>(AnimateMorphTargets);
    componentFactory.register<WaterProps>(Water);
    componentFactory.register<GameMapLoaderProps>(GameMapLoader);
    componentFactory.register<FlockProps>(Flock);
    componentFactory.register<TestProps>(Test);
}

