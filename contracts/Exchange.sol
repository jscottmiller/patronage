contract Custodian {
    function reserve(address owner, uint amount);
    function unreserve(address owner, uint amount);
    function transfer(address oldOwner, address newOwner, uint shares);
}

contract Exchange {
    enum Side { Bid, Ask }
    struct Offer {
        address owner;
        uint price;
        bool active;
        Side side;
        int16 nextIndex;
        uint32 shares;
    }

    int32 constant maximumDepth = 1000;
    int16 topAskIndex = -1;
    int16 topBidIndex = -1;
    mapping (address => uint) balances;
    Custodian custodian;
    Offer[1000] offers;

    function Exchange() {
        custodian = Custodian(msg.sender);
    }

    function postOffer(Side side, uint price, uint32 shares) {
        if (price == 0 || shares == 0) {
            throw;
        }
        if (side == Side.Bid) {
            if (price * shares != msg.value) {
                throw;
            }
        } else {
            custodian.reserve(msg.sender, shares);
        }
        uint32 remainingShares = shares;
        int16 top = side == Side.Ask ? topBidIndex : topAskIndex;
        if (top != -1) {
            int16 index = top;
            Offer next = offers[uint(top)];
            bool matches = (
                (side == Side.Bid && next.price <= price) ||
                (side == Side.Ask && next.price >= price)
            );
            while (next.active && matches) {
                address seller = side == Side.Bid ? next.owner : msg.sender;
                address buyer = side == Side.Bid ? msg.sender : next.owner;
                if (next.shares <= remainingShares) {
                    balances[seller] = next.shares * next.price;
                    remainingShares -= next.shares;
                    offers[uint(index)].active = false;
                    custodian.unreserve(seller, next.shares);
                    custodian.transfer(seller, buyer, next.shares);
                } else {
                    balances[seller] = remainingShares * next.price;
                    offers[uint(index)].shares = next.shares - remainingShares;
                    remainingShares = 0;
                    custodian.unreserve(seller, remainingShares);
                    custodian.transfer(seller, buyer, remainingShares);
                }
                index = next.nextIndex;
                next = offers[uint(index)];
                matches = (
                    (side == Side.Bid && next.price <= price) ||
                    (side == Side.Ask && next.price >= price)
                );
            }
        }
        if (remainingShares < 0) {
            throw;
        }
        if (remainingShares == 0) {
            return;
        }
        int16 newIndex = 0;
        while (offers[uint(newIndex)].active) {
            if (++newIndex >= maximumDepth) {
                throw;
            }
        }
        int16 previousIndex = -1;
        int16 nextIndex = side == Side.Bid ? topBidIndex : topAskIndex;
        while (nextIndex != -1 && offers[uint(nextIndex)].price > price) {
            previousIndex = nextIndex;
            nextIndex = offers[uint(nextIndex)].nextIndex;
        }
        if (previousIndex == -1) {
            if (side == Side.Bid) {
                topBidIndex = newIndex;
            } else {
                topAskIndex = newIndex;
            }
        } else {
            offers[uint(previousIndex)].nextIndex = newIndex;
        }
        offers[uint(newIndex)] = Offer(msg.sender, price, true, side, nextIndex, remainingShares);
    }

    function getNumberOfOffers(Side side) returns (uint16) {
        uint16 count = 0;
        int16 currentIndex = side == Side.Bid ? topBidIndex : topAskIndex;
        while (currentIndex != -1) {
            count++;
            currentIndex = offers[uint(currentIndex)].nextIndex;
        }
        return count;
    }

    function cancelOffer(Side side, uint price, uint32 shares) {
        bool found = false;
        int16 parentIndex = -1;
        int16 currentIndex = side == Side.Bid ? topBidIndex : topAskIndex;
        while (currentIndex != -1 && !found) {
            Offer offer = offers[uint(currentIndex)];
            found = (
                offer.owner == msg.sender &&
                offer.side == side &&
                offer.price == price &&
                offer.shares >= shares
            );
            if (found) {
                break;
            }
            parentIndex = currentIndex;
            currentIndex = offer.nextIndex;
        }
        if (!found) {
            throw;
        }
        Offer matchingOffer = offers[uint(currentIndex)];
        uint32 remainingShares = shares - matchingOffer.shares;
        if (remainingShares > 0) {
            offers[uint(currentIndex)].shares -= shares;
        } else {
            matchingOffer.active = false;
            if (parentIndex != -1) {
                offers[uint(parentIndex)].nextIndex = matchingOffer.nextIndex;
            } else {
                if (side == Side.Bid) {
                    topBidIndex = matchingOffer.nextIndex;
                } else {
                    topAskIndex = matchingOffer.nextIndex;
                }
            }
        }
        if (side == Side.Bid) {
            balances[msg.sender] += price * shares;
        } else {
            custodian.unreserve(msg.sender, shares);
        }
    }

    function withdrawal() {
        uint amount = balances[msg.sender];
        if (amount == 0) {
            throw;
        }
        balances[msg.sender] = 0;
        if (!msg.sender.send(amount)) {
            throw;
        }
    }

    function getBalance() returns (uint) {
        return balances[msg.sender];
    }

    function() {
        throw;
    }
}
