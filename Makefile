.DEFAULT_GOAL := all

services:
	git clone https://github.com/c4dt/services.git
services/%: | services
	@: nothing

toml_filename = conodes_bevm.toml
webapp_build_options = --prod --base-href /stainless/

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

$Dbackend/build/conode.Linux.x86_64: $Dbackend/bevm/*.go $Dbackend/stainless/service/*.go

$Dbackend/build/bevmadmin: | $Dbackend/build
	cd $Dbackend/bevmadmin && GO111MODULE=on go build -o ../build/$(@F)

$Dbackend/build/ident_bevm: $Dbackend/build/bcadmin $Dbackend/build/conodes.toml $Dbackend/build/bevmadmin $Dbackend/build/ident
	rm -rf $Dbackend/build/bevm_admin $Dbackend/build/bevm_user
	$(call $Swith-conodes, \
		bevm_admin_key=$$( $< --config $Dbackend/build/bevm_admin key ) ; \
		bevm_user_key=$$( $< --config $Dbackend/build/bevm_user key ) ; \
		bevm_user_private_key=$$( $< --config $Dbackend/build/bevm_user key --print $Dbackend/build/bevm_user/key-* | grep Private | cut -d \  -f 2 ) ; \
		bevm_darc=$$( $< --config $Dbackend/build darc add --bc $Dbackend/build/bc-* --unrestricted --identity $$bevm_admin_key --desc "BEvm Darc" | awk -F: '/BaseID:/ {print $$3}' ) ; \
		$< --config $Dbackend/build/bevm_admin link $(word 2,$^) $$( grep ByzCoinID $Dbackend/build/ident | cut -d \  -f 2 ) --darc $$bevm_darc --identity $$bevm_admin_key ; \
		$< --config $Dbackend/build/bevm_admin darc rule --bc $Dbackend/build/bevm_admin/bc-* --rule "spawn:bevm" --identity $$bevm_admin_key ; \
		$< --config $Dbackend/build/bevm_admin darc rule --bc $Dbackend/build/bevm_admin/bc-* --rule "invoke:bevm.credit" --identity $$bevm_user_key ; \
		$< --config $Dbackend/build/bevm_admin darc rule --bc $Dbackend/build/bevm_admin/bc-* --rule "invoke:bevm.transaction" --identity $$bevm_user_key ; \
		bevm_instance_id=$$($(word 3,$^) --config $Dbackend/build/bevm_admin spawn --bc $Dbackend/build/bevm_admin/bc-* | awk '{print $$NF}' ) ; \
		( echo "bevm_admin_key:        $${bevm_admin_key#ed25519:}" ; \
		  echo "bevm_user_private_key: $$bevm_user_private_key" ; \
		  echo "bevm_darc:             $$bevm_darc" ; \
		  echo "bevm_instance_id:      $$bevm_instance_id" ) > $@)

$Dbackend/build/config_bevm.toml: $Dbackend/build/ident_bevm
	awk ' \
		/^bevm_user_private_key:/  {printf("bevmUserID = \"%s\"\n", $$2)} \
		/^bevm_instance_id:/       {printf("bevmInstanceID = \"%s\"\n", $$2)} \
		' $^ > $@

$Swebapp-build $Swebapp-test $Swebapp-serve: $Dwebapp/src/assets/config_bevm.toml

$Dwebapp/src/assets/config_bevm.toml: $Dbackend/build/config_bevm.toml
	cp $^ $@

$Dsrc/Implementation/%_pb2.py: $Dprotobuf/%.proto
	cd $Dprotobuf && protoc --python_out=../$(@D) $(^F)
.PHONY: src-proto
src-proto: $(foreach p,$($SPROTOS),$Dsrc/Implementation/$p_pb2.py)

ifneq ($S,)
all: $Sall
endif
