set +e
# chainlib required settings, edit as needed.
export RPC_PROVIDER=http://localhost:8545
# The chain spec 3rd field MUST match the chain id of the newtork
export CHAIN_SPEC=evm:kitabu:5050:test
# this file will be used to sign all transcations below
# it must have sufficient gas token balance
export WALLET_KEY_FILE=${WALLET_KEY_FILE:-alice.json}

# eth-keyfile is provided by the funga-eth module, a dependency of craft-nft
>&2 echo generating keys...
eth-keyfile -z > bob.json
eth-keyfile -z > carol.json
eth-keyfile -z > dave.json
export ALICE=$(eth-keyfile -z -d $WALLET_KEY_FILE)
>&2 echo "Alice has key $ALICE. This key will be used for signing"
export BOB=$(eth-keyfile -z -d bob.json)
>&2 echo Bob has key $BOB
export CAROL=$(eth-keyfile -z -d carol.json)
>&2 echo Carol has key $CAROL
export DAVE=$(eth-keyfile -z -d dave.json)
>&2 echo Dave has key $DAVE

# publish contract
>&2 echo publishing token ...
echo "description missing" > description.txt
craftnft-publish --name "Test Token" --symbol "TEST" --declaration-file description.txt -s -w > token.txt
export TOKEN_ADDRESS=$(cat token.txt | eth-checksum)
>&2 echo published token $TOKEN_ADDRESS

token_foo=$(echo -n foo | sha256sum | awk '{print $1;}')
>&2 echo allocating unique token "foo" ...
craftnft-allocate -e $TOKEN_ADDRESS -s -w $token_foo >> txs.txt
token_bar=$(echo -n bar | sha256sum | awk '{print $1;}')
>&2 echo allocating batched token "bar" ...
craftnft-allocate -e $TOKEN_ADDRESS -s -w --count 10 $token_bar  >> txs.txt

>&2 echo minting the "foo" token to Alice ...
craftnft-mint -e $TOKEN_ADDRESS --token-id $token_foo -s -w $ALICE >> txs.txt
>&2 echo minting a "bar" token to Bob ...
craftnft-mint -e $TOKEN_ADDRESS --token-id $token_bar -s -w $BOB >> txs.txt
>&2 echo minting a "bar" token to Carol ...
craftnft-mint -e $TOKEN_ADDRESS --token-id $token_bar -s -w $CAROL >> txs.txt
>&2 echo minting a "bar" token to Alice ...
craftnft-mint -e $TOKEN_ADDRESS --token-id $token_bar -s -w $ALICE >> txs.txt

# erc721-tranfser is provided by the eth-erc721 module, a dependency of craft-nft
# It is a generic tool, so we need to specify the gas budget manually
>&2 echo "transfer Alice's bar token to Dave ..."
erc721-transfer -e $TOKEN_ADDRESS -a $DAVE -s -w --fee-limit 100000 0xfcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04f0000000000000002 >> txs.txt

craftnft-dump $TOKEN_ADDRESS
set -e
