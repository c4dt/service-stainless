import ByzCoinRPC from "@c4dt/cothority/byzcoin/byzcoin-rpc";
import Darc from "@c4dt/cothority/darc/darc";
import Signer from "@c4dt/cothority/darc/signer";
import SignerEd25519 from "@c4dt/cothority/darc/signer-ed25519";
import Long from "long";
import { activateTesting, Defaults } from "./Defaults";

export class Config {

    static async init(): Promise<Config> {
        activateTesting();

        const roster = Defaults.Roster;
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
        Defaults.ByzCoinID = bc.genesisID;

        const td = new Config();
        td.bc = bc;
        td.admin = admin;
        td.darc = darc;

        return td;
    }

    bc: ByzCoinRPC = null;
    admin: Signer;
    darc: Darc;
}
