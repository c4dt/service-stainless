import { createHash } from "crypto";
import EC from "elliptic/lib/elliptic/ec";
import Keccak from "keccak";

import ByzCoinRPC from "@dedis/cothority/byzcoin/byzcoin-rpc";
import ClientTransaction, { Argument, Instruction } from "@dedis/cothority/byzcoin/client-transaction";
import Instance, { InstanceID } from "@dedis/cothority/byzcoin/instance";
import Signer from "@dedis/cothority/darc/signer";
import Log from "@dedis/cothority/log";

import { StainlessRPC } from "src/lib/stainless";

export class EvmAccount {
    static ec = new EC("secp256k1");

    private static computeAddress(key) {
        // Marshal public key to binary
        const pubBytes = Buffer.from(key.getPublic("hex"), "hex");

        const h = new Keccak("keccak256");
        h.update(pubBytes.slice(1));

        const address = h.digest().slice(12);
        Log.llvl2("Computed account address", address);

        return address;
    }

    readonly address: Buffer;
    private _nonce: number = 0;
    private key;

    get nonce() {
        return this._nonce;
    }

    constructor(privKey: Buffer) {
        this.key = EvmAccount.ec.keyFromPrivate(privKey.toString("hex"));

        this.address = EvmAccount.computeAddress(this.key);
    }

    sign(hash: Buffer): Buffer {
        /* The "canonical" option is crucial to have the same signature as Ethereum */
        const sig = this.key.sign(hash, {canonical: true});

        const r = Buffer.from(sig.r.toArray("be", 32));
        const s = Buffer.from(sig.s.toArray("be", 32));

        const len = r.length + s.length + 1;

        const buf = Buffer.concat([r, s], len);
        buf.writeUInt8(sig.recoveryParam, len - 1);

        return buf;
    }

    incNonce() {
        this._nonce += 1;
    }
}

export class EvmContract {
    private static computeAddress(data: Buffer, nonce: number): Buffer {
        const buf = EvmContract.erlEncode(data, nonce);

        const h = new Keccak("keccak256");
        h.update(buf);

        const address = h.digest().slice(12);
        Log.llvl2("Computed contract address", address);

        return address;
    }

    private static erlEncode(address: Buffer, nonce: number): Buffer {
        const bufNonce = Buffer.alloc(8);
        bufNonce.writeUInt32BE(nonce / (2 ** 32), 0);
        bufNonce.writeUInt32BE(nonce % (2 ** 32), 4);
        let size = 8;
        for (let i = 0; (i < 8) && (bufNonce[i] === 0); i++) {
            size--;
        }

        const addressLen = address.length + 1;
        const nonceLen = (nonce < 128 ? 1 : size + 1);

        const buf = Buffer.alloc(1 + addressLen + nonceLen);
        let pos = 0;

        buf.writeUInt8(0xc0 + addressLen + nonceLen, pos++);

        buf.writeUInt8(0x80 + address.length, pos++);
        address.copy(buf, 2);
        pos += address.length;

        if ((nonce === 0) || (nonce >= 128)) {
            buf.writeUInt8(0x80 + size, pos++);
        }

        bufNonce.copy(buf, pos, 8 - size);

        return buf;
    }

    readonly bytecode: Buffer;
    readonly abi: string;
    private _address: Buffer = undefined;

    get address(): Buffer {
        return this._address;
    }

    constructor(bytecode: Buffer, abi: string) {
        this.bytecode = bytecode;
        this.abi = abi;
    }

    setAddress(account: EvmAccount) {
        this._address = EvmContract.computeAddress(account.address, account.nonce);
    }
}

export class BevmInstance extends Instance {
    static readonly contractID = "bevm";

    static readonly commandTransaction = "transaction";
    static readonly argumentTx = "tx";

    static readonly commandCredit = "credit";
    static readonly argumentAddress = "address";
    static readonly argumentAmount = "amount";

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
    static async spawn(bc: ByzCoinRPC, darcID: InstanceID, signers: Signer[]): Promise<BevmInstance> {
        const inst = Instruction.createSpawn(
            darcID,
            BevmInstance.contractID,
            [],
        );

        const ctx = new ClientTransaction({instructions: [inst]});
        await ctx.updateCountersAndSign(bc, [signers]);

        await bc.sendTransactionAndWait(ctx);

        return BevmInstance.fromByzcoin(bc, inst.deriveId());
    }

    /**
     * Create returns a BevmInstance from the given parameters.
     * @param bc
     * @param bevmID
     * @param darcID
     */
    static create(bc: ByzCoinRPC, bevmID: InstanceID, darcID: InstanceID): BevmInstance {
        return new BevmInstance(bc, new Instance({id: bevmID, contractID: BevmInstance.contractID,
                                                 darcID, data: Buffer.from("")}));
    }

    /**
     * Initializes using an existing coinInstance from ByzCoin
     * @param bc    The RPC to use
     * @param iid   The instance ID
     * @returns a promise that resolves with the BEvm instance
     */
    static async fromByzcoin(bc: ByzCoinRPC, iid: InstanceID): Promise<BevmInstance> {
        return new BevmInstance(bc, await Instance.fromByzcoin(bc, iid));
    }

    private stainlessRPC: StainlessRPC;

    constructor(private rpc: ByzCoinRPC, inst: Instance) {
        super(inst);
        if (inst.contractID.toString() !== BevmInstance.contractID) {
            throw new Error(`mismatch contract name: ${inst.contractID} vs ${BevmInstance.contractID}`);
        }
    }

    setStainlessRPC(rpc: StainlessRPC) {
        this.stainlessRPC = rpc;
    }

    /**
     * * Execute a BEvm transaction.
     *
     * FIXME: document parameters
     */
    async deploy(signers: Signer[], gasLimit: number, gasPrice: number, amount: number,
                 account: EvmAccount, contract: EvmContract, args?: string[],
                 wait?: number) {
        const unsignedTx = await this.stainlessRPC.deployContract(gasLimit, gasPrice, amount, account.nonce,
                                                                  contract.bytecode, contract.abi, args);
        const signature = account.sign(Buffer.from(unsignedTx.TransactionHash));
        const signedTx = await this.stainlessRPC.finalizeTransaction(Buffer.from(unsignedTx.Transaction), signature);

        await this.invoke(
            BevmInstance.commandTransaction, [
                new Argument({name: BevmInstance.argumentTx, value: Buffer.from(signedTx.Transaction)}),
            ],
            signers, wait);

        contract.setAddress(account);
        account.incNonce();
    }

    /**
     * * Execute a BEvm transaction.
     *
     * FIXME: document parameters
     */
    async transaction(signers: Signer[], gasLimit: number, gasPrice: number, amount: number,
                      account: EvmAccount, contract: EvmContract, method: string, args?: string[],
                      wait?: number) {
        const unsignedTx = await this.stainlessRPC.executeTransaction(gasLimit, gasPrice, amount,
                                                                      contract.address, account.nonce,
                                                                      contract.abi, method, args);
        const signature = account.sign(Buffer.from(unsignedTx.TransactionHash));
        const signedTx = await this.stainlessRPC.finalizeTransaction(Buffer.from(unsignedTx.Transaction), signature);

        await this.invoke(
            BevmInstance.commandTransaction, [
                new Argument({name: BevmInstance.argumentTx, value: Buffer.from(signedTx.Transaction)}),
            ],
            signers, wait);

        account.incNonce();
    }

    /**
     * * Execute a BEvm transaction.
     *
     * FIXME: document parameters
     */
    async call(blockId: Buffer, serverConfig: string, bevmInstanceId: Buffer,
               account: EvmAccount, contract: EvmContract, method: string, args?: string[]): Promise<any> {
        const response = await this.stainlessRPC.call(blockId, serverConfig, bevmInstanceId,
                                                      account.address, contract.address,
                                                      contract.abi, method, args);

        return JSON.parse(response.Result);
    }

    async creditAccount(signers: Signer[], address: Buffer, amount: Buffer, wait?: number) {
        await this.invoke(
            BevmInstance.commandCredit, [
                new Argument({name: BevmInstance.argumentAddress, value: address}),
                new Argument({name: BevmInstance.argumentAmount, value: amount}),
            ],
            signers, wait);
    }

    private async invoke(command: string, args: Argument[], signers: Signer[], wait?: number) {
        const ctx = new ClientTransaction({
            instructions: [
                Instruction.createInvoke(
                    this.id, BevmInstance.contractID, command, args,
                ),
            ]});

        await ctx.updateCountersAndSign(this.rpc, [signers]);

        await this.rpc.sendTransactionAndWait(ctx, wait);
    }
}
