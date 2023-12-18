
import { Vector2 } from "three";
import { GameUtils } from "../GameUtils";
import { ICell } from "../GameTypes";

interface Node {
    coords: Vector2;
    cell: ICell;
    gcost: number; // distance from start
    hcost: number; // distance to end
    parent: Node | null;
}

interface IPathfindingContext {
    evaluated: Array<Node>;
    toEvaluate: Array<Node>;
    start: Vector2;
    end: Vector2;
}

enum NeighborCheckStatus {
    NotWalkable,
    AlreadyEvaluated,
    JustEvaluated
}

export interface IPathfindingOptions {
    getCost?: (from: Vector2, to: Vector2) => number;
    isWalkable?: (cell: ICell) => boolean;
    diagonals?: (cell: ICell) => boolean;
}

const mapCoords = new Vector2();
function checkNeighbor(
    context: IPathfindingContext,
    node: Node,
    dx: number,
    dy: number,
    options?: IPathfindingOptions
) {
    mapCoords.set(node.coords.x + dx, node.coords.y + dy);

    if (context.evaluated.find(n => n.coords.equals(mapCoords))) {
        return NeighborCheckStatus.AlreadyEvaluated;
    }

    const cell = GameUtils.getCell(mapCoords);
    if (!cell) {
        return NeighborCheckStatus.NotWalkable;
    } else {
        const walkable = options?.isWalkable?.(cell) ?? GameUtils.isEmpty(cell);
        if (!walkable) {
            return NeighborCheckStatus.NotWalkable;
        }
    }    

    const neighborGCost = node.gcost + (options?.getCost?.(node.coords, mapCoords) ?? 1);
    const neighborHCost = mapCoords.distanceTo(context.end);
    const visited = context.toEvaluate.find(n => n.coords.equals(mapCoords));
    if (!visited) {
        context.toEvaluate.push({
            coords: mapCoords.clone(),
            gcost: neighborGCost,
            hcost: neighborHCost,
            parent: node,
            cell
        });
    } else if (visited.gcost > neighborGCost) {
        visited.gcost = neighborGCost;
        visited.hcost = neighborHCost;
        visited.parent = node;
    }
    return NeighborCheckStatus.JustEvaluated;
}

// A* pathfinding algorithm
export class Pathfinding {
    public static findPath(
        start: Vector2, 
        end: Vector2, 
        options?: IPathfindingOptions
    ) {        
        const toEvaluate = new Array<Node>();
        const evaluated = new Array<Node>();

        const startNode: Node = {
            coords: new Vector2().copy(start),
            gcost: 0,
            hcost: 0,
            parent: null,
            cell: GameUtils.getCell(start)!
        };
        toEvaluate.push(startNode);

        const context: IPathfindingContext = {
            evaluated,
            toEvaluate,
            start: new Vector2().copy(start),
            end: new Vector2().copy(end)
        };

        let iteration = 0;
        const maxIterations = 1000;
        while (true) {
            let nodeWithLowestFCost = -1;
            let lowestFCost = Infinity;            
            for (let i = 0; i < toEvaluate.length; ++i) {
                const node = toEvaluate[i];
                const fcost = node.gcost + node.hcost;
                if (fcost < lowestFCost) {
                    nodeWithLowestFCost = i;
                    lowestFCost = fcost;
                } else if (fcost === lowestFCost) {
                    if (node.hcost < toEvaluate[nodeWithLowestFCost].hcost) {
                        nodeWithLowestFCost = i;                        
                    }
                }
            }

            if (nodeWithLowestFCost < 0) {
                return null;
            }

            const currentNode = toEvaluate[nodeWithLowestFCost];
            if (currentNode.coords.x === context.end.x && currentNode.coords.y === context.end.y) {
                const path = new Array<Vector2>();
                let current: Node | null = currentNode;
                while (current != null) {
                    path.push(current.coords);                    
                    current = current.parent;
                }
                return path.reverse();
            }

            evaluated.push(currentNode);
            toEvaluate.splice(nodeWithLowestFCost, 1);

            const leftStatus = checkNeighbor(context, currentNode, -1, 0, options);
            const rightStatus = checkNeighbor(context, currentNode, 1, 0, options);
            const topStatus = checkNeighbor(context, currentNode, 0, -1, options);
            const bottomStatus = checkNeighbor(context, currentNode, 0, 1, options);
            
            const _diagonals = currentNode.cell ? (options?.diagonals?.(currentNode.cell!) ?? true) : true;
            if (_diagonals) {
                // do not move diagonally near corners
                const leftWalkable = leftStatus !== NeighborCheckStatus.NotWalkable;
                const rightWalkable = rightStatus !== NeighborCheckStatus.NotWalkable;
                const topWalkable = topStatus !== NeighborCheckStatus.NotWalkable;
                const bottomWalkable = bottomStatus !== NeighborCheckStatus.NotWalkable;
                if (leftWalkable) {
                    if (topWalkable) {
                        checkNeighbor(context, currentNode, -1, -1, options);
                    }
                    if (bottomWalkable) {
                        checkNeighbor(context, currentNode, -1, 1, options);
                    }
                }
                if (rightWalkable) {
                    if (topWalkable) {
                        checkNeighbor(context, currentNode, 1, -1, options);
                    }
                    if (bottomWalkable) {
                        checkNeighbor(context, currentNode, 1, 1, options);
                    }
                }
            }

            ++iteration;
            if (iteration > maxIterations) {
                console.log('max iterations reached');
                return null;
            }
        }
    }
}

