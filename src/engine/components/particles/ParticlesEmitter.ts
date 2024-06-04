import { Color, MathUtils, Vector2, Vector3 } from "three";
import { time } from "../../core/Time";
import { ParticlesProps } from "./ParticlesProps";
import { ParticlesState } from "./ParticlesState";
import { TArray } from "../../serialization/TArray";

const particleDirection = new Vector3();
const particleVelocity = new Vector3();
const particlePos = new Vector3();
const white = new Color(0xffffff);

function randomRange(range: Vector2) {
    return MathUtils.randFloat(range.x, range.y);
}

function evaluateValueOverLife(data: TArray<Number>, lifeNormalized: number) {
    console.assert(data.length > 0);
    if (data.length < 2) { 
        return data.at(0).valueOf();
    }    
    const step = 1 / (data.length - 1);
    const index = Math.min(Math.floor(lifeNormalized / step), data.length - 2);
    const localOffset = (lifeNormalized - index * step) / step;
    const value1 = data.at(index).valueOf();
    const value2 = data.at(index + 1).valueOf();
    return MathUtils.lerp(value1, value2, localOffset);
}

const dummyColor = new Color();
function evaluateColorOverLife(data: TArray<Color>, lifeNormalized: number) {
    console.assert(data.length > 0);
    if (data.length < 2) { 
        return data.at(0);
    }
    const step = 1 / (data.length - 1);
    const index = Math.min(Math.floor(lifeNormalized / step), data.length - 2);
    const localOffset = (lifeNormalized - index * step) / step;
    const value1 = data.at(index);
    const value2 = data.at(index + 1);
    return dummyColor.lerpColors(value1, value2, localOffset);
}
export class ParticlesEmitter {

    public static init(state: ParticlesState, duration: number) {
        state.newParticlesCounter = 0;
        state.particleCount = 0;
        state.emitTime = duration;
        state.isEmitting = true;
    }

    public static update(state: ParticlesState, props: ParticlesProps) {
        let particlesToEmit = 0;

        const deltaTime = time.deltaTime;
        if (state.isEmitting) {
            if (state.emitTime <= 0) {
                if (props.isLooping) {
                    state.emitTime += props.duration;
                } else {
                    state.isEmitting = false;
                }
            }
            if (state.isEmitting) {
                state.newParticlesCounter += deltaTime * props.particlesPerSecond;
            }
        }

        particlesToEmit = Math.floor(state.newParticlesCounter);

        const { maxParticles } = props;
        if (state.particleCount + particlesToEmit > maxParticles) {
            particlesToEmit = maxParticles - state.particleCount;
        }

        let emittedParticles = 0;
        let particlesToProcess = particlesToEmit + state.particleCount;
        for (let i = 0; i < maxParticles; ++i) {
            if (particlesToProcess === 0) {
                // early break if no more particles to process
                break;
            }

            const active = state.getData("active", i);
            if (active === 0) {
                // free particle, use it for emission
                if (emittedParticles < particlesToEmit) {
                    state.setData("active", i, 1);

                    const life = randomRange(props.life)
                    state.setData("life", i, life);
                    state.setData("remainingLife", i, life);

                    // size
                    state.setData("initialSize", i, randomRange(props.initialSize));
                    if (props.sizeOverLife.length > 0) {
                        const size = evaluateValueOverLife(props.sizeOverLife, 0);
                        state.setData("size", i, size);
                    } else {
                        state.setData("size", i, 1);
                    }

                    // speed
                    state.setData("speed", i, randomRange(props.initialSpeed));

                    // direction
                    particlePos.set(MathUtils.randInt(-1, 1), MathUtils.randInt(-1, 1), MathUtils.randInt(-1, 1)).normalize();
                    if (props.direction === "awayFromCenter") {
                        particleDirection.copy(particlePos).normalize();
                    } else {
                        particleDirection.set(0, 1, 0);
                    }
                    state.setVector3("direction", i, particleDirection);

                    // position
                    particlePos.multiplyScalar(MathUtils.randFloat(0, props.radius));
                    state.setVector3("position", i, particlePos);

                    // color
                    const color = dummyColor.lerpColors(props.initialColor1, props.initialColor2, Math.random());
                    state.setColor("initialColor", i, color);
                    if (props.colorOverLife.data.length > 0) {
                        const color = evaluateColorOverLife(props.colorOverLife, 0);
                        state.setColor("color", i, color);
                    } else {
                        state.setColor("color", i, white);
                    }

                    if (props.alphaOverLife.data.length > 0) {
                        const alpha = evaluateValueOverLife(props.alphaOverLife, 0);
                        state.setAlpha(i, alpha);
                    } else {
                        state.setAlpha(i, props.initialAlpha);
                    }

                    ++emittedParticles;
                    ++state.particleCount;
                    --particlesToProcess;
                }
            } else {
                const remainingLife = state.getData("remainingLife", i) - deltaTime;

                // apply life
                if (remainingLife < 0) {
                    // dead particle
                    state.setData("active", i, 0);
                    --state.particleCount;
                } else {
                    const life = state.getData("life", i);
                    const lifeFactor = 1 - (remainingLife / life);

                    // active particle, update it
                    state.getVector3("direction", i, particleDirection);
                    let speed = state.getData("speed", i);

                    if (props.speedOverLife.length > 0) {
                        const speedOverLife = evaluateValueOverLife(props.speedOverLife, lifeFactor);
                        speed *= speedOverLife;
                    }

                    particleVelocity.set(0, 0, 0).addScaledVector(particleDirection, speed);

                    // apply gravity
                    if (props.gravity !== 0) {
                        particleVelocity.y += props.gravity * deltaTime;
                        particleDirection.copy(particleVelocity).normalize();
                        state.setVector3("direction", i, particleDirection);
                        const newSpeed = particleVelocity.length();
                        state.setData("speed", i, newSpeed);
                    }

                    // update velocity
                    state.getVector3("position", i, particlePos);
                    particlePos.addScaledVector(particleVelocity, deltaTime);
                    state.setVector3("position", i, particlePos);

                    // update color
                    if (props.colorOverLife.length > 0) {
                        const color = evaluateColorOverLife(props.colorOverLife, lifeFactor);
                        state.setColor("color", i, color);
                    }

                    if (props.alphaOverLife.length > 0) {
                        const alpha = evaluateValueOverLife(props.alphaOverLife, lifeFactor);
                        state.setAlpha(i, alpha);
                    }

                    // update size
                    if (props.sizeOverLife.length > 0) {
                        const size = evaluateValueOverLife(props.sizeOverLife, lifeFactor);
                        state.setData("size", i, size);
                    }

                    state.setData("remainingLife", i, remainingLife);
                }
                --particlesToProcess;
            }
        }

        state.newParticlesCounter -= particlesToEmit;
        if (state.isEmitting) {
            state.emitTime -= deltaTime;
        }
    }
}

