import { componentFactory } from "../../engine/ComponentFactory";
import { Animator, AnimatorProps } from "../../engine/components/Animator";
import { Particles } from "../../engine/components/Particles";
import { ParticlesProps } from "../../engine/components/ParticlesProps";
import { AnimateMorphTargets, AnimateMorphTargetsProps } from "./AnimateMorphTargets";

import { GameMap } from "./GameMap";
import { GameMapProps } from "./GameMapProps";
import { Grass, GrassProps } from "./Grass";

export function registerComponents() {
    componentFactory.register<AnimatorProps>(Animator);
    componentFactory.register<ParticlesProps>(Particles);

    componentFactory.register<GameMapProps>(GameMap);    
    componentFactory.register<GrassProps>(Grass);
    componentFactory.register<AnimateMorphTargetsProps>(AnimateMorphTargets);
}

