# About

This is a simple series of Ethereum contracts supporting a crowd-funded patronage system. Users can register their user name to create an associated patronage contract. Those users are paid when ether is sent to that patronage contract. The amount sent to that contract is shared with the shareholders of the patronage system. Shares can be purchased and sold on an included spot market exchange.

**IMPORTANT**: This is a work-in-progress and not fully tested. This **should not be used in a live system** and currently serves as an example.

# Contracts

## RevenueSharing.sol

This contract tracks the current shareholders, and can be used to allocate and withdrawal dividends.

## Exchange.sol

This contract implements a spot market for buying and seller shares in the revenue sharing system.

## PatronageRegistry.sol

This contract maintains a mapping of user names to their patronage contract. The registry should be maintained by the third party service that owns user name creation and hosts user content.

## Patronage.sol

One instance of this contract is created per register user. The contact shoudl receive any donations meant for that user, and will pay out a split to that user's payout address and the shareholders.
