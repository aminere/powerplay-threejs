
import { Object3D, Vector3 } from "three";
import { BezierPath } from "../BezierPath";
import { Axis, ICell, IRail } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { pools } from "../../engine/core/Pools";
import { Component } from "../../engine/ecs/Component";
import { time } from "../../engine/core/Time";
import { ComponentProps } from "../../powerplay";

interface IMotionSegment {
    endDist: number;
    startAxis: Axis;
    startPos: Vector3;
    straight?: {        
        direction: number;
    };
    curve?: {
        curve: BezierPath;
        inverted: boolean;
        rotation: number;
        direction: Vector3;
    }
}

function processSegment(startingCell: ICell) {
    const rail = startingCell.rail!;
    const railObj = rail.obj!;
    const info = railObj.userData as IRail;
    if (info.curve) {        
        return info.curve.length;
    } else {
        const startPos = rail.worldPos!;
        const endCell = startingCell.rail!.endCell;
        const endPos = endCell?.rail?.worldPos;        
        const length = endPos ? startPos.distanceTo(endPos) : 0;
        return length + config.game.cellSize;
    }
}

function traverseTrack(startingCell: ICell) {
    let distanceToTravel = 0;
    let currentCell = startingCell;
    const motion: IMotionSegment[] = [];

    let previousDirection = 0;
    const visitedCells = new Map<ICell, boolean>();
    while (currentCell) {
        visitedCells.set(currentCell, true);
        distanceToTravel += processSegment(currentCell);
        const endCell = currentCell.rail!.endCell;
        const startPos = currentCell.rail!.worldPos!;
        const endPos = endCell?.rail?.worldPos;
        
        const railObj = currentCell.rail!.obj!;
        const info = railObj.userData as IRail;
        const startAxis = currentCell?.rail?.axis!;
        const endAxis = endCell?.rail?.axis ?? currentCell.rail!.axis;
        const direction = (() => {
            if (endPos) {
                return endAxis === "x" ? Math.sign(endPos.x - startPos.x) : Math.sign(endPos.z - startPos.z);
            } else {
                if (previousDirection !== 0) {
                    return previousDirection;
                } else {
                    return parseInt(Object.keys(currentCell!.rail!.neighbors![endAxis])[0]);
                }
            }
        })();
        if (direction === 0) {
            console.assert(false);
        }
        previousDirection = direction;
        const inverted = currentCell.rail!.tip === "end";
        const curveStart = inverted ? endPos! : startPos;
        const curveEnd = inverted ? startPos : endPos!;
        const finalStartAxis = info.curve ? (inverted ? endAxis : startAxis) : startAxis;
        motion.push({
            endDist: distanceToTravel,
            startAxis: finalStartAxis,
            startPos: info.curve ? curveStart : startPos,
            straight: info.curve ? undefined : {                
                direction
            },
            curve: info.curve ? {
                curve: info.curve,
                inverted,
                rotation: info.rotation,
                direction: new Vector3().subVectors(curveEnd, curveStart).normalize(),
            } : undefined
        });

        const nextCell = (endCell ?? currentCell).rail!.neighbors?.[endAxis]?.[`${direction}`] as ICell;
        if (visitedCells.has(nextCell)) {
            break;
        } else {
            currentCell = nextCell;
        }        
    }

    return [distanceToTravel, motion] as const;
}

function fitPointOnCurve(segment: IMotionSegment, localDist: number, out: Vector3) {
    const { curve, inverted, rotation, direction } = segment.curve!;
    const { startAxis, startPos } = segment;
    const t = localDist / curve.length;
    const [point, offset] = pools.vec3.get(2);
    curve.evaluate(inverted ? 1 - t : t, point);
    point.applyAxisAngle(GameUtils.vec3.up, rotation);
    const { cellSize } = config.game;
    const halfCell = cellSize / 2;
    const vertical = startAxis === "z";
    offset.set(
        vertical ? 0 : halfCell * -Math.sign(direction.x),
        0, 
        vertical ? halfCell * -Math.sign(direction.z) : 0, 
    );
    out.addVectors(startPos, offset).add(point);
}

function getStraightSegmentDir(segment: IMotionSegment, out: Vector3) {
    const { direction } = segment.straight!;
    if (segment.startAxis === "x") {
        out.set(direction, 0, 0);
    } else {
        out.set(0, 0, direction);
    }
    return out;
}

function alignToTrack(segment: IMotionSegment, localDist: number, node: Object3D) {
    if (segment.curve) {
        const { curve, inverted, rotation } = segment.curve;
        const t = localDist / curve.length;
        const [point, tangent, target] = pools.vec3.get(3);
        const _t = inverted ? 1 - t : t;
        curve.evaluate(_t, point);
        curve.evaluateTangent(_t, tangent);
        target.copy(node.position).addScaledVector(tangent, inverted ? -1 : 1);
        node.lookAt(target);
        node.rotateOnAxis(GameUtils.vec3.up, rotation);
    } else {
        const { direction } = segment.straight!;
        const target = pools.vec3.getOne();
        const _direction = segment.startAxis === "x" ? GameUtils.vec3.right : GameUtils.vec3.forward;
        target.copy(node.position).addScaledVector(_direction, direction);
        node.lookAt(target);
    }
}

class WagonProps extends ComponentProps {
    constructor(props?: Partial<WagonProps>) {
        super();
        this.deserialize(props);
    }

    startingCell: ICell = null!;
    startingDist = 0;
    trackLimit = 0;
}

export class Wagon extends Component<WagonProps> {   

    private _speed = 0;
    private _distanceToTravel!: number;
    private _distanceTraveled!: number;
    private _canAccelerate = true;
    private _motion: IMotionSegment[] = [];
    private _currentMotionSegment = 0;
    private _isMoving = false;

    constructor(props?: Partial<WagonProps>) {
        super(new WagonProps(props));
    }

    override start(owner: Object3D) {
        const { startingCell, startingDist, trackLimit } = this.props;
        const [trackLength, motion] = traverseTrack(startingCell);
        this._distanceTraveled = startingDist;
        this._distanceToTravel = trackLength - startingDist - trackLimit;
        this._motion = motion;
        this._isMoving = true;

        let previousSegmentEndDist = 0;
        let currentSegment = motion[0];
        if (startingDist > currentSegment.endDist) {
            for (let i = 1; i < motion.length; i++) {
                const segment = motion[i];
                if (startingDist < segment.endDist) {
                    previousSegmentEndDist = motion[i - 1].endDist;
                    currentSegment = segment;
                    this._currentMotionSegment = i;
                    break;
                }
            }
        }
        const localDist = startingDist - previousSegmentEndDist;
        if (currentSegment.curve) {
            fitPointOnCurve(currentSegment, localDist, owner.position);
        } else {
            const dir = getStraightSegmentDir(currentSegment, pools.vec3.getOne());
            owner.position.copy(currentSegment.startPos).addScaledVector(dir, localDist - config.game.cellSize / 2);
        }
        alignToTrack(currentSegment, localDist, owner);
    }

    override update(owner: Object3D) {

        if (!this._isMoving) {
            return;
        }

        const { maxSpeed, acceleration, deceleration } = config.train;
        if (this._canAccelerate) {   
            const newSpeed = this._speed + acceleration * time.deltaTime;         
            const distanceToStop = newSpeed * newSpeed / (2 * -deceleration);
            if (this._distanceToTravel < distanceToStop) {
                this._canAccelerate = false;
            }
        }

        if (this._canAccelerate) {
            this._speed += acceleration * time.deltaTime;
            if (this._speed > maxSpeed) {
                this._speed = maxSpeed;
            }
        } else {
            this._speed += deceleration * time.deltaTime;
            if (this._speed < 0) {
                this._speed = 0;
                this._isMoving = false;
                return;
            }
        }

        const segment = this._motion[this._currentMotionSegment];
        const stepDistance = this._speed * time.deltaTime;
        if (segment.curve) {
            const startDist = this._currentMotionSegment > 0 ? this._motion[this._currentMotionSegment - 1].endDist : 0;
            const localDist = (this._distanceTraveled + stepDistance) - startDist;
            fitPointOnCurve(segment, localDist, owner.position);
            alignToTrack(segment, localDist, owner);
        } else {
            const dir = getStraightSegmentDir(segment, pools.vec3.getOne());
            owner.position.addScaledVector(dir, stepDistance);
            alignToTrack(segment, 0, owner);
        }

        this._distanceTraveled += stepDistance;
        this._distanceToTravel -= stepDistance;        

        if (this._distanceTraveled > segment.endDist) {
            if (this._currentMotionSegment + 1 < this._motion.length) {
                this._currentMotionSegment++;
                
                const localDist = this._distanceTraveled - segment.endDist;
                const newSegment = this._motion[this._currentMotionSegment];
                if (newSegment.curve) {
                    fitPointOnCurve(newSegment, localDist, owner.position);
                } else {
                    const dir = getStraightSegmentDir(newSegment, pools.vec3.getOne());
                    owner.position.copy(newSegment.startPos).addScaledVector(dir, localDist - config.game.cellSize / 2);
                }
                alignToTrack(newSegment, localDist, owner);
            }
        }
    }
}

