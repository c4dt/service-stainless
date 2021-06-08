// Package stainless is a service for executing stainless verification and
// Ethereum bytecode generation on smart contracts written in a subset of
// Scala.
package stainless

import (
	"go.dedis.ch/cothority/v3/bevm"
	"go.dedis.ch/cothority/v3/byzcoin"
	"go.dedis.ch/cothority/v3/darc"
	"go.dedis.ch/onet/v3"
	"go.dedis.ch/onet/v3/app"
	"go.dedis.ch/onet/v3/log"
	"go.dedis.ch/onet/v3/network"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"

	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	proto "github.com/c4dt/service-stainless/backend/proto/stainless"
)

const (
	reportName = "report.json"
	cacheDir   = "/tmp/stainless-cache-dir"
	timeout    = 5 * time.Minute
)

// The following are declared as 'var' to allow overwriting them in tests.
var stainlessCmd = "stainless"
var solCompiler = "solcjs"

// ServiceName is the name to refer to the Stainless service.
const ServiceName = "Stainless"

func init() {
	onet.RegisterNewService(ServiceName, newStainlessService)
}

// Stainless is the service that performs stainless operations.
type Stainless struct {
	*onet.ServiceProcessor
}

func createSourceFiles(dir string, sourceFiles map[string]string) ([]string,
	error) {
	var filenames []string

	for filename, contents := range sourceFiles {
		err := ioutil.WriteFile(filepath.Join(dir, filename),
			[]byte(contents), 0644)
		if err != nil {
			return nil, err
		}
		filenames = append(filenames, filename)
	}

	return filenames, nil
}

func verify(sourceFiles map[string]string) (string, string, error) {
	// Ensure Stainless cache directory exists
	err := os.MkdirAll(cacheDir, 0755)
	if err != nil {
		return "", "", err
	}

	// Create temporary working directory for isolated execution
	dir, err := ioutil.TempDir("", "stainless-")
	if err != nil {
		return "", "", err
	}
	defer os.RemoveAll(dir)

	// Create source files in working directory
	filenames, err := createSourceFiles(dir, sourceFiles)
	if err != nil {
		return "", "", err
	}

	// Build stainless arguments
	args := append([]string{
		fmt.Sprintf("--solvers=%s",
			strings.Join([]string{"smt-cvc4", "smt-z3"}, ",")),
		"--smart-contracts",
		"--json",
		fmt.Sprintf("--cache-dir=%s", cacheDir),
	}, filenames...)

	// Build command
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, stainlessCmd, args...)
	cmd.Dir = dir

	// Execute command and retrieve console output
	console, execErr := cmd.Output()

	// If no report was produced, a serious error happened
	reportFile := filepath.Join(dir, reportName)
	if _, err := os.Stat(reportFile); os.IsNotExist(err) {
		return "", "", fmt.Errorf("%s\nConsole:\n%s", execErr.Error(), console)
	}

	// Read JSON report
	report, err := ioutil.ReadFile(filepath.Join(dir, "report.json"))
	if err != nil {
		log.LLvl4("Error reading JSON report:", err)
		return "", "", err
	}
	// If the report is empty, verification could not proceed normally
	if string(report) == "{}" {
		return "", "", fmt.Errorf("Error in Stainless execution -- "+
			"Console:\n%s", console)
	}

	// Verification was performed, and its results are contained in the report
	return string(console), string(report), nil
}

func compileToSolidity(dir string, sourceFilenames []string) ([]string, error) {
	// % stainless-smart --solidity *scala

	// Build stainless arguments
	args := append([]string{
		"--smart-contracts",
		"--solidity",
	}, sourceFilenames...)

	// Build command
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, stainlessCmd, args...)
	cmd.Dir = dir

	// Execute command and retrieve stdout
	out, err := cmd.Output()
	if err != nil {
		fmt.Printf("Error; stdout = \n%s", out)
		// return nil, err
	}

	// Find produced Solidity files
	solidityFilePaths, err := filepath.Glob(filepath.Join(dir, "*.sol"))
	if err != nil {
		return nil, err
	}

	var solidityFileNames []string
	for _, f := range solidityFilePaths {
		solidityFileNames = append(solidityFileNames, filepath.Base(f))
	}

	return solidityFileNames, nil
}

func compileToBytecode(dir string, sourceFilenames []string,
	destDir string) error {
	// % solcjs --bin --abi --output-dir OUT_DIR [SOLIDITY_FILE...]

	// Build Solidity compiler arguments
	args := append([]string{
		"--bin",
		"--abi",
		"--output-dir", destDir,
	}, sourceFilenames...)

	// Build command
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()
	cmd := exec.CommandContext(ctx, solCompiler, args...)
	cmd.Dir = dir

	// Execute command and retrieve stdout
	out, err := cmd.Output()
	if err != nil {
		fmt.Printf("Error; stdout = \n%s", out)
		return err
	}

	return nil
}

func buildContractMap(dir string) (map[string]*proto.BytecodeObj, error) {
	// Look for all ABI files
	abis, err := filepath.Glob(filepath.Join(dir, "*.abi"))
	if err != nil {
		return nil, err
	}

	foundContracts := make(map[string]*proto.BytecodeObj)

	for _, abi := range abis {
		// Extract contract name, to be used as map key
		parts := strings.Split(abi, "_sol_")
		if len(parts) < 2 {
			return nil, fmt.Errorf("Unexpected filename for ABI "+
				"file: '%s'", abi)
		}

		nameWithExt := parts[len(parts)-1]
		name := nameWithExt[:len(nameWithExt)-4]

		// Read ABI contents
		abiContents, err := ioutil.ReadFile(abi)
		if err != nil {
			return nil, err
		}

		// Read bytecode contents
		bin := abi[:len(abi)-4] + ".bin"
		binContents, err := ioutil.ReadFile(bin)
		if err != nil {
			return nil, err
		}

		// Check for duplicates
		if _, ok := foundContracts[name]; ok {
			return nil, fmt.Errorf("Duplicate contract: '%s'", name)
		}

		foundContracts[name] = &proto.BytecodeObj{
			Abi: string(abiContents),
			Bin: string(binContents),
		}
	}

	return foundContracts, nil
}

func genBytecode(sourceFiles map[string]string) (map[string]*proto.BytecodeObj,
	error) {
	// Create temporary working directory for isolated execution
	dir, err := ioutil.TempDir("", "stainless-")
	if err != nil {
		return nil, err
	}
	defer os.RemoveAll(dir)

	// Create source files in working directory
	sourceFilenames, err := createSourceFiles(dir, sourceFiles)
	if err != nil {
		return nil, err
	}

	solFilenames, err := compileToSolidity(dir, sourceFilenames)
	if err != nil {
		return nil, err
	}

	bytecodeDir := filepath.Join(dir, "out")
	err = compileToBytecode(dir, solFilenames, bytecodeDir)
	if err != nil {
		return nil, err
	}

	bc, err := buildContractMap(bytecodeDir)
	if err != nil {
		return nil, err
	}

	return bc, nil
}

// Verify performs a Stainless contract verification
func (service *Stainless) Verify(
	req *proto.VerificationRequest) (network.Message, error) {
	console, report, err := verify(req.SourceFiles)
	if err != nil {
		return nil, err
	}

	log.Lvl4("Returning", console, report)

	return &proto.VerificationResponse{
		Console: console,
		Report:  report,
	}, nil
}

// GenBytecode generates bytecode from Stainless contracts
func (service *Stainless) GenBytecode(
	req *proto.BytecodeGenRequest) (network.Message, error) {
	bytecodeObjs, err := genBytecode(req.SourceFiles)
	if err != nil {
		return nil, err
	}

	log.Lvl4("Returning", bytecodeObjs)

	return &proto.BytecodeGenResponse{
		BytecodeObjs: bytecodeObjs,
	}, nil
}

// DeployContract builds a transaction to deploy an EVM contract. Returns an
// EVM transaction and its hash to be signed by the caller.
func (service *Stainless) DeployContract(
	req *proto.DeployRequest) (network.Message, error) {
	abi, err := abi.JSON(strings.NewReader(req.Abi))
	if err != nil {
		return nil, err
	}

	args, err := bevm.DecodeEvmArgs(req.Args, abi.Constructor.Inputs)
	if err != nil {
		return nil, err
	}

	packedArgs, err := abi.Pack("", args...)
	if err != nil {
		return nil, err
	}

	callData := append(req.Bytecode, packedArgs...)

	tx := types.NewContractCreation(req.Nonce, big.NewInt(int64(req.Amount)),
		req.GasLimit, big.NewInt(int64(req.GasPrice)), callData)

	signer := types.HomesteadSigner{}
	hashedTx := signer.Hash(tx)

	unsignedBuffer, err := tx.MarshalJSON()
	if err != nil {
		return nil, err
	}

	log.Lvl4("Returning", unsignedBuffer, hashedTx)

	return &proto.TransactionHashResponse{Transaction: unsignedBuffer,
		TransactionHash: hashedTx[:]}, nil
}

// ExecuteTransaction builds a transaction to execute a R/W method on a
// previously deployed EVM contract instance. Returns an EVM transaction and
// its hash to be signed by the caller.
func (service *Stainless) ExecuteTransaction(
	req *proto.TransactionRequest) (network.Message, error) {
	abi, err := abi.JSON(strings.NewReader(req.Abi))
	if err != nil {
		return nil, err
	}

	args, err := bevm.DecodeEvmArgs(req.Args, abi.Methods[req.Method].Inputs)
	if err != nil {
		return nil, err
	}

	callData, err := abi.Pack(req.Method, args...)
	if err != nil {
		return nil, err
	}

	tx := types.NewTransaction(req.Nonce,
		common.BytesToAddress(req.ContractAddress),
		big.NewInt(int64(req.Amount)),
		req.GasLimit, big.NewInt(int64(req.GasPrice)), callData)

	signer := types.HomesteadSigner{}
	hashedTx := signer.Hash(tx)

	unsignedBuffer, err := tx.MarshalJSON()
	if err != nil {
		return nil, err
	}

	log.Lvl4("Returning", unsignedBuffer, hashedTx)

	return &proto.TransactionHashResponse{Transaction: unsignedBuffer,
		TransactionHash: hashedTx[:]}, nil
}

// FinalizeTransaction finalizes a previously initiated transaction, signed by
// the caller. Returns an EVM transaction ready to be sent to ByzCoin and
// handled by the bevm contract.
func (service *Stainless) FinalizeTransaction(
	req *proto.TransactionFinalizationRequest) (network.Message, error) {
	signer := types.HomesteadSigner{}

	var tx types.Transaction
	err := tx.UnmarshalJSON(req.Transaction)
	if err != nil {
		return nil, err
	}

	signedTx, err := tx.WithSignature(signer, req.Signature)
	if err != nil {
		return nil, err
	}

	signedBuffer, err := signedTx.MarshalJSON()
	if err != nil {
		return nil, err
	}

	log.Lvl4("Returning", signedBuffer)

	return &proto.TransactionResponse{
		Transaction: signedBuffer,
	}, nil
}

// Call executes a R-only method on a previously deployed EVM contract instance
// by contacting a ByzCoin cothority. Returns the call response.
func (service *Stainless) Call(req *proto.CallRequest) (network.Message,
	error) {
	abi, err := abi.JSON(strings.NewReader(req.Abi))
	if err != nil {
		return nil, err
	}

	args, err := bevm.DecodeEvmArgs(req.Args, abi.Methods[req.Method].Inputs)
	if err != nil {
		return nil, err
	}

	// We don't need the private key for reading proofs
	account := &bevm.EvmAccount{
		Address: common.BytesToAddress(req.AccountAddress),
	}
	// We don't need the bytecode
	contractInstance := bevm.EvmContractInstance{
		Parent: &bevm.EvmContract{
			Abi: abi,
		},
		Address: common.BytesToAddress(req.ContractAddress),
	}

	// Read server configuration from TOML data
	grp, err := app.ReadGroupDescToml(strings.NewReader(req.ServerConfig))
	if err != nil {
		return nil, err
	}
	// Instantiate a new ByzCoin client
	bcClient := byzcoin.NewClient(req.BlockID, *grp.Roster)

	// Instantiate a new BEvm client (we don't need a darc to read proofs)
	bevmClient, err := bevm.NewClient(bcClient, darc.Signer{},
		byzcoin.NewInstanceID(req.BEvmInstanceID))
	if err != nil {
		return nil, err
	}

	// Execute the view method in the EVM
	result, err := bevmClient.Call(account, &contractInstance,
		req.Method, args...)
	if err != nil {
		return nil, err
	}

	log.Lvlf4("Returning: %v", result)

	resultJSON, err := json.Marshal(result)
	if err != nil {
		return nil, err
	}

	return &proto.CallResponse{Result: string(resultJSON)}, nil
}

// newStainlessService creates a new service that is built for Status
func newStainlessService(context *onet.Context) (onet.Service, error) {
	service := &Stainless{
		ServiceProcessor: onet.NewServiceProcessor(context),
	}

	for _, srv := range []interface{}{
		service.Verify,
		service.GenBytecode,
		service.DeployContract,
		service.ExecuteTransaction,
		service.FinalizeTransaction,
		service.Call,
	} {
		err := service.RegisterHandler(srv)
		if err != nil {
			return nil, err
		}
	}

	return service, nil
}
