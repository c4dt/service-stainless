import Log from "@c4dt/cothority/log";
import { ServerIdentity } from "@c4dt/cothority/network/proto";

import { WebSocketConnection } from "src/lib/connections";
import { stainless as proto } from "src/lib/proto";

/**
 * RPC to talk with the stainless service of the conodes
 */
export default class StainlessRPC {
    static serviceName = "Stainless";

    private serviceAddress: string;

    constructor(srvid: ServerIdentity) {
        this.serviceAddress = srvid.getWebSocketAddress() + "/" + StainlessRPC.serviceName;
    }

    async verify(sourceFiles: { [_: string]: string }): Promise<proto.VerificationResponse> {
        // this.conn.setTimeout(this.timeout);
        const conn = new WebSocketConnection(this.serviceAddress + "/VerificationRequest");

        Log.lvl2("Sending Stainless verification request...");

        const msg = proto.VerificationRequest.encode(
            new proto.VerificationRequest({SourceFiles: sourceFiles})).finish();

        await conn.sendmsg(msg);

        const resp = await conn.recvmsg();

        return proto.VerificationResponse.decode(resp);

        // return this.conn.send(new proto.VerificationRequest({sourceFiles}), proto.VerificationResponse);
    }

    async genBytecode(sourceFiles: { [_: string]: string }): Promise<proto.BytecodeGenResponse> {
        const conn = new WebSocketConnection(this.serviceAddress + "/BytecodeGenRequest");

        Log.lvl2("Sending Stainless bytecode generation request...");

        const msg = proto.BytecodeGenRequest.encode(
            new proto.BytecodeGenRequest({SourceFiles: sourceFiles})).finish();

        await conn.sendmsg(msg);

        const resp = await conn.recvmsg();

        return proto.BytecodeGenResponse.decode(resp);
    }

    async deployContract(gasLimit: number, gasPrice: number, amount: number, nonce: number, bytecode: Buffer,
                         abi: string, args: string[]): Promise<proto.TransactionHashResponse> {
        const conn = new WebSocketConnection(this.serviceAddress + "/DeployRequest");

        Log.lvl2("Sending Stainless deploy contract request...");

        const msg = proto.DeployRequest.encode(
            new proto.DeployRequest({GasLimit: gasLimit, GasPrice: gasPrice, Amount: amount,
                                    Nonce: nonce, Bytecode: bytecode, Abi: abi, Args: args})).finish();

        await conn.sendmsg(msg);

        const resp = await conn.recvmsg();

        return proto.TransactionHashResponse.decode(resp);
    }

    async executeTransaction(gasLimit: number, gasPrice: number, amount: number, contractAddress: Buffer, nonce: number,
                             abi: string, method: string, args: string[]): Promise<proto.TransactionHashResponse> {
        const conn = new WebSocketConnection(this.serviceAddress + "/TransactionRequest");

        Log.lvl2("Sending Stainless transaction execution request...");

        const msg = proto.TransactionRequest.encode(
            new proto.TransactionRequest({GasLimit: gasLimit, GasPrice: gasPrice, Amount: amount,
                                         ContractAddress: contractAddress, Nonce: nonce,
                                         Abi: abi, Method: method, Args: args})).finish();

        await conn.sendmsg(msg);

        const resp = await conn.recvmsg();

        return proto.TransactionHashResponse.decode(resp);
    }

    async finalizeTransaction(transaction: Buffer, signature: Buffer): Promise<proto.TransactionResponse> {
        const conn = new WebSocketConnection(this.serviceAddress + "/TransactionFinalizationRequest");

        Log.lvl2("Sending Stainless transaction finalization request...");

        const msg = proto.TransactionFinalizationRequest.encode(
            new proto.TransactionFinalizationRequest({Transaction: transaction, Signature: signature})).finish();

        await conn.sendmsg(msg);

        const resp = await conn.recvmsg();

        return proto.TransactionResponse.decode(resp);
    }

    async call(blockId: Buffer, serverConfig: string, bevmInstanceId: Buffer, accountAddress: Buffer,
               contractAddress: Buffer, abi: string, method: string, args: string[]): Promise<proto.CallResponse> {
        const conn = new WebSocketConnection(this.serviceAddress + "/CallRequest");

        Log.lvl2("Sending Stainless call request...");

        const msg = proto.CallRequest.encode(
            new proto.CallRequest({BlockID: blockId, ServerConfig: serverConfig, BEvmInstanceID: bevmInstanceId,
                                  AccountAddress: accountAddress, ContractAddress: contractAddress,
                                  Abi: abi, Method: method, Args: args})).finish();

        await conn.sendmsg(msg);

        const resp = await conn.recvmsg();

        return proto.CallResponse.decode(resp);
    }
}
