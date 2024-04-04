import { Vector2 } from "three";
import { ISector } from "../GameTypes";
import { IPathfindingContext, PathfindingNode } from "./PathfindingTypes";
import { astar } from "./AStar";
import { GameUtils } from "../GameUtils";

type TNode = PathfindingNode<ISector>;
const maxIterations = 500;

class SectorPathfinder {

    private _toEvaluate = new Map<string, TNode>();
    private _evaluated = new Map<string, boolean>();

    private _context: IPathfindingContext<ISector> = {
        evaluated: this._evaluated,
        toEvaluate: this._toEvaluate,
        start: new Vector2(),
        end: new Vector2(),
        getCell: GameUtils.getSector,
        isWalkable: () => true
    };

    public findPath(startCell: Vector2, endCell: Vector2) {        

        const toEvaluate = this._toEvaluate;
        const evaluated = this._evaluated;
        toEvaluate.clear();
        evaluated.clear();

        const startNode: TNode = {
            coords: new Vector2().copy(startCell),
            gcost: 0,
            hcost: 0,
            parent: null,
            cell: GameUtils.getSector(startCell)!
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

            astar.checkNeighbor(context, currentNode, -1, 0);
            astar.checkNeighbor(context, currentNode, 1, 0);
            astar.checkNeighbor(context, currentNode, 0, -1);
            astar.checkNeighbor(context, currentNode, 0, 1);
            // astar.checkNeighbor(context, currentNode, -1, -1);
            // astar.checkNeighbor(context, currentNode, -1, 1);
            // astar.checkNeighbor(context, currentNode, 1, -1);
            // astar.checkNeighbor(context, currentNode, 1, 1);

            ++iteration;
            if (iteration > maxIterations) {
                console.log('max iterations reached');
                return null;
            }
        }
    }
}

 export const sectorPathfinder = new SectorPathfinder();

