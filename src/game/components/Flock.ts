
import { Box3, Matrix4, Object3D, Quaternion, Ray, SkinnedMesh, Vector2, Vector3 } from "three";
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { input } from "../../engine/Input";
import { pools } from "../../engine/Pools";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "./GameMapState";
import { time } from "../../engine/Time";
import { engine } from "../../engine/Engine";
import { cmdStartSelection, cmdEndSelection, cmdSetSeletedUnits } from "../../Events";
import { flowField } from "../pathfinding/Flowfield";
import { raycastOnCells } from "./GameMapUtils";
import { FlowfieldViewer } from "../pathfinding/FlowfieldViewer";
import { config} from "../../game/config";
import { unitUtils } from "../unit/UnitUtils";
import { SkeletonManager } from "../animation/SkeletonManager";
import { mathUtils } from "../MathUtils";
import { Unit } from "../unit/Unit";
import { MiningState } from "../unit/MiningState";
import { engineState } from "../../engine/EngineState";
import { WalkAnim } from "./WalkAnim";
import { utils } from "../../engine/Utils";

export class FlockProps extends ComponentProps {

    radius = 20;
    count = 50;
    separation = 1;
    maxSpeed = 10;
    speed = 4;       
    repulsion = .2;
    positionDamp = .2;
    rotationDamp = .2;

    constructor(props?: Partial<FlockProps>) {
        super();
        this.deserialize(props);
    }
}

interface IFlockState extends IComponentState {
    units: Unit[];
    selectedUnits: number[];
    selectionStart: Vector2;
    touchPressed: boolean;
    selectionInProgress: boolean;
    baseRotation: Quaternion;
    flowfieldViewer: FlowfieldViewer;
    skeletonManager: SkeletonManager;
}

export class Flock extends Component<FlockProps, IFlockState> {
    constructor(props?: Partial<FlockProps>) {
        super(new FlockProps(props));
    }

    override start(owner: Object3D) {
        this.load(owner);
    }

    private _localRay = new Ray();
    private _inverseMatrix = new Matrix4();
    override update(_owner: Object3D) {
        if (!this.state) {
            return;
        }

        if (input.touchJustPressed) {    
            this.state.touchPressed = true;                
            this.state.selectionStart.copy(input.touchPos);

        } else if (input.touchJustReleased) {
            this.state.touchPressed = false;     
            if (input.touchButton === 0) {

                if (this.state.selectionInProgress) {
                    cmdEndSelection.post();
                    this.state.selectionInProgress = false;

                } else {
                    const { width, height } = engine.screenRect;
                    const normalizedPos = pools.vec2.getOne();
                    normalizedPos.set((input.touchPos.x / width) * 2 - 1, -(input.touchPos.y / height) * 2 + 1);
                    const { rayCaster } = GameUtils;
                    rayCaster.setFromCamera(normalizedPos, gameMapState.camera);
    
                    const { units } = this.state;
                    const intersections: Array<{ unitIndex: number; distance: number; }> = [];
                    const intersection = pools.vec3.getOne();
                    for (let i = 0; i < units.length; ++i) {
                        const { obj } = units[i];
                        this._inverseMatrix.copy(obj.matrixWorld).invert();
                        this._localRay.copy(rayCaster.ray).applyMatrix4(this._inverseMatrix);
                        const boundingBox = obj.boundingBox;
                        if (this._localRay.intersectBox(boundingBox, intersection)) {
                            intersections.push({ unitIndex: i, distance: this._localRay.origin.distanceTo(intersection) });
                        }
                    }
                    
                    if (intersections.length > 0) {
                        intersections.sort((a, b) => a.distance - b.distance);
                        const selectedUnit = intersections[0].unitIndex;
                        this.state.selectedUnits = [selectedUnit];
                    } else {
                        this.state.selectedUnits.length = 0;
                    }
    
                    cmdSetSeletedUnits.post(this.state.selectedUnits.map(i => {
                        const selectedUnit = this.state.units[i];
                        return {
                            obj: selectedUnit.obj,
                            health: 1
                        }
                    }));
                }                

            } else if (input.touchButton === 2) {
                if (this.state.selectedUnits.length > 0) {                    
                    const [cellCoords, sectorCoords, localCoords] = pools.vec2.get(3);
                    const cell = raycastOnCells(input.touchPos, gameMapState.camera, cellCoords);
                    if (cell) {
                        const computed = flowField.compute(cellCoords, sectorCoords, localCoords);
                        if (computed) {                        
                            const sector = gameMapState.sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
                            this.state.flowfieldViewer.update(sector, localCoords);
    
                            const resource = cell.resource?.name;
                            for (const selected of this.state.selectedUnits) {
                                const unit = this.state.units[selected];
                                if (resource) {
                                    unit.targetCell.mapCoords.copy(cellCoords);
                                    unit.fsm.switchState(MiningState);
                                } else {
                                    unit.fsm.switchState(null);
                                    unitUtils.moveTo(unit, cellCoords);
                                }
                            }
                        }
                    }
                }
            }
        }

        if (input.touchJustMoved) {
            if (this.state.touchPressed) {
                if (input.touchButton === 0) {
                    if (this.state.selectionInProgress) {
                        const { selectedUnits } = this.state;
                        selectedUnits.length = 0;
                        const { units } = this.state;
                        const screenPos = pools.vec3.getOne();
                        for (let i = 0; i < units.length; ++i) {
                            const { obj } = units[i];
                            GameUtils.worldToScreen(obj.position, gameMapState.camera, screenPos);
                            const rectX = Math.min(this.state.selectionStart.x, input.touchPos.x);
                            const rectY = Math.min(this.state.selectionStart.y, input.touchPos.y);
                            const rectWidth = Math.abs(input.touchPos.x - this.state.selectionStart.x);
                            const rectHeight = Math.abs(input.touchPos.y - this.state.selectionStart.y);
                            if (screenPos.x >= rectX && screenPos.x <= rectX + rectWidth && screenPos.y >= rectY && screenPos.y <= rectY + rectHeight) {
                                selectedUnits.push(i);
                            }
                        }

                        cmdSetSeletedUnits.post(selectedUnits.map(i => {
                            const selectedUnit = this.state.units[i];
                            return {
                                obj: selectedUnit.obj,
                                health: 1
                            }
                        }));

                    } else {
                        const dx = input.touchPos.x - this.state.selectionStart.x;
                        const dy = input.touchPos.y - this.state.selectionStart.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const threshold = 5;
                        if (dist > threshold) {
                            this.state.selectionInProgress = true;
                            cmdStartSelection.post(this.state.selectionStart);
                        }
                    }
                }
            }
        }

        const { repulsion } = this.props;
        const { units } = this.state;
        const separationDist = this.props.separation;
        const steerAmount = this.props.speed * time.deltaTime;
        const maxSteerAmount = this.props.maxSpeed * time.deltaTime;
        const lookAt = pools.mat4.getOne();
        const toTarget = pools.vec3.getOne();
        const mapCoords = pools.vec2.getOne();
        const cellDirection3 = pools.vec3.getOne();
        const { mapRes } = config.game;

        // steering and collision avoidance
        for (let i = 0; i < units.length; ++i) {
            const unit = units[i];
            const desiredPos = unitUtils.computeDesiredPos(unit, steerAmount);
            for (let j = i + 1; j < units.length; ++j) {
                const otherUnit = units[j];
                const otherDesiredPos = unitUtils.computeDesiredPos(otherUnit, steerAmount);                
                const dist = otherDesiredPos.distanceTo(desiredPos);
                if (dist < separationDist) {
                    unit.isColliding = true;
                    otherUnit.isColliding = true;
                    if (otherUnit.isMoving) {
                        if (unit.isMoving) {
                            // move away from each other
                            const moveAmount = Math.min((separationDist - dist) / 2, maxSteerAmount);
                            toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            desiredPos.add(toTarget);
                            otherDesiredPos.sub(toTarget);
                        } else {
                            const moveAmount = Math.min((separationDist - dist) + repulsion, maxSteerAmount);
                            toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            desiredPos.add(toTarget);
                        }
                    } else {
                        if (unit.isMoving) {
                            const moveAmount = Math.min((separationDist - dist) + repulsion , maxSteerAmount);
                            toTarget.subVectors(otherDesiredPos, desiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            otherDesiredPos.add(toTarget);                            
                        } else {
                            // move away from each other
                            const moveAmount = Math.min((separationDist - dist) / 2 + repulsion, maxSteerAmount);
                            toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            desiredPos.add(toTarget);
                            otherDesiredPos.sub(toTarget);
                        }
                    }
                }
            }
        }

        const { positionDamp } = this.props;
        const awayDirection = pools.vec2.getOne();
        const deltaPos = pools.vec3.getOne();
        for (let i = 0; i < units.length; ++i) {  
            const unit = units[i];
            unit.fsm.update();

            GameUtils.worldToMap(unit.desiredPos, mapCoords);
            const newCell = GameUtils.getCell(mapCoords);
            const emptyCell = newCell && GameUtils.isEmpty(newCell);

            if (!emptyCell) {
                const currentCellCoords = unit.coords.mapCoords;
                if (!currentCellCoords.equals(mapCoords)) {
                    const resource = newCell?.resource?.name;
                    const isMining = resource && unit.fsm.isInState(MiningState);
                    const isTarget = unit.targetCell.mapCoords.equals(mapCoords);
                    if (isMining && isTarget) {
                        console.log("arrived at resource");
                        unit.obj.position.copy(unit.desiredPos);
                        unit.isMoving = false;
                        this.state.skeletonManager.applySkeleton("idle", unit.obj);
                    } else {
                        // move away from blocked cell
                        awayDirection.subVectors(currentCellCoords, mapCoords).normalize();
                        unit.desiredPos.copy(unit.obj.position);
                        unit.desiredPos.x += awayDirection.x * steerAmount;
                        unit.desiredPos.z += awayDirection.y * steerAmount;
                    }                    
                }
            }

            deltaPos.subVectors(unit.desiredPos, unit.obj.position);
            if (unit.isMoving) {
                unit.desiredPosValid = false;                
                if (emptyCell) {
                    unit.obj.position.copy(unit.desiredPos);                    
                } else {
                    mathUtils.smoothDampVec3(
                        unit.obj.position, 
                        unit.desiredPos, 
                        unit.velocity,
                        positionDamp,
                        999, 
                        time.deltaTime
                    );                    
                }
                GameUtils.worldToMap(unit.obj.position, mapCoords);
                const arrived = unit.targetCell.mapCoords.equals(mapCoords);
                if (arrived) {
                    unit.isMoving = false;
                    this.state.skeletonManager.applySkeleton("idle", unit.obj);
                }

            } else if (unit.isColliding) {
                mathUtils.smoothDampVec3(
                    unit.obj.position, 
                    unit.desiredPos, 
                    unit.velocity,
                    positionDamp,
                    999, 
                    time.deltaTime
                );
                GameUtils.worldToMap(unit.obj.position, mapCoords);                
                unit.isColliding = false;

                const walkAnim = utils.getComponent(WalkAnim, unit.obj);
                if (walkAnim) {
                    walkAnim.reset();
                } else {
                    engineState.setComponent(unit.obj, new WalkAnim({
                        skeletonManager: this.state.skeletonManager
                    }));
                }
            }           

            const deltaPosLen = deltaPos.length();
            if (deltaPosLen > 0) {
                cellDirection3.copy(deltaPos).divideScalar(deltaPosLen);
                unit.lookAt.setFromRotationMatrix(lookAt.lookAt(GameUtils.vec3.zero, cellDirection3.negate(), GameUtils.vec3.up));
                unit.rotationVelocity = mathUtils.smoothDampQuat(
                    unit.rotation,
                    unit.lookAt,
                    unit.rotationVelocity,
                    this.props.rotationDamp,
                    999,
                    time.deltaTime
                );
                unit.obj.quaternion.multiplyQuaternions(unit.rotation, this.state.baseRotation);
            }

            const { coords } = unit;
            if (!mapCoords.equals(coords.mapCoords)) {
                const dx = mapCoords.x - coords.mapCoords.x;
                const dy = mapCoords.y - coords.mapCoords.y;
                const { localCoords } = coords;
                localCoords.x += dx;
                localCoords.y += dy;
                if (localCoords.x < 0 || localCoords.x >= mapRes || localCoords.y < 0 || localCoords.y >= mapRes) {
                    // entered a new sector
                    unitUtils.computeCellAddr(mapCoords, coords);
                } else {
                    coords.mapCoords.copy(mapCoords);
                    coords.cellIndex = localCoords.y * mapRes + localCoords.x;
                }
            }
        }
    }

    private async load(owner: Object3D) {
        const radius = this.props.radius;
        const units: SkinnedMesh[] = [];

        const skeletonManager = new SkeletonManager();
        unitUtils.skeletonManager = skeletonManager;
        const { sharedSkinnedMesh, baseRotation } = await skeletonManager.load({
            skin: "/test/Worker.json",
            animations: ["idle", "walk", "pick"],
            currentAnim: "idle"
        });

        const headOffset = new Vector3();   
        for (let i = 0; i < this.props.count; i++) {
            const obj = sharedSkinnedMesh.clone();
            obj.bindMode = "detached";
            skeletonManager.applySkeleton("idle", obj);
            obj.quaternion.copy(baseRotation);
            obj.userData.unserializable = true;
            headOffset.copy(obj.position).setZ(1.8);
            obj.boundingBox = new Box3().setFromObject(obj).expandByPoint(headOffset);            
            owner.add(obj);
            obj.position.x = Math.random() * radius * 2 - radius;
            obj.position.z = Math.random() * radius * 2 - radius;
            units.push(obj);
        }

        const flowfieldViewer = new FlowfieldViewer();
        engine.scene!.add(flowfieldViewer);

        this.setState({
            units: units.map(obj => new Unit(obj)),
            selectedUnits: [],
            selectionStart: new Vector2(),
            selectionInProgress: false,
            touchPressed: false,
            baseRotation,
            flowfieldViewer,
            skeletonManager
        });
    }
}

