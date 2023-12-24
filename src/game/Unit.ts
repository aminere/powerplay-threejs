import { Quaternion, SkinnedMesh, Vector2, Vector3 } from "three"
import { GameUtils } from "./GameUtils";
import { ICellAddr, computeCellAddr } from "./CellCoords";
import { StateMachine } from "./fsm/StateMachine";
import { IUnit } from "./unit/IUnit";
import { MiningState } from "./unit/MiningState";

export class Unit implements IUnit {
    public get desiredPosValid() { return this._desiredPosValid; }
    public get obj() { return this._obj; }
    public get targetCell() { return this._targetCell; }

    public get desiredPos() { return this._desiredPos; }
    public get coords() { return this._coords; }
    public get velocity() { return this._velocity; }
    public get isMoving() { return this._isMoving; }
    public get lookAt() { return this._lookAt; }
    public get rotation() { return this._rotation; }    
    public get rotationVelocity() { return this._rotationVelocity; }
    public get fsm() { return this._fsm; }   

    public set desiredPosValid(value: boolean) { this._desiredPosValid = value; }
    public set rotationVelocity(value: number) { this._rotationVelocity = value; }
    public set isMoving(value: boolean) { this._isMoving = value; }

    private _obj: SkinnedMesh;
    private _desiredPos = new Vector3();
    private _desiredPosValid = false;
    private _lookAt = new Quaternion();
    private _rotation = new Quaternion();
    private _velocity = new Vector3();
    private _isMoving = false;
    private _rotationVelocity = 0;
    private _targetCell: ICellAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0
    };
    private _coords: ICellAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0
    };
    
    private _fsm: StateMachine<IUnit>;

    constructor(obj: SkinnedMesh) {
        this._obj = obj;
        GameUtils.worldToMap(obj.position, this._coords.mapCoords);
        computeCellAddr(this._coords.mapCoords, this._coords);

        this._fsm = new StateMachine<IUnit>({
            states: [new MiningState()],
            owner: this
        });
    }

    update() {
        this._fsm.update();
    }
}

