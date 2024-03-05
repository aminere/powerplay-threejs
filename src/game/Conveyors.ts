import { InstancedMesh, Matrix4, Mesh, Quaternion, Vector2, Vector3 } from "three";
import { gameMapState } from "./components/GameMapState";
import { objects } from "../engine/resources/Objects";
import { GameUtils } from "./GameUtils";
import { config } from "./config";

const maxConveyors = 500;
const matrix = new Matrix4();
const worldPos = new Vector3();
const rotation = new Quaternion();
const { cellSize } = config.game;
const scale = new Vector3(1, 1, 1).multiplyScalar(cellSize);

class Conveyors {
    private _baseMesh!: InstancedMesh;
    // private _topMesh: InstancedMesh | null = null;

    public async preload() {
        const conveyor = await objects.load(`/models/conveyor.json`);
        const baseMesh = conveyor.children.find(child => child.name === "Base") as Mesh;
        // const topMesh = conveyor.children.find(child => child.name === "Top") as Mesh;
        
        const instancedMesh = new InstancedMesh(baseMesh.geometry, baseMesh.material, maxConveyors);
        instancedMesh.name = "conveyors";
        instancedMesh.castShadow = true;
        instancedMesh.frustumCulled = false;
        instancedMesh.matrixAutoUpdate = false;
        instancedMesh.matrixWorldAutoUpdate = false;        
        instancedMesh.count = 0;
        gameMapState.layers.conveyors.add(instancedMesh);
        this._baseMesh = instancedMesh;
    }

    public create(mapCoords: Vector2) {
        GameUtils.mapToWorld(mapCoords, worldPos);
        worldPos.x -= cellSize / 2;
        worldPos.z -= cellSize / 2;
        matrix.compose(worldPos, rotation, scale);
        const count = this._baseMesh.count;
        this._baseMesh.setMatrixAt(count, matrix);
        this._baseMesh.count = count + 1;
        this._baseMesh.instanceMatrix.needsUpdate = true;
    }

    public clear(mapCoords: Vector2) {
    }
}

export const conveyors = new Conveyors();

