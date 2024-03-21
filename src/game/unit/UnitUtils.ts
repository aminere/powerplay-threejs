import { Box3, Box3Helper, Object3D, SkinnedMesh, Vector2 } from "three";
import { GameUtils } from "../GameUtils";
import { IUnitProps, Unit } from "./Unit";
import { cmdFogAddCircle } from "../../Events";
import { UnitType } from "./IUnit";
import { MiningState } from "./MiningState";
import { skeletonManager } from "../animation/SkeletonManager";

interface SharedSkinnedMesh {
    mesh: SkinnedMesh;
    boundingBox: Box3;
};

class UnitUtils {

    public get units() { return this._units; }

    private _owner!: Object3D;
    private _units!: Unit[];
    private _sharedSkinnedMesh!: SharedSkinnedMesh;

    public init(owner: Object3D, sharedSkinnedMesh: SharedSkinnedMesh) {
        this._owner = owner;
        this._units = [];
        this._sharedSkinnedMesh = sharedSkinnedMesh;
    }

    public createUnit(props: IUnitProps) {
        const { obj } = props;
        obj.userData.unserializable = true;
        obj.bindMode = "detached";
        const id = this._units.length;
        const unit = new Unit(props, id);
        this._units.push(unit);
        this._owner.add(obj);
        cmdFogAddCircle.post({ mapCoords: unit.coords.mapCoords, radius: 10 });
        const box3Helper = new Box3Helper(obj.boundingBox);
        obj.add(box3Helper);
        box3Helper.visible = false;
        return unit;
    }

    public spawn(mapCoords: Vector2) {
        const { mesh: sharedMesh, boundingBox } = this._sharedSkinnedMesh;
        const mesh = sharedMesh.clone();
        mesh.boundingBox = boundingBox;
        GameUtils.mapToWorld(mapCoords, mesh.position);
        this.createUnit({
            obj: mesh,
            type: UnitType.Worker,
            states: [new MiningState()],
            animation: skeletonManager.applyIdleAnim(mesh)
        });
    }
}

export const unitUtils = new UnitUtils();

