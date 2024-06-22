

import { MathUtils, Matrix4, Object3D, Quaternion, Vector3 } from "three";
import { IVehicleUnit, VehicleUnit } from "./VehicleUnit";
import { mathUtils } from "../MathUtils";
import { GameUtils } from "../GameUtils";
import { time } from "../../engine/core/Time";
import { IUnitProps } from "./Unit";
import { utils } from "../../engine/Utils";
import { IdleTank } from "./states/IdleTank";
import { objects } from "../../engine/resources/Objects";
import { Rocket } from "../components/Rocket";
import { unitConfig } from "../config/UnitConfig";
import { GameMapState } from "../components/GameMapState";
import { engineState } from "../../engine/EngineState";
import { AutoDestroy } from "../components/AutoDestroy";
import gsap from "gsap";

export interface ITankUnit extends IVehicleUnit {
    aimCannon(target: Vector3): void;
    resetCannon(): void;
    shoot(targetPos: Vector3): void;
}

const localPos = new Vector3();
const localRotation = new Quaternion();
const matrix = new Matrix4();
const cannonOffset = new Vector3(0, 0.12, 1.38);
const toTarget = new Vector3();

export class TankUnit extends VehicleUnit implements ITankUnit {

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

    public shoot(targetPos: Vector3) {
        const _rocket = objects.loadImmediate("/prefabs/rocket.json")!;
        const rocket = utils.instantiate(_rocket);

        const rocketComponent = utils.getComponent(Rocket, rocket)!;
        rocketComponent.state.shooter = this;
        rocketComponent.state.damage = unitConfig[this.type].damage;

        const { projectiles } = GameMapState.instance.layers;
        rocket.position.copy(cannonOffset);
        this._cannon.add(rocket);
        projectiles.attach(rocket);
        
        toTarget.subVectors(targetPos, rocket.position).normalize();     
        rocket.quaternion.setFromUnitVectors(GameUtils.vec3.forward, toTarget);

        const _explosion = objects.loadImmediate("/prefabs/tank-shot.json")!;
        const explosion = utils.instantiate(_explosion);
        explosion.position.copy(cannonOffset);
        explosion.scale.setScalar(.4);
        this._cannon.add(explosion);
        this.coords.sector.layers.fx.attach(explosion);
        engineState.setComponent(explosion, new AutoDestroy({ delay: 1.5 }));

        // recoil
        gsap.to(this._cannon.position, {
            duration: MathUtils.randFloat(.05, .08),
            z: `-=.15`,
            yoyo: true,
            repeat: 3,
            ease: "bounce.inOut"
        });        
    }

    public override clearAction() {
        this.fsm.switchState(IdleTank);
    }
}

