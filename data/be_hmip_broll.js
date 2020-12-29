const DeviceBehavior = require('./be_master.js')
module.exports = class Behavior extends DeviceBehavior {
  init () {
    this.currentValue = 0
  }

  setValue (evAddress, dp, value) {
    console.log('setValue Event %s %s %s', evAddress, dp, value)
    let self = this
    if ((evAddress === this.address + ':4') && (dp === 'LEVEL')) {
      self.emit('setValue', self.address + ':3', 'LEVEL', self.currentValue, true)
      self.emit('setValue', self.address + ':3', 'PROCESS', 1)
      if (value > self.currentValue) {
        self.direction = 0.05
        self.emit('setValue', self.address + ':3', 'ACTIVITY_STATE', 1)
      } else {
        self.direction = -0.05
        self.emit('setValue', self.address + ':3', 'ACTIVITY_STATE', 2)
      }

      self.intfl = setInterval(() => {
        self.currentValue = self.currentValue + self.direction
        self.emit('setValue', self.address + ':3', 'LEVEL', self.currentValue)
        if (((self.currentValue >= value) && (self.direction === 0.05)) ||
        ((self.currentValue <= value) && (self.direction === -0.05))) {
          clearInterval(self.intfl)
          self.emit('setValue', self.address + ':3', 'LEVEL', self.value)
          self.emit('setValue', self.address + ':4', 'LEVEL', self.value)
          self.emit('setValue', self.address + ':3', 'PROCESS', 0)
          self.emit('setValue', self.address + ':3', 'ACTIVITY_STATE', 3)
        }
      }, 1000)
    }
  }
}
