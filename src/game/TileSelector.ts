
import { Mesh, MeshBasicMaterial, Object3D, BufferGeometry, BufferAttribute, NearestFilter, Vector2 } from "three";
import { config } from "./config/config";
import { GameUtils } from "./GameUtils";
import { textures } from "../engine/resources/Textures";
import { ISector } from "./GameTypes";
import { BuildableType, BuildingType } from "./buildings/BuildingTypes";
import { buildings } from "./buildings/Buildings";
import { ElevationType, RawResourceType, UnitType } from "./GameDefinitions";

const { cellSize, mapRes } = config.game;
const verticesPerRow = mapRes + 1;
const cellCoords = new Vector2();
const sectorCoords = new Vector2();
const localCoords = new Vector2();

export class TileSector extends Object3D {

    public resourceType: RawResourceType = "wood";
    public buildableType: BuildableType = "depot";
    public elevationType: ElevationType = "increase";
    public unit: UnitType = "worker";

    public get size() { return this._size; }
    public get resolution() { return this._resolution; }

    public set resolution(value: number) { this._resolution = value; }
    public set color(value: "yellow" | "red") { 
        switch (value) {
            case "red": this._material.color.set(0xff0000); break;
            default: this._material.color.set(0xffff00); break;
        }
    }

    private _size = new Vector2(1, 1);
    private _resolution = 1;
    private _material: MeshBasicMaterial;
    private _building: Object3D | null = null;

    constructor() {
        super();

        const texture = textures.load('images/tile-selected.png');
        texture.magFilter = NearestFilter;
        texture.minFilter = NearestFilter;
        this._material = new MeshBasicMaterial({ 
            color: 0xffff00,
            map: texture,
            transparent: true,
            // depthTest: false,
        });

        this.setSize(this._size.x, this._size.y);
    }

    public setSize(x: number, z: number) {
        this._size.set(x, z);
        if (this.children.length > 0) {
            this.clear();
            this._building = null;
        }
        for (let i = 0; i < this._size.y; ++i) {
            for (let j = 0; j < this._size.x; ++j) {
                this.add(this.createMesh(j, i));                
            }
        }
    }    

    public setPosition(x: number, y: number) {
        const offset = -mapRes / 2;
        this.position.set((x + offset) * cellSize, 0, (y + offset) * cellSize);
    }
        
    public fit(x: number, y: number, sectors: Map<string, ISector>) {        
        let maxY = 0;
        const fitTile = (mapX: number, mapY: number, tileIndex: number) => {
            const cell = GameUtils.getCell(cellCoords.set(mapX, mapY), sectorCoords, localCoords);
            const tileGeometry = (this.children[tileIndex] as Mesh).geometry as BufferGeometry;
            const tilePosition = tileGeometry.getAttribute('position') as BufferAttribute;
            if (cell) {
                const sector = sectors.get(`${sectorCoords.x},${sectorCoords.y}`);
                const geometry = (sector?.layers.terrain as Mesh).geometry as BufferGeometry;
                const startVertexIndex = localCoords.y * verticesPerRow + localCoords.x;
                const position = geometry.getAttribute("position") as BufferAttribute;  
                const y0 = position.getY(startVertexIndex);
                const y1 = position.getY(startVertexIndex + 1);
                const y2 = position.getY(startVertexIndex + verticesPerRow + 1);
                const y3 = position.getY(startVertexIndex + verticesPerRow);
                tilePosition.setY(0, y0);
                tilePosition.setY(1, y1);
                tilePosition.setY(2, y2);
                tilePosition.setY(3, y3);
                maxY = Math.max(maxY, y0, y1, y2, y3);                
            } else {
                tilePosition.setY(0, 0);
                tilePosition.setY(1, 0);
                tilePosition.setY(2, 0);
                tilePosition.setY(3, 0);
            }
            tilePosition.needsUpdate = true;
        };

        let tileIndex = 0;    
        for (let i = 0; i < this._size.y; ++i) {
            for (let j = 0; j < this._size.x; ++j) {
                fitTile(x + j, y + i, tileIndex);
                ++tileIndex;              
            }
        }

        if (this._building) {
            this._building.position.setY(maxY * config.game.elevationStep);
        }
    }

    public flatten() {
        let tileIndex = 0;
        for (let i = 0; i < this._size.y; ++i) {
            for (let j = 0; j < this._size.x; ++j) {
                const tileGeometry = (this.children[tileIndex] as Mesh).geometry as BufferGeometry;
                const tilePosition = tileGeometry.getAttribute('position') as BufferAttribute;
                tilePosition.setY(0, 0);
                tilePosition.setY(1, 0);
                tilePosition.setY(2, 0);
                tilePosition.setY(3, 0);
                tilePosition.needsUpdate = true;
                ++tileIndex;              
            }
        }
    }

    public setBuilding(buildingType: BuildingType) {
        const visual = buildings.createHologram(buildingType);
        this.add(visual);
        this._building = visual;
    }

    private createMesh(x: number, y: number) {
        const geometry = new BufferGeometry()
            .setAttribute('position', new BufferAttribute(new Float32Array([
                0, 0, 0,
                cellSize, 0, 0,
                cellSize, 0, cellSize,
                0, 0, cellSize
            ]), 3))
            .setAttribute("uv", new BufferAttribute(new Float32Array([
                0, 0,
                1, 0,
                1, 1,
                0, 1
            ]), 2))
            .setIndex([0, 2, 1, 0, 3, 2]);

        const yOffset = 0.01;
        const mesh = new Mesh(geometry, this._material).translateY(yOffset);
        const { elevationStep } = config.game;
        mesh.scale.set(1, elevationStep, 1);
        mesh.position.set(x * cellSize, 0.001, y * cellSize);
        return mesh;
    };
}

