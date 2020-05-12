#!/usr/bin/env bash

set -e

echo "Starting deployment of Stainless/ByzCoin demonstrator..."

mv dist "dist-$( date '+%F_%T' )"
tar xf build/dist.tar.xz
cp Config/*toml dist/stainless-demo/assets/

export USER_INFO="$( id -u ):$( id -g )"

docker-compose -f backend/docker-compose.yml down
docker-compose -f backend/docker-compose.yml pull
docker-compose -f backend/docker-compose.yml up -d

echo "Deployment completed."
