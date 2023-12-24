import { Vector2 } from "three";
import { ICellAddr } from "../CellCoords";
import { State } from "../fsm/StateMachine";
import { IUnit } from "./IUnit";

export class MiningState extends State<IUnit> {
    targetCell: ICellAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0
    };

    override enter(_owner: IUnit) {
        console.log('enter mining state');
    }    
}

