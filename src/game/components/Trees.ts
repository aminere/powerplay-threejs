
import { MathUtils, Mesh, MeshPhongMaterial, Object3D, TextureLoader, Vector2, Vector3 } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { meshes } from "../../engine/Meshes";
import FastNoiseLite from "fastnoise-lite";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "./GameMapState";
import { engine } from "../../engine/Engine";
import { utils } from "../../engine/Utils";

export class TreesProps extends ComponentProps {

    mapSize = 1;

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

export class Trees extends Component<TreesProps> {
    constructor(props?: Partial<TreesProps>) {
        super(new TreesProps(props));
    }

    override start(_owner: Object3D) {
        const trees = [
            "palm-high",
            "palm-big",
            "palm",
            "palm-round",
        ];

        const atlas = new TextureLoader().load(`/models/atlas-albedo-LPUP.png`);

        Promise.all([
            ...trees.map(s => meshes.load(`/models/trees/${s}.fbx`))
        ])
            .then(treeMeshes => {

                treeNoise.SetFrequency(.05);
                treeNoise2.SetFrequency(.05 * .5);
                const treeLib = treeMeshes.map(m => m[0]);
                const treeCellSize = cellSize * 2;
                const treeMapRes = Math.floor(mapRes * cellSize / treeCellSize);
                const treeMapSize = treeMapRes * treeCellSize;
                const worldPos = new Vector3();
                const mapCoords = new Vector2();
                const localCoords = new Vector2();
                const verticesPerRow = mapRes + 1;
                const { sectors } = gameMapState;
                const trees = utils.createObject(engine.scene!, "trees");

                for (let i = 0; i < this.props.mapSize; ++i) {
                    for (let j = 0; j < this.props.mapSize; ++j) {
                        const sectorX = j;
                        const sectorY = i;
                        const sector = sectors.get(`${sectorX},${sectorY}`);
                        const terrain = sector?.layers.terrain as Mesh;
                        const position = terrain.geometry.getAttribute("position") as THREE.BufferAttribute;
                        for (let i = 0; i < treeMapRes; ++i) {
                            for (let j = 0; j < treeMapRes; ++j) {
                                const localX = MathUtils.randFloat(0, treeCellSize);
                                const localY = MathUtils.randFloat(0, treeCellSize);
                                const plantSectorX = sectorX * treeMapSize;
                                const plantSectorY = sectorY * treeMapSize;
                                const plantWorldX = plantSectorX + i * treeCellSize + sectorOffset + localX;
                                const plantWorldY = plantSectorY + j * treeCellSize + sectorOffset + localY;
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
                                    const treeSample = treeNoise.GetNoise((sectorX * mapRes) + localCoords.x, (sectorY * mapRes) + localCoords.y);
                                    const treeSample2 = treeNoise2.GetNoise((sectorX * mapRes) + localCoords.x, (sectorY * mapRes) + localCoords.y);
                                    if (treeSample > 0 && treeSample2 > 0) {
                                        const treeIndex = MathUtils.randInt(0, treeLib.length - 1);
                                        const meshInstance = treeLib[treeIndex].clone();
                                        const material = meshInstance.material as MeshPhongMaterial;
                                        material.map = atlas;
                                        meshInstance.castShadow = true;
                                        const factor = Math.random();
                                        const minScale = 0.003;
                                        const maxScale = 0.005;
                                        meshInstance.scale.setScalar(minScale + (maxScale - minScale) * factor);
                                        meshInstance.rotateY(MathUtils.randFloat(0, Math.PI * 2));
                                        meshInstance.position.set(
                                            worldPos.x /*- sectorRoot.position.x*/,
                                            _minHeight * elevationStep,
                                            worldPos.z /*- sectorRoot.position.z*/
                                        );

                                        trees.add(meshInstance);
                                        // resources.add(meshInstance);
                                    }
                                }
                            }
                        }
                    }
                }
            });
    }

    override update(_owner: Object3D) {
    }
}

