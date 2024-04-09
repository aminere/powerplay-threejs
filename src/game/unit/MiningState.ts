import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { Vector2 } from "three";
import { time } from "../../engine/core/Time";
import { unitAnimation } from "./UnitAnimation";
import { copyUnitAddr, getCellFromAddr, makeUnitAddr } from "./UnitAddr";
import { unitMotion } from "./UnitMotion";
import { IBuildingInstance, IFactoryState, buildingSizes } from "../buildings/BuildingTypes";
import { GameMapState } from "../components/GameMapState";
import { resources } from "../Resources";
import { utils } from "../../engine/Utils";
import { meshes } from "../../engine/resources/Meshes";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { GameUtils } from "../GameUtils";

enum MiningStep {
    GoToResource,
    Mine,
    GoToFactory,
}

const cellCoords = new Vector2();

function findClosestFactory(unit: IUnit, resourceType: RawResourceType | ResourceType) {
    // TODO search in a spiral pattern across sectors
    // requires that buildings are stored in sectors instead of a global map
    const { buildings } = GameMapState.instance;
    let distToClosest = 999999;
    let closestFactory: IBuildingInstance | null = null;
    const size = buildingSizes.factory;
    for (const [, instance] of buildings) {
        if (instance.buildingType !== "factory") {
            continue;
        }

        const otherState = instance.state as IFactoryState;
        if (otherState.input !== resourceType) {
            continue;
        }

        cellCoords.set(instance.mapCoords.x + (size.x - 1) / 2, instance.mapCoords.y + (size.z - 1) / 2);
        const dist = cellCoords.distanceTo(unit.coords.mapCoords);
        if (dist < distToClosest) {
            distToClosest = dist;
            closestFactory = instance;
        }
    }
    return closestFactory;
}


function pickResource(unit: IUnit, resourceType: RawResourceType | ResourceType) {
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
}

function stopMining(unit: IUnit) {
    if (unit.motionId > 0) {
        unitMotion.onUnitArrived(unit);
    }
    unit.fsm.switchState(null);
    unitAnimation.setAnimation(unit, "idle", { transitionDuration: .3, scheduleCommonAnim: true });
    unit.collidable = true;
}

export class MiningState extends State<IUnit> {

    public set potentialTarget(value: Vector2) { this._potentialTarget.copy(value); }

    private _step!: MiningStep;
    private _miningTimer!: number;
    private _targetResource = makeUnitAddr();
    private _potentialTarget = new Vector2(-1, -1);
    private _closestFactory: IBuildingInstance | null = null;

    override enter(unit: IUnit) {
        console.log(`MiningState enter`);
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

    private goToFactory(unit: IUnit, resourceType: RawResourceType | ResourceType) {
        const factory = findClosestFactory(unit, resourceType);
        this._closestFactory = factory;
        if (this._closestFactory) {
            const isMining = unit.animation.name === "pick";
            if (isMining) {
                unitMotion.moveUnit(unit, this._closestFactory.mapCoords, false);
                unitAnimation.setAnimation(unit, "run", {
                    transitionDuration: .3,
                    scheduleCommonAnim: true
                });
            } else {
                unitMotion.moveUnit(unit, this._closestFactory.mapCoords);
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
                        this._step = MiningStep.Mine;
                        this._miningTimer = 1;
                        unitAnimation.setAnimation(unit, "pick", { transitionDuration: 1 });
                        unit.collidable = false;

                    } else if (cell.pickableResource) {

                        pickResource(unit, cell.pickableResource.type);
                        this.goToFactory(unit, cell.pickableResource.type);
                        cell.pickableResource.visual.removeFromParent();
                        cell.pickableResource = undefined;

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

                    if (!Number.isNaN(this._potentialTarget.x)) {                        
                        const potentialTarget = GameUtils.getCell(this._potentialTarget)!;
                        this._potentialTarget.set(NaN, NaN);

                        const targetCell = getCellFromAddr(unit.targetCell);
                        if (potentialTarget.building?.instanceId === targetCell.building?.instanceId) {
                            // arrived at factory
                            const factoryState = this._closestFactory!.state as IFactoryState;
                            console.assert(factoryState.input === unit.resource!.type, `factory input is ${factoryState.input} and unit resource is ${unit.resource!.type}`);
                            factoryState.inputReserve++;
                            unit.resource!.visual.removeFromParent();
                            unit.resource = null;
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
                        const resourceType = cell.resource.type;
                        cell.resource.amount -= 1;
                        if (cell.resource.amount === 0) {
                            resources.clear(cell);
                        }
                        pickResource(unit, resourceType);
                        this.goToFactory(unit, resourceType);
                    } else {
                        console.log("resource depleted");
                        stopMining(unit);
                    }
                }
                break;
            }
        }
    }

    public onReachedDepletedResource(unit: IUnit) {
        // TODO find closest similar resources
        stopMining(unit);
    }
    
}

