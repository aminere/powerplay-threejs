import { Icon } from "./Icon";

export function InlineIcon({ name }: { name: string }) {
    return <div
        className="icon"
        style={{
            height: "3rem",
            display: "flex",
            alignItems: "flex-end"
        }}>
        <Icon name={name} />
    </div>
}

