![Build Status](https://github.com/c4dt/service-stainless/actions/workflows/build.yml/badge.svg)

# Stainless-ByzCoin Demonstrator

Stainless is a tool to help designing highly reliable programs in Scala. Using Formal Verification, it will check
whether the system behaves according to how it was specified, or if it will deviate in unexpected ways.
Logical errors, security vulnerabilities and other defects can therefore be detected before the program is deployed.

Please refer to the [project's showcase](https://factory.c4dt.org/showcase/stainless-for-smart-contracts/presentation)
for additional information on the project's theoretical background.

Steps to run locally:

Install `Go` by [following the official instructions for your OS](https://go.dev/doc/install), then
download the appropriate `Protocol Buffers` [archive for your architecture](https://github.com/protocolbuffers/protobuf/releases)
and extract it into this directory.

You need to add the extracted binary to the path your OS is searching for executables, e.g. via

```
PATH=$PATH:$(pwd)/bin
```

in Linux.

Generate the node's configs

```
make configs
make webapp-proto
docker-compose build
```

Launch it with

```
docker-compose up
```

And open a browser to http://localhost:80/stainless-demo/.
