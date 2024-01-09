import { time } from "../../engine/Time";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import { Object3D, Vector2, Vector3 } from "three";
import { GameUtils } from "../GameUtils";
import { pools } from "../../engine/Pools";

enum MiningStep {
    GoToResource,
    Mine,
    GoToBase,
}

export class MiningState extends State<IUnit> {

    private _step!: MiningStep;
    private _miningTimer!: number;
    private _targetResource!: Vector2;
    private _targetBuilding!: Vector2;

    override enter(_unit: IUnit) {
        this._step = MiningStep.GoToResource;
        this._targetResource = _unit.targetCell.mapCoords.clone();
    }

    override update(unit: IUnit): void {
        switch (this._step) {

            case MiningStep.Mine:
                this._miningTimer -= time.deltaTime;
                if (this._miningTimer < 0) {
                    if (this._targetBuilding === undefined) {
                        const sector = unit.coords.sector!;
                        let distToClosestBuilding = 999999;
                        let closestBuilding: Vector3 | null = null;
                        const worldPos = pools.vec3.getOne();
                        for (const building of sector.layers.buildings.children) {
                            building.getWorldPosition(worldPos);
                            const dist = worldPos.distanceTo(unit.obj.position);
                            if (dist < distToClosestBuilding) {
                                distToClosestBuilding = dist;
                                closestBuilding = worldPos;
                            }
                        }
                        if (!closestBuilding) {
                            console.assert(false, "No building found");
                            // TODO scan other sectors
                        }
                        this._targetBuilding = GameUtils.worldToMap(closestBuilding!, new Vector2());
                    }
                    unitUtils.moveTo(unit, this._targetBuilding);
                    this._step = MiningStep.GoToBase;
                }
                break;

        }
    }

    public onArrivedAtTarget(unit: IUnit) {
        switch (this._step) {
            case MiningStep.GoToResource:
                this._step = MiningStep.Mine;
                this._miningTimer = 1;
                unitUtils.skeletonManager.applySkeleton("pick", unit.obj);
                break;

            case MiningStep.GoToBase:
                this._step = MiningStep.GoToResource;
                unitUtils.moveTo(unit, this._targetResource);
                break;
        }
    }
}

