import { Color, Object3D, Vector2 } from "three";
import { Component, IComponentProps, IComponentState } from "../Component";
import { serialization } from "../Serialization";
import { TArray } from "../TArray";

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
    life = new Vector2(1, 2);
    gravity = 9.8;
    initialSpeed = new Vector2(1, 2);
    initialSize = new Vector2(1, 2);
    initialColor = new Color(0xffffff);
    speedOverLife = new TArray(Vector2);
    sizeOverLife = new TArray(Vector2);
    colorOverLife = new TArray(Color);
}

interface IParticleState extends IComponentState {

}

export class Particles extends Component<ParticlesProps, IParticleState> {

    constructor(props?: ParticlesProps) {
        super(new ParticlesProps(props));
    }

    override start(_owner: Object3D) { 

    }

    override update(_owner: Object3D) { 

    }

    override dispose() { 
        
    }
}

