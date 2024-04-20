import { componentFactory } from "../../engine/ecs/ComponentFactory";
import { Animator, AnimatorProps } from "../../engine/components/Animator";
import { PrefabLoader, PrefabLoaderProps } from "../../engine/components/PrefabLoader";
import { Particles } from "../../engine/components/Particles";
import { ParticlesProps } from "../../engine/components/ParticlesProps";

export function registerEngineComponents() {
    componentFactory.register<AnimatorProps>(Animator);
    componentFactory.register<PrefabLoaderProps>(PrefabLoader);
    componentFactory.register<ParticlesProps>(Particles);
}

