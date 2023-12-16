import { useEffect,  useState } from "react"
import { ISelectedUnit, cmdSetSeletedUnits } from "../../Events";
import { HealthBar } from "./HealthBar";

export function HealthBars() {

    const [selectedUnits, setSelectedUnits] = useState<ISelectedUnit[]>([]);
    useEffect(() => {
        const onSelectedUnits = (units: ISelectedUnit[]) => {
            setSelectedUnits(units);
        };
        cmdSetSeletedUnits.attach(onSelectedUnits);
        return () => {
            cmdSetSeletedUnits.detach(onSelectedUnits);
        }
    }, []);

    return <>
        {selectedUnits.map(selected => {
            return <HealthBar
                key={selected.obj.uuid}
                obj={selected.obj}
                progress={selected.health}
            />
        })}
    </>
}

