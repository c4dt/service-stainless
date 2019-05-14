import { createHash } from "crypto";
import Long from "long";

import ByzCoinRPC from "@c4dt/cothority/byzcoin/byzcoin-rpc";
import ClientTransaction, { Argument, Instruction } from "@c4dt/cothority/byzcoin/client-transaction";
import Instance, { InstanceID } from "@c4dt/cothority/byzcoin/instance";
import Signer from "@c4dt/cothority/darc/signer";

export default class BevmInstance extends Instance {
    static readonly contractID = "bevm";
    static readonly commandTransaction = "transaction";
    static readonly argumentTx = "tx";

    /**
     * Generate the BEvm instance ID for a given darc ID
     *
     * @param buf Any buffer that is known to the caller
     * @returns the id as a buffer
     */
    static getInstanceID(buf: Buffer): InstanceID {
        const h = createHash("sha256");
        h.update(Buffer.from(BevmInstance.contractID));
        h.update(buf);
        return h.digest();
    }

    /**
     * Spawn a BEvm instance from a darc id
     *
     * @param bc        The RPC to use
     * @param darcID    The darc instance ID
     * @param signers   The list of signers for the transaction
     * @returns a promise that resolves with the new instance
     */
    static async spawn(
        bc: ByzCoinRPC,
        darcID: InstanceID,
        signers: Signer[],
    ): Promise<BevmInstance> {
        const inst = Instruction.createSpawn(
            darcID,
            BevmInstance.contractID,
            [],
        );
        await inst.updateCounters(bc, signers);

        const ctx = new ClientTransaction({instructions: [inst]});
        ctx.signWith([signers]);

        await bc.sendTransactionAndWait(ctx, 10);

        return BevmInstance.fromByzCoin(bc, inst.deriveId());
    }

    /**
     * Create returns a BevmInstance from the given parameters.
     * @param bc
     * @param bevmID
     * @param darcID
     */
    static create(
        bc: ByzCoinRPC,
        bevmID: InstanceID,
        darcID: InstanceID,
    ): BevmInstance {
        return new BevmInstance(bc, Instance.fromFields(bevmID, BevmInstance.contractID, darcID, Buffer.from("")));
    }

    /**
     * Initializes using an existing coinInstance from ByzCoin
     * @param bc    The RPC to use
     * @param iid   The instance ID
     * @returns a promise that resolves with the BEvm instance
     */
    static async fromByzCoin(bc: ByzCoinRPC, iid: InstanceID): Promise<BevmInstance> {
        return new BevmInstance(bc, await Instance.fromByzCoin(bc, iid));
    }

    constructor(private rpc: ByzCoinRPC, inst: Instance) {
        super(inst);
        if (inst.contractID.toString() !== BevmInstance.contractID) {
            throw new Error(`mismatch contract name: ${inst.contractID} vs ${BevmInstance.contractID}`);
        }
    }

    /**
     * * Execute a BEvm transaction.
     *
     * FIXME: document parameters
     */
    async transaction(signers: Signer[], gasLimit: Long, gasPrice: Long, amount: Long, /* etc */
                      wait?: number) {
        const tx = "My transaction";

        const inst = Instruction.createInvoke(
            this.id,
            BevmInstance.contractID,
            BevmInstance.commandTransaction,
            [new Argument({name: BevmInstance.argumentTx, value: Buffer.from(tx)})],
        );

        await inst.updateCounters(this.rpc, signers);

        const ctx = new ClientTransaction({instructions: [inst]});
        ctx.signWith([signers]);

        await this.rpc.sendTransactionAndWait(ctx, wait);
    }
}
