
import { Object3D, Vector3 } from "three";
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { input } from "../../engine/Input";
import { pools } from "../../engine/Pools";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "./GameMapState";
import { time } from "../../engine/Time";
import { objects } from "../../engine/Objects";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";

export class FlockProps extends ComponentProps {

    separation = 2;
    speed = 2;
    lookSpeed = 2;

    constructor(props?: Partial<FlockProps>) {
        super();
        this.deserialize(props);
    }
}

interface IFlockState extends IComponentState {
    units: {
        unit: Object3D;
        direction: Vector3;
    }[];
    target: Vector3;
}

export class Flock extends Component<FlockProps, IFlockState> {
    constructor(props?: Partial<FlockProps>) {
        super(new FlockProps(props));
    }

    override start(owner: Object3D) {
        this.load(owner);
    }

    override update() {
        if (!this.state) {
            return;
        }

        if (input.touchJustReleased) {
            const intersection = pools.vec3.getOne();
            const camera = gameMapState.camera;
            GameUtils.screenCastOnPlane(camera, input.touchPos, 0, intersection);
            this.state.target.copy(intersection);
        }

        const { units } = this.state;
        const [toTarget, lookDir, separation, awayDir] = pools.vec3.get(4);
        const lookAt = pools.mat4.getOne();

        const separationDist = this.props.separation;

        for (let i = 0; i < units.length; ++i) {
            const { unit, direction } = units[i];
            toTarget.subVectors(this.state.target, unit.position).setY(0).normalize();

            separation.set(0, 0, 0);
            let collisionCount = 0;            
            for (let j = 0; j < units.length; ++j) {
                if (j === i) {
                    continue;
                }
                const myPos = unit.position;
                const otherPos = units[j].unit.position;
                const dist = myPos.distanceTo(otherPos);
                if (dist < separationDist && dist > 0) {
                    awayDir.subVectors(myPos, otherPos).normalize();
                    const factor = separationDist / dist;
                    separation.add(awayDir.multiplyScalar(factor * factor));
                    ++collisionCount;
                }
            }
            if (collisionCount > 0) {
                separation.multiplyScalar(1 / collisionCount);
            }
            toTarget.add(separation).normalize();
            direction.lerp(toTarget, time.deltaTime * this.props.lookSpeed).normalize();

            unit.position.addScaledVector(direction, this.props.speed * time.deltaTime);            
            lookAt.lookAt(GameUtils.vec3.zero, lookDir.copy(direction).negate(), GameUtils.vec3.up);
            unit.quaternion.setFromRotationMatrix(lookAt);
        }
    }

    private async load(owner: Object3D) {
        const count = 10;
        const radius = 5;
        const units: Object3D[] = [];
        const mesh = await objects.load("/test/Worker.json");
        for (let i = 0; i < count; i++) {
            const unit = SkeletonUtils.clone(mesh);
            owner.add(unit);
            unit.position.x = Math.random() * radius * 2 - radius;
            unit.position.z = Math.random() * radius * 2 - radius;
            units.push(unit);
        }
        this.setState({
            units: units.map((unit) => ({
                unit,
                direction: new Vector3(0, 0, 1)
            })),
            target: new Vector3()
        });
    }
}

