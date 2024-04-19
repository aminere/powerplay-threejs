import { FlockProps } from "../components/Flock";
import { unitMotion } from "./UnitMotion";
import { time } from "../../engine/core/Time";
import { workerUpdate } from "./WorkerUpdate";
import { truckUpdate } from "./TruckUpdate";
import { IUnit } from "./Unit";
import { ICharacterUnit } from "./CharacterUnit";
import { ITruckUnit } from "./TruckUnit";

export function updateUnits(units: IUnit[]) {
    const props = FlockProps.instance;    
    const steerAmount = props.speed * time.deltaTime;
    const avoidanceSteerAmount = props.avoidanceSpeed * time.deltaTime;

    for (let i = 0; i < units.length; ++i) {
        const unit = units[i];
        if (!unit.isAlive) {
            continue;
        }

        unit.fsm.update();
        unitMotion.update(unit, steerAmount, avoidanceSteerAmount);

        switch (unit.type) {
            case "truck": truckUpdate(unit as ITruckUnit); break;
            case "worker": workerUpdate(unit as ICharacterUnit); break;
        }
    }
}

