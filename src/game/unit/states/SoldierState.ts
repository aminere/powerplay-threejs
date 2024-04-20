import { Vector2 } from "three";
import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../CharacterUnit";
import { IUnit } from "../Unit";
import { GameUtils } from "../../GameUtils";

enum SoldierStep {
    Idle,    
    Attack
}

const cellCoords = new Vector2();

function findTarget(unit: IUnit) {
    const radius = 4;
    const { mapCoords } = unit.coords;
    for (let dy = -radius; dy < radius; dy++) {
        for (let dx = -radius; dx < radius; dx++) {
            cellCoords.set(mapCoords.x + dx, mapCoords.y + dy);
            const others = GameUtils.getCell(cellCoords)?.units;
            if (others) {
                for (const other of others) {
                    const isEnemy = other.type.startsWith("enemy");
                    if (isEnemy) {
                        return other;
                    }
                }
            }
        }
    }
    return null;
}

export class SoldierState extends State<ICharacterUnit> {

    private _step!: SoldierStep;

    override enter(_unit: IUnit) {        
        this._step = SoldierStep.Idle;
    }
    
    override exit(_unit: IUnit) {
        console.log(`SoldierState exit`);
    }

    override update(unit: IUnit) {        
        switch (this._step) {
            case SoldierStep.Idle: {
                const target = findTarget(unit);
                break;
            }

            case SoldierStep.Attack: {
                console.log(`SoldierState attack`);
                this._step = SoldierStep.Idle;
                break;
            }
        }
    }
}

