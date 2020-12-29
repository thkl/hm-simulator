const DeviceBehavior = require('./be_master.js')

module.exports = class Behavior extends DeviceBehavior {
  init () {
    let self = this
    setInterval(() => {
      // setup some values
      self.emit('setValue', self.address + ':1', 'BRIGHTNESS', self.randomNum(0, 1200))
      self.emit('setValue', self.address + ':1', 'MOTION', (self.randomNum(0, 2) === 1))
    }, 2000)
  }

  randomNum (min, max) {
    min = Math.ceil(min)
    max = Math.floor(max)
    return Math.floor(Math.random() * (max - min)) + min
  }
}
