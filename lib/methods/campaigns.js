import { app, scope, getClientsCredentials, sendRequest, updateData } from '#lib/index.js'
import { writeLogs } from '#utils/index.js'

const script_name = 'Campaigns'

async function runUpdate() {
    const func = 'runUpdate'
    writeLogs('info', `Launched campaigns update`, func, scope, script_name)
    // console.log(`Launched campaigns update`)
    try {
        let list = await getClientsCredentials()
        writeLogs('info', `Clients list requested: retrived ${Object.keys(list).length} objects`, func, scope, script_name)
        // console.log(`Clients list requested: retrived ${Object.keys(list).length} objects`)
        for (let account_id in list) await updateClientCampaigns( account_id, list[account_id].user_id, list[account_id].credentials, list[account_id].data_type )
        writeLogs('info', `Finished campaigns update`, func, scope, script_name)
        // console.log(`Finished campaigns update`)
        list = undefined
    } catch (error) {
        writeLogs('info', `Failed campaigns update ${JSON.stringify(error)}`, func, scope, script_name)
        // console.log(JSON.stringify(`Failed campaigns update ${JSON.stringify(error)}`))
    }
}
//TO DO: внести изменения: account_id + user_id
async function updateClientCampaigns(account_id, user_id, credentials, data_type){
    const func = 'updateClientCampaigns'
    writeLogs('info', `Launched client campaigns update (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`, func, scope, script_name)
    // console.log(`Launched client campaigns update (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`)
    let campaigns = await getCampaigns(account_id, user_id, credentials, data_type)
    writeLogs('info', `Received ${campaigns.count} campaigns (${JSON.stringify({account_id: account_id, user_id: user_id})})`, func, scope, script_name)
    // console.log(`Received ${campaigns.count} campaigns (${JSON.stringify({account_id: account_id, user_id: user_id})})`)
    for(let i in campaigns.items) campaigns.items[i].account_id = account_id
    let result
    if(campaigns.count > 0) result = await updateData(campaigns.items, `${scope.toLocaleLowerCase()}_${script_name.toLocaleLowerCase()}`)
    writeLogs('info', `Finished client campaigns update with result: ${result} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`, func, scope, script_name)
    // console.log(`Finished client campaigns update with result: ${result} (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`)
    campaigns = undefined
    return null
}
export async function getCampaigns(account_id, user_id, credentials, data_type){
    const func = 'getCampaigns'
    writeLogs('debug', `Launched function (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`, func, scope, script_name)
    // console.log(`Launched function (${JSON.stringify({account_id: account_id, user_id: user_id, credentials: typeof credentials, data_type: data_type})})`)
    const path = '/api/v2/campaigns.json'
    try {
        let res = await sendRequest(account_id, user_id, credentials, `${app.request_uri+path}`, data_type)
        let json = await res.json();
        return json;
    } catch(error) {
        writeLogs('error', `Request campaigns failed ${JSON.stringify(error)} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id })})`, func, scope, script_name)
        // console.log(`Request campaigns failed ${JSON.stringify(error)} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id })})`)
        return []
    }   
}
export default {
    runUpdate
}
