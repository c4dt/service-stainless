import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material";
import { Log } from "@c4dt/cothority/log";

import { Defaults } from "../../lib/Defaults";
import StainlessRPC from "../../lib/stainless/stainless-rpc";

import Long from "long";
import { BevmInstance, EvmAccount, EvmContract } from "src/lib/bevm";
import { Config } from "src/lib/Data";

import { stainless as proto } from "src/lib/proto";

@Component({
  selector: "app-stainless",
  styleUrls: ["./stainless.component.css"],
  templateUrl: "./stainless.component.html",
})
export class StainlessComponent implements OnInit {

    transactions: string[] = [];
    transactionsCandy = [
        "eatCandy",
    ];

    viewMethods: string[] = [];
    viewMethodsCandy = [
        "getRemainingCandies",
    ];

    contracts: any = [];
    verifResult: any = undefined;
    deployable: boolean = false;
    executable: boolean = false;
    contractSelected: any = undefined;
    transactionSelected: number = undefined;
    viewMethodSelected: number = undefined;
    viewMethodResult: string = "";

    private stainlessRPC: StainlessRPC;
    private bevmRPC: BevmInstance;
    private config: Config;
    private account: EvmAccount; // FIXME: Handle account selection
    private contract: EvmContract; // FIXME: Handle contract history

    constructor(public dialog: MatDialog) { }

    async ngOnInit() {
        await this.performLongAction(
        () => this.initialize(),
            "Initializing");
    }

    async initialize() {
        const resp = await fetch(window.location.origin + "/assets/contracts.json");
        if (!resp.ok) {
            return Promise.reject(new Error(`Load contracts: ${resp.status}`));
        }
        this.contracts = JSON.parse(await resp.text());

        this.contractSelected = this.contracts[0];

        this.config = await Config.init();
        this.stainlessRPC = new StainlessRPC(Defaults.Roster.list[0]);
        this.bevmRPC = await BevmInstance.spawn(this.config.bc,
                                                this.config.darc.getBaseID(),
                                                [this.config.admin]);
        this.bevmRPC.setStainlessRPC(this.stainlessRPC);

        const privKey = Buffer.from("c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3", "hex");

        this.account = new EvmAccount(privKey);

        const WEI_PER_ETHER = Long.fromString("1000000000000000000");
        const amount = Buffer.from(WEI_PER_ETHER.mul(5).toBytesBE());

        Log.lvl2("Credit an account with:", amount);
        await this.bevmRPC.creditAccount([this.config.admin], this.account.address, amount);
    }

    selectContract(index: number) {
        Log.lvl2(`User selected contract '${index}'`);
        this.contractSelected = this.contracts[index];
        this.deployable = false;
        this.executable = false;
        this.transactions = [];
        this.transactionSelected = undefined;
        this.viewMethods = [];
        this.viewMethodSelected = undefined;
        this.viewMethodResult = "";
        this.verifResult = undefined;
    }

    selectTransaction(index: number) {
        Log.lvl2(`User selected transaction '${index}'`);
        this.transactionSelected = index;
    }

    selectViewMethod(index: number) {
        Log.lvl2(`User selected view method '${index}'`);
        this.viewMethodSelected = index;
    }

    convertReport(report: any) {
        const items = report.stainless[0][1][0];

        const res = items.map((item) => {
            const method = item.id.name;
            const type = item.kind;

            let status = "invalid";
            switch (Object.keys(item.status)[0]) {
                case "Valid":
                case "ValidFromCache": {
                    status = "valid";
                    break;
                }
            }

            let position = {
                end: ["?", "?"],
                file: "?",
                start: ["?", "?"],
            };
            switch (Object.keys(item.pos.kind)[0]) {
                case "Offset": {
                    const filePath = item.pos.file.split("/");
                    position = {
                        end: [item.pos.line, item.pos.col],
                        file: filePath[filePath.length - 1],
                        start: [item.pos.line, item.pos.col],
                    };
                    break;
                }
                case "Range": {
                    const filePath = item.pos.begin.file.split("/");
                    position = {
                        end: [item.pos.end.line, item.pos.end.col],
                        file: filePath[filePath.length - 1],
                        start: [item.pos.begin.line, item.pos.begin.col],
                    };
                    break;
                }
            }

            return {
                method,
                position,
                status,
                type,
            };
        });

        return res;
    }

    async performLongAction<T>(f: () => Promise<T>, message: string): Promise<T> {
        const dialogRef = this.dialog.open(InfoDialog, {
            data: { message },
            disableClose: true,
            width: "20em",
        });

        let result: T;
        try {
            result = await f();
        } finally {
            dialogRef.close();
        }

        return result;
    }

    async verify() {
        const sourceFiles = {};
        this.contractSelected.files.forEach((f) => {
            sourceFiles[f.name] = f.contents;
        });

        // Call Stainless service to perform verification
        const response = await this.performLongAction<proto.VerificationResponse>(
            () => this.stainlessRPC.verify(sourceFiles),
            "Performing verification");
        // FIXME: Handle exceptions
        Log.print("Received verification results");

        const verif = this.convertReport(JSON.parse(response.Report));

        this.verifResult = verif.sort((e1, e2) => {
            if (e1.method > e2.method) {
                return 1;
            }
            if (e1.method < e2.method) {
                return -1;
            }
            return e1.position.start[0] - e2.position.start[0];
        });

        const success = this.verifResult.filter((elem: any) => elem.status !== "valid").length === 0;

        if (success) {
            this.deployable = true;
            this.executable = false;
            this.transactions = [];
            this.transactionSelected = undefined;
            this.viewMethods = [];
            this.viewMethodSelected = undefined;
            this.viewMethodResult = "";
        }
    }

    async deploy() {
        const sourceFiles = {};
        this.contractSelected.files.forEach((f) => {
            sourceFiles[f.name] = f.contents;
        });

        // Call Stainless service to generate bytecode and ABI
        const response = await this.performLongAction<proto.BytecodeGenResponse>(
            () => this.stainlessRPC.genBytecode(sourceFiles),
            "Generating bytecode");
        // FIXME: Handle exceptions
        Log.print("Received bytecode generation results");

        // FIXME: Handle multiple ABI/bytecodes
        const firstKey = Object.keys(response.BytecodeObjs)[0];
        this.contractSelected.abi = JSON.parse(response.BytecodeObjs[firstKey].Abi);
        this.contractSelected.bin = Buffer.from(response.BytecodeObjs[firstKey].Bin, "hex");

        const dialogRef = this.dialog.open(ArgDialog, {
            data: {
                abi: this.contractSelected.abi,
                methodName: undefined,
                title: `Deploying contract '${this.contractSelected.name}'`,
            },
            width: "30em",
        });

        dialogRef.afterClosed().subscribe(async (result) => {
            if ((result !== undefined) && (result.filter((v: string) => v === undefined).length === 0)) {
                let args = result.map(parseInt); // FIXME: handle non-numeric arguments
                args = args.map(JSON.stringify);

                Log.lvl2(`Deploying contract with constructor args ${args}`);
                this.deployable = false;
                this.executable = true;

                const abi = this.contractSelected.abi;
                const bin = this.contractSelected.bin;

                this.contract = new EvmContract(bin, JSON.stringify(abi));

                await this.performLongAction(
                    () => this.bevmRPC.deploy(
                        [this.config.admin],
                        1e7,
                        1,
                        0,
                        this.account,
                        this.contract,
                        args,
                    ),
                    "Deploying contract");

                this.transactions = abi.filter((elem: any) => {
                    return elem.type === "function" &&  elem.stateMutability !== "view";
                }).map((elem: any) => elem.name);

                this.viewMethods = abi.filter((elem: any) => {
                    return elem.type === "function" &&  elem.stateMutability === "view";
                }).map((elem: any) => elem.name);
            }
        });
    }

    executeTransaction() {
        const methodName = this.transactions[this.transactionSelected];

        const dialogRef = this.dialog.open(ArgDialog, {
            data: {
                abi: this.contractSelected.abi,
                methodName,
                title: `Executing transaction '${methodName}'`,
            },
            width: "30em",
        });

        dialogRef.afterClosed().subscribe(async (result) => {
            if ((result !== undefined) && (result.filter((v: string) => v === undefined).length === 0)) {
                let args = result.map(parseInt); // FIXME: handle non-numeric arguments
                args = args.map(JSON.stringify);

                Log.lvl2(`Executing transaction with args ${args}`);

                await this.performLongAction(
                    () => this.bevmRPC.transaction(
                        [this.config.admin],
                        1e7,
                        1,
                        0,
                        this.account,
                        this.contract,
                        methodName,
                        args,
                    ),
                    "Executing transaction");
            }
        });
    }

    executeViewMethod() {
        const methodName = this.viewMethods[this.viewMethodSelected];

        const dialogRef = this.dialog.open(ArgDialog, {
            data: {
                abi: this.contractSelected.abi,
                methodName,
                title: `Executing view method '${methodName}'`,
            },
            width: "30em",
        });

        dialogRef.afterClosed().subscribe(async (result) => {
            if ((result !== undefined) && (result.filter((v: string) => v === undefined).length === 0)) {
                let args = result.map(parseInt); // FIXME: handle non-numeric arguments
                args = args.map(JSON.stringify);

                Log.lvl2(`Executing view method with args ${args}`);

                const response = await this.performLongAction(
                    () => this.bevmRPC.call(
                        Defaults.ByzCoinID,
                        Defaults.RosterTOMLLOCAL,
                        this.bevmRPC.id,
                        this.account,
                        this.contract,
                        methodName,
                        args,
                    ),
                    "Executing view method");

                Log.lvl2(`Response = ${response}`);

                this.viewMethodResult = response;
            }
        });
    }
}

export interface IArgDialogData {
    title: string;
    abi: any;
    methodName: string;
}

@Component({
    selector: "arg-dialog",
    templateUrl: "arg-dialog.html",
})
export class ArgDialog {
    values: string[];
    method: any;

    constructor(
        public dialogRef: MatDialogRef<ArgDialog>,
        @Inject(MAT_DIALOG_DATA) public data: IArgDialogData) {
        this.method = this.data.abi.filter( (elem: any, _index: number, _array: any) => {
            return elem.name === this.data.methodName;
        })[0];

        this.values = this.method.inputs.map((_: any) => undefined);
        if (this.values.length === 0) {
            this.onEnter();
        }
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

    onEnter(): void {
        this.dialogRef.close(this.values);
    }
}

export interface IInfoDialogData {
    message: string;
}

@Component({
    selector: "info-dialog",
    templateUrl: "info-dialog.html",
})
export class InfoDialog {
    constructor(
        public dialogRef: MatDialogRef<InfoDialog>,
        @Inject(MAT_DIALOG_DATA) public data: IInfoDialogData) {
    }
}
