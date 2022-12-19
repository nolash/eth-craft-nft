all: solidity js python

.PHONY: js python solidity

js:
	make -C js

python:
	make -C python

solidity:
	make -C solidity install
	
test:
	make -C python test
