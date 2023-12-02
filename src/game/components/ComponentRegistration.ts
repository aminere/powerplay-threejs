import { Particles, ParticlesProps } from "../../engine/components/Particles";
import { componentFactory } from "../../powerplay";
import { GameMap } from "./GameMap";
import { GameMapProps } from "./GameMapProps";

export function registerComponents() {
    componentFactory.register<GameMapProps>(GameMap);
    componentFactory.register<ParticlesProps>(Particles);
}

