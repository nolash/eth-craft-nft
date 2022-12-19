"""Allocates a new token or token batch

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
    token_id = strip_0x(config.get('_POSARG'))
    bytes.fromhex(token_id)
    config.add(token_id, '_TOKEN_ID', False)

    assert args.count < 2**48
    config.add(args.count, '_TOKEN_COUNT', False)
    return config


arg_flags = ArgFlag()
arg = Arg(arg_flags)
flags = arg_flags.STD_WRITE | arg_flags.CREATE | arg_flags.VALUE | arg_flags.TAB | arg_flags.EXEC

argparser = chainlib.eth.cli.ArgumentParser()
argparser = process_args(argparser, arg, flags)
argparser.add_argument('--count', default=0, type=int, required=True, help='Amount of tokens in batch')
argparser.add_argument('token_id', type=str, nargs='*', help='token id: sha256 sum of token data, in hex')
args = argparser.parse_args(sys.argv[1:])

logg = process_log(args, logg)

config = Config()
config = process_config(config, arg, args, flags, positional_name='token_id')
config = process_config_local(config, arg, args, flags)
logg.debug('config loaded:\n{}'.format(config))

settings = ChainSettings()
settings = process_settings(settings, config)
logg.debug('settings loaded:\n{}'.format(settings))


def main():
    token_id = config.get('_TOKEN_ID')
    token_count = config.get('_TOKEN_COUNT')
    conn = settings.get('CONN')

    c = CraftNFT(
            settings.get('CHAIN_SPEC'),
            signer=settings.get('SIGNER'),
            gas_oracle=settings.get('FEE_ORACLE'),
            nonce_oracle=settings.get('NONCE_ORACLE')
            )

    (tx_hash_hex, o) = c.allocate(
            settings.get('EXEC'),
            settings.get('SENDER_ADDRESS'),
            token_id,
            token_count,
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
