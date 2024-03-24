import { Box3Helper, MathUtils, Object3D, Vector2, Vector3 } from "three";
import { input } from "../../engine/Input";
import { IUnit, UnitType } from "./IUnit";
import { unitAnimation } from "./UnitAnimation";
import { unitMotion } from "./UnitMotion";
import { GameUtils } from "../GameUtils";
import { cmdFogAddCircle, cmdFogMoveCircle, cmdSetSelectedElems, cmdStartSelection } from "../../Events";
import { FlockProps } from "../components/Flock";
import { time } from "../../engine/core/Time";
import { skeletonPool } from "../animation/SkeletonPool";
import { mathUtils } from "../MathUtils";
import { utils } from "../../engine/Utils";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { engineState } from "../../engine/EngineState";
import { computeUnitAddr } from "./UnitAddr";
import { config } from "../config";
import { MiningState } from "./MiningState";
import { IBuildingInstance } from "../GameTypes";
import { skeletonManager } from "../animation/SkeletonManager";
import { GameMapState } from "../components/GameMapState";
import { IUnitProps, Unit } from "./Unit";

const unitNeighbors = new Array<IUnit>();
const screenPos = new Vector3();
const toTarget = new Vector3();
const awayDirection = new Vector2();
const avoidedCellCoords = new Vector2();
const nextMapCoords = new Vector2();
const nextPos = new Vector3();
const spawnCoords = new Vector2();
const moveCoords = new Vector2();
const targetSectorCoords = new Vector2();
const { mapRes } = config.game;

function onUnitArrived(unit: IUnit) {
    unitMotion.onUnitArrived(unit);
    unitAnimation.setAnimation(unit, "idle");
}

const cellNeighbors = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]];
const neighbordMapCoords = new Vector2();

function getUnitNeighbors(unit: IUnit) {
    const cell = unit.coords.sector!.cells[unit.coords.cellIndex];
    unitNeighbors.length = 0;
    if (cell.units) {
        for (const neighbor of cell.units) {
            if (!neighbor.isAlive) {
                continue;
            }
            if (neighbor !== unit) {
                unitNeighbors.push(neighbor);
            }
        }
    }

    for (const [dx, dy] of cellNeighbors) {
        neighbordMapCoords.set(unit.coords.mapCoords.x + dx, unit.coords.mapCoords.y + dy);
        const neighborCell = GameUtils.getCell(neighbordMapCoords);
        if (!neighborCell || !neighborCell.units) {
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

class UnitsManager {

    public get units() { return this._units; }
    public get selectedUnits() { return this._selectedUnits; }

    public set spawnUnitRequest(value: IBuildingInstance | null) { this._spawnUnitRequest = value; }
    public set selectedUnits(value: IUnit[]) { this._selectedUnits = value; }

    private _owner!: Object3D;
    private _units!: Unit[];
    private _selectedUnits: IUnit[] = [];
    private _selectionStart: Vector2 = new Vector2();
    private _touchPressed: boolean = false;
    private _spawnUnitRequest: IBuildingInstance | null = null;

    async preload() {
        await skeletonManager.load({
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
    }

    public init(owner: Object3D) {
        this._owner = owner;
        this._units = [];
    }

    public dispose() {
        skeletonManager.dispose();
        skeletonPool.dispose();
        this._units.length = 0;
        this._selectedUnits.length = 0;    
        this._touchPressed = false;
        this._spawnUnitRequest = null;
    }

    public update() {
        const gameMapState = GameMapState.instance;
        if (input.touchJustPressed) {
            if (!gameMapState.cursorOverUI) {
                this._touchPressed = true;
                this._selectionStart.copy(input.touchPos);
            }

        } else if (input.touchJustReleased) {

            if (this._touchPressed) {
                this._touchPressed = false;
            }
        }

        if (input.touchJustMoved) {
            if (this._touchPressed) {
                if (input.touchButton === 0) {
                    if (gameMapState.selectionInProgress) {
                        this._selectedUnits.length = 0;
                        const units = this._units;
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
                            const rectX = Math.min(this._selectionStart.x, input.touchPos.x);
                            const rectY = Math.min(this._selectionStart.y, input.touchPos.y);
                            const rectWidth = Math.abs(input.touchPos.x - this._selectionStart.x);
                            const rectHeight = Math.abs(input.touchPos.y - this._selectionStart.y);
                            if (screenPos.x >= rectX && screenPos.x <= rectX + rectWidth && screenPos.y >= rectY && screenPos.y <= rectY + rectHeight) {
                                this._selectedUnits.push(unit);
                            }
                        }

                        cmdSetSelectedElems.post({ units: this._selectedUnits });

                    } else {

                        if (!gameMapState.action) {
                            const dx = input.touchPos.x - this._selectionStart.x;
                            const dy = input.touchPos.y - this._selectionStart.y;
                            const dist = Math.sqrt(dx * dx + dy * dy);
                            const threshold = 5;
                            if (dist > threshold) {
                                gameMapState.selectionInProgress = true;
                                cmdStartSelection.post(this._selectionStart);
                            }
                        }

                    }
                }
            }
        }

        const props = FlockProps.instance;
        const { repulsion } = props;
        const units = this._units;
        const separationDist = props.separation;
        const steerAmount = props.speed * time.deltaTime;
        const avoidanceSteerAmount = props.avoidanceSpeed * time.deltaTime;

        skeletonPool.update();
        this.handleSpawnRequests();

        const moveAwayFromEachOther = (amount: number, desiredPos: Vector3, otherDesiredPos: Vector3) => {
            const moveAmount = Math.min(amount, avoidanceSteerAmount);
            toTarget.subVectors(desiredPos, otherDesiredPos).setY(0);
            const length = toTarget.length();
            if (length > 0) {
                toTarget
                    .divideScalar(length)
                    .multiplyScalar(moveAmount)

            } else {
                toTarget.set(MathUtils.randFloat(-1, 1), 0, MathUtils.randFloat(-1, 1))
                    .normalize()
                    .multiplyScalar(moveAmount);
            }
            desiredPos.add(toTarget);
            otherDesiredPos.sub(toTarget);
        };

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
                            moveAwayFromEachOther((separationDist - dist) / 2, desiredPos, otherDesiredPos);

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
                            moveAwayFromEachOther((separationDist - dist) / 2 + repulsion, desiredPos, otherDesiredPos);
                        }
                    }
                }
            }
        }

        const { positionDamp } = props;

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
                const walkableCell = newCell !== null && newCell.isWalkable;
                if (!walkableCell) {
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
                    const validCell = nextCell !== null && nextCell.isWalkable;
                    if (validCell) {
                        unitMotion.updateRotation(unit, unit.obj.position, nextPos);
                        unit.obj.position.copy(nextPos);

                        const dx = nextMapCoords.x - unit.coords.mapCoords.x;
                        const dy = nextMapCoords.y - unit.coords.mapCoords.y;
                        const { localCoords } = unit.coords;
                        localCoords.x += dx;
                        localCoords.y += dy;

                        cmdFogMoveCircle.post({ mapCoords: unit.coords.mapCoords, radius: 10, dx, dy });

                        const currentCell = unit.coords.sector!.cells[unit.coords.cellIndex];
                        const unitIndex = currentCell.units!.indexOf(unit);
                        console.assert(unitIndex >= 0);
                        utils.fastDelete(currentCell.units!, unitIndex);
                        if (nextCell.units) {
                            console.assert(!nextCell.units.includes(unit));
                            nextCell.units.push(unit);
                        } else {
                            nextCell.units = [unit];
                        }

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

    public createUnit(props: IUnitProps) {
        const { obj } = props;
        obj.userData.unserializable = true;
        obj.bindMode = "detached";
        const id = this._units.length;
        const unit = new Unit(props, id);
        this._units.push(unit);
        this._owner.add(obj);
        cmdFogAddCircle.post({ mapCoords: unit.coords.mapCoords, radius: 10 });
        const box3Helper = new Box3Helper(obj.boundingBox);
        obj.add(box3Helper);
        box3Helper.visible = false;
        return unit;

        // const createNpc = (pos: Vector3) => {
        //     const npcModel = SkeletonUtils.clone(npcObj);
        //     const npcMesh = npcModel.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
        //     npcMesh.position.copy(pos);
        //     const npc = unitUtils.createUnit({
        //         obj: npcMesh,
        //         type: UnitType.NPC,
        //         states: [new NPCState(), new ArcherNPCState()],
        //         animation: skeletonManager.applyIdleAnim(npcMesh),
        //         speed: .7
        //     });
        //     npc.fsm.switchState(NPCState);
        // }

    }

    public spawn(mapCoords: Vector2) {
        const sharedMesh = skeletonManager.sharedSkinnedMesh;
        const boundingBox = skeletonManager.boundingBox;
        const mesh = sharedMesh.clone();
        mesh.boundingBox = boundingBox;
        GameUtils.mapToWorld(mapCoords, mesh.position);
        this.createUnit({
            obj: mesh,
            type: UnitType.Worker,
            states: [new MiningState()],
            animation: skeletonManager.applyIdleAnim(mesh)
        });
    }

    public kill(unit: IUnit) {
        unit.health = 0;
        const index = this._units.indexOf(unit as Unit);
        console.assert(index >= 0, `unit ${unit.id} not found`);
        utils.fastDelete(this._units, index);

        const cell = unit.coords.sector!.cells[unit.coords.cellIndex];
        const unitIndex = cell.units!.indexOf(unit);
        console.assert(unitIndex >= 0, `unit ${unit.id} not found in cell`);
        utils.fastDelete(cell.units!, unitIndex);
    }

    public killSelection() {
        if (this._selectedUnits.length === 0) {
            return;
        }
        for (const unit of this._selectedUnits) {
            this.kill(unit);
        }
        this._selectedUnits.length = 0;
        cmdSetSelectedElems.post({ units: this._selectedUnits });
    }

    private handleSpawnRequests() {
        const spawnUnitRequest = this._spawnUnitRequest;
        if (!spawnUnitRequest) {
            return;
        }

        spawnCoords.copy(spawnUnitRequest.mapCoords);
        const buildingId = spawnUnitRequest.buildingId;
        const buildingSize = config.buildings[buildingId].size;
        spawnCoords.x += buildingSize.x / 2;
        spawnCoords.y += buildingSize.z;

        // if cell is occupied, move its units to a nearby cell
        // TODO this is assuming we are spawning from a building, and the surrounding cells are empty
        // Must remove the assumption and scan for empty cells
        const cell = GameUtils.getCell(spawnCoords)!;
        if (cell.hasUnits) {
            const randomCellSelector = MathUtils.randInt(0, 4);
            const [dx, dy] = (() => {
                switch (randomCellSelector) {
                    case 0: return [-1, 0];
                    case 1: return [1, 0];
                    case 2: return [-1, 1];
                    case 3: return [0, 1];
                    default: return [1, 1];
                }
            })();

            moveCoords.set(spawnCoords.x + dx, spawnCoords.y + dy);
            const moveCell = GameUtils.getCell(moveCoords, targetSectorCoords)!;
            unitMotion.move(cell.units!, targetSectorCoords, moveCoords, moveCell);
        }

        this.spawn(spawnCoords);
        this._spawnUnitRequest = null;
    }
}

export const unitsManager = new UnitsManager();

