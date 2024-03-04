import { Vector2 } from "three";
import { GameUtils } from "../GameUtils";
import { IPathfindingContext, IPathfindingOptions, NeighborCheckStatus, PathfindingNode } from "./PathfindingTypes";
import { ICell } from "../GameTypes";
import { astar } from "./AStar";
import { utils } from "../../engine/Utils";

type TNode = PathfindingNode<ICell>;

class CellPathfinder {

    private _toEvaluate = new Array<TNode>();
    private _evaluated = new Array<TNode>();

    public findPath(startCell: Vector2, endCell: Vector2, options?: IPathfindingOptions<ICell>) {        

        const toEvaluate = this._toEvaluate;
        const evaluated = this._evaluated;
        toEvaluate.length = 0;
        evaluated.length = 0;

        const startNode: TNode = {
            coords: new Vector2().copy(startCell),
            gcost: 0,
            hcost: 0,
            parent: null,
            cell: GameUtils.getCell(startCell)!
        };
        toEvaluate.push(startNode);

        const context: IPathfindingContext<ICell> = {
            evaluated,
            toEvaluate,
            start: new Vector2().copy(startCell),
            end: new Vector2().copy(endCell),
            getCell: GameUtils.getCell,
            isWalkable: cell => cell.isEmpty
        };

        let iteration = 0;
        const maxIterations = 2048;
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
            if (currentNode.coords.equals(context.end)) {
                return astar.makePath(currentNode);                
            }

            evaluated.push(currentNode);
            utils.fastDelete(toEvaluate, nodeWithLowestFCost);

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

