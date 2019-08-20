import Long from "long";

import Log from "@dedis/cothority/log";

import ByzCoinRPC from "@dedis/cothority/byzcoin/byzcoin-rpc";
import SignerEd25519 from "@dedis/cothority/darc/signer-ed25519";
import { Roster } from "@dedis/cothority/network";

import { BevmInstance, EvmAccount, EvmContract } from "src/lib/bevm";
import { Config } from "src/lib/config";
import { StainlessRPC } from "src/lib/stainless";

class TestConfig extends Config {

    static async init(): Promise<Config> {
        const rosterToml = await TestConfig.getRosterToml(window.location.origin);
        const roster = Roster.fromTOML(rosterToml);
        const stainlessConode = roster.list[0];

        const admin = SignerEd25519.random();

        const darc = ByzCoinRPC.makeGenesisDarc([admin], roster, "genesis darc");
        [
            "spawn:bevm",
            "delete:bevm",
            "invoke:bevm.credit",
            "invoke:bevm.transaction",
        ].forEach((rule) => {
            darc.rules.appendToRule(rule, admin, "|");
        });

        const bc = await ByzCoinRPC.newByzCoinRPC(roster, darc, Long.fromNumber(5e8));

        const bevmRPC = await BevmInstance.spawn(bc, darc.getBaseID(), [admin]);

        const stainlessRPC = new StainlessRPC(stainlessConode);
        bevmRPC.setStainlessRPC(stainlessRPC);

        const cfg = new TestConfig();

        cfg.genesisBlock = bc.genesisID;
        cfg.rosterToml = rosterToml;
        cfg.roster = roster;
        cfg.bevmRPC = bevmRPC;
        cfg.stainlessRPC = stainlessRPC;
        cfg.bevmUser = admin;

        return cfg;
    }
}

describe("BEvm should", async () => {
    let config: TestConfig;

    /* tslint:disable:max-line-length */
    const candySource = `
import stainless.smartcontracts._
import stainless.lang.StaticChecks._
import stainless.annotation._

trait Candy extends Contract {
  var initialCandies: Uint256
  var remainingCandies: Uint256
  var eatenCandies: Uint256

  @solidityPublic
  final def constructor(_candies: Uint256) = {
    initialCandies = _candies
    remainingCandies = _candies
    eatenCandies = Uint256.ZERO
  }

  @solidityPublic
  final def eatCandy(candies: Uint256) = {
    dynRequire(candies <= remainingCandies)

    remainingCandies -= candies
    eatenCandies += candies
  }

  @solidityPublic @solidityView
  final def getRemainingCandies() = remainingCandies

  @ghost @inline
  final def invariant(): Boolean = {
    eatenCandies <= initialCandies &&
    remainingCandies <= initialCandies &&
    initialCandies - eatenCandies == remainingCandies
  }
}
`.trim();
    const candyBytecode = Buffer.from(`
608060405234801561001057600080fd5b506040516020806101cb833981018060405281019080805190602001909291905050508060008190555080600181905550600060028190555050610172806100596000396000f30060806040526004361061004c576000357c0100000000000000000000000000000000000000000000000000000000900463ffffffff168063a1ff2f5214610051578063ea319f281461007e575b600080fd5b34801561005d57600080fd5b5061007c600480360381019080803590602001909291905050506100a9565b005b34801561008a57600080fd5b5061009361013c565b6040518082815260200191505060405180910390f35b6001548111151515610123576040517f08c379a00000000000000000000000000000000000000000000000000000000081526004018080602001828103825260058152602001807f6572726f7200000000000000000000000000000000000000000000000000000081525060200191505060405180910390fd5b8060015403600181905550806002540160028190555050565b60006001549050905600a165627a7a723058207721a45f17c0e0f57e255f33575281d17f1a90d3d58b51688230d93c460a19aa0029
`.trim(), "hex");
    const candyAbi = `
[{"constant":false,"inputs":[{"name":"candies","type":"uint256"}],"name":"eatCandy","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":true,"inputs":[],"name":"getRemainingCandies","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},{"inputs":[{"name":"_candies","type":"uint256"}],"payable":false,"stateMutability":"nonpayable","type":"constructor"}]
`.trim();
    /* tslint:enable:max-line-length */
    const WEI_PER_ETHER = Long.fromString("1000000000000000000");

    beforeAll(async () => {
        try {
            config = await TestConfig.init();
        } catch (e) {
            Log.error("couldn't start byzcoin:", e);
        }
    });

    function parseReport(reportJson: string): any {
        const report = JSON.parse(reportJson);
        const verif = report.stainless[0][1][0];

        let valid: number = 0 ;
        let invalid: number = 0 ;

        verif.forEach((elem: any) => {
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
        const response = await config.stainlessRPC.verify({"Candy.scala": candySource});

        const {valid, invalid} = parseReport(response.Report);

        expect(valid).toBeGreaterThan(0);
        expect(invalid).toEqual(0);
    }, 60000); // Extend Jasmine default timeout interval to 1 minute

    it("should create a contract deployment transaction", async () => {
        /* tslint:disable:max-line-length */
        const expectedTx = Buffer.from("7b226e6f6e6365223a22307830222c226761735072696365223a22307831222c22676173223a223078393839363830222c22746f223a6e756c6c2c2276616c7565223a22307830222c22696e707574223a22307836303830363034303532333438303135363130303130353736303030383066643562353036303430353136303230383036313031636238333339383130313830363034303532383130313930383038303531393036303230303139303932393139303530353035303830363030303831393035353530383036303031383139303535353036303030363030323831393035353530353036313031373238303631303035393630303033393630303066333030363038303630343035323630303433363130363130303463353736303030333537633031303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303039303034363366666666666666663136383036336131666632663532313436313030353135373830363365613331396632383134363130303765353735623630303038306664356233343830313536313030356435373630303038306664356235303631303037633630303438303336303338313031393038303830333539303630323030313930393239313930353035303530363130306139353635623030356233343830313536313030386135373630303038306664356235303631303039333631303133633536356236303430353138303832383135323630323030313931353035303630343035313830393130333930663335623630303135343831313131353135313536313031323335373630343035313766303863333739613030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303831353236303034303138303830363032303031383238313033383235323630303538313532363032303031383037663635373237323666373230303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303038313532353036303230303139313530353036303430353138303931303339306664356238303630303135343033363030313831393035353530383036303032353430313630303238313930353535303530353635623630303036303031353439303530393035363030613136353632376137613732333035383230373732316134356631376330653066353765323535663333353735323831643137663161393064336435386235313638383233306439336334363061313961613030323930303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303634222c2276223a22307830222c2272223a22307830222c2273223a22307830222c2268617368223a22307837666631383834633430633664636561653534666361346331356131333063356133663639373032643466336537356665336163373862313735656339356139227d", "hex");
        const expectedHash = Buffer.from("c289e67875d147429d2ffc5cc58e9a1486d581bef5aeca63017ad7855f8dab26", "hex");
        /* tslint:enable:max-line-length */

        const args = [JSON.stringify(100)];

        const response = await config.stainlessRPC.deployContract(1e7, 1, 0, 0, candyBytecode, candyAbi, args);

        Log.print("response = ", response);
        expect(response.Transaction).toEqual(expectedTx);
        expect(response.TransactionHash).toEqual(expectedHash);
    });

    it("should create a contract execution transaction", async () => {
        /* tslint:disable:max-line-length */
        const expectedTx = Buffer.from("7b226e6f6e6365223a22307831222c226761735072696365223a22307831222c22676173223a223078393839363830222c22746f223a22307838636461663063643235393838373235386263313361393263306136646139323639383634346330222c2276616c7565223a22307830222c22696e707574223a223078613166663266353230303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303061222c2276223a22307830222c2272223a22307830222c2273223a22307830222c2268617368223a22307865343264343137386465303032323636386433326637383033666564353637376437343666393238666465386430656339303532656432306138616466343362227d", "hex");
        const expectedHash = Buffer.from("e13b1cfe8797fa11bd7929158008033e585d302a6f4cb11cfcf2b0a8bebec3fd", "hex");
        const contractAddress = Buffer.from("8cdaf0cd259887258bc13a92c0a6da92698644c0", "hex");
        /* tslint:enable:max-line-length */

        const nonce = 1;
        const args = [JSON.stringify(10)];

        const response = await config.stainlessRPC.executeTransaction(1e7, 1, 0, contractAddress, nonce,
                                                               candyAbi, "eatCandy", args);

        Log.print("response = ", response);
        expect(response.Transaction).toEqual(expectedTx);
        expect(response.TransactionHash).toEqual(expectedHash);
    });

    it("should finalize a transaction", async () => {
        /* tslint:disable:max-line-length */
        const transaction = Buffer.from("7b226e6f6e6365223a22307831222c226761735072696365223a22307831222c22676173223a223078393839363830222c22746f223a22307838636461663063643235393838373235386263313361393263306136646139323639383634346330222c2276616c7565223a22307830222c22696e707574223a223078613166663266353230303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303061222c2276223a22307830222c2272223a22307830222c2273223a22307830222c2268617368223a22307865343264343137386465303032323636386433326637383033666564353637376437343666393238666465386430656339303532656432306138616466343362227d", "hex");
        const signature = Buffer.from("aa0b243e4ad97b6cb7c2a016567aa02b2e7bed159c221b7089b60688527f6e88679c9dfcb1ceb2477a36753645b564c2a14a7bc757f46b9b714c49a4c93ea0a401", "hex");
        const expectedTx = Buffer.from("7b226e6f6e6365223a22307831222c226761735072696365223a22307831222c22676173223a223078393839363830222c22746f223a22307838636461663063643235393838373235386263313361393263306136646139323639383634346330222c2276616c7565223a22307830222c22696e707574223a223078613166663266353230303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303061222c2276223a2230783163222c2272223a22307861613062323433653461643937623663623763326130313635363761613032623265376265643135396332323162373038396236303638383532376636653838222c2273223a22307836373963396466636231636562323437376133363735333634356235363463326131346137626337353766343662396237313463343961346339336561306134222c2268617368223a22307834633966336134343361663030326438373839666235616239393261376631346639396134303762616532613332643464653830313037366365613065353631227d", "hex");
        /* tslint:enable:max-line-length */

        const response = await config.stainlessRPC.finalizeTransaction(transaction, signature);

        Log.print("response = ", response);
        expect(response.Transaction).toEqual(expectedTx);
    });

    it("should correctly sign a hash", () => {
        const hash = Buffer.from("c289e67875d147429d2ffc5cc58e9a1486d581bef5aeca63017ad7855f8dab26", "hex");
        /* tslint:disable:max-line-length */
        const expectedSig = Buffer.from("e6efff1077fe39f6a8b3e9dca6f2462d2d32aa51e911a7d7abd8741da6b09b9e35c184ec193af4258bc603cd20b48ceb2ff9317742741e9c4e8e97dfe1d6d39d01", "hex");
        /* tslint:enable:max-line-length */

        const privKey = Buffer.from("c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3", "hex");
        const account = new EvmAccount("test", privKey);

        const sig = account.sign(hash);

        expect(sig).toEqual(expectedSig);
    });

    it("deploy and interact with a contract", async () => {
        Log.print("ByzCoinID:", config.genesisBlock);

        Log.print("BEvm instance ID:", config.bevmRPC.id);

        const privKey = Buffer.from("c87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3", "hex");
        const expectedAccountAddress = Buffer.from("627306090abab3a6e1400e9345bc60c78a8bef57", "hex");
        const expectedContractAddress = Buffer.from("8cdaf0cd259887258bc13a92c0a6da92698644c0", "hex");

        const account = new EvmAccount("test", privKey);
        expect(account.address).toEqual(expectedAccountAddress);

        const contract = new EvmContract("Candy", candyBytecode, candyAbi);

        const amount = Buffer.from(WEI_PER_ETHER.mul(5).toBytesBE());

        Log.lvl2("Credit an account with:", amount);
        await expectAsync(config.bevmRPC.creditAccount([config.bevmUser], account.address, amount)).toBeResolved();

        Log.lvl2("Deploy a Candy contract");
        await expectAsync(config.bevmRPC.deploy([config.bevmUser],
                                                1e7,
                                                1,
                                                0,
                                                account,
                                                contract,
                                                [JSON.stringify(100)],
                                               )).toBeResolved();
        contract.addresses.select(0);
        expect(contract.addresses.selected).toEqual(expectedContractAddress);

        for (let nbCandies = 1; nbCandies <= 10; nbCandies++) {
            Log.lvl2(`Eat ${nbCandies} candies`);
            await expectAsync(config.bevmRPC.transaction([config.bevmUser],
                                                         1e7,
                                                         1,
                                                         0,
                                                         account,
                                                         contract,
                                                         "eatCandy",
                                                         [JSON.stringify(nbCandies)],
                                                        )).toBeResolved();
        }

        Log.lvl2("Retrieve number of remaining candies");
        const expectedRemainingCoins = 100 - (10 * 11 / 2);
        await expectAsync(config.bevmRPC.call(config.genesisBlock,
                                              config.rosterToml,
                                              config.bevmRPC.id,
                                              account,
                                              contract,
                                              "getRemainingCandies",
                                              [],
                                             )).toBeResolvedTo(expectedRemainingCoins);
    }, 60000); // Extend Jasmine default timeout interval to 1 minute
});
