const DeviceBehavior = require('./be_master.js')
module.exports = class Behavior extends DeviceBehavior {
  init () {
    // init with default values
    this.currentValue = 0
    this.emit('setValue', this.address + ':1', 'INHIBIT', false)
    this.emit('setValue', this.address + ':1', 'LEVEL', this.currentValue)
    this.emit('setValue', this.address + ':1', 'WORKING', false)
    this.emit('setValue', this.address + ':1', 'DIRECTION', 0)
  }

  setValue (evAddress, dp, value) {
    let self = this
    if ((evAddress === this.address + ':1') && (dp === 'LEVEL')) {
      self.emit('setValue', self.address + ':1', 'WORKING', true)
      if (value > self.currentValue) {
        self.direction = 0.05
        self.emit('setValue', self.address + ':1', 'DIRECTION', 1)
      } else {
        self.direction = -0.05
        self.emit('setValue', self.address + ':1', 'DIRECTION', 2)
      }

      self.intfl = setInterval(() => {
        if (((self.currentValue >= value) && (self.direction === 0.05)) ||
        ((self.currentValue <= value) && (self.direction === -0.05))) {
          clearInterval(self.intfl)
          self.emit('setValue', self.address + ':1', 'LEVEL', value)
          self.emit('setValue', self.address + ':1', 'WORKING', false)
          self.emit('setValue', self.address + ':1', 'DIRECTION', 0)
        } else {
          self.currentValue = self.currentValue + self.direction
          self.emit('setValue', self.address + ':1', 'LEVEL', self.currentValue)
        }
      }, 1000)
    }

    if ((evAddress === this.address + ':1') && (dp === 'STOP')) {
      clearInterval(self.intfl)
      self.emit('setValue', self.address + ':1', 'LEVEL', self.currentValue)
      self.emit('setValue', self.address + ':1', 'WORKING', false)
      self.emit('setValue', self.address + ':1', 'DIRECTION', 0)
    }
  }
}
