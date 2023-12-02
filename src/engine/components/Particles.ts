import { Vector2 } from "three";
import { Component, IComponentProps } from "../Component";
import { TArray } from "../TArray";
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
    testVec2Array = new TArray(Vector2);
    testNumberArray = new TArray(Number);
    hola = 666;
}

export class Particles extends Component<ParticlesProps> {
    constructor(props?: ParticlesProps) {
        super(new ParticlesProps(props));
    }
}

