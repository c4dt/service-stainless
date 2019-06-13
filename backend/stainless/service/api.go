package stainless

import (
	"go.dedis.ch/cothority/v3"
	"go.dedis.ch/cothority/v3/byzcoin"
	"go.dedis.ch/onet/v3"
	"go.dedis.ch/onet/v3/network"

	proto "github.com/c4dt/service-stainless/backend/proto/stainless"
)

// Client is a structure to communicate with stainless service
type Client struct {
	*onet.Client
}

// NewClient makes a new Client
func NewClient() *Client {
	return &Client{Client: onet.NewClient(cothority.Suite, ServiceName)}
}

// Verify sends a verification request
func (c *Client) Verify(dst *network.ServerIdentity, sourceFiles map[string]string) (*proto.VerificationResponse, error) {
	response := &proto.VerificationResponse{}

	err := c.SendProtobuf(dst, &proto.VerificationRequest{SourceFiles: sourceFiles}, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

// GenBytecode sends a bytecode generation request
func (c *Client) GenBytecode(dst *network.ServerIdentity, sourceFiles map[string]string) (*proto.BytecodeGenResponse, error) {
	response := &proto.BytecodeGenResponse{}

	err := c.SendProtobuf(dst, &proto.BytecodeGenRequest{SourceFiles: sourceFiles}, response)
	if err != nil {
		return nil, err
	}

	return response, nil
}

func (c *Client) DeployContract(dst *network.ServerIdentity, gasLimit uint64, gasPrice uint64, amount uint64, nonce uint64, bytecode []byte, abi string, args ...string) (*proto.TransactionHashResponse, error) {
	request := &proto.DeployRequest{
		GasLimit: gasLimit,
		GasPrice: gasPrice,
		Amount:   amount,
		Nonce:    nonce,
		Bytecode: bytecode,
		Abi:      abi,
		Args:     args,
	}
	response := &proto.TransactionHashResponse{}

	err := c.SendProtobuf(dst, request, response)
	if err != nil {
		return nil, err
	}

	return response, err
}

func (c *Client) ExecuteTransaction(dst *network.ServerIdentity, gasLimit uint64, gasPrice uint64, amount uint64, contractAddress []byte, nonce uint64, abi string, method string, args ...string) (*proto.TransactionHashResponse, error) {
	request := &proto.TransactionRequest{
		GasLimit:        gasLimit,
		GasPrice:        gasPrice,
		Amount:          amount,
		ContractAddress: contractAddress,
		Nonce:           nonce,
		Abi:             abi,
		Method:          method,
		Args:            args,
	}
	response := &proto.TransactionHashResponse{}

	err := c.SendProtobuf(dst, request, response)
	if err != nil {
		return nil, err
	}

	return response, err
}

func (c *Client) FinalizeTransaction(dst *network.ServerIdentity, tx []byte, signature []byte) (*proto.TransactionResponse, error) {
	request := &proto.TransactionFinalizationRequest{
		Transaction: tx,
		Signature:   signature,
	}
	response := &proto.TransactionResponse{}

	err := c.SendProtobuf(dst, request, response)
	if err != nil {
		return nil, err
	}

	return response, err
}

func (c *Client) Call(dst *network.ServerIdentity, blockID []byte, serverConfig string, bevmInstanceID byzcoin.InstanceID, accountAddress []byte, contractAddress []byte, abi string, method string, args ...string) (*proto.CallResponse, error) {
	request := &proto.CallRequest{
		BlockID:         blockID,
		ServerConfig:    serverConfig,
		BEvmInstanceID:  bevmInstanceID[:],
		AccountAddress:  accountAddress,
		ContractAddress: contractAddress,
		Abi:             abi,
		Method:          method,
		Args:            args,
	}
	response := &proto.CallResponse{}

	err := c.SendProtobuf(dst, request, response)
	if err != nil {
		return nil, err
	}

	return response, err
}
