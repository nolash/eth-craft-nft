SOLC = /usr/bin/solc

all:
	$(SOLC) --bin CraftNFT.sol --evm-version byzantium | awk 'NR>3' > CraftNFT.bin
	$(SOLC) --abi CraftNFT.sol --evm-version byzantium | awk 'NR>3' > CraftNFT.json
	$(SOLC) --metadata CraftNFT.sol --evm-version byzantium | awk 'NR>3' > CraftNFT.metadata.json
	truncate -s -1 CraftNFT.bin

install-py: all
	cp -v *.json ../python/craft_nft/data/
	cp -v *.bin ../python/craft_nft/data/

install-js: all
	cp -v *.json ../js/contract/
	cp -v *.bin ../js/contract/

install: install-js install-py

