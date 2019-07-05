#!/usr/bin/env bash

set -e

bcadmin=$( realpath $1 )
bevmadmin=$( realpath $2 )
roster=$( realpath $3 )

admin_path="./admin/"
bevm_admin_path="./bevm_admin/"
bevm_user_path="./bevm_user/"

mkdir bevm_config 
pushd bevm_config

# Initialize ByzCoin
echo "Initializing ByzCoin..."
byzcoinid=$(
    ${bcadmin} \
        --config ${admin_path} \
        create ${roster} \
    | head -1 | awk '{sub("\\.", "", $NF); print $NF}'
)

# Create bevm_admin identity
echo "Creating BEvm admin identity..."
bevm_admin_key=$(
    ${bcadmin} \
        --config ${bevm_admin_path} \
        key
)

# Create bevm_user identity
echo "Creating BEvm user identity..."
bevm_user_key=$(
    ${bcadmin} \
        --config ${bevm_user_path} \
        key
)
bevm_user_private_key=$(
    ${bcadmin} \
        --config ${bevm_user_path} \
        key \
            --print ${bevm_user_path}key-* \
    | grep Private | cut -d \  -f 2
)

# Create BEvm Darc
echo "Creating BEvm Darc..."
bevm_darc=$(
    ${bcadmin} \
        --config ${admin_path} \
        darc add \
            --bc ${admin_path}bc-* \
            --unrestricted \
            --identity ${bevm_admin_key} \
            --desc "BEvm Darc" \
    | awk -F: '/BaseID:/ {print $3}'
)

# Initialize BEvm Darc
echo "Initializing BEvm Darc..."
${bcadmin} \
    --config ${bevm_admin_path} \
    link \
        ${roster} \
        ${byzcoinid} \
        --darc ${bevm_darc} \
        --identity ${bevm_admin_key}

${bcadmin} \
    --config ${bevm_admin_path} \
    darc rule \
        --bc ${bevm_admin_path}bc-* \
        --rule "spawn:bevm" \
        --identity ${bevm_admin_key}

${bcadmin} \
    --config ${bevm_admin_path} \
    darc rule \
        --bc ${bevm_admin_path}bc-* \
        --rule "invoke:bevm.credit" \
        --identity ${bevm_user_key}

${bcadmin} \
    --config ${bevm_admin_path} \
    darc rule \
        --bc ${bevm_admin_path}bc-* \
        --rule "invoke:bevm.transaction" \
        --identity ${bevm_user_key}

# Spawn BEvm instance
echo "Spawning BEvm instance..."
bevmid=$(
    ${bevmadmin} \
        --config ${bevm_admin_path} \
        spawn \
            --bc ${bevm_admin_path}bc-* \
    | awk '{print $NF}'
)

echo "------------------------------------------------"
echo "ByzCoinID:                ${byzcoinid}"
echo "BEvm user private key:    ${bevm_user_private_key}"
echo "BEvm instance ID:         ${bevmid}"

popd
