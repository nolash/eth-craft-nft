# standard imports
import os

# external imports
from chainlib.eth.tx import TxFormat
from eth_erc721 import ERC721
from hexathon import strip_0x

moddir = os.path.dirname(__file__)
datadir = os.path.join(moddir, 'data')


class CraftNFT(ERC721):

    __abi = None
    __bytecode = None

    @staticmethod
    def abi():
        if CraftNFT.__abi == None:
            f = open(os.path.join(datadir, 'CraftNFT.json'), 'r')
            CraftNFT.__abi = json.load(f)
            f.close()
        return CraftNFT.__abi


    @staticmethod
    def bytecode():
        if CraftNFT.__bytecode == None:
            f = open(os.path.join(datadir, 'CraftNFT.bin'))
            CraftNFT.__bytecode = f.read()
            f.close()
        return CraftNFT.__bytecode


    @staticmethod
    def gas(code=None):
        return 4000000

    
    def constructor(self, sender_address, name, symbol, tx_format=TxFormat.JSONRPC):
        code = CraftNFT.bytecode()
        enc = ABIContractEncoder()
        enc.string(name)
        enc.string(symbol)
        code += enc.get()
        tx = self.template(sender_address, None, use_nonce=True)
        tx = self.set_code(tx, code)
        return self.finalize(tx, tx_format)

