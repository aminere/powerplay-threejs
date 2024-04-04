import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { Vector2 } from "three";
import { time } from "../../engine/core/Time";
import { unitAnimation } from "./UnitAnimation";
import { copyUnitAddr, makeUnitAddr } from "./UnitAddr";
import { unitMotion } from "./UnitMotion";
import { IBuildingInstance, buildingSizes } from "../buildings/BuildingTypes";
import { GameMapState } from "../components/GameMapState";

enum MiningStep {
    GoToResource,
    Mine,
    GoToFactory,
}

const inputSlot = new Vector2();
const closestInputSlot = new Vector2();

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

    override update(unit: IUnit): void {
        switch (this._step) {

            case MiningStep.GoToResource: {
                const isTarget = unit.targetCell.mapCoords.equals(this._potentialTarget);
                if (isTarget) {
                    this._potentialTarget.set(NaN, NaN);
                    if (unit.motionId > 0) {
                        unitMotion.onUnitArrived(unit);
                    }
                    unit.collidable = false;
                    this._step = MiningStep.Mine;
                    this._miningTimer = 1;
                    unitAnimation.setAnimation(unit, "pick", { transitionDuration: 1 });
                }
            }
                break;

            case MiningStep.GoToFactory: {
                const goToResource = () => {
                    if (unit.motionId > 0) {
                        unitMotion.onUnitArrived(unit);
                    }
                    this._step = MiningStep.GoToResource;
                    unitMotion.moveUnit(unit, this._targetResource.mapCoords);
                };

                if (this._closestFactory!.deleted) {
                    this._closestFactory = null;
                    goToResource();
                } else {
                    const isTarget = unit.targetCell.mapCoords.equals(this._potentialTarget);
                    if (isTarget) {
                        this._potentialTarget.set(NaN, NaN);
                        goToResource();
                    }
                }                
            }
                break;

            case MiningStep.Mine: {
                this._miningTimer -= time.deltaTime;
                if (this._miningTimer < 0) {

                    const factorySize = buildingSizes["factory"];
                    if (!this._closestFactory || this._closestFactory.deleted) {
                        // TODO search in a spiral pattern across sectors
                        // requires that buildings are stored in sectors instead of a global map
                        const { buildings } = GameMapState.instance;
                        let distToClosestBuilding = 999999;
                        this._closestFactory = null;
                        for (const [, instance] of buildings) {
                            if (instance.buildingType !== "factory") {
                                continue;
                            }
                            inputSlot.set(instance.mapCoords.x, instance.mapCoords.y + factorySize.z - 1);
                            const dist = inputSlot.distanceTo(unit.coords.mapCoords);
                            if (dist < distToClosestBuilding) {
                                distToClosestBuilding = dist;
                                this._closestFactory = instance;
                                closestInputSlot.copy(inputSlot);
                            }
                        }
                    }

                    if (this._closestFactory) {
                        console.assert(!this._closestFactory.deleted);
                        unitMotion.moveUnit(unit, closestInputSlot, false);
                        unitAnimation.setAnimation(unit, "run", {
                            transitionDuration: .3,
                            scheduleCommonAnim: true
                        });
                        this._step = MiningStep.GoToFactory;
                    }
                }
                break;
            }
        }
    }
}

