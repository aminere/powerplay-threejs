import { componentFactory } from "../../engine/ecs/ComponentFactory";
import { Animator, AnimatorProps } from "../../engine/components/Animator";
import { PrefabLoader, PrefabLoaderProps } from "../../engine/components/PrefabLoader";
import { Particles } from "./particles/Particles";
import { ParticlesProps } from "./particles/ParticlesProps";
import { SphereCollider, SphereColliderProps } from "../collision/SphereCollider";
import { ComponentProps } from "../ecs/ComponentProps";
import { Billboard } from "./Billboard";
import { InstancedParticles } from "./particles/InstancedParticles";

export function registerEngineComponents() {
    componentFactory.register<AnimatorProps>(Animator);
    componentFactory.register<PrefabLoaderProps>(PrefabLoader);
    componentFactory.register<ParticlesProps>(Particles);
    componentFactory.register<ParticlesProps>(InstancedParticles);
    componentFactory.register<SphereColliderProps>(SphereCollider);
    componentFactory.register<ComponentProps>(Billboard);
}

