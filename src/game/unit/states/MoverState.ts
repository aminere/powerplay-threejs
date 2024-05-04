import { State } from "../../fsm/StateMachine";
import { IUnit } from "../Unit";
import { Vector2 } from "three";
import { time } from "../../../engine/core/Time";
import { unitAnimation } from "../UnitAnimation";
import { computeUnitAddr, copyUnitAddr, getCellFromAddr, makeUnitAddr } from "../UnitAddr";
import { unitMotion } from "../UnitMotion";
import { BuildingType, IBuildingInstance, IDepotState, IFactoryState, IIncubatorState, buildingSizes } from "../../buildings/BuildingTypes";
import { GameMapState } from "../../components/GameMapState";
import { RawResourceType, ResourceType } from "../../GameDefinitions";
import { ICharacterUnit } from "../CharacterUnit";
import { ICell } from "../../GameTypes";
import { Workers } from "../Workers";
import { config } from "../../config";
import { FactoryDefinitions } from "../../buildings/FactoryDefinitions";

enum MoverStep {
    GoToResource,    
    GoToTarget,
    Extract
}

const cellCoords = new Vector2();

function findClosestTarget(unit: IUnit, resourceType: RawResourceType | ResourceType, targetType: BuildingType) {
    // TODO search in a spiral pattern across sectors
    // requires that buildings are stored in sectors instead of a global map
    const { buildings } = GameMapState.instance;
    let distToClosest = 999999;
    let closest: IBuildingInstance | null = null;
    const size = buildingSizes.factory;    

    for (const [, instance] of buildings) {

        const canAcceptResource = (() => {
            if (instance.buildingType === targetType) {
                switch (instance.buildingType) {
                    case "depot": {
                        const state = instance.state as IDepotState;
                        return state.type === resourceType && state.amount < state.capacity; 
                    }                
    
                    case "factory": {
                        const state = instance.state as IFactoryState;
                        if (state.output) {
                            const inputs = FactoryDefinitions[state.output];
                            if (inputs.includes(resourceType)) {
                                const { inputCapacity } = config.factories;
                                const amount = state.reserve.get(resourceType) ?? 0;
                                return amount < inputCapacity;
                            }
                        }
                        return false;
                    }          
                    
                    case "incubator": {
                        const state = instance.state as IIncubatorState;
                        switch (resourceType) {
                            case "water": {
                                const capacity = config.incubators.capacity.water;
                                return state.amount.water < capacity;
                            }

                            case "coal": {
                                const capacity = config.incubators.capacity.coal;
                                return state.amount.coal < capacity;
                            }

                            default: return false;
                        }
                    }
    
                    default: return false;
                }
            }            
        })();

        if (!canAcceptResource) {
            continue;
        }

        cellCoords.set(instance.mapCoords.x + (size.x - 1) / 2, instance.mapCoords.y + (size.z - 1) / 2);
        const dist = cellCoords.distanceTo(unit.coords.mapCoords);
        if (dist < distToClosest) {
            distToClosest = dist;
            closest = instance;
        }
    }
    return closest;
}

export class MoverState extends State<ICharacterUnit> {

    private _step!: MoverStep;
    private _extractionTimer!: number;
    private _targetResource = makeUnitAddr();
    private _closestTarget: IBuildingInstance | null = null;
    private _targetType: BuildingType | null = null;

    override enter(unit: IUnit) {
        console.log(`MoverState enter`);
        this._step = MoverStep.GoToResource;
        copyUnitAddr(unit.targetCell, this._targetResource);
        unit.isIdle = false;
    }

    override exit(unit: IUnit): void {
        console.log(`MoverState exit`);
        unit.isIdle = true;
        unit.collidable = true;
    }

    public tryGoToTarget(unit: ICharacterUnit, resourceType: RawResourceType | ResourceType) {
        if (this._targetType) {
            const target = findClosestTarget(unit, resourceType, this._targetType!);        
            this._closestTarget = target;
            if (this._closestTarget) {
                const size = buildingSizes[this._targetType];
                const coords = this._closestTarget.mapCoords;
                const center = cellCoords.set(Math.round(coords.x + (size.x - 1) / 2), Math.round(coords.y + (size.z - 1) / 2));
                const isExtracting = unit.animation.name === "pick";
                if (isExtracting) {
                    unitMotion.moveUnit(unit, center, false);
                    unitAnimation.setAnimation(unit, "run", { transitionDuration: .3, scheduleCommonAnim: true });
                } else {
                    unitMotion.moveUnit(unit, center);
                }
                this._step = MoverStep.GoToTarget;
            } else {
                this.stopExtraction(unit);
            }
        } else {
            // do nothing, wait for player to assign a target type
            this.stopExtraction(unit);
        }        
    }

    override update(unit: ICharacterUnit): void {
        switch (this._step) {            

            case MoverStep.GoToTarget: {
                if (this._closestTarget!.deleted) {
                    this._closestTarget = null;
                    console.assert(unit.resource);
                    const resourceType = unit.resource!.type;
                    this.tryGoToTarget(unit, resourceType);                    
                }
            }
                break;

            case MoverStep.Extract: {                
                if (this._extractionTimer < 0) {
                    const cell = getCellFromAddr(this._targetResource);
                    if (cell.resource && cell.resource.amount > 0) {
                        const resourceType = cell.resource.type as RawResourceType;
                        if (resourceType === "water") {
                            // TODO deal with water differently, must lower the water level in the surrounding water patch
                            // clear the entire water patch when level reaches 0
                        } else {
                            cell.resource.amount -= 1;
                            if (cell.resource.amount === 0) {
                                cell.resource = undefined;
                            }
                        }                        
                        Workers.pickResource(unit, resourceType);
                        this.tryGoToTarget(unit, resourceType);
                        unit.collidable = true;
                    } else {
                        // depleted resource
                        this.stopExtraction(unit);
                    }
                } else {
                    this._extractionTimer -= time.deltaTime;
                }
                break;
            }
        }
    }

    public onReachedResource(unit: ICharacterUnit, cell: ICell, mapCoords: Vector2) {
        console.assert(this._step === MoverStep.GoToResource);
        console.assert(cell.resource);

        if (!this._targetResource.mapCoords.equals(mapCoords)) {
            computeUnitAddr(mapCoords, this._targetResource);
        }

        if (unit.resource) {
            if (unit.resource.type === cell.resource!.type) {
                this.tryGoToTarget(unit, unit.resource.type);
            } else {
                unit.resource = null;
                this.startExtraction(unit);
            }
        } else {
            this.startExtraction(unit);
        }
    }

    public onReachedBuilding(unit: ICharacterUnit) {
        console.assert(this._step === MoverStep.GoToTarget);
        this._step = MoverStep.GoToResource;
        unitMotion.moveUnit(unit, this._targetResource.mapCoords);

        // avoid traffic jams at the target building
        unit.collidable = false;
        setTimeout(() => { unit.collidable = true }, 300);
    }

    public stopExtraction(unit: ICharacterUnit) {
        unit.fsm.switchState(null);
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);
        }
        unit.onArrived();
        unit.collidable = true;
    }

    private startExtraction(unit: ICharacterUnit) {
        this._step = MoverStep.Extract;
        this._extractionTimer = 1;
        unitAnimation.setAnimation(unit, "pick", { transitionDuration: .4 });
        unit.collidable = false;
    }
}

