import { GameUtils } from "./GameUtils";
import * as THREE from "three";
import { Vector3 } from "three";
import { config } from "./config";
import { BezierPath } from "./BezierPath";
import { IRail } from "./GameTypes";
import { Meshes } from "./Meshes";

export class RailFactory {

    public static makeRail(length: number, rotation: number) {
        const { cellSize } = config.game;
        const container = new THREE.Object3D();
        this.loadRailMesh().then(mesh => {            
            mesh.position.set(0, .01, -cellSize / 2);
            mesh.scale.set(cellSize, 1, length * cellSize);
            container.add(mesh);            
        });
        const rotationY = Math.PI / 2 * rotation;
        container.rotateY(rotationY);
        container.userData = {
            rotation: rotationY
        } as IRail;     
        return container;
    }

    private static _curvedRails = new Map<string, {
        mesh: THREE.Object3D;
        curve: BezierPath;
    }>();
    public static makeCurvedRail(turnRadius: number, rotation: number, directionX: number) {        
        const id = `${turnRadius}_${directionX}`;
        const existingRail = RailFactory._curvedRails.get(id);        
        const container = new THREE.Object3D(); 
        const rotationY = Math.PI / 2 * rotation;
        container.rotateY(rotationY);
        if (existingRail) {            
            container.add(existingRail.mesh.clone());
            container.userData = {
                curve: existingRail.curve,
                rotation: rotationY
            } as IRail;               
        } else {
            const { cellSize } = config.game;
            const halfCell = cellSize / 2;
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

            this.loadRailMesh().then(mesh => {                
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
                const [point, bitangent, curvedPos, offset] = GameUtils.pool.vec3.get(4);
                offset.set(halfCell, 0, 0);
                for (let i = 0; i < vertices.count; ++i) {   
                    const t = (vertices.getZ(i) - minZ) / (maxZ - minZ);                            
                    curve.evaluate(t, point);
                    curve.evaluateBitangent(t, bitangent);
                    curvedPos.copy(point)
                        .add(offset)
                        .addScaledVector(bitangent, -vertices.getX(i) * cellSize)
                        .addScaledVector(GameUtils.vec3.up, vertices.getY(i));
                    vertices.setXYZ(i, curvedPos.x, curvedPos.y + .01, curvedPos.z);   
                }                        
    
                vertices.needsUpdate = true;
                mesh.geometry.computeBoundingSphere();           
                mesh.position.set(-cellSize / 2, 0.001, -cellSize / 2);
                container.add(mesh);
                this._curvedRails.set(id, { mesh, curve });
            });
           
            container.userData = {
                curve,
                rotation: rotationY
            } as IRail;
        }        
        return container;    
    }

    public static async loadRailMesh() {       
        const [rail] = await Meshes.load('/models/rails.glb');
        return rail;
    }
}

