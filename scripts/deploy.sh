#!/usr/bin/env bash

set -e

echo "Starting deployment of Stainless/ByzCoin demonstrator..."

mv dist "dist-$( date '+%F_%T' )"
tar xf build/dist.tar.xz
cp Config/*toml dist/stainless-demo/assets/

./scripts/run_docker.sh -s
docker pull c4dt/service-stainless-backend:latest
./scripts/run_docker.sh

echo "Deployment completed."
