import { Icon } from "./Icon";

export function InlineIcon({ name }: { name: string }) {
    return <div style={{
        height: "3rem",
        display: "flex",
        alignItems: "flex-end"
    }}>
        <Icon name={name} />
    </div>
}

