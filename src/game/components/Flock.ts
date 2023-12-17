
import { Box3, Box3Helper, LineBasicMaterial, Matrix4, Object3D, OrthographicCamera, Quaternion, Ray, SkinnedMesh, Vector2, Vector3 } from "three";
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
import { cmdStartSelection, cmdEndSelection, cmdSetSeletedUnits } from "../../Events";

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
        target: Vector3;
    }[];
    selectedUnits: number[];
    selectionStart: Vector2;
    selectionInProgress: boolean;
}

export class Flock extends Component<FlockProps, IFlockState> {
    constructor(props?: Partial<FlockProps>) {
        super(new FlockProps(props));
    }

    override start(owner: Object3D) {
        this.load(owner);
    }

    private _localRay = new Ray();
    private _inverseMatrix = new Matrix4();
    override update(_owner: Object3D) {
        if (!this.state) {
            return;
        }

        if (input.touchJustPressed) {        
            this.state.selectionInProgress = true;
            this.state.selectionStart.copy(input.touchPos);
            cmdStartSelection.post(input.touchPos);

        } else if (input.touchJustReleased) {
            const camera = gameMapState.camera as OrthographicCamera;
            if (input.touchButton === 0) {

                if (this.state.selectionInProgress) {
                    cmdEndSelection.post();
                    this.state.selectionInProgress = false;
                    
                } else {
                    const { width, height } = engine.screenRect;
                    const normalizedPos = pools.vec2.getOne();
                    normalizedPos.set((input.touchPos.x / width) * 2 - 1, -(input.touchPos.y / height) * 2 + 1);
                    const { rayCaster } = GameUtils;
                    rayCaster.setFromCamera(normalizedPos, camera);
    
                    let selectedUnit: number | null = null;
                    const { units } = this.state;
                    for (let i = 0; i < units.length; ++i) {
                        const { unit } = units[i];
                        // convert ray to local space of skinned mesh
                        this._inverseMatrix.copy(unit.matrixWorld).invert();
                        this._localRay.copy(rayCaster.ray).applyMatrix4(this._inverseMatrix);
                        const boundingBox = (unit as SkinnedMesh).boundingBox;
                        if (this._localRay.intersectsBox(boundingBox)) {
                            selectedUnit = i;
                            break;
                        }
                    }
                    for (const selected of this.state.selectedUnits) {
                        const { unit } = units[selected];
                        const box3Helper = unit.children[0] as Box3Helper;
                        (box3Helper.material as LineBasicMaterial).color.setHex(0xff0000);
                    }
                    if (selectedUnit !== null) {
                        const { unit } = units[selectedUnit];
                        const box3Helper = unit.children[0] as Box3Helper;
                        (box3Helper.material as LineBasicMaterial).color.setHex(0xffff00);
                        this.state.selectedUnits = [selectedUnit];                    
                    } else {
                        this.state.selectedUnits.length = 0;
                    }
    
                    cmdSetSeletedUnits.post(this.state.selectedUnits.map(i => {
                        const selectedUnit = this.state.units[i];
                        return {
                            obj: selectedUnit.unit,
                            health: 1
                        }
                    }));
                }
                

            } else if (input.touchButton === 2) {
                if (this.state.selectedUnits.length > 0) {
                    const intersection = pools.vec3.getOne();
                    GameUtils.screenCastOnPlane(camera, input.touchPos, 0, intersection);
                    for (const selected of this.state.selectedUnits) {
                        const unit = this.state.units[selected];
                        unit.motion = "moving";
                        unit.desiredPosValid = false;
                        unit.target.copy(intersection);
                        unit.initialToTarget.subVectors(unit.target, unit.unit.position).setY(0).normalize();
                    }
                }
            }
        }

        if (input.touchJustMoved) {
            if (this.state.selectionInProgress) {
                // TODO update selected units
            }
        }

        const { units } = this.state;
        const [toTarget] = pools.vec3.get(1);

        const separationDist = this.props.separation;
        const steerAmount = this.props.speed * time.deltaTime;
        const maxSteerAmount = this.props.maxSpeed * time.deltaTime;

        const lookAt = pools.mat4.getOne();
        const lookDir = pools.vec3.getOne();
        const quat = pools.quat.getOne();
        for (let i = 0; i < units.length; ++i) {
            const { unit, motion, desiredPos } = units[i];            
            
            if (motion === "idle") {
                desiredPos.copy(unit.position);
            } else if (!units[i].desiredPosValid) {
                toTarget.subVectors(units[i].target, unit.position).setY(0).normalize();
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
                        toTarget.subVectors(units[j].target, units[j].unit.position).setY(0).normalize();
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

            toTarget.subVectors(units[i].target, unit.position).setY(0).normalize();

            if (units[i].motion === "moving") {
                const pastTarget = toTarget.dot(units[i].initialToTarget) < 0;
                if (pastTarget) {
                    units[i].motion = "idle";
                    // const material = ((units[i].unit as Mesh).material as MeshBasicMaterial);
                    // material.opacity = 0.5;
                }

                units[i].lookDir.lerp(toTarget, .3).normalize();
                lookDir.copy(units[i].lookDir).negate();
                lookAt.lookAt(GameUtils.vec3.zero, lookDir, GameUtils.vec3.up);
                quat.setFromRotationMatrix(lookAt);
                unit.quaternion.multiplyQuaternions(quat, units[i].originalQuaternion);
            }
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

        // shared skeleton
        const identity = new Matrix4();
        const sharedModel = SkeletonUtils.clone(mesh);
        const shareSkinnedMesh = sharedModel.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
        const sharedSkeleton = shareSkinnedMesh.skeleton;
        const sharedRootBone = sharedSkeleton.bones[0];

        // individual skeletons  
        const headOffset = new Vector3();   
        for (let i = 0; i < this.props.count; i++) {
            const unit = shareSkinnedMesh.clone();
            unit.bindMode = "detached";
            unit.bind(sharedSkeleton, identity);
            unit.quaternion.copy(sharedRootBone.parent!.quaternion);
            unit.userData.unserializable = true;
            headOffset.copy(unit.position).setZ(1.8);
            unit.boundingBox = new Box3().setFromObject(unit).expandByPoint(headOffset);

            const box3Helper = new Box3Helper(unit.boundingBox, 0xff0000);
            box3Helper.visible = false;
            unit.add(box3Helper);
            
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
                originalQuaternion: unit.quaternion.clone(),
                target: new Vector3().copy(unit.position)
            })),
            selectedUnits: [],
            selectionStart: new Vector2(),
            selectionInProgress: false
        });

        engine.scene!.add(sharedRootBone);
        engineState.setComponent(sharedRootBone, new Animator({ animation: "walking" }));
    }
}

