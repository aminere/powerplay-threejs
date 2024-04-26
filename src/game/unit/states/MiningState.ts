import { State } from "../../fsm/StateMachine";
import { IUnit } from "../Unit";
import { Vector2 } from "three";
import { time } from "../../../engine/core/Time";
import { unitAnimation } from "../UnitAnimation";
import { computeUnitAddr, copyUnitAddr, getCellFromAddr, makeUnitAddr } from "../UnitAddr";
import { unitMotion } from "../UnitMotion";
import { IBuildingInstance, IFactoryState, buildingSizes } from "../../buildings/BuildingTypes";
import { GameMapState } from "../../components/GameMapState";
import { RawResourceType, ResourceType } from "../../GameDefinitions";
import { ICharacterUnit } from "../CharacterUnit";
import { ICell } from "../../GameTypes";
import { Workers } from "../Workers";

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

export class MiningState extends State<ICharacterUnit> {

    private _step!: MiningStep;
    private _miningTimer!: number;
    private _targetResource = makeUnitAddr();
    private _closestFactory: IBuildingInstance | null = null;

    override enter(unit: IUnit) {
        console.log(`MiningState enter`);
        this._step = MiningStep.GoToResource;
        copyUnitAddr(unit.targetCell, this._targetResource);
        unit.isIdle = false;
    }

    override exit(unit: IUnit): void {
        console.log(`MiningState exit`);
        unit.isIdle = true;
    }

    private goToFactory(unit: ICharacterUnit, resourceType: RawResourceType | ResourceType) {
        const factory = findClosestFactory(unit, resourceType);
        this._closestFactory = factory;
        if (this._closestFactory) {
            const size = buildingSizes.factory;
            const coords = this._closestFactory.mapCoords;
            const center = cellCoords.set(Math.round(coords.x + (size.x - 1) / 2), Math.round(coords.y + (size.z - 1) / 2));
            const isMining = unit.animation.name === "pick";
            if (isMining) {
                unitMotion.moveUnit(unit, center, false);
                unitAnimation.setAnimation(unit, "run", { transitionDuration: .3, scheduleCommonAnim: true });
            } else {
                unitMotion.moveUnit(unit, center);
            }            
            this._step = MiningStep.GoToFactory;
        } else {
            this.stopMining(unit);
        }
    }

    override update(unit: ICharacterUnit): void {
        switch (this._step) {            

            case MiningStep.GoToFactory: {

                if (this._closestFactory!.deleted) {

                    const factoryState = this._closestFactory!.state as IFactoryState;
                    const resourceType = factoryState.input as RawResourceType;
                    this.goToFactory(unit, resourceType);
                    this._closestFactory = null;
                }
            }
                break;

            case MiningStep.Mine: {
                this._miningTimer -= time.deltaTime;
                if (this._miningTimer < 0) {
                    const cell = getCellFromAddr(this._targetResource);
                    if (cell.resource && cell.resource.amount > 0) {
                        const resourceType = cell.resource.type as RawResourceType;
                        cell.resource.amount -= 1;
                        if (cell.resource.amount === 0) {
                            cell.resource = undefined;
                        }
                        Workers.pickResource(unit, resourceType);
                        this.goToFactory(unit, resourceType);
                        unit.collidable = true;
                    } else {
                        // depleted resource
                        this.stopMining(unit);
                    }
                }
                break;
            }
        }
    }

    public onReachedResource(unit: ICharacterUnit, cell: ICell, mapCoords: Vector2) {
        console.assert(this._step === MiningStep.GoToResource);
        console.assert(cell.resource);

        if (!this._targetResource.mapCoords.equals(mapCoords)) {
            computeUnitAddr(mapCoords, this._targetResource);
        }

        if (unit.resource) {
            if (unit.resource.type === cell.resource!.type) {
                this.goToFactory(unit, unit.resource.type);
            } else {
                unit.resource = null;
                this.startMining(unit);
            }
        } else {
            this.startMining(unit);
        }
    }

    public onReachedFactory(unit: ICharacterUnit) {
        console.assert(this._step === MiningStep.GoToFactory);
        this._step = MiningStep.GoToResource;
        unitMotion.moveUnit(unit, this._targetResource.mapCoords);

        // avoid traffic jams at the factory
        unit.collidable = false;
        setTimeout(() => { unit.collidable = true }, 300);
    }

    public stopMining(unit: ICharacterUnit) {
        unit.fsm.switchState(null);
        if (unit.motionId > 0) {
            unitMotion.endMotion(unit);
        }
        unit.onArrived();
        unit.collidable = true;
    }

    private startMining(unit: ICharacterUnit) {
        this._step = MiningStep.Mine;
        this._miningTimer = 1;
        unitAnimation.setAnimation(unit, "pick", { transitionDuration: .4 });
        unit.collidable = false;
    }
}

