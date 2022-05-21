// SPDX-License-Identifier: CAL
pragma solidity 0.8.10;

import "./Rain721A.sol";

contract Rain721AFactory {
    event NewChild(address newChild, address sender);

    function createChild(Rain721AConfig memory config_)
        public
        returns (address)
    {
        Rain721A rain721A = new Rain721A(config_);
        emit NewChild(address(rain721A), msg.sender);
        return address(rain721A);
    }
}
