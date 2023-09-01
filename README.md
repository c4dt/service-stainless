# Stainless-ByzCoin Demonstrator has been Archived

This repo has been archived and is only available to run the demo.

# Stainless-ByzCoin Demonstrator

The Stainless demonstrator shows how Stainless helps develop Smart Contracts free of errors. 
It provides an interactive environment where the user can verify prewritten Smart Contracts, 
deploy them on a blockchain, and call their functions.

A first introductory scenario involves a Candy Shop that maintains its candy balance with a simple 
Smart Contract, which prevents people from cheating by taking away more candies than are available. 
A second scenario illustrates a bug in a Smart Contract that appeared on the Ethereum blockchain 
a few years ago, and led to a controversial fork to prevent significant monetary loss. 
It also explains how Stainless could have prevented it.

Please refer to the [project's showcase](https://factory.c4dt.org/showcase/stainless-for-smart-contracts/presentation)
for additional information on the project's theoretical background.

## Running the Demo

Steps to run locally:

```
git clone https://github.com/c4dt/service-stainless
cd service-stainless
docker-compose up -d
open localhost:8080
```

The demo has instructions how to run it.

## Persistent data

On the first run, pre-computed data is copied to your repo at [./backend/configs].
It contains the state of the blockchain and some variables.

If you want to start over, you have to:
- delete the [./backend/configs]
- [remove the local storage](https://intercom.help/scoutpad/en/articles/3478364-how-to-clear-local-storage-of-web-browser) 
from your browser
