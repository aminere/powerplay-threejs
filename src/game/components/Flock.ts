
import { Matrix4, Object3D, Quaternion, SkinnedMesh, Vector3 } from "three";
import { Component, IComponentState } from "../../engine/Component";
import { ComponentProps } from "../../engine/ComponentProps";
import { input } from "../../engine/Input";
import { pools } from "../../engine/Pools";
import { GameUtils } from "../GameUtils";
import { gameMapState } from "./GameMapState";
import { time } from "../../engine/Time";
import { SkeletonUtils } from "three/examples/jsm/Addons.js";
import { objects } from "../../engine/Objects";
import { engine } from "../../engine/Engine";
import { engineState } from "../../powerplay";
import { Animator } from "../../engine/components/Animator";

// import { objects } from "../../engine/Objects";
// import { SkeletonUtils } from "three/examples/jsm/Addons.js";

export class FlockProps extends ComponentProps {

    radius = 20;
    count = 50;
    separation = 1;
    maxSpeed = 10;
    speed = 4;   
    lookSpeed = 2;
    repulsion = .2;
    positionDamp = .4;

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
        lookDir: Vector3;
        originalQuaternion: Quaternion;
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
                // const material = ((unit.unit as Mesh).material as MeshBasicMaterial);
                // material.opacity = 1;
                // material.wireframe = false;
            }
        }

        if (!this.state.target) {
            return;
        }

        const { units } = this.state;
        const [toTarget] = pools.vec3.get(1);

        const separationDist = this.props.separation;
        const steerAmount = this.props.speed * time.deltaTime;
        const maxSteerAmount = this.props.maxSpeed * time.deltaTime;

        const lookAt = pools.mat4.getOne();
        const quat = pools.quat.getOne();
        for (let i = 0; i < units.length; ++i) {
            const { unit, motion, desiredPos } = units[i];            
            
            if (motion === "idle") {
                desiredPos.copy(unit.position);
            } else if (!units[i].desiredPosValid) {
                toTarget.subVectors(this.state.target, unit.position).setY(0).normalize();
                desiredPos.addVectors(unit.position, toTarget.multiplyScalar(steerAmount));                    
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
                        return units[j].desiredPos.addVectors(units[j].unit.position, toTarget.multiplyScalar(steerAmount));
                    }
                })();

                const dist = otherDesiredPos.distanceTo(desiredPos);
                const { repulsion } = this.props;             
                if (dist < separationDist) {
                    if (units[j].motion === "idle") {
                        if (units[i].motion === "moving") {
                            const moveAmount = Math.min((separationDist - dist) + repulsion , maxSteerAmount);
                            toTarget.subVectors(otherDesiredPos, desiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            otherDesiredPos.add(toTarget);                            
                        } else {
                            // move away from each other
                            const moveAmount = Math.min((separationDist - dist) / 2 + repulsion, maxSteerAmount);
                            toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                            desiredPos.add(toTarget);
                            otherDesiredPos.sub(toTarget);
                        }
                    } else if (units[i].motion === "idle") {
                        const moveAmount = Math.min((separationDist - dist) + repulsion, maxSteerAmount);
                        toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                        desiredPos.add(toTarget);
                    } else {
                        // move away from each other
                        const moveAmount = Math.min((separationDist - dist) / 2, maxSteerAmount);
                        toTarget.subVectors(desiredPos, otherDesiredPos).setY(0).normalize().multiplyScalar(moveAmount);
                        desiredPos.add(toTarget);
                        otherDesiredPos.sub(toTarget);
                    }
                }
            }

            toTarget.subVectors(this.state.target, unit.position).setY(0).normalize();

            if (units[i].motion === "moving") {
                const pastTarget = toTarget.dot(units[i].initialToTarget) < 0;
                if (pastTarget) {
                    units[i].motion = "idle";
                    // const material = ((units[i].unit as Mesh).material as MeshBasicMaterial);
                    // material.opacity = 0.5;
                }
            }
            
            units[i].lookDir.lerp(toTarget.negate(), .3).normalize();
            lookAt.lookAt(GameUtils.vec3.zero, units[i].lookDir, GameUtils.vec3.up);
            quat.setFromRotationMatrix(lookAt);
            unit.quaternion.multiplyQuaternions(quat, units[i].originalQuaternion);
        }

        const { positionDamp } = this.props;
        for (let i = 0; i < units.length; ++i) {
            if (units[i].motion === "moving") {
                units[i].unit.position.copy(units[i].desiredPos);
            } else {
                units[i].unit.position.lerp(units[i].desiredPos, positionDamp);
            }            
            units[i].desiredPosValid = false;
        }
    }

    private async load(owner: Object3D) {
        const radius = this.props.radius;
        const units: Object3D[] = [];
        const mesh = await objects.load("/test/Worker.json");
        // const loader = new TextureLoader();
        // const geometry = new BoxGeometry(.5, 2, .5);
        // const material = new MeshBasicMaterial({ 
        //     color: 0xffffff,
        //     map: loader.load("/images/grid.png"),
        //     transparent: true
        // });

        // shared skeleton
        const identity = new Matrix4();
        const sharedModel = SkeletonUtils.clone(mesh);
        const shareSkinnedMesh = sharedModel.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
        const sharedSkeleton = shareSkinnedMesh.skeleton;
        const sharedRootBone = sharedSkeleton.bones[0];

        // individual skeletons        
        for (let i = 0; i < this.props.count; i++) {
            // const unit = new Mesh(geometry, material.clone());
            // const unit = SkeletonUtils.clone(mesh);
            // engineState.setComponent(unit, new Animator({ animation: "walking" }));
            const unit = shareSkinnedMesh.clone();
            unit.bindMode = "detached";
            unit.bind(sharedSkeleton, identity);
            unit.quaternion.copy(sharedRootBone.parent!.quaternion);
            unit.userData.unserializable = true;
            
            owner.add(unit);
            unit.position.x = Math.random() * radius * 2 - radius;
            unit.position.z = Math.random() * radius * 2 - radius;
            units.push(unit);
        }
        this.setState({
            units: units.map((unit) => ({
                unit,
                initialToTarget: new Vector3(),
                desiredPos: new Vector3(),
                desiredPosValid: false,
                motion: "idle",
                movedLaterally: false,
                lookDir: new Vector3(0, 0, 1),
                originalQuaternion: unit.quaternion.clone()
            }))
        });

        engine.scene!.add(sharedRootBone);
        engineState.setComponent(sharedRootBone, new Animator({ animation: "walking" }))

    }
}

