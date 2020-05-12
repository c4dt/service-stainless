#!/usr/bin/env bash

set -e

echo "Starting deployment of Stainless/ByzCoin demonstrator..."

mv dist "dist-$( date '+%F_%T' )"
tar xf build/dist.tar.xz
cp Config/*toml dist/stainless-demo/assets/

export USER_INFO="$( id -u ):$( id -g )"
compose_file=$( dirname $0 )/docker-compose.yml

docker-compose -f ${compose_file} down
docker-compose -f ${compose_file} pull
docker-compose -f ${compose_file} up -d

echo "Deployment completed."
