import fs from 'fs'
import jwt from 'jsonwebtoken'
import pg from '#utils/postgresql.js'
import { writeLogs } from '#utils/index.js'
import { scope } from '#lib/index.js'

const script_name = 'credentials'
const conf = JSON.parse(fs.readFileSync(process.env.postgresql)).credentials

/**
 * Запрашивает ключ доступа
 * @param {*} external_system Название внешней системы
 * @param {*} account_id Уникальный идентьификатор аккаунта
 * @param {*} user_id Идентификатор пользователя Платины
 * @param {*} data_type Тип предоставленного ключа доступа 
 * @returns Возвращает ключ доступа в открытом виде
 */
async function requestCredentials(external_system, account_id, user_id, data_type) {
    const func = 'requestCredentials'
    writeLogs('debug', `Launched function (${JSON.stringify({external_system: external_system, account_id: account_id, user_id: user_id, data_typ: data_type})})`, func, scope, script_name)
    // console.log(`Launched requestCredentials (${JSON.stringify({ external_system: external_system, account_id: account_id, user_id: user_id, data_type: data_type })})`)
    if (typeof (external_system) === 'undefined') {
        writeLogs('error', 'External system was not specified', func, scope, script_name)
        throw 'External system was not specified'
    }
    if (typeof (account_id) === 'undefined') {
        writeLogs('error', 'Account ID was not specified', func, scope, script_name)
        throw 'Account ID was not specified'
    }
    if (typeof (user_id) === 'undefined') {
        writeLogs('error', 'User ID was not specified', func, scope, script_name)
        throw 'User ID was not specified'
    }
    if (typeof (data_type) === 'undefined') {
        writeLogs('warn', 'Credentials type was not specified. Setting default to "access_token"', func, scope, script_name)
        data_type = 'access_token'
    }
    const system_id = await pg.getSystemID(external_system)
    const query = `
        select distinct id, data_hash, round(extract(epoch from now()))-round(extract(epoch from created_at)) as elapsed
        from ${conf.scheme}.${conf.table}
        where system_id = ${system_id} and user_id = ${user_id} and account_id = '${account_id}' and data_type = '${data_type}'
        order by id limit 1`
    try {
        let result = await pg.sendRequest(query)
        if (typeof result[0] !== 'undefined') {
            writeLogs('info', `Retrived credentials (${JSON.stringify({ external_system: external_system, account_id: account_id, data_type: data_type, user_id: user_id })})`, func, scope, script_name)
            let credentials = jwt.verify(result[0].data_hash, process.env.credentials_jwt_secret)
            return credentials
        } else {
            writeLogs('info', `Not found credentials (${JSON.stringify({ external_system: external_system, account_id: account_id, data_type: data_type, user_id: user_id })})`, func, scope, script_name)
            throw 'Not found credentials'
        }
    } catch (error) {
        writeLogs('error', `ERROR: ${JSON.stringify(error)} (${JSON.stringify({ external_system: external_system, account_id: account_id, data_type: data_type, user_id: user_id })})`, func, scope, script_name)
        throw 'Failed to retrive credentials'
    }
}
/**
 * Обновляет ключ доступа или добавляет новый
 * @param {*} data Ключ доступа в открытом виде
 * @param {*} external_system Название внешней системы
 * @param {*} account_id Уникальный идентьификатор аккаунта
 * @param {*} user_id Идентификатор пользователя Платины
 * @param {*} data_type Тип предоставленного ключа доступа
 * @returns Возвращает результат true или ошибку
 */
async function provideCredentials(data, external_system, account_id, user_id, data_type) {
    const func = 'provideCredentials'
    await writeLogs('debug', `Launched provide credentials function (${JSON.stringify({ data: typeof data, external_system: external_system, account_id: account_id, user_id: user_id, data_type: data_type })})`, func, scope, script_name)
    // console.log(`Launched provide credentials function (${JSON.stringify({ data: typeof data, external_system: external_system, account_id: account_id, user_id: user_id, data_type: data_type })})`)
    if (typeof (data) === 'undefined') {
        writeLogs('error', 'Data was not provided', func, scope, script_name)
        throw 'Data must be provided'
    }
    if (typeof (external_system) === 'undefined') {
        writeLogs('error', 'External system was not specified', func, scope, script_name)
        throw 'External system must be specified'
    }
    if (typeof (account_id) === 'undefined') {
        writeLogs('error', 'Account ID was not specified', func, scope, script_name)
        throw 'Account ID must be specified'
    }
    if (typeof (user_id) === 'undefined') {
        writeLogs('error', 'User ID was not specified', func, scope, script_name)
        throw 'User ID was not specified'
    }
    if (typeof (data_type) === 'undefined') {
        writeLogs('error', 'Credentials type was not specified. Setting default to "access_token"', func, scope, script_name)
        data_type = 'access_token'
    }
    const system_id = await pg.getSystemID(external_system)
    try {
        let credentials = await requestCredentials(external_system, account_id, user_id, data_type)
        if (typeof credentials !== 'undefined') {
            writeLogs('debug', `Updating credentials (${JSON.stringify({ external_system: external_system, account_id: account_id, user_id: user_id, data_type: data_type })})`, func, scope, script_name)
            // console.log(`Updating credentials (${JSON.stringify({ external_system: external_system, account_id: account_id, user_id: user_id, data_type: data_type })})`)
            const query = `update ${conf.scheme}.${conf.table}
                set (data_hash, created_at) = row('${jwt.sign(data, process.env.credentials_jwt_secret)}','${new Date().toISOString().substring(0, 19).replace('T', ' ')}')
                where system_id=${system_id} and account_id='${account_id}' and user_id=${user_id} and data_type='${data_type}'`
            return await pg.sendRequest(query)
        } else {
            writeLogs('debug', `Adding new credentials (${JSON.stringify({ external_system: external_system, account_id: account_id, user_id: user_id, data_type: data_type })})`, func, scope, script_name)
            // console.log(`Adding new credentials (${JSON.stringify({ external_system: external_system, account_id: account_id, user_id: user_id, data_type: data_type })})`)
            const json = {
                system_id: system_id,
                account_id: account_id,
                user_id: user_id,
                data_type: data_type,
                data_hash: jwt.sign(data, process.env.credentials_jwt_secret)
            }
            return await pg.writeData(json, conf.table, conf.scheme)
        }
    } catch (error) {
        writeLogs('debug', `Error occured ${error} (${JSON.stringify({ external_system: external_system, account_id: account_id, user_id: user_id, data_type: data_type })})`, func, scope, script_name)
        return error
    }
}
export default {
    requestCredentials,
    provideCredentials
}