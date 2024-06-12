import { utils } from "../../engine/Utils";
import { IUnit } from "./IUnit";
import { IUnitProps, Unit } from "./Unit";
import { IUnitAddr, computeUnitAddr2x2, makeUnitAddr } from "./UnitAddr";

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
}


