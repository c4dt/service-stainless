import { Log } from "@c4dt/cothority/log";
import { IConnection, WebSocketConnection } from "@c4dt/cothority/network/connection";
import { ServerIdentity } from "@c4dt/cothority/network/proto";

import { BytecodeGenRequest, BytecodeGenResponse, VerificationRequest, VerificationResponse } from "./proto";

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
}
