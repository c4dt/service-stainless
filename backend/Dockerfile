FROM debian:stretch-slim
WORKDIR /root/

# See https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=863199
RUN mkdir -p /usr/share/man/man1
# libgomp is needed for z3
RUN apt-get update; \
    apt-get install --no-install-recommends --yes \
    procps \
    openjdk-8-jre-headless \
    libgomp1 \
    ; apt-get clean
# Backports needed for 'npm'...
RUN echo 'deb http://deb.debian.org/debian stretch-backports main' >> /etc/apt/sources.list
RUN apt-get update; \
    apt-get install --target-release stretch-backports --no-install-recommends --yes \
    npm \
    ; apt-get clean
RUN npm install --global solc@0.5.8

COPY build/conode.Linux.x86_64 /root/conode
COPY build/stainless.jar /root/
COPY stainless-smart build/z3 build/cvc4 /usr/local/bin/

ENTRYPOINT ["/root/conode"]
