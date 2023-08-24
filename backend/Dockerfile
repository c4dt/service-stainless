FROM golang:1 as builder

COPY build/*.go build/go.* /src/main/
COPY *.go go.* /backend/
COPY cothority/ /backend/cothority/
COPY proto/ /backend/proto/
COPY stainless/ /backend/stainless/

RUN cd /src/main && go build -v -o /conode

FROM debian:bookworm-slim as runner

# libgomp is needed for z3
RUN apt update \
    && apt install --no-install-recommends --yes \
	    procps \
	    openjdk-17-jre-headless \
	    libgomp1 \
	    npm \
	    unzip \
    && apt clean
RUN npm install --global solc@0.5

COPY build/cvc4 /usr/local/bin/

COPY build/stainless.zip /tmp/
RUN unzip -d /usr/local/bin /tmp/stainless.zip && rm -f /tmp/stainless.zip

COPY --from=builder /conode /usr/local/bin/conode
COPY build/conode-1 /configs/conode-1
COPY build/conode-2 /configs/conode-2
COPY build/conode-3 /configs/conode-3
COPY build/conode-4 /configs/conode-4

ENTRYPOINT ["/usr/local/bin/conode"]
