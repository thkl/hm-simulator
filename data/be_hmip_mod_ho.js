const DeviceBehavior = require('./be_master.js')
module.exports = class Behavior extends DeviceBehavior {
  init () {
    // init with default values
    this.emit('setValue', this.address + ':1', 'DOOR_STATE', 0)
    this.emit('setValue', this.address + ':1', 'PROCESS', 0)
    this.door_state = 0
  }

  setValue (evAddress, dp, value) {
    let self = this
    if ((evAddress === this.address + ':1') && (dp === 'DOOR_COMMAND')) {
      // send the current door state
      this.emit('setValue', this.address + ':1', 'DOOR_STATE', self.door_state, true)

      setTimeout(() => {
        self.emit('setValue', self.address + ':1', 'PROCESS', 0, true)
      }, 500)

      // then the door is moving
      if (value === 1) { // Open command
        self.door_state = 3
      }

      if (value === 3) { // Close Command
        self.door_state = 0
      }

      if (value === 4) { // Vent Command
        self.door_state = 2
      }
      // send the new door state
      setTimeout(() => {
        self.emit('setValue', self.address + ':1', 'DOOR_STATE', self.door_state)
      }, 2000)
      // then change the process
      setTimeout(() => { // make sure the event was sent after the new door state
        self.emit('setValue', self.address + ':1', 'PROCESS', 1)
      }, 2100)

      setTimeout(() => { // and then send the process done event
        self.emit('setValue', self.address + ':1', 'PROCESS', 0)
        // and the new state again
        self.emit('setValue', self.address + ':1', 'DOOR_STATE', self.door_state)
      }, 10000)
    }
  }
}
