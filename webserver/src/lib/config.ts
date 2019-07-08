import ByzCoinRPC from "@dedis/cothority/byzcoin/byzcoin-rpc";
import { InstanceID } from "@dedis/cothority/byzcoin/instance";
import Signer from "@dedis/cothority/darc/signer";
import SignerEd25519 from "@dedis/cothority/darc/signer-ed25519";
import { Roster } from "@dedis/cothority/network";

import * as serverConfig from "src/config";
import * as serverBevmConfig from "src/config_bevm";

import { BevmInstance } from "src/lib/bevm";
import { StainlessRPC } from "src/lib/stainless";

export class Config {

    static async getRosterToml(baseHref: string): Promise<string> {
        const resp = await fetch(baseHref + "/assets/conodes_bevm.toml");
        if (!resp.ok) {
            return Promise.reject(new Error(`Load roster: ${resp.status}`));
        }
        const rosterToml = await resp.text();

        return rosterToml;
    }

    static async init(): Promise<Config> {
        const rosterToml = await Config.getRosterToml(window.location.href);
        const roster = Roster.fromTOML(rosterToml);
        const stainlessConode = roster.list[0];

        const bc = await ByzCoinRPC.fromByzcoin(roster, serverConfig.ByzCoinID);
        const bevmRPC = await BevmInstance.fromByzcoin(bc, serverBevmConfig.bevmInstanceID);
        const bevmUser = SignerEd25519.fromBytes(serverBevmConfig.bevmUserID);

        const stainlessRPC = new StainlessRPC(stainlessConode);
        bevmRPC.setStainlessRPC(stainlessRPC);

        const cfg = new Config();

        cfg.genesisBlock = bc.genesisID;
        cfg.rosterToml = rosterToml;
        cfg.roster = roster;
        cfg.bevmRPC = bevmRPC;
        cfg.stainlessRPC = stainlessRPC;
        cfg.bevmUser = bevmUser;

        return cfg;
    }

    genesisBlock: InstanceID;
    rosterToml: string;
    roster: Roster;
    bevmRPC: BevmInstance;
    stainlessRPC: StainlessRPC;
    bevmUser: Signer;
}
