
import { BoxGeometry, Mesh, MeshBasicMaterial, Object3D, TextureLoader, Vector3 } from "three";
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { input } from "../../engine/Input";
import { pools } from "../../engine/Pools";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "./GameMapState";
import { time } from "../../engine/Time";
// import { objects } from "../../engine/Objects";
// import { SkeletonUtils } from "three/examples/jsm/Addons.js";

export class FlockProps extends ComponentProps {

    count = 50;
    separation = 2;
    speed = 2;
    lookSpeed = 2;

    constructor(props?: Partial<FlockProps>) {
        super();
        this.deserialize(props);
    }
}

type MotionState = "idle" | "moving";

interface IFlockState extends IComponentState {
    units: {
        unit: Object3D;
        initialToTarget: Vector3;
        motion: MotionState;
        desiredPos: Vector3;
        desiredPosValid: boolean;        
    }[];
    target?: Vector3;    
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
            this.state.target = new Vector3().copy(intersection);
            for (const unit of this.state.units) {
                unit.motion = "moving";
                unit.desiredPosValid = false;
                unit.initialToTarget.subVectors(this.state.target, unit.unit.position).setY(0).normalize();
            }
        }

        if (!this.state.target) {
            return;
        }

        const { units } = this.state;
        const [toTarget] = pools.vec3.get(1);
        const lookAt = pools.mat4.getOne();

        const separationDist = this.props.separation;

        for (let i = 0; i < units.length; ++i) {
            const { unit, motion, desiredPos } = units[i];            
            
            let speed = this.props.speed;
            if (motion === "idle") {
                desiredPos.copy(unit.position);
            } else if (!units[i].desiredPosValid) {
                toTarget.subVectors(this.state.target, unit.position).setY(0).normalize();
                desiredPos.addVectors(unit.position, toTarget.multiplyScalar(speed * time.deltaTime));                    
            }
            units[i].desiredPosValid = true;

            for (let j = 0; j < units.length; ++j) {
                if (j === i) {
                    continue;
                }
                const otherDesiredPos = (() => {
                    if (units[j].desiredPosValid) {
                        return units[j].desiredPos;
                    } else {
                        units[j].desiredPosValid = true;
                        toTarget.subVectors(this.state.target, units[j].unit.position).setY(0).normalize();
                        return units[j].desiredPos.addVectors(units[j].unit.position, toTarget.multiplyScalar(speed * time.deltaTime));
                    }
                })();

                const dist = otherDesiredPos.distanceTo(desiredPos);
                if (dist < separationDist) {
                    // move away from each other
                    const moveAmount = (separationDist - dist) / 2;
                    toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                    desiredPos.add(toTarget);
                    otherDesiredPos.sub(toTarget);
                }
            }

            unit.position.copy(desiredPos);
            toTarget.subVectors(this.state.target, desiredPos).setY(0).normalize();
            const pastTarget = toTarget.dot(units[i].initialToTarget) < 0;
            if (pastTarget) {
                units[i].motion = "idle";
            }
            
            // lookAt.lookAt(GameUtils.vec3.zero, lookDir.copy(direction).negate(), GameUtils.vec3.up);
            // unit.quaternion.setFromRotationMatrix(lookAt);
        }

        for (let i = 0; i < units.length; ++i) {
            units[i].desiredPosValid = false;
        }
    }

    private async load(owner: Object3D) {
        const radius = 5;
        const units: Object3D[] = [];
        // const mesh = await objects.load("/test/Worker.json");
        const loader = new TextureLoader();
        const cube = new Mesh(new BoxGeometry(.5, 2, .5), new MeshBasicMaterial({ color: 0xffffff, map: loader.load("/images/tile-selected.png") }));
        for (let i = 0; i < this.props.count; i++) {
            // const unit = SkeletonUtils.clone(mesh);
            const unit = cube.clone();
            owner.add(unit);
            unit.position.x = Math.random() * radius * 2 - radius;
            unit.position.z = Math.random() * radius * 2 - radius;
            units.push(unit);
        }
        this.setState({
            units: units.map((unit) => ({
                unit,
                initialToTarget: new Vector3(0, 0, 1),
                desiredPos: new Vector3(),
                desiredPosValid: false,
                motion: "idle"
            }))
        });
    }
}

