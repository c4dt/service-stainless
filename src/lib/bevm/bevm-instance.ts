import { createHash } from "crypto";
import Long from "long";

import ByzCoinRPC from "@c4dt/cothority/byzcoin/byzcoin-rpc";
import ClientTransaction, { Argument, Instruction } from "@c4dt/cothority/byzcoin/client-transaction";
import Instance, { InstanceID } from "@c4dt/cothority/byzcoin/instance";
import Signer from "@c4dt/cothority/darc/signer";
import { Log } from "@c4dt/cothority/log";

import Keccak from "keccak";

import EC from "elliptic/lib/elliptic/ec";

export class EvmAccount {
    static ec = new EC("secp256k1");

    private static computeAddress(key) {
        // Marshal public key to binary
        const pubBytes = Buffer.from(key.getPublic("hex"), "hex");

        const h = new Keccak("keccak256");
        h.update(pubBytes.slice(1));

        const address = h.digest().slice(12);
        Log.llvl2("Computed address", address);

        return address;
    }

    readonly address: Buffer;
    private key;
    private nonce: number = 0;

    constructor(privKey: Buffer) {
        this.key = EvmAccount.ec.keyFromPrivate(privKey.toString("hex"));

        this.address = EvmAccount.computeAddress(this.key);
    }

    sign(hash: Buffer): Buffer {
        const sig = this.key.sign(hash);

        const r = Buffer.from(sig.r.toArray("be"));
        const s = Buffer.from(sig.s.toArray("be"));

        const len = r.length + s.length + 1;

        const buf = Buffer.concat([r, s], len);
        buf.writeUInt8(sig.recoveryParam, len - 1);

        return buf;
    }

    incNonce() {
        this.nonce += 1;
    }
}

export class EvmContract {
    readonly bytecode: string;
    readonly abi: string;
    private address: Buffer = undefined;

    constructor(bytecode: string, abi: string) {
        this.bytecode = bytecode;
        this.abi = abi;
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

        const ctx = new ClientTransaction({instructions: [inst]});
        await ctx.updateCountersAndSign(bc, [signers]);

        await bc.sendTransactionAndWait(ctx);

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
    async deploy(signers: Signer[], gasLimit: Long, gasPrice: Long, amount: Long,
                 account: EvmAccount, contract: EvmContract, args?: string[],
                 wait?: number) {
        // byte[] ethTxHash = BevmService.MakeDeployTx(gasLimit, gasPrice, amount, account.nonce,
                       // contract.bytecode, contract.abi, args)
        // byte[] signedEthTx = signTx(ethTxHash, account.privKey)
        // byte[] tx = BevmService.FinalizeTx(signedEthTx)
        // After successful transaction: incrememt account.nonce

        /* tslint:disable:max-line-length */
        const tx = Buffer.from("7b226e6f6e6365223a22307830222c226761735072696365223a22307831222c22676173223a223078393839363830222c22746f223a6e756c6c2c2276616c7565223a22307830222c22696e707574223a22307836303830363034303532333438303135363130303130353736303030383066643562353036303430353136303230383036313031636238333339383130313830363034303532383130313930383038303531393036303230303139303932393139303530353035303830363030303831393035353530383036303031383139303535353036303030363030323831393035353530353036313031373238303631303035393630303033393630303066333030363038303630343035323630303433363130363130303463353736303030333537633031303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303039303034363366666666666666663136383036336131666632663532313436313030353135373830363365613331396632383134363130303765353735623630303038306664356233343830313536313030356435373630303038306664356235303631303037633630303438303336303338313031393038303830333539303630323030313930393239313930353035303530363130306139353635623030356233343830313536313030386135373630303038306664356235303631303039333631303133633536356236303430353138303832383135323630323030313931353035303630343035313830393130333930663335623630303135343831313131353135313536313031323335373630343035313766303863333739613030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303831353236303034303138303830363032303031383238313033383235323630303538313532363032303031383037663635373237323666373230303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303038313532353036303230303139313530353036303430353138303931303339306664356238303630303135343033363030313831393035353530383036303032353430313630303238313930353535303530353635623630303036303031353439303530393035363030613136353632376137613732333035383230373732316134356631376330653066353765323535663333353735323831643137663161393064336435386235313638383233306439336334363061313961613030323930303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303634222c2276223a2230783163222c2272223a22307865366566666631303737666533396636613862336539646361366632343632643264333261613531653931316137643761626438373431646136623039623965222c2273223a22307833356331383465633139336166343235386263363033636432306234386365623266663933313737343237343165396334653865393764666531643664333964222c2268617368223a22307833383238366135373532333738626565666637616562333139316265386236353137333430646132643539316131393735656333366165626635383437373537227d", "hex");
        /* tslint:enable:max-line-length */

        await this.invoke(
            BevmInstance.commandTransaction, [
                new Argument({name: BevmInstance.argumentTx, value: tx}),
            ],
            signers, wait);

        // Compute contract.address with account.address and account.nonce
        // Increment account.nonce
    }

    /**
     * * Execute a BEvm transaction.
     *
     * FIXME: document parameters
     */
    async transaction(signers: Signer[], gasLimit: Long, gasPrice: Long, amount: Long,
                      account: EvmAccount, contract: EvmContract, method: string, args?: string[],
                      wait?: number) {
        // byte[] ethTxHash = BevmService.MakeTransactionTx(gasLimit, gasPrice, amount, account.nonce,
                       // contract.address, contract.abi, method, args)
        // byte[] signedEthTx = signTx(ethTxHash, account.privKey)
        // byte[] tx = BevmService.FinalizeTx(signedEthTx)
        // After successful transaction: incrememt account.nonce

        /* tslint:disable:max-line-length */
        const tx = Buffer.from("7b226e6f6e6365223a22307831222c226761735072696365223a22307831222c22676173223a223078393839363830222c22746f223a22307838636461663063643235393838373235386263313361393263306136646139323639383634346330222c2276616c7565223a22307830222c22696e707574223a223078613166663266353230303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303030303061222c2276223a2230783163222c2272223a22307861613062323433653461643937623663623763326130313635363761613032623265376265643135396332323162373038396236303638383532376636653838222c2273223a22307836373963396466636231636562323437376133363735333634356235363463326131346137626337353766343662396237313463343961346339336561306134222c2268617368223a22307834633966336134343361663030326438373839666235616239393261376631346639396134303762616532613332643464653830313037366365613065353631227d", "hex");
        /* tslint:enable:max-line-length */

        await this.invoke(
            BevmInstance.commandTransaction, [
                new Argument({name: BevmInstance.argumentTx, value: tx}),
            ],
            signers, wait);
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
