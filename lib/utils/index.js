import bunyan from 'bunyan'
import jwt from 'jsonwebtoken'
import { execSync } from 'child_process'
import { scope } from '#lib/index.js'

export async function fetchData(url, options) {
  const func = 'fetchData'
  const script_name = 'Network'
  writeLogs('debug', `Fetching data... (${JSON.stringify({ request_data: jwt.sign({ url: url, options: options }, process.env.network_jwt_secret) })})`, func, scope, script_name)
  // console.log(`Fetching data... (${JSON.stringify({ url: url, options: options })})`)
  var start_time = new Date().getTime()
  try {
    let response = await fetch(url, options)
    let time = (new Date().getTime() - start_time)
    writeLogs('info', `Performed fetch in ${time} ms with options ${typeof options} (${JSON.stringify({ result: `${response.status} ${response.statusText}`, request_data: jwt.sign({ url: url, options: options }, process.env.network_jwt_secret) })})`, func, scope, script_name)
    // console.log(`Performed fetch in ${time} ms with options ${typeof options} (${JSON.stringify({ request_data: jwt.sign({ url: url, options: options }, process.env.network_jwt_secret) })})`)
    return response
  } catch (error) {
    let time = (new Date().getTime() - start_time) + 'ms'
    writeLogs('info', `Failed fetch URL after ${time} ms with options ${typeof options} (${JSON.stringify({ error: error, request_data: jwt.sign({ url: url, options: options }, process.env.network_jwt_secret) })})`, func, scope, script_name)
    // console.log(`Failed fetch URL after ${time} ms with options ${typeof options} (${JSON.stringify({ error: error, request_data: jwt.sign({ url: url, options: options }, process.env.network_jwt_secret) })})`)
    throw error
  }
}
export async function writeLogs(level, message, func_name, app_name, script_name) {
  if (typeof app_name === 'undefined') app_name = '(not set)'
  if (typeof script_name === 'undefined') script_name = '(not set)'
  const log = bunyan.createLogger({
    name: app_name,
    script: script_name,
    function: func_name,
    memory_rss: Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
    streams: [
      { level: 'debug', path: `${process.env.script_logs}/${scope}_${new Date().toISOString().substring(0, 10)}.log` }
    ]
  })
  if (typeof message === 'undefined') {
    log.debug(JSON.stringify({ message: message }))
  } else {
    // if(typeof message !== 'string' || typeof message !== 'number') message = JSON.stringify(message)
    switch (level) {
      case 'fatal': return log.fatal(message)
      case 'error': return log.error(message);
      case 'warn': return log.warn(message);
      case 'info': return log.info(message);
      case 'debug': return log.debug(message);
      case 'trace': return log.trace(message);
      default: return log.info(message);
    }
  }
}
export async function performCommand(command) {
  const func = 'performCommand';
  if (typeof command === 'undefined') throw `Command was not specified (${JSON.stringify(command)})`
  try {
    let response = execSync(command)
    return JSON.stringify(response)
  } catch (error) {
    throw JSON.stringify(error)
  }
}
export async function deleteFile(file_path) {
  const func = 'deleteFile'
  fs.unlink(file_path, function (err) {
    if (err && err.code == 'ENOENT') {
      writeLogs('error', `File ${file_path} doesnt exist, wont remove it.`, func, scope)
    } else if (err) {
      writeLogs('error', `Error occurred while trying to remove file ${file_path} (${JSON.stringify(err)})`, func, scope)
    } else {
      writeLogs('info', `File ${file_path} has been removed`, func, scope)
    }
  })
}
export function getPeriod(period_length, date_start) {
  if (typeof period_length !== 'number') {
    if (typeof period_length !== 'undefined' && typeof parseFloat(period_length) === 'number') period_length = parseFloat(period_length)
    else period_length = 30
  }
  let date_end = new Date()
  if (typeof date_start === 'undefined' || !is_date(date_start)) {
    date_start = new Date()
    date_start.setDate(date_start.getDate() - period_length)
  } else {
    date_end = new Date(date_start.getFullYear(), date_start.getMonth(), date_start.getDate(), date_start.getHours());
    date_end.setDate(date_end.getDate() + period_length);
  }
  return {
    start: date_start,
    end: date_end
  }
}