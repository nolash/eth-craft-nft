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
    - ganache (probably the simplest to set up)
    - A private network with `geth`
    - An official `evm` testnet (e.g. Rinkeby or Ropsten)

For `python` and `node` requirements, please consult the respective `*requirements.txt` and `package.json` files.

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
$ pip install craft-nft

... or ...

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



## Using the javascript browser UI example.

In the `js` directory, create a file called `settings.json` with the following contents (replace the address with the one output from `craftnft-publish`):

```
{
    "contract": "<address of published contract>"
}
```

Then serve the `js` folder using a web server. For example:

```
cd js
# add -d to enable debugging output
webfsd -F -d -p <port>
```

## Content addressed server

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
