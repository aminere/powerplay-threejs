import { Vector2 } from "three";
import { config } from "./config";
import { ICell, ISector } from "./GameTypes";
import * as THREE from "three";

export class Buildings {
    public static create(sector: ISector, localCoords: Vector2, cell: ICell) {

        const { cellSize, mapRes, elevationStep } = config.game;
        const verticesPerRow = mapRes + 1;
        const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
        const terrain = (sector.layers.terrain as THREE.Mesh).geometry as THREE.BufferGeometry;
        const terrainVertices = terrain.getAttribute("position") as THREE.BufferAttribute;

        const height0 = terrainVertices.getY(startVertexIndex) * elevationStep;
        const height1 = terrainVertices.getY(startVertexIndex + 1) * elevationStep;
        const height2 = terrainVertices.getY(startVertexIndex + verticesPerRow) * elevationStep;
        const height3 = terrainVertices.getY(startVertexIndex + verticesPerRow + 1) * elevationStep;
        const roof = Math.max(height0, height1, height2, height3);

        const floorStep = cellSize;
        const vertices = new Float32Array([
            0, roof + floorStep, cellSize,
            cellSize, roof + floorStep, cellSize,
            cellSize, height3, cellSize,
            0, height2, cellSize,

            cellSize, roof + floorStep, cellSize,
            cellSize, roof + floorStep, 0,
            cellSize, height1, 0,
            cellSize, height3, cellSize,

            cellSize, roof + floorStep, 0,
            0, roof + floorStep, 0,
            0, height0, 0,
            cellSize, height1, 0,

            0, roof + floorStep, 0,
            0, roof + floorStep, cellSize,
            0, height2, cellSize,
            0, height0, 0,

            0, roof + floorStep, 0,
            cellSize, roof + floorStep, 0,
            cellSize, roof + floorStep, cellSize,
            0, roof + floorStep, cellSize,

            // push up for better shadows
            0, height2 + .01, cellSize,
            cellSize, height3 + .01, cellSize,
            cellSize, height1 + .01, 0,
            0, height0 + .01, 0,
        ]);

        const uvs = new Float32Array([
            0, 1,
            1, 1,
            1, 0,
            0, 0,

            0, 1,
            1, 1,
            1, 0,
            0, 0,

            0, 1,
            1, 1,
            1, 0,
            0, 0,

            0, 1,
            1, 1,
            1, 0,
            0, 0,

            0, 1,
            1, 1,
            1, 0,
            0, 0,

            0, 1,
            1, 1,
            1, 0,
            0, 0,
        ]);

        const indices = [
            0, 2, 1,
            0, 3, 2,

            4, 6, 5,
            4, 7, 6,

            8, 10, 9,
            8, 11, 10,

            12, 14, 13,
            12, 15, 14,

            16, 18, 17,
            16, 19, 18,

            20, 22, 21,
            20, 23, 22,
        ];

        const geometry = new THREE.BufferGeometry()
            .setAttribute('position', new THREE.BufferAttribute(vertices, 3))
            .setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
            .setIndex(indices);
        // .translate(0, -.1, 0);
        geometry.computeVertexNormals();

        const bricks = new THREE.TextureLoader().load('/images/bricks.png');
        bricks.magFilter = THREE.NearestFilter;
        bricks.wrapS = THREE.RepeatWrapping;
        bricks.wrapT = THREE.RepeatWrapping;
        const material = new THREE.MeshStandardMaterial({ map: bricks });
        const building = new THREE.Mesh(geometry, material);
        building.castShadow = true;
        building.position.set(localCoords.x * cellSize, 0, localCoords.y * cellSize);
        sector.layers.buildings.add(building);
        cell.building = building;
    }

    public static clear(sector: ISector, cell: ICell) {
        sector.layers.buildings.remove(cell.building!);
        delete cell.building;
    }
}

