import { useEffect, useRef, useState } from "react";
import { NumberField } from "./NumberField";

interface IProps {
    initialValue: number;
    range: [number, number];
    step: number;
    onChanging: (newValue: number, firstChange: boolean) => void;
    onChanged: () => void;
}

export function Slider(props: IProps) {
    const [value, setValue] = useState(props.initialValue);
    const ref = useRef<HTMLInputElement>(null);
    const changeStarted = useRef(false);
    const [timestamp, setTimestamp] = useState(Date.now());

    const { onChanging, onChanged } = props;

    useEffect(() => {
        const onChangeCompleted = () => {
            changeStarted.current = false;
            onChanged();
        };
        const _ref = ref.current!;
        console.assert(_ref);
        _ref.addEventListener("change", onChangeCompleted);
        return () => {
            _ref.removeEventListener("change", onChangeCompleted);
        }
    }, [onChanged]);

    const factor = (value - props.range[0]) / (props.range[1] - props.range[0]) * 100;
    return <div style={{
        display: "grid",
        gridTemplateColumns: "calc(100% - 40px) 40px",
        alignItems: "center",
    }}>
        <input
            ref={ref}
            type="range"
            style={{
                backgroundSize: `${factor}% 100%`,
                width: "calc(100% - 2px)",
                zIndex: 1
            }}
            min={props.range[0]}
            max={props.range[1]}
            step={props.step}
            value={value}
            onInput={e => {
                const newValue = parseFloat(e.currentTarget.value);
                setValue(newValue);
                const firstChange = !changeStarted.current;
                changeStarted.current = true;
                onChanging(newValue, firstChange);
                setTimestamp(Date.now());
            }}
        />
        <NumberField
            key={timestamp}
            initialValue={value}
            onChanged={newValue => {
                setValue(newValue);
                onChanging(newValue, true);
                onChanged();
            }}
        />
    </div>
}

