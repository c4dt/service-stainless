import Long, { fromNumber } from "long";

import { Log } from "@c4dt/cothority/log";
import { Data, TestData } from "src/lib/Data";
import { activateTesting, Defaults } from "src/lib/Defaults";

import { BevmInstance } from "src/lib/bevm";

// jasmine.DEFAULT_TIMEOUT_INTERVAL = 100000;

describe("BEvm should", async () => {
    let tdAdmin: TestData;

    beforeAll(async () => {
        try {
            tdAdmin = await TestData.init();
        } catch (e) {
            Log.error("couldn't start byzcoin:", e);
        }
    });

    it("create a new BEvmInstance", async () => {
        Log.lvl1("BEvm test start");

        const bevm = await BevmInstance.spawn(tdAdmin.bc, tdAdmin.darc.getBaseID(), [tdAdmin.admin]);

        Log.lvl1("BEvm instance created");

        await bevm.transaction([tdAdmin.admin], Long.fromNumber(1e7), Long.fromNumber(1), Long.fromNumber(0), 5);

        Log.lvl1("BEvm test end");
    });
});
