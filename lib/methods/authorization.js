import cr from '#utils/credentials.js'
import { app, scope } from '#lib/index.js'
import { fetchData, writeLogs } from '#utils/index.js'

const script_name = 'authorization'
const sub_credentials_prefix = 'client'
/**
 * Функция создания нового ключа доступа
 * Если превышен лимит, удаляет старые ключи
 * @param {*} code 
 * @param {*} mytarget_user_id Идентификатор аккаунта MyTarget
 * @param {*} user_id Идентификатор пользователя Платины
 * @returns 
 */
async function requestToken(code, account_id, user_id) {
    const func = 'requestToken';
    writeLogs('debug', `Launched function (${JSON.stringify({ code: typeof code, account_id: account_id, user_id: user_id })})`, func, scope)
    const path = '/api/v2/oauth2/token.json'
    try {
        let options = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=authorization_code&code=${code}&client_id=${app.client_id}`
        }
        let res = await fetchData(`${app.request_uri + path}`, options)
        writeLogs('info', `Access token requested ${res.status} ${res.statusText}`, func, scope);
        // console.log(`Access token requested ${res.status} ${res.statusText}`)
        if (res.status == 200) {
            let json = await res.json()
            if (typeof json.access_token !== 'undefined') {
                res = await cr.provideCredentials(json, scope, account_id, user_id, app.data_type)
                return true
            } else {
                throw `Malformed json (${JSON.stringify(json)})`
            }
        } else if (res.status == 403) {
            await deleteTokens(account_id)
            return await requestToken(code, account_id, user_id);
        } else {
            throw `Request failed ${res.status} ${res.statusText}`
        }
    } catch (error) {
        throw `Request access token failed (${JSON.stringify({ error })})`
    }
}
/**
 * Запрашивает ключ доступа для клиента MyTarget
 * Ключи доступа типа агентства и клиента отличаются параметром data_type
 * @param {*} account_id Идентификатор пользователя MyTarget
 * @param {*} user_id Идентификатор пользователя Платины
 * @param {*} client_id Идентификатор клиента MyTarget
 * @returns 
 */
async function requestClientToken(access_token, account_id, user_id, client_id){
    const func = 'requestClientToken';
    const path = '/api/v2/oauth2/token.json'
    try {
        writeLogs('debug', `Atempt to update token if exists (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id })})`, func, scope);
        // console.log(`Atempt to update token if exists (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id })})`)        
        let credentials = await cr.requestCredentials(scope, client_id, user_id, `${sub_credentials_prefix}_${app.data_type}`)
        credentials = await refreshToken(credentials.refresh_token, client_id, user_id, `${sub_credentials_prefix}_${app.data_type}`)
        let result = await cr.provideCredentials(credentials, scope, client_id, user_id, `${sub_credentials_prefix}_${app.data_type}`)
        writeLogs('debug', `Performed an update of existing token with result: ${JSON.stringify(result)} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id })})`, func, scope);
        // console.log(`Performed an update of existing token with result: ${JSON.stringify(result)} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id })})`)        
        return credentials
    } catch (error) {
        writeLogs('debug', `Requesting new token (atempt to update token failed with error: ${error}) (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id })})`, func, scope);
        // console.log(`Requesting new token (atempt to update token failed with error: ${error}) (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id })})`)        
    }
    try {
        let options = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: `grant_type=agency_client_credentials&client_id=${app.client_id}&client_secret=${app.client_secret}&agency_client_id=${client_id}&access_token=${access_token}`
        }
        let res = await fetchData(`${app.request_uri + path}`, options)
        writeLogs('info', `Access token requested ${res.status} ${res.statusText} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id})})`, func, scope);
        // console.log(`Access token requested ${res.status} ${res.statusText} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id})})`)        
        if(res.status == 200) {
            let json = await res.json()
            if (typeof json.access_token !== 'undefined') {
                let result = await cr.provideCredentials(json, scope, client_id, user_id, `${sub_credentials_prefix}_${app.data_type}`)
                writeLogs('info', `Access token saved with result: ${result} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id})})`, func, scope);
                // console.log(`Access token saved with result: ${result} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id})})`)
                return json
            } else {
                throw `Something went wrong (${JSON.stringify({json:json, res: res})})`
            }
        } else {
            let text = await res.text()
            writeLogs('info', `Access token requested ${res.status} ${res.statusText}: ${text} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id})})`, func, scope);
            // console.log(`Access token requested ${res.status} ${res.statusText}: ${text} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id})})`)        
            if (res.status == 403) {
                await deleteTokens(client_id, access_token)
                writeLogs('debug', `Deleted all accounts token (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id})})`, func, scope);
                // console.log('deleted tokens')
                return await requestClientToken(access_token, account_id, user_id, client_id)
            } else {
                let text = await res.text()
                writeLogs('debug', `Failed to retrive token: ${res.status} ${res.statusText}: ${text} (${JSON.stringify({ user_id: user_id, mytarget_user_id: account_id, mytarget_client_id: client_id})})`, func, scope);
                // console.log(`Request failed ${res.status} ${res.statusText}: ${text}`)
                throw `Request failed ${res.status} ${res.statusText}: ${text}`
            }
        }
    } catch (error) {
        throw `Request access token failed (${JSON.stringify({ error })})`
    }
}
/**
 * Функция обновления существующего ключа доступа
 * Возможно обновление ключа не старше 30 дней (см. документацию)
 * @param {*} refresh_token
 * @param {*} account_id Идентификатор пользователя MyTarget
 * @param {*} user_id Идентификатор пользователя Платины
 * @returns 
 */
async function refreshToken(refresh_token, account_id, user_id, data_type) {
    const func = 'refreshToken'
    writeLogs('debug', `Refreshing access token (${JSON.stringify({refresh_token: typeof refresh_token, account_id: account_id, user_id: user_id, data_type: data_type})})`, func, scope, script_name);
    // console.log(`Refreshing access token (${JSON.stringify({refresh_token: typeof refresh_token, account_id: account_id, user_id: user_id, data_type: data_type})})`)
    const path = '/api/v2/oauth2/token.json'
    if(typeof data_type === 'undefined') data_type = app.data_type
    // console.log(`Refreshing access token (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id })})`)
    writeLogs('info', `Refreshing access token (${JSON.stringify({ mytarget_user_id: account_id, user_id: user_id})})`, func, scope, script_name);
    const url = `${app.request_uri + path}`
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${refresh_token}&client_id=${app.client_id}&client_secret=${app.client_secret}`
    }
    try {
        let res = await fetchData(url, options)
        if (res.status == 200) {
            let json = await res.json()
            await cr.provideCredentials(json, scope, account_id, user_id, data_type)
            return json
        } else {
            throw `Request failed ${res.status} ${res.statusText}`
        }
    } catch (error) {
        throw error
    }
}
/**
 * Удаляет все ключи доступа для заданного аккаунта MyTarget
 * @param {*} account_id 
 * @returns 
 */
async function deleteTokens(account_id, agency_access_token) {
    const func = 'deleteTokens'
    const path = '/api/v2/oauth2/token/delete.json'
    writeLogs('info', `Exceed limit of the number of tokens per clientId - user bundle. Deleting previous account tokens (${JSON.stringify({mytarget_user_id: account_id, agency_access_token: typeof agency_access_token})})`, func, scope)
    // console.log(`Exceed limit of the number of tokens per clientId - user bundle. Deleting previous account tokens (${JSON.stringify({mytarget_user_id: account_id, agency_access_token: typeof agency_access_token})})`)
    const url = `${app.request_uri + path}`
    let params = [
        `client_id=${app.client_id}`,
        `client_secret=${app.client_secret}`,
        `user_id=${account_id}`
    ]
    if(typeof agency_access_token !== 'undefined') params.push(`access_token=${agency_access_token}`)
    const options = {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.join('&')
    }
    try {
        writeLogs('debug', `Going to perform delete request (${JSON.stringify({mytarget_user_id: account_id, agency_access_token: typeof agency_access_token})})`, func, scope)
        // console.log(`Going to perform delete request`)
        let res = await fetchData(url, options)
        if (res.status == 200) {
            return true
        } else {
            writeLogs('debug', `Failed to delete tokens ${res.status} ${res.statusText} (${JSON.stringify({mytarget_user_id: account_id, agency_access_token: typeof agency_access_token})})`, func, scope)
            // console.log(`Failed to delete tokens ${res.status} ${res.statusText}`)
            throw `Failed to delete tokens ${res.status} ${res.statusText}`
        }
    } catch (error) {
        writeLogs('debug', `Failed to delete tokens ${JSON.stringify(error)} (${JSON.stringify({mytarget_user_id: account_id, agency_access_token: typeof agency_access_token})})`, func, scope)
        // console.log(`Failed to delete tokens ${JSON.stringify(error)}`)
        throw `Failed to delete tokens ${JSON.stringify(error)}`
    }
}
export default {
    deleteTokens,
    requestClientToken,
    requestToken,
    refreshToken,
}