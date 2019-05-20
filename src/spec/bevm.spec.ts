import Long, { fromNumber } from "long";

import { Log } from "@c4dt/cothority/log";
import { Data, TestData } from "src/lib/Data";
import { activateTesting, Defaults } from "src/lib/Defaults";

import { BevmInstance, EvmAccount, EvmContract } from "src/lib/bevm";

import StainlessRPC from "../lib/stainless/stainless-rpc";

// jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe("BEvm should", async () => {
    let tdAdmin: TestData;

    /* tslint:disable:max-line-length */
    const candySource = `
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
`.trim();
    const candyBytecode = `
08060405234801561001057600080fd5b506040516020806101cb833981018060405281019080805190602001909291905050508060008190555080600181905550600060028190555050610172806100596000396000f30060806040526004361061004c576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff168063a1ff2f5214610051578063ea319f281461007e575b600080fd5b34801561005d57600080fd5b5061007c600480360381019080803590602001909291905050506100a9565b005b34801561008a57600080fd5b5061009361013c565b6040518082815260200191505060405180910390f35b6001548111151515610123576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260058152602001807f6572726f7200000000000000000000000000000000000000000000000000000081525060200191505060405180910390fd5b8060015403600181905550806002540160028190555050565b60006001549050905600a165627a7a723058207721a45f17c0e0f57e255f33575281d17f1a90d3d58b51688230d93c460a19aa0029
`.trim();
    const candyAbi = `
[{"constant":false,"inputs":[{"name":"candies","type":"uint256"}],"name":"eatCandy","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getRemainingCandies","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_candies","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"}]
`.trim();
    /* tslint:enable:max-line-length */
    const WEI_PER_ETHER = Long.fromString("1000000000000000000");

    beforeAll(async () => {
        try {
            tdAdmin = await TestData.init();
        } catch (e) {
            Log.error("couldn't start byzcoin:", e);
        }
    });

    function parseReport(reportJson: string): any {
        const report = JSON.parse(reportJson);
        const verif = report.stainless[0][1][0];

        let valid: number = 0 ;
        let invalid: number = 0 ;

        verif.forEach((elem) => {
            for (const key in elem.status) {
                if (key === "Valid" || key === "ValidFromCache") {
                    valid++;
                } else if (key === "Invalid") {
                    invalid++;
                }
            }
        });

        return {valid, invalid};
    }

    it("should verify a contract", async () => {
        const stainlessRPC = new StainlessRPC(Defaults.Roster.list[0]);

        const response = await stainlessRPC.verify({"Candy.scala": candySource});
        const report = response.report;

        const {valid, invalid} = parseReport(report);

        expect(valid).toEqual(2);
        expect(invalid).toEqual(0);

        // return expectAsync(stainlessRPC.verify({})).toBeResolved();
    });

    it("should correctly sign a hash", () => {
        const hash = Buffer.from("c289e67875d147429d2ffc5cc58e9a1486d581bef5aeca63017ad7855f8dab26", "hex");
        /* tslint:disable:max-line-length */
        const expectedSig = Buffer.from("e6efff1077fe39f6a8b3e9dca6f2462d2d32aa51e911a7d7abd8741da6b09b9e35c184ec193af4258bc603cd20b48ceb2ff9317742741e9c4e8e97dfe1d6d39d01", "hex");
        /* tslint:enable:max-line-length */

        const privKey = Buffer.from("c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3", "hex");
        const account = new EvmAccount(privKey);

        const sig = account.sign(hash);

        expect(sig).toEqual(expectedSig);
    });

    xit("deploy and interact with a contract", async () => {
        Log.lvl2("Create a new BEvm instance");
        const bevm = await BevmInstance.spawn(tdAdmin.bc, tdAdmin.darc.getBaseID(), [tdAdmin.admin]);

        const privKey = Buffer.from("c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3", "hex");
        const expectedAddress = Buffer.from("627306090abab3a6e1400e9345bc60c78a8bef57", "hex");

        const account = new EvmAccount(privKey);
        expect(account.address).toEqual(expectedAddress);

        const contract = new EvmContract(candyBytecode, candyAbi);

        const amount = Buffer.from(WEI_PER_ETHER.mul(5).toBytesBE());

        Log.lvl2("Credit an account with:", amount);
        await expectAsync(bevm.creditAccount([tdAdmin.admin], account.address, amount)).toBeResolved();

        Log.lvl2("Deploy a Candy contract");
        await expectAsync(bevm.deploy([tdAdmin.admin],
                                      Long.fromNumber(1e7),
                                      Long.fromNumber(1),
                                      Long.fromNumber(0),
                                      account,
                                      contract,
                                      )).toBeResolved();

        Log.lvl2("Eat candies");
        return expectAsync(bevm.transaction([tdAdmin.admin],
                                            Long.fromNumber(1e7),
                                            Long.fromNumber(1),
                                            Long.fromNumber(0),
                                            account,
                                            contract,
                                            "eatCandies",
                                            [JSON.stringify(10)])).toBeResolved();
    });
});
