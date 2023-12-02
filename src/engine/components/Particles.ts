import { Component, IComponentProps } from "../Component";
import { serialization } from "../Serialization";

export class ParticlesProps implements IComponentProps {
    constructor(props?: ParticlesProps) {
        if (props) {
            serialization.deserializeComponentProps(this, props);
        }
    }

    duration = 6;
    isLooping = false;
    worldSpace = false;
    maxParticles = 128;
    particlesPerSecond = 30;
    gravity = 9.8;
}

export class Particles extends Component<ParticlesProps> {
    constructor(props?: ParticlesProps) {
        super(new ParticlesProps(props));
    }
}

