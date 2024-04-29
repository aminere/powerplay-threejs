import { time } from "../../../engine/core/Time";
import { IBuildingInstance, IDepotState } from "../../buildings/BuildingTypes";
import { config } from "../../config";
import { State } from "../../fsm/StateMachine";
import { ITruckUnit } from "../TruckUnit";
import { Trucks } from "../Trucks";
import { Depots } from "../../buildings/Depots";

const { transferFrequency } = config.trucks;

export class TruckState extends State<ITruckUnit> {

    private _targetDepot: IBuildingInstance | null = null;
    private _getFromDepot = false;
    private _timer = 0;

    override update(unit: ITruckUnit): void { 
        if (this._targetDepot) {
            if (this._timer < 0) {
                const depotState = this._targetDepot.state as IDepotState;
                const type = depotState.type;
                if (this._getFromDepot) {
                    if (Trucks.tryDepositResource(unit, type)) {
                        Depots.removeResource(this._targetDepot);
                    } else {
                        this.stopTransfer();
                    }
                } else {
                    if (Depots.tryDepositResource(this._targetDepot, type)) {
                        Trucks.removeResource(unit);
                    } else {
                        this.stopTransfer();
                    }
                }
                this._timer = transferFrequency;
            } else {
                this._timer -= time.deltaTime;
            }
        }
    }

    public startTransfer(instance: IBuildingInstance, getFromDepot: boolean) {
        this._targetDepot = instance;
        this._getFromDepot = getFromDepot;
        this._timer = transferFrequency;
    }

    public stopTransfer() {
        this._targetDepot = null;
    }
}

