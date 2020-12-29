const DeviceBehavior = require('be_master.js')
module.exports = class Behavior extends DeviceBehavior {
  init () {
    this.currentState = 0
    this.emit('setValue', this.address + ':1', 'STATE', 0)
  }

  setValue (evAddress, dp, value) {
    let self = this
    if ((evAddress === this.address + ':1') && (dp === 'STATE')) {
      if (value === 1) {
        // Lock the door
        this.newState = 0
        this.emit('setValue', this.address + ':1', 'DIRECTION', 1)
      } else {
        // unlock the door
        this.newState = 1
        this.emit('setValue', this.address + ':1', 'DIRECTION', 2)
      }
      setTimeout(() => {
        self.emit('setValue', self.address + ':1', 'DIRECTION', 0)
        self.emit('setValue', self.address + ':1', 'STATE', self.newState)
      }, 10000)
    }
    // Open the door
    if ((evAddress === this.address + ':1') && (dp === 'OPEN')) {
      this.emit('setValue', this.address + ':1', 'DIRECTION', 1)
      setTimeout(() => {
        self.emit('setValue', self.address + ':1', 'DIRECTION', 0)
        self.emit('setValue', self.address + ':1', 'STATE', 1)
      }, 10000)
    }
  }
}
