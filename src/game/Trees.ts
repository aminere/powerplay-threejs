import { BufferAttribute, InstancedMesh, Material, MathUtils, Matrix4, Mesh, MeshStandardMaterial, Quaternion, RepeatWrapping, Vector2, Vector3, WebGLProgramParametersWithUniforms } from "three";
import { meshes } from "../engine/resources/Meshes";
import FastNoiseLite from "fastnoise-lite";
import { config } from "./config/config";
import { time } from "../engine/core/Time";
import { textures } from "../engine/resources/Textures";
import { GameMapState } from "./components/GameMapState";
import { GameUtils } from "./GameUtils";
import { ICell } from "./GameTypes";

const models = [
    // "palm-high",
    // "palm-round",
    "palm-big",
    "palm"
];

const speed = .1;
const strength = 2;
const frequency = .05;
const treeNoise = new FastNoiseLite();
treeNoise.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
const treeNoise2 = new FastNoiseLite();
treeNoise2.SetNoiseType(FastNoiseLite.NoiseType.OpenSimplex2);
const { cellSize, mapRes, elevationStep } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;

const matrix = new Matrix4();
const worldPos = new Vector3();
const quaternion = new Quaternion();
const scale = new Vector3(1, 1, 1);

const treeCellSize = cellSize * 1;
const treeMapRes = Math.floor(mapRes * cellSize / treeCellSize);
const treeMapSize = treeMapRes * treeCellSize;
const maxTreesPerSector = treeMapRes * treeMapRes;

const minScale = 0.3;
const maxScale = 0.5;
function getRandomTreeMatrix(_worldPos: Vector3) {
    scale.setScalar(minScale + (maxScale - minScale) * Math.random());
    quaternion.setFromAxisAngle(GameUtils.vec3.up, MathUtils.randFloat(0, Math.PI * 2));
    return matrix.compose(_worldPos, quaternion, scale);
}

class Trees {

    private _material!: Material;
    private _meshes!: Array<Mesh[]>;
    private _instancedMeshes!: InstancedMesh[];
    private _treeCells: Array<ICell[]> = [];
    private _loaded = false;
    private _disposed = false;    

    public async preload() {
        
        if (this._loaded) {
            return;
        }
    
        this._disposed = false;
        this._meshes = await Promise.all(models.map(s => meshes.load(`/models/trees/${s}.fbx`)));

        if (this._disposed) {
            return;
        }

        const atlas = textures.load(`/models/atlas-albedo-LPUP.png`);
        const perlin = textures.load("/images/perlin.png");
        perlin.wrapS = RepeatWrapping;
        perlin.wrapT = RepeatWrapping;
        const material = new MeshStandardMaterial({ map: atlas });
        this._material = material;
        Object.defineProperty(material, "onBeforeCompile", {
            enumerable: false,
            value: (shader: WebGLProgramParametersWithUniforms) => {
                const uniforms = {
                    time: { value: 0 },
                    strength: { value: strength },
                    frequency: { value: frequency },
                    perlin: { value: perlin }
                };
                shader.uniforms = {
                    ...shader.uniforms,
                    ...uniforms
                };
                material.userData.shader = shader;

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

        this._loaded = true;
    }

    public init(sectorRes: number) {
        const sectorCount = sectorRes * sectorRes;
        const maxTrees = maxTreesPerSector * sectorCount;
        const { layers } = GameMapState.instance;
        this._treeCells.length = 0;
        this._instancedMeshes = this._meshes.map(([mesh], index) => {
            const geometry = mesh.geometry;
            const instancedMesh = new InstancedMesh(geometry, this._material, maxTrees);
            instancedMesh.name = `${models[index]}`;
            instancedMesh.castShadow = true;
            instancedMesh.frustumCulled = false;
            instancedMesh.matrixAutoUpdate = false;
            instancedMesh.matrixWorldAutoUpdate = false;
            instancedMesh.count = 0;
            layers.trees.add(instancedMesh);
            this._treeCells.push([]);
            return instancedMesh;
        });
    }

    public dispose() {
        this._disposed = true;
        this._treeCells.length = 0;
    }

    public update() {
        const uniforms = this._material.userData?.shader?.uniforms;
        if (uniforms) {
            uniforms.time.value = time.time * speed;
            uniforms.strength.value = strength;
        }
    }

    public createRandomTree(cell: ICell, worldPos: Vector3, out: { instancedMesh: InstancedMesh, instanceIndex: number }) {
        const treeIndex = MathUtils.randInt(0, this._instancedMeshes.length - 1);
        const instancedMesh = this._instancedMeshes[treeIndex];
        const count = instancedMesh.count;
        matrix.compose(worldPos, quaternion, scale.setScalar(0)); // will be lazily revealed by fog of war
        instancedMesh.setMatrixAt(count, matrix);
        instancedMesh.instanceMatrix.needsUpdate = true;
        instancedMesh.count = count + 1;
        out.instancedMesh = instancedMesh;
        out.instanceIndex = count;
        this._treeCells[treeIndex].push(cell);
    }

    public removeTree(instancedMesh: InstancedMesh, instanceIndex: number) {
        const count = instancedMesh.count;
        const newCount = count - 1;
        for (let i = instanceIndex; i < newCount; i++) {
            instancedMesh.getMatrixAt(i + 1, matrix);
            instancedMesh.setMatrixAt(i, matrix);
        }

        const listIndex = this._instancedMeshes.indexOf(instancedMesh);
        const cells = this._treeCells[listIndex];
        cells.splice(instanceIndex, 1);
        for (let i = instanceIndex; i < newCount; i++) {
            const cell = cells[i];
            const oldInstanceIndex = cell.resource!.instanceIndex!;
            cell.resource!.instanceIndex = oldInstanceIndex - 1;
        }

        instancedMesh.count = newCount;
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    public revealTree(instancedMesh: InstancedMesh, instanceIndex: number) {
        instancedMesh.getMatrixAt(instanceIndex, matrix);
        worldPos.setFromMatrixPosition(matrix);
        instancedMesh.setMatrixAt(instanceIndex, getRandomTreeMatrix(worldPos));
        instancedMesh.instanceMatrix.needsUpdate = true;
    }

    public generate(sectorRes: number) {
        const baseFreq = .03;
        treeNoise.SetFrequency(baseFreq);
        treeNoise2.SetFrequency(baseFreq * 2);

        const mapCoords = new Vector2();
        const localCoords = new Vector2();
        const verticesPerRow = mapRes + 1;
        const { sectors } = GameMapState.instance;

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
                                const treeIndex = MathUtils.randInt(0, this._instancedMeshes.length - 1);
                                worldPos.setY(_minHeight * elevationStep);
                                const matrix = getRandomTreeMatrix(worldPos);
                                const treeMesh = this._instancedMeshes[treeIndex];
                                const count = treeMesh.count;
                                treeMesh.setMatrixAt(count, matrix);
                                treeMesh.count = count + 1;
                                cell.resource = { type: "wood", amount: 100 };
                            }
                        }
                    }
                }
            }
        }

        for (const mesh of this._instancedMeshes) {
            mesh.instanceMatrix.needsUpdate = true;
        }
    }

    public clear() {

    }
}

export const trees = new Trees();

