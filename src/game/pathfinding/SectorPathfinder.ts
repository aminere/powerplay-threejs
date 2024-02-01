import { Vector2 } from "three";
import { ISector } from "../GameTypes";
import { IPathfindingContext, PathfindingNode } from "./PathfindingTypes";
import { astar } from "./AStar";
import { GameUtils } from "../GameUtils";
import { utils } from "../../engine/Utils";

type TNode = PathfindingNode<ISector>;

class SectorPathfinder {

    private _toEvaluate = new Array<TNode>();
    private _evaluated = new Array<TNode>();

    public findPath(startCell: Vector2, endCell: Vector2) {        

        const toEvaluate = this._toEvaluate;
        const evaluated = this._evaluated;
        toEvaluate.length = 0;
        evaluated.length = 0;

        const startNode: TNode = {
            coords: new Vector2().copy(startCell),
            gcost: 0,
            hcost: 0,
            parent: null,
            cell: GameUtils.getSector(startCell)!
        };
        toEvaluate.push(startNode);

        const context: IPathfindingContext<ISector> = {
            evaluated,
            toEvaluate,
            start: new Vector2().copy(startCell),
            end: new Vector2().copy(endCell),
            getCell: GameUtils.getSector,
            isWalkable: () => true
        };

        let iteration = 0;
        const maxIterations = 500;
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

            astar.checkNeighbor(context, currentNode, -1, 0);
            astar.checkNeighbor(context, currentNode, 1, 0);
            astar.checkNeighbor(context, currentNode, 0, -1);
            astar.checkNeighbor(context, currentNode, 0, 1);
            astar.checkNeighbor(context, currentNode, -1, -1);
            astar.checkNeighbor(context, currentNode, -1, 1);
            astar.checkNeighbor(context, currentNode, 1, -1);
            astar.checkNeighbor(context, currentNode, 1, 1);

            ++iteration;
            if (iteration > maxIterations) {
                console.log('max iterations reached');
                return null;
            }
        }
    }
}

 export const sectorPathfinder = new SectorPathfinder();

