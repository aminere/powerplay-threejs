
import { InstancedMesh, MathUtils, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector2, Vector3 } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { textures } from "../../engine/Textures";
import { meshes } from "../../engine/Meshes";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { gameMapState } from "./GameMapState";

export class EnvPropsProps extends ComponentProps {

    mapSize = 1;

    constructor(props?: Partial<EnvPropsProps>) {
        super();
        this.deserialize(props);
    }
}

const { mapRes, cellSize, elevationStep } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;

export class EnvProps extends Component<EnvPropsProps> {

    constructor(props?: Partial<EnvPropsProps>) {
        super(new EnvPropsProps(props));
    }

    override start(owner: Object3D) {        

        const props = [
            `/models/props/grass-clumb.fbx`,
            `/models/props/rocks-small_brown.fbx`,
            `/models/props/cactus-medium.fbx`,
            `/models/props/stone-oval_brown.fbx`,
            `/models/props/stone-small_brown.fbx`
        ];

        const atlas = textures.load(`/models/atlas-albedo-LPUP.png`);
        const plantMaterial = new MeshStandardMaterial({
            map: atlas,
            flatShading: true
        });

        Promise.all(props.map(s => meshes.load(s)))
            .then(propMeshes => {
                const propCellSize = cellSize * 8;
                const propMapRes = Math.floor(mapRes * cellSize / propCellSize);
                const propMapSize = propMapRes * propCellSize;
                const worldPos = new Vector3();
                const scale = new Vector3();
                const quaternion = new Quaternion();
                const up = new Vector3(0, 1, 0);
                const matrix = new Matrix4();
                const mapCoords = new Vector2();
                const localCoords = new Vector2();
                const verticesPerRow = mapRes + 1;

                const geometries = propMeshes.map(m => m[0].geometry);
                const { mapSize } = this.props;
                const sectorCount = mapSize * mapSize;
                const maxPropsPerSector = propMapRes * propMapRes;
                const maxProps = maxPropsPerSector * sectorCount;
                const instancedMeshes = geometries.map((geometry, index) => {
                    const instancedMesh = new InstancedMesh(geometry, plantMaterial, maxProps);
                    instancedMesh.name = `props-${index}`;
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

                const { sectors } = gameMapState;
                for (let i = 0; i < mapSize; ++i) {
                    for (let j = 0; j < mapSize; ++j) {
                        const sectorX = j;
                        const sectorY = i;
                        const sector = sectors.get(`${sectorX},${sectorY}`);
                        const terrain = sector?.layers.terrain as Mesh;
                        const position = terrain.geometry.getAttribute("position") as THREE.BufferAttribute;

                        for (let k = 0; k < propMapRes; ++k) {
                            for (let l = 0; l < propMapRes; ++l) {
                                const localX = MathUtils.randFloat(0, propCellSize);
                                const localY = MathUtils.randFloat(0, propCellSize);
                                const propSectorX = sectorX * propMapSize;
                                const propSectorY = sectorY * propMapSize;
                                const propWorldX = propSectorX + k * propCellSize + sectorOffset + localX;
                                const propWorldY = propSectorY + l * propCellSize + sectorOffset + localY;
                                worldPos.set(propWorldX, 0, propWorldY);
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
                                    const propIndex = MathUtils.randInt(0, instancedMeshes.length - 1);                                    
                                    worldPos.setY(_minHeight * elevationStep);
                                    const minScale = 0.002;
                                    const maxScale = 0.007;
                                    scale.setScalar(minScale + (maxScale - minScale) *  Math.random());
                                    quaternion.setFromAxisAngle(up, MathUtils.randFloat(0, Math.PI * 2));
                                    matrix.compose(worldPos, quaternion, scale);
                                    const propMesh = instancedMeshes[propIndex];
                                    const count = propMesh.count;
                                    propMesh.instancedMesh.setMatrixAt(count, matrix);
                                    propMesh.count = count + 1;
                                }
                            }
                        }
                    }
                }

                for (const mesh of instancedMeshes) {
                    mesh.instancedMesh.count = mesh.count;
                }
            });
    }
}

