import { Color, Vector3 } from "three";
import { IComponentState } from "../ecs/Component";

const dataOffsets = {    
    position: 0, // Vector3    
    direction: 3, // Vector3
    color: 6, // Color RGBA    
    life: 10, // number    
    remainingLife: 11, // number    
    size: 12, // number    
    initialSize: 13, // number    
    speed: 14, // number
    active: 15, // number
    MAX: 16
};

type DataOffset = Exclude<keyof typeof dataOffsets, "MAX">;
type Vector3Offset = "position" | "direction";

function getDataOffset(name: DataOffset, particleIndex: number, localOffset: number) {
    return (particleIndex * dataOffsets.MAX) + dataOffsets[name] + localOffset;
}

export class ParticlesState implements IComponentState {

    public particleCount = 0;
    public newParticlesCounter = 0;
    public isEmitting = true;
    public emitTime = -1;

    private _data: number[];

    constructor(maxParticles: number) {
        this._data = new Array(maxParticles * dataOffsets.MAX).fill(0);
    }

    getData(name: DataOffset, particleIndex: number, localOffset?: number) {
        const index = getDataOffset(name, particleIndex, localOffset ?? 0);
        console.assert(index < this._data.length);
        return this._data[index];
    }

    setData(name: DataOffset, particleIndex: number, value: number, localOffset?: number) {
        const index = getDataOffset(name, particleIndex, localOffset ?? 0);
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

