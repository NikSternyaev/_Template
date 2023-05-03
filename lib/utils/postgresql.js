import postgres from 'postgres'
import { writeLogs } from '#utils/index.js'
import { scope } from '#lib/index.js'

const script_name = 'PostgreSQL'

async function sendRequest(query) {
    const func = 'sendRequest'
    await writeLogs('debug', `Requesting DB with query ${typeof query}`, func, scope, script_name)
    const sql = postgres()
    try {
        let result = await sql.unsafe(query)
        await writeLogs('debug', `Request to DB succeeded (${JSON.stringify({ result: typeof result })})`, func, scope, script_name)
        // console.log(`Request to DB succeeded (${JSON.stringify({ result: typeof result })})`)
        return result
    } catch (error) {
        await writeLogs('fatal', `Query failed with Error: ${JSON.stringify(error)}`, func, scope, script_name)
        // console.log(`Query failed with Error: ${JSON.stringify(error)}`)
        throw 'Request to DB failed'
    }
}
/**
 * Функция выполняет задачи:
 * – проверяет наличие существующих записей по полю id
 * – запускает добавление новых в базу
 * – запускает обновление существующих
 * @param {*} json Данные для записи в формате json (или [json]): json = {column1: value1, column2: value2} 
 * @param {*} table Таблица PG
 * @param {*} scheme Схема PG
 * @returns 
 */
async function saveData(json, table, scheme) {
    const func = 'saveData'
    await writeLogs('debug', `Preparing to save data (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
    // console.log(`Preparing to save data (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`)
    if (typeof json === 'undefined' || typeof json !== 'object') {
        await writeLogs('debug', `Failed to save data: Incorrect arguments: json must be an object but got ${typeof json} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        throw `Failed to save data: Incorrect arguments`
    }
    if (typeof table === 'undefined') {
        await writeLogs('debug', `Failed to save data: Incorrect arguments: table must be specified but got ${typeof table}(${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        throw `Failed to save data: Incorrect arguments`
    }
    if (typeof scheme === 'undefined') {
        await writeLogs('debug', `Scheme not specified. Setting default: public (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        scheme = 'public'
    }
    let list = await getIDList(table, scheme)
    if (!Array.isArray(json)) json = [json]
    await writeLogs('debug', `Checking for existing entries (${JSON.stringify({ table: table, scheme: scheme, json: Object.keys(json).length })})`, func, scope, script_name)
    // console.log(`Checking for existing entries (${JSON.stringify({ table: table, scheme: scheme, json: Object.keys(json).length })})`)
    let buff = []
    for (let i in json) if (typeof list[json[i].id.toString()] !== 'undefined') {
        buff.push(json[i])
        delete json[i]
    }
    await writeLogs('debug', `Saving data to DB (${JSON.stringify({ table: table, scheme: scheme, new: Object.keys(json).length, old: Object.keys(buff).length })})`, func, scope, script_name)
    // console.log(`Saving data to DB (${JSON.stringify({ table: table, scheme: scheme, new: Object.keys(json).length, old: Object.keys(buff).length })})`)
    let results = { write: { count: Object.keys(json).length }, update: { count: Object.keys(buff).length } }
    if (Object.keys(json).length > 0) try {
        results.write.result = await writeData(json, table, scheme)
    } catch (error) {
        results.write.error = error
    }
    if (Object.keys(buff).length > 0) try {
        results.update.result = await updateData(buff, table, scheme)
    } catch (error) {
        results.update.error = error
    }
    await writeLogs('debug', `Data saved with results: ${JSON.stringify(results)} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
    // console.log(`Data saved with results: ${JSON.stringify(results)} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`)
    buff = undefined
    json = undefined
}
async function writeData(json, table, scheme) {
    const func = 'writeData'
    await writeLogs('debug', `Preparing to write data (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
    // console.log(`Preparing to write data (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`)
    if (typeof json === 'undefined' || typeof json !== 'object') {
        await writeLogs('debug', `Failed to write data: Incorrect arguments: json must be an object but got ${typeof json} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        throw `Failed to write data: Incorrect arguments`
    }
    if (typeof table === 'undefined') {
        await writeLogs('debug', `Failed to write data: Incorrect arguments: table must be specified but got ${typeof table}(${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        throw `Failed to write data: Incorrect arguments`
    }
    if (typeof scheme === 'undefined') {
        await writeLogs('debug', `Scheme not specified. Setting default: public (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        scheme = 'public'
    }
    try {
        let query
        if (Array.isArray(json)) {
            let values = [];
            for (let i in json) values[values.length] = `('${Object.values(json[i]).join("','")}')`;
            query = `insert into ${scheme}.${table} (${Object.keys(json[0]).join(',')}) values ${values.join(',')}`
        } else {
            query = `insert into ${scheme}.${table} (${Object.keys(json).join(',')}) values ($$${Object.values(json).join("$$,$$")}$$);`
        }
        let result = await sendRequest(query)
        // console.log(`Succeeded to write data with result: ${typeof result} (${JSON.stringify({table: table, scheme: scheme, json: typeof json})})`)
        await writeLogs('debug', `Succeeded to write data with result: ${typeof result} (${JSON.stringify({table: table, scheme: scheme, json: typeof json})})`, func, scope, script_name)
        query = undefined
        json = undefined
        return 'done'
    } catch (error) {
        await writeLogs('debug', `Failed to write data with Error: ${error} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        json = undefined
        throw 'Failed to write data'
    }
}
async function updateData(json, table, scheme) {
    const func = 'updateData'
    await writeLogs('debug', `Preparing to update data (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
    // console.log(`Preparing to update data (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`)
    if (typeof json === 'undefined' || typeof json !== 'object') {
        await writeLogs('debug', `Failed to update data: Incorrect arguments: json must be an object but got ${typeof json} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        throw `Failed to update data: Incorrect arguments`
    }
    if (typeof table === 'undefined') {
        await writeLogs('debug', `Failed to update data: Incorrect arguments: table must be specified but got ${typeof table}(${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        throw `Failed to update data: Incorrect arguments`
    }
    if (typeof scheme === 'undefined') {
        await writeLogs('debug', `Scheme not specified. Setting default: public (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        scheme = 'public'
    }
    for (let i in json) if(typeof json[i].id !== 'undefined') try {
        let id = json[i].id
        delete json[i].id
        let query = `update ${scheme}.${table} set (${Object.keys(json[i]).join(',')}) = ($$${Object.values(json[i]).join("$$,$$")}$$) where id = '${id}';`
        let result = await sendRequest(query)
        await writeLogs('debug', `Succeeded to update data with result: ${typeof result} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        // console.log(`Succeeded to update data with result: ${typeof result} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`)
        query = undefined
        json = undefined
        return 'done'
    } catch (error) {
        await writeLogs('debug', `Failed to update data with Error: ${error} (${JSON.stringify({ table: table, scheme: scheme, json: typeof json })})`, func, scope, script_name)
        json = undefined
        throw 'Failed to update data'
    }

}
async function getIDList(table, scheme) {
    const func = 'getIDList'
    await writeLogs('debug', `Preparing existing ids list (${JSON.stringify({ table: table, scheme: scheme })})`, func, scope, script_name)
    // console.log(`Preparing existing ids list (${JSON.stringify({ table: table, scheme: scheme })})`)
    let list = {}
    try {
        let query = `select distinct id from ${scheme}.${table}`
        let buff = await sendRequest(query)
        for (let i in buff) list[buff[i].id] = true;
        await writeLogs('debug', `Succeeded to prepare a list of ${Object.keys(list).length} items (${JSON.stringify({ table: table, scheme: scheme })})`, func, scope, script_name)
        // console.log(`Succeeded to prepare a list of ${Object.keys(list).length} items (${JSON.stringify({ table: table, scheme: scheme })})`)
        buff = undefined
    } catch (error) {
        await writeLogs('debug', `Failed to prepare a list ${error} (${JSON.stringify({ table: table, scheme: scheme })})`, func, scope, script_name)
        // console.log(`Failed to prepare a list ${error} (${JSON.stringify({ table: table, scheme: scheme })})`)
    }
    return list
}
/**
async function updateYandexTablePG(func, conf, account) {
  const system_id = await pg.getSystemID(scope);
  const query = `SELECT id FROM ${conf.scheme}.${conf.table} WHERE clientid = '${account['ClientId']}'`;
  let res = await pg.sendRequest(query);
  try {
    if (res.status == 200) {
      if (res.data.rows.length == 0) {
        writeLogs('info', `Adding new client (${JSON.stringify({ external_system: scope, client_login: account['Login'], client_id: account['ClientId'] })})`, func, scope, script_name);
        delete account['Phone'];
        let json = {};
        for (let param in account) {
          //  (Object.keys().length) !== 'undefined'
          if (typeof account[param] === 'object') json[param.toLowerCase()] = JSON.stringify(account[param]);
          else json[param.toLowerCase()] = account[param];
        }
        res = await pg.writeDataJson(json, conf.table, conf.scheme);
      }
    } else {
      writeLogs('error', `Bad request ${res.status} ${res.statusText} (${JSON.stringify({ external_system: scope, client_login: account['Login'], client_id: account['ClientId'], data: res.data, query: query })})`, func, scope, script_name);
    }
  } catch (error) {
    console.log(`error occured ${JSON.stringify(error)}`)
  }
}
 */
async function getSystemID(external_system) {
    const func = 'getSystemID'
    await writeLogs('debug', `Requesting external system ID (${JSON.stringify({external_system: external_system})})`, func, scope, script_name)
    try {
        let buff = await sendRequest(`select id from dictionaries.external_systems where name = '${external_system}'`)
        if (typeof (buff) !== 'undefined' && typeof (buff[0]) !== 'undefined') {
            return buff[0].id
        } else {
            return 0
        }
    } catch (error) {
        await writeLogs('error', `Failed to get system ID (${JSON.stringify({ external_system: external_system })})`, func, scope, script_name)
        return 0
    }
}
export default {
    sendRequest,
    saveData,
    writeData,
    // updateData,
    getSystemID
}
