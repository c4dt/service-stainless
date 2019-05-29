import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material";
import { Log } from "@c4dt/cothority/log";

import { Defaults } from "../../lib/Defaults";
import StainlessRPC from "../../lib/stainless/stainless-rpc";

import Long, { fromNumber } from "long";
import { BevmInstance, EvmAccount, EvmContract } from "src/lib/bevm";
import { Data, TestData } from "src/lib/Data";

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

    contracts = [
        {
            files: [
                {
                    contents: `
import stainless.smartcontracts._
import stainless.lang.StaticChecks._
import stainless.annotation._

case class Candy(
  var initialCandies: Uint256,
  var remainingCandies: Uint256,
  var eatenCandies: Uint256
) extends Contract {

  def constructor(_candies: Uint256) = {
    initialCandies = _candies
    remainingCandies = _candies
    eatenCandies = Uint256.ZERO

    assert(invariant)
  }

  def eatCandy(candies: Uint256) = {
    require(invariant)
    dynRequire(candies <= remainingCandies)

    remainingCandies -= candies
    eatenCandies += candies

    assert(invariant)
  }

  @view
  def getRemainingCandies(): Uint256 = remainingCandies;

  @view
  private def invariant: Boolean = {
    eatenCandies <= initialCandies &&
    remainingCandies <= initialCandies &&
    initialCandies - eatenCandies == remainingCandies
  }
}
`.trim(),
                    name: "Candy.scala",
                },
            ],
            name: "Candy",
        }, {
            files: [
                {
                    contents: `
import stainless.smartcontracts._
import stainless.annotation._
import stainless.collection._
import stainless.lang.StaticChecks._
import stainless.lang.old
import stainless.lang.ghost
import scala.language.postfixOps

import scala.annotation.meta.field

import LoanContractInvariant._

/************************************************
**  See report for a detail explanation of the
**  contract
*************************************************/

sealed trait State
case object WaitingForData extends State
case object WaitingForLender extends State
case object WaitingForPayback extends State
case object Finished extends State
case object Default extends State

sealed case class LoanContract (
    var borrower: Address,      // Amount of ether to borrow
    var wantedAmount: Uint256,   // Interest in ether
    var premiumAmount: Uint256,  // The amount of digital token guaranteed
    var tokenAmount: Uint256,    // Name of the digital token
    var tokenName: String,      // Reference to the contract that holds the tokens
    var tokenContractAddress: ERC20Token,
    var daysToLend: Uint256,
    var currentState: State,
    var start: Uint256,
    var lender: Address,

    @ghost
    var visitedStates: List[State]

)  extends Contract {
    require(
        addr != borrower &&
        addr != tokenContractAddress.addr
    )

    override def addr = Address(1)

    def constructor(_wantedAmount: Uint256, _interest: Uint256, _tokenAmount: Uint256,
      _tokenName: String, _tokenContractAddress: ERC20Token, _length: Uint256) = {
        wantedAmount = _wantedAmount
        premiumAmount = _interest
        tokenAmount = _tokenAmount
        tokenName = _tokenName
        tokenContractAddress = _tokenContractAddress
        daysToLend = _length
        borrower = Msg.sender
        currentState = WaitingForData
    }

    def checkTokens(): Unit = {
        require(invariant(this))

        if(currentState == WaitingForData) {
            val balance = tokenContractAddress.balanceOf(addr)
            if(balance >= tokenAmount) {
                ghost {
                    visitedStates = WaitingForLender :: visitedStates
                }
                currentState = WaitingForLender
            }
        }
    } ensuring { _ =>
        invariant(this)
    }

    @payable
    def lend(): Unit = {
        require (invariant(this))

        // Condition to prevent self funding.
        if(Msg.sender != borrower) {
            if(currentState == WaitingForLender && Msg.value >= wantedAmount) {
                lender = Msg.sender
                // Forward the money to the borrower
                borrower.transfer(wantedAmount)
                ghost {
                    visitedStates = WaitingForPayback :: visitedStates
                }

                currentState = WaitingForPayback
                start = now()
            }
        }
    } ensuring { _ =>
        invariant(this)
    }

    @payable
    def payback(): Unit = {
        require (invariant(this))
        dynRequire(address(this).balance >= Msg.value)
        dynRequire(Msg.value >= premiumAmount + wantedAmount)
        dynRequire(Msg.sender == borrower)

        if(currentState == WaitingForPayback) {
            // Forward the money to the lender
            lender.transfer(Msg.value)
            // Transfer all the guarantee back to the borrower
            val balance = tokenContractAddress.balanceOf(addr)
            tokenContractAddress.transfer(borrower, balance)
            ghost {
                visitedStates = Finished :: visitedStates
            }

            currentState = Finished
        }
    } ensuring { _ =>
        invariant(this)
    }

    def requestDefault(): Unit = {
        require (invariant(this))

        if(currentState == WaitingForPayback) {
            dynRequire(now() > (start + daysToLend))
            dynRequire(Msg.sender == lender)

            // Transfer all the guarantee to the lender
            var balance = tokenContractAddress.balanceOf(addr)

            tokenContractAddress.transfer(lender, balance)
            ghost {
                visitedStates = Default :: visitedStates
            }

            currentState = Default
        }
    } ensuring { _ =>
        invariant(this)
    }
}
`.trim(),
                    name: "LoanContract.scala",
                }, {
                    contents: `
import stainless.smartcontracts._
import stainless.lang._
import stainless.collection._
import stainless.annotation._

object LoanContractInvariant {
  @ghost
  def invariant(
    contract: LoanContract
  ) = {
    tokenInvariant(address(contract), contract.currentState, contract.tokenAmount, contract.tokenContractAddress) &&
    stateInvariant(contract.currentState, contract.visitedStates)
  }

  def tokenInvariant(
    loanContractAddress: Address,
    contractState: State,
    tokenAmount: Uint256,
    tokenContractAddress: ERC20Token
  ): Boolean = {
    (contractState == WaitingForLender ==> (tokenContractAddress.balanceOf(loanContractAddress) >= tokenAmount)) &&
    (contractState == WaitingForPayback ==> (tokenContractAddress.balanceOf(loanContractAddress) >= tokenAmount))
  }

  def isPrefix[T](l1: List[T], l2: List[T]): Boolean = (l1,l2) match {
    case (Nil(), _) => true
    case (Cons(x, xs), Cons(y, ys)) => x == y && isPrefix(xs, ys)
    case _ => false
  }

  @ghost
  def stateInvariant(
    currentState: State,
    visitedStates: List[State]
  ) = {
    val expected1: List[State] = List(WaitingForData, WaitingForLender, WaitingForPayback, Finished)
    val expected2: List[State] = List(WaitingForData, WaitingForLender, WaitingForPayback, Default)
    val rStates = visitedStates.reverse

    visitedStates.contains(WaitingForData) &&
    visitedStates.head == currentState && (
      isPrefix(rStates, expected1) ||
      isPrefix(rStates, expected2)
    )
  }
}

`.trim(),
                    name: "LoanContractInvariant.scala",
                }, {
                    contents: `
import stainless.smartcontracts._

import stainless.collection._
import stainless.proof._
import stainless.lang._
import stainless.annotation._

object ERC20Specs {
    def transferUpdate(a: Address, to: Address, sender: Address, amount: Uint256, thiss: ERC20Token, oldThiss: ERC20Token) = {
        ((a == to) ==> (thiss.balanceOf(a) == oldThiss.balanceOf(a) + amount)) &&
        ((a == sender) ==> (thiss.balanceOf(a) == oldThiss.balanceOf(a) - amount)) &&
        (a != to && a != sender) ==> (thiss.balanceOf(a) == oldThiss.balanceOf(a))
    }

    def transferSpec(b: Boolean, to: Address, sender: Address, amount: Uint256, thiss: ERC20Token, oldThiss: ERC20Token) = {
        (!b ==> (thiss == oldThiss)) &&
        (b ==> forall((a: Address) => transferUpdate(a, to, sender,amount,thiss,oldThiss))) &&
            (thiss.addr == oldThiss.addr)
    }

    def snapshot(token: ERC20Token): ERC20Token = {
        val ERC20Token(s) = token
        ERC20Token(s)
    }
}
`.trim(),
                    name: "ERC20Specs.scala",
                }, {
                    contents: `
import stainless.smartcontracts._

import stainless.collection._
import stainless.proof._
import stainless.lang._
import stainless.annotation._

import ERC20Specs._

case class ERC20Token(var s: BigInt) extends ContractInterface {
    @library
    def transfer(to: Address, amount: Uint256): Boolean = {
        require(amount >= Uint256.ZERO)
        val oldd = snapshot(this)
        s = s + 1

        val b = choose((b: Boolean) => transferSpec(b, to, Msg.sender, amount, this, oldd))
        b
    } ensuring(res => transferSpec(res, to, Msg.sender, amount, this, old(this)))

    @library
    def balanceOf(from: Address): Uint256 = {
        choose((b: Uint256) => b >= Uint256.ZERO)
    } ensuring {
        res => old(this).addr == this.addr
    }
}
`.trim(),
                    name: "ERC20Token.scala",
                }
            ],
            name: "Loan",
        },
    ];

    verifResult: any = undefined;
    deployable: boolean = false;
    executable: boolean = false;
    contractSelected: any = undefined;
    transactionSelected: number = undefined;
    viewMethodSelected: number = undefined;
    viewMethodResult: string = "";

    private stainlessRPC: StainlessRPC;
    private bevmRPC: BevmInstance;
    private testData: TestData;
    private account: EvmAccount; // FIXME: Handle account selection
    private contract: EvmContract; // FIXME: Handle contract history

    constructor(public dialog: MatDialog) { }

    async ngOnInit() {
        await this.performLongAction(
        () => this.initialize(),
            "Initializing");
    }

    async initialize() {
        this.contractSelected = this.contracts[0];

        this.testData = await TestData.init();
        this.stainlessRPC = new StainlessRPC(Defaults.Roster.list[0]);
        this.bevmRPC = await BevmInstance.spawn(this.testData.bc,
                                                this.testData.darc.getBaseID(),
                                                [this.testData.admin]);
        this.bevmRPC.setStainlessRPC(this.stainlessRPC);

        const privKey = Buffer.from("c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3", "hex");

        this.account = new EvmAccount(privKey);

        const WEI_PER_ETHER = Long.fromString("1000000000000000000");
        const amount = Buffer.from(WEI_PER_ETHER.mul(5).toBytesBE());

        Log.lvl2("Credit an account with:", amount);
        await this.bevmRPC.creditAccount([this.testData.admin], this.account.address, amount);
    }

    async testStainlessVerif() {
        const rpc = new StainlessRPC(Defaults.Roster.list[0]);
        const sourceFiles: {[_: string]: string} = {
            "BasicContract1.scala": `
import stainless.smartcontracts._
import stainless.annotation._

object BasicContract1 {
    case class BasicContract1(
        val other: Address
    ) extends Contract {
        @view
        def foo = {
            other
        }
    }
}`,
        };

        try {
            const response = await rpc.verify(sourceFiles);
            Log.lvl2(`console:\n${response.console}`);
            Log.lvl2(`report:\n${response.report}`);
        } catch (err) {
            Log.lvl2(`error:\n${err}`);
        }
    }

    async testStainlessGen() {
        const rpc = new StainlessRPC(Defaults.Roster.list[0]);
        const sourceFiles: {[_: string]: string} = {
            "PositiveUint.scala": `
import stainless.smartcontracts._
import stainless.annotation._
import stainless.lang.StaticChecks._

object PositiveUint {
    case class PositiveUint() extends Contract {
            @solidityPure
         def test(@ghost a: Uint256) = {
            assert(a >= Uint256.ZERO)
         }
    }
}`,
        };

        try {
            const response = await rpc.genBytecode(sourceFiles);
            Log.lvl2(`generated:\n${response}`);
        } catch (err) {
            Log.lvl2(`error:\n${err}`);
        }
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

            let status;
            switch (Object.keys(item.status)[0]) {
                case "Valid":
                case "ValidFromCache": {
                    status = "valid";
                    break;
                }
                default:
                    status = "invalid";
            }

            let position;
            if (item.pos.file !== undefined) {
                const filePath = item.pos.file.split("/");
                position = {
                    end: [item.pos.line, item.pos.col],
                    file: filePath[filePath.length - 1],
                    start: [item.pos.line, item.pos.col],
                };
            } else {
                const filePath = item.pos.begin.file.split("/");
                position = {
                    end: [item.pos.end.line, item.pos.end.col],
                    file: filePath[filePath.length - 1],
                    start: [item.pos.begin.line, item.pos.begin.col],
                };
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

    async performLongAction(f, message: string) {
        const dialogRef = this.dialog.open(InfoDialog, {
            data: { message },
            width: "20em",
        });

        let result: any;
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
        const response = await this.performLongAction(
            () => this.stainlessRPC.verify(sourceFiles),
            "Performing verification");
        // FIXME: Handle exceptions
        Log.print("Received verification results");

        const verif = this.convertReport(JSON.parse(response.report));

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
        const response = await this.performLongAction(
            () => this.stainlessRPC.genBytecode(sourceFiles),
            "Generating bytecode");
        // FIXME: Handle exceptions
        Log.print("Received bytecode generation results");

        // FIXME: Handle multiple ABI/bytecodes
        const firstKey = Object.keys(response.bytecodeObjs)[0];
        this.contractSelected.abi = JSON.parse(response.bytecodeObjs[firstKey].abi);
        this.contractSelected.bin = Buffer.from(response.bytecodeObjs[firstKey].bin, "hex");

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
                        [this.testData.admin],
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
                        [this.testData.admin],
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
