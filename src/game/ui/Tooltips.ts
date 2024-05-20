
class Tooltips {
    public getContent(actionId: string) {        
        switch (actionId) {            
            default: return actionId;
        }
    }
}

export const tooltips = new Tooltips();

