import { time } from "../../../engine/core/Time";
import { RawResourceType } from "../../GameDefinitions";
import { IBuildingInstance, IDepotState } from "../../buildings/BuildingTypes";
import { depots } from "../../buildings/Depots";
import { config } from "../../config/config";
import { State } from "../../fsm/StateMachine";
import { ITruckUnit } from "../TruckUnit";
import { Trucks } from "../Trucks";

const { transferFrequency } = config.trucks;

export class TruckState extends State<ITruckUnit> {

    private _targetDepot: IBuildingInstance | null = null;
    private _getFromDepot = false;
    private _timer = 0;

    override update(unit: ITruckUnit): void { 
        if (this._targetDepot) {
            if (this._timer < 0) {                
                if (this._getFromDepot) {
                    const transferred = (() => {
                        const depotResources = Object.keys(depots.getReservesPerType(this._targetDepot));
                        const depotState = this._targetDepot.state as IDepotState;
                        const resourceType = (() => {
                            if (depotResources.length === 1) {
                                return depotResources[0] as RawResourceType;
                            } else if (depotState.output) {
                                return depotState.output;
                            }
                            return null;
                        })();
                        if (!resourceType) {
                            return false;
                        }
                        if (depots.hasResource(this._targetDepot, resourceType, 1)) {
                            if (Trucks.tryDepositResource(unit, resourceType)) {
                                depots.removeResource(this._targetDepot, resourceType, 1);
                                return true;
                            }
                        }
                        return false;
                    })();

                    if (!transferred) {
                        this.stopTransfer();
                    }
                    
                } else {

                    const transferred = (() => {
                        if ((unit.resources?.amount ?? 0) > 0) {
                            if (depots.tryDepositResource(this._targetDepot, unit.resources!.type)) {
                                Trucks.removeResource(unit);
                                return true;
                            }                      
                        }
                        return false;
                    })();

                    if (!transferred) {
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

    public tryStopTransfer() {
        if (this._targetDepot) {
            this.stopTransfer();
        }
    }

    private stopTransfer() {
        this._targetDepot = null;
    }
}

