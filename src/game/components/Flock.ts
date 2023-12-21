
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
import { ICellAddr, computeCellAddr } from "../CellCoords";
import { SkeletonManager } from "../animation/SkeletonManager";

export class FlockProps extends ComponentProps {

    radius = 20;
    count = 50;
    separation = 1;
    maxSpeed = 10;
    speed = 4;       
    repulsion = .2;
    positionDamp = .4;
    rotationDamp = .4;

    constructor(props?: Partial<FlockProps>) {
        super();
        this.deserialize(props);
    }
}

type MotionState = "idle" | "moving";

interface IUnit {
    obj: Object3D;
    initialToTarget: Vector3;
    motion: MotionState;
    desiredPos: Vector3;
    desiredPosValid: boolean;
    lookAt: Quaternion;
    rotation: Quaternion;
    targetCell: ICellAddr;
    coords: ICellAddr;
}

interface IFlockState extends IComponentState {
    units: IUnit[];
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
                        const boundingBox = (obj as SkinnedMesh).boundingBox;
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
                    raycastOnCells(input.touchPos, gameMapState.camera, cellCoords);
                    const computed = flowField.compute(cellCoords, sectorCoords, localCoords);
                    if (computed) {
                        for (const selected of this.state.selectedUnits) {
                            const unit = this.state.units[selected];
                            unit.motion = "moving";
                            unit.desiredPosValid = false;
                            computeCellAddr(cellCoords, unit.targetCell);
                            this.state.skeletonManager.applySkeleton("walk", unit.obj as SkinnedMesh);
                        }
                        const sector = gameMapState.sectors.get(`${sectorCoords.x},${sectorCoords.y}`)!;
                        this.state.flowfieldViewer.update(sector, localCoords);
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
        const lookDir = pools.vec3.getOne();
        const quat = pools.quat.getOne();
        const toTarget = pools.vec3.getOne();
        const mapCoords = pools.vec2.getOne();
        const cellDirection3 = pools.vec3.getOne();
        const { mapRes } = config.game;

        for (let i = 0; i < units.length; ++i) {
            const { obj, motion, desiredPos } = units[i];            
            
            if (motion === "idle") {
                desiredPos.copy(obj.position);
            } else if (!units[i].desiredPosValid) {                
                const { sector } = units[i].targetCell;
                const targetCellIndex = units[i].targetCell.cellIndex;
                const currentCellIndex = units[i].coords.cellIndex;
                const _flowField = sector!.cells[targetCellIndex].flowField!;
                const { directions } = _flowField;                
                const [cellDirection, cellDirectionValid] = directions[currentCellIndex];
                if (!cellDirectionValid)  {
                    flowField.computeDirection(_flowField, sector!.flowFieldCosts, currentCellIndex, cellDirection);
                    directions[currentCellIndex][1] = true;
                }
                cellDirection3.set(cellDirection.x, 0, cellDirection.y);
                desiredPos.addVectors(obj.position, cellDirection3.multiplyScalar(steerAmount));
            }
            units[i].desiredPosValid = true;

            for (let j = 0; j < units.length; ++j) {
                if (j === i) {
                    continue;
                }
                const otherDesiredPos = (() => {
                    if (units[j].desiredPosValid) {
                        return units[j].desiredPos;
                    } else {
                        units[j].desiredPosValid = true;
                        if (units[j].motion === "idle") {
                            return units[j].desiredPos.copy(units[j].obj.position);
                        } else {
                            const { sector } = units[j].targetCell;
                            const targetCellIndex = units[j].targetCell.cellIndex;
                            const currentCellIndex = units[j].coords.cellIndex;
                            const _flowField = sector?.cells[targetCellIndex].flowField!;
                            const { directions } = _flowField;
                            const [cellDirection, cellDirectionValid] = directions[currentCellIndex];
                            if (!cellDirectionValid)  {
                                flowField.computeDirection(_flowField, sector!.flowFieldCosts, currentCellIndex, cellDirection);
                                directions[currentCellIndex][1] = true;
                            }
                            cellDirection3.set(cellDirection.x, 0, cellDirection.y);
                            return units[j].desiredPos.addVectors(units[j].obj.position, cellDirection3.multiplyScalar(steerAmount));
                        }                        
                    }
                })();

                const dist = otherDesiredPos.distanceTo(desiredPos);
                if (dist < separationDist) {
                    if (units[j].motion === "idle") {
                        if (units[i].motion === "moving") {
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
                    } else if (units[i].motion === "idle") {
                        const moveAmount = Math.min((separationDist - dist) + repulsion, maxSteerAmount);
                        toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                        desiredPos.add(toTarget);
                    } else {
                        // move away from each other
                        const moveAmount = Math.min((separationDist - dist) / 2, maxSteerAmount);
                        toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                        desiredPos.add(toTarget);
                        otherDesiredPos.sub(toTarget);
                    }
                }
            }
        }

        const { positionDamp } = this.props;
        const awayDirection = pools.vec2.getOne();
        for (let i = 0; i < units.length; ++i) {            
            GameUtils.worldToMap(units[i].desiredPos, mapCoords);
            const newCell = GameUtils.getCell(mapCoords);
            const emptyCell = newCell && GameUtils.isEmpty(newCell);
            if (!emptyCell) {
                const currentCellCoords = units[i].coords.mapCoords;
                if (!currentCellCoords.equals(mapCoords)) {
                    // move away from blocked cell
                    awayDirection.subVectors(currentCellCoords, mapCoords).normalize();
                    units[i].desiredPos.copy(units[i].obj.position);
                    units[i].desiredPos.x += awayDirection.x * steerAmount;
                    units[i].desiredPos.z += awayDirection.y * steerAmount;
                }
            }

            if (units[i].motion === "moving") {
                units[i].desiredPosValid = false;
                if (!emptyCell) {
                    units[i].obj.position.lerp(units[i].desiredPos, positionDamp);
                } else {
                    units[i].obj.position.copy(units[i].desiredPos);
                }                
                GameUtils.worldToMap(units[i].obj.position, mapCoords);
                const arrived = units[i].targetCell.mapCoords.equals(mapCoords);
                if (arrived) {
                    units[i].motion = "idle";
                    this.state.skeletonManager.applySkeleton("idle", units[i].obj as SkinnedMesh);
                } else {
                    const { sector } = units[i].targetCell;
                    const targetCellIndex = units[i].targetCell.cellIndex;
                    const currentCellIndex = units[i].coords.cellIndex;
                    const flowField = sector?.cells[targetCellIndex].flowField!;
                    const { directions } = flowField;
                    console.assert(directions[currentCellIndex][1]);
                    const direction = directions[currentCellIndex][0];
                    cellDirection3.set(direction.x, 0, direction.y);                    
                    units[i].lookAt.setFromRotationMatrix(lookAt.lookAt(GameUtils.vec3.zero, cellDirection3.negate(), GameUtils.vec3.up));
                    units[i].rotation.slerp(units[i].lookAt, this.props.rotationDamp);
                    units[i].obj.quaternion.multiplyQuaternions(units[i].rotation, this.state.baseRotation);
                }
                
            } else {
                units[i].obj.position.lerp(units[i].desiredPos, positionDamp);
                GameUtils.worldToMap(units[i].obj.position, mapCoords);
            }

            const { coords } = units[i];
            if (!mapCoords.equals(coords.mapCoords)) {
                const dx = mapCoords.x - coords.mapCoords.x;
                const dy = mapCoords.y - coords.mapCoords.y;
                const { localCoords } = coords;
                localCoords.x += dx;
                localCoords.y += dy;
                if (localCoords.x < 0 || localCoords.x >= mapRes || localCoords.y < 0 || localCoords.y >= mapRes) {
                    // entered a new sector
                    computeCellAddr(mapCoords, coords);
                } else {
                    coords.mapCoords.copy(mapCoords);
                    coords.cellIndex = localCoords.y * mapRes + localCoords.x;
                }
            }
        }
    }

    private async load(owner: Object3D) {
        const radius = this.props.radius;
        const units: Object3D[] = [];

        const skeletonManager = new SkeletonManager();
        const { sharedSkinnedMesh, baseRotation } = await skeletonManager.load({
            skin: "/test/Worker.json",
            animations: ["idle", "walk"],
            currentAnim: "idle"
        });

        const headOffset = new Vector3();   
        for (let i = 0; i < this.props.count; i++) {
            const obj = sharedSkinnedMesh.clone();
            obj.bindMode = "detached";
            skeletonManager.applySkeleton("idle", obj as SkinnedMesh);
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
            units: units.map(obj => {
                const unit: IUnit = {
                    obj,
                    initialToTarget: new Vector3(),
                    desiredPos: new Vector3(),
                    desiredPosValid: false,
                    motion: "idle",
                    lookAt: new Quaternion(),
                    rotation: new Quaternion(),
                    targetCell: {
                        mapCoords: new Vector2(),
                        localCoords: new Vector2(),
                        sectorCoords: new Vector2(),
                        cellIndex: 0
                    },
                    coords: {
                        mapCoords: new Vector2(),
                        localCoords: new Vector2(),
                        sectorCoords: new Vector2(),
                        cellIndex: 0
                    }
                }
                GameUtils.worldToMap(obj.position, unit.coords.mapCoords);
                computeCellAddr(unit.coords.mapCoords, unit.coords);
                return unit;
            }),
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

