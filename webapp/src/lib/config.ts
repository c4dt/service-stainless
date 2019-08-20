import ByzCoinRPC from "@dedis/cothority/byzcoin/byzcoin-rpc";
import { InstanceID } from "@dedis/cothority/byzcoin/instance";
import Signer from "@dedis/cothority/darc/signer";
import SignerEd25519 from "@dedis/cothority/darc/signer-ed25519";
import { Roster } from "@dedis/cothority/network";

import toml from "toml";

import { BevmInstance } from "src/lib/bevm";
import { StainlessRPC } from "src/lib/stainless";

export class Config {

    static async init(): Promise<Config> {
        const rosterToml = await Config.getRosterToml();
        const roster = Roster.fromTOML(rosterToml);
        const stainlessConode = roster.list[0];

        const serverConfig = await Config.getServerConfig();

        const bc = await ByzCoinRPC.fromByzcoin(roster, serverConfig.byzCoinID);
        const bevmRPC = await BevmInstance.fromByzcoin(bc, serverConfig.bevmInstanceID);
        const bevmUser = SignerEd25519.fromBytes(serverConfig.bevmUserID);

        const stainlessRPC = new StainlessRPC(stainlessConode);
        bevmRPC.setStainlessRPC(stainlessRPC);

        const cfg = new Config(
            bc.genesisID,
            rosterToml,
            roster,
            bevmRPC,
            stainlessRPC,
            bevmUser,
        );

        return cfg;
    }

    protected static async getRosterToml(): Promise<string> {
        return await Config.getAsset("conodes_bevm.toml");
    }

    private static async getAsset(name: string): Promise<string> {
        const resp = await fetch(`assets/${name}`);
        if (!resp.ok) {
            return Promise.reject(new Error(`Load ${name}: ${resp.status}`));
        }

        return await resp.text();
    }

    private static async getServerConfig(): Promise<any> {
        const configRaw = await Config.getAsset("config.toml");
        const bevmConfigRaw = await Config.getAsset("config_bevm.toml");

        const configParsed = toml.parse(configRaw);
        const bevmConfigParsed = toml.parse(bevmConfigRaw);

        return {
            adminDarc: Buffer.from(configParsed.AdminDarc, "hex"),
            bevmInstanceID: Buffer.from(bevmConfigParsed.bevmInstanceID, "hex"),
            bevmUserID: Buffer.from(bevmConfigParsed.bevmUserID, "hex"),
            byzCoinID: Buffer.from(configParsed.ByzCoinID, "hex"),
            ephemeral: Buffer.from(configParsed.Ephemeral, "hex"),
        };
    }

    protected constructor(
        readonly genesisBlock: InstanceID,
        readonly rosterToml: string,
        readonly roster: Roster,
        readonly bevmRPC: BevmInstance,
        readonly stainlessRPC: StainlessRPC,
        readonly bevmUser: Signer,
    ) {}
}
