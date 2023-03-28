import { BEvmInstance } from "@dedis/cothority/bevm";
import { ByzCoinRPC } from "@dedis/cothority/byzcoin";
import Signer from "@dedis/cothority/darc/signer";
import SignerEd25519 from "@dedis/cothority/darc/signer-ed25519";
import Log from "@dedis/cothority/log";
import { Roster } from "@dedis/cothority/network";

import toml from "toml";

import { StainlessRPC } from "src/lib/stainless";

const ROSTER_FILE = "conodes.toml";
const STAINLESS_ROSTER_FILE = "stainless.toml";
const BYZCOIN_CONFIG_FILE = "byzcoin.toml";
const BEVM_CONFIG_FILE = "bevm.toml";

export class Config {
  static async init(): Promise<Config> {
    const rosterToml = await Config.getRosterToml();
    const roster = Roster.fromTOML(rosterToml);

    const stainlessRoster = Roster.fromTOML(
      await Config.getStainlessRosterToml()
    );
    if (stainlessRoster.length === 0) {
      Promise.reject("Empty Stainless roster");
    }
    const stainlessConode = stainlessRoster.list[0];

    const serverConfig = await Config.getServerConfig();

    const byzcoinRPC = await ByzCoinRPC.fromByzcoin(
      roster,
      serverConfig.byzCoinID
    );
    const bevmInstance = await BEvmInstance.fromByzcoin(
      byzcoinRPC,
      serverConfig.bevmInstanceID
    );

    let bevmUser: Signer;
    if (serverConfig.bevmUserID) {
      bevmUser = SignerEd25519.fromBytes(serverConfig.bevmUserID);
    } else {
      throw new Error("Cannot determine bevmUser");
    }
    Log.lvl2(`bevmUser = ${bevmUser.toString()}`);

    const stainlessRPC = new StainlessRPC(stainlessConode);

    const cfg = new Config(bevmInstance, stainlessRPC, bevmUser);

    return cfg;
  }

  protected static async getRosterToml(): Promise<string> {
    return await Config.getAsset(ROSTER_FILE);
  }

  protected static async getStainlessRosterToml(): Promise<string> {
    return await Config.getAsset(STAINLESS_ROSTER_FILE);
  }

  private static async getAsset(name: string): Promise<string> {
    const resp = await fetch(`assets/configs/${name}`);
    if (!resp.ok) {
      return Promise.reject(new Error(`Load ${name}: ${resp.status}`));
    }

    return await resp.text();
  }

  private static async getServerConfig(): Promise<any> {
    const configRaw = await Config.getAsset(BYZCOIN_CONFIG_FILE);
    const bevmConfigRaw = await Config.getAsset(BEVM_CONFIG_FILE);

    const configParsed = toml.parse(configRaw);
    const bevmConfigParsed = toml.parse(bevmConfigRaw);

    return {
      adminDarc: Buffer.from(configParsed.AdminDarc, "hex"),
      bevmInstanceID: Buffer.from(bevmConfigParsed.bevmInstanceID, "hex"),
      bevmUserID: bevmConfigParsed.bevmUserID
        ? Buffer.from(bevmConfigParsed.bevmUserID, "hex")
        : null,
      byzCoinID: Buffer.from(configParsed.ByzCoinID, "hex"),
      ephemeral: Buffer.from(configParsed.Ephemeral, "hex"),
    };
  }

  protected constructor(
    readonly bevmInstance: BEvmInstance,
    readonly stainlessRPC: StainlessRPC,
    readonly bevmUser: Signer
  ) {}
}
