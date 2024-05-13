
import { Object3D } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { Unit } from "./Unit";
import { ICell } from "../GameTypes";
import { GameMapState } from "../components/GameMapState";
import { IDepotState } from "../buildings/BuildingTypes";
import { TruckState } from "./states/TruckState";
import { IUnit } from "./IUnit";

// const { resourcesPerSlot, slotCount } = config.trucks;
// const truckCapacity = resourcesPerSlot * slotCount;

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
                const truckResourceType = this.resources?.type ?? null;
                const depotAmount = state.slots.slots.reduce((acc, slot) => {
                    const slotAmount = (() => {                        
                        if (truckResourceType === null || slot.type === truckResourceType) {
                            return slot.amount;
                        }
                        return 0;
                    })();
                    return acc + slotAmount;
                }, 0);
                const truckAmount = this.resources?.amount ?? 0;
                const totalResources = depotAmount + truckAmount;
                if (totalResources > 0) {
                    const truckState = this.fsm.getState(TruckState)!;
                    if (truckAmount > 0) {
                        truckState.startTransfer(instance, false);
                    } else {
                        truckState.startTransfer(instance, true);
                    }
                }
                
                // const state = instance.state as IDepotState;
                // const totalResources = state.amount + truckAmount;
                // if (totalResources > 0) {
                //     const truckState = this.fsm.getState(TruckState)!;
                //     if (truckAmount > 0) {
                //         if (state.type === this.resources!.type) {
                //             truckState.startTransfer(instance, false);
                //         } else {
                //             truckState.startTransfer(instance, true);    
                //         }

                //     } else {
                //         truckState.startTransfer(instance, true);
                //     }
                // }
            }
            break;
        }
    }

    public override clearAction() {
        const truckState = this.fsm.getState(TruckState)!;
        truckState.tryStopTransfer();
    }
}

