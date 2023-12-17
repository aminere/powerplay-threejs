
import { Box3, Matrix4, Object3D, OrthographicCamera, Quaternion, Ray, SkinnedMesh, Vector2, Vector3 } from "three";
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

interface IUnit {
    obj: Object3D;
    initialToTarget: Vector3;
    motion: MotionState;
    desiredPos: Vector3;
    desiredPosValid: boolean;
    lookDir: Vector3;
    target: Vector3;
}

interface IFlockState extends IComponentState {
    units: IUnit[];
    selectedUnits: number[];
    selectionStart: Vector2;
    touchPressed: boolean;
    selectionInProgress: boolean;
    baseRotation: Quaternion;
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
            this.state.touchPressed = true;                
            this.state.selectionStart.copy(input.touchPos);

        } else if (input.touchJustReleased) {
            this.state.touchPressed = false;     
            if (input.touchButton === 0) {

                if (this.state.selectionInProgress) {
                    cmdEndSelection.post();
                    this.state.selectionInProgress = false;

                } else {
                    const { width, height } = engine.screenRect;
                    const normalizedPos = pools.vec2.getOne();
                    normalizedPos.set((input.touchPos.x / width) * 2 - 1, -(input.touchPos.y / height) * 2 + 1);
                    const { rayCaster } = GameUtils;
                    rayCaster.setFromCamera(normalizedPos, gameMapState.camera);
    
                    const { units } = this.state;
                    const intersections: Array<{ unitIndex: number; distance: number; }> = [];
                    const intersection = pools.vec3.getOne();
                    for (let i = 0; i < units.length; ++i) {
                        const { obj } = units[i];
                        this._inverseMatrix.copy(obj.matrixWorld).invert();
                        this._localRay.copy(rayCaster.ray).applyMatrix4(this._inverseMatrix);
                        const boundingBox = (obj as SkinnedMesh).boundingBox;
                        if (this._localRay.intersectBox(boundingBox, intersection)) {
                            intersections.push({ unitIndex: i, distance: this._localRay.origin.distanceTo(intersection) });
                        }
                    }
                    
                    if (intersections.length > 0) {
                        intersections.sort((a, b) => a.distance - b.distance);
                        const selectedUnit = intersections[0].unitIndex;
                        this.state.selectedUnits = [selectedUnit];
                    } else {
                        this.state.selectedUnits.length = 0;
                    }
    
                    cmdSetSeletedUnits.post(this.state.selectedUnits.map(i => {
                        const selectedUnit = this.state.units[i];
                        return {
                            obj: selectedUnit.obj,
                            health: 1
                        }
                    }));
                }                

            } else if (input.touchButton === 2) {
                if (this.state.selectedUnits.length > 0) {
                    const intersection = pools.vec3.getOne();
                    GameUtils.screenCastOnPlane(gameMapState.camera, input.touchPos, 0, intersection);
                    for (const selected of this.state.selectedUnits) {
                        const unit = this.state.units[selected];
                        unit.motion = "moving";
                        unit.desiredPosValid = false;
                        unit.target.copy(intersection);
                        unit.initialToTarget.subVectors(unit.target, unit.obj.position).setY(0).normalize();
                    }
                }
            }
        }

        if (input.touchJustMoved) {
            if (this.state.touchPressed) {
                if (input.touchButton === 0) {
                    if (this.state.selectionInProgress) {
                        const { selectedUnits } = this.state;
                        selectedUnits.length = 0;
                        const { units } = this.state;
                        const screenPos = pools.vec3.getOne();
                        for (let i = 0; i < units.length; ++i) {
                            const { obj } = units[i];
                            GameUtils.worldToScreen(obj.position, gameMapState.camera, screenPos);
                            const rectX = Math.min(this.state.selectionStart.x, input.touchPos.x);
                            const rectY = Math.min(this.state.selectionStart.y, input.touchPos.y);
                            const rectWidth = Math.abs(input.touchPos.x - this.state.selectionStart.x);
                            const rectHeight = Math.abs(input.touchPos.y - this.state.selectionStart.y);
                            if (screenPos.x >= rectX && screenPos.x <= rectX + rectWidth && screenPos.y >= rectY && screenPos.y <= rectY + rectHeight) {
                                selectedUnits.push(i);
                            }
                        }

                        cmdSetSeletedUnits.post(selectedUnits.map(i => {
                            const selectedUnit = this.state.units[i];
                            return {
                                obj: selectedUnit.obj,
                                health: 1
                            }
                        }));

                    } else {
                        const dx = input.touchPos.x - this.state.selectionStart.x;
                        const dy = input.touchPos.y - this.state.selectionStart.y;
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        const threshold = 5;
                        if (dist > threshold) {
                            this.state.selectionInProgress = true;
                            cmdStartSelection.post(this.state.selectionStart);
                        }
                    }
                }
            }
        }

        const { repulsion } = this.props;
        const { units } = this.state;
        const separationDist = this.props.separation;
        const steerAmount = this.props.speed * time.deltaTime;
        const maxSteerAmount = this.props.maxSpeed * time.deltaTime;
        const lookAt = pools.mat4.getOne();
        const lookDir = pools.vec3.getOne();
        const quat = pools.quat.getOne();
        const toTarget = pools.vec3.getOne();
        for (let i = 0; i < units.length; ++i) {
            const { obj, motion, desiredPos } = units[i];            
            
            if (motion === "idle") {
                desiredPos.copy(obj.position);
            } else if (!units[i].desiredPosValid) {
                toTarget.subVectors(units[i].target, obj.position).setY(0).normalize();
                desiredPos.addVectors(obj.position, toTarget.multiplyScalar(steerAmount));                    
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
                        toTarget.subVectors(units[j].target, units[j].obj.position).setY(0).normalize();
                        return units[j].desiredPos.addVectors(units[j].obj.position, toTarget.multiplyScalar(steerAmount));
                    }
                })();

                const dist = otherDesiredPos.distanceTo(desiredPos);
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

            toTarget.subVectors(units[i].target, obj.position).setY(0).normalize();

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
                obj.quaternion.multiplyQuaternions(quat, this.state.baseRotation);
            }
        }

        const { positionDamp } = this.props;
        for (let i = 0; i < units.length; ++i) {
            if (units[i].motion === "moving") {
                units[i].obj.position.copy(units[i].desiredPos);
            } else {
                units[i].obj.position.lerp(units[i].desiredPos, positionDamp);
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
        const headOffset = new Vector3();   
        for (let i = 0; i < this.props.count; i++) {
            const obj = shareSkinnedMesh.clone();
            obj.bindMode = "detached";
            obj.bind(sharedSkeleton, identity);
            obj.quaternion.copy(sharedRootBone.parent!.quaternion);
            obj.userData.unserializable = true;
            headOffset.copy(obj.position).setZ(1.8);
            obj.boundingBox = new Box3().setFromObject(obj).expandByPoint(headOffset);            
            owner.add(obj);
            obj.position.x = Math.random() * radius * 2 - radius;
            obj.position.z = Math.random() * radius * 2 - radius;
            units.push(obj);
        }
        this.setState({
            units: units.map(obj => {
                const unit: IUnit = {
                    obj,
                    initialToTarget: new Vector3(),
                    desiredPos: new Vector3(),
                    desiredPosValid: false,
                    motion: "idle",
                    lookDir: new Vector3(0, 0, 1),
                    target: new Vector3().copy(obj.position),                    
                }
                return unit;
            }),
            selectedUnits: [],
            selectionStart: new Vector2(),
            selectionInProgress: false,
            touchPressed: false,
            baseRotation: sharedRootBone.parent!.quaternion.clone()
        });

        engine.scene!.add(sharedRootBone);
        engineState.setComponent(sharedRootBone, new Animator({ animation: "walking" }));
    }
}

