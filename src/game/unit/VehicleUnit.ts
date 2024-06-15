import { Mesh, Object3D } from "three";
import { utils } from "../../engine/Utils";
import { meshes } from "../../engine/resources/Meshes";
import { IUnit } from "./IUnit";
import { IUnitProps, Unit } from "./Unit";
import { IUnitAddr, computeUnitAddr2x2, makeUnitAddr } from "./UnitAddr";
import { engineState } from "../../engine/EngineState";
import { Explode } from "../components/Explode";
import { UnitUtils } from "./UnitUtils";
import { cmdFogRemoveCircle } from "../../Events";
import { Fadeout } from "../components/Fadeout";
import { objects } from "../../engine/resources/Objects";
import { AutoDestroy } from "../components/AutoDestroy";

export interface IVehicleUnit extends IUnit {
    coords2x2: IUnitAddr;
    targetCell2x2: IUnitAddr;
}

export class VehicleUnit extends Unit implements IVehicleUnit {
    public get coords2x2() { return this._coords2x2; }
    public get targetCell2x2() { return this._targetCell2x2; }

    private _coords2x2 = makeUnitAddr();
    private _targetCell2x2 = makeUnitAddr();

    constructor(props: IUnitProps) {
        super(props);

        computeUnitAddr2x2(this.coords.mapCoords, this._coords2x2);
        const cell2x2 = this._coords2x2.sector.cells2x2[this._coords2x2.cellIndex];
        cell2x2.units.push(this);
    }

    public override setHitpoints(value: number) {
        const willDie = value <= 0;
        if (willDie && this.isAlive) {
            const cell = this._coords2x2.sector.cells2x2[this._coords2x2.cellIndex];
            const unitIndex = cell.units!.indexOf(this);
            console.assert(unitIndex >= 0, `unit ${this.type} not found in cell`);
            utils.fastDelete(cell.units!, unitIndex);
        }

        super.setHitpoints(value);
    }

    public override onDeath() {
        const _chunks = meshes.loadImmediate("/models/tank-chunks.glb");
        const chunks = new Object3D();
        chunks.name = "tank-chunks";
        this.visual.getWorldPosition(chunks.position);
        this.visual.getWorldQuaternion(chunks.quaternion);
        this.visual.getWorldScale(chunks.scale);
        chunks.updateMatrixWorld();
        this.coords.sector.layers.fx.attach(chunks);
        for (const _chunk of _chunks) {
            const chunk = _chunk.clone();            
            chunks.add(chunk);
        }

        const cannonRoot = this.visual.getObjectByName("cannon-root")!;
        cannonRoot.traverse(child => {
            if ((child as Mesh).isMesh) {
                child.castShadow = false;
            }
        });
        chunks.attach(cannonRoot);        

        const _explosion = objects.loadImmediate("/prefabs/explosion.json")!;
        const explosion = utils.instantiate(_explosion);
        this.visual.getWorldPosition(explosion.position).setY(1);
        explosion.scale.multiplyScalar(1.5);
        explosion.updateMatrixWorld();
        this.coords.sector.layers.fx.attach(explosion);
        engineState.setComponent(explosion, new AutoDestroy({ delay: 1.5 }));

        this.visual.removeFromParent();
        const fadeDuration = 1;
        engineState.setComponent(chunks, new Explode({ impulse: 5 }));
        engineState.setComponent(chunks, new Fadeout({
            duration: fadeDuration,
            keepShadows: true
        }));
        engineState.setComponent(chunks, new AutoDestroy({ delay: 1.5 }));

        if (!UnitUtils.isEnemy(this)) {
            utils.postpone(fadeDuration, () => {
                cmdFogRemoveCircle.post({ mapCoords: this.coords.mapCoords, radius: 10 });
            });
        }
    }
}


