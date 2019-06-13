.DEFAULT_GOAL := all

services:
	git clone git@github.com:c4dt/services.git
services/%: | services
	@: nothing

include services/mk/service.mk

.PHONY: $Sexternal-deps
$Sexternal-deps: \
	$Dbackend/build/stainless.jar \
	$Dbackend/build/z3 \
	$Dbackend/build/cvc4

$Dbackend/build/stainless.jar: | $Dbackend/build
	wget --quiet --output-document $@ https://github.com/epfl-lara/smart/releases/download/v0.1s/stainless-0.1s-5a2b680.jar

$Dbackend/build/z3: | $Dbackend/build
	wget --quiet --output-document /tmp/z3.zip https://github.com/Z3Prover/z3/releases/download/z3-4.7.1/z3-4.7.1-x64-debian-8.10.zip && unzip -xp /tmp/z3.zip z3-4.7.1-x64-debian-8.10/bin/z3 > $@ && chmod +x $@ && rm /tmp/z3.zip

$Dbackend/build/cvc4: | $Dbackend/build
	wget --quiet --output-document $@ http://cvc4.cs.stanford.edu/downloads/builds/x86_64-linux-opt/cvc4-1.6-x86_64-linux-opt && chmod +x $@

$Sbackend-docker-build: | $Sexternal-deps

$Dsrc/Implementation/%_pb2.py: $Dprotobuf/%.proto
	cd $Dprotobuf && protoc --python_out=../$(@D) $(^F)
.PHONY: src-proto
src-proto: $(foreach p,$($SPROTOS),$Dsrc/Implementation/$p_pb2.py)

ifneq ($S,)
all: $Sall
endif
