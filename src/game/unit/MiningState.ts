import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { Vector2 } from "three";
import { time } from "../../engine/core/Time";
import { unitAnimation } from "./UnitAnimation";
import { copyUnitAddr, getCellFromAddr, makeUnitAddr } from "./UnitAddr";
import { unitMotion } from "./UnitMotion";
import { IBuildingInstance, IFactoryState } from "../buildings/BuildingTypes";
import { GameMapState } from "../components/GameMapState";
import { resources } from "../Resources";
import { utils } from "../../engine/Utils";
import { config } from "../config";
import { meshes } from "../../engine/resources/Meshes";
import { RawResourceType } from "../GameDefinitions";
import { engine } from "../../engine/Engine";

enum MiningStep {
    GoToResource,
    Mine,
    GoToFactory,
}

const inputSlot = new Vector2();
const closestInputSlot = new Vector2();
const { cellSize } = config.game;

function findClosestFreeFactory(unit: IUnit, resourceType: RawResourceType, closestInputSlotOut: Vector2) {
    // TODO search in a spiral pattern across sectors
    // requires that buildings are stored in sectors instead of a global map
    const { buildings } = GameMapState.instance;
    let distToClosest = 999999;
    let closestFactory: IBuildingInstance | null = null;
    for (const [, instance] of buildings) {
        if (instance.buildingType !== "factory") {
            continue;
        }

        const otherState = instance.state as IFactoryState;
        if (otherState.input !== resourceType) {
            continue;
        }

        const otherInputCell = getCellFromAddr(otherState.inputCell);
        if (otherInputCell.nonPickableResource) {
            continue;
        }

        inputSlot.copy(otherState.inputCell.mapCoords);
        const dist = inputSlot.distanceTo(unit.coords.mapCoords);
        if (dist < distToClosest) {
            distToClosest = dist;
            closestFactory = instance;
            closestInputSlotOut.copy(inputSlot);
        }
    }
    return closestFactory;
}

function stopMining(unit: IUnit) {
    if (unit.motionId > 0) {
        unitMotion.onUnitArrived(unit);
    }
    unit.fsm.switchState(null);
    unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
}

export class MiningState extends State<IUnit> {

    public set potentialTarget(value: Vector2) { this._potentialTarget.copy(value); }

    private _step!: MiningStep;
    private _miningTimer!: number;
    private _targetResource = makeUnitAddr();
    private _potentialTarget = new Vector2(-1, -1);
    private _closestFactory: IBuildingInstance | null = null;

    override enter(unit: IUnit) {
        this._step = MiningStep.GoToResource;
        copyUnitAddr(unit.targetCell, this._targetResource);
        this._potentialTarget.set(-1, -1);
    }

    override exit(_owner: IUnit): void {
        console.log(`MiningState exit`);
    }

    private goToResource(unit: IUnit) {
        if (unit.motionId > 0) {
            unitMotion.onUnitArrived(unit);
        }
        this._step = MiningStep.GoToResource;
        unitMotion.moveUnit(unit, this._targetResource.mapCoords);
    }     

    private goToFactory(unit: IUnit, resourceType: RawResourceType) {
        const factory = findClosestFreeFactory(unit, resourceType, closestInputSlot);
        this._closestFactory = factory;
        if (this._closestFactory) {
            const isMining = unit.animation.name === "pick";
            if (isMining) {
                unitMotion.moveUnit(unit, closestInputSlot, false);
                unitAnimation.setAnimation(unit, "run", {
                    transitionDuration: .3,
                    scheduleCommonAnim: true
                });
            } else {
                unitMotion.moveUnit(unit, closestInputSlot);
            }            
            this._step = MiningStep.GoToFactory;
        } else {
            stopMining(unit);
        }
    }

    override update(unit: IUnit): void {
        switch (this._step) {

            case MiningStep.GoToResource: {
                const arrived = unit.targetCell.mapCoords.equals(this._potentialTarget);
                if (arrived) {
                    this._potentialTarget.set(NaN, NaN);
                    if (unit.motionId > 0) {
                        unitMotion.onUnitArrived(unit);
                    }

                    const cell = getCellFromAddr(this._targetResource);
                    if (cell.resource) {
                        console.assert(cell.resource.amount > 0, `resource amount is ${cell.resource.amount}`);
                        this._step = MiningStep.Mine;
                        unit.collidable = false;
                        this._miningTimer = 1;
                        unitAnimation.setAnimation(unit, "pick", { transitionDuration: 1 });
                    } else {
                        stopMining(unit);
                    }                    
                }
            }
                break;

            case MiningStep.GoToFactory: {

                if (this._closestFactory!.deleted) {

                    const factoryState = this._closestFactory!.state as IFactoryState;
                    const resourceType = factoryState.input as RawResourceType;
                    this.goToFactory(unit, resourceType);
                    this._closestFactory = null;

                } else {
                    const arrived = unit.targetCell.mapCoords.equals(this._potentialTarget);
                    if (arrived) {
                        this._potentialTarget.set(NaN, NaN);

                        // arrived at factory
                        const factoryState = this._closestFactory!.state as IFactoryState;
                        const inputCell = getCellFromAddr(factoryState.inputCell);
                        if (inputCell.nonPickableResource) {
                            console.log(`input full, finding next closest factory`);
                            this.goToFactory(unit, factoryState.input as RawResourceType);                            

                        } else {
                            console.log(`depositing resource`);
                            const { sector, localCoords } = factoryState.inputCell;
                            const visual = utils.createObject(sector.layers.resources, factoryState.input);
                            visual.position.set(localCoords.x * cellSize + cellSize / 2, 0, localCoords.y * cellSize + cellSize / 2);
                            meshes.load(`/models/resources/${factoryState.input}.glb`).then(([_mesh]) => {
                                const mesh = _mesh.clone();
                                visual.add(mesh);
                                mesh.position.y = 0.5;
                                mesh.castShadow = true;
                            }); 
                            inputCell.nonPickableResource = {
                                type: factoryState.input,
                                visual
                            };
                            this.goToResource(unit);
                        }
                    }
                }
            }
                break;

            case MiningStep.Mine: {
                this._miningTimer -= time.deltaTime;
                if (this._miningTimer < 0) {
                    const cell = getCellFromAddr(this._targetResource);
                    if (cell.resource && cell.resource.amount > 0) {
                        cell.resource.amount -= 1;
                        if (cell.resource.amount === 0) {
                            resources.clear(cell);
                        }

                        const resourceType = cell.resource.type;
                        const { pickedItems: layer } = GameMapState.instance.layers;                        
                        const visual = utils.createObject(layer, resourceType);
                        visual.matrixAutoUpdate = false;
                        visual.matrixWorldAutoUpdate = false;
                        meshes.load(`/models/resources/${resourceType}.glb`).then(([_mesh]) => {
                            const mesh = _mesh.clone();
                            visual.add(mesh);
                            mesh.castShadow = true;
                        });
                        unit.resource = {
                            visual,
                            type: resourceType
                        };

                        this.goToFactory(unit, cell.resource.type);
                    } else {
                        stopMining(unit);
                    }
                }
                break;
            }
        }
    }
}

