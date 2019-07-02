import ByzCoinRPC from "@dedis/cothority/byzcoin/byzcoin-rpc";
import { InstanceID } from "@dedis/cothority/byzcoin/instance";
import Darc from "@dedis/cothority/darc/darc";
import Signer from "@dedis/cothority/darc/signer";
import SignerEd25519 from "@dedis/cothority/darc/signer-ed25519";
import { Roster } from "@dedis/cothority/network";

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
        const rosterToml = await TestConfig.getRosterToml();
        const roster = Roster.fromTOML(rosterToml);
        const stainlessConode = roster.list[0];

        // const bevmAdmin = SignerEd25519.fromBytes(
        //     Buffer.from("df9cf2868119860ed5c195e8937f8be8d5529c16d0dcdd0252f26414e2957c03", "hex"));
        const bevmUser = SignerEd25519.fromBytes(
            Buffer.from("7cc0629feeb9cb433b8dd7beb536da23896a8fb8218bc992dfea2181c935110f", "hex"));
        // const bevmDarcID = Buffer.from("21711bdd44125b5a617f665c40f1fe1d19279df261866887e61a32ad46c5d05c", "hex");

        const byzcoinID = Buffer.from("5ba70e7dd82ce12caa3d9f59be674d66a8651e21e1581cada59abe659f335926", "hex");
        const bc = await ByzCoinRPC.fromByzcoin(roster, byzcoinID);

        // const bevmRPC = await BevmInstance.spawn(bc, bevmDarcID, [bevmAdmin]);
        const bevmInstanceID = Buffer.from("3269132fa39a98196716fef313f713c991edfdc4b19c5d0ff142f74d0b552caa", "hex");

        const bevmRPC = await BevmInstance.fromByzcoin(bc, bevmInstanceID);

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

export class TestConfig extends Config {

    static async init(): Promise<Config> {
        const rosterToml = await TestConfig.getRosterToml();
        const roster = Roster.fromTOML(rosterToml);
        const stainlessConode = roster.list[0];

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
