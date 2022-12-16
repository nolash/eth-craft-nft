SOLC = /usr/bin/solc

all:
	$(SOLC) --bin CraftNFT.sol | awk 'NR>3' > CraftNFT.bin
	truncate -s -1 CraftNFT.bin
	$(SOLC) --abi CraftNFT.sol | awk 'NR>3' > CraftNFT.json

install: all
	cp -v CraftNFT*{json,bin} ../python/eth_craft_nft/data/
