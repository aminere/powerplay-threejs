import { Vector2 } from "three";
import { IPathfindingContext, IPathfindingOptions, NeighborCheckStatus, PathfindingNode } from "./PathfindingTypes";

const mapCoords = new Vector2();
class AStar {
    public checkNeighbor<T>(
        context: IPathfindingContext<T>,
        node: PathfindingNode<T>,
        dx: number,
        dy: number,
        options?: IPathfindingOptions<T>
    ) {
        mapCoords.set(node.coords.x + dx, node.coords.y + dy);
    
        const id = `${mapCoords.x},${mapCoords.y}`;
        if (context.evaluated.has(id)) {
            return NeighborCheckStatus.AlreadyEvaluated;
        }
    
        const cell = context.getCell(mapCoords);
        if (!cell) {
            return NeighborCheckStatus.NotWalkable;
        } else {
            const walkable = options?.isWalkable?.(cell) ?? context.isWalkable(cell);        
            if (!walkable) {
                const isTarget = mapCoords.equals(context.end);
                if (isTarget) {
                    // Allow including the target in the path even if it's not walkable
                } else {
                    return NeighborCheckStatus.NotWalkable;
                }            
            }
        }    
    
        const neighborGCost = node.gcost + (options?.getCost?.(node.coords, mapCoords) ?? 1);
        const neighborHCost = mapCoords.distanceTo(context.end);
        const visited = context.toEvaluate.get(id);
        if (!visited) {
            const currentNode: PathfindingNode<T> = {
                coords: mapCoords.clone(),
                gcost: neighborGCost,
                hcost: neighborHCost,
                parent: node,
                cell
            };
            context.toEvaluate.set(id, currentNode);
        } else if (visited.gcost > neighborGCost) {
            visited.gcost = neighborGCost;
            visited.hcost = neighborHCost;
            visited.parent = node;
        }
        return NeighborCheckStatus.JustEvaluated;
    }

    public makePath<T>(currentNode: PathfindingNode<T>) {
        const path = new Array<Vector2>();
        let current: PathfindingNode<T> | null = currentNode;
        while (current != null) {
            path.push(current.coords);
            current = current.parent;
        }
        return path.reverse();
    }    
}

export const astar = new AStar();

