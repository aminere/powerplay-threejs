import { ICell } from "../GameTypes";
import { CharacterUnit } from "./CharacterUnit";
import { AttackBuilding } from "./states/AttackBuilding";

export class EnemyCharacter extends CharacterUnit {
    public override onReachedBuilding(_cell: ICell) {
        const attackBuilding = this.fsm.getState(AttackBuilding);
        if (attackBuilding) {
            attackBuilding.startAttack(this);
        }

        if (this.motionId === 0) {
            this.onArrived();
        }
    }
}

