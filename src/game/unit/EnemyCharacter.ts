import { ICell } from "../GameTypes";
import { CharacterUnit } from "./CharacterUnit";
import { AttackBuildingState } from "./states/AttackBuildingState";

export class EnemyCharacter extends CharacterUnit {
    public override onReachedBuilding(_cell: ICell) {
        const attackBuilding = this.fsm.getState(AttackBuildingState);
        if (attackBuilding) {
            attackBuilding.startAttack(this);
        }

        if (this.motionId === 0) {
            this.onArrived();
        }
    }
}

