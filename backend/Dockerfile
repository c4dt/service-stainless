FROM debian:stretch-slim

# See https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=863199
RUN mkdir -p /usr/share/man/man1
# libgomp is needed for z3
RUN apt-get update; \
    apt-get install --no-install-recommends --yes \
    procps \
    openjdk-8-jre-headless \
    libgomp1 \
    unzip \
    ; apt-get clean
# Backports needed for 'npm'...
RUN echo 'deb http://deb.debian.org/debian stretch-backports main' >> /etc/apt/sources.list
RUN apt-get update; \
    apt-get install --target-release stretch-backports --no-install-recommends --yes \
    npm \
    ; apt-get clean
RUN npm install --global solc@0.5.10

COPY build/conode.Linux.x86_64 /usr/local/bin/conode
COPY build/cvc4 /usr/local/bin/

COPY build/stainless.zip /tmp/
RUN unzip -d /usr/local/bin /tmp/stainless.zip && rm -f /tmp/stainless.zip
# see https://github.com/epfl-lara/smart/issues/12
RUN chmod o+r /usr/local/bin/lib/scalaz3-unix-64-2.12.jar

ENTRYPOINT ["/usr/local/bin/conode"]
