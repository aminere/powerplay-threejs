import { Vector2 } from "three";
import { RawResourceType, ResourceType } from "../GameDefinitions";
import { buildings } from "./Buildings";
import { IBuildingInstance, IDepotState } from "./BuildingTypes";

export class Depots {
    public static create(sectorCoords: Vector2, localCoords: Vector2, type: RawResourceType | ResourceType) {
        const instance = buildings.create("depot", sectorCoords, localCoords);
        const depotState: IDepotState = { type, amount: 0 };
        instance.state = depotState;
    }

    public static tryDepositResource(instance: IBuildingInstance, type: RawResourceType | ResourceType) {
        const state = instance.state as IDepotState;        
        if (state.type === type) {
            return false;
        }


        state.amount++;
        return true;
    }
}

