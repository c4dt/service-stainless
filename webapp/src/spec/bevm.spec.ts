import Long from "long";

import Log from "@dedis/cothority/log";

import { BEvmInstance } from "@dedis/cothority/bevm";
import ByzCoinRPC from "@dedis/cothority/byzcoin/byzcoin-rpc";
import SignerEd25519 from "@dedis/cothority/darc/signer-ed25519";
import { Roster } from "@dedis/cothority/network";

import { Config } from "src/lib/config";
import { StainlessRPC } from "src/lib/stainless";

class TestConfig extends Config {
  static async init(): Promise<Config> {
    const rosterToml = await TestConfig.getRosterToml();
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

    const byzcoinRPC = await ByzCoinRPC.newByzCoinRPC(
      roster,
      darc,
      Long.fromNumber(1e9)
    );

    const bevmInstance = await BEvmInstance.spawn(
      byzcoinRPC,
      darc.getBaseID(),
      [admin]
    );

    const stainlessRPC = new StainlessRPC(stainlessConode);

    const cfg = new TestConfig(bevmInstance, stainlessRPC, admin);

    return cfg;
  }
}

describe("BEvm", async () => {
  let config: TestConfig;

  /* tslint:disable:max-line-length */
  const basicSource = `
    import stainless.smartcontracts._
import stainless.annotation._

trait BasicContract extends Contract {
  val other: Address

  @solidityView
  @solidityPublic
  final def foo(): Address = {
    other
  }
}
`.trim();

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

    let valid: number = 0;
    let invalid: number = 0;

    verif.forEach((elem: any) => {
      for (const key in elem.status) {
        if (key === "Valid" || key === "ValidFromCache") {
          valid++;
        } else if (key === "Invalid") {
          invalid++;
        }
      }
    });

    return { valid, invalid };
  }

  it("should verify a contract", async () => {
    const response = await config.stainlessRPC.verify({
      "BasicContract.scala": basicSource,
    });

    const { valid, invalid } = parseReport(response.Report);

    expect(valid).toBeGreaterThan(0);
    expect(invalid).toEqual(0);
  }, 180000); // Extend Jasmine default timeout interval to 3 minutes
});
