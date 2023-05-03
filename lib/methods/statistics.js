import fs from 'fs'
import { app, scope, getClientsCredentials, sendRequest, updateData } from '#lib/index.js'
import { getPeriod, writeLogs } from '#utils/index.js'

const script_name = 'Statistics'
// const statistics_type = 'banners' /** См. документацию: https://target.my.com/doc/api/en/info/Statistics */
const setup = JSON.parse(fs.readFileSync(process.env.setup))[script_name.toLowerCase()]

async function runUpdate() {
    const func = 'runUpdate'
    let dates = await getPeriod()
    writeLogs('info', `Launched statistics update`, func, scope, script_name)
    let list = await getClientsCredentials()
    writeLogs('info', `Clients list requested: ${Object.keys(list).length} objects`, func, scope, script_name)
    // console.log(`Clients list requested: ${Object.keys(list).length} objects`)
    for (let account_id in list) await updateClientStatistics(account_id, list[account_id].user_id, list[account_id].credentials, dates.start, dates.end, list[account_id].data_type)
    list = undefined
}
//TO DO: внести изменения: account_id + user_id
async function updateClientStatistics(account_id, user_id, credentials, date_start, date_end, data_type) {
    const func = 'updateClientStatistics'
    let statistics = await getStatistics(account_id, user_id, credentials, date_start, date_end, data_type)
    writeLogs('info', `Statistics requested (${JSON.stringify(Object.keys(statistics))}) (${JSON.stringify({user_id: user_id, mytarget_user_id: account_id})})`, func, scope, script_name)
    // console.log(`Statistics requested:\ntop ${JSON.stringify(Object.keys(statistics))}\nitems ${JSON.stringify(Object.keys(statistics.items))}`)
    let version = Math.round(Date.now() / 1000);
    let rows = []
    for (let i in statistics.items) for (let j in statistics.items[i].rows) rows[rows.length] = getRowData(statistics.items[i].rows[j], statistics.items[i].id, account_id, version)
    if (rows.length > 0) {
        let result = await updateData(rows, `${scope.toLocaleLowerCase()}_${script_name.toLocaleLowerCase()}`)
        writeLogs('info', `Saved ${rows.length} rows to file with results ${JSON.stringify(result)} (${JSON.stringify({user_id: user_id, mytarget_user_id: account_id})})`, func, scope, script_name)
    } else {
        writeLogs('warn', `Nothing to insert. Have ${rows.length} rows (${JSON.stringify({user_id: user_id, mytarget_user_id: account_id})})`, func, scope, script_name)
    }
    rows = undefined
    statistics = undefined
    writeLogs('info', `Client statistics updated (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id })})`, func, scope, script_name)
    return null
}
function getRowData(json, banner_id, account_id, version) {
    let buff = {
        account_id: '' + account_id,
        type: '' + setup.type,
        id: '' + banner_id,
        date: json.date,
        shows: json.base.shows,
        clicks: json.base.clicks,
        spent: json.base.spent,
        uniques_reach: json.uniques.reach,
        uniques_total: json.uniques.total,
        uniques_frequency: json.uniques.frequency,
        video_started: json.video.started,
        video_viewed_25_percent: json.video.viewed_25_percent,
        video_viewed_50_percent: json.video.viewed_50_percent,
        video_viewed_75_percent: json.video.viewed_75_percent,
        video_viewed_100_percent: json.video.viewed_100_percent,
        version: version
    }
    return buff
}
export async function getStatistics(account_id, user_id, credentials, date_start, date_end, data_type) {
    const func = 'getStatistics'
    let path = `/api/v2/statistics/${setup.type}/day.json`
    let params = [
        `date_from=${date_start.toISOString().substring(0, 10)}`,
        `date_to=${date_end.toISOString().substring(0, 10)}`,
        `metrics=${setup.metrics.join(',')}`
    ]
    try {
        let res = await sendRequest(account_id, user_id, credentials, `${[app.request_uri + path, params.join('&')].join('?')}`, data_type)
        let json = await res.json();
        return json;
    } catch (error) {
        writeLogs('info', `Statistics request failed ${JSON.stringify(error)} (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id })})`, func, scope, script_name)
        return []
    }
}
export default {
    runUpdate
}
