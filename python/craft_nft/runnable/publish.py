"""Deploys badge NFT

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

# local imports
from craft_nft import CraftNFT

logg = logging.getLogger()


def process_config_local(config, arg, args, flags):
    config.add(args.name, '_TOKEN_NAME', False)
    config.add(args.symbol, '_TOKEN_SYMBOL', False)
    return config


arg_flags = ArgFlag()
arg = Arg(arg_flags)
flags = arg_flags.STD_WRITE | arg_flags.WALLET | arg_flags.CREATE | arg_flags.VALUE | arg_flags.TAB

argparser = chainlib.eth.cli.ArgumentParser()
argparser.add_argument('--name', type=str, required=True, help='Token name')
argparser.add_argument('--symbol', type=str, required=True, help='Token symbol')
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


#arg_flags = chainlib.eth.cli.argflag_std_write
#argparser = chainlib.eth.cli.ArgumentParser(arg_flags)
#argparser.add_argument('--name', dest='token_name', type=str, help='Token name')
#argparser.add_argument('--symbol', dest='token_symbol', type=str, help='Token symbol')
#args = argparser.parse_args()
#
#extra_args = {
#    'token_name': None,
#    'token_symbol': None,
#    }
#config = chainlib.eth.cli.Config.from_args(args, arg_flags, extra_args=extra_args, default_fee_limit=CraftNFT.gas())

#wallet = chainlib.eth.cli.Wallet()
#wallet.from_config(config)

#rpc = chainlib.eth.cli.Rpc(wallet=wallet)
#conn = rpc.connect_by_config(config)

#chain_spec = ChainSpec.from_chain_str(config.get('CHAIN_SPEC'))


def main():
    #signer = rpc.get_signer()
    #signer_address = rpc.get_sender_address()

    token_name = config.get('_TOKEN_NAME')
    token_symbol = config.get('_TOKEN_SYMBOL')
    conn = settings.get('CONN')

#    gas_oracle = rpc.get_gas_oracle()
#    nonce_oracle = rpc.get_nonce_oracle()

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
