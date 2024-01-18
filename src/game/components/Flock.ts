
import { Box3, Matrix4, Object3D, Object3DEventMap, Ray, SkinnedMesh, Vector2, Vector3 } from "three";
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
import { skeletonManager } from "../animation/SkeletonManager";
import { mathUtils } from "../MathUtils";
import { IUnitProps, Unit } from "../unit/Unit";
import { MiningState } from "../unit/MiningState";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "./UnitCollisionAnim";
import { utils } from "../../engine/Utils";
import { UnitType } from "../unit/IUnit";
import { objects } from "../../engine/Objects";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { NPCState } from "../unit/NPCState";
import { skeletonPool } from "../animation/SkeletonPool";

export class FlockProps extends ComponentProps {

    radius = 20;
    count = 50;
    npcCount = 4;
    separation = 1;
    maxSpeed = 10;
    speed = 4;       
    repulsion = .2;
    positionDamp = .2;
    rotationDamp = .2;
    npcVision = 5;

    constructor(props?: Partial<FlockProps>) {
        super();
        this.deserialize(props);
    }
}

interface IFlockState extends IComponentState {
    units: Unit[];
    selectedUnits: Unit[];
    selectionStart: Vector2;
    touchPressed: boolean;
    selectionInProgress: boolean;
    flowfieldViewer: FlowfieldViewer;
}

const { mapRes } = config.game;

export class Flock extends Component<FlockProps, IFlockState> {
    constructor(props?: Partial<FlockProps>) {
        super(new FlockProps(props));
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
                    const intersections: Array<{ unit: Unit; distance: number; }> = [];
                    const intersection = pools.vec3.getOne();
                    for (let i = 0; i < units.length; ++i) {
                        const unit = units[i];
                        const { obj, type } = unit;
                        if (type === UnitType.NPC) {
                            continue;
                        }
                        if (!unit.isAlive) {
                            continue;
                        }
                        this._inverseMatrix.copy(obj.matrixWorld).invert();
                        this._localRay.copy(rayCaster.ray).applyMatrix4(this._inverseMatrix);
                        const boundingBox = obj.boundingBox;
                        if (this._localRay.intersectBox(boundingBox, intersection)) {
                            intersections.push({ unit, distance: this._localRay.origin.distanceTo(intersection) });
                        }
                    }
                    
                    if (intersections.length > 0) {
                        intersections.sort((a, b) => a.distance - b.distance);
                        this.state.selectedUnits = [intersections[0].unit];
                    } else {
                        this.state.selectedUnits.length = 0;
                    }
    
                    cmdSetSeletedUnits.post(this.state.selectedUnits);
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
                            const nextState = resource ? MiningState : null;
                            for (const unit of this.state.selectedUnits) {
                                if (!unit.isAlive) {
                                    continue;
                                }
                                unitUtils.moveTo(unit, cellCoords);
                                unit.fsm.switchState(nextState);
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
                            const unit = units[i];
                            const { obj, type } = unit;
                            if (type === UnitType.NPC) {
                                continue;
                            }
                            if (!unit.isAlive) {
                                continue;
                            }
                            GameUtils.worldToScreen(obj.position, gameMapState.camera, screenPos);
                            const rectX = Math.min(this.state.selectionStart.x, input.touchPos.x);
                            const rectY = Math.min(this.state.selectionStart.y, input.touchPos.y);
                            const rectWidth = Math.abs(input.touchPos.x - this.state.selectionStart.x);
                            const rectHeight = Math.abs(input.touchPos.y - this.state.selectionStart.y);
                            if (screenPos.x >= rectX && screenPos.x <= rectX + rectWidth && screenPos.y >= rectY && screenPos.y <= rectY + rectHeight) {
                                selectedUnits.push(unit);
                            }
                        }

                        cmdSetSeletedUnits.post(selectedUnits);

                    } else {

                        if (!gameMapState.action) {
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
        }

        const { repulsion } = this.props;
        const { units } = this.state;
        const separationDist = this.props.separation;
        const steerAmount = this.props.speed * time.deltaTime;
        const maxSteerAmount = this.props.maxSpeed * time.deltaTime;
        const [toTarget, lateralMove] = pools.vec3.get(2);

        skeletonPool.update();

        // steering & collision avoidance
        for (let i = 0; i < units.length; ++i) {
            const unit = units[i];
            if (!unit.isAlive) {
                continue;
            }

            const desiredPos = unitUtils.computeDesiredPos(unit, steerAmount * unit.speed);
            for (let j = i + 1; j < units.length; ++j) {
                const otherUnit = units[j];
                if (!otherUnit.isAlive) {
                    continue;
                }

                const otherDesiredPos = unitUtils.computeDesiredPos(otherUnit, steerAmount * otherUnit.speed);
                if (!(unit.collidable && otherUnit.collidable)) {
                    continue;
                }

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

                            // move laterally
                            lateralMove.crossVectors(toTarget, GameUtils.vec3.up).normalize().multiplyScalar(moveAmount);
                            desiredPos.add(lateralMove);
                            otherDesiredPos.sub(lateralMove);

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
        const [awayDirection, avoidedCellCoords, nextMapCoords] = pools.vec2.get(3);
        const [nextPos] = pools.vec3.get(1);        

        for (let i = 0; i < units.length; ++i) {  
            const unit = units[i];
            if (!unit.isAlive) {
                continue;
            }

            unit.desiredPosValid = false;
            const needsMotion = unit.isMoving || unit.isColliding;
            let avoidedCell = false;

            if (needsMotion) {
                GameUtils.worldToMap(unit.desiredPos, nextMapCoords);
                const newCell = GameUtils.getCell(nextMapCoords);
                const emptyCell = newCell !== null && newCell.isEmpty;
                if (!emptyCell) {
                    avoidedCell = true;
                    avoidedCellCoords.copy(nextMapCoords);

                    // move away from blocked cell                    
                    awayDirection.subVectors(unit.coords.mapCoords, nextMapCoords).normalize();
                    unit.desiredPos.copy(unit.obj.position);
                    unit.desiredPos.x += awayDirection.x * steerAmount;
                    unit.desiredPos.z += awayDirection.y * steerAmount;
                    GameUtils.worldToMap(unit.desiredPos, nextMapCoords);
                }
            }
            
            if (avoidedCell) {
                const miningState = unit.fsm.getState(MiningState);
                if (miningState) {
                    miningState.potentialTarget = avoidedCellCoords;
                }
            }

            unit.fsm.update();

            let hasMoved = false;
            if (needsMotion) {
                if (unit.isMoving) {
                    if (avoidedCell) {
                        nextPos.copy(unit.obj.position);
                        mathUtils.smoothDampVec3(nextPos, unit.desiredPos, unit.velocity, positionDamp, 999, time.deltaTime); 
                    } else {
                        nextPos.copy(unit.desiredPos); 
                    }
                    hasMoved = true; 
                } else if (unit.isColliding) {
                    const collisionAnim = utils.getComponent(UnitCollisionAnim, unit.obj);
                    if (collisionAnim) {
                        collisionAnim.reset();
                    } else {
                        engineState.setComponent(unit.obj, new UnitCollisionAnim({ unit }));
                    }
                }
            }

            unit.isColliding = false;
            const collisionAnim = utils.getComponent(UnitCollisionAnim, unit.obj);
            if (collisionAnim) {
                console.assert(!unit.isMoving);
                nextPos.copy(unit.obj.position);
                mathUtils.smoothDampVec3(nextPos, unit.desiredPos, unit.velocity, positionDamp, 999, time.deltaTime); 
                hasMoved = true;
            }

            if (hasMoved) {
                GameUtils.worldToMap(nextPos, nextMapCoords);
                if (!nextMapCoords.equals(unit.coords.mapCoords)) {
                    const nextCell = GameUtils.getCell(nextMapCoords);
                    const emptyCell = nextCell !== null && nextCell.isEmpty;
                    if (emptyCell) {
                        unitUtils.updateRotation(unit, unit.obj.position, nextPos);
                        unit.obj.position.copy(nextPos);

                        const dx = nextMapCoords.x - unit.coords.mapCoords.x;
                        const dy = nextMapCoords.y - unit.coords.mapCoords.y;
                        const { localCoords } = unit.coords;
                        localCoords.x += dx;
                        localCoords.y += dy;
                        if (localCoords.x < 0 || localCoords.x >= mapRes || localCoords.y < 0 || localCoords.y >= mapRes) {
                            // entered a new sector
                            unitUtils.computeCellAddr(nextMapCoords, unit.coords);
                        } else {
                            unit.coords.mapCoords.copy(nextMapCoords);
                            unit.coords.cellIndex = localCoords.y * mapRes + localCoords.x;
                        }

                        if (unit.isMoving) {
                            if (!unit.fsm.currentState) {
                                const arrived = unit.targetCell.mapCoords.equals(nextMapCoords);
                                if (arrived) {
                                    unit.isMoving = false;
                                    skeletonManager.applySkeleton("idle", unit);
                                }
                            }
                        }
                    }

                } else {
                    unitUtils.updateRotation(unit, unit.obj.position, nextPos);
                    unit.obj.position.copy(nextPos);
                }
            }
        }
    }

    public async load(owner: Object3D) {
        const { sharedSkinnedMesh, baseRotation } = await skeletonManager.load({
            skin: "/models/characters/Worker.json",
            animations: [
                { name: "idle" },
                { name: "walk" }, 
                { name: "pick" }, 
                { name: "run" }, 
                { name: "attack" }, 
                { name: "hurt" }, 
                { name: "death", isLooping: false }
            ],
        });

        await skeletonPool.load("/models/characters/Worker.json");

        const units: Unit[] = [];

        const createUnit = (props: IUnitProps) => {
            const { obj } = props;
            obj.userData.unserializable = true;
            owner.add(obj);
            const unit = new Unit(props);
            obj.bindMode = "detached";            
            skeletonManager.applySkeleton(unit.animation, unit);
            units.push(unit);
            return unit;
        };

        const headOffset = new Vector3(0, 0, 1.8);
        const boundingBox = new Box3()
            .setFromObject(sharedSkinnedMesh)
            .expandByPoint(headOffset)
            .applyMatrix4(new Matrix4().compose(GameUtils.vec3.zero, baseRotation, new Vector3(1, 1, 1)));

        const radius = this.props.radius;
        for (let i = 0; i < this.props.count; i++) {
            const mesh = sharedSkinnedMesh.clone();
            mesh.boundingBox = boundingBox;
            mesh.position.set(
                Math.random() * radius * 2 - radius,
                0,
                Math.random() * radius * 2 - radius,
            );
            createUnit({
                id: i,
                obj: mesh,
                type: UnitType.Worker,
                states: [new MiningState()]
            });
            // const box3Helper = new Box3Helper(boundingBox);
            // mesh.add(box3Helper);
        }

        const npcObj = await objects.load("/models/characters/NPC.json");
        const createNpc = (pos: Vector3) => {
            const npcModel = SkeletonUtils.clone(npcObj);
            const npcMesh = npcModel.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
            npcMesh.position.copy(pos);
            const npc = createUnit({
                id: units.length,
                obj: npcMesh,
                type: UnitType.NPC,
                states: [new NPCState()],
                speed: .7
            });
            npc.fsm.switchState(NPCState);
        }

        for (let i = 0; i < this.props.npcCount; ++i) {
            createNpc(new Vector3(
                Math.random() * radius * 2 - radius,
                0,
                Math.random() * radius * 2 - radius,
            ));
        }

        const flowfieldViewer = new FlowfieldViewer();
        engine.scene!.add(flowfieldViewer);

        this.setState({
            units,
            selectedUnits: [],
            selectionStart: new Vector2(),
            selectionInProgress: false,
            touchPressed: false,
            flowfieldViewer
        });
    }
    
    override dispose(_owner: Object3D) {
        skeletonPool.dispose();   
    }
}

