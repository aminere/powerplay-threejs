import { BufferGeometry, Color, Line, LineBasicMaterial, Mesh, MeshBasicMaterial, Object3D, SphereGeometry, Vector2, Vector3 } from "three";
import { Component } from "../../engine/Component";
import { Axis, ICell, ISector } from "../GameTypes";
import { Meshes } from "../Meshes";
import { Time } from "../../engine/Time";
import { GameUtils } from "../GameUtils";
import { pools } from "../../engine/Pools";
import { Sector } from "../Sector";
import { gameMapState } from "./GameMapState";
import { Pathfinding } from "../Pathfinding";

enum MotionState {
    None,
    WaitForNextCell,
    MoveToNextCell
}

interface ICellInfo {
    cell: ICell;
    sector: ISector;
    localCoords: Vector2;
}

interface IMotionSegment {
    axis: Axis | "both";
    worldPos: Vector3;
    direction: Vector3;
    endDist: number;
}

interface ICarProps {
    coords: Vector2;
}

// const rotationTweenKey = "rotationTween";
function alignToSegment(segment: IMotionSegment, node: Object3D) {
    const { direction } = segment;
    const lookAt = pools.mat4.getOne();
    const invDir = pools.vec3.getOne();
    lookAt.lookAt(GameUtils.vec3.zero, invDir.copy(direction).negate(), GameUtils.vec3.up);
    node.quaternion.setFromRotationMatrix(lookAt);
    // const existingRotation = node.userData[rotationTweenKey];
    // if (existingRotation) {
    //     console.log("existing rotation tween");
    //     return;
    // }

    // const { direction } = segment;
    // const lookAt = pools.mat4.getOne();
    // const invDir = pools.vec3.getOne();
    // lookAt.lookAt(GameUtils.vec3.zero, invDir.copy(direction).negate(), GameUtils.vec3.up);
    // node.userData = {
    //     srcRotation: node.quaternion.clone(),
    //     destRotation: new Quaternion().setFromRotationMatrix(lookAt),
    //     rotation: 0
    // };
    // const rotationTween = gsap.to(node.userData, {
    //     rotation: 1,
    //     duration: .3,
    //     onUpdate: () => {
    //         node.quaternion.slerpQuaternions(
    //             node.userData.srcRotation,
    //             node.userData.destRotation,
    //             node.userData.rotation
    //         );
    //     },
    //     onComplete: () => {
    //         node.quaternion.copy(node.userData.destRotation);
    //         delete node.userData[rotationTweenKey];
    //     }
    // });
    // node.userData[rotationTweenKey] = rotationTween;
}

export class Car extends Component<ICarProps> {

    private get isMoving() { return this._motionState !== MotionState.None; }

    private _distanceToTravel!: number;
    private _distanceTraveled!: number;
    private _speed = 0;
    private _canAccelerate = true;
    private _motion: IMotionSegment[] = [];
    private _currentMotionSegment = 0;    
    private _breakingForTurn = false;
    private _currentCell?: ICellInfo;
    private _motionState: MotionState = MotionState.None;
    private _cellWaitTimer = 0;
    private _owner!: Object3D;

    constructor(props?: ICarProps) {
        super(props ?? {
            coords: new Vector2()
        });
    }

    override start(owner: Object3D) {
        this._owner = owner;
        GameUtils.mapToWorld(this.props.coords, owner.position);
        Meshes.load("/models/car.glb").then(meshes => {
            for (const mesh of meshes) {
                mesh.castShadow = true;
                owner.add(mesh);
            }
        });
    }

    override update(owner: Object3D) {
        if (!this.isMoving) {
            return;
        }

        switch (this._motionState) {
            case MotionState.WaitForNextCell: {
                this._cellWaitTimer -= Time.deltaTime;
                if (this._cellWaitTimer < 0) {
                    this._motionState = MotionState.None;
                    // this.goTo(this._targetCoords);
                }
            }
            break;

            case MotionState.MoveToNextCell: {
                const acceleration = 3;
                const deceleration = -2;
                const maxSpeed = 2;
                const minSpeed = 2;
                const segment = this._motion[this._currentMotionSegment];
                if (this._canAccelerate) {   
                    const newSpeed = this._speed + acceleration * Time.deltaTime;         
                    const distanceToStop = newSpeed * newSpeed / (2 * -deceleration);
                    if (this._distanceToTravel < distanceToStop) {
                        this._canAccelerate = false;
                    } else if (!this._breakingForTurn) {
                        const lastSegment = this._currentMotionSegment === this._motion.length - 1;
                        if (!lastSegment) {
                            const distToVmin = ((minSpeed * minSpeed) - (this._speed * this._speed)) /  (2 * deceleration);
                            const distToSegmentEnd = segment.endDist - this._distanceTraveled;
                            if (distToSegmentEnd < distToVmin) {
                                if (this._speed > minSpeed) {
                                    this._breakingForTurn = true;
                                }
                            }
                        }                
                    }
                }

                if (this._canAccelerate) {
                    if (this._breakingForTurn) {
                        this._speed += deceleration * Time.deltaTime;
                        if (this._speed < minSpeed) {
                            this._speed = minSpeed;
                        }
                    } else {
                        this._speed += acceleration * Time.deltaTime;
                        if (this._speed > maxSpeed) {
                            this._speed = maxSpeed;
                        }
                    }            
                } else {
                    this._speed += deceleration * Time.deltaTime;
                    if (this._speed < 0) {
                        this._speed = 0;
                        this._motionState = MotionState.None;
                        GameUtils.mapToWorld(this.props.coords, owner.position);
                        // GameUtils.worldToMap(visual.node.position, this.props.coords);
                        console.assert(GameUtils.getCell(this.props.coords)!.unit === owner);
                        return;
                    }
                }       

                const stepDistance = this._speed * Time.deltaTime;
                let canStep = true;
                const [nextMapPos, nextSectorCoords, nextLocalCoords] = pools.vec2.get(3);
                nextMapPos.set(this.props.coords.x + Math.sign(segment.direction.x), this.props.coords.y + Math.sign(segment.direction.z));
                const nextCell = GameUtils.getCell(nextMapPos, nextSectorCoords, nextLocalCoords)!;
                if (nextCell) {
                    if (nextCell.unit) {
                        this._motionState = MotionState.WaitForNextCell;
                        GameUtils.mapToWorld(this.props.coords, owner.position);
                        canStep = false;
                    } else {
                        const nextWorldPos = pools.vec3.getOne().copy(owner.position).addScaledVector(segment.direction, stepDistance);
                        const potentialNextMapPos = GameUtils.worldToMap(nextWorldPos, pools.vec2.getOne());
                        if (potentialNextMapPos.equals(nextMapPos)) {
                            // switch to next cell
                            this.props.coords.copy(nextMapPos);
                            const { cell: oldCell, sector: oldSector, localCoords: oldLocalCoords } = this._currentCell!;
                            console.assert(oldCell.unit === owner);
                            delete oldCell.unit;
                            console.assert(nextCell.unit === undefined);
                            nextCell.unit = owner;
                            Sector.updateHighlightTexture(oldSector, oldLocalCoords, new Color(0xffffff));
                            const nextSector = gameMapState.sectors.get(`${nextSectorCoords.x},${nextSectorCoords.y}`)!;
                            Sector.updateHighlightTexture(nextSector, nextLocalCoords, new Color(0xff0000));
                            this._currentCell!.cell = nextCell;
                            this._currentCell!.sector = nextSector;
                            this._currentCell!.localCoords.copy(nextLocalCoords);
                        }
                    }    
                }
                
                if (canStep) {
                    this.doStep(owner, segment, stepDistance);
                    // const mapPos = GameUtils.worldToMap(visual.node.position, pools.vec2.getOne());
                    // if (!mapPos.equals(this.props.coords)) {
                    //     console.assert(false);
                    // }
                }
            }
            break;
        }
    }

    private doStep(node: Object3D, segment: IMotionSegment, stepDistance: number) {
        node.position.addScaledVector(segment.direction, stepDistance);
        this._distanceTraveled += stepDistance;
        this._distanceToTravel -= stepDistance;        
        if (this._distanceTraveled > segment.endDist) {
            if (this._currentMotionSegment + 1 < this._motion.length) {
                this._currentMotionSegment++;
                const localDist = this._distanceTraveled - segment.endDist;
                const newSegment = this._motion[this._currentMotionSegment];                
                node.position.copy(newSegment.worldPos).addScaledVector(newSegment.direction, localDist);
                alignToSegment(newSegment, node);
                this._breakingForTurn = false;
            }
        }
    }    

    private _lines?: Line;
    private _pathIndicators?: Object3D[];
    // private _targetIndicator?: Object3D;
    public goTo(mapCoords: Vector2) {
        if (this.isMoving) {
            console.assert(false, "already moving");
            return;
        }

        if (this.props.coords.equals(mapCoords)) {
            console.log("already there");
            return;
        }
        
        const path = Pathfinding.findPath(
            this.props.coords,
            mapCoords,
            {
                getCost: (from, to) => {
                    let cost = 1; //from.distanceTo(to);
                    const fromCell = GameUtils.getCell(from)!;
                    const toCell = GameUtils.getCell(to)!;
                    if (toCell.roadTile !== undefined) {
                        cost -= 1;
                    } else {
                        cost += 2;
                        if (fromCell.roadTile !== undefined) {
                            cost += 1;
                        }
                    }
                    return cost;
                },
                isWalkable: (cell) => {
                    return !(cell.building || cell.rail || cell.unit);
                },
                diagonals: cell => {
                    if (cell.roadTile !== undefined) {
                        return false;
                    }
                    return true;
                }
            }
        );

        if (path) {
            if (path.length < 2) {
                return;
            }
            
            const [worldPos, direction, lastTurn] = pools.vec3.get(3);
            let length = 0;
            this._motion.length = 0;
            let currentAxis: Axis | "both" | null = null;
            let previousAxis: Axis | "both" = (() => {
                const next = path[1];
                const dx = next.x - path[0].x;
                const dz = next.y - path[0].y;
                if (dx === 0) {
                    return "z";
                } else if (dz === 0) {
                    return "x";
                } else {
                    return "both";
                }
            })();
            GameUtils.mapToWorld(path[0], lastTurn);
            for (let i = 0; i < path.length; ++i) {
                const current = path[i];
                const lastNode = i === path.length - 1;
                let directionChange = false;
                if (!lastNode) {
                    const next = path[i + 1];
                    const dx = next.x - current.x;
                    const dz = next.y - current.y;
                    const axis = (() => {
                        if (dx === 0) {
                            return "z";
                        } else if (dz === 0) {
                            return "x";
                        } else {
                            return "both";
                        }
                    })();
                    directionChange = axis !== currentAxis && currentAxis !== null;
                    if (directionChange && currentAxis) {
                        previousAxis = currentAxis;
                    }
                    currentAxis = axis;
                } else {
                    if (currentAxis) {
                        previousAxis = currentAxis;
                    }
                }

                if (directionChange || lastNode) {
                    GameUtils.mapToWorld(current, worldPos);
                    direction.subVectors(worldPos, lastTurn).normalize();
                    const segmentLength = lastTurn.distanceTo(worldPos);
                    length += segmentLength;
                    this._motion.push({
                        worldPos: lastTurn.clone(),
                        direction: direction.clone(),
                        endDist: length,
                        axis: previousAxis
                    });
                    lastTurn.copy(worldPos);
                }
            }

            this._distanceToTravel = length;
            this._distanceTraveled = 0;            
            this._speed = 0;
            this._canAccelerate = true;
            this._currentMotionSegment = 0;            
            this._breakingForTurn = false;
            alignToSegment(this._motion[0], this._owner);
            this._cellWaitTimer = 0;
            const [sectorCoords, localCoords] = pools.vec2.get(2);
            const cell = GameUtils.getCell(this.props.coords, sectorCoords, localCoords)!;
            this._currentCell = {
                cell,
                sector: gameMapState.sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!,
                localCoords: localCoords.clone()
            };
            this._motionState = MotionState.MoveToNextCell;

            // debug
            if (!this._lines) {
                const lineMaterial = new LineBasicMaterial({ color: 0x0000ff });
                const lineGeometry = new BufferGeometry();
                const lines = new Line(lineGeometry, lineMaterial);
                gameMapState.owner.add(lines);
                this._lines = lines;
            }
            this._lines.geometry.setFromPoints(this._motion.flatMap((m, i) => {
                if (i < this._motion.length - 1) {
                    return m.worldPos.clone().setY(0.01);
                } else {
                    const lastSegmentLength = length - (i > 0 ? this._motion[i - 1].endDist : 0);
                    return [
                        m.worldPos.clone().setY(0.01),
                        m.worldPos.clone().addScaledVector(m.direction, lastSegmentLength).setY(0.01)
                    ];
                }
            }));
            if (this._pathIndicators) {
                for (const elem of this._pathIndicators) {
                    elem?.removeFromParent();
                }           
            }
            this._pathIndicators = path.map(p => {
                const mesh = new Mesh(new SphereGeometry(.05), new MeshBasicMaterial({ color: 0x0000ff }));
                GameUtils.mapToWorld(p, mesh.position);
                gameMapState.owner.add(mesh);
                return mesh;
            });
        }
    }
}


