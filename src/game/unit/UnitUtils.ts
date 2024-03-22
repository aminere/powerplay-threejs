import { Box3Helper, Object3D, Vector2 } from "three";
import { GameUtils } from "../GameUtils";
import { IUnitProps, Unit } from "./Unit";
import { cmdFogAddCircle } from "../../Events";
import { IUnit, UnitType } from "./IUnit";
import { MiningState } from "./MiningState";
import { skeletonManager } from "../animation/SkeletonManager";
import { utils } from "../../engine/Utils";

class UnitUtils {

    public get units() { return this._units; }

    private _owner!: Object3D;
    private _units!: Unit[];

    public init(owner: Object3D) {
        this._owner = owner;
        this._units = [];
    }

    public dispose() {
        this._units.length = 0;
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
        const sharedMesh = skeletonManager.sharedSkinnedMesh;
        const boundingBox = skeletonManager.boundingBox;
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

    public kill(unit: IUnit) {
        unit.health = 0;
        const index = this._units.indexOf(unit as Unit);
        console.assert(index >= 0, `unit ${unit.id} not found`);
        utils.fastDelete(this._units, index);

        const cell = unit.coords.sector!.cells[unit.coords.cellIndex];
        const unitIndex = cell.units!.indexOf(unit);
        console.assert(unitIndex >= 0, `unit ${unit.id} not found in cell`);
        utils.fastDelete(cell.units!, unitIndex);
    }
}

export const unitUtils = new UnitUtils();

