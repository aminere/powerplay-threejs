import { Vector2 } from "three";

export enum NeighborCheckStatus {
    NotWalkable,
    AlreadyEvaluated,
    JustEvaluated
}

export interface PathfindingNode<T> {
    coords: Vector2;
    cell: T;
    gcost: number; // distance from start
    hcost: number; // distance to end
    parent: PathfindingNode<T> | null;
}

export interface IPathfindingContext<T> {
    evaluated: Map<string, boolean>;
    toEvaluate: Map<string, PathfindingNode<T>>;
    start: Vector2;
    end: Vector2;
    getCell: (coords: Vector2) => T | null;
    isWalkable: (cell: T) => boolean;
}

export interface IPathfindingOptions<T> {
    getCost?: (from: Vector2, to: Vector2) => number;
    isWalkable?: (cell: T) => boolean;
    diagonals?: (cell: T) => boolean;
}

