import { Classes } from "@blueprintjs/core";
import { useCallback, useState } from "react";

interface IProps {
    initialValue: string;
    onChanged: (newValue: string) => void;
}

export function HexField(props: IProps) {
    const [lastValidValue, setLastValidValue] = useState(props.initialValue);
    const [valueStr, setValueStr] = useState(props.initialValue);

    const { onChanged } = props;
    const onChangeCompleted = useCallback(() => {
        const n = parseInt(valueStr, 16);
        if (!isNaN(n)) {
            onChanged(valueStr);
            setLastValidValue(valueStr);
        } else {
            setValueStr(lastValidValue);
        }
    }, [lastValidValue, valueStr, onChanged]);

    return <input
        className={`${Classes.INPUT} ${Classes.FILL}`}
        style={{ textTransform: "uppercase" }}
        value={valueStr}
        onInput={e => setValueStr(e.currentTarget.value)}
        onBlur={() => onChangeCompleted()}
        onKeyDown={e => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.currentTarget.blur();
            }
        }}
    />
}

