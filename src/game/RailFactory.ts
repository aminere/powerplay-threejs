import { GameUtils } from "./GameUtils";
import { Mesh, Object3D, Vector3 } from "three";
import { config } from "./config";
import { BezierPath } from "./BezierPath";
import { IRailUserData } from "./GameTypes";
import { meshes } from "../engine/resources/Meshes";

const { cellSize } = config.game;
const halfCell = cellSize / 2;
const barOffset = cellSize / 4;
const yOffset = 0.001;

const point = new Vector3();
const tangent = new Vector3();
const curvedPos = new Vector3();
const lookAt = new Vector3();

class RailFactory {

    private _curvedRails = new Map<string, {
        mesh: THREE.Object3D;
        curve: BezierPath;
    }>();

    private _curvedRail!: Mesh; 
    private _straightRail!: Mesh;   
    private _barMesh!: Mesh;

    public async preload() {
        const [curvedRail] = await meshes.load('/models/rail-curved.glb');        
        curvedRail.castShadow = true;
        this._curvedRail = curvedRail.clone();

        const [straightRail] = await meshes.load('/models/rail-straight.glb');
        straightRail.castShadow = true;
        this._straightRail = straightRail.clone();

        const [barMesh] = await meshes.load('/models/rail-bar.glb');
        this._barMesh = barMesh.clone();
    }

    public makeRail(length: number, rotation: number) {
        const container = new Object3D();
        const mesh = this._straightRail.clone();
        mesh.position.set(0, yOffset, -halfCell);
        mesh.scale.set(cellSize, 1, length * cellSize);
        container.add(mesh);

        for (let i = 0; i < length; ++i) {
            const barMesh1 = this._barMesh.clone();
            barMesh1.position.set(0, 0, i * cellSize - barOffset);
            container.add(barMesh1);
            const barMesh2 = this._barMesh.clone();
            barMesh2.position.set(0, 0, i * cellSize + barOffset);
            container.add(barMesh2);
        }

        const rotationY = Math.PI / 2 * rotation;
        container.rotateY(rotationY);
        const userData: IRailUserData = {
            rotation: rotationY
        };
        container.userData = userData;
        return container;
    }

    public makeCurvedRail(turnRadius: number, rotation: number, directionX: number) {
        const id = `${turnRadius}_${directionX}`;
        const existingRail = this._curvedRails.get(id);
        const container = new Object3D();
        const rotationY = Math.PI / 2 * rotation;
        container.rotateY(rotationY);
        if (existingRail) {
            container.add(existingRail.mesh.clone());
            const userData: IRailUserData = {
                curve: existingRail.curve,
                rotation: rotationY
            };
            container.userData = userData;
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
            // let [minZ, maxZ] = [Infinity, -Infinity];
            // for (let i = 0; i < vertices.count; ++i) {
            //     const z = vertices.getZ(i);
            //     if (z < minZ) {
            //         minZ = z;
            //     }
            //     if (z > maxZ) {
            //         maxZ = z;
            //     }
            // }
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
            mesh.position.set(-halfCell, yOffset, -halfCell);
            container.add(mesh);
            this._curvedRails.set(id, { mesh, curve });

            const curveLength = curve.length;            
            const startOffset = barOffset;            
            let currentOffset = startOffset;
            while (currentOffset < curveLength) {
                const barMesh = this._barMesh.clone();
                const t = currentOffset / curveLength;
                curve.evaluate(t, point);
                curve.evaluateTangent(t, tangent);
                barMesh.position.copy(point);
                barMesh.position.x += halfCell;
                lookAt.addVectors(barMesh.position, tangent);
                barMesh.lookAt(lookAt);
                currentOffset += halfCell;
                mesh.add(barMesh);
            }

            const userData: IRailUserData = {
                curve,
                rotation: rotationY
            };
            container.userData = userData;
        }
        return container;
    }
}

export const railFactory = new RailFactory();

