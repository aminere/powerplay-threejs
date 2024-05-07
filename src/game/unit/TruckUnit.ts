
import { Object3D } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { IUnit, Unit } from "./Unit";
import { ICell } from "../GameTypes";
import { GameMapState } from "../components/GameMapState";
import { IDepotState } from "../buildings/BuildingTypes";
import { config } from "../config/config";
import { TruckState } from "./states/TruckState";

const { resourcesPerSlot, slotCount } = config.trucks;
const truckCapacity = resourcesPerSlot * slotCount;

interface ITruckResources {
    type: RawResourceType | ResourceType;
    amount: number;
    root: Object3D;
}

export interface ITruckUnit extends IUnit {
    resources: ITruckResources | null;    
}

export class TruckUnit extends Unit implements ITruckUnit {    
    public get resources(): ITruckResources | null { return this._resources; }
    public set resources(value: ITruckResources | null) { 
        if (value === this._resources) {
            return;
        }
        if (this._resources) {
            this._resources.root.removeFromParent();
        }
        this._resources = value; 
    }

    private _resources: ITruckResources | null = null;

    public override setHitpoints(value: number) {
        if (value <= 0) {
            this.resources = null;
        }
        super.setHitpoints(value);
    }
    
    public override onReachedBuilding(cell: ICell) {
        const instance = GameMapState.instance.buildings.get(cell.building!)!;
        switch (instance.buildingType) {
            case "depot": {
                const state = instance.state as IDepotState;

                const truckAmount = this.resources?.amount ?? 0;
                const totalResources = state.amount + truckAmount;
                if (totalResources > 0) {

                    const getFromDepot = (() => {
                        if (this.resources) {
                            if (state.type === this.resources.type) {
                                // return this.resources.amount === 0;
                                const depotPercentFull = state.amount / state.capacity;
                                const truckPercentFull = this.resources.amount / truckCapacity;
                                if (depotPercentFull >= truckPercentFull) {                                    
                                    return true;
                                } else {
                                    return false;
                                }
                            } else {
                                // existing resources are lost
                                return true;
                            }
                        } else {
                            return true;
                        }
                    })();         
                    
                    const truckState = this.fsm.getState(TruckState)!;
                    truckState.startTransfer(instance, getFromDepot);
                }
            }
            break;
        }
    }

    public override clearAction() {
        const truckState = this.fsm.getState(TruckState)!;
        truckState.tryStopTransfer();
    }
}

