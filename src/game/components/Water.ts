
import { Euler, InstancedMesh, Material, Matrix4, MeshStandardMaterial, Object3D, PlaneGeometry, Quaternion, RepeatWrapping, Vector3, WebGLProgramParametersWithUniforms } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { time } from "../../engine/core/Time";
import { config } from "../config";
import { textures } from "../../engine/resources/Textures";

export class WaterProps extends ComponentProps {

    strength = 1;
    frequency = 3;
    speed = .1;
    sectorRes = 1;

    constructor(props?: Partial<WaterProps>) {
        super();
        this.deserialize(props);
    }
}

const { mapRes, cellSize } = config.game;

export class Water extends Component<WaterProps> {

    private _material: Material | null = null;

    constructor(props?: Partial<WaterProps>) {
        super(new WaterProps(props));
    }

    override start(owner: Object3D) {
        const patchSize = mapRes * cellSize;
        const geometry = new PlaneGeometry(patchSize, patchSize, mapRes, mapRes);
        
        const perlin = textures.load("/images/perlin.png");
        perlin.wrapS = RepeatWrapping;
        perlin.wrapT = RepeatWrapping;
        const waterMaterial = new MeshStandardMaterial({
            flatShading: true,
            transparent: true,
            opacity: 0.5,
            color: 0x339CFF
        });
        this._material = waterMaterial;

        Object.defineProperty(waterMaterial, "onBeforeCompile", {
            enumerable: false,
            value: (shader: WebGLProgramParametersWithUniforms) => {
                const uniforms = {
                    time: { value: 0 },
                    strength: { value: this.props.strength },
                    frequency: { value: this.props.frequency },
                    perlin: { value: perlin }
                };
                shader.uniforms = {
                    ...shader.uniforms,
                    ...uniforms
                };
                waterMaterial.userData.shader = shader;
    
                shader.vertexShader = `               
                uniform float time;
                uniform float strength;
                uniform float frequency;
                uniform sampler2D perlin;
                ${shader.vertexShader}
                `;
    
                shader.vertexShader = shader.vertexShader.replace(
                    `#include <begin_vertex>`,
                    `#include <begin_vertex>

                    // [-mapRes / 2, mapRes / 2] to [0, 1]
                    vec2 coord = (transformed.xy / ${mapRes}.) + .5;
                    float rawNoise = texture2D(perlin, coord * frequency + time).r;
                    // [0, 1] to [-1, 1]
                    rawNoise = rawNoise * 2. - 1.;                    
                    transformed.z = rawNoise * strength;
                    `
                );
            }
        });     

        const rowSize = this.props.sectorRes;
        const count = rowSize * rowSize;
        const waterMesh = new InstancedMesh(geometry, waterMaterial, count);        
        waterMesh.frustumCulled = false;
        waterMesh.matrixAutoUpdate = false;
        waterMesh.matrixWorldAutoUpdate = false;        

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
                waterMesh.setMatrixAt(index, matrix);
            }
        }

        owner.add(waterMesh);
    }

    override update() {
        const shader = this._material?.userData.shader;
        if (shader) {
            shader.uniforms.time.value = time.time * this.props.speed;
            shader.uniforms.frequency.value = this.props.frequency;
            shader.uniforms.strength.value = this.props.strength;
        }
    }
}

