import fs from 'fs'
import crypto from 'crypto'
import { scope } from '#lib/index.js'
import { deleteFile, performCommand, writeLogs } from '#utils/index.js'

const script_name = 'Clickhouse'

/**
 * 
 * @param {Array} json 
 * @param {String} table_name 
 * @returns done / fail
 */
async function saveData(json, table_name) {
    const func = 'saveData'
    await writeLogs('debug', `Launched saveData function (${JSON.stringify({ json: typeof json, table_name: table_name })})`, func, scope, script_name)
    const conf = JSON.parse(fs.readFileSync(process.env.clickhouse))
    try {
        let hash = crypto.createHash('sha1').update(JSON.stringify(json)).digest('hex')
        let file_path = `${process.env.script_data}/${table_name}_${new Date().toISOString().substr(0, 10)}_${hash}.json`
        await writeLogs('debug', `Saving data to file (${JSON.stringify({ file_path: file_path, json: typeof json, table_name: table_name })})`, func, scope, script_name)
        // let json_each_row = JSONEachRow(json)
        // fs.writeFileSync(file_path, json_each_row.join('\n'))
        fs.writeFileSync(file_path, JSON.stringify(json))
        const command = `cat ${file_path} | clickhouse-client -h ${process.env.CHIP} --port ${process.env.CHPORT} -u ${process.env.CHUSER} --password ${process.env.CHPASSWORD} -q "INSERT INTO ${conf[table_name].database}.${conf[table_name].table} FORMAT JSONEachRow" --max_threads 4 --max_block_size 8192 --max_memory_usage 20000000000`
        await writeLogs('debug', `Importing data from file to Clickhouse (${JSON.stringify({ json: typeof json, database: conf[table_name].database, table: conf[table_name].table})})`, func, scope, script_name)
        let result = await performCommand(command)
        await writeLogs('debug', `Saved ${Object.keys(json).length} rows to Clickhouse with result (${result}) (${JSON.stringify({ json: typeof json, database: conf[table_name].database, table: conf[table_name].table})})`, func, scope, script_name)
        await deleteFile(file_path)
        return 'done'
    } catch (error) {
        await writeLogs('debug', `Failed to save ${Object.keys(json).length} rows to Clickhouse with error (${error}) (${JSON.stringify({ json: typeof json, database: conf[table_name].database, table: conf[table_name].table})})`, func, scope, script_name)
        return 'fail'
    }
}
function JSONEachRow(json){
    let json_each_row = []
    for(let i in json) json_each_row.push(JSON.stringify(json[i]))
    return json_each_row
}
export default {
    saveData
}