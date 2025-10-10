import { Button, Checkbox, HTMLSelect, OptionProps } from "@blueprintjs/core";
import { useState } from "react";
import { Material, MathUtils, Object3D, Texture } from "three";
import { NumberField } from "./NumberField";
import { TextField } from "./TextField";
import { ColorPicker } from "./ColorPicker";
import { TexturePicker } from "./TexturePicker";
import { undoRedo } from "../UndoRedo";
import { Slider } from "./Slider";
import { PropertyRow } from "./PropertyRow";

export interface IOptions {
    range?: [number, number];
    step?: number;
    readonly?: boolean;
    label?: string;
    values?: (string | number | OptionProps)[];
}

interface IProps {
    target: object;
    owner: Object3D;
    property: string | number;
    options?: IOptions;
    onBeforeChange?: () => void;
    onChanged?: () => void;
}

function isTexture(target: object, property: string) {
    const value = target[property as keyof typeof target] as Texture;
    if (value?.isTexture) {
        return true;
    }
    const material = target as Material;
    if (material.isMaterial && property.toLowerCase().endsWith("map")) {
        return true;
    }
}

export function Property(props: IProps) {
    const { target, owner, property } = props;    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [value, setValue] = useState<any>(target[property as keyof typeof target]);

    const onBeforeChange = () => {
        undoRedo.recordState(owner);
        props.onBeforeChange?.();
    };

    const editor = (() => {
        if (typeof property === "string" && isTexture(target, property)) {
            return <TexturePicker
                target={target}
                property={property}
                onBeforeChange={onBeforeChange}
                onChanged={() => props.onChanged?.()}
            />
        } else if (typeof value === "boolean") {
            return <Checkbox
                style={{ marginBottom: 0 }}
                checked={value}
                onChange={e => {
                    onBeforeChange();
                    Object.assign(target, { [property]: e.currentTarget.checked });
                    setValue(e.currentTarget.checked);
                    props.onChanged?.();
                }}
            />

        } else if (typeof value === "string") {
            if (props.options?.values) {
                return <HTMLSelect
                    fill
                    minimal
                    value={value}
                    options={props.options.values}
                    onChange={e => {
                        onBeforeChange();
                        Object.assign(target, { [property]: e.currentTarget.value });
                        setValue(e.currentTarget.value);
                        props.onChanged?.();
                    }}
                />
            } else {
                return <TextField
                    initialValue={value}
                    readonly={props.options?.readonly}
                    onChanged={e => {
                        onBeforeChange();
                        Object.assign(target, { [property]: e });
                        props.onChanged?.();
                    }}
                />
            }
        } else if (typeof value === "number") {
            if (props.options?.values) {
                return <HTMLSelect
                    fill
                    minimal
                    value={value}
                    options={props.options.values}
                    onChange={e => {
                        onBeforeChange();
                        const newValue = parseInt(e.currentTarget.value);
                        Object.assign(target, { [property]: newValue });
                        setValue(newValue);
                        props.onChanged?.();
                    }}
                />
            } else {
                if (props.options?.range) {
                    return <Slider
                        initialValue={value}
                        range={props.options?.range}
                        step={props.options?.step ?? 0.1}
                        onChanging={(e, firstChange) => {
                            if (firstChange) {
                                onBeforeChange();
                            }
                            Object.assign(target, { [property]: e })
                        }}
                        onChanged={() => {
                            props.onChanged?.();
                        }}
                    />
                } else {
                    return <NumberField
                        initialValue={value}
                        onChanged={e => {
                            onBeforeChange();
                            Object.assign(target, { [property]: e })
                            props.onChanged?.();
                        }}
                    />
                }
            }
        } else if (value?.isVector3) {
            return <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: ".2rem"
            }}>
                <NumberField
                    initialValue={value.x}
                    onChanged={e => {
                        onBeforeChange();
                        value.x = e;
                        props.onChanged?.();
                    }}
                />
                <NumberField
                    initialValue={value.y}
                    onChanged={e => {
                        onBeforeChange();
                        value.y = e;
                        props.onChanged?.();
                    }}
                />
                <NumberField
                    initialValue={value.z}
                    onChanged={e => {
                        onBeforeChange();
                        value.z = e;
                        props.onChanged?.()
                    }}
                />
            </div>
        } else if (value?.isVector2) {
            return <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: ".2rem"
            }}>
                <NumberField
                    initialValue={value.x}
                    onChanged={e => {
                        onBeforeChange();
                        value.x = e;
                        props.onChanged?.();
                    }}
                />
                <NumberField
                    initialValue={value.y}
                    onChanged={e => {
                        onBeforeChange();
                        value.y = e;
                        props.onChanged?.();
                    }}
                />
            </div>
        } else if (value?.isEuler) {
            return <div style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: ".2rem"
            }}>
                <NumberField
                    initialValue={MathUtils.radToDeg(value.x)}
                    onChanged={e => {
                        onBeforeChange();
                        value.x = MathUtils.degToRad(e);
                        props.onChanged?.();
                    }}
                />
                <NumberField
                    initialValue={MathUtils.radToDeg(value.y)}
                    onChanged={e => {
                        onBeforeChange();
                        value.y = MathUtils.degToRad(e);
                        props.onChanged?.()
                    }}
                />
                <NumberField
                    initialValue={MathUtils.radToDeg(value.z)}
                    onChanged={e => {
                        onBeforeChange();
                        value.z = MathUtils.degToRad(e);
                        props.onChanged?.();
                    }}
                />
            </div>
        } else if (value?.isColor) {
            return <ColorPicker
                initialValue={value}
                onBeforeChange={onBeforeChange}
                onChange={() => props.onChanged?.()}
            />

        } else if (value?.command) {
            return <Button
                text={value.command}
                fill
                intent="primary"
                onClick={props.onChanged}
            />

        } else {
            return null;
        }
    })();

    if (!editor) {
        return null;
    }

    return <PropertyRow name={props.options?.label ?? property.toString()}>{editor}</PropertyRow>;
}

