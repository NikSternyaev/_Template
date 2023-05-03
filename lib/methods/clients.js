import auth from '#lib/authorization.js'
import { app, scope, getUsersCredentials, sendRequest, updateData } from '#lib/index.js'
import { writeLogs } from '#utils/index.js'

const script_name = 'Clients'
/**
 * Запускает обновление информации о клиентах
 */
async function runUpdate() {
    const func = 'runUpdate'
    writeLogs('info', `Launched clients update`, func, scope, script_name)
    // console.log(`Launched clients update`)
    try {
        let list = await getUsersCredentials()
        writeLogs('info', `Retrived user list of ${Object.keys(list).length} objects`, func, scope, script_name)
        // console.log(`Retrived user list of ${Object.keys(list).length} objects`)
        for (let account_id in list) {
            let types = JSON.parse(list[account_id].types)
            writeLogs('info', `Requesting clients: ${list[account_id].types} (${JSON.stringify({user_id: list[account_id].user_id, mytarget_user_id: account_id})})`, func, scope, script_name)
            // console.log(`Requesting clients: ${list[account_id].types} (${JSON.stringify({user_id: list[account_id].user_id, mytarget_user_id: account_id})})`)
            let clients = {count:0}
            if (types.indexOf('agency') >= 0) {
                clients = await getAgencyClients(account_id, list[account_id].user_id, list[account_id].credentials)
            } else if (types.indexOf('manager') >= 0) {
                clients = await getAgencyManagerClients(account_id, list[account_id].user_id, list[account_id].credentials)
            }
            writeLogs('info', `Retrived ${clients.count} clients (${JSON.stringify({ user_id: list[account_id].user_id, mytarget_user_id: account_id })})`, func, scope, script_name)
            // console.log(`Retrived ${clients.count} clients (${JSON.stringify({ user_id: list[account_id].user_id, mytarget_user_id: account_id })})`)
            if(typeof clients.count !== 'undefined' && clients.count > 0) await updateClients(list[account_id].credentials.access_token, account_id, list[account_id].user_id, clients.items)
            writeLogs('info', `Finished clients update (${JSON.stringify({ user_id: list[account_id].user_id, mytarget_user_id: account_id })})`, func, scope, script_name)
            // console.log(`Finished clients update (${JSON.stringify({ user_id: list[account_id].user_id, mytarget_user_id: account_id })})`)
        }
        list = undefined
        clients = undefined
    } catch (error) {
        writeLogs('info', `Failed clients update ${JSON.stringify(error)}`, func, scope, script_name)
        // console.log(`Failed clients update ${JSON.stringify(error)}`)
    }
}
/**
 * Для аккаунта агентства возвращает список всех клиентских аккаунтов в агентстве
 * @param {*} account_id Идентификатор пользователя MyTarget
 * @param {*} user_id Идентификатор пользователя Платины
 * @param {*} credentials Ключ доступа
 * @returns Возвращает список аккаунтов агентства или менеджера агентства
 */
async function getAgencyClients(account_id, user_id, credentials) {
    const func = 'getAgencyClients'
    await writeLogs('debug', `Launched function ${func} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials})})`, func, scope, script_name)
    // console.log(`Launched function ${func} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials})})`)
    const path = `/api/v2/agency/clients.json`
    return await getClients(account_id, user_id, path, credentials)
}
async function getAgencyManagerClients(account_id, user_id, credentials) {
    const func = 'getAgencyManagerClients'
    await writeLogs('debug', `Launched function ${func} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials})})`, func, scope, script_name)
    // console.log(`Launched function ${func} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials})})`)
    const path = `/api/v2/agency/managers/${account_id}/clients.json`
    return await getClients(account_id, user_id, path, credentials)
}
async function getClients(account_id, user_id, path, credentials){
    const func = 'getClients'
    await writeLogs('debug', `Launched function ${func} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials})})`, func, scope, script_name)
    // console.log(`Launched function ${func} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials})})`)
    try {
        let res = await sendRequest(account_id, user_id, credentials, `${app.request_uri + path}`)
        let json = await res.json()
        await writeLogs('debug', `Clients requested ${res.status} ${res.statusText} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id, clients: json.count })})`, func, scope, script_name)
        // console.log(`Clients requested ${res.status} ${res.statusText} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id, clients: json.count })})`)
        return json
    } catch (error) {
        await writeLogs('error', `Clients request failed: ${JSON.stringify(error)} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id })})`, func, scope, script_name)
        // console.log(`Clients request failed: ${JSON.stringify(error)} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id })})`)
        return {}
    }
}
/**
 * Основная функция обновления клиентов MyTarget:
 * – подготавливает данные для записи в PostgreSQL
 * – инициализирует получение ключа доступа отдельного клиента
 * @param {*} access_token 
 * @param {*} account_id 
 * @param {*} user_id 
 * @param {*} clients 
 */
async function updateClients(access_token, account_id, user_id, clients) {
    const func = 'updateClients'
    writeLogs('debug', `Launched function ${func} (${JSON.stringify({ account_id: account_id, user_id: user_id, clients: Object.keys(clients).length})})`, func, scope, script_name)
    // console.log(`Launched function ${func} (${JSON.stringify({ account_id: account_id, user_id: user_id, clients: Object.keys(clients).length})})`)
    let rows = []
    for(let i in clients) try {
        // Выполняет запрос на обновление клиентского ключа доступа
        let result = await auth.requestClientToken(access_token, account_id, user_id, clients[i].user.id)
        writeLogs('debug', `Requested client token with result ${result} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: clients[i].user.id })})`, func, scope, script_name)
        let buff = getRowData(clients[i], account_id)
        rows[rows.length] = buff
    } catch(error) {
        writeLogs('error', `Failed to update client ${clients[i].user.id} data (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id })})`, func, scope, script_name)
        // console.log(`Failed to update client ${clients[i].user.id} data (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id })})`)
    }
    if(rows.length > 0) try {
        let result = await updateData(rows, `${scope.toLocaleLowerCase()}_${script_name.toLocaleLowerCase()}`)
        writeLogs('info', `Client data updated with result ${JSON.stringify(result)} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id })})`, func, scope, script_name)
        // console.log(`Client data updated with result ${JSON.stringify(result)} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id })})`)
    } catch(error) {
        writeLogs('error', `Failed to save client data (${error}) (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id })})`, func, scope, script_name)
        // console.log(`Failed to save client data (${error}) (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id })})`)
    }
    rows = undefined
    return null
}
function getRowData(client, account_id){
    const func = 'getRowData'
    writeLogs('debug', `Launched function (${JSON.stringify({ client: client, mytarget_user_id: account_id })})`, func, scope, script_name)
    // console.log(`client: ${JSON.stringify(client)}`)
    let json = {
        access_type: client.access_type,
        agency_status: client.status,
        id: client.user.id,
        username: client.user.username,
        client_username: client.user.client_username,
        status: client.user.status,
        types: JSON.stringify(client.user.types),
        additional_emails: client.user.additional_emails,
        a_balance: client.user.account.a_balance,
        balance: client.user.account.balance,
        currency: client.user.account.currency,
        currency_balance_hold: client.user.account.currency_balance_hold,
        flags: client.user.account.flags,
        account_id: client.user.account.id,
        is_nonresident: client.user.account.is_nonresident,
        type: client.user.account.type,
        client_name: client.user.additional_info.client_name,
        client_info: client.user.additional_info.client_info,
        name: client.user.additional_info.name,
        email: client.user.additional_info.email,
        phone: client.user.additional_info.phone,
        address: client.user.additional_info.address,
        user_id: account_id
    }
    return json
}
export default {
    runUpdate
}