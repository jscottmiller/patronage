contract('PatronageRegistry', function(accounts) {
  it("should not allow default sends", function() {
    var registry = PatronageRegistry.deployed();
    var failed = false;
    var registrar;
    var startingBalance;
    
    return registry.registrar().then(function(_registrar) {
      registrar = _registrar;
      var other = accounts.find(function(a) { return a != registrar });
      return web3.eth.getBalance(registrar);
    }).then(function(balance) {
      startingBalance = balance;
      return web3.eth.sendTransaction({from: patron, to: address, value: donationAmount});
    }).catch(function(e) {
      failed = true;
    }).then(function() {
      assert.isTrue(failed);
      return web3.eth.getBalance(registrar);
    }).then(function(balance) {
      assert.equal(startingBalance.toString(), balance.toString());
    });
  });

  it("should allow the registrar to update registrar", function() {
    var registry = PatronageRegistry.deployed();

    var originalRegistrar;
    var newRegistrar;

    return registry.registrar().then(function(registrar) {
      originalRegistrar = registrar;
      newRegistrar = accounts.find(function(a) { return a != registrar });
      return registry.updateRegistrar(newRegistrar, {from: originalRegistrar});
    }).then(function() {
      return registry.registrar();
    }).then(function(registrar) {
      assert.equal(registrar, newRegistrar);
    });
  });

  it("shouldn't allow others to update the registrar", function() {
    var registry = PatronageRegistry.deployed();

    var originalRegistrar;
    var newRegistrar;
    var failed = false;

    return registry.registrar().then(function(registrar) {
      originalRegistrar = registrar;
      newRegistrar = accounts.find(function(a) { return a != registrar });
      return registry.updateRegistrar(newRegistrar, {from: newRegistrar});
    }).catch(function(e) {
      failed = true;
    }).then(function() {
      return registry.registrar();
    }).then(function(registrar) {
      assert.equal(registrar, originalRegistrar);
      assert.isTrue(failed);
    });
  });

  it("should allow the registrar to register a new name", function() {
    var registry = PatronageRegistry.deployed();
    var username = 'user' + Math.floor(10000 * Math.random());

    var currentRegistrar;
    var payoutAddress;

    return registry.registrar().then(function(registrar) {
      currentRegistrar = registrar;
      payoutAddress = accounts.find(function(a) { return a != registrar; });
      return registry.registerUsername(username, payoutAddress, {from: registrar});
    }).then(function() {
      return registry.patronageContractForUsername.call(username);
    }).then(function(address) {
      var patronage = Patronage.at(address);
      return patronage.payoutAddress();
    }).then(function(address) {
      assert.equal(payoutAddress, address);
    });
  });

  it("shouldn't allow a non-registrar to register a name", function() {
    var registry = PatronageRegistry.deployed();
    var username = 'user' + Math.floor(10000 * Math.random());
    var failed = false;

    return registry.registrar().then(function(registrar) {
      var other = accounts.find(function(a) { return a != registrar });
      return registry.registerUsername(username, other, {from: other});
    }).then(function() {
      return registry.patronageContractForUsername.call(username);
    }).catch(function(e) {
      failed = true;
    }).then(function() {
      assert.isTrue(failed);
      return registry.patronageContractForUsername.call(username);
    }).catch(function(e) {
      failed = failed && true;
    }).then(function() {
      assert.isTrue(failed);
    });
  });

  it("shouldn't allow the same name to be registered twice", function() {
    var registry = PatronageRegistry.deployed();
    var username = 'user' + Math.floor(10000 * Math.random());

    var currentRegistrar;
    var payoutAddress;
    var failed = false;

    return registry.registrar().then(function(registrar) {
      currentRegistrar = registrar;
      payoutAddress = accounts.find(function(a) { return a != registrar; });
      return registry.registerUsername(username, payoutAddress, {from: registrar});
    }).then(function() {
      return registry.patronageContractForUsername.call(username);
    }).then(function(address) {
      var patronage = Patronage.at(address);
      return patronage.payoutAddress();
    }).then(function(address) {
      assert.equal(payoutAddress, address);
    }).then(function() {
      var other = accounts.find(function(a) { return [currentRegistrar, payoutAddress].indexOf(a) == -1; });
      return registry.registerUsername(username, other, {from: registrar});
    }).catch(function(e) {
      failed = true;
    }).then(function() {
      assert.isTrue(failed);
      return registry.patronageContractForUsername.call(username);
    }).then(function(address) {
      var patronage = Patronage.at(address);
      return patronage.payoutAddress();
    }).then(function(address) {
      assert.equal(payoutAddress, address);
    });
  });

  it("should allow patronage owners to update payout address", function() {
    var registry = PatronageRegistry.deployed();
    var username = 'user' + Math.floor(10000 * Math.random());

    var currentRegistrar;
    var payoutAddress;
    var newPayoutAddress;
    var patronage;

    return registry.registrar().then(function(registrar) {
      currentRegistrar = registrar;
      payoutAddress = accounts.find(function(a) { return a != registrar; });
      return registry.registerUsername(username, payoutAddress, {from: registrar});
    }).then(function() {
      return registry.patronageContractForUsername.call(username);
    }).then(function(address) {
      patronage = Patronage.at(address);
      return patronage.payoutAddress();
    }).then(function(address) {
      assert.equal(payoutAddress, address);
      newPayoutAddress = accounts.find(function(a) { 
        return [currentRegistrar, payoutAddress].indexOf(a) == -1;
      });
      return patronage.updatePayoutAddress(newPayoutAddress, {from: payoutAddress});
    }).then(function() {
      return patronage.payoutAddress();
    }).then(function(address) {
      assert.equal(newPayoutAddress, address);
    });
  });

  it("shouldn't allow others to update payout address", function() {
    var registry = PatronageRegistry.deployed();
    var username = 'user' + Math.floor(10000 * Math.random());

    var currentRegistrar;
    var payoutAddress;
    var patronage;
    var failed = false;

    return registry.registrar().then(function(registrar) {
      currentRegistrar = registrar;
      payoutAddress = accounts.find(function(a) { return a != registrar; });
      return registry.registerUsername(username, payoutAddress, {from: registrar});
    }).then(function() {
      return registry.patronageContractForUsername.call(username);
    }).then(function(address) {
      patronage = Patronage.at(address);
      return patronage.payoutAddress();
    }).then(function(address) {
      assert.equal(payoutAddress, address);
      var other = accounts.find(function(a) { 
        return [currentRegistrar, payoutAddress].indexOf(a) == -1;
      });
      return patronage.updatePayoutAddress(other, {from: currentRegistrar});
    }).catch(function(e) {
      failed = true;
    }).then(function() {
      assert.isTrue(failed);
      return patronage.payoutAddress();
    }).then(function(address) {
      assert.equal(payoutAddress, address);
    });
  });

  it("should not allow withdrawals if balance is zero", function() {
    var registry = PatronageRegistry.deployed();
    var username = 'user' + Math.floor(10000 * Math.random());

    var currentRegistrar;
    var payoutAddress;
    var failed = false;

    return registry.registrar().then(function(registrar) {
      currentRegistrar = registrar;
      payoutAddress = accounts.find(function(a) { return a != registrar; });
      return registry.registerUsername(username, payoutAddress, {from: registrar});
    }).then(function() {
      return registry.patronageContractForUsername(username);
    }).then(function(address) {
      var patronage = Patronage.at(address);
      return patronage.withdrawal();
    }).catch(function(e) {
      failed = true;
    }).then(function() {
      assert.isTrue(failed);
    });
  });

  it("should pay balance to shareholders and owner", function() {
    var registry = PatronageRegistry.deployed();
    var username = 'user' + Math.floor(10000 * Math.random());
    var donationAmount = 10000;

    var patronage;
    var patronageAddress;
    var registrarAddress;
    var shareholderAddress;
    var payoutAddress;
    var shareholderBalance;
    var payoutBalance;

    return registry.registrar().then(function(registrar) {
      registrarAddress = registrar;
      return registry.shareholders();
    }).then(function(shareholders) {
      shareholderAddress = shareholders;
      payoutAddress = accounts.find(function(a) { return a != registrarAddress && a != shareholderAddress; });
      return web3.eth.getBalance(payoutAddress);
    }).then(function(balance) {
      payoutBalance = balance;
      return web3.eth.getBalance(shareholderAddress);
    }).then(function(balance) {
      shareholderBalance = balance;
      return registry.registerUsername(username, payoutAddress, {from: registrarAddress});
    }).then(function() {
      return registry.patronageContractForUsername.call(username);
    }).then(function(address) {
      patronageAddress = address;
      patronage = Patronage.at(patronageAddress);
      var patron = accounts.find(function(a) { 
        return [registrarAddress, payoutAddress, shareholderAddress].indexOf(a) == -1; 
      });
      return web3.eth.sendTransaction({from: patron, to: address, value: donationAmount});
    }).then(function() {
      return web3.eth.getBalance(patronageAddress);
    }).then(function(balance) {
      assert.equal(donationAmount, balance.toNumber());
    }).then(function() {
      return patronage.withdrawal({from: registrarAddress});
    }).then(function() {
      return web3.eth.getBalance(patronageAddress);
    }).then(function(balance) {
      assert.equal(0, balance.toNumber());
      return web3.eth.getBalance(payoutAddress);
    }).then(function(balance) {
      assert.equal(payoutBalance.add(9000).toString(), balance.toString());
      return web3.eth.getBalance(shareholderAddress);
    }).then(function(balance) {
      assert.equal(shareholderBalance.add(1000).toString(), balance.toString());
    });
  });
});
