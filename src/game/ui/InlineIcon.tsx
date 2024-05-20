import { Icon } from "./Icon";

export function InlineIcon({ name }: { name: string }) {
    return <div
        className="icon"
        style={{
            height: "3rem",
            maxWidth: "3.5rem",
            display: "flex",
            alignItems: "flex-end"
        }}>
        <Icon name={name} />
    </div>
}

