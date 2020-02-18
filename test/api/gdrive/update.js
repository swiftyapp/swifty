module.exports = {
  config: {
    url:
      'https://www.googleapis.com/upload/drive/v3/files/1tQYdmLA_tjlk13wkRpUXW5wixtDAR5cT?uploadType=media',
    method: 'PATCH',
    paramsSerializer: function() {},
    data: 'DATA',
    headers: {
      'x-goog-api-client': 'gdcl/3.2.0 gl-node/13.6.0 auth/5.7.0',
      'Content-Type': 'application/vnd.swftx',
      'Accept-Encoding': 'gzip',
      'User-Agent': 'google-api-nodejs-client/3.2.0 (gzip)',
      Authorization:
        'Bearer ya29.ImC9B4JDalwguduagA78Rg8qhQIMhaK8TpaQAY-lxMzb4A1ZP2vVpVONHzMUNEUn80d2AVVOdvgDficQPxopRL7nuc-wyh6JnrNImnEw4ooZv0K49mWruVKb2jafqujwZaM',
      Accept: 'application/json'
    },
    params: { uploadType: 'media' },
    validateStatus: function() {},
    retry: true,
    body: 'DATA',
    responseType: 'json'
  },
  data: {
    kind: 'drive#file',
    id: '1tQYdmLA_tjlk13wkRpUXW5wixtDAR5cT',
    name: 'something',
    mimeType: 'application/vnd.swftx'
  },
  headers: {
    'alt-svc':
      'quic=":443"; ma=2592000; v="46,43",h3-Q050=":443"; ma=2592000,h3-Q049=":443"; ma=2592000,h3-Q048=":443"; ma=2592000,h3-Q046=":443"; ma=2592000,h3-Q043=":443"; ma=2592000',
    'cache-control': 'no-cache, no-store, max-age=0, must-revalidate',
    connection: 'close',
    'content-length': '130',
    'content-type': 'application/json; charset=UTF-8',
    date: 'Tue, 18 Feb 2020 10:46:52 GMT',
    expires: 'Mon, 01 Jan 1990 00:00:00 GMT',
    pragma: 'no-cache',
    server: 'UploadServer',
    vary: 'Origin, X-Origin',
    'x-guploader-uploadid':
      'AEnB2UolAxtIgH4dj_UklVm1ylpJGhthU7JIxO_RwX_Xx0OmOoRX5sND588ka3H7r6oNKEJtr1UryXaWgVuQZXFvP_5dWp691Urvy4SIsHJcM_lGrTr8Qus'
  },
  status: 200,
  statusText: 'OK',
  request: {
    responseURL:
      'https://www.googleapis.com/upload/drive/v3/files/1tQYdmLA_tjlk13wkRpUXW5wixtDAR5cT?uploadType=media'
  }
}
