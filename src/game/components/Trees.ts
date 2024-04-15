
import { BufferAttribute, InstancedMesh, Material, MathUtils, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, RepeatWrapping, Vector2, Vector3, WebGLProgramParametersWithUniforms } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import FastNoiseLite from "fastnoise-lite";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { time } from "../../engine/core/Time";
import { textures } from "../../engine/resources/Textures";
import { GameMapState } from "./GameMapState";
import { treesManager } from "../TreesManager";

export class TreesProps extends ComponentProps {

    sectorRes = 1;
    speed = .1;
    strength = 2;
    frequency = .05;
    heightVar = 40;

    constructor(props?: Partial<TreesProps>) {
        super();
        this.deserialize(props);
    }
}

const treeNoise = new FastNoiseLite();
treeNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
const treeNoise2 = new FastNoiseLite();
treeNoise2.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
const { cellSize, mapRes, elevationStep } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;
const dummyTree = new Object3D();
dummyTree.name = "Tree";

export class Trees extends Component<TreesProps> {
    constructor(props?: Partial<TreesProps>) {
        super(new TreesProps(props));
    }

    override start(owner: Object3D) {

        const atlas = textures.load(`/models/atlas-albedo-LPUP.png`);
        const perlin = textures.load("/images/perlin.png");
        perlin.wrapS = RepeatWrapping;
        perlin.wrapT = RepeatWrapping;
        const treeMaterial = new MeshStandardMaterial({
            map: atlas,
            flatShading: true
        });

        Object.defineProperty(treeMaterial, "onBeforeCompile", {
            enumerable: false,
            value: (shader: WebGLProgramParametersWithUniforms) => {
                const uniforms = {
                    time: { value: 0 },
                    strength: { value: this.props.strength },
                    frequency: { value: this.props.frequency },
                    heightVar: { value: this.props.heightVar },
                    perlin: { value: perlin }
                };
                shader.uniforms = {
                    ...shader.uniforms,
                    ...uniforms
                };
                treeMaterial.userData.shader = shader;

                shader.vertexShader = `               
                uniform float time;
                uniform float strength;
                uniform float frequency;
                uniform float heightVar;
                uniform sampler2D perlin;
                ${shader.vertexShader}
                `;

                shader.vertexShader = shader.vertexShader.replace(
                    `#include <begin_vertex>`,
                    `#include <begin_vertex>

                    float rawNoise = texture2D(perlin, transformed.xz * frequency + time).r;                    
                    // [0, 1] to [-1, 1]
                    rawNoise = rawNoise * 2. - 1.;
                    
                    float heightFactor = 1.;//smoothstep(4., 10., transformed.y);
                    float radialFactor = smoothstep(0., 4., abs(transformed.x));
                    transformed.xz += rawNoise * heightFactor * radialFactor * strength;
                    `
                );
            }
        });

        const baseFreq = .03;
        treeNoise.SetFrequency(baseFreq);
        treeNoise2.SetFrequency(baseFreq * 2);

        const treeGeometries = treesManager.geometries;
        const { sectorRes } = this.props;
        const treeCellSize = cellSize * 1;
        const treeMapRes = Math.floor(mapRes * cellSize / treeCellSize);
        const treeMapSize = treeMapRes * treeCellSize;
        const maxTreesPerSector = treeMapRes * treeMapRes;
        const sectorCount = sectorRes * sectorRes;
        const maxTrees = maxTreesPerSector * sectorCount;
        const matrix = new Matrix4();
        const worldPos = new Vector3();
        const quaternion = new Quaternion();
        const scale = new Vector3(1, 1, 1);
        const up = new Vector3(0, 1, 0);
        const mapCoords = new Vector2();
        const localCoords = new Vector2();
        const verticesPerRow = mapRes + 1;
        const { sectors } = GameMapState.instance;

        const treeInstancedMeshes = treeGeometries.map((geometry, index) => {
            const instancedMesh = new InstancedMesh(geometry, treeMaterial, maxTrees);
            instancedMesh.name = `${treesManager.trees[index]}`;
            instancedMesh.castShadow = true;
            instancedMesh.frustumCulled = false;
            instancedMesh.matrixAutoUpdate = false;
            instancedMesh.matrixWorldAutoUpdate = false;
            owner.add(instancedMesh);
            return {
                instancedMesh,
                count: 0
            };
        });

        for (let i = 0; i < sectorRes; ++i) {
            for (let j = 0; j < sectorRes; ++j) {
                const sectorX = j;
                const sectorY = i;
                const sector = sectors.get(`${sectorX},${sectorY}`);
                const terrain = sector?.layers.terrain as Mesh;
                const position = terrain.geometry.getAttribute("position") as BufferAttribute;

                // lower distribution by skipping some sectors
                if (sectorY % 2 === 0) {
                    if (sectorX % 2 === 0) {
                        continue;
                    }                    
                } else {
                    if (sectorX % 2 !== 0) {
                        continue;
                    }
                }

                for (let k = 0; k < treeMapRes; ++k) {
                    for (let l = 0; l < treeMapRes; ++l) {
                        const leftEdge = j === 0 && l < 2;
                        if (leftEdge) {
                            continue;
                        }
                        const topEdge = i === 0 && k < 2;
                        if (topEdge) {
                            continue;
                        }

                        const localX = MathUtils.randFloat(treeCellSize * .3, treeCellSize * .7);
                        const localY = MathUtils.randFloat(treeCellSize * .3, treeCellSize * .7);
                        const plantSectorX = sectorX * treeMapSize;
                        const plantSectorY = sectorY * treeMapSize;
                        const plantWorldX = plantSectorX + l * treeCellSize + sectorOffset + localX;
                        const plantWorldY = plantSectorY + k * treeCellSize + sectorOffset + localY;
                        worldPos.set(plantWorldX, 0, plantWorldY);
                        GameUtils.worldToMap(worldPos, mapCoords);
                        const cell = GameUtils.getCell(mapCoords, undefined, localCoords);
                        if (!cell) {
                            continue;
                        }
                        const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
                        const _height1 = position.getY(startVertexIndex);
                        const _height2 = position.getY(startVertexIndex + 1);
                        const _height3 = position.getY(startVertexIndex + verticesPerRow);
                        const _height4 = position.getY(startVertexIndex + verticesPerRow + 1);
                        const _maxHeight = Math.max(_height1, _height2, _height3, _height4);
                        const _minHeight = Math.min(_height1, _height2, _height3, _height4);
                        if (_minHeight === _maxHeight && _minHeight >= 0 && _minHeight <= 1) {
                            const noiseX = (sectorX * mapRes) + localCoords.x;
                            const noiseY = (sectorY * mapRes) + localCoords.y;
                            const treeSample = treeNoise.GetNoise(noiseX, noiseY);
                            const treeSample2 = treeNoise2.GetNoise(noiseX, noiseY);
                            if (treeSample > 0 && treeSample2 > .5) {
                                const treeIndex = MathUtils.randInt(0, treeInstancedMeshes.length - 1);
                                worldPos.setY(_minHeight * elevationStep);
                                const minScale = 0.3;
                                const maxScale = 0.5;
                                scale.setScalar(minScale + (maxScale - minScale) * Math.random());
                                quaternion.setFromAxisAngle(up, MathUtils.randFloat(0, Math.PI * 2));
                                matrix.compose(worldPos, quaternion, scale);
                                const treeMesh = treeInstancedMeshes[treeIndex];
                                const count = treeMesh.count;
                                treeMesh.instancedMesh.setMatrixAt(count, matrix);
                                treeMesh.count = count + 1;
                                
                                cell.resource = {
                                    type: "wood",
                                    amount: 100,
                                    visual: dummyTree
                                };
                            }
                        }
                    }
                }
            }
        }

        for (const treeMesh of treeInstancedMeshes) {
            treeMesh.instancedMesh.count = treeMesh.count;
        }
    }

    override update(owner: Object3D) {
        const material = (owner.children[0] as InstancedMesh)?.material as Material;
        const uniforms = material?.userData?.shader?.uniforms;
        if (uniforms) {
            uniforms.time.value = time.time * this.props.speed;
            uniforms.heightVar.value = this.props.heightVar;
            uniforms.strength.value = this.props.strength;
        }
    }
}

