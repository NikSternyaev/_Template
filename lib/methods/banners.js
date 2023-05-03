import fs from 'fs'
import { app, scope, getClientsCredentials, sendRequest, updateData } from '#lib/index.js'
import { writeLogs } from '#utils/index.js'

const script_name = 'Banners'
const setup = JSON.parse(fs.readFileSync(process.env.setup))[script_name.toLowerCase()]

async function runUpdate() {
    const func = 'runUpdate'
    writeLogs('info', `Launched banners update`, func, scope, script_name)
    // console.log(`Launched banners update`)
    try {
        let list = await getClientsCredentials()
        writeLogs('info', `Clients list requested: retrived ${Object.keys(list).length} objects`, func, scope, script_name)
        // console.log(`Clients list requested: retrived ${Object.keys(list).length} objects`)
        for (let account_id in list) await updateClientBanners( account_id, list[account_id].user_id, list[account_id].credentials, list[account_id].data_type )
        writeLogs('info', `Finished banners update`, func, scope, script_name)
        // console.log(`Finished banners update`)
        list = undefined
    } catch (error) {
        writeLogs('info', `Failed banners update`, func, scope, script_name)
        // console.log(JSON.stringify(`Failed banners update ${JSON.stringify(error)}`))
    }
}
async function updateClientBanners(account_id, user_id, credentials, data_type){
    const func = 'updateClientBanners'
    writeLogs('info', `Launched client banners update (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`, func, scope, script_name)
    // console.log(`Launched client banners update (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`)
    let banners = await getBanners(account_id, user_id, credentials, data_type)
    writeLogs('info', `Received ${banners.count} campaigns (${JSON.stringify({account_id: account_id, user_id: user_id})})`, func, scope, script_name)
    // console.log(`Received ${banners.count} campaigns (${JSON.stringify({account_id: account_id, user_id: user_id})})`)
    for (let i in banners.items) banners.items[i] = getRowData(banners.items[i],account_id)
    let result
    if(banners.count > 0) result = await updateData(banners.items, `${scope.toLocaleLowerCase()}_${script_name.toLocaleLowerCase()}`)
    writeLogs('info', `Finished client banners update with result: ${result} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`, func, scope, script_name)
    // console.log(`Finished client banners update with result: ${result} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`)
    banners = undefined
    return null
}
function getRowData(json, account_id){
    for(let i in json){
        if(typeof json[i] === 'object') json[i] = JSON.stringify(json[i])
        else json[i] = '' + json[i]
    }
    return json
}
export async function getBanners(account_id, user_id, credentials, data_type){
    const func = 'getBanners'
    writeLogs('debug', `Launched function (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`, func, scope, script_name)
    // console.log(`Launched function (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`)
    const path = `/api/v2/banners.json?fields=${setup.fields.join(',')}`
    try {
        let res = await sendRequest(account_id, user_id, credentials, `${app.request_uri+path}`, data_type)
        let json = await res.json()
        return json
    } catch(error) {
        writeLogs('error', `Request banners failed ${JSON.stringify(error)} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id })})`, func, scope, script_name)
        // console.log(`Request banners failed ${JSON.stringify(error)} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id })})`)
        return []
    }   
}
export default {
    runUpdate
}
