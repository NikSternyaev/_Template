import fs from 'fs'
import jwt from 'jsonwebtoken'
// import crypto from 'crypto'
import ch from '#utils/clickhouse.js'
import pg from '#utils/postgresql.js'
import auth from '#lib/authorization.js'
import { fetchData , writeLogs } from '#utils/index.js'
export const scope = 'MyTarget';
export const app = JSON.parse(fs.readFileSync(process.env.credentials))

const script_name = 'Common function'
/** 
 * @returns Возвращает список пользовательских ключей доступа
 */
export async function getUsersCredentials() {
    const func = 'getUsersCredentials'
    writeLogs('debug', `Launched function`, func, scope)
    const conf = JSON.parse(fs.readFileSync(process.env.postgresql))
    const system_id = await pg.getSystemID(scope)
    let query = `with user_types as (select distinct id, types from ${conf.mytarget_users.scheme}.${conf.mytarget_users.table})
        select distinct c.id, account_id, user_id, u.types as user_types, data_type, data_hash, 
        round(extract(epoch from now()))-round(extract(epoch from created_at)) as elapsed
        from ${conf.credentials.scheme}.${conf.credentials.table} c
        left join user_types u on c.account_id = u.id
        where system_id = ${system_id} and active = true and data_type = 'credentials' order by elapsed`
    let buff
    try {
        buff = await pg.sendRequest(query)
        await writeLogs('info', `Preparing credentials accounts list (${JSON.stringify({ objects: Object.keys(buff).length })})`, func, scope)
    } catch (error) {
        await writeLogs('error', `${JSON.stringify(error)}`, func, scope);
        return {}
    }
    let list = {}
    for (let i in buff) try {
        let credentials = jwt.verify(buff[i].data_hash, process.env.credentials_jwt_secret)
        if (!list[buff[i].account_id]) list[buff[i].account_id] = {
            user_id: buff[i].user_id,
            types: buff[i].user_types,
            credentials: credentials
        }
    } catch (error) {
        await writeLogs('warn', `${JSON.stringify(error)}`, func, scope);
    }
    await writeLogs('info', `Prepared list of ${Object.keys(list).length} accounts (${JSON.stringify({ external_system: scope })})`, func, scope)
    buff = undefined
    return list
}
/**
 * @returns Возвращает список ключей доступа рекламных аккаунтов
 */
export async function getClientsCredentials() {
    const func = 'getClientsCredentials'
    writeLogs('debug', `Launched function`, func, scope)
    const conf = JSON.parse(fs.readFileSync(process.env.postgresql))
    const system_id = await pg.getSystemID(scope)
    let query = `with credentials as (
            select account_id, user_id, data_type, data_hash,
            round(extract(epoch from now()))-round(extract(epoch from created_at)) as elapsed
            from ${conf.credentials.scheme}.${conf.credentials.table} where system_id = ${system_id} and active order by elapsed
        ), clients as (
            select id from ${conf.mytarget_users.scheme}.${conf.mytarget_users.table} where status = 'active' and types like '%advert%'
            union all select id from ${conf.mytarget_clients.scheme}.${conf.mytarget_clients.table} where status = 'active'
        ) select user_id, id as account_id, data_type, data_hash from clients c left join credentials cr on c.id = cr.account_id`
    let buff
    try {
        buff = await pg.sendRequest(query)
        await writeLogs('info', `Preparing credentials accounts list (${JSON.stringify({ objects: Object.keys(buff).length })})`, func, scope)
    } catch (error) {
        writeLogs('error', `Did not manage to create accounts list (${JSON.stringify({ external_system: scope, response: error })})`, func, scope)
        return {}
    }
    let list = {};
    for (let i in buff) try {
        let credentials = jwt.verify(buff[i].data_hash, process.env.credentials_jwt_secret);
        if (!list[buff[i].account_id]) list[buff[i].account_id] = {
            user_id: buff[i].user_id,
            data_type: buff[i].data_type,
            credentials: credentials
        };
    } catch(error) {
        await writeLogs('warn', `${JSON.stringify(error)}`, func, scope);
    }
    await writeLogs('info', `Prepared list of ${Object.keys(list).length} accounts (${JSON.stringify({ external_system: scope })})`, func, scope)
    return list
}
export async function updateData(json, table_name) {
    const func = 'updateUserData'
    writeLogs('debug', `Launched data update (${JSON.stringify({json: typeof json, table_name: table_name})})`, func, scope)
    // console.log(`Launched data update (${JSON.stringify({json: typeof json, table_name: table_name})})`)
    switch(table_name) {
        case 'mytarget_users': return await updateDataPG(json, table_name)
        case 'mytarget_clients': return await updateDataPG(json, table_name)
        default : return await updateDataCH(json, table_name)
    }
}
async function updateDataCH(json, table_name){
    const func = 'updateDataCH'
    writeLogs('debug', `Saving data to File (${JSON.stringify({json: typeof json, table_name: table_name})})`, func, scope)
    // console.log(`Saving data to File (${JSON.stringify({json: typeof json, table_name: table_name})})`)
    try {
        let result = await ch.saveData(json, table_name)
        writeLogs('debug', `Saved data with result: ${result} (${JSON.stringify({json: typeof json, table_name: table_name})})`, func, scope)
        // console.log(`Saved data with result: ${result} (${JSON.stringify({json: typeof json, table_name: table_name})})`)
        json = undefined
        return 'done'
    } catch(error) {
        writeLogs('debug', `Failed to save data. Error: ${error} (${JSON.stringify({json: typeof json, table_name: table_name})})`, func, scope)
        // console.log(`Failed to save data. Error: ${error} (${JSON.stringify({json: typeof json, table_name: table_name})})`)
        json = undefined
        throw 'failed'
    }
}
async function updateDataPG(json, table_name){
    const func = 'updateDataPG'
    writeLogs('debug', `Saving data at PostgreSQL (${JSON.stringify({json: typeof json, table_name: table_name})})`, func, scope)
    // console.log(`Saving data at PostgreSQL (${JSON.stringify({json: typeof json, table_name: table_name})})`)
    const conf = JSON.parse(fs.readFileSync(process.env.postgresql))
    try {
        let result = await pg.saveData(json, conf[table_name].table, conf[table_name].scheme)
        writeLogs('debug', `Saved data with result: ${result} (${JSON.stringify({json: typeof json, table_name: table_name})})`, func, scope)
        // console.log(`Saved data with result: ${result} (${JSON.stringify({json: typeof json, table_name: table_name})})`)
        json = undefined
        return 'done'
    } catch (error) {
        writeLogs('debug', `Failed to save data ${error} (${JSON.stringify({json: typeof json, table_name: table_name})})`, func, scope)
        // console.log(`Failed to save data ${error} (${JSON.stringify({json: typeof json, table_name: table_name})})`)
        json = undefined
        return 'failed'
    }
}
/**
 * Отправка запроса к MyTarget
 * При необходимости обновляет ключ доступа
 * @param {*} account_id Идентификатор аккаунта ВК (или ID пользователя ВК)
 * @param {*} user_id Идентификатор пользователя Платины (берется с самым актуальным ключом)
 * @param {*} credentials Ключ доступа
 * @param {*} url URL запроса
 * @param {*} data_type Параметры запросы
 * @returns 
 */
export async function sendRequest(account_id, user_id, credentials, url, data_type) {
    const func = 'sendRequest'
    writeLogs('debug', `Launched function (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, url: url, data_type: data_type})})`, func, scope)
    // console.log(`Launched function (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, url: url, data_type: data_type})})`)
    let options = { method: "GET", headers: { 'Authorization': `Bearer ${credentials.access_token}` } }
    if (typeof params !== 'undefined') {
        options.method = 'POST'
        options.body = params
    }
    if (typeof content_type !== 'undefined') options.headers['Content-Type'] = content_type
    try {
        let res = await fetchData(url, options);
        if (res.status == 401) {
            writeLogs('info', `Access token expired. Trying to refresh it (${JSON.stringify({account_id: account_id, user_id: user_id })})`, func, scope)
            // console.log(`Access token expired. Trying to refresh it (${JSON.stringify({account_id: account_id, user_id: user_id })})`)
            credentials = await auth.refreshToken(credentials.refresh_token, account_id, user_id, data_type)
            return await sendRequest(account_id, user_id, credentials, url, data_type)
        } else {
            return res
        }
    } catch (error) {
        return { status: 500, statusText: `Error: ${JSON.stringify(error)}` }
    }
}
