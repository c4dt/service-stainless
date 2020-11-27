import Log from "@dedis/cothority/log";

// import { UIEvmAccount, UIEvmContract } from "src/lib/bevm";
import { EvmAccount, EvmContract } from "@dedis/cothority/bevm";
import { SelectableColl, UserEvmInfo } from "src/lib/storage";

export class SourceFile extends UserEvmInfo {
    static deserialize(obj: any): SourceFile {
        const sourceFile = new SourceFile(obj.name, obj.contents);

        return sourceFile;
    }

    constructor(readonly name: string, readonly contents: string) { super(); }

    serialize(): object {
        return {
            contents: this.contents,
            name: this.name,
        };
    }
}

export class UIEvmAccount extends UserEvmInfo {
    static deserialize(obj: any): UIEvmAccount {
        const account = EvmAccount.deserialize(obj);

        return new UIEvmAccount(account);
    }

    constructor(readonly wrapped: EvmAccount) { super(); }

    get name(): string {
        return this.wrapped.name;
    }

    serialize(): object {
        return this.wrapped.serialize();
    }
}

export class UIEvmContract extends UserEvmInfo {
    static deserialize(obj: any): UIEvmContract {
        const contract = EvmContract.deserialize(obj);

        return new UIEvmContract(contract);
    }

    readonly transactions: SelectableColl<string>;
    readonly viewMethods: SelectableColl<string>;
    private _addresses: SelectableColl<Buffer> = new SelectableColl<Buffer>([]);

    constructor(readonly wrapped: EvmContract) {
        super();

        this.transactions = new SelectableColl<string>(wrapped.transactions);
        this.viewMethods = new SelectableColl<string>(wrapped.viewMethods);
        this._addresses = new SelectableColl<Buffer>(wrapped.addresses);
    }

    get addresses(): SelectableColl<Buffer> {
        return this._addresses;
    }

    get name(): string {
        return this.wrapped.name;
    }

    getMethodAbi(method: string): any {
        return this.wrapped.getMethodAbi(method);
    }

    parseUserArgs(args: string[], abi: any): any[] {
        if (args === undefined) {
            return null;
        }

        if (args.filter((v: string) => v === undefined).length > 0) {
            return null;
        }

        const argsParsed: Array<number | string> = [];

        for (let i = 0; i < args.length; i++) {
            const value = args[i];
            const type = abi.inputs[i].type;

            switch (type) {
                case "uint256": {
                    const n = Number(value);
                    if (value === "" || !Number.isSafeInteger(n) || n < 0) {
                        throw new Error(`Invalid number value: ${value}`);
                    }

                    argsParsed.push(n);
                    break;
                }

                case "address": {
                    const rx = new RegExp("^0x[0-9a-fA-F]+$");
                    if (!rx.test(value)) {
                        throw new Error(`Invalid address value: ${value}`);
                    }

                    argsParsed.push(value);
                    break;
                }

                default: throw new Error(`Type not supported: ${type}`);
            }
        }

        return argsParsed;
    }

    makeUserResult(result: any[], abi: any): string {
        const values: string[] = result.map((val, index) => {
            const type = abi.outputs[index].type;

            switch (type) {
                case "uint256": {
                    // The value is a BigInteger
                    return val.toString();
                }

                default: throw new Error(`Type not supported: ${type}`);
            }
        });

        return values.join(", ");
    }

    serialize(): object {
        return this.wrapped.serialize();
    }
}

export class Project extends UserEvmInfo {
    static deserialize(obj: any): Project {
        const sourceFiles = SelectableColl.deserializeColl<SourceFile>(obj.sourceFiles, SourceFile);
        const contracts = SelectableColl.deserializeColl<UIEvmContract>(obj.contracts, UIEvmContract);

        const project = new Project(obj.name, sourceFiles, obj.version);
        project.contracts = contracts;
        project.verificationResults = obj.verificationResults;

        return project;
    }

    readonly sourceFiles: SelectableColl<SourceFile>;
    contracts: SelectableColl<UIEvmContract>;
    verificationResults: any = undefined;

    constructor(readonly name: string, sourceFiles: SelectableColl<SourceFile>, readonly version: number = 0) {
        super();

        this.contracts = new SelectableColl<UIEvmContract>();
        this.sourceFiles = sourceFiles;
    }

    get verified(): boolean {
        return this.verificationResults !== undefined;
    }

    verificationSuccessful(): boolean {
        if (this.verificationResults === undefined) {
            return undefined;
        }

        const invalidResults = this.verificationResults.filter(
            (elem: any) => elem.status !== "valid");

        return invalidResults.length === 0;
    }

    get compiled(): boolean {
        return this.contracts.length !== 0;
    }

    serialize(): object {
        return {
            contracts: this.contracts.serialize(),
            name: this.name,
            sourceFiles: this.sourceFiles.serialize(),
            verificationResults: this.verificationResults,
            version: this.version,
        };
    }
}

export class UserState extends UserEvmInfo {
    static currentVersion = 2;

    static storageKey = "bevm_info";

    static deserialize(obj: any): UserState {
        // Check version
        const version: number = obj.version || 0;
        if (version < this.currentVersion) {
            Log.lvl2(`UserState version not up to date: ${version} vs ${this.currentVersion}`);

            switch (version) {
                // No migration path for now
                default: {
                    throw new Error("incompatible version");
                }
            }
        }

        const accounts = SelectableColl.deserializeColl<UIEvmAccount>(obj.accounts, UIEvmAccount);
        const projects = SelectableColl.deserializeColl<Project>(obj.projects, Project);

        const userState = new UserState();
        userState._accounts = accounts;
        userState._projects = projects;
        userState._tutorialIsCompleted = obj.tutorialIsCompleted || false;

        return userState;
    }

    private _accounts: SelectableColl<UIEvmAccount>;
    private _projects: SelectableColl<Project>;
    private _tutorialIsCompleted: boolean;

    constructor() {
        super();

        this._tutorialIsCompleted = false;
        this._accounts = new SelectableColl<UIEvmAccount>();
        this._projects = new SelectableColl<Project>();
    }

    get accounts(): UIEvmAccount[] {
        return this._accounts.elements;
    }

    get accountSelected(): UIEvmAccount {
        return this._accounts.selected;
    }

    get accountSelectedIndex(): number {
        return this._accounts.selectedIndex;
    }

    selectAccount(index: number) {
        this._accounts.select(index);
    }

    createAccount(name: string): UIEvmAccount {
        const account = new EvmAccount(name);
        const uiAccount = new UIEvmAccount(account);

        this._accounts.add(uiAccount);
        this.save();

        return uiAccount;
    }

    get projects(): Project[] {
        return this._projects.elements;
    }

    updateProjects(projectData: any[]) {
        for (const pData of projectData) {
            let found = false;

            const sourceFiles = pData.files.map((file: any) => new SourceFile(file.name, file.contents));
            const newP = new Project(pData.name,
                                     new SelectableColl<SourceFile>(sourceFiles),
                                     pData.version ? pData.version : 0);

            this._projects.elements.forEach((p, i) => {
                if (!found && (p.name === newP.name)) {
                    found = true;

                    if (p.version < newP.version) {
                        this._projects.update(i, newP);
                        Log.lvl2(`Updated project: ${newP.name}`);
                    }
                }
            });

            if (!found) {
                this._projects.add(newP);
                Log.lvl2(`Added new project: ${newP.name}`);
            }
        }

        // Select the first available project
        if (this._projects.length > 0) {
            this._projects.select(0);
        }

        this.save();
    }

    get projectSelected(): Project {
        return this._projects.selected;
    }

    get projectSelectedIndex(): number {
        return this._projects.selectedIndex;
    }

    get projectVerified(): boolean {
        if (this._projects.selected === undefined) {
            return false;
        }

        return this._projects.selected.verified;
    }

    get projectCompiled(): boolean {
        if (this._projects.selected === undefined) {
            return false;
        }

        return this._projects.selected.compiled;
    }

    get verificationResults(): any {
        if (this._projects.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.verificationResults;
    }

    set verificationResults(verif: any) {
        this._projects.selected.verificationResults = verif;
        this.save();
    }

    get verificationSuccessful(): boolean {
        if (this._projects.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.verificationSuccessful();
    }

    get projectSourceFiles(): SourceFile[] {
        if (this._projects.selected === undefined) {
            return [];
        }

        return this._projects.selected.sourceFiles.elements;
    }

    selectProject(index: number) {
        this._projects.select(index);
    }

    get contracts(): UIEvmContract[] {
        if (this._projects.selected === undefined) {
            return [];
        }

        return this._projects.selected.contracts.elements;
    }

    set contracts(contracts: UIEvmContract[]) {
        this._projects.selected.contracts = new SelectableColl<UIEvmContract>(contracts);
        this.save();
    }

    get contractSelected(): UIEvmContract {
        if (this._projects.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.contracts.selected;
    }

    get contractSelectedIndex(): number {
        if (this._projects.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.contracts.selectedIndex;
    }

    selectContract(index: number) {
        this._projects.selected.contracts.select(index);
    }

    get instances(): Buffer[] {
        if (this.contractSelected === undefined) {
            return [];
        }

        return this.contractSelected.addresses.elements;
    }

    get instanceSelected(): Buffer {
        if (this.contractSelected === undefined) {
            return undefined;
        }

        return this.contractSelected.addresses.selected;
    }

    get instanceSelectedIndex(): number {
        if (this._projects.selected === undefined || this._projects.selected.contracts.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.contracts.selected.addresses.selectedIndex;
    }

    selectInstance(index: number) {
        this._projects.selected.contracts.selected.addresses.select(index);
    }

    get transactions(): string[] {
        if (this._projects.selected === undefined || this._projects.selected.contracts.selected === undefined) {
            return [];
        }

        return this._projects.selected.contracts.selected.transactions.elements;
    }

    get transactionSelected(): string {
        if (this._projects.selected === undefined || this._projects.selected.contracts.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.contracts.selected.transactions.selected;
    }

    get transactionSelectedIndex(): number {
        if (this._projects.selected === undefined || this._projects.selected.contracts.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.contracts.selected.transactions.selectedIndex;
    }

    selectTransaction(index: number) {
        this._projects.selected.contracts.selected.transactions.select(index);
    }

    get viewMethods(): string[] {
        if (this._projects.selected === undefined || this._projects.selected.contracts.selected === undefined) {
            return [];
        }

        return this._projects.selected.contracts.selected.viewMethods.elements;
    }

    get viewMethodSelected(): string {
        if (this._projects.selected === undefined || this._projects.selected.contracts.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.contracts.selected.viewMethods.selected;
    }

    get viewMethodSelectedIndex(): number {
        if (this._projects.selected === undefined || this._projects.selected.contracts.selected === undefined) {
            return undefined;
        }

        return this._projects.selected.contracts.selected.viewMethods.selectedIndex;
    }

    selectViewMethod(index: number) {
        this._projects.selected.contracts.selected.viewMethods.select(index);
    }

    get tutorialIsCompleted(): boolean {
        return this._tutorialIsCompleted;
    }

    completeTutorial() {
        this._tutorialIsCompleted = true;
        this.save();
    }

    serialize(): object {
        return {
            accounts: this._accounts.serialize(),
            projects: this._projects.serialize(),
            tutorialIsCompleted: this._tutorialIsCompleted,
            version: UserState.currentVersion,
        };
    }

    protected getStorageKey(): string {
        return UserState.storageKey;
    }
}
