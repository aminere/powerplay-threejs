
import { Constructor } from "../../engine/Types";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";
import { unitUtils } from "./UnitUtils";
import gsap from "gsap";

enum MiningStep {
    MoveToTarget,
    Mine,
    MoveToBase,
    DropOff,
}

export class MiningState extends State<IUnit> {

    private _step!: MiningStep;

    override enter(unit: IUnit) {  
        this._step = MiningStep.MoveToTarget;      
        unitUtils.moveTo(unit, unit.targetCell.mapCoords);
    }
    
    override update(unit: IUnit, _switchState: (state: Constructor<State<IUnit>>) => void): void {
        switch (this._step) {
            case MiningStep.MoveToTarget:
                if (unit.targetCell.mapCoords.equals(unit.coords.mapCoords)) {
                    this._step = MiningStep.Mine;
                    unitUtils.skeletonManager.applySkeleton("pick", unit.obj);
                }
                break;
            case MiningStep.Mine:
                
                break;
            case MiningStep.MoveToBase:
                
                break;
            case MiningStep.DropOff:
                
                break;
        }        
    }

    public startMining(unit: IUnit) {
        console.log("startMining");
        this._step = MiningStep.Mine;
        unitUtils.skeletonManager.applySkeleton("pick", unit.obj);
    }
}


