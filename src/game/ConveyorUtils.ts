import { BufferGeometry, Material, InstancedMesh, Vector2, Mesh, Vector3 } from "three";
import { pools } from "../engine/core/Pools";
import { BezierPath } from "./BezierPath";
import { IConveyorConfig, ICell, Axis } from "./GameTypes";
import { GameUtils } from "./GameUtils";
import { config } from "./config";

const { conveyorWidth, maxConveyors } = config.game;
const neighborCoords = new Vector2();

export class ConveyorUtils {
    public static createInstancedMesh(name: string, geometry: BufferGeometry, material: Material | Material[]) {
        const mesh = new InstancedMesh(geometry, material, maxConveyors);
        mesh.name = name;
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        mesh.matrixWorldAutoUpdate = false;
        mesh.count = 0;
        return mesh;
    }
    
    public static getAngleFromDirection(direction: Vector2) {
        if (direction.x === 0) {
            if (direction.y > 0) {
                return 0;
            }
            return Math.PI;
        } else {
            if (direction.x > 0) {
                return Math.PI / 2;
            }
            return -Math.PI / 2;
        }
    }
    
    public static getConveyorTransform(config: IConveyorConfig): [boolean, number] {
        if (config.direction.x > 0) {
            if (config.direction.y < 0) {
                if (config.startAxis === "x") {
                    return [false, Math.PI / 2];
                } else {
                    return [true, Math.PI];
                }
            } else {
                if (config.startAxis === "x") {
                    return [true, Math.PI / 2];
                } else {
                    return [false, 0];
                }
            }
        } else {
            if (config.direction.y < 0) {
                if (config.startAxis === "x") {
                    return [true, -Math.PI / 2];
                } else {
                    return [false, Math.PI];
                }
            } else {
                if (config.startAxis === "x") {
                    return [false, -Math.PI / 2];
                } else {
                    return [true, 0];
                }
            }
        }
    }
    
    public static makeCurvedConveyor(mesh: Mesh, xDir: number) {
        const curvedMesh = mesh.clone();
        curvedMesh.geometry = (curvedMesh.geometry as THREE.BufferGeometry).clone();
        curvedMesh.geometry.computeBoundingBox();
        const minZ = curvedMesh.geometry.boundingBox!.min.z;
        const maxZ = curvedMesh.geometry.boundingBox!.max.z;
        const halfCell = 1 / 2;
        const x1 = 0;
        const x2 = halfCell / 2 * xDir;
        const x3 = halfCell * xDir;
        const z1 = 0;
        const z2 = halfCell / 2;
        const z3 = halfCell;
        const curve = new BezierPath();
        curve.setPoints([
            new Vector3(x1, 0, z1),
            new Vector3(x1, 0, z2),
            new Vector3(x2, 0, z3),
            new Vector3(x3, 0, z3)
        ]);
    
        const vertices = curvedMesh.geometry.getAttribute("position") as THREE.BufferAttribute;
        const [point, bitangent, curvedPos, offset] = pools.vec3.get(4);
        offset.set(0, 0, -halfCell);
        for (let i = 0; i < vertices.count; ++i) {
            const t = (vertices.getZ(i) - minZ) / (maxZ - minZ);
            curve.evaluate(t, point);
            curve.evaluateBitangent(t, bitangent);
            curvedPos.copy(point)
                .add(offset)
                .addScaledVector(bitangent, -vertices.getX(i) * conveyorWidth)
                .addScaledVector(GameUtils.vec3.up, vertices.getY(i));
            vertices.setXYZ(i, curvedPos.x, curvedPos.y, curvedPos.z);
        }
    
        curvedMesh.geometry.computeVertexNormals();
        vertices.needsUpdate = true;
        return curvedMesh;
    }
    
    public static isCorner(cell: ICell) {
        const config = cell.conveyor!.config;
        if (config) {       
            return Math.abs(config.direction.x) + Math.abs(config.direction.y) > 1;
        }
        return false;
    }
    
    public static isStraightExit(cell: ICell, mapCoords: Vector2) {
        neighborCoords.addVectors(mapCoords, cell.conveyor!.config!.direction);
        const exit = GameUtils.getCell(neighborCoords);
        return !exit?.conveyor;
    }
    
    public static isStraightEntry(cell: ICell, mapCoords: Vector2) {
        neighborCoords.subVectors(mapCoords, cell.conveyor!.config!.direction);
        const entry = GameUtils.getCell(neighborCoords);
        return !entry?.conveyor;
    }
    
    public static getCornerExitCoords(cell: ICell, mapCoords: Vector2) {
        const { startAxis, direction } = cell.conveyor!.config!;
        const sx = startAxis === "x" ? 0 : 1;
        const sy = 1 - sx;
        return neighborCoords.set(mapCoords.x + direction.x * sx, mapCoords.y + direction.y * sy);
    }
    
    public static getCornerEntryCoords(cell: ICell, mapCoords: Vector2) {
        const { startAxis, direction } = cell.conveyor!.config!;
        const sy = startAxis === "x" ? 0 : 1;
        const sx = 1 - sy;
        return neighborCoords.set(mapCoords.x - direction.x * sx, mapCoords.y - direction.y * sy);
    }
    
    public static isCornerExit(cell: ICell, mapCoords: Vector2) {
        const neighborCoords = ConveyorUtils.getCornerExitCoords(cell, mapCoords);
        const exit = GameUtils.getCell(neighborCoords);
        return !exit?.conveyor;
    }
    
    public static isCornerEntry(cell: ICell, mapCoords: Vector2) {
        const neighborCoords = ConveyorUtils.getCornerEntryCoords(cell, mapCoords);
        const entry = GameUtils.getCell(neighborCoords);
        return !entry?.conveyor;    
    }
    
    public static getPerpendicularAxis(axis: Axis) {
        return axis === "x" ? "z" : "x";
    }    
}
