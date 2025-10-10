import { Classes } from "@blueprintjs/core";
import { useCallback, useState } from "react";

interface IProps {
    initialValue: string;
    readonly?: boolean;
    border?: boolean;
    onChanged?: (newValue: string) => void;
    onChanging?: (newValue: string) => void;
}

export function TextField(props: IProps) {
    const [value, setValue] = useState(props.initialValue);

    const { onChanged } = props;
    const onChangeCompleted = useCallback(() => {
        onChanged?.(value);
    }, [value, onChanged]);

    return <input
        className={`${Classes.INPUT} ${Classes.FILL}`}
        style={{
            border: props.border === true ? "1px solid #8080808f" : "none",
        }}
        value={value}
        readOnly={props.readonly}
        disabled={props.readonly}
        onChange={e => {
            setValue(e.currentTarget.value);
            props.onChanging?.(e.currentTarget.value);
        }}
        onClick={e => e.stopPropagation()}
        onBlur={() => onChangeCompleted()}
        onKeyDown={e => {
            e.stopPropagation();
            if (e.key === "Enter") {
                e.currentTarget.blur();
            }
        }}
    />
}

