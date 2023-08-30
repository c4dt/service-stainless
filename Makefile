.DEFAULT_GOAL := all

services:
	git clone -b stainless https://github.com/c4dt/services.git
services/%: | services
	@: nothing

webapp_build_options = --prod

include services/mk/service.mk

.PHONY: $Sexternal-deps
$Sexternal-deps: \
	$Dbackend/build/stainless.zip \
	$Dbackend/build/cvc4

$Dbackend/build/stainless.zip: | $Dbackend/build
	wget \
		--quiet \
		--output-document $@ \
		https://github.com/epfl-lara/smart/releases/download/v0.3.1s/smart-scalac-standalone-0.3.1s-linux.zip

$Dbackend/build/cvc4: | $Dbackend/build
	wget \
		--quiet \
		--output-document $@ \
		http://cvc4.cs.stanford.edu/downloads/builds/x86_64-linux-opt/cvc4-1.6-x86_64-linux-opt \
		&& chmod +x $@

$Sbackend-docker-build: | $Sexternal-deps

$Dbackend/build/bevmadmin: | $Dbackend/build
	cd $Dbackend/cothority/bevm/bevmadmin && GO111MODULE=on go build -o ../../../build/$(@F)

$Dbackend/configs/ident_bevm: $Dbackend/build/bcadmin $Dbackend/configs/conodes.toml $Dbackend/build/bevmadmin $Dbackend/configs/ident
	rm -rf $Dbackend/configs/bevm_admin $Dbackend/configs/bevm_user
	$(call $Swith-conodes, \
		bevm_admin_key=$$( $< --config $Dbackend/configs/bevm_admin key ) ; \
		bevm_user_key=$$( $< --config $Dbackend/configs/bevm_user key ) ; \
		bevm_user_private_key=$$( $< --config $Dbackend/configs/bevm_user key --print $Dbackend/configs/bevm_user/key-* | grep Private | cut -d \  -f 2 ) ; \
		sleep 1 ; \
		bevm_darc=$$( $< --config $Dbackend/configs darc add --bc $Dbackend/configs/bc-* --unrestricted --identity $$bevm_admin_key --desc "BEvm Darc" | awk -F: '/BaseID:/ {print $$3}' ) ; \
		sleep 1 ; \
		$< --config $Dbackend/configs/bevm_admin link $(word 2,$^) $$( grep ByzCoinID $Dbackend/configs/ident | cut -d \  -f 2 ) --darc $$bevm_darc --identity $$bevm_admin_key ; \
		sleep 1 ; \
		$< --config $Dbackend/configs/bevm_admin darc rule --bc $Dbackend/configs/bevm_admin/bc-* --rule "spawn:bevm" --identity $$bevm_admin_key ; \
		sleep 1 ; \
		$< --config $Dbackend/configs/bevm_admin darc rule --bc $Dbackend/configs/bevm_admin/bc-* --rule "invoke:bevm.credit" --identity $$bevm_user_key ; \
		sleep 1 ; \
		$< --config $Dbackend/configs/bevm_admin darc rule --bc $Dbackend/configs/bevm_admin/bc-* --rule "invoke:bevm.transaction" --identity $$bevm_user_key ; \
		sleep 1 ; \
		bevm_instance_id=$$($(word 3,$^) --config $Dbackend/configs/bevm_admin spawn --bc $Dbackend/configs/bevm_admin/bc-* | awk '{print $$NF}' ) ; \
		sleep 1 ; \
		( echo "bevm_admin_key:        $${bevm_admin_key#ed25519:}" ; \
		  echo "bevm_user_private_key: $$bevm_user_private_key" ; \
		  echo "bevm_darc:             $$bevm_darc" ; \
		  echo "bevm_instance_id:      $$bevm_instance_id" ) > $@)

$Dbackend/configs/config_bevm.toml: $Dbackend/configs/ident_bevm
	awk ' \
		/^bevm_user_private_key:/  {printf("bevmUserID = \"%s\"\n", $$2)} \
		/^bevm_instance_id:/       {printf("bevmInstanceID = \"%s\"\n", $$2)} \
		' $^ > $@

$Swebapp-build $Swebapp-test $Swebapp-serve: $Dwebapp/src/assets/configs/bevm.toml $Dwebapp/src/assets/configs/stainless.toml

$Dwebapp/src/assets/configs/bevm.toml: $Dbackend/configs/config_bevm.toml | $Dwebapp/src/assets/configs/
	cp $^ $@

$Dwebapp/src/assets/configs/stainless.toml: $Dwebapp/src/assets/configs/$(toml_filename) | $Dwebapp/src/assets/configs/
	cp $^ $@

$Dsrc/Implementation/%_pb2.py: $Dprotobuf/%.proto
	cd $Dprotobuf && protoc --python_out=../$(@D) $(^F)
.PHONY: src-proto
src-proto: $(foreach p,$($SPROTOS),$Dsrc/Implementation/$p_pb2.py)

seq-diagram.png: 	seq-diagram.txt
	plantuml $^

ifneq ($S,)
all: $Sall
endif

.PHONY: configs
configs: webapp/src/assets/configs/byzcoin.toml
configs: webapp/src/assets/configs/bevm.toml
configs: webapp/src/assets/configs/conodes.toml
configs: webapp/src/assets/configs/stainless.toml
