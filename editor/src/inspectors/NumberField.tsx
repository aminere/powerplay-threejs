import { Classes } from "@blueprintjs/core";
import { useCallback, useState } from "react";

interface IProps {
    initialValue: number;
    onChanged: (newValue: number) => void;
}

function formatNumber(n: number) {
    return parseFloat(n.toFixed(2)).toString();
}

export function NumberField(props: IProps) {
    const [lastValidValue, setLastValidValue] = useState(props.initialValue);
    const [valueStr, setValueStr] = useState(formatNumber(props.initialValue));

    const { onChanged } = props;
    const onChangeCompleted = useCallback(() => {
        const n = parseFloat(valueStr);
        if (!isNaN(n)) {
            onChanged(n);
            setLastValidValue(n);
            setValueStr(n.toString());
        } else {
            setValueStr(lastValidValue.toString());
        }
    }, [lastValidValue, valueStr, onChanged]);

    return <input
        className={`${Classes.INPUT} ${Classes.FILL}`}
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

