"""Publish a new NFT smart contract to the network

.. moduleauthor:: Louis Holbrook <dev@holbrook.no>
.. pgp:: 0826EDA1702D1E87C6E2875121D2E7BB88C2A746 

"""

# SPDX-License-Identifier: GPL-3.0-or-later

# standard imports
import sys
import os
import json
import argparse
import logging
import time
import hashlib
from enum import Enum

# external imports
import chainlib.eth.cli
from chainlib.chain import ChainSpec
from chainlib.eth.constant import ZERO_ADDRESS
from chainlib.settings import ChainSettings
from chainlib.eth.settings import process_settings
from chainlib.eth.cli.arg import Arg
from chainlib.eth.cli.arg import ArgFlag
from chainlib.eth.cli.arg import process_args
from chainlib.eth.cli.log import process_log
from chainlib.eth.cli.config import Config
from chainlib.eth.cli.config import process_config
from chainlib.eth.constant import ZERO_CONTENT
from hexathon import strip_0x

# local imports
from craft_nft import CraftNFT

logg = logging.getLogger()


def process_config_local(config, arg, args, flags):
    config.add(args.name, '_TOKEN_NAME', False)
    config.add(args.symbol, '_TOKEN_SYMBOL', False)

    declaration_hash = ZERO_CONTENT
    if args.declaration_file != None:
        f = open(args.declaration_file, 'r')
        declaration = f.read()
        f.close()
        h = hashlib.sha256()
        h.update(declaration.encode('utf-8'))
        z = h.digest()
        declaration_hash = z.hex()
    declaration_hash = strip_0x(declaration_hash)
    config.add(declaration_hash, '_TOKEN_DECLARATION̈́', False)
    logg.debug('declaration hash is {}'.format(declaration_hash))
    if args.fee_limit == None:
        config.add(CraftNFT.gas(), '_FEE_LIMIT', True)

    return config

arg_flags = ArgFlag()
arg = Arg(arg_flags)
flags = arg_flags.STD_WRITE | arg_flags.WALLET | arg_flags.VALUE | arg_flags.TAB

argparser = chainlib.eth.cli.ArgumentParser()
argparser.add_argument('--name', type=str, required=True, help='Token name')
argparser.add_argument('--symbol', type=str, required=True, help='Token symbol')
argparser.add_argument('--declaration-file', dest='declaration_file', type=str, help='File describing the purpose and terms of the token')
argparser = process_args(argparser, arg, flags)
args = argparser.parse_args(sys.argv[1:])

logg = process_log(args, logg)

config = Config()
config = process_config(config, arg, args, flags)
config = process_config_local(config, arg, args, flags)
logg.debug('config loaded:\n{}'.format(config))

settings = ChainSettings()
settings = process_settings(settings, config)
logg.debug('settings loaded:\n{}'.format(settings))


def main():
    token_name = config.get('_TOKEN_NAME')
    token_symbol = config.get('_TOKEN_SYMBOL')
    token_declaration = config.get('_TOKEN_DECLARATION̈́')
    conn = settings.get('CONN')

    c = CraftNFT(
            settings.get('CHAIN_SPEC'),
            signer=settings.get('SIGNER'),
            gas_oracle=settings.get('FEE_ORACLE'),
            nonce_oracle=settings.get('NONCE_ORACLE')
            )

    (tx_hash_hex, o) = c.constructor(
            settings.get('SENDER_ADDRESS'),
            token_name,
            token_symbol,
            #token_declaration,
            #enumeration=True,
            )
    if config.get('_RPC_SEND'):
        conn.do(o)
        if config.true('_WAIT'):
            r = conn.wait(tx_hash_hex)
            if r['status'] == 0:
                sys.stderr.write('EVM revert while deploying contract. Wish I had more to tell you')
                sys.exit(1)
            # TODO: pass through translator for keys (evm tester uses underscore instead of camelcase)
            address = r['contractAddress']

            print(address)
        else:
            print(tx_hash_hex)
    else:
        print(o)

if __name__ == '__main__':
    main()
