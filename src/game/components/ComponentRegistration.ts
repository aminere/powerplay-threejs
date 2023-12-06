import { Particles, ParticlesProps } from "../../engine/components/Particles";
import { componentFactory } from "../../powerplay";
import { GameMap } from "./GameMap";
import { GameMapProps } from "./GameMapProps";
import { ITreeProps, Tree } from "./Tree";

export function registerComponents() {
    componentFactory.register<GameMapProps>(GameMap);
    componentFactory.register<ParticlesProps>(Particles);
    componentFactory.register<ITreeProps>(Tree);
}

