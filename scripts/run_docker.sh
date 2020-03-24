#!/usr/bin/env bash

nb_nodes=1
container_base_port=9000
host_base_port=9000
conode_data_path="${HOME}/conode_data"
conode_base_name="conode-stainless"

publish=$(
    for i in $( seq ${nb_nodes} ) 
    do
        container_port=`expr ${container_base_port} + $i '*' 2 + 1`
        host_port=`expr ${host_base_port}  + $i '*' 2 + 1`

        echo --publish $host_port:$container_port
    done
) 

function run_container {
    local index=$1
    local publish=$2
    local network=$3

    docker run \
        --detach \
        --rm \
        --env CONODE_SERVICE_PATH=/config \
        --env DEBUG_COLOR=true \
        --volume ${conode_data_path}/conode-${index}:/config \
        --user `id -u`:`id -g` \
        ${publish} \
        ${network} \
        --label "traefik.enable=true" \
        --label "traefik.http.routers.demo-stainless.rule=Host(\`demo.c4dt.org\`)" \
        --label "traefik.http.routers.demo-stainless.entryPoints=demo-stainless" \
        --label "traefik.http.routers.demo-stainless.service=demo-stainless" \
        --label "traefik.http.routers.demo-stainless.tls=true" \
        --label "traefik.http.routers.demo-stainless.tls.certResolver=sample" \
        --label "traefik.http.services.demo-stainless.loadbalancer.server.scheme=http" \
        --name "${conode_base_name}-${index}" \
        c4dt/service-stainless-backend:latest -d 2 -c /config/private.toml server
}

if [ "$1" == "-s" ]
then
    for i in $( seq ${nb_nodes} )
    do
        echo "Stopping and removing container ${i}"
        docker container rm -f "${conode_base_name}-${i}"
    done
else
    for i in $( seq ${nb_nodes} )
    do
        echo "Running container ${i}"

        case ${i} in
            1)
                container_port=`expr ${container_base_port} + $i '*' 2 + 1`
                id=$( run_container "${i}" "--expose ${container_port}" "--network proxy" )
                echo "--> ${id}"
                ;;
        esac
    done
fi
