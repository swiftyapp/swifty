module.exports = {
  config: {
    url: 'https://www.googleapis.com/drive/v3/files',
    method: 'POST',
    paramsSerializer: function() {},
    data: {
      name: 'DELETE_ME',
      mimeType: 'application/vnd.google-apps.folder'
    },
    headers: {
      'x-goog-api-client': 'gdcl/3.2.0 gl-node/13.6.0 auth/5.7.0',
      'Accept-Encoding': 'gzip',
      'User-Agent': 'google-api-nodejs-client/3.2.0 (gzip)',
      Authorization:
        'Bearer ya29.ImC9BywXlhVkxuephNATM6BJO1shRIfJHtOLjcqtGt_ORmzMIi93kJBQnPoy5OGeJ9RjLGQw78B_IGDmsQ6r7MMCnbhFTeGSf4nQalfrOWhwNKGSIzlw5u0_u3LyqFg0-DQ',
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    params: {},
    validateStatus: function() {},
    retry: true,
    body:
      '{"name":"DELETE_ME","mimeType":"application/vnd.google-apps.folder"}',
    responseType: 'json'
  },
  data: {
    kind: 'drive#file',
    id: '1upGfeKN9Vy5tzTTfk5jI7P3BzvnJCqw2',
    name: 'DELETE_ME',
    mimeType: 'application/vnd.google-apps.folder'
  },
  headers: {
    'alt-svc':
      'quic=":443"; ma=2592000; v="46,43",h3-Q050=":443"; ma=2592000,h3-Q049=":443"; ma=2592000,h3-Q048=":443"; ma=2592000,h3-Q046=":443"; ma=2592000,h3-Q043=":443"; ma=2592000',
    'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
    connection: 'close',
    'content-encoding': 'gzip',
    'content-type': 'application/json; charset=UTF-8',
    date: 'Mon, 17 Feb 2020 23:35:07 GMT',
    expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
    pragma: 'no-cache',
    server: 'GSE',
    'transfer-encoding': 'chunked',
    vary: 'Origin, X-Origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'x-xss-protection': '1; mode=block'
  },
  status: 200,
  statusText: 'OK',
  request: { responseURL: 'https://www.googleapis.com/drive/v3/files' }
}
