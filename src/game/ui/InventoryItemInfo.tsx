
export function InventoryItemInfo({ children }: { children: React.ReactNode }) {
    return <div
        dir="ltr"
        style={{
            position: "absolute",
            right: "0",
            bottom: "0",
            backgroundColor: "black",
            fontSize: ".9rem"
        }}
    >
        {children}
    </div>
}

