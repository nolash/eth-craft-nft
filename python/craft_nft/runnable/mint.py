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
from chainlib.eth.address import to_checksum_address
from hexathon import strip_0x

# local imports
from craft_nft import CraftNFT

logg = logging.getLogger()


def process_config_local(config, arg, args, flags):
    token_id = strip_0x(args.token_id)
    bytes.fromhex(token_id)
    config.add(token_id, '_TOKEN_ID', False)

    config.add(args.batch, '_TOKEN_BATCH', False)
    config.add(args.index, '_TOKEN_INDEX', False)

    if args.fee_limit == None:
        config.add(200000, '_FEE_LIMIT', True)

    return config


def process_settings_local(settings, config):
    settings.set('TOKEN_ID', config.get('_TOKEN_ID'))

    if config.get('_POSARG') != None:
        recipient = to_checksum_address(config.get('_POSARG'))
        settings.set('RECIPIENT', recipient)

    settings.set('TOKEN_INDEX', config.get('_TOKEN_INDEX'))

    if (config.get('_TOKEN_BATCH') != None):
        settings.set('TOKEN_BATCH', config.get('_TOKEN_BATCH'))
        return settings

    conn = settings.get('CONN')
    c = CraftNFT(settings.get('CHAIN_SPEC'))
    i = 0
    while True:
        o = c.get_token_spec(
                settings.get('EXEC'),
                settings.get('TOKEN_ID'),
                i,
                )
        r = conn.do(o)
        spec = c.parse_token_spec(r)
        if spec.count == 0:
            if spec.cursor == 0:
                settings.set('TOKEN_BATCH', 0)
                return settings
        if spec.cursor < spec.count:
            settings.set('TOKEN_BATCH', i)
            return settings

        i += 1


arg_flags = ArgFlag()
arg = Arg(arg_flags)
flags = arg_flags.STD_WRITE | arg_flags.WALLET | arg_flags.CREATE | arg_flags.VALUE | arg_flags.TAB | arg_flags.EXEC

argparser = chainlib.eth.cli.ArgumentParser()
argparser = process_args(argparser, arg, flags)
argparser.add_argument('--token-id', type=str, required=True, help='Token id to mint from')
argparser.add_argument('--check', action='store_true', help='Only check whether a token can be minted')
argparser.add_argument('--batch', type=int, default=0, help='Mint from the given batch. If not specified, the first mintable batch will be used')
argparser.add_argument('--index', type=int, help='Index of token in batch to mint. If not specified, will mint next available index.')
argparser.add_argument('token_recipient', type=str, nargs='*', help='Recipient address')
args = argparser.parse_args(sys.argv[1:])

logg = process_log(args, logg)

config = Config()
config = process_config(config, arg, args, flags, positional_name='token_recipient')
config = process_config_local(config, arg, args, flags)
logg.debug('config loaded:\n{}'.format(config))

settings = ChainSettings()
settings = process_settings(settings, config)
settings = process_settings_local(settings, config)
logg.debug('settings loaded:\n{}'.format(settings))


def main():
    conn = settings.get('CONN')

    c = CraftNFT(
            settings.get('CHAIN_SPEC'),
            signer=settings.get('SIGNER'),
            gas_oracle=settings.get('FEE_ORACLE'),
            nonce_oracle=settings.get('NONCE_ORACLE')
            )

    (tx_hash_hex, o) = c.mint_to(
            settings.get('EXEC'),
            settings.get('SENDER_ADDRESS'),
            settings.get('RECIPIENT'),
            settings.get('TOKEN_ID'),
            settings.get('TOKEN_BATCH'),
            index=settings.get('TOKEN_INDEX'),
            )

    if config.get('_RPC_SEND'):
        conn.do(o)
        if config.true('_WAIT'):
            r = conn.wait(tx_hash_hex)
            if r['status'] == 0:
                sys.stderr.write('EVM revert while deploying contract. Wish I had more to tell you')
                sys.exit(1)
        print(tx_hash_hex)
    else:
        print(o)

if __name__ == '__main__':
    main()
