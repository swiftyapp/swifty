let listFilesResponse = null
let createFileResponse = null
let updateFileResponse = null

let listFilesError = null
let createFileError = null
let updateFileError = null

const get = jest.fn(params => {
  if (params.fileId === '1upGfeNV9Vy5tzTQfk3jI7P5bZvnJCqwa') {
    return Promise.resolve({ data: 'CONTENT' })
  } else {
    return Promise.reject(Error('File not found'))
  }
})

const list = jest.fn(() => {
  if (listFilesError) {
    return Promise.reject(Error(listFilesError))
  } else {
    return Promise.resolve({ data: listFilesResponse })
  }
})

const create = jest.fn(() => {
  if (createFileError) {
    return Promise.reject(Error(createFileError))
  } else {
    return Promise.resolve({ data: createFileResponse })
  }
})

const update = jest.fn(() => {
  if (updateFileError) {
    return Promise.reject(Error(updateFileError))
  } else {
    return Promise.resolve({ data: updateFileResponse })
  }
})

const setCredentials = jest.fn()
const on = jest.fn()
const getToken = jest.fn(() => Promise.resolve('TOKEN'))

const __setListFilesResponse = response => {
  listFilesResponse = response
}

const __setListFilesError = message => {
  listFilesError = message
}

const __setCreateFileResponse = response => {
  createFileResponse = response
}

const __setCreateFileError = message => {
  createFileError = message
}

const __setUpdateFileResponse = response => {
  updateFileResponse = response
}

const __setUpdateFileError = message => {
  updateFileError = message
}

module.exports = {
  google: {
    drive: jest.fn(() => {
      return {
        files: { get, list, create, update }
      }
    }),
    auth: {
      OAuth2: jest.fn(() => {
        return {
          on: on,
          generateAuthUrl: jest.fn(() => 'https://example.com/google_oauth2'),
          setCredentials: setCredentials,
          getToken: getToken
        }
      })
    },
    __setListFilesResponse: __setListFilesResponse,
    __setCreateFileResponse: __setCreateFileResponse,
    __setUpdateFileResponse: __setUpdateFileResponse,
    __setListFilesError: __setListFilesError,
    __setCreateFileError: __setCreateFileError,
    __setUpdateFileError: __setUpdateFileError
  }
}
