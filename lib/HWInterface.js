const xmlrpc = require('homematic-xmlrpc')
const path = require('path')
const { EventEmitter } = require('events')

class HMParamset {
  constructor (name) {
    this.name = name
    this.parameter = []
  }

  addParameter (parameter) {
    this.parameter.push(parameter)
  }

  getParameterWithName (name) {
    let rslt = this.parameter.filter((parameter) => { return (parameter.name === name) })
    return rslt.length > 0 ? rslt[0] : null
  }

  getParamsetDescription () {
    let result = {}
    this.parameter.forEach(parameter => {
      let pset = {}
      pset['MIN'] = parameter.min
      pset['MAX'] = parameter.max
      pset['FLAGS'] = parameter.flags
      pset['UNIT'] = parameter.unit
      pset['VDEFAULT'] = parameter.vdefault
      pset['TAB_ORDER'] = parameter.tab_order
      pset['CONTROL'] = parameter.control
      pset['TYPE'] = parameter.type
      pset['VALUE_LIST'] = parameter.valuelist
      result[parameter.name] = pset
    })
    return result
  }
}

class HMDevice extends EventEmitter {
  toJson () {
    let result = {TYPE: this.TYPE, ADDRESS: this.ADDRESS, CHILDREN: this.CHILDREN}
    return result
  }
}

class HMChannel {
  toJson () {
    let result = {INDEX: this.INDEX, ADDRESS: this.ADDRESS, PARENT: this.PARENT, TYPE: this.TYPE, CHILDREN: this.CHILDREN}
    return result
  }
}

module.exports = class HWInterface extends EventEmitter {
  constructor (ifName, ifpath, ifaddress, ifport, dataFolder, debug) {
    super()
    let self = this
    this.name = ifName
    this.host = ifaddress
    this.port = ifport
    this.path = ifpath
    this.clients = []
    this.devices = []
    const logger = require(path.join(__dirname, 'Logger.js')).logger(ifName)

    this.logger = logger
    this.logger.setDebugEnabled(debug)
    this.dataFolder = dataFolder
    this.ifServer = xmlrpc.createServer({host: ifaddress, port: ifport})
    this.logger.info('%s xmlrpc server listening on', ifName, ifaddress, ifport)

    const rpcMethods = {
      'system.listMethods': (err, params, callback) => {
        if (err) {
          self.logger.error(' ', err)
        }
        callback(null, Object.keys(rpcMethods))
      },

      init: (err, params, callback) => {
        if (err) {
          self.logger.error(' ', err)
        }
        const [url, id] = params
        let [protocol, host, port] = url.split(':')
        host = host.replace(/^\/\//, '')
        const clientId = id + '_' + [host, port].join(':')
        self.logger.debug('RPC Init Call from %s with id %s', host, id)

        if ((id === '') || (id === undefined)) {
          let clnt = self.clients[clientId]
          if (clnt) {
            self.logger.debug('remove', self.clients[clientId].url)
            let client = self.clients[clientId]
            if (client && typeof client.client.end === 'function') {
              client.client.end()
            }

            if (client && typeof client.client.close === 'function') {
              client.client.close()
            }

            if (client && typeof client.client.destroy === 'function') {
              client.client.destroy()
            }

            client = null
            delete self.clients[clientId]
          }
        } else {
          let client = {
            id,
            url,
            client: xmlrpc.createClient({host, port})
          }
          self.clients[clientId] = client

          callback(null, '')
        }
      },

      listDevices: (err, params, callback) => {
        if (!err) {
          let result = []
          self.devices.forEach(device => {
            result.push(device.toJson())
          })
          callback(null, result)
        }
      },

      getParamsetDescription: (err, params, callback) => {
        if (!err) {
          let adr = params[0]
          let psetName = params[1]
          let channel = self.getObjectWithAddress(adr)
          if (channel) {
            if (channel.oParamsets[psetName] !== undefined) {
              callback(null, channel.oParamsets[psetName].getParamsetDescription())
            } else {
              callback(null, null)
            }
          } else {
            callback(null, null)
          }
        }
      },

      setValue: (err, params, callback) => {
        if (!err) {
          self.logger.debug('setValue ', JSON.stringify(params))
          let adr = params[0]
          let parameterName = params[1]
          let newValue = params[2]
          let channel = self.getObjectWithAddress(adr)
          if (channel) {
            self.logger.debug('channel found get VALUES')
            let pSet = channel.oParamsets['VALUES']
            if (pSet) {
              let parameter = pSet.getParameterWithName(parameterName)
              if (parameter) {
                parameter.value = newValue
                // emit the event
                let device = self.getObjectWithAddress(channel.PARENT)
                if (device) {
                  device.emit('setValue', adr, parameterName, newValue)
                } else {
                  self.logger.error('Device not found', channel.PARENT)
                }
              } else {
                self.logger.error('parameter %s not found in values', parameterName, JSON.stringify(pSet))
              }
            } else {
              self.logger.error('values Paramset not found in channel')
            }
          } else {
            self.logger.error('channel not found ', adr)
          }
        }
      },
      notFound: (methodName, iface, params) => {
        self.logger.error('rpc', iface, '< unknown method', methodName, JSON.stringify(params))
      }
    }

    Object.keys(rpcMethods).forEach(methodName => {
      self.ifServer.on(methodName, (err, params, callback) => {
        self.logger.debug('incomming message', methodName, JSON.stringify(params))
        rpcMethods[methodName](err, params, callback)
      })
    })
  }

  getObjectWithAddress (address) {
    return this.devices.filter((device) => { return (device.ADDRESS === address) })[0]
  }

  setValue (address, datapoint, newvalue) {
    let self = this
    self.logger.debug('setValue event')
    Object.keys(this.clients).forEach((clientID) => {
      let client = self.clients[clientID]
      let params = [client.id, address, datapoint, newvalue]

      self.logger.debug('event ', JSON.stringify(params))
      self.methodCallOnClient(clientID, 'event', params, null)
    })
  }

  setDevices (testdata) {
    let self = this

    let devList = testdata
    if (devList !== undefined) {
      Object.keys(devList).forEach(deviceAdr => {
        let devObj = devList[deviceAdr]
        let devType = devObj.type
        let devBehv = devObj.behavoir
        self.logger.debug('searching for Device type %s', devType)
        let devData = require(path.join(self.dataFolder, devType + '.json'))
        let device = new HMDevice()
        if (typeof devData.type === 'string') {
          device.TYPE = devData.type
        } else {
          device.TYPE = devData.type[0]
        }

        device.ADDRESS = deviceAdr
        device.CHILDREN = []

        self.devices.push(device)

        devData.channels.forEach(channel => {
          let oChannel = new HMChannel()
          oChannel.INDEX = parseInt(channel.adress)
          oChannel.ADDRESS = deviceAdr + ':' + oChannel.INDEX
          oChannel.PARENT = deviceAdr
          oChannel.TYPE = channel.type
          oChannel.oParamsets = {}
          device.CHILDREN.push(oChannel.ADDRESS)
          self.devices.push(oChannel)

          channel.paramsets.forEach(paramset => {
            let oParamset = new HMParamset(paramset.name)
            oChannel.oParamsets[paramset.name] = oParamset
            paramset.parameter.forEach(parameter => {
              oParamset.addParameter(parameter)
            })
          })
        })
        if (devBehv !== undefined) {
          self.logger.debug('adding behavoir %s to %s', devBehv, deviceAdr)
          let BClazz = require(path.join(self.dataFolder, devBehv + '.js'))
          let bObj = new BClazz(self, deviceAdr)
          device.on('setValue', (adr, parameterName, newValue) => {
            bObj.setValue(adr, parameterName, newValue)
          })
        } else {
          self.logger.debug('no  behavoir found for  %s', deviceAdr)
        }
      })
    }
    this.on('setValue', this.setValue)
  }

  methodCallOnClient (clientID, methodName, params, callback) {
    let ifClient = this.clients[clientID]
    if (ifClient) {
      this.logger.debug('methodCallOnClient', clientID, methodName, params)
      ifClient.client.methodCall(methodName, params, (err, res) => {
        this.logger.debug('rpc <', JSON.stringify(res))
        if (typeof callback === 'function') {
          callback(err, res)
        }
      })
    }
  }

  addDevice (device) {
    this.devices.push(device)
  }
}
