
import { Object3D } from "three";
import { Component } from "../../engine/ecs/Component";
import { ComponentProps } from "../../engine/ecs/ComponentProps";
import { unitUtils } from "../unit/UnitUtils";
import { FlockState } from "./FlockState";

export class FlockProps extends ComponentProps {

    public static get instance() { return this._instance!; }
    private static _instance: FlockProps | null = null;   

    radius = 20;
    count = 50;
    npcCount = 4;
    separation = 1;    
    speed = 4;
    avoidanceSpeed = 2;
    repulsion = .2;
    positionDamp = .05;

    constructor(props?: Partial<FlockProps>) {
        super();
        this.deserialize(props);
        FlockProps._instance = this;
    }

    public dispose() {
        FlockProps._instance = null;
    }
}

export class Flock extends Component<FlockProps, FlockState> {

    constructor(props?: Partial<FlockProps>) {
        super(new FlockProps(props));
    }

    override start(owner: Object3D) {        
        unitUtils.init(owner);

        // const sector0 = gameMapState.sectors.get(`0,0`)!;
        // const terrain = sector0.layers.terrain as Mesh;
        // const position = terrain.geometry.getAttribute("position") as THREE.BufferAttribute;
        // const radius = this.props.radius;
        // const mapCoords = pools.vec2.getOne();
        // let unitCount = 0;
        // for (let j = 0; j < mapRes; ++j) {
        //     for (let k = 0; k < mapRes; ++k) {

        //         if (j < 6) {
        //             continue;
        //         }

        //         const startVertexIndex = j * verticesPerRow + k;
        //         const _height1 = position.getY(startVertexIndex);
        //         const _height2 = position.getY(startVertexIndex + 1);
        //         const _height3 = position.getY(startVertexIndex + verticesPerRow);
        //         const _height4 = position.getY(startVertexIndex + verticesPerRow + 1);
        //         const _maxHeight = Math.max(_height1, _height2, _height3, _height4);
        //         const _minHeight = Math.min(_height1, _height2, _height3, _height4);
        //         if (_minHeight === _maxHeight && _minHeight >= 0 && _minHeight <= 1) {
        //             const mesh = sharedSkinnedMesh.clone();
        //             mesh.boundingBox = boundingBox;
        //             mapCoords.set(k, j);
        //             GameUtils.mapToWorld(mapCoords, mesh.position);
        //             unitUtils.createUnit({
        //                 obj: mesh,
        //                 type: UnitType.Worker,
        //                 states: [new MiningState()],
        //                 animation: skeletonManager.applyIdleAnim(mesh)
        //             });

        //             ++unitCount;
        //             if (unitCount >= this.props.count) {
        //                 break;
        //             }
        //         }
        //     }
        //     if (unitCount >= this.props.count) {
        //         break;
        //     }
        // }

        // const npcObj = await objects.load("/models/characters/NPC.json");
        // const createNpc = (pos: Vector3) => {
        //     const npcModel = SkeletonUtils.clone(npcObj);
        //     const npcMesh = npcModel.getObjectByProperty("isSkinnedMesh", true) as SkinnedMesh;
        //     npcMesh.position.copy(pos);
        //     const npc = unitUtils.createUnit({
        //         obj: npcMesh,
        //         type: UnitType.NPC,
        //         states: [new NPCState(), new ArcherNPCState()],
        //         animation: skeletonManager.applyIdleAnim(npcMesh),
        //         speed: .7
        //     });
        //     npc.fsm.switchState(NPCState);
        // }

        // for (let i = 0; i < this.props.npcCount; ++i) {
        //     createNpc(new Vector3(
        //         10 + Math.random() * radius * 2 - radius,
        //         0,
        //         Math.random() * radius * 2 - radius,
        //     ));
        // }

        this.setState(new FlockState());
    }
    
    override dispose() {        
        unitUtils.dispose();
        this.state.dispose();
        this.props.dispose();
    }
}

