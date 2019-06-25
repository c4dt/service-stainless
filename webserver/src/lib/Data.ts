import ByzCoinRPC from "@c4dt/cothority/byzcoin/byzcoin-rpc";
import { InstanceID } from "@c4dt/cothority/byzcoin/instance";
import Darc from "@c4dt/cothority/darc/darc";
import Signer from "@c4dt/cothority/darc/signer";
import SignerEd25519 from "@c4dt/cothority/darc/signer-ed25519";
import { Roster } from "@c4dt/cothority/network";

import Long from "long";
// import * as serverConfig from "src/config";

import { BevmInstance } from "src/lib/bevm";
import StainlessRPC from "src/lib/stainless/stainless-rpc";

export class Config {

    static async getRosterToml(): Promise<string> {
        const resp = await fetch(window.location.origin + "/assets/conodes.toml");
        if (!resp.ok) {
            return Promise.reject(new Error(`Load roster: ${resp.status}`));
        }
        const rosterToml = await resp.text();

        return rosterToml;
    }

    static async init(): Promise<Config> {
        const rosterToml = await Config.getRosterToml();
        const roster = Roster.fromTOML(rosterToml);

        const admin = SignerEd25519.random();

        const darc = ByzCoinRPC.makeGenesisDarc([admin], roster, "genesis darc");
        [
            "spawn:bevm",
            "invoke:bevm.credit",
            "invoke:bevm.transaction",
        ].forEach((rule) => {
            darc.rules.appendToRule(rule, admin, "|");
        });

        const bc = await ByzCoinRPC.newByzCoinRPC(roster, darc, Long.fromNumber(5e8));

        const stainlessRPC = new StainlessRPC(roster.list[0]);
        const bevmRPC = await BevmInstance.spawn(bc, darc.getBaseID(), [admin]);
        bevmRPC.setStainlessRPC(stainlessRPC);

        const cfg = new Config();
        cfg.genesisBlock = bc.genesisID;
        cfg.admin = admin;
        cfg.darc = darc;
        cfg.rosterToml = rosterToml;
        cfg.roster = roster;
        cfg.bevmRPC = bevmRPC;
        cfg.stainlessRPC = stainlessRPC;

        return cfg;
    }

    genesisBlock: InstanceID;
    admin: Signer;
    darc: Darc;
    rosterToml: string;
    roster: Roster;
    bevmRPC: BevmInstance;
    stainlessRPC: StainlessRPC;
}
