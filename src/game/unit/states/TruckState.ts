// import { time } from "../../../engine/core/Time";
import { IBuildingInstance } from "../../buildings/BuildingTypes";
// import { config } from "../../config/config";
import { State } from "../../fsm/StateMachine";
import { ITruckUnit } from "../TruckUnit";
// import { Trucks } from "../Trucks";
// import { Depots } from "../../buildings/Depots";

// const { transferFrequency } = config.trucks;

export class TruckState extends State<ITruckUnit> {

    private _targetDepot: IBuildingInstance | null = null;
    // private _getFromDepot = false;
    // private _timer = 0;

    override update(_unit: ITruckUnit): void { 
        // if (this._targetDepot) {
        //     if (this._timer < 0) {
        //         const depotState = this._targetDepot.state as IDepotState;
                
        //         if (this._getFromDepot) {

        //             const transferred = (() => {
        //                 if (depotState.amount > 0) {
        //                     console.assert(depotState.type !== null);
        //                     if (Trucks.tryDepositResource(unit, depotState.type!)) {
        //                         Depots.removeResource(this._targetDepot);
        //                         return true;
        //                     }
        //                 }
        //                 return false;
        //             })();

        //             if (!transferred) {
        //                 this.stopTransfer();
        //             }
                    
        //         } else {

        //             const transferred = (() => {
        //                 if ((unit.resources?.amount ?? 0) > 0) {
        //                     if (Depots.tryDepositResource(this._targetDepot, unit.resources!.type)) {
        //                         Trucks.removeResource(unit);
        //                         return true;
        //                     }                      
        //                 }
        //                 return false;
        //             })();

        //             if (!transferred) {
        //                 this.stopTransfer();
        //             }                    
        //         }
        //         this._timer = transferFrequency;
        //     } else {
        //         this._timer -= time.deltaTime;
        //     }
        // }
    }

    public startTransfer(instance: IBuildingInstance, _getFromDepot: boolean) {
        this._targetDepot = instance;
        // this._getFromDepot = getFromDepot;
        // this._timer = transferFrequency;
    }

    public tryStopTransfer() {
        if (this._targetDepot) {
            this.stopTransfer();
        }
    }

    private stopTransfer() {
        this._targetDepot = null;
    }
}

