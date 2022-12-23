all: solidity js python aux

.PHONY: js python solidity wala

js:
	make -C js

python:
	make -C python
	cd python && ./prepare.sh

solidity:
	make -C solidity install

wala:
	git clone git://defalsify.org/wala.git
	cd wala && cargo build --all-features

aux: wala

test:
	make -C python test
