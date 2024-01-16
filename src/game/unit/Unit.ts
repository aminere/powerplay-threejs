import { Quaternion, SkinnedMesh, Vector2, Vector3 } from "three"
import { GameUtils } from "../GameUtils";
import { ICellAddr, unitUtils } from "./UnitUtils";
import { State, StateMachine } from "../fsm/StateMachine";
import { IUnit, UnitType } from "./IUnit";
import { engineState } from "../../engine/EngineState";
import { UnitCollisionAnim } from "../components/UnitCollisionAnim";
import { UnitFSM } from "./UnitFSM";
import { Fadeout } from "../components/Fadeout";

export interface IUnitProps {
    obj: SkinnedMesh;
    type: UnitType;
    id: number;
    speed?: number;
    states: State<IUnit>[];
}

export class Unit implements IUnit {
    public get desiredPosValid() { return this._desiredPosValid; }
    public get desiredPos() { return this._desiredPos; }
    public get targetCell() { return this._targetCell; }
    public get obj() { return this._obj; }    
    public get coords() { return this._coords; }
    public get isMoving() { return this._isMoving; }
    public get isColliding() { return this._isColliding; }
    public get isAlive() { return this._isAlive; }
    public get isIdle() { return this._isIdle; }
    public get collidable() { return this._collidable; }
    public get type() { return this._type; }
    public get id() { return this._id; }  
    public get health() { return this._health; }  

    public get velocity() { return this._velocity; }    
    public get lookAt() { return this._lookAt; }
    public get rotation() { return this._rotation; }    
    public get rotationVelocity() { return this._rotationVelocity; }
    public get fsm() { return this._fsm; }   
    public get speed() { return this._speed; }

    public set desiredPosValid(value: boolean) { this._desiredPosValid = value; }
    public set rotationVelocity(value: number) { this._rotationVelocity = value; }
    public set isMoving(value: boolean) { this._isMoving = value; }
    public set isColliding(value: boolean) { this._isColliding = value; }
    public set isIdle(value: boolean) { this._isIdle = value; }
    public set collidable(value: boolean) { this._collidable = value; }
    public set health(value: number) { 
        this._health = value; 
        if (value <= 0) {
            this._fsm.switchState(null);
            engineState.removeComponent(this._obj, UnitCollisionAnim);
            this._isAlive = false;            
            this._collidable = false;
            this._isMoving = false;
            this._isColliding = false;
            unitUtils.skeletonManager.applySkeleton("death", this._obj);
            engineState.setComponent(this._obj, new Fadeout({ delay: 1 }));
        }
    }

    private _desiredPosValid = false;
    private _desiredPos = new Vector3();   
    private _targetCell: ICellAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0
    };
    private _obj: SkinnedMesh;    
    private _coords: ICellAddr = {
        mapCoords: new Vector2(),
        localCoords: new Vector2(),
        sectorCoords: new Vector2(),
        cellIndex: 0
    };
    private _isMoving = false;
    private _isColliding = false;
    private _isAlive = true;
    private _isIdle = true;
    private _collidable = true;
    private _type = UnitType.Worker;
    private _health = 1;

    private _lookAt = new Quaternion();
    private _rotation = new Quaternion();
    private _velocity = new Vector3();
    private _rotationVelocity = 0;    
    private _fsm: StateMachine<IUnit>;
    private _id: number;    
    private _speed: number;

    constructor(props: IUnitProps) {
        this._obj = props.obj;
        this._type = props.type;
        this._id = props.id;
        this._fsm = new UnitFSM({ states: props.states, owner: this });
        this._speed = props.speed ?? 1;

        GameUtils.worldToMap(this._obj.position, this._coords.mapCoords);
        unitUtils.computeCellAddr(this._coords.mapCoords, this._coords);
        // console.log(`unit ${this._id} created at ${this._coords.mapCoords.x},${this._coords.mapCoords.y}`);
    }
}

