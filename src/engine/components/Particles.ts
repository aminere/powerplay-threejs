import { BufferAttribute, Color, DynamicDrawUsage, MathUtils, Object3D, Points, ShaderMaterial, Vector2, Vector3 } from "three";
import { Component } from "../ecs/Component";
import { TArray } from "../serialization/TArray";
import { time } from "../core/Time";
import { ParticleState } from "./ParticlesState";
import { ParticlesProps } from "./ParticlesProps";
import * as Attributes from "../serialization/Attributes";

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

const particlePos = new Vector3();
const particleDirection = new Vector3();
const particleVelocity = new Vector3();

@Attributes.componentRequires(obj => {
    return obj instanceof Points && (obj as Points).material instanceof ShaderMaterial;
})
export class Particles extends Component<ParticlesProps, ParticleState> {

    constructor(props?: Partial<ParticlesProps>) {
        super(new ParticlesProps(props));
    }

    override start(_owner: Points) {
        const geometry = _owner.geometry;
        const vertices = new Float32Array([...Array(this.props.maxParticles)].flatMap(_ => [0, 0, 0]));
        const colors = new Float32Array([...Array(this.props.maxParticles)].flatMap(_ => [1, 1, 1, 1]));
        const sizes = new Float32Array([...Array(this.props.maxParticles)].map(_ => 1));
        geometry.setAttribute('position', new BufferAttribute(vertices, 3).setUsage(DynamicDrawUsage));
        geometry.setAttribute('color', new BufferAttribute(colors, 4).setUsage(DynamicDrawUsage));
        geometry.setAttribute('size', new BufferAttribute(sizes, 1).setUsage(DynamicDrawUsage));
        geometry.setDrawRange(0, 0);
        geometry.computeBoundingSphere();  
        this.setState(new ParticleState(this.props.maxParticles));
        this.initEmitter();
    }

    override update(owner: Object3D) {
        let particlesToEmit = 0;
        
        const deltaTime = time.deltaTime;
        if (this.state.isEmitting) {
            if (this.state.emitTime <= 0) {
                if (this.props.isLooping) {
                    this.state.emitTime += this.props.duration;
                } else {
                    this.state.isEmitting = false;
                }
            }
            if (this.state.isEmitting) {
                this.state.newParticlesCounter += deltaTime * this.props.particlesPerSecond;            
            }
        }

        particlesToEmit = Math.floor(this.state.newParticlesCounter);

        const { maxParticles } = this.props;
        if (this.state.particleCount + particlesToEmit > maxParticles) {
            particlesToEmit = maxParticles - this.state.particleCount;
        }

        let emittedParticles = 0;
        let particlesToProcess = particlesToEmit + this.state.particleCount;
        for (let i = 0; i < maxParticles; ++i) {
            if (particlesToProcess === 0) {
                // early break if no more particles to process
                break;
            }
            
            const active = this.state.getData("active", i);
            if (active === 0) {
                // free particle, use it for emission
                if (emittedParticles < particlesToEmit) {
                    this.state.setData("active", i, 1);

                    const life = randomRange(this.props.life)
                    this.state.setData("life", i, life);
                    this.state.setData("remainingLife", i, life);

                    // size
                    this.state.setData("initialSize", i, randomRange(this.props.initialSize));
                    if (this.props.sizeOverLife.length > 0) {
                        const size = evaluateValueOverLife(this.props.sizeOverLife, 0);
                        this.state.setData("size", i, size);
                    } else {
                        this.state.setData("size", i, 1);
                    }                    
                    
                    // speed
                    this.state.setData("speed", i, randomRange(this.props.initialSpeed));                    

                    // direction
                    particlePos.set(MathUtils.randInt(-1, 1), MathUtils.randInt(-1, 1), MathUtils.randInt(-1, 1)).normalize();
                    if (this.props.direction === "awayFromCenter") {
                        particleDirection.copy(particlePos).normalize();
                    } else {
                        particleDirection.set(0, 1, 0);
                    }
                    this.state.setVector3("direction", i, particleDirection);

                    // position
                    particlePos.multiplyScalar(MathUtils.randFloat(0, this.props.radius));
                    this.state.setVector3("position", i, particlePos);                    

                    // color
                    if (this.props.colorOverLife.data.length > 0) {                        
                        const color = evaluateColorOverLife(this.props.colorOverLife, 0);
                        this.state.setColor(i, color);
                    } else {
                        this.state.setColor(i, this.props.initialColor);
                    }
                    
                    if (this.props.alphaOverLife.data.length > 0) {                        
                        const alpha = evaluateValueOverLife(this.props.alphaOverLife, 0);
                        this.state.setAlpha(i, alpha);
                    } else {
                        this.state.setAlpha(i, this.props.initialAlpha);
                    }

                    ++emittedParticles;
                    ++this.state.particleCount;
                    --particlesToProcess;
                }
            } else {                
                const remainingLife = this.state.getData("remainingLife", i) - deltaTime;

                // apply life
                if (remainingLife < 0) {
                    // dead particle
                    this.state.setData("active", i, 0);
                    --this.state.particleCount;
                } else {
                    const life = this.state.getData("life", i);
                    const lifeFactor = 1 - (remainingLife / life);

                    // active particle, update it
                    this.state.getVector3("direction", i, particleDirection);
                    let speed = this.state.getData("speed", i);

                    if (this.props.speedOverLife.length > 0) {
                        const speedOverLife = evaluateValueOverLife(this.props.speedOverLife, lifeFactor);
                        speed *= speedOverLife;
                    }

                    particleVelocity.set(0, 0, 0).addScaledVector(particleDirection, speed);

                    // apply gravity
                    if (this.props.gravity !== 0) {
                        particleVelocity.y += this.props.gravity;
                        particleDirection.copy(particleVelocity).normalize();
                        this.state.setVector3("direction", i, particleDirection);
                        const newSpeed = particleVelocity.length();
                        this.state.setData("speed", i, newSpeed);
                    }                    

                    // update velocity
                    this.state.getVector3("position", i, particlePos);
                    particlePos.addScaledVector(particleVelocity, deltaTime);
                    this.state.setVector3("position", i, particlePos);

                    // update color
                    if (this.props.colorOverLife.length > 0) {
                        const color = evaluateColorOverLife(this.props.colorOverLife, lifeFactor);
                        this.state.setColor(i, color);
                    }

                    if (this.props.alphaOverLife.length > 0) {
                        const alpha = evaluateValueOverLife(this.props.alphaOverLife, lifeFactor);
                        this.state.setAlpha(i, alpha);
                    }

                    // update size
                    if (this.props.sizeOverLife.length > 0) {
                        const size = evaluateValueOverLife(this.props.sizeOverLife, lifeFactor);
                        this.state.setData("size", i, size);
                    }

                    this.state.setData("remainingLife", i, remainingLife);
                }
                --particlesToProcess;
            }           
        }

        this.state.newParticlesCounter -= particlesToEmit;
        if (this.state.isEmitting) {
            this.state.emitTime -= deltaTime;
        }
        this.updateGeometry(owner as Points);
    }

    private updateGeometry(owner: Points) {
        const geometry = owner.geometry;
        const positions = geometry.getAttribute("position") as BufferAttribute;
        const colors = geometry.getAttribute("color") as BufferAttribute;
        const sizes = geometry.getAttribute("size") as BufferAttribute;
        let index = 0;
        let particlesToProcess = this.state.particleCount;
        let radiusSq = 0;
        for (let i = 0; i < this.props.maxParticles; ++i) {
            if (particlesToProcess === 0) {
                // early break if no more particles to process
                break;
            }

            const active = this.state.getData("active", i);
            if (active === 0) {
                continue;
            }

            // Apply position
            this.state.getVector3("position", i, particlePos);
            positions.setXYZ(index, particlePos.x, particlePos.y, particlePos.z);
            const lengthSq = particlePos.lengthSq();
            if (lengthSq > radiusSq) {
                radiusSq = lengthSq;
            }            

            // Apply size
            const size = this.state.getData("size", i);
            const initialSize = this.state.getData("initialSize", i);
            sizes.setX(index, initialSize * size);

            // Apply color
            this.state.getColor(i, dummyColor);
            const alpha = this.state.getAlpha(i);
            colors.setXYZW(index, dummyColor.r, dummyColor.g, dummyColor.b, alpha);
            --particlesToProcess;
            index++;
        }
        
        geometry.setDrawRange(0, index);
        geometry.boundingSphere!.radius = Math.sqrt(radiusSq);
        positions.needsUpdate = true;
        colors.needsUpdate = true;
        sizes.needsUpdate = true;
    }

    private initEmitter() {
        this.state.newParticlesCounter = 0;
        this.state.particleCount = 0;
        this.state.emitTime = this.props.duration;
        this.state.isEmitting = true;
    }
}

