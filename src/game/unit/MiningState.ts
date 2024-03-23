import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { Object3D, Vector2 } from "three";
import { pools } from "../../engine/core/Pools";
import { time } from "../../engine/core/Time";
import { unitAnimation } from "./UnitAnimation";
import { IUnitAddr, copyUnitAddr } from "./UnitAddr";
import { unitMotion } from "./UnitMotion";
import { GameMapState } from "../components/GameMapState";

enum MiningStep {
    GoToResource,
    Mine,
    GoToBase,
}

export class MiningState extends State<IUnit> {

    public set potentialTarget(value: Vector2) { this._potentialTarget.copy(value); }

    private _step!: MiningStep;
    private _miningTimer!: number;
    private _targetResource: IUnitAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0,
    };
    private _potentialTarget = new Vector2(-1, -1);

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

            case MiningStep.GoToBase: {
                const isTarget = unit.targetCell.mapCoords.equals(this._potentialTarget);
                if (isTarget) {
                    if (unit.motionId > 0) {
                        unitMotion.onUnitArrived(unit);    
                    }
                    this._step = MiningStep.GoToResource;                    
                    // TODO
                    // unitUtils.moveTo(unit, this._targetResource.mapCoords);
                }
            }
                break;

            case MiningStep.Mine:
                this._miningTimer -= time.deltaTime;
                if (this._miningTimer < 0) {
                    const { layers } = GameMapState.instance;
                    let distToClosestBuilding = 999999;
                    let closestBuilding: Object3D | null = null;
                    const worldPos = pools.vec3.getOne();
                    for (const building of layers.buildings.children) {
                        building.getWorldPosition(worldPos);
                        const dist = worldPos.distanceTo(unit.obj.position);
                        if (dist < distToClosestBuilding) {
                            distToClosestBuilding = dist;
                            closestBuilding = building;
                        }
                    }
                    if (!closestBuilding) {
                        // TODO scan other sectors
                        console.assert(false, "No building found");
                    } else {

                        console.assert(false, "Not implemented");
                        // closestBuilding.getWorldPosition(worldPos);
                        // const targetBuilding = pools.vec2.getOne();
                        // GameUtils.worldToMap(worldPos, targetBuilding);
                        // if (flowField.compute(targetBuilding)) {
                        //     unitUtils.moveTo(unit, targetBuilding, false);
                        //     unitUtils.setAnimation(unit, "run", {
                        //         transitionDuration: .3,
                        //         scheduleCommonAnim: true
                        //     });
                        // } else {
                        //     console.assert(false, "No path found");
                        // }
                    }
                    this._step = MiningStep.GoToBase;
                }
                break;

        }
    }
}

