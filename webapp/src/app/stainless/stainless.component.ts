import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material";
import { ClipboardService } from "ngx-clipboard";

import Log from "@dedis/cothority/log";

import { EvmContract, WEI_PER_ETHER } from "@dedis/cothority/bevm";
import { Config } from "src/lib/config";
import { stainless as proto } from "src/lib/proto";
import {
  Project,
  SourceFile,
  UIEvmAccount,
  UIEvmContract,
  UserState,
} from "src/lib/user-state";

@Component({
  selector: "app-stainless",
  styleUrls: ["./stainless.component.css"],
  templateUrl: "./stainless.component.html",
})
export class StainlessComponent implements OnInit {
  viewMethodResult: string = "";
  tutorialOpen: boolean = false;
  private userState: UserState;
  private config: Config;

  constructor(public dialog: MatDialog, private cbService: ClipboardService) {}

  async ngOnInit() {
    this.userState = new UserState();

    await this.performLongAction(() => this.initialize(), "Initializing");
  }

  async initialize() {
    // Initialize BEvm cothority
    this.config = await Config.init();

    // Load user state from local data
    this.userState = await this.loadUserState();

    // Initialize projects
    await this.initProjects();

    Log.lvl2("Initialization complete");
  }

  loadUserState(): Promise<UserState> {
    return new Promise<UserState>((resolve) => {
      try {
        const userState = UserState.load() as UserState;

        if (userState === null) {
          const ref = this.dialog.open(InfoDialog, {
            data: {
              message: "Welcome to the Stainless demonstrator!",
              requireAck: true,
              title: "Welcome",
            },
            width: "30em",
          });

          ref.afterClosed().subscribe((_) => {
            this.tutorialOpen = true;
            resolve(new UserState());
          });
        } else {
          this.tutorialOpen = !userState.tutorialIsCompleted;
          resolve(userState);
        }
      } catch (e) {
        const ref = this.dialog.open(InfoDialog, {
          data: {
            message: `The user data is invalid and must be reinitialized (reason: ${e.message})`,
            requireAck: true,
            title: "User data cleared",
          },
          width: "30em",
        });

        ref.afterClosed().subscribe((_) => {
          localStorage.clear();
          window.location.reload();
        });
      }
    });
  }

  async initProjects() {
    const resp = await fetch("assets/projects.json");
    if (!resp.ok) {
      return Promise.reject(new Error(`Load projects: ${resp.status}`));
    }
    const projectData = JSON.parse(await resp.text());
    Log.lvl2(
      "Loaded list of projects:",
      projectData.map((p: any) => p.name).join(", ")
    );

    this.userState.updateProjects(projectData);
  }

  async createAccount() {
    const dialogRef = this.dialog.open(AccountDialog, {
      data: {
        title: "Create new account",
      },
      width: "30em",
    });

    dialogRef.afterClosed().subscribe(async (name: string) => {
      if (name !== undefined) {
        const account = this.userState.createAccount(name);

        await this.performLongAction(
          () => this.creditAccount(account, 5),
          "Creating new account"
        );

        // Select newly created account
        this.selectAccount(this.accounts.length - 1);
      }
    });
  }

  async creditAccount(account: UIEvmAccount, amount: number) {
    const creditAmount = WEI_PER_ETHER.mul(amount);

    // Credit account to allow for transactions
    Log.lvl2("Crediting newly created EVM account...");
    await this.config.bevmInstance.creditAccount(
      [this.config.bevmUser],
      account.wrapped,
      creditAmount
    );
  }

  toggleTutorial() {
    this.tutorialOpen = !this.tutorialOpen;
  }

  get tutorialIsCompleted(): boolean {
    return this.userState.tutorialIsCompleted;
  }

  completeTutorial() {
    this.userState.completeTutorial();
  }

  get projects(): Project[] {
    return this.userState.projects;
  }

  get projectSelectedIndex(): number {
    return this.userState.projectSelectedIndex;
  }

  get accounts(): UIEvmAccount[] {
    return this.userState.accounts;
  }

  get accountSelectedIndex(): number {
    return this.userState.accountSelectedIndex;
  }

  get contracts(): UIEvmContract[] {
    return this.userState.contracts;
  }

  get contractSelectedIndex(): number {
    return this.userState.contractSelectedIndex;
  }

  get instances(): Buffer[] {
    return this.userState.instances;
  }

  get instanceSelected(): Buffer {
    return this.userState.instanceSelected;
  }

  get instanceSelectedIndex(): number {
    return this.userState.instanceSelectedIndex;
  }

  get transactions(): string[] {
    return this.userState.transactions;
  }

  get transactionSelectedIndex(): number {
    return this.userState.transactionSelectedIndex;
  }

  get viewMethods(): string[] {
    return this.userState.viewMethods;
  }

  get viewMethodSelectedIndex(): number {
    return this.userState.viewMethodSelectedIndex;
  }

  get projectCompiled(): boolean {
    return this.userState.projectCompiled;
  }

  get projectVerified(): boolean {
    return this.userState.projectVerified;
  }

  get verificationResults(): any {
    return this.userState.verificationResults;
  }

  get verificationSuccessful(): boolean {
    return this.userState.verificationSuccessful;
  }

  selectProject(index: number) {
    Log.lvl2(`User selected project '${index}'`);
    this.userState.selectProject(index);
    this.viewMethodResult = "";
  }

  get projectSourceFiles(): SourceFile[] {
    return this.userState.projectSourceFiles;
  }

  selectAccount(index: number) {
    Log.lvl2(`User selected account '${index}'`);
    this.userState.selectAccount(index);
  }

  selectContract(index: number) {
    Log.lvl2(`User selected contract '${index}'`);
    this.userState.selectContract(index);
  }

  selectInstance(index: number) {
    Log.lvl2(`User selected instance '${index}'`);
    this.userState.selectInstance(index);
  }

  selectTransaction(index: number) {
    Log.lvl2(`User selected transaction '${index}'`);
    this.userState.selectTransaction(index);
  }

  selectViewMethod(index: number) {
    Log.lvl2(`User selected view method '${index}'`);
    this.userState.selectViewMethod(index);
  }

  convertReport(report: any) {
    const items = report.stainless[0][1][0];

    const res = items.map((item: any) => {
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

      // Ensure file names are not too long
      if (position.file.length > 15) {
        position.file = position.file.substr(0, 15) + "...";
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

  async performLongAction<T>(
    f: () => Promise<T>,
    message: string,
    nbAttempts: number = 1
  ): Promise<T> {
    const dialogRef = this.dialog.open(InfoDialog, {
      data: { message },
      disableClose: true,
      width: "20em",
    });

    let result: T;
    let attempt = 0;

    for (attempt = 0; attempt < nbAttempts; attempt++) {
      try {
        result = await f();
        break;
      } catch (e) {
        Log.lvl2(
          `[attempt #${attempt + 1}] Exception in performLongAction(): `,
          e
        );
      }
    }

    dialogRef.close();

    if (attempt === nbAttempts) {
      const infoRef = this.dialog.open(InfoDialog, {
        data: {
          message: `An unexpected error occurred.\n
                    Please contact the developers at C4DT`,
          requireAck: true,
          title: "Error",
        },
        width: "30em",
      });

      infoRef.afterClosed().subscribe(async (_) => {
        window.location.reload();
      });

      result = null;
    }

    return result;
  }

  async verify() {
    if (!this.projectVerified) {
      const sourceFiles = {};
      for (const f of this.userState.projectSelected.sourceFiles.elements) {
        sourceFiles[f.name] = f.contents;
      }

      // Call Stainless service to perform verification
      const response = await this.performLongAction<proto.VerificationResponse>(
        () => this.config.stainlessRPC.verify(sourceFiles),
        "Performing verification"
      );
      Log.print("Received verification results");

      const verif = this.convertReport(JSON.parse(response.Report));

      this.userState.verificationResults = verif.sort((e1: any, e2: any) => {
        if (e1.method > e2.method) {
          return 1;
        }
        if (e1.method < e2.method) {
          return -1;
        }
        return e1.position.start[0] - e2.position.start[0];
      });
    }

    this.dialog.open(VerifDialog, {
      data: {
        verificationResults: this.verificationResults,
        verificationSuccessful: this.verificationSuccessful,
      },
      width: "100em",
    });
  }

  async compile() {
    const sourceFiles = {};
    for (const f of this.userState.projectSelected.sourceFiles.elements) {
      sourceFiles[f.name] = f.contents;
    }

    // Call Stainless service to generate bytecode and ABI
    const response = await this.performLongAction<proto.BytecodeGenResponse>(
      () => this.config.stainlessRPC.genBytecode(sourceFiles),
      "Compiling..."
    );
    Log.print("Received bytecode generation results");

    const contracts = Object.keys(response.BytecodeObjs).map((name) => {
      const bytecode = Buffer.from(response.BytecodeObjs[name].Bin, "hex");
      const abi = response.BytecodeObjs[name].Abi;

      Log.print(`creating contract "${name}"`);
      const contract = new EvmContract(name, bytecode, abi);
      return new UIEvmContract(contract);
    });

    this.userState.contracts = contracts;
  }

  deploy() {
    const contract = this.userState.contractSelected;
    const account = this.userState.accountSelected;
    const abi = contract.getMethodAbi("");

    const dialogRef = this.dialog.open(ArgDialog, {
      data: {
        abi,
        title: `Deploy new instance of contract '${contract.name}'`,
      },
      width: "30em",
    });

    dialogRef.afterClosed().subscribe(async (userArgs) => {
      const args = this.parseArguments(contract, userArgs, abi);

      if (args === null) {
        return;
      }

      Log.lvl2(`Deploying contract with constructor args ${args}`);

      await this.performLongAction(
        () =>
          this.config.bevmInstance.deploy(
            [this.config.bevmUser],
            1e7,
            1,
            0,
            account.wrapped,
            contract.wrapped,
            args
          ),
        "Deploying new instance"
      );

      // Select newly deployed instance
      this.selectInstance(this.instances.length - 1);

      this.userState.save();
    });
  }

  executeTransaction() {
    const methodName = this.userState.transactionSelected;
    const contract = this.userState.contractSelected;
    const account = this.userState.accountSelected;
    const abi = contract.getMethodAbi(methodName);

    const dialogRef = this.dialog.open(ArgDialog, {
      data: {
        abi,
        title: `Execute transaction '${methodName}'`,
      },
      width: "30em",
    });

    dialogRef.afterClosed().subscribe(async (userArgs) => {
      const args = this.parseArguments(contract, userArgs, abi);

      if (args === null) {
        return;
      }

      Log.lvl2(`Executing transaction with args ${args}`);

      await this.performLongAction(
        () =>
          this.config.bevmInstance.transaction(
            [this.config.bevmUser],
            1e7,
            1,
            0,
            account.wrapped,
            contract.wrapped,
            contract.addresses.selectedIndex,
            methodName,
            args
          ),
        "Executing transaction"
      );

      this.userState.save();
    });
  }

  executeViewMethod() {
    const methodName = this.userState.viewMethodSelected;
    const contract = this.userState.contractSelected;
    const account = this.userState.accountSelected;
    const abi = contract.getMethodAbi(methodName);

    const dialogRef = this.dialog.open(ArgDialog, {
      data: {
        abi,
        title: `Execute view method '${methodName}'`,
      },
      width: "30em",
    });

    dialogRef.afterClosed().subscribe(async (userArgs) => {
      const args = this.parseArguments(contract, userArgs, abi);

      if (args === null) {
        return;
      }

      Log.lvl2(`Executing view method with args ${args}`);

      const response = await this.performLongAction(
        () =>
          this.config.bevmInstance.call(
            account.wrapped,
            contract.wrapped,
            contract.addresses.selectedIndex,
            methodName,
            args
          ),
        "Executing view method",
        5
      );

      Log.lvl2(`Response = ${response}`);

      this.viewMethodResult = contract.makeUserResult(
        Array.from(response),
        abi
      );
    });
  }

  copyInstanceAddress() {
    this.cbService.copyFromContent(
      "0x" + this.instanceSelected.toString("hex")
    );
  }

  getLineNumbers(file: any): string {
    const lines = file.contents.split("\n");

    let nbLines = lines.length;
    if (lines[lines.length - 1].length === 0) {
      // File ends with EOL
      nbLines -= 1;
    }

    const lineNumbers: number[] = [];
    for (let i = 0; i < nbLines; i++) {
      lineNumbers.push(i + 1);
    }

    return lineNumbers.join("\n");
  }

  private parseArguments(
    contract: UIEvmContract,
    args: string[],
    abi: any
  ): string[] {
    if (args === undefined) {
      return null;
    }

    if (args.filter((v: string) => v === undefined).length > 0) {
      return null;
    }

    try {
      return contract.parseUserArgs(args, abi);
    } catch (exc) {
      this.dialog.open(InfoDialog, {
        data: {
          message: exc,
          requireAck: true,
          title: "Argument error",
        },
        width: "30em",
      });
      return null;
    }
  }
}

export interface IArgDialogData {
  title: string;
  abi: any;
}

@Component({
  selector: "arg-dialog",
  templateUrl: "arg-dialog.html",
})
export class ArgDialog {
  values: string[];
  methodInputs: any;

  constructor(
    public dialogRef: MatDialogRef<ArgDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IArgDialogData
  ) {
    this.methodInputs = this.data.abi.inputs;
    this.values = this.methodInputs.map((_: any) => undefined);
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
  title: string;
  requireAck: boolean;
}

@Component({
  selector: "info-dialog",
  templateUrl: "info-dialog.html",
})
export class InfoDialog {
  constructor(
    public dialogRef: MatDialogRef<InfoDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IInfoDialogData
  ) {}
}

export interface IAccountDialogData {
  title: string;
}

@Component({
  selector: "account-dialog",
  templateUrl: "account-dialog.html",
})
export class AccountDialog {
  name: string;

  constructor(
    public dialogRef: MatDialogRef<AccountDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IAccountDialogData
  ) {
    this.name = undefined;
  }

  onNoClick(): void {
    this.dialogRef.close();
  }

  onEnter(): void {
    this.dialogRef.close(this.name);
  }
}

export interface IVerifDialogData {
  verificationSuccessful: boolean;
  verificationResults: any;
}

@Component({
  selector: "verif-dialog",
  styleUrls: ["./stainless.component.css"],
  templateUrl: "verif-dialog.html",
})
export class VerifDialog {
  constructor(
    public dialogRef: MatDialogRef<VerifDialog>,
    @Inject(MAT_DIALOG_DATA) public data: IVerifDialogData
  ) {}

  onNoClick(): void {
    this.dialogRef.close();
  }

  onEnter(): void {
    this.dialogRef.close();
  }
}
