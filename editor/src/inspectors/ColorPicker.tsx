import { Color } from "three";
import { useEffect, useRef, useState } from "react";
import { HexField } from "./HexField";

interface IProps {
    initialValue: Color;
    onBeforeChange: () => void;
    onChange: () => void;
}

export function ColorPicker(props: IProps) {
    const [color, setColor] = useState(`#${props.initialValue.getHexString()}`);
    const changeStarted = useRef(false);
    const ref = useRef<HTMLInputElement>(null);
    const { onChange } = props;
    const [timestamp, setTimestamp] = useState(Date.now());

    useEffect(() => {
        const onChangeFinished = () => {
            changeStarted.current = false;
            onChange();
        }
        const _ref = ref.current!;
        _ref.addEventListener("change", onChangeFinished);
        return () => {
            _ref.removeEventListener("change", onChangeFinished);
        }
    }, [onChange]);

    return <div style={{
        display: "grid",
        gridTemplateColumns: "50px calc(100% - 50px)",
        alignItems: "center",
    }}>
        <input
            ref={ref}
            type="color"
            value={color}
            style={{
                border: "none",
                width: "50px",
                height: "30px"
            }}
            onInput={e => {
                const hexStr = e.currentTarget.value;
                setColor(e.currentTarget.value);
                const hex = parseInt(hexStr.replace("#", ""), 16);
                if (!changeStarted.current) {
                    props.onBeforeChange();
                    changeStarted.current = true;
                }
                props.initialValue.setHex(hex);
                setTimestamp(Date.now());
            }}
        />
        <HexField
            key={timestamp}
            initialValue={props.initialValue.getHexString()}
            onChanged={newValue => {
                setColor(`#${newValue}`);
                const hex = parseInt(newValue, 16);
                console.assert(!isNaN(hex));
                props.onBeforeChange();
                props.initialValue.setHex(hex);                
                onChange();
            }}
        />
    </div>
}

