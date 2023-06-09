"""Output information about all minted tokens

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
from hexathon import strip_0x
from hexathon import add_0x

# local imports
from craft_nft import CraftNFT
from craft_nft.nft import to_batch_key

logg = logging.getLogger()

def process_config_local(config, arg, args, flags):
    contract = None
    try:
        contract = config.get('_EXEC_ADDRESS')
    except KeyError:
        pass

    if contract == None:
        address = config.get('_POSARG')
        if address:
            contract = add_0x(address)
        else:
            contract = stdin_arg()

    config.add(contract, '_CONTRACT', False)

    config.add(100000, '_FEE_LIMIT', True)

    token_id = None
    if args.token_id != None:
        token_id = strip_0x(args.token_id)
        bytes.fromhex(token_id)
    config.add(token_id, '_TOKEN_ID', False)

    return config


arg_flags = ArgFlag()
arg = Arg(arg_flags)

flags = arg_flags.STD_READ | arg_flags.EXEC | arg_flags.TAB

argparser = chainlib.eth.cli.ArgumentParser()
argparser = process_args(argparser, arg, flags)
argparser.add_argument('--token-id', dest='token_id', type=str, help='List mints for this token id only')
argparser.add_argument('contract_address', type=str, help='Token contract address (may also be specified by -e)')
args = argparser.parse_args()

logg = process_log(args, logg)

config = Config()
config = process_config(config, arg, args, flags, positional_name='contract_address')
config = process_config_local(config, arg, args, flags)
logg.debug('config loaded:\n{}'.format(config))

settings = ChainSettings()
settings = process_settings(settings, config)
logg.debug('settings loaded:\n{}'.format(settings))


def render_token_batches(c, conn, token_address, token_id, w=sys.stdout):
    i = 0
    while True:
        o = c.get_token_spec(token_address, token_id, i)
        r = None
        try:
            r = conn.do(o)
        except:
            break
        spec = c.parse_token_spec(r)

        if spec.sparse:
            logg.info('sparse token issuance detected. Will iterate through {} tokens, may take a while'.format(spec.count))
            for j in range(spec.count):
                token_id_indexed = to_batch_key(token_id, i, j)
                try:
                    render_token_mint(c, conn, token_address, token_id_indexed, w=w)
                except:
                    pass
        else:
            for j in range(spec.cursor):
                token_id_indexed = to_batch_key(token_id, i, j)
                render_token_mint(c, conn, token_address, token_id_indexed, w=w)

        i += 1


def render_token_mint(c, conn, token_address, token_id, w=sys.stdout):
    o = c.get_token(token_address, token_id)
    r = conn.do(o)
    token = c.parse_token(r, token_id)
    if token.minted:
        w.write('token {}\n'.format(token))


def render_token(c, conn, token_address, token_id, w=sys.stdout):
    token_id = strip_0x(token_id)
    o = c.get_token_spec(token_address, token_id, 0)
    r = conn.do(o)
    spec = c.parse_token_spec(r)
    if spec.count > 0:
        return render_token_batches(c, conn, token_address, token_id, w=sys.stdout)

    return render_token_mint(c, conn, token_address, token_id, w=w)


def main():
    token_address = config.get('_CONTRACT')
    conn = settings.get('CONN')
    c = CraftNFT(
            chain_spec=settings.get('CHAIN_SPEC'),
            gas_oracle=settings.get('GAS_ORACLE'),
            )

    outkeys = config.get('_OUTARG')

    i = 0

    if config.get('_TOKEN_ID') != None:
        render_token(c, conn, token_address, config.get('_TOKEN_ID'))
        return

    while True:
        o = c.token_at(token_address, i)
        r = None
        try:
            r = conn.do(o)
        except:
            break
        render_token(c, conn, token_address, r)
        i += 1


if __name__ == '__main__':
    main()
