import Log from "@dedis/cothority/log";
import { ServerIdentity } from "@dedis/cothority/network/proto";

import { WebSocketConnection } from "src/lib/connections";
import { stainless as proto } from "src/lib/proto";

/**
 * RPC talking with the Stainless service.
 */
export class StainlessRPC {
    static serviceName = "Stainless";

    private serviceAddress: string;

    constructor(srvid: ServerIdentity) {
        this.serviceAddress = srvid.getWebSocketAddress() + "/" + StainlessRPC.serviceName;
    }

    async verify(sourceFiles: { [_: string]: string }): Promise<proto.VerificationResponse> {
        const conn = new WebSocketConnection(this.serviceAddress + "/VerificationRequest");

        Log.lvl2("Sending Stainless verification request...");

        const msg = proto.VerificationRequest.encode(
            new proto.VerificationRequest({
                SourceFiles: sourceFiles,
            })).finish();

        await conn.sendmsg(msg);

        const resp = await conn.recvmsg();

        return proto.VerificationResponse.decode(resp);
    }

    async genBytecode(sourceFiles: { [_: string]: string }): Promise<proto.BytecodeGenResponse> {
        const conn = new WebSocketConnection(this.serviceAddress + "/BytecodeGenRequest");

        Log.lvl2("Sending Stainless bytecode generation request...");

        const msg = proto.BytecodeGenRequest.encode(
            new proto.BytecodeGenRequest({
                SourceFiles: sourceFiles,
            })).finish();

        await conn.sendmsg(msg);

        const resp = await conn.recvmsg();

        return proto.BytecodeGenResponse.decode(resp);
    }
}
