import { BufferAttribute, Color, Object3D, Points, PointsMaterial, Vector2, Vector3 } from "three";
import { Component, IComponentProps, IComponentState } from "../Component";
import { serialization } from "../Serialization";
import { TArray } from "../TArray";
import * as Attributes from "../../engine/Attributes";

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
    speedOverLife = new TArray(Number);
    sizeOverLife = new TArray(Number);
    colorOverLife = new TArray(Color);
}

type ColorOffset = "color";
type Vector3Offset = "position" | "velocity";
export type DataOffset =
    Vector3Offset
    | ColorOffset
    | "life"
    | "remainingLife"
    | "size"
    | "active";

const dataOffsets: { [name: string]: number } = {
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
    active: 13,
    MAX: 14
};

function getDataOffset(name: DataOffset, particleIndex: number, localOffset: number) {
    return (particleIndex * dataOffsets.MAX) + dataOffsets[name] + localOffset;
}

class ParticleState implements IComponentState {

    private _data: number[];

    constructor(maxParticles: number) {
        this._data = new Array(maxParticles * dataOffsets.MAX).fill(0);
    }

    getData(name: DataOffset, particleIndex: number, localOffset?: number) {
        const index = getDataOffset(name, particleIndex, localOffset || 0);
        if (process.env.CONFIG === "editor") {
            console.assert(index < this._data.length);
        }
        return this._data[index];
    }

    setData(name: DataOffset, particleIndex: number, value: number, localOffset?: number) {
        const index = getDataOffset(name, particleIndex, localOffset || 0);
        if (process.env.CONFIG === "editor") {
            console.assert(index < this._data.length);
        }
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
}

@Attributes.componentRequires(obj => {
    return obj instanceof Points && (obj as Points).material instanceof PointsMaterial;
})
export class Particles extends Component<ParticlesProps, ParticleState> {

    constructor(props?: ParticlesProps) {
        super(new ParticlesProps(props));
    }

    override start(_owner: Points) {
        const geometry = _owner.geometry;
        const vertices = new Float32Array([...Array(this.props.maxParticles)].flatMap(_ => [0, 0, 0]));
        const colors = new Float32Array([...Array(this.props.maxParticles)].flatMap(_ => [1, 0, 0, .5]));
        geometry.setAttribute('position', new BufferAttribute(vertices, 3));
        geometry.setAttribute('color', new BufferAttribute(colors, 4));
        geometry.setDrawRange(0, 1);
        this.setState(new ParticleState(this.props.maxParticles));
    }

    override update(_owner: Object3D) {

    }

    override dispose(_owner: Object3D) {

    }
}

