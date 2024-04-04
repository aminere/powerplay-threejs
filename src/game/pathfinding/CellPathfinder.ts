import { Vector2 } from "three";
import { GameUtils } from "../GameUtils";
import { IPathfindingContext, IPathfindingOptions, NeighborCheckStatus, PathfindingNode } from "./PathfindingTypes";
import { ICell } from "../GameTypes";
import { astar } from "./AStar";

type TNode = PathfindingNode<ICell>;
const maxIterations = 2048;

class CellPathfinder {

    private _toEvaluate = new Map<string, TNode>();
    private _evaluated = new Map<string, boolean>();

    private _context: IPathfindingContext<ICell> = {
        evaluated: this._evaluated,
        toEvaluate: this._toEvaluate,
        start: new Vector2(),
        end: new Vector2(),
        getCell: GameUtils.getCell,
        isWalkable: cell => cell.isWalkable
    };

    public findPath(startCell: Vector2, endCell: Vector2, options?: IPathfindingOptions<ICell>) {        

        const toEvaluate = this._toEvaluate;
        const evaluated = this._evaluated;
        toEvaluate.clear();
        evaluated.clear();

        const startNode: TNode = {
            coords: new Vector2().copy(startCell),
            gcost: 0,
            hcost: 0,
            parent: null,
            cell: GameUtils.getCell(startCell)!
        };
        toEvaluate.set(`${startCell.x},${startCell.y}`, startNode);

        const context = this._context;
        context.start.copy(startCell);
        context.end.copy(endCell);

        let iteration = 0;
        while (true) {
            let nodeWithLowestFCost: string | null = null;
            let lowestFCost = Infinity;      
            
            for (const [id, node] of toEvaluate) {
                const fcost = node.gcost + node.hcost;
                if (fcost < lowestFCost) {
                    nodeWithLowestFCost = id;
                    lowestFCost = fcost;
                } else if (fcost === lowestFCost) {
                    const lowestNode = toEvaluate.get(nodeWithLowestFCost!)!;
                    if (node.hcost < lowestNode.hcost) {
                        nodeWithLowestFCost = id;                        
                    }
                }
            }

            if (nodeWithLowestFCost === null) {
                return null;
            }

            const currentNode = toEvaluate.get(nodeWithLowestFCost)!;
            if (currentNode.coords.equals(context.end)) {
                return astar.makePath(currentNode);                
            }

            evaluated.set(nodeWithLowestFCost, true);
            toEvaluate.delete(nodeWithLowestFCost!);

            const leftStatus = astar.checkNeighbor(context, currentNode, -1, 0, options);
            const rightStatus = astar.checkNeighbor(context, currentNode, 1, 0, options);
            const topStatus = astar.checkNeighbor(context, currentNode, 0, -1, options);
            const bottomStatus = astar.checkNeighbor(context, currentNode, 0, 1, options);
            
            const diagonals = currentNode.cell ? (options?.diagonals?.(currentNode.cell!) ?? true) : true;
            if (diagonals) {
                // do not move diagonally near corners
                const leftWalkable = leftStatus !== NeighborCheckStatus.NotWalkable;
                const rightWalkable = rightStatus !== NeighborCheckStatus.NotWalkable;
                const topWalkable = topStatus !== NeighborCheckStatus.NotWalkable;
                const bottomWalkable = bottomStatus !== NeighborCheckStatus.NotWalkable;
                if (leftWalkable) {
                    if (topWalkable) {
                        astar.checkNeighbor(context, currentNode, -1, -1, options);
                    }
                    if (bottomWalkable) {
                        astar.checkNeighbor(context, currentNode, -1, 1, options);
                    }
                }
                if (rightWalkable) {
                    if (topWalkable) {
                        astar.checkNeighbor(context, currentNode, 1, -1, options);
                    }
                    if (bottomWalkable) {
                        astar.checkNeighbor(context, currentNode, 1, 1, options);
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

export const cellPathfinder = new CellPathfinder();

