import { BufferAttribute, Color, DynamicDrawUsage, MathUtils, Object3D, Points, ShaderMaterial, Vector2, Vector3 } from "three";
import { Component, IComponentProps, IComponentState } from "../Component";
import { serialization } from "../Serialization";
import { TArray } from "../TArray";
import * as Attributes from "../../engine/Attributes";
import { time } from "../Time";
import { pools } from "../Pools";
import { engine } from "../Engine";

export const ParticleDirections = [
    "static",
    "awayFromCenter"    
] as const;

export type ParticleDirection = typeof ParticleDirections[number];

export class ParticlesProps implements IComponentProps {
    constructor(props?: ParticlesProps) {
        if (props) {
            serialization.deserializeComponentProps(this, props);
        }
    }

    duration = 6;
    isLooping = false;
    maxParticles = 128;
    particlesPerSecond = 30;
    life = new Vector2(1, 2);
    gravity = 9.8;
    initialSpeed = new Vector2(1, 2);
    initialSize = new Vector2(1, 2);
    initialColor = new Color(0xffffff);
    initialAlpha = 1;
    radius = 1;

    @Attributes.enumOptions(ParticleDirections)
    direction: ParticleDirection = "static";

    speedOverLife = new TArray(Number);
    sizeOverLife = new TArray(Number);
    colorOverLife = new TArray(Color);
    alphaOverLife = new TArray(Number);
}


const dataOffsets = {
    // Vector3
    position: 0,
    // Vector3
    velocity: 3,
    // Color RGBA
    color: 6,
    // number
    life: 10,
    // number
    remainingLife: 11,
    // number
    size: 12,
    // number
    initialSize: 13,
    // number
    active: 14,
    MAX: 15
};

type DataOffset = Exclude<keyof typeof dataOffsets, "MAX">;
type Vector3Offset = "position" | "velocity";

function getDataOffset(name: DataOffset, particleIndex: number, localOffset: number) {
    return (particleIndex * dataOffsets.MAX) + dataOffsets[name] + localOffset;
}

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
    const index = Math.floor(lifeNormalized / step);
    const localOffset = (lifeNormalized - index * step) / step;
    const value1 = data.at(index);
    const value2 = data.at(index + 1);
    return dummyColor.lerpColors(value1, value2, localOffset);
}
class ParticleState implements IComponentState {

    public particleCount = 0;
    public newParticlesCounter = 0;
    public isEmitting = true;
    public emitTime = -1;

    private _data: number[];

    constructor(maxParticles: number) {
        this._data = new Array(maxParticles * dataOffsets.MAX).fill(0);
    }

    getData(name: DataOffset, particleIndex: number, localOffset?: number) {
        const index = getDataOffset(name, particleIndex, localOffset || 0);
        console.assert(index < this._data.length);
        return this._data[index];
    }

    setData(name: DataOffset, particleIndex: number, value: number, localOffset?: number) {
        const index = getDataOffset(name, particleIndex, localOffset || 0);
        console.assert(index < this._data.length);
        this._data[index] = value;
    }

    setVector3(name: Vector3Offset, particleIndex: number, value: Vector3) {
        this.setData(name, particleIndex, value.x, 0);
        this.setData(name, particleIndex, value.y, 1);
        this.setData(name, particleIndex, value.z, 2);
    }

    getVector3(name: Vector3Offset, particleIndex: number, result: Vector3) {
        result.x = this.getData(name, particleIndex, 0);
        result.y = this.getData(name, particleIndex, 1);
        result.z = this.getData(name, particleIndex, 2);
    }

    setColor(particleIndex: number, value: Color) {
        this.setData("color", particleIndex, value.r, 0);
        this.setData("color", particleIndex, value.g, 1);
        this.setData("color", particleIndex, value.b, 2);
    }

    getColor(particleIndex: number, result: Color) {
        result.r = this.getData("color", particleIndex, 0);
        result.g = this.getData("color", particleIndex, 1);
        result.b = this.getData("color", particleIndex, 2);        
    }

    setAlpha(particleIndex: number, value: number) {
        this.setData("color", particleIndex, value, 3);        
    }

    getAlpha(particleIndex: number) {
        return this.getData("color", particleIndex, 3);
    }
}

@Attributes.componentRequires(obj => {
    return obj instanceof Points && (obj as Points).material instanceof ShaderMaterial;
})
export class Particles extends Component<ParticlesProps, ParticleState> {

    constructor(props?: ParticlesProps) {
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
        geometry.setDrawRange(0, 1);
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
        if (this.state.particleCount + particlesToEmit > this.props.maxParticles) {
            particlesToEmit = this.props.maxParticles - this.state.particleCount;
        }

        let emittedParticles = 0;
        let particlesToProcess = particlesToEmit + this.state.particleCount;
        for (let i = 0; i < this.props.maxParticles; ++i) {
            if (particlesToProcess === 0) {
                // early break if no more particles to process
                break;
            }

            const [ particlePos, particleVelocity ] = pools.vec3.get(2);
            const active = this.state.getData("active", i);
            if (active === 0) {
                // free particle, use it for emission
                if (emittedParticles < particlesToEmit) {
                    this.state.setData("active", i, 1);

                    const life = randomRange(this.props.life)
                    this.state.setData("life", i, life);
                    this.state.setData("remainingLife", i, life);

                    this.state.setData("initialSize", i, randomRange(this.props.initialSize));
                    if (this.props.sizeOverLife.length > 0) {
                        const size = evaluateValueOverLife(this.props.sizeOverLife, 0);
                        this.state.setData("size", i, size);
                    } else {
                        this.state.setData("size", i, 1);
                    }
                                       
                    particlePos.set(
                        -1 + Math.random() * 2,
                        -1 + Math.random() * 2,
                        -1 + Math.random() * 2 
                    ).normalize().multiplyScalar(this.props.radius);
                    
                    if (this.props.direction === "awayFromCenter") {
                        particleVelocity.copy(particlePos).normalize();
                    } else {
                        particleVelocity.set(0, 1, 0);
                    }
                    particleVelocity.multiplyScalar(randomRange(this.props.initialSpeed));

                    this.state.setVector3("position", i, particlePos);
                    this.state.setVector3("velocity", i, particleVelocity);

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
                    this.state.getVector3("velocity", i, particleVelocity);

                    // apply gravity
                    particleVelocity.y += -this.props.gravity * deltaTime;
                    this.state.setData("velocity", i, particleVelocity.y, 1);

                    // apply speed
                    if (this.props.speedOverLife.length > 0) {
                        const speed = evaluateValueOverLife(this.props.speedOverLife, lifeFactor);
                        particleVelocity.normalize().multiplyScalar(speed);
                    }

                    // apply velocity
                    this.state.getVector3("position", i, particlePos);
                    particlePos.add(particleVelocity.multiplyScalar(deltaTime));
                    this.state.setVector3("position", i, particlePos);

                    // apply color
                    if (this.props.colorOverLife.length > 0) {
                        const color = evaluateColorOverLife(this.props.colorOverLife, lifeFactor);
                        this.state.setColor(i, color);
                    }

                    if (this.props.alphaOverLife.length > 0) {
                        const alpha = evaluateValueOverLife(this.props.alphaOverLife, lifeFactor);
                        this.state.setAlpha(i, alpha);
                    }

                    // apply size
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
        this.state.particleCount = this.state.particleCount;
        this.updateGeometry(owner as Points);
    }

    override dispose(_owner: Object3D) {

    }

    private updateGeometry(owner: Points) {
        const geometry = owner.geometry;
        const positions = geometry.getAttribute("position") as THREE.BufferAttribute;
        const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
        const sizes = geometry.getAttribute("size") as THREE.BufferAttribute;
        let index = 0;
        let particlesToProcess = this.state.particleCount;
        const [particlePos] = pools.vec3.get(1);        
        for (let i = 0; i < this.props.maxParticles; ++i) {
            if (particlesToProcess === 0) {
                // early break if no more particles to process
                break;
            }

            const active = this.state.getData("active", i);
            if (active === 0) {
                continue;
            }

            this.state.getVector3("position", i, particlePos);
            positions.setXYZ(index, particlePos.x, particlePos.y, particlePos.z);            

            // Apply size
            const size = this.state.getData("size", i);
            const initialSize = this.state.getData("initialSize", i);
            sizes.setX(index, initialSize * size);

            // Apply colors
            this.state.getColor(i, dummyColor);
            const alpha = this.state.getAlpha(i);
            colors.setXYZW(index, dummyColor.r, dummyColor.g, dummyColor.b, alpha);
            --particlesToProcess;
            index++;
        }
        
        geometry.setDrawRange(0, index);
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

