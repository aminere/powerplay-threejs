
import { Object3D, Vector2, Vector3 } from "three";
import { BezierPath } from "../BezierPath";
import { Axis, ICell, IRailUserData } from "../GameTypes";
import { GameUtils } from "../GameUtils";
import { config } from "../config";
import { pools } from "../../engine/core/Pools";
import { Component } from "../../engine/ecs/Component";
import { time } from "../../engine/core/Time";
import { ComponentProps } from "../../powerplay";

const { maxSpeed, acceleration, deceleration } = config.trains;

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
    const railObj = rail.visual!;
    const info = railObj.userData as IRailUserData;
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
        
        const railObj = currentCell.rail!.visual!;
        const info = railObj.userData as IRailUserData;
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

    startingCell = new Vector2();
    startingDist = 0;
    trackLimit = 0;
}

interface IWagonState {
    speed: number;
    distanceToTravel: number;
    distanceTraveled: number;
    canAccelerate: boolean;
    motion: IMotionSegment[];
    currentMotionSegment: number;
    isMoving: boolean;
}

export class Wagon extends Component<WagonProps, IWagonState> {   

    constructor(props?: Partial<WagonProps>) {
        super(new WagonProps(props));
    }

    override start(owner: Object3D) {
        const { startingCell, startingDist, trackLimit } = this.props;
        const _startingCell = GameUtils.getCell(startingCell)!;
        const [trackLength, motion] = traverseTrack(_startingCell);

        this.setState({
            speed: 0,
            distanceToTravel: trackLength - startingDist - trackLimit,
            distanceTraveled: startingDist,
            canAccelerate: true,
            motion,
            currentMotionSegment: 0,
            isMoving: true,
        });        

        let previousSegmentEndDist = 0;
        let currentSegment = motion[0];
        if (startingDist > currentSegment.endDist) {
            for (let i = 1; i < motion.length; i++) {
                const segment = motion[i];
                if (startingDist < segment.endDist) {
                    previousSegmentEndDist = motion[i - 1].endDist;
                    currentSegment = segment;
                    this.state.currentMotionSegment = i;
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

        if (!this.state.isMoving) {
            return;
        }

        if (this.state.canAccelerate) {   
            const newSpeed = this.state.speed + acceleration * time.deltaTime;         
            const distanceToStop = newSpeed * newSpeed / (2 * -deceleration);
            if (this.state.distanceToTravel < distanceToStop) {
                this.state.canAccelerate = false;
            }
        }

        if (this.state.canAccelerate) {
            this.state.speed += acceleration * time.deltaTime;
            if (this.state.speed > maxSpeed) {
                this.state.speed = maxSpeed;
            }
        } else {
            this.state.speed += deceleration * time.deltaTime;
            if (this.state.speed < 0) {
                this.state.speed = 0;
                this.state.isMoving = false;
                return;
            }
        }

        const segment = this.state.motion[this.state.currentMotionSegment];
        const stepDistance = this.state.speed * time.deltaTime;
        if (segment.curve) {
            const startDist = this.state.currentMotionSegment > 0 ? this.state.motion[this.state.currentMotionSegment - 1].endDist : 0;
            const localDist = (this.state.distanceTraveled + stepDistance) - startDist;
            fitPointOnCurve(segment, localDist, owner.position);
            alignToTrack(segment, localDist, owner);
        } else {
            const dir = getStraightSegmentDir(segment, pools.vec3.getOne());
            owner.position.addScaledVector(dir, stepDistance);
            alignToTrack(segment, 0, owner);
        }

        this.state.distanceTraveled += stepDistance;
        this.state.distanceToTravel -= stepDistance;        

        if (this.state.distanceTraveled > segment.endDist) {
            if (this.state.currentMotionSegment + 1 < this.state.motion.length) {
                this.state.currentMotionSegment++;
                
                const localDist = this.state.distanceTraveled - segment.endDist;
                const newSegment = this.state.motion[this.state.currentMotionSegment];
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

