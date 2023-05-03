import auth from '#lib/authorization.js'
import { app, scope, getUsersCredentials, sendRequest, updateData } from '#lib/index.js'
import { writeLogs } from '#utils/index.js'

const script_name = 'Users'
/**
 * Запускает обновление информации о пользователях
 */
async function runUpdate(){
    const func = 'runUpdate'
    writeLogs('info', `Launched users update`, func, scope, script_name)
    // console.log(`Launched users update`)
    let list = await getUsersCredentials()
    writeLogs('info', `Users list requested: retrived ${Object.keys(list).length} objects`, func, scope, script_name)
    // console.log(`Users list requested: retrived ${Object.keys(list).length} objects`)
    // let rows = []
    for (let account_id in list) try {
        let json = await getUserInfo(account_id, list[account_id].user_id, list[account_id].credentials)
        for(let i in json) if(typeof(json[i]) === 'object') json[i] = JSON.stringify(json[i])
        let result = await updateData(json, `${scope.toLocaleLowerCase()}_${script_name.toLocaleLowerCase()}`)
    } catch(error) {
        writeLogs('info', `Failed to update user info ${JSON.stringify(error)}`, func, scope, script_name)
        // console.log(`Failed to update user info ${JSON.stringify(error)}`)
    }
    list = undefined
}
/**
 * Получение информации о пользователе по ключу доступа
 * @param {*} access_token 
 * @returns Возвращает объект User или ошибку
 */
export async function getUserInfo(account_id, user_id, credentials) {
    // https://target.my.com/doc/api/ru/resource/User
    const func = 'getUserInfo'
    const path = '/api/v2/user.json'
    let res = await sendRequest(account_id, user_id, credentials, `${app.request_uri + path}`)
    if (res.status == 200) {
        let json = await res.json();
        return json;
    } else {
        throw `${res.status} ${res.statusText}`
    }
}
export default {
    runUpdate
}