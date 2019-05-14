import Long from "long";

import ByzCoinRPC from "@c4dt/cothority/byzcoin/byzcoin-rpc";
import Rules from "@c4dt/cothority/darc/rules";
import { BevmInstance } from "src/lib/bevm";
// import { BLOCK_INTERVAL, ROSTER, SIGNER, startConodes } from "../support/conodes";

describe("BevmInstance Tests", () => {
//     const roster = ROSTER.slice(0, 4);

    beforeAll(async () => {
//         await startConodes();
    });

    it("should spawn a coin instance", async () => {
        // const darc = ByzCoinRPC.makeGenesisDarc([SIGNER], roster);
        // darc.addIdentity("spawn:bevm", SIGNER, Rules.OR);
        // darc.addIdentity("invoke:bevm.transaction", SIGNER, Rules.OR);

        // const rpc = await ByzCoinRPC.newByzCoinRPC(roster, darc, BLOCK_INTERVAL);
        // const bevm = await BevmInstance.spawn(rpc, darc.getBaseID(), [SIGNER]);

        // expect(bevm.coin.value.toNumber()).toBe(0);

        // await bevm.mint([SIGNER], Long.fromNumber(1000));
        // await bevm.update();

        // expect(bevm.coin.value.toNumber()).toBe(1000);

        // const ci2 = await BevmInstance.spawn(rpc, darc.getBaseID(), [SIGNER]);
        // await bevm.transfer(Long.fromNumber(50), ci2.id, [SIGNER]);

        // await bevm.update();
        // await ci2.update();

        // expect(bevm.coin.value.toNumber()).toBe(950);
        // expect(ci2.coin.value.toNumber()).toBe(50);
    });
});
