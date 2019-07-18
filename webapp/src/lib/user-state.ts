import Log from "@dedis/cothority/log";

import { EvmAccount, EvmContract } from "src/lib/bevm";
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

export class Project extends UserEvmInfo {
    static deserialize(obj: any): Project {
        const sourceFiles = obj.sourceFiles.map( (elem) => {
            return SourceFile.deserialize(elem);
        });
        const contracts = obj.contracts.map( (elem) => {
            return EvmContract.deserialize(elem);
        });

        const project = new Project(obj.name, sourceFiles, obj.version);
        project.contracts = new SelectableColl<EvmContract>(contracts);
        project.verificationResults = obj.verificationResults;

        return project;
    }

    readonly sourceFiles: SelectableColl<SourceFile>;
    contracts: SelectableColl<EvmContract>;
    verificationResults: any = undefined;

    constructor(readonly name: string, sourceFiles: SourceFile[], readonly version: number = 0) {
        super();

        this.contracts = new SelectableColl<EvmContract>();
        this.sourceFiles = new SelectableColl<SourceFile>(sourceFiles);
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
    static storageKey = "bevm_info";

    static deserialize(obj: any): UserState {
        const accounts = obj.accounts.map( (elem) => {
            return EvmAccount.deserialize(elem);
        });
        const projects = obj.projects.map( (elem) => {
            return Project.deserialize(elem);
        });

        const userState = new UserState();
        userState._accounts = new SelectableColl<EvmAccount>(accounts);
        userState._projects = new SelectableColl<Project>(projects);

        return userState;
    }

    private _accounts: SelectableColl<EvmAccount>;
    private _projects: SelectableColl<Project>;

    constructor() {
        super();

        this._accounts = new SelectableColl<EvmAccount>();
        this._projects = new SelectableColl<Project>();
    }

    get accounts(): EvmAccount[] {
        return this._accounts.elements;
    }

    get accountSelected(): EvmAccount {
        return this._accounts.selected;
    }

    get accountSelectedIndex(): number {
        return this._accounts.selectedIndex;
    }

    selectAccount(index: number) {
        this._accounts.select(index);
    }

    createAccount(name: string): EvmAccount {
        const account = new EvmAccount(name);
        this._accounts.add(account);
        this.save();

        return account;
    }

    get projects(): Project[] {
        return this._projects.elements;
    }

    updateProjects(projects: Project[]) {
        for (const newP of projects) {
            let found = false;

            for (const [i, p] of this._projects.elements.entries()) {
                if (p.name === newP.name) {
                    found = true;

                    if (p.version < newP.version) {
                        this._projects.update(i, newP);
                        Log.lvl2(`Updated project: ${newP.name}`);
                    }

                    break;
                }
            }

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

    get contracts(): EvmContract[] {
        if (this._projects.selected === undefined) {
            return [];
        }

        return this._projects.selected.contracts.elements;
    }

    set contracts(contracts: EvmContract[]) {
        this._projects.selected.contracts = new SelectableColl<EvmContract>(contracts);
        this.save();
    }

    get contractSelected(): EvmContract {
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

    get instances(): Buffer[] {
        if (this.contractSelected === undefined) {
            return [];
        }

        return this.contractSelected.addresses.elements;
    }

    selectContract(index: number) {
        this._projects.selected.contracts.select(index);
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

    serialize(): object {
        return {
            accounts: this._accounts.serialize(),
            projects: this._projects.serialize(),
        };
    }

    protected getStorageKey(): string {
        return UserState.storageKey;
    }
}
