import { Color, Vector2 } from "three";
import { ComponentProps } from "../../ecs/ComponentProps";
import { TArray } from "../../serialization/TArray";
import * as Attributes from "../../serialization/Attributes";

const ParticleDirections = [
    "static",
    "awayFromCenter"    
] as const;

type ParticleDirection = typeof ParticleDirections[number];

export class ParticlesProps extends ComponentProps {

    constructor(props?: Partial<ParticlesProps>) {
        super();
        this.deserialize(props);
    }

    duration = 6;
    isLooping = false;
    maxParticles = 128;
    particlesPerSecond = 30;
    life = new Vector2(1, 2);
    gravity = 0;
    initialSpeed = new Vector2(1, 2);
    initialSize = new Vector2(1, 1);
    initialColor1 = new Color(0xffffff);
    initialColor2 = new Color(0xffffff);
    initialAlpha = 1;
    radius = 1;

    @Attributes.enumOptions(ParticleDirections)
    direction: ParticleDirection = "static";

    sizeOverLife = new TArray(Number);
    speedOverLife = new TArray(Number);
    colorOverLife = new TArray(Color);
    alphaOverLife = new TArray(Number);
}

