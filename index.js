const path = require('path')
const commander = require('commander')
const HMInterface = require('hm-interface')
const Simulator = require(path.join(__dirname, 'lib', 'Simulator.js'))
const logger = require(path.join(__dirname, 'lib', 'Logger.js')).logger('Main')

let configurationFile

commander.option('-D, --debug', 'turn on debug level logging', () => {
  logger.setDebugEnabled(true)
  HMInterface.logger.setDebugEnabled(true)
})

commander.option('-C, --configuration [file]', 'set configuration file', (configuration) => {
  configurationFile = configuration
})

commander.parse(process.argv)

process.on('uncaughtException', (err) => {
  // Write a crashlog
  const fs = require('fs')
  let crashFile = path.join('/', 'var', 'log', Date.now() + '.crash')
  var msg = 'Error log : ' + new Date() + '\n\n'
  msg = msg + err.stack
  console.error(msg)
  fs.writeFileSync(crashFile, msg)
  process.exit(1) // mandatory (as per the Node docs)
})
console.log('Running as console')

let logFile = path.join('/', 'var', 'log', 'ccusim.log')
logger.setLogFile(logFile)

let sim = new Simulator()
logger.info(configurationFile)
sim.init(configurationFile)
