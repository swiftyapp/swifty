module.exports = {
  config: {
    url:
      'https://www.googleapis.com/drive/v3/files?q=name%20%3D%20%27Swifty%27%20and%20trashed%20%3D%20false&fields=files%28id%2C%20name%29',
    method: 'GET',
    paramsSerializer: function() {},
    headers: {
      'x-goog-api-client': 'gdcl/3.2.0 gl-node/13.6.0 auth/5.7.0',
      'Accept-Encoding': 'gzip',
      'User-Agent': 'google-api-nodejs-client/3.2.0 (gzip)',
      Authorization:
        'Bearer ya29.ImC9BywXlhVkxuephNATM6BJO1shRIfJHtOLjcqtGt_ORmzMIi93kJBQnPoy5OGeJ9RjLGQw78B_IGDmsQ6r7MMCnbhFTeGSf4nQalfrOWhwNKGSIzlw5u0_u3LyqFg0-DQ',
      Accept: 'application/json'
    },
    params: {
      q: "name = 'Swifty' and trashed = false",
      fields: 'files(id, name)'
    },
    validateStatus: function() {},
    retry: true,
    responseType: 'json'
  },
  data: {
    files: [
      {
        id: '1CqdN4Al8SNKSpzrWZCMelen3aGW9IU3C',
        name: 'Swifty'
      }
    ]
  },
  headers: {
    'alt-svc':
      'quic=":443"; ma=2592000; v="46,43",h3-Q050=":443"; ma=2592000,h3-Q049=":443"; ma=2592000,h3-Q048=":443"; ma=2592000,h3-Q046=":443"; ma=2592000,h3-Q043=":443"; ma=2592000',
    'cache-control': 'private, max-age=0, must-revalidate, no-transform',
    connection: 'close',
    'content-encoding': 'gzip',
    'content-type': 'application/json; charset=UTF-8',
    date: 'Mon, 17 Feb 2020 23:27:51 GMT',
    expires: 'Mon, 17 Feb 2020 23:27:51 GMT',
    server: 'GSE',
    'transfer-encoding': 'chunked',
    vary: 'Origin, X-Origin',
    'x-content-type-options': 'nosniff',
    'x-frame-options': 'SAMEORIGIN',
    'x-xss-protection': '1; mode=block'
  },
  status: 200,
  statusText: 'OK',
  request: {
    responseURL:
      'https://www.googleapis.com/drive/v3/files?q=name%20%3D%20%27Swifty%27%20and%20trashed%20%3D%20false&fields=files%28id%2C%20name%29'
  }
}
