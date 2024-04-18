

import { BufferGeometry, LineBasicMaterial, LineSegments, Mesh, MeshBasicMaterial, Object3D, Points, PointsMaterial, Vector2, Vector3 } from "three";
import { config } from "../config";
import { GameUtils } from "../GameUtils";
import { ISector } from "../GameTypes";
import { TFlowFieldMap, flowField } from "./Flowfield";
import { _3dFonts } from "../../engine/resources/3DFonts";
import { Font, TextGeometry } from "three/examples/jsm/Addons.js";
import { utils } from "../../engine/Utils";

const currentCoords = new Vector2();
const cellDirection = new Vector2();
const worldPos1 = new Vector3();
const cellDirection3 = new Vector3();
const linePoints = new Array<Vector3>();
const textCache = new Map<number, TextGeometry>();

function getText(value: number, font: Font) {
    const cached = textCache.get(value);
    if (cached) {
        return cached;
    }
    const text = new TextGeometry(`${value}`, {
        font,
        size: 0.2,
        depth: 0.02,
        curveSegments: 2,
        bevelEnabled: false,
    });
    text.computeBoundingBox();
    text.rotateX(-Math.PI / 2);
    const centerOffset = - 0.5 * (text.boundingBox!.max.x - text.boundingBox!.min.x);
    text.translate(centerOffset, 0, 0);
    textCache.set(value, text);
    return text;
}

const { mapRes, cellSize } = config.game;

export class FlowfieldViewer extends Object3D {

    private _font: Font | null = null;

    constructor() {
        super();
        const lineSegments = new LineSegments(new BufferGeometry(), new LineBasicMaterial({ color: 0xff0000 }));
        lineSegments.position.y = 0.05;
        this.add(lineSegments);
        const points = new Points(new BufferGeometry(), new PointsMaterial({ color: 0xff0000, size: 5, sizeAttenuation: false }));
        points.position.y = 0.05;
        this.add(points);
        this.name = "flowfield";
        this.visible = false;
    }

    public update(flowfieldsMap: TFlowFieldMap, sector: ISector, sectorCoords: Vector2) {        
        const cells = sector.cells;
        linePoints.length = 0;
        const _flowField = flowfieldsMap.get(`${sectorCoords.x},${sectorCoords.y}`)!;
        for (let i = 0; i < cells.length; i++) {
            const cellY = Math.floor(i / mapRes);
            const cellX = i - cellY * mapRes;
            const mapX = sectorCoords.x * mapRes + cellX;
            const mapY = sectorCoords.y * mapRes + cellY;
            currentCoords.set(mapX, mapY);
            const cost = cells[i].flowFieldCost;
            const integration = _flowField[i].integration;
            if (cost === 0xffff || integration === 0) {
                continue;
            }
           
            const computed = flowField.computeDirection(flowfieldsMap, currentCoords, cellDirection);
            if (computed) {
                const index = flowField.computeDirectionIndex(cellDirection);       
                flowField.getDirection(index, cellDirection);
                GameUtils.mapToWorld(currentCoords, worldPos1);
                linePoints.push(worldPos1.clone());
                cellDirection3.set(cellDirection.x, 0, cellDirection.y);
                linePoints.push(worldPos1.clone().addScaledVector(cellDirection3, 0.5));
            }
        }

        const lines = this.children[0] as LineSegments;
        lines.geometry.setFromPoints(linePoints);
        lines.geometry.computeBoundingSphere();
        const points = this.children[1] as Points;
        const pointCoords = linePoints.filter((_, i) => i % 2 !== 0);
        points.geometry.setFromPoints(pointCoords);
        points.geometry.computeBoundingSphere();
        this.position.copy(sector.root.position).negate();

        const sectorId = `${sectorCoords.x},${sectorCoords.y}`;
        const flowfield = flowfieldsMap.get(sectorId)!;
        const texts = this.children[2];
        if (!texts) {
            _3dFonts.load("helvetiker_regular.typeface").then(font => {
                this._font = font;
                const _texts = utils.createObject(this, "Texts");
                _texts.position.copy(sector.root.position);
                for (let y = 0; y < mapRes; ++y) {
                    for (let x = 0; x < mapRes; ++x) {
                        const cellIndex = y * mapRes + x;
                        const integration = flowfield[cellIndex].integration;
                        const text = getText(integration, font);
                        const mesh = new Mesh(text, new MeshBasicMaterial({ color: 0x00ff00 }));
                        mesh.position.set(x * cellSize + cellSize / 2, 0, y * cellSize + cellSize / 2);
                        _texts.add(mesh);
                    }
                }
            });
        } else {
            for (let y = 0; y < mapRes; ++y) {
                for (let x = 0; x < mapRes; ++x) {
                    const cellIndex = y * mapRes + x;
                    const integration = flowfield[cellIndex].integration;
                    const mesh = texts.children[cellIndex] as Mesh;                    
                    const text = getText(integration, this._font!);
                    mesh.geometry = text;
                }
            }
        }
    }
}

