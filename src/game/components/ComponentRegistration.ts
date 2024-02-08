import { componentFactory } from "../../engine/ecs/ComponentFactory";
import { Animator, AnimatorProps } from "../../engine/components/Animator";
import { BezierPath, BezierPathProps } from "../../engine/components/BezierPath";
import { Particles } from "../../engine/components/Particles";
import { ParticlesProps } from "../../engine/components/ParticlesProps";
import { AnimateMorphTargets, AnimateMorphTargetsProps } from "./AnimateMorphTargets";
import { EnvProps, EnvPropsProps } from "./EnvProps";
import { Fadeout, FadeoutProps } from "./Fadeout";
import { Flock, FlockProps } from "./Flock";

import { GameMap } from "./GameMap";
import { GameMapLoader, GameMapLoaderProps } from "./GameMapLoader";
import { GameMapProps } from "./GameMapProps";
import { Grass, GrassProps } from "./Grass";
import { Test, TestProps } from "./Test";
import { Trees, TreesProps } from "./Trees";
import { Water, WaterProps } from "./Water";

export function registerComponents() {
    componentFactory.register<TestProps>(Test);

    componentFactory.register<AnimatorProps>(Animator);
    componentFactory.register<ParticlesProps>(Particles);

    componentFactory.register<GameMapProps>(GameMap);    
    componentFactory.register<GrassProps>(Grass);
    componentFactory.register<AnimateMorphTargetsProps>(AnimateMorphTargets);
    componentFactory.register<WaterProps>(Water);
    componentFactory.register<GameMapLoaderProps>(GameMapLoader);
    componentFactory.register<FlockProps>(Flock);
    componentFactory.register<FadeoutProps>(Fadeout);
    componentFactory.register<BezierPathProps>(BezierPath);
    componentFactory.register<TreesProps>(Trees);
    componentFactory.register<EnvPropsProps>(EnvProps);
}

