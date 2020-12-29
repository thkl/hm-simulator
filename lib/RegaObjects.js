const { EventEmitter } = require('events')
const fs = require('fs')
const path = require('path')
const moment = require('moment')

const OT_CHANNEL = 'CHANNEL'
const OT_OBJECT = 'OBJECT'
const OT_INTERFACE = 'INTERFACE'
const OT_DEVICE = 'DEVICE'
const OT_ROOM = 'ROOM'
const OT_DP = 'DP'
const OT_ENUM = 'ENUM'
const OT_PROGRAM = 'PROGRAM'
const OT_VARIABLE = 'VARIABLE'
const OT_ALARMDP = 'ALARMDP'

const ID_ROOT = 2
const ID_INTERFACES = 9
const ID_PROGRAMS = 15
const ID_ROOMS = 101
const ID_SYSTEM_VARIABLES = 27
const ID_SERVICES = 28

class RegaObject extends EventEmitter {
  constructor (dom, type) {
    super()
    this.dom = dom
    this.id = -1
    this.typename = type || OT_OBJECT
  }

  init (obj) {
    this.name = obj.name
  }

  ID (newID) {
    if (newID !== undefined) {
      this.id = newID
    } else {
      return this.id
    }
  }

  Name (newName) {
    if (newName !== undefined) {
      this.name = newName
    } else {
      return this.name
    }
  }

  Type () {
    return this.type
  }

  TypeName () {
    return this.typename
  }

  toString () {
    return this.name || this.id
  }

  Save () {

  }

  IsTypeOf (tp) {
    return this.typename === tp
  }

  toJson () {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      typename: this.typename
    }
  }
}

class RegaServiceMessage extends RegaObject {
  constructor (dom) {
    super(dom, OT_ALARMDP)
  }

  AlState (newState) {
    if (newState !== undefined) {
      this.alState = newState
    } else {
      return this.alState
    }
  }

  AlTriggerDP (newDPId) {
    if (newDPId !== undefined) {
      this.triggerDP = newDPId
    } else {
      return this.triggerDP
    }
  }

  Timestamp (newTimeStamp) {
    if (newTimeStamp !== undefined) {
      this.timeStamp = newTimeStamp
    } else {
      return this.timeStamp
    }
  }

  AlReceipt () {
    this.dom.DeleteObject(this)
  }
}

class RegaEnum extends RegaObject {
  constructor (dom, type) {
    super(dom, type || OT_ENUM)
    this._children = []
  }

  Add (id) {
    if (typeof id === 'number') {
      this._children.push(id)
      if (this._dom) {
        let obj = this._dom.GetObject(id)
        if (obj) {
          this._parent = obj
        }
      }
    } else {
      console.log('unable to add', id)
    }
  }

  toJson () {
    let result = super.toJson()
    result.children = this._children
    return result
  }
}

class RegaProgram extends RegaObject {
  constructor (dom, type) {
    super(dom, type || OT_PROGRAM)
  }

  PrgInfo (newInfo) {
    if (newInfo !== undefined) {
      this.info = newInfo
    } else {
      return this.url
    }
  }

  ProgramLastExecuteTime () {
    return this.lastExecution
  }

  ProgramLastExecuteTimeSeconds () {

  }

  ProgramExecute () {
    this.lastExecution = new Date()
  }

  toJson () {
    let result = super.toJson()
    result.info = this.info
    return result
  }
}

class RegaInterface extends RegaEnum {
  constructor (dom) {
    super(dom, OT_INTERFACE)
    this.type = 458753
  }

  InterfaceUrl (newUrl) {
    if (newUrl !== undefined) {
      this.url = newUrl
    } else {
      return this.url
    }
  }

  InterfaceInfo (newInfo) {
    if (newInfo !== undefined) {
      this.info = newInfo
    } else {
      return this.info
    }
  }

  toJson () {
    let result = super.toJson()
    result.InterfaceUrl = this.url
    result.InterfaceInfo = this.info
    return result
  }
}

class RegaDatapoint extends RegaEnum {
  constructor (dom) {
    super(dom, OT_DP)
    this.type = 393281
  }

  ValueType (valueType) {
    if (valueType !== undefined) {
      this.valueType = valueType
    } else {
      return this.valueType
    }
  }

  HssDP (dpName) {
    if (dpName !== undefined) {
      this.dpName = dpName
    } else {
      return this.dpName
    }
  }

  Channel () {
    return this._parent
  }

  State (newState, inhibitEvent = false) {
    if (newState !== undefined) {
      this.lastValue = this.value
      this.value = newState
      this.timeStamp = moment()
      if (inhibitEvent === false) {
        // this is a vehicle to prevent the system from looping
        this.dom.emit('setValue', this.Name(), newState)
        return true
      } else {
        return false
      }
    } else {
      return this.value
    }
  }

  Timestamp () {
    return this.timeStamp.format('YYYY-MM-DD HH:mm:ss')
  }

  Value (newValue, inhibitEvent = false) {
    if (newValue !== undefined) {
      return this.State(newValue, inhibitEvent)
    } else {
      return this.value
    }
  }

  toJson () {
    let result = super.toJson()
    result.valueType = this.valueType
    result.channel = this._parent
    return result
  }
}

class RegaChannel extends RegaEnum {
  constructor (dom) {
    super(dom, OT_CHANNEL)
    this.type = 33
    this.accessRights = {}
  }

  Address (newAddress) {
    if (newAddress) {
      this.address = newAddress
    } else {
      return this.address
    }
  }

  HssType (newHssType) {
    if (newHssType) {
      this.hsstype = newHssType
    } else {
      return this.hsstype
    }
  }

  DPByHssDP (dpName) {
    let rslt = this._children.filter((dpo) => {
      return (dpo.HssDP() === dpName)
    })
    if (rslt.length > 0) {
      return rslt[0]
    } else {
      return null
    }
  }

  DPs () {
    let result = new RegaList(this.dom)
    result._children = this._children
    return result
  }

  UserAccessRights (level, newRights) {
    if (newRights) {
      this.accessRights[level] = newRights
    } else {
      return this.accessRights[level]
    }
  }

  _addDataPoint (dp) {
    this.DPs().Add(dp.ID())
    dp._parent = this.ID()
  }

  toJson () {
    let result = super.toJson()
    result.address = this.address
    result.hsstype = this.hsstype
    result.accessRights = this.accessRights
    return result
  }
}

class RegaDevice extends RegaEnum {
  constructor (dom) {
    super(dom, OT_DEVICE)
    this.type = 17
  }

  Address (newAddress) {
    if (newAddress !== undefined) {
      this.address = newAddress
    } else {
      return this.address
    }
  }

  HssType (newHssType) {
    if (newHssType !== undefined) {
      this.hsstype = newHssType
    } else {
      return this.hsstype
    }
  }

  Channels () {
    let result = new RegaList(this.dom)
    result._children = this._children
    return result
  }

  Interface (newInterface) {
    if (newInterface !== undefined) {
      this.intfid = newInterface
    } else {
      return this.intfid
    }
  }

  toJson () {
    let result = super.toJson()
    result.address = this.address
    result.hsstype = this.hsstype
    result.intfid = this.intfid
    return result
  }
}

class RegaRoom extends RegaEnum {
  constructor (dom) {
    super(dom, OT_ROOM)
    this.type = OT_ROOM
  }

  Channels () {
    let result = new RegaList(this.dom)
    result._children = this._children
    return result
  }
}

class RegaVariable extends RegaObject {
  constructor (dom) {
    super(dom, OT_VARIABLE)
    this.type = ID_SYSTEM_VARIABLES
  }

  DPInfo (newInfo) {
    if (newInfo) {
      this.dpinfo = newInfo
    } else {
      return this.dpinfo
    }
  }

  Unerasable (erasable) {
    if (erasable !== undefined) {
      this.erasable = erasable
    } else {
      return this.erasable
    }
  }

  ValueType (newValueType) {
    if (newValueType !== undefined) {
      this.valueType = newValueType
    } else {
      return this.valueType
    }
  }

  ValueSubType (newValueSubType) {
    if (newValueSubType !== undefined) {
      this.valueSubType = newValueSubType
    } else {
      return this.hsstype
    }
  }

  ValueMin (newValueMin) {
    if (newValueMin !== undefined) {
      this.valueMin = newValueMin
    } else {
      return this.valueMin
    }
  }

  ValueMax (newValueMax) {
    if (newValueMax !== undefined) {
      this.valueMax = newValueMax
    } else {
      return this.valueMax
    }
  }

  ValueUnit (newValueUnit) {
    if (newValueUnit !== undefined) {
      this.valueUnit = newValueUnit
    } else {
      return this.valueUnit
    }
  }

  State (newState) {
    if (newState !== undefined) {
      this.value = newState
    } else {
      return this.value
    }
  }

  Value (newValue) {
    if (newValue !== undefined) {
      this.value = newValue
    } else {
      return this.value
    }
  }
}

class RegaList extends RegaEnum {
  constructor (dom, name) {
    super(dom, 'ENUM')
    this._dom = dom
    this.name = name
  }

  toString () {
    if (this.name) {
      return this.name
    } else {
      return this._children.join('\t')
    }
  }

  Count () {
    return this._children.length
  }

  EnumIDs () {
    let ids = []
    this._children.forEach(obj => {
      ids.push(obj.id)
    })
    return ids.join('\t')
  }

  Get (srch) {
    let rslt = this._children.filter(element => { return ((element.Name() === srch) && (element.ID() === srch)) })
    return (rslt.length > 0) ? rslt[0] : null
  }

  EnumNames () {
    let _objList = this._dom._objectList(this._children)
    let names = []
    _objList.forEach(obj => {
      names.push(obj.name)
    })
    return names.join('\t')
  }
}

class RegaRoot extends RegaObject {
  constructor (dom) {
    super(dom, 5)
    this.dom = dom
  }

  Interfaces () {
    let result = new RegaList(this.dom, 'Root interfaces')
    result._children = this.dom._interfaceList()
    return result
  }

  Rooms () {
    let result = new RegaList(this.dom, 'Rooms')
    result._children = this.dom._roomList()
    return result
  }

  Devices () {
    let result = new RegaList(this.dom, 'Devices')
    result._children = this.dom._deviceList()
    return result
  }

  Variables () {
    let result = new RegaList(this.dom, 'System Variables')
    result._children = this.dom._variableList()
    return result
  }

  Services () {
    let result = new RegaList(this.dom, 'Root Service Messages')
    result._children = this.dom._serviceList()
    return result
  }
}

class RegaDOM extends RegaEnum {
  constructor (storagePath) {
    super(null)
    this.objects = []
    this.storagePath = storagePath
    this._root = new RegaRoot(this)
    this.fileName = path.join(this.storagePath, 'regadom.json')
    this.loadDom(null, true)
  }

  loadDom (file, init) {
    let self = this
    if (!init) {
      let dta = JSON.parse(fs.readFileSync(file || this.fileName))
      if (dta) {
        dta.interfaces.forEach(interf => {
          self.dom.push(new RegaInterface(this, interf))
        })

        dta.devices.forEach(device => {
          self.dom.push(new RegaDevice(this, device))
        })

        dta.channels.forEach(channel => {
          self.dom.push(new RegaChannel(this, channel))
        })
      }
    } else {
      // 1 is the dom himself
      let obj = new RegaObject(this, 'DOM')
      obj.ID(1)
      this.objects.push(obj)

      // 2 Add the root
      obj = this._root
      obj.ID(2)

      this.objects.push(obj)
      // 3 The deviceList

      let result = new RegaList(this, 'Devices')
      result._children = this._deviceList()
      result.ID(3)

      this.objects.push(result)
      // 4 Channels
      obj = new RegaObject(this, 'Root Channels')
      obj.ID(4)

      this.objects.push(obj)
      // 5 Datapoints
      obj = new RegaObject(this, 'Root Datapoints')
      obj.ID(5)
      this.objects.push(obj)
      // 6 root structure
      obj = new RegaObject(this, 'Root Structure')
      obj.ID(6)
      this.objects.push(obj)
      // 7 users
      obj = new RegaObject(this, 'Root Users')
      obj.ID(7)
      this.objects.push(obj)
      // 8 user pages
      obj = new RegaObject(this, 'User Pages')
      obj.ID(8)
      this.objects.push(obj)
      // 9 interfaces
      obj = this._root.Interfaces()
      obj.ID(9)
      this.objects.push(obj)

      // 10 ?
      // 11 ?
      // 12 Gateway
      // 13 Gateway

      // 28 Service Message List - dynamic

      // 40 AlarmDP
      obj = new RegaVariable(this)
      obj.ID(40)
      obj.Name('Gateway-SysAlDP')
      obj.Value(0)
      this.objects.push(obj)
      // 41 Sysmessage
      obj = new RegaVariable(this)
      obj.ID(41)
      obj.Value(0)
      obj.Name('Gateway-SysSrvDP')
      this.objects.push(obj)
    }
  }

  Save (file) {
    let result = []

    this.objects.forEach(element => {
      if (element.toJson) {
        result.push(element.toJson())
      } else {

      }
    })
    fs.writeFileSync((file || this.fileName), JSON.stringify(result, 2, ' '))
  }

  _objectList (ids) {
    let rslt = this.objects.filter(element => { return ((ids.indexOf(element.ID()) > -1)) })
    return rslt
  }

  _channelWithId (id) {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_CHANNEL) && (element.ID() === id)) })
    return (rslt.length > 0) ? rslt[0] : null
  }

  _deviceList () {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_DEVICE)) })
    return rslt
  }

  _roomList () {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_ROOM)) })
    return rslt
  }

  _variableList () {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_VARIABLE)) })
    return rslt
  }

  _programList () {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_PROGRAM)) })
    return rslt
  }

  getDeviceWithAddress (address) {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_DEVICE) && (element.Address() === address)) })
    return (rslt.length > 0) ? rslt[0] : null
  }

  getChannelWithAddress (address) {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_CHANNEL) && (element.Address() === address)) })
    return (rslt.length > 0) ? rslt[0] : null
  }

  _interfaceList () {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_INTERFACE)) })
    return rslt
  }

  _serviceList () {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_ALARMDP)) })
    return rslt
  }

  AddObject (regaObject) {
    regaObject.emit('willAdd')
    this.objects.push(regaObject)
    regaObject.emit('wasAdded')
  }

  DeleteObject (regaObject) {
    regaObject.emit('willDelete')
    let index = this.objects.indexOf(regaObject)
    if (index > -1) {
      this.objects.slice(index, 1)
    }
    regaObject.emit('wasDeleted')
  }

  _getNextID () {
    let srt = this.objects.sort((a, b) => {
      if (a.ID() < b.ID()) { return -1 }
      if (a.ID() > b.ID()) { return 1 }
      return 0
    })
    let last = srt[srt.length - 1]
    if (last) {
      return (last.ID() + 1)
    } else {
      return 1
    }
  }

  _serviceMessageForDatapoint (name) {
    let rslt = this.objects.filter(element => { return ((element.typename === OT_ALARMDP) && (element.Name() === name)) })
    return (rslt.length > 0) ? rslt[0] : null
  }

  _addServiceMessage (dpName, msg) {
    let self = this
    let dp = this.GetObject(dpName)
    if (dp) {
      let chnl = this.GetObject(dp.Channel())
      let name = 'AL-' + chnl.Address() + '.' + msg
      // Check if we have a old message for this to override
      let alItem = this._serviceMessageForDatapoint(name)
      if (alItem === null) {
        alItem = new RegaServiceMessage(this)
        alItem.ID(this._getNextID)
        alItem.Name(name)
        alItem.on('wasAdded', () => {
          let v41 = self.GetObject(41)
          v41.Value(self._serviceList().length)
        })
        alItem.on('wasDeleted', () => {
          let v41 = self.GetObject(41)
          v41.Value(self._serviceList().length)
        })
        alItem.AlTriggerDP(dp.ID())
        alItem.AlState(1)
        this.AddObject(alItem)
      }
      alItem.Timestamp(new Date())
    }
    // Update the 41 Variable
  }

  CreateObject (type, id) {
    let result
    switch (type) {
      case OT_DEVICE:
        result = new RegaDevice(this)
        result.ID(this._getNextID())
        break
      case OT_CHANNEL:
        result = new RegaChannel(this)
        result.ID(this._getNextID())
        break
      case OT_DP:
        result = new RegaDatapoint(this)
        result.ID(this._getNextID())
        break
      case OT_INTERFACE:
        result = new RegaInterface(this)
        result.ID(id || this._getNextID())
        break
      case OT_ROOM:
        result = new RegaRoom(this)
        result.ID(this._getNextID())
        break
      case OT_PROGRAM:
        result = new RegaProgram(this)
        result.ID(this._getNextID())
        break
      case OT_VARIABLE:
        result = new RegaVariable(this)
        result.ID(this._getNextID())
        break
    }
    this.objects.push(result)
    return result
  }

  GetObject (objName) {
    switch (objName) {
      case ID_INTERFACES:
        return this._root.Interfaces()
      case ID_ROOMS:
        return this._root.Rooms()
      case ID_SYSTEM_VARIABLES:
        return this._root.Variables()
      case ID_SERVICES:
        return this._root.Services()

      case ID_PROGRAMS:
        break
      default:
        let rslt = this.objects.filter(element => { return ((element.Name() === objName) || (element.ID() === objName)) })
        if (rslt.length > 0) {
          return rslt[0]
        } else {
          return null
        }
    }
  }
}

module.exports = {
  RegaObject, RegaDevice, RegaDOM, RegaInterface, RegaRoom, RegaProgram, RegaVariable
}
