import { registerMessage } from "@c4dt/cothority/protobuf";
import { Message, Properties } from "protobufjs/light";

export class VerificationRequest extends Message<VerificationRequest> {
    static register() {
        registerMessage("stainless.VerificationRequest", VerificationRequest);
    }

    readonly sourceFiles: { [fileName: string]: string; };

    constructor(props?: Properties<VerificationRequest>) {
        super(props);

        this.sourceFiles = this.sourceFiles || {};

        /* Protobuf aliases */
        Object.defineProperty(this, "sourcefiles", {
            get(): { [fileName: string]: string; } {
                return this.sourceFiles;
            },
            set(value: { [fileName: string]: string; }) {
                this.sourceFiles = value;
            },
        });
    }

    toString(): string {
        return Object.keys(this.sourceFiles).sort().map(
            (k) => `${k} --> ${this.sourceFiles[k]}`
        ).join("\n");
    }
}

export class VerificationResponse extends Message<VerificationResponse> {
    static register() {
        registerMessage("stainless.VerificationResponse", VerificationResponse);
    }

    readonly console: string;
    readonly report: string;

    constructor(props?: Properties<VerificationRequest>) {
        super(props);
    }
}

export class BytecodeGenRequest extends Message<BytecodeGenRequest> {
    static register() {
        registerMessage("stainless.BytecodeGenRequest", BytecodeGenRequest);
    }

    readonly sourceFiles: { [_: string]: string; };

    constructor(props?: Properties<BytecodeGenRequest>) {
        super(props);

        this.sourceFiles = this.sourceFiles || {};

        /* Protobuf aliases */
        Object.defineProperty(this, "sourcefiles", {
            get(): { [_: string]: string; } {
                return this.sourceFiles;
            },
            set(value: { [_: string]: string; }) {
                this.sourceFiles = value;
            },
        });
    }

    toString(): string {
        return Object.keys(this.sourceFiles).sort().map(
            (k) => `${k} --> ${this.sourceFiles[k]}`
        ).join("\n");
    }
}

export class BytecodeObj extends Message<BytecodeObj> {
    static register() {
        registerMessage("stainless.BytecodeObj", BytecodeObj);
    }

    readonly abi: string;
    readonly bin: string;

    constructor(props?: Properties<BytecodeObj>) {
        super(props);
    }

    toString(): string {
        return `ABI: ${this.abi}\nBIN: ${this.bin}`;
    }
}

export class BytecodeGenResponse extends Message<BytecodeGenResponse> {
    static register() {
        registerMessage("stainless.BytecodeGenResponse", BytecodeGenResponse,
                        BytecodeObj);
    }

    readonly bytecodeObjs: { [_: string]: BytecodeObj; };

    constructor(props?: Properties<BytecodeGenResponse>) {
        super(props);

        this.bytecodeObjs = this.bytecodeObjs || {};

        /* Protobuf aliases */
        Object.defineProperty(this, "bytecodeobjs", {
            get(): { [_: string]: string; } {
                return this.bytecodeObjs;
            },
            set(value: { [_: string]: string; }) {
                this.bytecodeObjs = value;
            },
        });
    }

    toString(): string {
        return Object.keys(this.bytecodeObjs).sort().map(
            (k) => `${k} --> ${this.bytecodeObjs[k]}`
        ).join("\n");
    }
}

export class DeployRequest extends Message<DeployRequest> {
    static register() {
        registerMessage("stainless.DeployRequest", DeployRequest);
    }

    readonly gasLimit: number;
    readonly gasPrice: number;
    readonly amount: number;
    readonly nonce: number;
    readonly bytecode: Buffer;
    readonly abi: string;
    readonly args: string[];
}

export class TransactionRequest extends Message<TransactionRequest> {
    static register() {
        registerMessage("stainless.TransactionRequest", TransactionRequest);
    }

    readonly gasLimit: number;
    readonly gasPrice: number;
    readonly amount: number;
    readonly contractAddress: Buffer;
    readonly nonce: number;
    readonly abi: string;
    readonly method: string;
    readonly args: string[];
}

export class TransactionHashResponse extends Message<TransactionHashResponse> {
    static register() {
        registerMessage("stainless.TransactionHashResponse", TransactionHashResponse);
    }

    readonly transaction: Buffer;
    readonly transactionHash: Buffer;
}

export class TransactionFinalizationRequest extends Message<TransactionFinalizationRequest> {
    static register() {
        registerMessage("stainless.TransactionFinalizationRequest", TransactionFinalizationRequest);
    }

    readonly transaction: Buffer;
    readonly signature: Buffer;
}

export class TransactionResponse extends Message<TransactionResponse> {
    static register() {
        registerMessage("stainless.TransactionResponse", TransactionResponse);
    }

    readonly transaction: Buffer;
}

VerificationRequest.register();
VerificationResponse.register();
BytecodeGenRequest.register();
BytecodeGenResponse.register();
DeployRequest.register();
TransactionRequest.register();
TransactionHashResponse.register();
TransactionFinalizationRequest.register();
TransactionResponse.register();
