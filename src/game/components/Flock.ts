
import { Box3, Matrix4, Mesh, Object3D, Ray, SkinnedMesh, Vector2, Vector3 } from "three";
import { Component, IComponentState } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { input } from "../../engine/Input";
import { pools } from "../../engine/core/Pools";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "./GameMapState";
import { time } from "../../engine/core/Time";
import { engine } from "../../engine/Engine";
import { cmdStartSelection, cmdEndSelection, cmdSetSeletedUnits } from "../../Events";
import { raycastOnCells } from "./GameMapUtils";
import { config} from "../../game/config";
import { skeletonManager } from "../animation/SkeletonManager";
import { mathUtils } from "../MathUtils";
import { IUnitProps, Unit } from "../unit/Unit";
import { MiningState } from "../unit/MiningState";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "./UnitCollisionAnim";
import { utils } from "../../engine/Utils";
import { IUnit, UnitType } from "../unit/IUnit";
import { objects } from "../../engine/resources/Objects";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { NPCState } from "../unit/NPCState";
import { skeletonPool } from "../animation/SkeletonPool";
import { ArcherNPCState } from "../unit/ArcherNPCState";
import { unitMotion } from "../unit/UnitMotion";
import { computeUnitAddr } from "../unit/UnitAddr";
import { unitAnimation } from "../unit/UnitAnimation";
import { fogOfWar } from "../FogOfWar";

export class FlockProps extends ComponentProps {

    radius = 20;
    count = 50;
    npcCount = 4;
    separation = 1;    
    speed = 4;
    avoidanceSpeed = 2;
    repulsion = .2;
    positionDamp = .05;

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
}

const { mapRes } = config.game;
const verticesPerRow = mapRes + 1;
const localRay = new Ray();
const inverseMatrix = new Matrix4();
const unitNeighbors = new Array<IUnit>();

function onUnitArrived(unit: IUnit) {
    unitMotion.onUnitArrived(unit);
    unitAnimation.setAnimation(unit, "idle");
}

const cellNeighbors = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const neighbordMapCoords = new Vector2();

function getUnitNeighbors(unit: IUnit) {
    const cell = unit.coords.sector!.cells[unit.coords.cellIndex];
    unitNeighbors.length = 0;
    for (const neighbor of cell.units) {
        if (!neighbor.isAlive) {
            continue;
        }
        if (neighbor !== unit) {
            unitNeighbors.push(neighbor);
        }
    }
    
    for (const [dx, dy] of cellNeighbors) {
        neighbordMapCoords.set(unit.coords.mapCoords.x + dx, unit.coords.mapCoords.y + dy);
        const neighborCell = GameUtils.getCell(neighbordMapCoords);
        if (!neighborCell) {
            continue;
        }
        for (const neighbor of neighborCell.units) {
            if (!neighbor.isAlive) {
                continue;
            }
            unitNeighbors.push(neighbor);
        }
    }

    return unitNeighbors;
}

export class Flock extends Component<FlockProps, IFlockState> {

    constructor(props?: Partial<FlockProps>) {
        super(new FlockProps(props));
    }

    override update(_owner: Object3D) {
        if (!this.state) {
            return;
        }

        if (input.touchJustPressed) {
            if (!gameMapState.cursorOverUI) {
                this.state.touchPressed = true;                
                this.state.selectionStart.copy(input.touchPos);
            }

        } else if (input.touchJustReleased) {

            if (this.state.touchPressed) {
                this.state.touchPressed = false; 
                if (input.touchButton === 0) {

                    if (gameMapState.selectionInProgress) {
                        cmdEndSelection.post();
                        gameMapState.selectionInProgress = false;
    
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
                            inverseMatrix.copy(obj.matrixWorld).invert();
                            localRay.copy(rayCaster.ray).applyMatrix4(inverseMatrix);
                            const boundingBox = obj.boundingBox;
                            if (localRay.intersectBox(boundingBox, intersection)) {
                                intersections.push({ unit, distance: localRay.origin.distanceTo(intersection) });
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
                        const [targetCellCoords, targetSectorCoords] = pools.vec2.get(2);
                        const targetCell = raycastOnCells(input.touchPos, gameMapState.camera, targetCellCoords, targetSectorCoords);
                        if (targetCell) {
                            // group units per sector
                            const groups = this.state.selectedUnits.reduce((prev, cur) => {
                                const key = `${cur.coords.sectorCoords.x},${cur.coords.sectorCoords.y}`;
                                let units = prev[key];
                                if (!units) {
                                    units = [cur];
                                    prev[key] = units;
                                } else {
                                    units.push(cur);
                                }
                                return prev;
                            }, {} as Record<string, Unit[]>);
                            
                            for (const units of Object.values(groups)) {
                                unitMotion.move(units, targetSectorCoords, targetCellCoords, targetCell);                            
                            }
                        }
                    }
                }
            }
        }

        if (input.touchJustMoved) {
            if (this.state.touchPressed) {
                if (input.touchButton === 0) {
                    if (gameMapState.selectionInProgress) {
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
                                gameMapState.selectionInProgress = true;
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
        const avoidanceSteerAmount = this.props.avoidanceSpeed * time.deltaTime;
        const [toTarget] = pools.vec3.get(1);

        skeletonPool.update();

        // steering & collision avoidance
        for (let i = 0; i < units.length; ++i) {
            const unit = units[i];
            if (!unit.isAlive) {
                continue;
            }

            const desiredPos = unitMotion.steer(unit, steerAmount * unit.speedFactor);
            const neighbors = getUnitNeighbors(unit);
            for (const neighbor of neighbors) {                

                const otherDesiredPos = unitMotion.steer(neighbor, steerAmount * neighbor.speedFactor);
                if (!(unit.collidable && neighbor.collidable)) {
                    continue;
                }

                const dist = otherDesiredPos.distanceTo(desiredPos);
                if (dist < separationDist) {
                    unit.isColliding = true;
                    neighbor.isColliding = true;
                    if (neighbor.motionId > 0) {
                        if (unit.motionId > 0) {
                            // move away from each other
                            const moveAmount = Math.min((separationDist - dist) / 2, avoidanceSteerAmount);
                            toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            desiredPos.add(toTarget);
                            otherDesiredPos.sub(toTarget);

                        } else {
                            const moveAmount = Math.min((separationDist - dist) + repulsion, avoidanceSteerAmount);
                            toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            desiredPos.add(toTarget);
                        }
                    } else {
                        if (unit.motionId > 0) {
                            const moveAmount = Math.min((separationDist - dist) + repulsion, avoidanceSteerAmount);
                            toTarget.subVectors(otherDesiredPos, desiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            otherDesiredPos.add(toTarget); 
                            
                            // if other unit was part of my motion, stop
                            if (neighbor.lastCompletedMotionId === unit.motionId) {
                                onUnitArrived(unit);
                            }

                        } else {
                            // move away from each other
                            const moveAmount = Math.min((separationDist - dist) / 2 + repulsion, avoidanceSteerAmount);
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
        const nextPos = pools.vec3.getOne();     

        for (let i = 0; i < units.length; ++i) {  
            const unit = units[i];
            if (!unit.isAlive) {
                continue;
            }

            unit.desiredPosValid = false;
            const needsMotion = unit.motionId > 0 || unit.isColliding;
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
                    unit.desiredPos.x += awayDirection.x * avoidanceSteerAmount;
                    unit.desiredPos.z += awayDirection.y * avoidanceSteerAmount;
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
                if (unit.motionId > 0) {
                    if (avoidedCell) {
                        nextPos.copy(unit.obj.position);
                        mathUtils.smoothDampVec3(nextPos, unit.desiredPos, positionDamp, time.deltaTime);                         
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
                console.assert(unit.motionId === 0);
                nextPos.copy(unit.obj.position);
                mathUtils.smoothDampVec3(nextPos, unit.desiredPos, positionDamp, time.deltaTime);
                hasMoved = true;
            }

            if (hasMoved) {
                GameUtils.worldToMap(nextPos, nextMapCoords);
                if (!nextMapCoords.equals(unit.coords.mapCoords)) {
                    const nextCell = GameUtils.getCell(nextMapCoords);
                    const validCell = nextCell !== null && nextCell.isEmpty;
                    if (validCell) {
                        unitMotion.updateRotation(unit, unit.obj.position, nextPos);
                        unit.obj.position.copy(nextPos);

                        const dx = nextMapCoords.x - unit.coords.mapCoords.x;
                        const dy = nextMapCoords.y - unit.coords.mapCoords.y;
                        const { localCoords } = unit.coords;
                        localCoords.x += dx;
                        localCoords.y += dy;
                        
                        fogOfWar.moveCircle(unit.coords.mapCoords, 10, dx, dy);
                        
                        const currentCell = unit.coords.sector!.cells[unit.coords.cellIndex];
                        const unitIndex = currentCell.units.indexOf(unit);
                        console.assert(unitIndex >= 0);                        
                        utils.fastDelete(currentCell.units, unitIndex);
                        console.assert(!nextCell.units.includes(unit));
                        nextCell.units.push(unit);

                        if (localCoords.x < 0 || localCoords.x >= mapRes || localCoords.y < 0 || localCoords.y >= mapRes) {
                            // entered a new sector
                            computeUnitAddr(nextMapCoords, unit.coords);
                        } else {
                            unit.coords.mapCoords.copy(nextMapCoords);
                            unit.coords.cellIndex = localCoords.y * mapRes + localCoords.x;
                        }

                        if (unit.motionId > 0) {
                            if (!unit.fsm.currentState) {
                                const reachedTarget = unit.targetCell.mapCoords.equals(nextMapCoords);
                                if (reachedTarget) {
                                    console.assert(unit.arriving === false);
                                    unit.arriving = true;
                                    unitAnimation.setAnimation(unit, "idle", { transitionDuration: .4, scheduleCommonAnim: true });
                                }
                            }
                        }
                    }

                } else {
                    unitMotion.updateRotation(unit, unit.obj.position, nextPos);
                    unit.obj.position.copy(nextPos);

                    if (!unit.fsm.currentState) {
                        if (unit.arriving) {
                            if (unit.velocity.length() < 0.01) {
                                onUnitArrived(unit);
                            }
                        }
                    }

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
                // { name: "pick" },
                { name: "run" }, 
                { name: "hurt" }
            ],
        });

        await skeletonPool.load("/models/characters/Worker.json");

        const units: Unit[] = [];

        const createUnit = (props: IUnitProps) => {
            const { obj } = props;
            obj.userData.unserializable = true;
            obj.bindMode = "detached";
            const unit = new Unit(props);
            units.push(unit);
            owner.add(obj);

            fogOfWar.addCircle(unit.coords.mapCoords, 10);
            return unit;
        };

        const initIdleAnim = (obj: SkinnedMesh) => {
            const action = skeletonManager.applySkeleton("idle", obj)!;
            return {
                name: "idle",
                action
            }
        };

        const headOffset = new Vector3(0, 0, 1.8);
        const boundingBox = new Box3()
            .setFromObject(sharedSkinnedMesh)
            .expandByPoint(headOffset)
            .applyMatrix4(new Matrix4().compose(GameUtils.vec3.zero, baseRotation, new Vector3(1, 1, 1)));

        const sector0 = gameMapState.sectors.get(`0,0`)!;
        const terrain = sector0.layers.terrain as Mesh;
        const position = terrain.geometry.getAttribute("position") as THREE.BufferAttribute;
        const radius = this.props.radius;
        const mapCoords = pools.vec2.getOne();
        let unitCount = 0;
        for (let j = 0; j < mapRes; ++j) {
            for (let k = 0; k < mapRes; ++k) {

                if (j < 6) {
                    continue;
                }

                const startVertexIndex = j * verticesPerRow + k;
                const _height1 = position.getY(startVertexIndex);
                const _height2 = position.getY(startVertexIndex + 1);
                const _height3 = position.getY(startVertexIndex + verticesPerRow);
                const _height4 = position.getY(startVertexIndex + verticesPerRow + 1);
                const _maxHeight = Math.max(_height1, _height2, _height3, _height4);
                const _minHeight = Math.min(_height1, _height2, _height3, _height4);
                if (_minHeight === _maxHeight && _minHeight >= 0 && _minHeight <= 1) {
                    const mesh = sharedSkinnedMesh.clone();
                    mesh.boundingBox = boundingBox;
                    mapCoords.set(k, j);
                    GameUtils.mapToWorld(mapCoords, mesh.position);
                    createUnit({
                        id: unitCount,
                        obj: mesh,
                        type: UnitType.Worker,
                        states: [new MiningState()],
                        animation: initIdleAnim(mesh)
                    });
                    // const box3Helper = new Box3Helper(boundingBox);
                    // mesh.add(box3Helper);
                    ++unitCount;
                    if (unitCount >= this.props.count) {
                        break;
                    }
                }
            }
            if (unitCount >= this.props.count) {
                break;
            }
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
                states: [new NPCState(), new ArcherNPCState()],
                animation: initIdleAnim(npcMesh),
                speed: .7
            });
            npc.fsm.switchState(NPCState);
        }

        for (let i = 0; i < this.props.npcCount; ++i) {
            createNpc(new Vector3(
                10 + Math.random() * radius * 2 - radius,
                0,
                Math.random() * radius * 2 - radius,
            ));
        }

        this.setState({
            units,
            selectedUnits: [],
            selectionStart: new Vector2(),
            touchPressed: false
        });
    }
    
    override dispose(_owner: Object3D) {
        skeletonPool.dispose();   
    }
}

