
import { InstancedMesh, MathUtils, Matrix4, MeshStandardMaterial, Object3D, Quaternion, Vector2, Vector3 } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { textures } from "../../engine/resources/Textures";
import { meshes } from "../../engine/resources/Meshes";
import { GameUtils } from "../GameUtils";
import { config } from "../config/config";

export class EnvPropsProps extends ComponentProps {

    sectorRes = 1;

    constructor(props?: Partial<EnvPropsProps>) {
        super();
        this.deserialize(props);
    }
}

const { mapRes, cellSize } = config.game;
const mapSize = mapRes * cellSize;
const sectorOffset = -mapSize / 2;
const sectorCoords = new Vector2();
const matrix = new Matrix4();
const mapCoords = new Vector2();
const localCoords = new Vector2();
const worldPos = new Vector3();
const scale = new Vector3();
const quaternion = new Quaternion();

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

                const geometries = propMeshes.map(m => m[0].geometry);
                const { sectorRes } = this.props;
                const sectorCount = sectorRes * sectorRes;
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

                for (let i = 0; i < sectorRes; ++i) {
                    for (let j = 0; j < sectorRes; ++j) {
                        const sectorX = j;
                        const sectorY = i;
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
                                const cell = GameUtils.getCell(mapCoords, sectorCoords, localCoords);
                                if (!cell) {
                                    continue;
                                }                                
                                const sector = GameUtils.getSector(sectorCoords)!;
                                const y = GameUtils.getMapHeight(mapCoords, localCoords, sector, worldPos.x, worldPos.z)
                                worldPos.setY(y);
                                const propIndex = MathUtils.randInt(0, instancedMeshes.length - 1);
                                const minScale = 0.002;
                                const maxScale = 0.007;
                                scale.setScalar(minScale + (maxScale - minScale) *  Math.random());
                                quaternion.setFromAxisAngle(GameUtils.vec3.up, MathUtils.randFloat(0, Math.PI * 2));
                                matrix.compose(worldPos, quaternion, scale);
                                const propMesh = instancedMeshes[propIndex];
                                const count = propMesh.count;
                                propMesh.instancedMesh.setMatrixAt(count, matrix);
                                propMesh.count = count + 1;                               
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

