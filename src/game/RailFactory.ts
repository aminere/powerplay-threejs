import { GameUtils } from "./GameUtils";
import { InstancedMesh, Matrix4, Mesh, Object3D, Quaternion, Vector3 } from "three";
import { config } from "./config";
import { BezierPath } from "./BezierPath";
import { IRailUserData } from "./GameTypes";
import { meshes } from "../engine/resources/Meshes";
import { GameMapState } from "./components/GameMapState";

const { cellSize } = config.game;
const halfCell = cellSize / 2;
const barOffset = cellSize / 4;
const yOffset = 0.03;

const point = new Vector3();
const tangent = new Vector3();
const curvedPos = new Vector3();
const lookAtPos = new Vector3();
const lookAtMat = new Matrix4();
const lookAtQuat = new Quaternion();
const maxBarCount = 2048;

const matrix = new Matrix4();
const barMatrix = new Matrix4();

class RailFactory {

    public get railBars() { return this._railBars; }

    private _curvedRails = new Map<string, {
        mesh: THREE.Object3D;
        curve: BezierPath;
    }>();

    private _curvedRail!: Mesh; 
    private _straightRail!: Mesh;

    private _railBars!: InstancedMesh;

    public async preload() {
        const [curvedRail] = await meshes.load('/models/rail-curved.glb');        
        curvedRail.castShadow = true;
        this._curvedRail = curvedRail.clone();

        const [straightRail] = await meshes.load('/models/rail-straight.glb');
        straightRail.castShadow = true;
        this._straightRail = straightRail.clone();

        const [barMesh] = await meshes.load('/models/rail-bar.glb');

        const bars = new InstancedMesh(barMesh.geometry, barMesh.material, maxBarCount);
        bars.name = "railBars";
        bars.frustumCulled = false;
        bars.matrixAutoUpdate = false;
        bars.matrixWorldAutoUpdate = false;
        bars.count = 0;
        bars.castShadow = true;
        this._railBars = bars;        
        GameMapState.instance.layers.rails.add(bars);
    }

    public dispose() {
        this._railBars.count = 0;
    }

    public makeRail(worldPos: Vector3, length: number, rotation: number) {
        const container = new Object3D();
        const mesh = this._straightRail.clone();
        mesh.position.set(0, yOffset, -halfCell);
        mesh.scale.set(cellSize, 1, length * cellSize);
        container.add(mesh);

        const rotationY = Math.PI / 2 * rotation;
        container.position.copy(worldPos);
        container.rotateY(rotationY);
        container.updateMatrix();

        let instanceIndex = this._railBars.count;
        const barCount = length * 2;
        if (instanceIndex + barCount > maxBarCount) {
            return null;
        }

        for (let i = 0; i < length; ++i) {
            barMatrix.makeTranslation(0, 0, 0 + i * cellSize - barOffset);
            matrix.multiplyMatrices(container.matrix, barMatrix);
            this._railBars.setMatrixAt(instanceIndex, matrix);            
            barMatrix.makeTranslation(0, 0, i * cellSize + barOffset);
            matrix.multiplyMatrices(container.matrix, barMatrix);
            this._railBars.setMatrixAt(instanceIndex + 1, matrix);
            instanceIndex += 2;
        }
        
        const userData: IRailUserData = {
            rotation: rotationY,
            barInstanceIndex: this._railBars.count,
            barCount
        };

        this._railBars.count = instanceIndex;
        this._railBars.instanceMatrix.needsUpdate = true;
        container.userData = userData;
        return container;
    }

    public makeCurvedRail(worldPos: Vector3, turnRadius: number, rotation: number, directionX: number) {
        const id = `${turnRadius}_${directionX}`;
        const existingRail = this._curvedRails.get(id);
        const container = new Object3D();
        const rotationY = Math.PI / 2 * rotation;
        container.position.copy(worldPos);
        container.rotateY(rotationY);
        container.updateMatrix();

        const rail = (() => {
            if (existingRail) {
                container.add(existingRail.mesh.clone());
                return existingRail;

            } else {
                const x1 = 0;
                const x2 = (cellSize * turnRadius / 2 - halfCell) * directionX;
                const x3 = (cellSize * turnRadius - halfCell) * directionX;
                const z1 = 0;
                const z2 = cellSize * turnRadius / 2;
                const z3 = cellSize * turnRadius - halfCell;
    
                const curve = new BezierPath();
                curve.setPoints([
                    new Vector3(x1, 0, z1),
                    new Vector3(x1, 0, z2),
                    new Vector3(x2, 0, z3),
                    new Vector3(x3, 0, z3)
                ]);           
    
                const mesh = this._curvedRail.clone();
                mesh.geometry = (mesh.geometry as THREE.BufferGeometry).clone();
                const vertices = mesh.geometry.getAttribute("position") as THREE.BufferAttribute;
                const minZ = 0;
                const maxZ = 1;                
                for (let i = 0; i < vertices.count; ++i) {
                    const t = (vertices.getZ(i) - minZ) / (maxZ - minZ);
                    curve.evaluate(t, point);
                    const bitangent = curve.evaluateBitangent(t, tangent);
    
                    curvedPos.copy(point);
                    curvedPos.x += halfCell;
                    curvedPos
                        .addScaledVector(bitangent, -vertices.getX(i) * cellSize)
                        .addScaledVector(GameUtils.vec3.up, vertices.getY(i));
                    vertices.setXYZ(i, curvedPos.x, curvedPos.y, curvedPos.z);
                }
    
                vertices.needsUpdate = true;
                mesh.geometry.computeBoundingSphere();
                mesh.geometry.computeVertexNormals();
                mesh.position.set(-halfCell, yOffset, -halfCell);
                mesh.updateMatrix();
                container.add(mesh);
                this._curvedRails.set(id, { mesh, curve });
                return { mesh, curve };
            }
        })();

        const { mesh, curve } = rail;
        const curveLength = curve.length;            
        const startOffset = barOffset;
        let currentOffset = startOffset;

        const startInstanceIndex = this._railBars.count;
        const barCount = Math.ceil((curveLength - startOffset) / halfCell);
        if (startInstanceIndex + barCount > maxBarCount) {
            return null;
        }

        for (let i = 0; i < barCount; ++i) {
            const t = currentOffset / curveLength;
            curve.evaluate(t, point);
            curve.evaluateTangent(t, tangent);

            point.x += halfCell;
            lookAtPos.addVectors(point, tangent);
            barMatrix.compose(
                point,
                lookAtQuat.setFromRotationMatrix(lookAtMat.lookAt(point, lookAtPos, container.up)),
                GameUtils.vec3.one
            );

            matrix.copy(container.matrix).multiply(mesh.matrix).multiply(barMatrix);
            this._railBars.setMatrixAt(startInstanceIndex + i, matrix);
            
            currentOffset += halfCell;
        }
        
        const userData: IRailUserData = {
            curve,
            rotation: rotationY,
            barInstanceIndex: startInstanceIndex,
            barCount
        };

        container.userData = userData;
        this._railBars.count = this._railBars.count + barCount;
        this._railBars.instanceMatrix.needsUpdate = true;
        return container;
    }
}

export const railFactory = new RailFactory();

