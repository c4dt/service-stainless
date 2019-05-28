module github.com/dedis/dynasent/conode

go 1.12

replace go.dedis.ch/cothority/v3 => ./cothority

require (
	github.com/c4dt/cothority-stainless v0.0.0-20190528170205-c1b1aac63f87
	go.dedis.ch/cothority/v3 v3.1.0
	go.dedis.ch/kyber/v3 v3.0.3
	go.dedis.ch/onet/v3 v3.0.14
	gopkg.in/urfave/cli.v1 v1.20.0
)
