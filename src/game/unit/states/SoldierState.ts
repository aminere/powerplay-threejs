import { State } from "../../fsm/StateMachine";
import { ICharacterUnit } from "../CharacterUnit";
import { IUnit } from "../Unit";
import { UnitUtils } from "../UnitUtils";

enum SoldierStep {
    Idle,    
    Attack
}

export class SoldierState extends State<ICharacterUnit> {

    private _step!: SoldierStep;

    override enter(_unit: IUnit) {      
        console.log(`SoldierState enter`);  
        this._step = SoldierStep.Idle;
    }
    
    override exit(_unit: IUnit) {
        console.log(`SoldierState exit`);
    }

    override update(unit: IUnit) {
        switch (this._step) {
            case SoldierStep.Idle: {
                const target = UnitUtils.spiralSearch(unit, 4, other => {
                    const isEnemy = other.type.startsWith("enemy");
                    return isEnemy;
                });
                if (target) {
                    console.log("TODO attack");
                    this._step = SoldierStep.Attack;                
                }
                break;
            }

            case SoldierStep.Attack: {                
                break;
            }
        }
    }
}

