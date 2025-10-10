import { Button } from "@blueprintjs/core";
import { Object3D } from "three";
import { NumberField } from "./NumberField";
import { useState } from "react";
import { undoRedo } from "../UndoRedo";
import { TArray } from "powerplay-lib";
import { PropertyRow } from "./PropertyRow";
import { Property } from "./Property";
import { Properties } from "./Properties";
import { Collapse } from "./Collapse";

interface IProps {
    target: object;
    owner: Object3D;
    property: string;
    onChanged: () => void;
}

export function ArrayProperty(props: IProps) {

    const { target, property } = props;
    const array = target[property as keyof typeof target] as TArray<unknown>;
    const [length, _setLength] = useState<number>(array.length);
    const [open, setOpen] = useState<boolean>(true);

    const setLength = (newSize: number) => {
        if (newSize < 0) {
            return;
        }
        undoRedo.recordState(props.owner);
        if (newSize > array.length) {
            for (let i = array.length; i < newSize; i++) {
                array.grow();
            }
        }
        array.length = newSize;
        props.onChanged();
        _setLength(newSize);
    }

    const makeCollapseElem = () => {
        return <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: ".2rem",
                cursor: "pointer"
            }}
            onClick={() => setOpen(!open)}
        >
            <span className={`bp5-icon-standard bp5-icon-${open ? "chevron-down" : "chevron-right"}`} />
            <span>{property}</span>
        </div>
    }

    return <>
        <PropertyRow name={length > 0 ? makeCollapseElem() : property}>
            <div style={{ display: "flex" }}>
                <NumberField
                    key={length}
                    initialValue={length}
                    onChanged={setLength}
                />
                <Button icon="plus" minimal onClick={() => setLength(length + 1)} />
                <Button icon="minus" minimal onClick={() => setLength(length - 1)} />
            </div>
        </PropertyRow>
        {
            length > 0
            &&
            <Collapse isOpen={open}>
                <Properties>
                    {array.map((_, index) => {
                        return <Property
                            key={index}
                            target={array.data}
                            owner={props.owner}
                            property={index}
                            onChanged={props.onChanged}
                        />
                    })}
                </Properties>
            </Collapse>
        }        
    </>
}

