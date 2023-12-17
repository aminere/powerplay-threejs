
import { BufferGeometry, LineBasicMaterial, LineSegments, Object3D, Vector3 } from "three";
import { Component } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { input } from "../../engine/Input";
import { pools } from "../../engine/Pools";
import { raycastOnCells } from "./GameMapUtils";
import { gameMapState } from "./GameMapState";
import { Pathfinding } from "../Pathfinding";
import { GameUtils } from "../GameUtils";
import { config } from "../config";

export class PathfinderProps extends ComponentProps {
    constructor(props?: Partial<PathfinderProps>) {
        super();
        this.deserialize(props);
    }
}

export class Pathfinder extends Component<PathfinderProps> {
    constructor(props?: Partial<PathfinderProps>) {
        super(new PathfinderProps(props));
    }

    override start(owner: Object3D) {
        const points = new BufferGeometry();
        const lines = new LineSegments(points, new LineBasicMaterial({ color: 0xff0000 }));
        lines.position.y = 0.05;
        owner.add(lines);
    }
    
    override update(owner: Object3D) {
        if (input.touchJustReleased) {
            const [cellCoords, sectorCoords, startCoords] = pools.vec2.get(3);
            const [worldPos1, worldPos2, direction] = pools.vec3.get(3);
            if (raycastOnCells(input.touchPos, gameMapState.camera, cellCoords)) {
                const cell = GameUtils.getCell(cellCoords, sectorCoords);
                if (cell && GameUtils.isEmpty(cell)) {
                    const sector = gameMapState.sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
                    const cells = sector.cells;
                    const { mapRes } = config.game;
                    const points = new Array<Vector3>();
                    for (let i = 0; i < cells.length; i++) {
                        const cellY = Math.floor(i / mapRes);
                        const cellX = i - cellY * mapRes;
                        if (cellX === cellCoords.x && cellY === cellCoords.y) {
                            continue;
                        }
                        startCoords.set(cellX, cellY);
                        const path = Pathfinding.findPath(startCoords, cellCoords);
                        if (path) {
                            GameUtils.mapToWorld(path[0], worldPos1);
                            GameUtils.mapToWorld(path[1], worldPos2);
                            direction.subVectors(worldPos2, worldPos1).normalize();
                            points.push(worldPos1.clone());
                            points.push(worldPos1.clone().addScaledVector(direction, 0.5));
                        }
                    }
                    const lines = owner.children[0] as LineSegments;
                    lines.geometry.setFromPoints(points);
                    lines.geometry.computeBoundingSphere();
                }                
            }
        }
    }
}

