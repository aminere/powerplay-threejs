import { BufferGeometry, Material, InstancedMesh, Vector2, Mesh, Vector3, BufferAttribute } from "three";
import { pools } from "../engine/core/Pools";
import { BezierPath } from "./BezierPath";
import { ICell, Axis, IConveyor } from "./GameTypes";
import { GameUtils } from "./GameUtils";
import { config } from "./config";

const { width, maxCount } = config.conveyors;
const neighborCoords = new Vector2();
const halfPi = Math.PI / 2;

// [flipX, angle]
const cornerTransforms = {
    "1,1,z": [false, 0],
    "1,1,x": [true, halfPi],
    "1,-1,z": [true, Math.PI],    
    "1,-1,x": [false, halfPi],    
    "-1,-1,z": [false, Math.PI],
    "-1,-1,x": [true, -halfPi],    
    "-1,1,z": [true, 0],
    "-1,1,x": [false, -halfPi]    
};

const directionToAngle = {
    "0,1": 0,
    "0,-1": Math.PI,
    "1,0": halfPi,
    "-1,0": -halfPi
};

class ConveyorUtils {
    public createInstancedMesh(name: string, geometry: BufferGeometry, material: Material | Material[]) {
        const mesh = new InstancedMesh(geometry, material, maxCount);
        mesh.name = name;
        mesh.frustumCulled = false;
        mesh.matrixAutoUpdate = false;
        mesh.matrixWorldAutoUpdate = false;
        mesh.count = 0;
        return mesh;
    }
    
    public getAngle(direction: Vector2) {
        const key = `${direction.x},${direction.y}` as keyof typeof directionToAngle;
        const angle = directionToAngle[key];
        console.assert(angle !== undefined, `Invalid direction: ${direction.x},${direction.y}`);
        return angle;
    }
    
    public getConveyorTransform(direction: Vector2, startAxis: Axis) {
        const key = `${direction.x},${direction.y},${startAxis}` as keyof typeof cornerTransforms;
        const transform = cornerTransforms[key] as [boolean, number];
        console.assert(transform !== undefined, `Invalid transform: ${direction.x},${direction.y},${startAxis}`);
        return transform;
    }
    
    public makeCurvedConveyor(mesh: Mesh, xDir: number) {
        const curvedMesh = mesh.clone();
        curvedMesh.geometry = (curvedMesh.geometry as BufferGeometry).clone();
        curvedMesh.geometry.computeBoundingBox();
        const minZ = curvedMesh.geometry.boundingBox!.min.z;
        const maxZ = curvedMesh.geometry.boundingBox!.max.z;
        const halfCell = 1 / 2;
        const quarterCell = halfCell / 2;
        const x1 = 0;
        const x2 = quarterCell * xDir;
        const x3 = halfCell * xDir;
        const z1 = 0;
        const z2 = quarterCell;
        const z3 = halfCell;
        const curve = new BezierPath();
        curve.setPoints([
            new Vector3(x1, 0, z1),
            new Vector3(x1, 0, z2),
            new Vector3(x2, 0, z3),
            new Vector3(x3, 0, z3)
        ]);
    
        const vertices = curvedMesh.geometry.getAttribute("position") as BufferAttribute;
        const [point, bitangent, curvedPos, offset] = pools.vec3.get(4);
        offset.set(0, 0, -halfCell);
        for (let i = 0; i < vertices.count; ++i) {
            const t = (vertices.getZ(i) - minZ) / (maxZ - minZ);
            curve.evaluate(t, point);
            curve.evaluateBitangent(t, bitangent);
            curvedPos.copy(point)
                .add(offset)
                .addScaledVector(bitangent, -vertices.getX(i) * width)
                .addScaledVector(GameUtils.vec3.up, vertices.getY(i));
            vertices.setXYZ(i, curvedPos.x, curvedPos.y, curvedPos.z);
        }
    
        curvedMesh.geometry.computeVertexNormals();
        vertices.needsUpdate = true;
        curvedMesh.castShadow = true;
        return curvedMesh;
    }    
    
    public isStraightExit(cell: ICell, mapCoords: Vector2) {
        const { direction } = cell.conveyor!.config;
        neighborCoords.addVectors(mapCoords, direction);
        const exit = GameUtils.getCell(neighborCoords);
        return !exit?.conveyor;
    }
    
    public isStraightEntry(cell: ICell, mapCoords: Vector2) {
        const { direction } = cell.conveyor!.config;
        neighborCoords.subVectors(mapCoords, direction);
        const entry = GameUtils.getCell(neighborCoords);
        return !entry?.conveyor;
    }    
    
    public isCornerExit(cell: ICell, mapCoords: Vector2) {
        const { startAxis, direction } = cell.conveyor!.config;
        const sx = startAxis === "x" ? 0 : 1;
        const sy = 1 - sx;
        neighborCoords.set(mapCoords.x + direction.x * sx, mapCoords.y + direction.y * sy)        
        const exit = GameUtils.getCell(neighborCoords);
        return !exit?.conveyor;
    }
    
    public isCornerEntry(cell: ICell, mapCoords: Vector2) {
        const { startAxis, direction } = cell.conveyor!.config;
        const sy = startAxis === "x" ? 0 : 1;
        const sx = 1 - sy;
        neighborCoords.set(mapCoords.x - direction.x * sx, mapCoords.y - direction.y * sy);
        const entry = GameUtils.getCell(neighborCoords);
        return !entry?.conveyor;
    }
    
    public getPerpendicularAxis(axis: Axis) {
        return axis === "x" ? "z" : "x";
    }    

    public serializeItems(conveyor: IConveyor) {
        return conveyor.items.map(item => {
            return {
                size: item.size,
                localT: item.localT,
                type: item.type
            };
        });
    }
}

export const conveyorUtils = new ConveyorUtils();

