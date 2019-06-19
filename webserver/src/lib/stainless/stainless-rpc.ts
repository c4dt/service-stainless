import { Log } from "@c4dt/cothority/log";
import { IConnection, WebSocketConnection } from "@c4dt/cothority/network/connection";
import { ServerIdentity } from "@c4dt/cothority/network/proto";

import { BytecodeGenRequest, BytecodeGenResponse,
    DeployRequest, TransactionRequest, TransactionHashResponse,
    TransactionFinalizationRequest, TransactionResponse,
    VerificationRequest, VerificationResponse,
    CallRequest, CallResponse,
} from "./proto";

/**
 * RPC to talk with the stainless service of the conodes
 */
export default class StainlessRPC {
    static serviceName = "Stainless";

    private conn: IConnection;
    private timeout: number;

    constructor(srvid: ServerIdentity) {
        this.timeout = 60 * 1000;

        this.conn = new WebSocketConnection(srvid.getWebSocketAddress(),
                                            StainlessRPC.serviceName);
    }

    /**
     * Set a new timeout value for the next requests
     * @param value Timeout in ms
     */
    setTimeout(value: number): void {
        this.timeout = value;
    }

    async verify(sourceFiles: { [_: string]: string }): Promise<VerificationResponse> {
        this.conn.setTimeout(this.timeout);

        Log.lvl2("Sending Stainless verification request...");

        return this.conn.send(new VerificationRequest({sourceFiles}), VerificationResponse);
    }

    async genBytecode(sourceFiles: { [_: string]: string }): Promise<BytecodeGenResponse> {
        this.conn.setTimeout(this.timeout);

        Log.lvl2("Sending Stainless bytecode generation request...");

        return this.conn.send(new BytecodeGenRequest({sourceFiles}), BytecodeGenResponse);
    }

    async deployContract(gasLimit: number, gasPrice: number, amount: number, nonce: number, bytecode: Buffer,
                         abi: string, args: string[]): Promise<TransactionHashResponse> {
        this.conn.setTimeout(this.timeout);

        Log.lvl2("Sending Stainless deploy contract request...");

        return this.conn.send(new DeployRequest(
            {gasLimit, gasPrice, amount, nonce, bytecode, abi, args}), TransactionHashResponse);
    }

    async executeTransaction(gasLimit: number, gasPrice: number, amount: number, contractAddress: Buffer, nonce: number,
                             abi: string, method: string, args: string[]): Promise<TransactionHashResponse> {
        this.conn.setTimeout(this.timeout);

        Log.lvl2("Sending Stainless transaction execution request...");

        return this.conn.send(new TransactionRequest(
            {gasLimit, gasPrice, amount, contractAddress, nonce, abi, method, args}), TransactionHashResponse);
    }

    async finalizeTransaction(transaction: Buffer, signature: Buffer): Promise<TransactionResponse> {
        this.conn.setTimeout(this.timeout);

        Log.lvl2("Sending Stainless transaction finalization request...");

        return this.conn.send(new TransactionFinalizationRequest({transaction, signature}), TransactionResponse);
    }

    async call(blockId: Buffer, serverConfig: string, bevmInstanceId: Buffer, accountAddress: Buffer,
               contractAddress: Buffer, abi: string, method: string, args: string[]): Promise<CallResponse> {
        this.conn.setTimeout(this.timeout);

        Log.lvl2("Sending Stainless call request...");

        return this.conn.send(new CallRequest(
            {blockId, serverConfig, bevmInstanceId, accountAddress, contractAddress, abi, method, args}), CallResponse);
    }
}
