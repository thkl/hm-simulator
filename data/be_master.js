const EventEmitter = require('events')

module.exports = class DeviceBehavior extends EventEmitter {
  constructor (address) {
    super(address)
    this.address = address
  }

  init () {

  }

  setReachability (reachable) {
    this.reachability = reachable
    this.emit('setValue', this.address + ':0', 'UNREACH', reachable)
  }

  isReachable () {
    return this.reachability
  }

  setValue (evAddress, dp, value) {

  }
}
