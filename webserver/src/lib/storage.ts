import Log from "@dedis/cothority/log";

export abstract class UserEvmInfo {
    static storageKey: string;

    static deserialize(obj: any): UserEvmInfo {
        throw new Error("Needs to be overridden");
    }

    static load(storageKey: string = this.storageKey): UserEvmInfo {
        const jsonData = localStorage.getItem(storageKey);
        if (jsonData === null) {
            return null;
        }

        const obj = JSON.parse(jsonData);

        return this.deserialize(obj);
    }

    abstract serialize();

    save() {
        const obj = this.serialize();

        localStorage.setItem(this.getStorageKey(), JSON.stringify(obj));
    }

    protected abstract getStorageKey(): string;
}
