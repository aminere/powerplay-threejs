import { Vector2 } from "three";
import { Component, IComponentProps } from "../Component";

export class ParticlesProps implements IComponentProps {
    constructor(props?: ParticlesProps) {
        if (props) {
            for (const [prop, value] of Object.entries(props)) {
                const vec2 = this[prop as keyof typeof this] as Vector2;
                if (vec2 instanceof Vector2) {
                    vec2.copy(value as Vector2);
                } else {
                    Object.assign(this, { [prop]: value });
                }
            }
        }
    }

    duration = 6;
    isLooping = false;
    worldSpace = false;
    maxParticles = 128;
    particlesPerSecond = 30;
    gravity = 9.8;
    testVec2Array = new Array<Vector2>();
    testNumberArray = new Array<number>();
    hola = 666;
}

export class Particles extends Component<ParticlesProps> {
    constructor(props?: ParticlesProps) {
        super(new ParticlesProps(props));
    }
}

