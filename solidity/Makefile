SOLC = /usr/bin/solc

all:
	$(SOLC) --bin CraftNFT.sol --evm-version byzantium | awk 'NR>3' > CraftNFT.bin
	truncate -s -1 CraftNFT.bin
	$(SOLC) --abi CraftNFT.sol --evm-version byzantium | awk 'NR>3' > CraftNFT.json

install-py: all
	cp -v CraftNFT*{json,bin} ../python/eth_craft_nft/data/

install-js: all
	cp -v CraftNFT*{json,bin} ../js/contract/

install: install-js install-py

