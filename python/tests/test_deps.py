# standard imports
import unittest

# external imports
from eth_owned.unittest import TestInterface as TestInterfaceOwned

# local imports
from craft_nft.unittest import TestCraftNFT


class TestDeps(TestCraftNFT, TestInterfaceOwned):
    pass


if __name__ == '__main__':
    unittest.main()
