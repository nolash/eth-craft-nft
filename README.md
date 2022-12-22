# Craft NFT

The CraftNFT code is designed to provide a sovereign and standalone registry for certificates of real-world arts and crafts assets.

It is implemented on the Ethereum Virtual Machine and the web3 JSON-RPC protocol.


## Dependencies

Version numbers in dependencies are not absolute, but only detail what has been used by the author during development.

* `make >= 4.x`
* `solc >= 0.8.x`
* `python >= 3.7.x`
* `node >= 19.2.x (npm >= 8.19.x)`
* An `evm` service endpoint that speaks web3 JSON-RPC. Some examples for development are:
    - [ganache](https://trufflesuite.com/ganache/) (probably the simplest to set up)
    - A private network with [geth](https://github.com/ethereum/go-ethereum)
    - An `evm` network using valueless tokens (e.g. [Görli](https://blog.infura.io/post/infura-supports-goerli-and-sepolia-as-ethereums-long-lived-testnets) or [Bloxberg](https://bloxberg.org))

For `python` and `node` requirements, please consult the respective `*requirements.txt` and `package.json` files.

The example browser application currently only works with Metamask as wallet. The dependencies used in development are:

* `chromium 108.0.5359.98` 
* `metamask (chromium extension) 10.23.1`

To use the contract address storage service in the example browser application, you also need:

* `rust >= 1.60 (cargo => 1.60)`


## Quickstart

```
git clone git://defalsify.org/craft-nft
cd craft-nft
make
```

The above will compile the smart contract, and copy it to the python and js environments. It will also download dependencies for python and javascript, compile the python package, and build the javascript browser library.


## Publishing the token contract

```
$ pip install $REPO_ROOT/dist/craft-nft-x.x.x.tar.gz 
```

```
craftnft-publish \
    --name <token name> \
    --symbol <token symbol> \
    --declaration-file <path to human readable file describing the token contract> \
    -p <evm rpc node provider> \
    -s -w
```

If successful, the `craftnft-publish` command will output the address of the token.

You can also run the script directly from the python directory without installing anything. The same argumnents apply as above. Make sure that you include the directory in python's path.

```
cd python
PYTHONPATH=. python craft_nft/runnable/publish.py <args>
```

## Allocating and minting tokens

There are CLI tools for allocating, minting and listing tokens. Here is a full example for tokens based on nonsensical token data:

```
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
```

The above code is stored in demo.sh. A bit of editing is needed to set up according to your environment and signing keys.

The outputs of a sample run should look something like this:

```
sh /home/lash/src/home/eth/craft-nft/python/demo.sh 
generating keys...
Alice has key Eb3907eCad74a0013c259D5874AE7f22DcBcC95C. This key will be used for signing
Bob has key e5E6656181108cCCB222243e1896bC0D0328af3B
Carol has key 9aB2C0f01CA7135a106829EFfBb2B303191352b3
Dave has key A952a6e57A45744a924B7bA5cC4Fbb42438EaEA5
publishing token ...
published token 7115070486ce22004D63D70f62F52175cedB3bAd
allocating unique token foo ...
allocating batched token bar ...
minting the foo token to Alice ...
minting a bar token to Bob ...
minting a bar token to Carol ...
minting a bar token to Alice ...
transfer Alice's bar token to Dave ...
token 2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae owned by Eb3907eCad74a0013c259D5874AE7f22DcBcC95C
token fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04f0000000000000000 owned by e5E6656181108cCCB222243e1896bC0D0328af3B - (id fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9 batch 0 index 0)
token fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04f0000000000000001 owned by 9aB2C0f01CA7135a106829EFfBb2B303191352b3 - (id fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9 batch 0 index 1)
token fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04f0000000000000002 owned by A952a6e57A45744a924B7bA5cC4Fbb42438EaEA5 - (id fcde2b2edba56bf408601fb721fe9b5c338d10ee429ea04fae5511b68fbf8fb9 batch 0 index 2)
```


## Using the javascript browser UI example.

In the `js` directory, create a file called `settings.json` with the following contents (replace the address with the one output from `craftnft-publish`):

```
{
    "contract": "<address of published contract>"
    "contentGatewayUrl": null
}
```

Then serve the `js` folder using a web server. For example:

```
cd js
# add -d to enable debugging output
webfsd -F -d -p <port>
```

## Content addressed storage

The example browser application uses the Wala service for content addressed storage and retrieval. The application will still work without the service, but some data will not be available for display.

Wala can currently only be provisioned through its git repository:

```
git clone git://defalsify.org/wala.git
cd wala
cargo build --release

# to see whats going on behind the scenes, add debug logging
export RUST_LOG=debug
target/release/wala -p <port>
```

For the example browser application to use the service, the `wala` url needs to be added to the `contentGatewayUrl` field of the settings.json file in the `js` directory.

### Data published to storage

The data in content-addressed storage used by the application is:

* The contract declaration (read)
* Token declarations (read/write)

See the `$REPO_ROOT/doc/latex/terminology.latex` document for a terminology overview.


## Further reading

For more details on the chainlib/chaintool contents, please refer to the [chaintool documentation repository](https://git.defalsify.org/chaintool-doc).

All chaintool related code repositories are hosted on [https://git.defalsify.org](https://git.defalsify.org)
