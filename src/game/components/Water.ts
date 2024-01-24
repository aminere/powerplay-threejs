
import { Euler, Float32BufferAttribute, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion, Vector3 } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { time } from "../../engine/Time";
import FastNoiseLite from "fastnoise-lite";
import { config } from "../config";

export class WaterProps extends ComponentProps {

    strength = .2;
    frequency = .5;
    speed = .5;

    constructor(props?: Partial<WaterProps>) {
        super();
        this.deserialize(props);
    }
}

const noise = new FastNoiseLite();
noise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
noise.SetFractalType(FastNoiseLite.FractalType.FBm);
const { mapRes, cellSize } = config.game;

export class Water extends Component<WaterProps> {
    constructor(props?: Partial<WaterProps>) {
        super(new WaterProps(props));
    }

    override start(owner: Object3D) {
        const patchSize = mapRes * cellSize;
        const geometry = new PlaneGeometry(patchSize, patchSize, 32, 32);
        const material = new MeshStandardMaterial({ color: 0x5199DB, flatShading: true, opacity: .5, transparent: true });
        
        const rowSize = 4;
        const count = rowSize * rowSize;
        const plane = new InstancedMesh(geometry, material, count);
        // plane.rotateX(-Math.PI / 2);
        
        const matrix = new Matrix4();
        const position = new Vector3();        
        const scale = new Vector3(1, 1, 1);
        const quaternion = new Quaternion();
        quaternion.setFromEuler(new Euler(-Math.PI / 2, 0, 0));
        for (let i = 0; i < rowSize; ++i) {
            for (let j = 0; j < rowSize; ++j) {
                const index = i * rowSize + j;
                position.set(i * patchSize, 0, j * patchSize);
                matrix.compose(position, quaternion, scale);
                plane.setMatrixAt(index, matrix);
            }
        }

        owner.add(plane);
    }

    override update(owner: Object3D) {
        const geometry = (owner.children[0] as Mesh).geometry as PlaneGeometry;
        const positions = geometry.getAttribute("position") as Float32BufferAttribute;
        const verticesPerRow = Math.sqrt(positions.count);
        console.assert(verticesPerRow === Math.floor(verticesPerRow));
        const { strength, frequency, speed } = this.props;
        noise.SetFrequency(frequency);

        const setFromNoise = (i: number, j: number) => {
            const offset = time.time * speed;
            const normalized = (noise.GetNoise(i + offset, j + offset) + 1) / 2;
            const sample = -strength + normalized * strength * 2;
            const index = i * verticesPerRow + j;
            positions.setZ(index, sample);
        };

        for (let i = 0; i < verticesPerRow; ++i) {
            for (let j = 0; j < verticesPerRow; ++j) {
                const index = i * verticesPerRow + j;
                
                // make it seamless
                if (j === 0) {
                    if (i === verticesPerRow - 1) {
                        positions.setZ(index, positions.getZ(0 * verticesPerRow + 0));
                    } else {
                        setFromNoise(i, j);
                    }
                } else if (j === verticesPerRow - 1) {
                    if (i === 0) {
                        positions.setZ(index, positions.getZ(0 * verticesPerRow + 0));
                    } else if (i === verticesPerRow - 1) {
                        positions.setZ(index, positions.getZ(0 * verticesPerRow + 0));
                    } else {
                        positions.setZ(index, positions.getZ(i * verticesPerRow + 0));
                    }                
                } else if (i === verticesPerRow - 1) {
                    positions.setZ(index, positions.getZ(0 * verticesPerRow + j));
                } else {
                    setFromNoise(i, j);
                }
            }
        }
        // geometry.computeVertexNormals();
        positions.needsUpdate = true;
    }
}


