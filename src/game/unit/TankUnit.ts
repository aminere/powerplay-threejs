

import { Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { IVehicleUnit, VehicleUnit } from "./VehicleUnit";
import { mathUtils } from "../MathUtils";
import { GameUtils } from "../GameUtils";
import { time } from "../../engine/core/Time";
import { IUnitProps } from "./Unit";
import { utils } from "../../engine/Utils";
import { IdleTank } from "./states/IdleTank";

export interface ITankUnit extends IVehicleUnit {
    cannon: Object3D;
    aimCannon(target: Vector3): void;
    resetCannon(): void;
}

const localPos = new Vector3();
const localRotation = new Quaternion();
const matrix = new Matrix4();

export class TankUnit extends VehicleUnit implements ITankUnit {

    public get cannon() { return this._cannon; }

    private _cannon!: Object3D;
    private _cannonRotator!: Object3D;

    constructor(props: IUnitProps) {
        super(props);

        this._cannon = this.visual.getObjectByName("cannon")!;
        const cannonRoot = utils.createObject(this.visual, "cannon-root");
        cannonRoot.position.copy(this._cannon.position);
        this._cannonRotator = utils.createObject(this.visual, "cannon-rotator");
        cannonRoot.add(this._cannonRotator);
        this._cannonRotator.attach(this._cannon);
    }

    public aimCannon(target: Vector3) {
        const damping = 0.25;
        this._cannonRotator.parent!.worldToLocal(localPos.copy(target));
        localPos.y = 0; // keep cannon parallel to the ground
        const localMatrix = matrix.lookAt(GameUtils.vec3.zero, localPos.negate(), GameUtils.vec3.up);
        localRotation.setFromRotationMatrix(localMatrix);
        mathUtils.smoothDampQuat(this._cannonRotator.quaternion, localRotation, damping, time.deltaTime);
    }

    public resetCannon() {
        const damping = 0.25;
        localRotation.identity();
        mathUtils.smoothDampQuat(this._cannonRotator.quaternion, localRotation, damping, time.deltaTime);
    }

    public override clearAction() {
        this.fsm.switchState(IdleTank);
    }
}

