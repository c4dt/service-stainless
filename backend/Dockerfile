FROM golang:1.21 as builder

RUN apt update \
    && apt install --no-install-recommends --yes unzip

COPY build/*.go build/go.* /src/main/
COPY *.go go.* /src/
COPY cothority /src/cothority/
COPY proto /src/proto/
COPY stainless /src/stainless/

RUN cd /src/main && go build -v -o /conode

COPY build/stainless.zip /tmp/
RUN unzip -d /stainless /tmp/stainless.zip

FROM debian:bookworm-slim as runner

# libgomp is needed for z3
RUN apt update \
    && apt install --no-install-recommends --yes \
	    procps \
	    openjdk-17-jre-headless \
	    libgomp1 \
        npm \
    && apt clean
RUN npm install --global solc@0.5

COPY build/cvc4 /usr/local/bin/

COPY --from=builder /conode /stainless /usr/local/bin/

CMD /usr/local/bin/conode -d 2 -c /config/private.toml server
