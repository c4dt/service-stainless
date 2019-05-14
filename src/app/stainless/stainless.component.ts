import { Component, Inject, OnInit } from "@angular/core";
import { MAT_DIALOG_DATA, MatDialog, MatDialogRef } from "@angular/material";
import { Log } from "@c4dt/cothority/log";

import { Defaults } from "../../lib/Defaults";
import StainlessRPC from "../../lib/stainless/stainless-rpc";

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
            abi: JSON.parse(`[
                {
                    "constant": true,
                    "inputs": [],
                    "name": "getRemainingCandies",
                    "outputs": [
                        {
                            "name": "",
                            "type": "uint256"
                        }
                    ],
                    "payable": false,
                    "stateMutability": "view",
                    "type": "function"
                },
                {
                    "constant": false,
                    "inputs": [
                        {
                            "name": "candies",
                            "type": "uint256"
                        }
                    ],
                    "name": "eatCandy",
                    "outputs": [],
                    "payable": false,
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "name": "_candies",
                            "type": "uint256"
                        }
                    ],
                    "payable": false,
                    "stateMutability": "nonpayable",
                    "type": "constructor"
                }
            ]`),
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
            verif: [
                {
                    method: "constructor",
                    position: {
                        end: [16, 22],
                        file: "Candy.scala",
                        start: [16, 5],
                    },
                    status: "valid",
                    type: "body assertion",
                }, {
                    method: "eatCandy",
                    position: {
                        end: [26, 22],
                        file: "Candy.scala",
                        start: [26, 5],
                    },
                    status: "valid",
                    type: "body assertion",
                },
            ],
        }, {
            abi: JSON.parse(`[
                {
                    "constant": false,
                    "inputs": [],
                    "name": "checkTokens",
                    "outputs": [],
                    "payable": false,
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "constant": false,
                    "inputs": [],
                    "name": "payback",
                    "outputs": [],
                    "payable": true,
                    "stateMutability": "payable",
                    "type": "function"
                },
                {
                    "constant": false,
                    "inputs": [],
                    "name": "lend",
                    "outputs": [],
                    "payable": true,
                    "stateMutability": "payable",
                    "type": "function"
                },
                {
                    "constant": false,
                    "inputs": [],
                    "name": "requestDefault",
                    "outputs": [],
                    "payable": false,
                    "stateMutability": "nonpayable",
                    "type": "function"
                },
                {
                    "inputs": [
                        {
                            "name": "_wantedAmount",
                            "type": "uint256"
                        },
                        {
                            "name": "_interest",
                            "type": "uint256"
                        },
                        {
                            "name": "_tokenAmount",
                            "type": "uint256"
                        },
                        {
                            "name": "_tokenName",
                            "type": "string"
                        },
                        {
                            "name": "_tokenContractAddress",
                            "type": "address"
                        },
                        {
                            "name": "_length",
                            "type": "uint256"
                        }
                    ],
                    "payable": false,
                    "stateMutability": "nonpayable",
                    "type": "constructor"
                }
            ]`),
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
                },
            ],
            name: "Loan",
            verif: [
                {
                    status: "valid",
                    position: {
                        start: [
                            31,
                            9
                        ],
                        end: [
                            31,
                            9
                        ],
                        file: "LoanContract.scala"
                    },
                    type: "adt invariant",
                    method: "requestDefault"
                },
                {
                    status: "valid",
                    position: {
                        start: [
                            31,
                            9
                        ],
                        end: [
                            31,
                            9
                        ],
                        file: "LoanContract.scala"
                    },
                    type: "adt invariant",
                    method: "requestDefault"
                },
                {
                    status: "valid",
                    position: {
                        start: [
                            133,
                            33
                        ],
                        end: [
                            133,
                            57
                        ],
                        file: "LoanContract.scala"
                    },
                    type: "adt invariant",
                    method: "requestDefault"
                },
                {
                    status: "valid",
                    position: {
                        start: [
                            136,
                            28
                        ],
                        end: [
                            136,
                            35
                        ],
                        file: "LoanContract.scala"
                    },
                    type: "adt invariant",
                    method: "requestDefault"
                },
                {
                    status: "valid",
                    position: {
                        start: [
                            121,
                            5
                        ],
                        end: [
                            140,
                            6
                        ],
                        file: "LoanContract.scala"
                    },
                    type: "postcondition",
                    method: "requestDefault"
                },
                {
                    status: "valid",
                    position: {
                        start: [
                            131,
                            13
                        ],
                        end: [
                            131,
                            59
                        ],
                        file: "LoanContract.scala"
                    },
                    type: "precond.",
                                     method: "requestDefault"
                    },
                    {
                        status: "valid",
                        position: {
                            start: [
                                25,
                                56
                            ],
                            end: [
                                29,
                                4
                            ],
                            file: "LoanContractInvariant.scala"
                        },
                        type: "match exhaustiveness",
                        method: "isPrefix"
                    },
                    {
                        status: "valid",
                        position: {
                            start: [
                                31,
                                9
                            ],
                            end: [
                                31,
                                9
                            ],
                            file: "LoanContract.scala"
                        },
                        type: "adt invariant",
                        method: "payback"
                    },
                    {
                        status: "valid",
                        position: {
                            start: [
                                112,
                                33
                            ],
                            end: [
                                112,
                                58
                            ],
                            file: "LoanContract.scala"
                        },
                        type: "adt invariant",
                        method: "payback"
                    },
                    {
                        status: "valid",
                        position: {
                            start: [
                                115,
                                28
                            ],
                            end: [
                                115,
                                36
                            ],
                            file: "LoanContract.scala"
                        },
                        type: "adt invariant",
                        method: "payback"
                    },
                    {
                        status: "valid",
                        position: {
                            start: [
                                31,
                                9
                            ],
                            end: [
                                31,
                                9
                            ],
                            file: "LoanContract.scala"
                        },
                        type: "adt invariant",
                        method: "payback"
                    },
                    {
                        status: "valid",
                        position: {
                            start: [
                                99,
                                5
                            ],
                            end: [
                                119,
                                6
                            ],
                            file: "LoanContract.scala"
                        },
                        type: "postcondition",
                        method: "payback"
                    },
                    {
                        status: "valid",
                        position: {
                            start: [
                                110,
                                13
                            ],
                            end: [
                                110,
                                61
                            ],
                            file: "LoanContract.scala"
                        },
                        type: "precond.",
                        method: "payback"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    22,
                                    13
                                ],
                                end: [
                                    22,
                                    34
                                ],
                                file: "ERC20Specs.scala"
                            },
                            type: "match exhaustiveness",
                            method: "snapshot"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    90,
                                    32
                                ],
                                end: [
                                    90,
                                    49
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "lend"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    83,
                                    26
                                ],
                                end: [
                                    83,
                                    36
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "lend"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    91,
                                    25
                                ],
                                end: [
                                    91,
                                    30
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "lend"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    87,
                                    37
                                ],
                                end: [
                                    87,
                                    71
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "lend"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    77,
                                    5
                                ],
                                end: [
                                    96,
                                    6
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "postcondition",
                            method: "lend"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    67,
                                    37
                                ],
                                end: [
                                    67,
                                    70
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "checkTokens"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    69,
                                    32
                                ],
                                end: [
                                    69,
                                    48
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "checkTokens"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    60,
                                    5
                                ],
                                end: [
                                    74,
                                    6
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "postcondition",
                            method: "checkTokens"
                        },
                        {
                            status: "invalid",
                            position: {
                                start: [
                                    56,
                                    20
                                ],
                                end: [
                                    56,
                                    30
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "constructor"
                        },
                        {
                            status: "invalid",
                            position: {
                                start: [
                                    55,
                                    22
                                ],
                                end: [
                                    55,
                                    29
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "constructor"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    53,
                                    21
                                ],
                                end: [
                                    53,
                                    31
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "constructor"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    51,
                                    25
                                ],
                                end: [
                                    51,
                                    34
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "constructor"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    50,
                                    24
                                ],
                                end: [
                                    50,
                                    37
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "constructor"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    52,
                                    23
                                ],
                                end: [
                                    52,
                                    35
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "constructor"
                        },
                        {
                            status: "invalid",
                            position: {
                                start: [
                                    57,
                                    24
                                ],
                                end: [
                                    57,
                                    38
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "constructor"
                        },
                        {
                            status: "invalid",
                            position: {
                                start: [
                                    54,
                                    32
                                ],
                                end: [
                                    54,
                                    53
                                ],
                                file: "LoanContract.scala"
                            },
                            type: "adt invariant",
                            method: "constructor"
                        },
                        {
                            status: "valid",
                            position: {
                                start: [
                                    41,
                                    5
                                ],
                                end: [
                                    41,
                                    23
                                ],
                                file: "LoanContractInvariant.scala"
                            },
                            type: "precond.",
                            method: "stateInvariant"
                        }
            ],
        },
    ];

    verifResult: any = undefined;
    deployable: boolean = false;
    executable: boolean = false;
    contractSelected: any = undefined;
    transactionSelected: number = undefined;
    viewMethodSelected: number = undefined;
    viewMethodResult: string = "";

    constructor(public dialog: MatDialog) { }

    ngOnInit() {
        this.contractSelected = this.contracts[0];
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

    verify() {
        // Perform verification

        this.verifResult = this.contractSelected.verif.sort((e1, e2) => {
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

    deploy() {
        // Gen bytecode & ABI

        const dialogRef = this.dialog.open(DeployDialog, {
            data: {
                abi: this.contractSelected.abi,
                methodName: undefined,
                title: `Deploying contract '${this.contractSelected.name}'`,
            },
            width: "30em",
        });

        dialogRef.afterClosed().subscribe((result) => {
            const v = JSON.stringify(result);
            if (v !== undefined) {
                Log.lvl2(`Deploying contract with constructor args ${v}`);
                this.deployable = false;
                this.executable = true;

                const abi = this.contractSelected.abi;

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

        const dialogRef = this.dialog.open(DeployDialog, {
            data: {
                abi: this.contractSelected.abi,
                methodName,
                title: `Executing transaction '${methodName}'`,
            },
            width: "30em",
        });

        dialogRef.afterClosed().subscribe((result) => {
            const v = JSON.stringify(result);
            if (v !== undefined) {
                Log.lvl2(`Executing transaction with args ${v}`);
            }
        });
    }

    executeViewMethod() {
        const methodName = this.viewMethods[this.viewMethodSelected];

        const dialogRef = this.dialog.open(DeployDialog, {
            data: {
                abi: this.contractSelected.abi,
                methodName,
                title: `Executing view method '${methodName}'`,
            },
            width: "30em",
        });

        dialogRef.afterClosed().subscribe((result) => {
            const v = JSON.stringify(result);
            if (v !== undefined) {
                Log.lvl2(`Executing view method with args ${v}`);
                this.viewMethodResult = "90";
            }
        });
    }
}

export interface IDialogData {
    title: string;
    abi: any;
    methodName: string;
}

@Component({
    selector: "deploy-dialog",
    templateUrl: "deploy-dialog.html",
})
export class DeployDialog {
    values: string[];
    method: any;

    constructor(
        public dialogRef: MatDialogRef<DeployDialog>,
        @Inject(MAT_DIALOG_DATA) public data: IDialogData) {
        this.method = this.data.abi.filter( (elem: any, _index: number, _array: any) => {
            return elem.name === this.data.methodName;
        })[0];

        this.values = this.method.inputs.map((_: any) => undefined);
    }

    onNoClick(): void {
        this.dialogRef.close();
    }

}
